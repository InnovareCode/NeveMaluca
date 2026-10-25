/**
 * Câmera de descida (plano §3.6). Só render: lê `PilotoLeitura` e os eventos do tick, nunca toca o motor.
 *
 *  - Mola com amortecimento CRÍTICO (sem oscilar) seguindo um ponto à frente do piloto: o olhar à frente, em
 *    METROS NA TELA (zero parado, `sqrt(t)` até `OLHAR_FRENTE_M_MAX` no teto de velocidade, mesmo `t` do zoom de
 *    velocidade), cresce com a velocidade (pedido do dono, iPhone, 2026-10-24: "em alta velocidade a câmera
 *    precisa olhar mais à frente pro jogador ver o obstáculo a tempo"). É em metros NA TELA (resultado final, não
 *    o alvo bruto da mola) por causa de um efeito medido no navegador (skill medir-antes-de-afirmar): uma mola
 *    criticamente amortecida perseguindo um alvo que se move a velocidade constante (o piloto avançando) tem um
 *    atraso de REGIME (não só transição) de `2*vx/ωn` (`ωn = sqrt(RIGIDEZ_CAMERA)`) -- em alta velocidade esse
 *    atraso cresce mais rápido que o alvo ingênuo (`vx * segundos`), e o resultado medido NA TELA ficava MENOR a
 *    26 m/s do que a 14 m/s, o oposto do pedido. `atrasoRegimeM` cancela esse atraso (feedforward) pra o resultado
 *    final bater com `OLHAR_FRENTE_M_*` de verdade. `FRACAO_MAX_OLHAR_FRENTE` continua como rede de segurança de
 *    tela (nunca deixa o piloto sair do quadro num transitório), não é mais o mecanismo principal.
 *  - Zoom de `ZOOM_PARADO` (1,0) até `ZOOM_VELOCIDADE_MAX` (~0,8) conforme a velocidade se aproxima de
 *    `VELOCIDADE_MAX_REF_MS` — ponto de partida para afinar no aparelho com a Vega e o dono (plano: "a medir").
 *  - Câmera de SALTO (pedido do dono, iPhone, 2026-10-24: "no salto alto a câmera fica só no personagem caindo e
 *    ele não vê onde vai cair"): no ar, `preverPouso()` simula a trajetória balística (vx constante + gravidade
 *    cosmética que espelha `ConfigDescida.gravidadeMs2`, SEMPRE 22 -- `descida/atributos.ts`: "regra do mundo,
 *    nunca varia por personagem") até cruzar `alturaDoTerreno` (mesma função do `render/terreno.ts` real -- nunca
 *    uma pista imaginária). Com o ponto de pouso previsto, o olhar-e-zoom da câmera são empurrados SUAVEMENTE
 *    (`fatorSalto`, o mesmo tipo de easing em rampa que já existia no zoom de velocidade -- nunca um salto abrupto
 *    de alvo) até enquadrar piloto + pouso; ao tocar o chão, `fatorSalto` relaxa de volta sozinho. O ponto previsto
 *    sai por `previsaoPouso()` para `render/piloto.ts` desenhar o marcador discreto; a câmera NUNCA desenha nada.
 *  - Tremida curta no pouso pesado/torto e no tombo, com `rngVisual` (NUNCA `Math.random`: regra de todas as
 *    camadas) e decaimento linear em `DURACAO_TREMIDA_TICKS`.
 *  - "Soco" de câmera (feedback do dono, 2026-10-24: "zoom-punch/leve tremor no pouso forte e ao ser atingido"):
 *    um pulso de zoom BEM sutil (`ZOOM_PUNCH_MAX`, poucos % no pico) por cima do zoom de velocidade/salto, decaindo
 *    em `DURACAO_PUNCH_TICKS` -- dispara sozinho no pouso não-perfeito/tombo (escala com `queda`), e também pelo
 *    método `golpe()`, chamado por fora (`ui/cenas/corrida.ts`) quando o jogador é ATINGIDO por um item de rival
 *    (`EventoCorrida 'acerto'`, que esta câmera não enxerga: só lê `EventoDescida`). Deliberadamente sutil --
 *    "sem enjoar" é requisito explícito (o dono joga no iPhone).
 *
 * As constantes de mola/zoom/tremida/soco são do RENDER (não do motor): mudar aqui não muda física nem replay.
 */
import { LARGURA, ALTURA, PASSO_S, PX_POR_METRO, ZOOM_PARADO, ZOOM_VELOCIDADE_MAX } from '../core/constantes';
import type { EventoDescida, PilotoLeitura, PistaGerada } from '../core/contratos';
import type { Rng } from '../core/rng';
import { ANCORA_HORIZONTE_FRAC, type EstadoCamera } from './mundo';
import { alturaDoTerreno } from './terreno';

/** m/s que corresponde ao zoom mínimo. Ponto de partida (plano §3.6); a velocidade máxima real é de `data/personagens`. */
export const VELOCIDADE_MAX_REF_MS = 40;
/** Rigidez da mola (1/s²) e amortecimento crítico (2*sqrt(rigidez): sem oscilação). */
export const RIGIDEZ_CAMERA = 70;
export const AMORTECIMENTO_CAMERA = 2 * Math.sqrt(RIGIDEZ_CAMERA);
/** Olhar à frente NO TETO de velocidade (`VELOCIDADE_MAX_REF_MS`), em METROS NA TELA já de resultado final (ver
 *  comentário do topo do arquivo sobre o atraso de regime) -- zero parado, crescendo com `sqrt(t)` (mesmo `t` do
 *  zoom de velocidade) até este valor. */
export const OLHAR_FRENTE_M_MAX = 7;
/** Teto do olhar-à-frente em FRAÇÃO da largura da tela (0,3 = até 30% pra cada lado do centro) -- rede de
 *  segurança pra transitórios (frenagem/trombada bruscas), não o mecanismo normal de regime. */
export const FRACAO_MAX_OLHAR_FRENTE = 0.3;
export const DURACAO_TREMIDA_TICKS = 10;
export const DURACAO_PUNCH_TICKS = 8;
/** Pulso de zoom no pico do soco (fração, ex. 0,05 = +5%) -- deliberadamente pequeno, nunca mais que isto. */
export const ZOOM_PUNCH_MAX = 0.05;

/** Gravidade (m/s²) usada SÓ para prever onde o piloto pousa (enquadramento da câmera) -- cópia cosmética de
 *  `ConfigDescida.gravidadeMs2` (`descida/constantes.ts`, hoje 22): `render/` não pode importar `descida/` (mesma
 *  regra de layering de `alturaDoTerreno` não importar `pista/`), e esse número é "regra do mundo" que nunca varia
 *  por personagem (`descida/atributos.ts`) -- copiar aqui não é duplicar uma config por engano, é a ÚNICA forma de
 *  a câmera antecipar a física sem furar a camada. Nunca usada para decidir física real, só para onde a câmera olha. */
const GRAVIDADE_PREVISAO_MS2 = 22;
/** Passo e horizonte da simulação de pouso (acima do hangtime real de qualquer salto -- ver `descida/constantes.ts`). */
const PASSO_PREVISAO_S = 0.05;
const HORIZONTE_PREVISAO_PASSOS = 90;
/** Fração da tela (largura/altura) reservada para caber piloto + pouso previsto, com folga nas bordas. */
const MARGEM_ENQUADRAMENTO_SALTO = 0.72;
/** Zoom-out MÁXIMO do enquadramento de salto -- saltos muito altos/longos não deixam o personagem minúsculo; o
 *  pedido do dono é "ver onde vai cair", não "encolher ao extremo" (convive com `ZOOM_VELOCIDADE_MAX`). */
const ZOOM_SALTO_MIN = 0.55;
/** Quanto o alvo da câmera (olhar/zoom) se desloca para o enquadramento de salto por tick, 0..1 (igual espírito do
 *  `* 0.1` do zoom de velocidade): suave o bastante para nunca "enjoar" entrando ou saindo do ar. */
const FATOR_EASE_SALTO = 0.08;
/** Quanto do caminho até o ponto de pouso o olhar da câmera avança (nunca 100%: o personagem continua protagonista). */
const FRACAO_OLHAR_POUSO_X = 0.55;
const FRACAO_OLHAR_POUSO_Y = 0.4;

/** Ponto de pouso previsto (plano "câmera de salto"): só para `render/piloto.ts` desenhar o marcador discreto no
 *  chão -- a câmera em si nunca desenha nada. `visibilidade` é o mesmo `fatorSalto` 0..1 usado para o enquadramento
 *  (sobe suave no ar, desce suave no pouso): quem desenha decide a partir de quanto já é perceptível. */
export interface PrevisaoPouso {
  readonly x: number;
  readonly y: number;
  readonly visibilidade: number;
}

/** Simula a trajetória balística (vx constante, gravidade cosmética) até cruzar `alturaDoTerreno`. `null` se não
 *  resolver dentro do horizonte (ex. piloto praticamente parado no eixo x) -- nesse caso a câmera cai de volta no
 *  enquadramento normal (zoom de velocidade), nunca trava nem aponta para um pouso inventado. */
function preverPouso(piloto: PilotoLeitura, pista: PistaGerada): { readonly x: number; readonly y: number } | null {
  let x = piloto.x;
  let y = piloto.y;
  let vy = piloto.vy;
  for (let i = 0; i < HORIZONTE_PREVISAO_PASSOS; i += 1) {
    vy -= GRAVIDADE_PREVISAO_MS2 * PASSO_PREVISAO_S;
    x += piloto.vx * PASSO_PREVISAO_S;
    y += vy * PASSO_PREVISAO_S;
    const chao = alturaDoTerreno(pista, x);
    if (y <= chao) return { x, y: chao };
  }
  return null;
}

/** Zoom (mesma escala de `ZOOM_PARADO`/`ZOOM_VELOCIDADE_MAX`) que enquadra piloto + pouso previsto com folga,
 *  nunca mais solto que `ZOOM_SALTO_MIN`.
 *
 *  Vertical NÃO é simétrico: `mundo.ts: ANCORA_HORIZONTE_FRAC` (0,58) ancora o piloto abaixo do meio da tela, então
 *  só ~42% da altura fica disponível ABAIXO da linha de ancoragem (contra ~58% acima) -- e o pouso quase sempre
 *  está ABAIXO do piloto (ele está caindo). Medido no navegador (skill medir-antes-de-afirmar, screenshot real de
 *  um salto de kicker grande): usar `ALTURA * MARGEM` (simétrico) como se fosse metade pra cada lado SUBESTIMAVA
 *  o zoom-out necessário e o marcador saía cortado por baixo da tela -- exatamente o bug que esta câmera existe
 *  pra resolver. A margem usada agora é a do lado real em que o pouso cai. */
function zoomParaEnquadrarSalto(piloto: PilotoLeitura, pouso: { readonly x: number; readonly y: number }): number {
  const deltaXm = Math.max(Math.abs(pouso.x - piloto.x), 1);
  const deltaYm = Math.max(Math.abs(piloto.y - pouso.y), 1);
  const margemAcimaPx = ANCORA_HORIZONTE_FRAC * ALTURA * MARGEM_ENQUADRAMENTO_SALTO;
  const margemAbaixoPx = (1 - ANCORA_HORIZONTE_FRAC) * ALTURA * MARGEM_ENQUADRAMENTO_SALTO;
  const margemYPx = pouso.y <= piloto.y ? margemAbaixoPx : margemAcimaPx;
  const zoomX = (LARGURA * MARGEM_ENQUADRAMENTO_SALTO) / (deltaXm * PX_POR_METRO);
  const zoomY = margemYPx / (deltaYm * PX_POR_METRO);
  return Math.min(ZOOM_PARADO, Math.max(ZOOM_SALTO_MIN, Math.min(zoomX, zoomY)));
}

export interface Camera {
  /** Um tick (chamar do `atualizar()` da cena, não do `desenhar()`: a câmera também é passo fixo). `pista` só
   *  alimenta `preverPouso`/`alturaDoTerreno` (câmera de salto); nunca é usada para nada além de enquadramento. */
  atualizar(piloto: PilotoLeitura, eventos: readonly EventoDescida[], rngVisual: Rng, pista: PistaGerada): void;
  /** Soco de câmera disparado de FORA (ex. o jogador foi atingido por item de rival) -- `intensidade` 0..1;
   *  nunca derruba um soco mais forte já em andamento (o pouso/tombo interno continua ganhando se for maior). */
  golpe(intensidade: number): void;
  leitura(): EstadoCamera;
  /** Ponto de pouso previsto AGORA (câmera de salto), ou `null` fora do ar/sem previsão resolvida. Só leitura para
   *  quem desenha o marcador discreto (`render/piloto.ts`) -- a câmera nunca desenha. */
  previsaoPouso(): PrevisaoPouso | null;
}

export function criarCamera(xInicial: number, yInicial: number): Camera {
  let x = xInicial;
  let y = yInicial;
  let vx = 0;
  let vy = 0;
  let zoom = ZOOM_PARADO;
  let ticksTremida = 0;
  let forcaTremida = 0;
  let tremidaX = 0;
  let tremidaY = 0;
  let ticksPunch = 0;
  let intensidadePunch = 0;
  // Câmera de salto: `fatorSalto` é a MESMA ideia de easing do zoom de velocidade (`* 0.1` abaixo), só que decidindo
  // o quanto o olhar/zoom já migrou em direção ao enquadramento piloto+pouso -- sobe no ar, desce no chão, nunca pula.
  let fatorSalto = 0;
  let ultimaPrevisao: { readonly x: number; readonly y: number } | null = null;

  function golpe(intensidade: number): void {
    const i = Math.max(0, Math.min(1, intensidade));
    if (ticksPunch === 0 || i >= intensidadePunch) {
      intensidadePunch = i;
      ticksPunch = DURACAO_PUNCH_TICKS;
    }
  }

  return {
    atualizar(piloto, eventos, rngVisual, pista) {
      const t = Math.min(1, piloto.velocidade / VELOCIDADE_MAX_REF_MS);
      // `sqrt(t)` (não `t` puro): sobe mais rápido no começo -- devagar já mostra um pouco de olhar à frente,
      // igual o comportamento de antes desta rodada (`render-camera.test.ts` fixa vx=0 => ZERO de olhar à
      // frente, câmera centrada no piloto parado -- por isso este termo tem que desaparecer exatamente em t=0,
      // nunca um `OLHAR_FRENTE_M_BASE` fixo somado por fora).
      const olharFrenteM = OLHAR_FRENTE_M_MAX * Math.sqrt(t);
      // Cancela o atraso de REGIME da mola perseguindo o piloto (que avança a `vx` constante) -- ver comentário no
      // topo do arquivo. Sem isto, `olharFrenteM` seria só o alvo bruto da mola, não o resultado final na tela.
      // Também desaparece em `vx === 0`, preservando o mesmo caso de teste.
      const atrasoRegimeM = (2 * piloto.vx) / Math.sqrt(RIGIDEZ_CAMERA);
      let alvoX = piloto.x + olharFrenteM + atrasoRegimeM;
      let alvoY = piloto.y;
      let zoomAlvo = ZOOM_PARADO + (ZOOM_VELOCIDADE_MAX - ZOOM_PARADO) * t;

      // `zoom` aqui é o valor do tick anterior (muda pouco por tick, câmera já é suavizada) -- usado só pra
      // converter a rede de segurança abaixo (px de tela) em metros.
      const escalaAtual = PX_POR_METRO * zoom;
      const offsetMaxPx = LARGURA * FRACAO_MAX_OLHAR_FRENTE;

      // Previsão de pouso: só recalcula/empurra o enquadramento no ar (ou enquanto o easing ainda está voltando do
      // ar, pra sair suave). `fatorSalto` evolui sempre (rampa própria), independente de a previsão ter resolvido.
      const noAr = piloto.modo === 'ar';
      fatorSalto += ((noAr ? 1 : 0) - fatorSalto) * FATOR_EASE_SALTO;
      ultimaPrevisao = null;
      if (noAr || fatorSalto > 0.001) {
        const pouso = preverPouso(piloto, pista);
        if (pouso) {
          ultimaPrevisao = pouso;
          const alvoXSalto = piloto.x + (pouso.x - piloto.x) * FRACAO_OLHAR_POUSO_X;
          const alvoYSalto = piloto.y + (pouso.y - piloto.y) * FRACAO_OLHAR_POUSO_Y;
          const zoomSalto = zoomParaEnquadrarSalto(piloto, pouso);
          // Trava só a CONTRIBUIÇÃO do salto (não `olharFrenteM`/`atrasoRegimeM`, que já são seguros por
          // construção -- travar o alvo JÁ COMPENSADO desfaria a compensação de atraso, ver comentário do topo):
          // saltos muito longos preveem pouso dezenas de metros à frente (`deltaXm` medido no navegador chegou a
          // ~127m num kicker grande), bem além do que `ZOOM_SALTO_MIN` consegue enquadrar sozinho logo no início
          // do voo -- sem travar aqui, o piloto sairia do quadro enquanto o zoom-out ainda não convergiu.
          const deltaSaltoXPx = Math.max(-offsetMaxPx, Math.min(offsetMaxPx, (alvoXSalto - alvoX) * escalaAtual));
          alvoX += (deltaSaltoXPx / escalaAtual) * fatorSalto;
          alvoY += (alvoYSalto - alvoY) * fatorSalto;
          // O menor zoom (mais zoom-out) entre velocidade e salto vence, suavizado pela mesma rampa de `fatorSalto`.
          zoomAlvo += (Math.min(zoomAlvo, zoomSalto) - zoomAlvo) * fatorSalto;
        }
      }

      const acelX = RIGIDEZ_CAMERA * (alvoX - x) - AMORTECIMENTO_CAMERA * vx;
      const acelY = RIGIDEZ_CAMERA * (alvoY - y) - AMORTECIMENTO_CAMERA * vy;
      vx += acelX * PASSO_S;
      vy += acelY * PASSO_S;
      x += vx * PASSO_S;
      y += vy * PASSO_S;
      zoom += (zoomAlvo - zoom) * 0.1;

      for (const ev of eventos) {
        if (ev.tipo === 'pouso' && ev.qualidade !== 'perfeito') {
          ticksTremida = DURACAO_TREMIDA_TICKS;
          forcaTremida = ev.qualidade === 'torto' ? 6 : 3;
          // Soco escala com a queda (pouso mais forte = soco mais forte), mesmo espírito da tremida acima.
          golpe(Math.min(1, 0.35 + ev.queda * 0.12));
        }
        if (ev.tipo === 'tombo') {
          ticksTremida = DURACAO_TREMIDA_TICKS * 2;
          forcaTremida = 10;
          golpe(1);
        }
      }
      if (ticksTremida > 0) {
        const escalaTremida = ticksTremida / DURACAO_TREMIDA_TICKS;
        tremidaX = rngVisual.entre(-forcaTremida, forcaTremida) * escalaTremida;
        tremidaY = rngVisual.entre(-forcaTremida, forcaTremida) * escalaTremida;
        ticksTremida -= 1;
      } else {
        tremidaX = 0;
        tremidaY = 0;
      }
      if (ticksPunch > 0) ticksPunch -= 1;
      else intensidadePunch = 0;
    },
    golpe,
    leitura(): EstadoCamera {
      const fatorPunch = ticksPunch > 0 ? (ticksPunch / DURACAO_PUNCH_TICKS) * intensidadePunch : 0;
      // A câmera NUNCA empurra o piloto pra fora do centro pra evitar mostrar x<0 (isso cortava o piloto na borda
      // da tela na largada -- pior ainda com 6 pilotos no campeonato). Quem resolve "não existe pista antes da
      // largada" é o RENDER do terreno (`terreno.ts`: estende a amostra pra trás de x=0 com a MESMA pele), não a
      // câmera -- ver comentário lá.
      return { x, y, zoom: zoom * (1 + ZOOM_PUNCH_MAX * fatorPunch), tremidaX, tremidaY };
    },
    previsaoPouso(): PrevisaoPouso | null {
      if (!ultimaPrevisao || fatorSalto <= 0.001) return null;
      return { x: ultimaPrevisao.x, y: ultimaPrevisao.y, visibilidade: fatorSalto };
    },
  };
}
