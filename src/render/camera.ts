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
 *  - Vertical de PULO COMUM: zona morta (`ZONA_MORTA_Y_M`) -- `alvoYBase` só se move quando o piloto sai da faixa,
 *    e só o suficiente pra voltar pra borda dela (nunca persegue o `y` exato). Achado do dono (iPhone,
 *    2026-10-25, build com `ALTURA_ALVO_M=2,8`): "quando pula parece que vai pra baixo" -- a 1ª versão da câmera
 *    de salto (abaixo) engatava em QUALQUER 'ar', inclusive pulo comum, e começava a olhar pro pouso (abaixo) já
 *    na decolagem, brigando com a subida real do piloto. A zona morta sozinha já resolve o pulo do dia a dia: a
 *    altura de ápice de um pulo comum em chão plano (~1,8 m, `descida/constantes.ts`: hangtime ~0,82 s) cabe
 *    inteira dentro da faixa -- a câmera literalmente não se mexe, o piloto sobe e desce na tela sozinho (arco
 *    visível, pedido do dono), sem "câmera quase parada" virar wishful thinking.
 *  - Câmera de SALTO GRANDE (pedido do dono, iPhone, 2026-10-24: "no salto alto a câmera fica só no personagem
 *    caindo e ele não vê onde vai cair") só entra em jogo quando os DOIS valem: (1) já passou do ÁPICE
 *    (`piloto.vy <= 0`: NUNCA durante a subida, por construção -- resolve o achado do dono acima pela raiz, não só
 *    a zona morta) e (2) a queda prevista até o pouso (`preverPouso()`, trajetória balística com gravidade
 *    cosmética que espelha `ConfigDescida.gravidadeMs2`, SEMPRE 22 -- "regra do mundo, nunca varia por
 *    personagem") é de verdade grande (`QUEDA_MIN_SALTO_GRANDE_M`) -- kicker OU queda comprida por terreno, tanto
 *    faz a causa. A classificação ("é salto grande?") é feita UMA VEZ no ápice, não recalculada toda hora. Com o
 *    pouso previsto, o olhar-e-zoom são empurrados SUAVEMENTE (`fatorSalto`, mesma rampa do zoom de velocidade)
 *    até enquadrar piloto + pouso; ao tocar o chão, `fatorSalto` relaxa de volta sozinho. O ponto previsto sai por
 *    `previsaoPouso()` para `render/piloto.ts` desenhar o marcador discreto; a câmera NUNCA desenha nada.
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
/** Faixa (metros, pra cada lado) em que o `y` do piloto pode variar sem a câmera reagir verticalmente -- maior
 *  que a altura de ápice de um pulo comum em chão plano (~1,8 m), então o pulo do dia a dia cabe inteiro dentro
 *  e a câmera literalmente não se mexe nele (ver comentário do topo do arquivo). */
const ZONA_MORTA_Y_M = 2.2;
/** Queda prevista (m, do ápice até o pouso) a partir da qual um salto conta como "grande" -- bem acima do que um
 *  pulo comum em chão plano produz (~1,8 m de ápice -> queda parecida), bem abaixo do que um kicker produz
 *  (dezenas de metros, medido no navegador). Decidido 1x por voo, no ápice -- nunca durante a subida. */
const QUEDA_MIN_SALTO_GRANDE_M = 4;
/** Fração da tela (largura/altura) reservada para caber piloto + pouso previsto, com folga nas bordas. */
const MARGEM_ENQUADRAMENTO_SALTO = 0.72;
/** Zoom-out MÁXIMO do enquadramento de salto -- regra dura do dono (iPhone, 2026-10-25): o piloto nunca fica
 *  menor que ~60% do tamanho de "cruzeiro" (`ZOOM_PARADO=1,0`, a referência, não o zoom de velocidade que já é
 *  menor em si). Medido no navegador (skill medir-antes-de-afirmar, kicker real): em `0,55` o piloto ficava
 *  visivelmente minúsculo num quadro perto do ápice -- subiu pra `0,6` (exatamente a razão pedida). */
const ZOOM_SALTO_MIN = 0.6;
/** Regra dura do dono (iPhone, 2026-10-25): o piloto NUNCA fica a menos de ~15% da altura da tela de qualquer
 *  borda (nem colado em cima, nem embaixo) -- rede de segurança final sobre o `alvoY` E sobre o `y` já integrado
 *  pela mola (ver as duas travas abaixo), igual espírito de `FRACAO_MAX_OLHAR_FRENTE` em X. `0,17`, não `0,15`
 *  cravado: mesmo travando os dois (alvo E resultado), sobra uma folga de arredondamento/escala-defasada de
 *  ~1-2 pontos percentuais -- medido no navegador, `0,15` exato deixava a margem de baixo fechar em "14,6%" no
 *  pouso de um kicker grande (zoom voltando rápido), por isso a folga. Medido: sem NENHUMA trava, no ápice de um
 *  salto de kicker bem alto o piloto chegava a ~2% da altura da tela (quase cortado em cima). */
const FRACAO_MARGEM_BORDA_Y = 0.17;
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
  // o quanto o olhar/zoom já migrou em direção ao enquadramento piloto+pouso -- sobe depois do ápice de um salto
  // GRANDE, desce no chão, nunca pula (ver comentário do topo do arquivo).
  let fatorSalto = 0;
  let ultimaPrevisao: { readonly x: number; readonly y: number } | null = null;
  // Zona morta vertical: `alvoYBase` só persegue o `y` do piloto quando ele sai da faixa -- ver `ZONA_MORTA_Y_M`.
  let alvoYBase = yInicial;
  // Decididos 1x por voo, no ÁPICE (nunca na subida): `apiceDetectado` evita reavaliar a cada tick, `saltoGrandeAtivo`
  // é o que de fato liga a câmera de salto grande (`fatorSalto` só mira 1 quando isto é `true`).
  let apiceDetectado = false;
  let saltoGrandeAtivo = false;

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

      // Zona morta vertical (pulo comum, chão e ar): só reage quando o piloto sai da faixa, e só o suficiente pra
      // voltar pra borda dela -- "câmera quase parada" de verdade, não só um adjetivo (ver topo do arquivo).
      //
      // `compensacaoY`: SÓ quando a zona morta está ativamente sendo esticada (fora dela) -- mesma ideia do
      // `atrasoRegimeM` em X (`2*v/ωn`), só que aqui o alvo também ACELERA (gravidade no ar, `piloto.vy` não é
      // constante como `vx`) -- por isso entra um 2º termo, `aceleracaoAlvo/ωn²`, a compensação EXATA de regime
      // pra uma mola de 2ª ordem perseguindo um alvo com posição+velocidade+aceleração conhecidas (`r + 2r'/ωn +
      // r''/ωn²` cancela o erro de regime pra qualquer `r(t)` suave, não só ramp -- aqui é a mesma dedução de
      // `atrasoRegimeM`, com o termo de 2ª ordem a mais porque `r''=aceleração≠0`). Achado medindo no navegador
      // (skill medir-antes-de-afirmar, salto de kicker real): só o termo de velocidade (sem o de aceleração) já
      // resolvia a maior parte, mas sobrava uma ondulação -- o (pilotoY - camY) ainda overshoot-ava e corrigia de
      // volta visivelmente ENQUANTO o piloto subia de verdade, porque a "rampa" que a câmera persegue não é reta
      // (desacelera por causa da gravidade) e só cancelar a velocidade não cancela essa curvatura. Sem isto
      // (achado original), o (pilotoY - camY) chegava ao pico e caía **56 ticks antes do ápice físico de verdade**
      // (`piloto.vy<=0`) -- o personagem na tela parecia "virar e descer" enquanto ainda subia. Exatamente o
      // "parece que vai pra baixo" que o dono reportou. Dentro da zona morta (`compensacaoY=0`) nada muda: o
      // pulo comum continua com a câmera perfeitamente parada.
      let compensacaoY = 0;
      const diffY = piloto.y - alvoYBase;
      if (diffY > ZONA_MORTA_Y_M || diffY < -ZONA_MORTA_Y_M) {
        alvoYBase = diffY > 0 ? piloto.y - ZONA_MORTA_Y_M : piloto.y + ZONA_MORTA_Y_M;
        const aceleracaoAlvo = piloto.modo === 'ar' ? -GRAVIDADE_PREVISAO_MS2 : 0;
        compensacaoY = (2 * piloto.vy) / Math.sqrt(RIGIDEZ_CAMERA) + aceleracaoAlvo / RIGIDEZ_CAMERA;
      }
      let alvoY = alvoYBase + compensacaoY;

      let zoomAlvo = ZOOM_PARADO + (ZOOM_VELOCIDADE_MAX - ZOOM_PARADO) * t;

      // `zoom` aqui é o valor do tick anterior (muda pouco por tick, câmera já é suavizada) -- usado só pra
      // converter a rede de segurança abaixo (px de tela) em metros.
      const escalaAtual = PX_POR_METRO * zoom;
      const offsetMaxPx = LARGURA * FRACAO_MAX_OLHAR_FRENTE;

      // Classifica "salto grande" 1x por voo, só no ÁPICE (`vy` cruza de + pra <=0) -- NUNCA durante a subida, por
      // construção: é isso que garante que a câmera jamais antecipa o pouso enquanto o piloto ainda está subindo
      // (achado do dono, ver topo do arquivo). Fora do ar, reseta pro próximo voo.
      if (piloto.modo === 'ar') {
        if (!apiceDetectado && piloto.vy <= 0) {
          apiceDetectado = true;
          const pousoNoApice = preverPouso(piloto, pista);
          saltoGrandeAtivo = pousoNoApice !== null && piloto.y - pousoNoApice.y >= QUEDA_MIN_SALTO_GRANDE_M;
        }
      } else {
        apiceDetectado = false;
        saltoGrandeAtivo = false;
      }

      // `fatorSalto` só mira 1 quando o voo JÁ foi classificado como grande (pós-ápice) -- continua evoluindo em
      // rampa suave mesmo depois do pouso, só pra sair do enquadramento de volta ao normal sem solavanco.
      fatorSalto += ((saltoGrandeAtivo ? 1 : 0) - fatorSalto) * FATOR_EASE_SALTO;
      ultimaPrevisao = null;
      if (saltoGrandeAtivo || fatorSalto > 0.001) {
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

      // Rede de segurança final (regra dura do dono, iPhone, 2026-10-25): o piloto nunca fica a menos de
      // `FRACAO_MARGEM_BORDA_Y` da altura da tela de qualquer borda, nem em cima nem embaixo -- trava o ALVO já
      // calculado (zona morta + salto), mesmo espírito de `FRACAO_MAX_OLHAR_FRENTE` em X. Resolve `y` em função de
      // `yTela` (`render/mundo.ts: mundoParaTela`) e limita `(piloto.y - alvoY)` ao intervalo que mantém
      // `yTela` dentro de `[margemPx, ALTURA-margemPx]`. Medido no navegador: sem isto, perto do ápice de um
      // salto de kicker grande o piloto chegava a ~2% da altura da tela (quase cortado em cima).
      const margemBordaPx = ALTURA * FRACAO_MARGEM_BORDA_Y;
      const anchorPx = ANCORA_HORIZONTE_FRAC * ALTURA;
      const diffYMaxPx = anchorPx - margemBordaPx; // piloto perto da borda de CIMA (yTela pequeno)
      const diffYMinPx = anchorPx - (ALTURA - margemBordaPx); // piloto perto da borda de BAIXO (yTela grande)
      const diffYPx = Math.max(diffYMinPx, Math.min(diffYMaxPx, (piloto.y - alvoY) * escalaAtual));
      alvoY = piloto.y - diffYPx / escalaAtual;

      const acelX = RIGIDEZ_CAMERA * (alvoX - x) - AMORTECIMENTO_CAMERA * vx;
      const acelY = RIGIDEZ_CAMERA * (alvoY - y) - AMORTECIMENTO_CAMERA * vy;
      vx += acelX * PASSO_S;
      vy += acelY * PASSO_S;
      x += vx * PASSO_S;
      y += vy * PASSO_S;
      zoom += (zoomAlvo - zoom) * 0.1;

      // Trava o `y` DEPOIS de integrar a mola E com o `zoom` já atualizado (`escalaFinal`, não `escalaAtual` que
      // é do tick anterior): perto do POUSO de um salto grande o zoom volta rápido do mínimo pro normal, e usar
      // a escala desatualizada deixava passar um pouco da margem mesmo já travando (medido: 12,5% em vez de
      // 15%). A mola ainda pode malhar e cruzar a margem por um instante mesmo com o ALVO dentro dela -- regra
      // dura do dono: nunca cruza, trava de novo aqui depois da integração.
      const escalaFinal = PX_POR_METRO * zoom;
      const diffYFinalPx = Math.max(diffYMinPx, Math.min(diffYMaxPx, (piloto.y - y) * escalaFinal));
      y = piloto.y - diffYFinalPx / escalaFinal;

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
