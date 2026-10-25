/**
 * Render da camada de jogo (plano `docs/plano-corrida-campeonato.md` §C3/C4): coletáveis (floco/dourado), kickers
 * e obstáculos altos (`CamadaJogo`, `pista/camada-jogo.ts`) + o feedback de aviso/"por um fio"/turbo de pouso que
 * os eventos do motor disparam. Puramente render -- nunca decide física nem pontos, só lê.
 *
 * Coletáveis: o motor (`LeituraDescida.coletados`) não expõe QUAIS índices já saíram (só a contagem) -- por
 * desenho, não falta: ler `itensColetados` tocaria estado interno do motor que `ui/render` não deve enxergar.
 * Desenhar `camada.itens` inteiro todo quadro é, na prática, equivalente: o jogador só anda para a frente, então
 * um item já visitado (coletado ou não) sai da viewport em poucos quadros e nunca mais volta a aparecer -- mesma
 * filosofia de `pista.objetos`/`pista.trilhos`, que também nunca somem da lista e dependem só de saírem de vista.
 *
 * Cada coletável é um `ObjetoPista` SINTÉTICO de tipo `'floco'` (nunca entra em `pista.objetos`/hash, mesmo padrão
 * de `render/chegada.ts` -- ver memória `objeto-sintetico-render-only-sem-tocar-hash`): reaproveita de graça a
 * pele que cada tema já desenha pra esse tipo (pinhão no Morro, cristal no Cume/Vulcão, marshmallow na Vila, gota
 * de menta no Parque -- `render/temas/<tema>-raster.ts`), sem nenhum sprite novo. `dourado` usa o ícone real
 * (`floco-dourado.webp`, 2026-10-24) + halo pulsante por baixo; sem o ícone, cai na MESMA pele do tema (como
 * antes) com o halo por cima.
 */
import { PX_POR_METRO } from '../core/constantes';
import type { CamadaJogo, EventoDescida, ObjetoPista, PilotoLeitura, PistaGerada } from '../core/contratos';
import { assetsItensProntos } from '../assets/itens';
import { mundoParaTela, pxPorMetro, type EstadoCamera } from './mundo';
import { desenharAlertaObstaculo, desenharFaixaAlerta } from './objetos';
import { alturaDoTerreno } from './terreno';
import type { PintorTema } from './temas/tipos';

const COR_KICKER = '#4da2ff';
const COR_HALO_DOURADO = '#ffd166';
const COR_AVISO = '#ff6b6b';

/** Desenha os coletáveis (`camada.itens`): flutuam com um leve bob (defasado por item, pra não sincronizar). */
export function desenharItensCamada(
  ctx: CanvasRenderingContext2D,
  camada: CamadaJogo,
  camera: EstadoCamera,
  pintor: PintorTema,
  tick: number,
): void {
  if (camada.itens.length === 0) return;
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  for (const item of camada.itens) {
    const bob = Math.sin((tick + item.x * 17) * 0.08) * 0.12;
    const tamanho = item.raio * 2;
    const alturaPx = tamanho * escala;
    const centro = mundoParaTela(item.x, item.y + bob, camera, PX_POR_METRO);

    if (item.tipo === 'dourado') {
      const pulso = 0.5 + 0.5 * Math.sin(tick * 0.12);
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.25 * pulso;
      ctx.fillStyle = COR_HALO_DOURADO;
      ctx.beginPath();
      ctx.arc(centro.x, centro.y, alturaPx * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const icone = assetsItensProntos()?.flocoDourado;
      if (icone) {
        const lado = alturaPx * 1.3;
        ctx.drawImage(icone, centro.x - lado / 2, centro.y - lado / 2, lado, lado);
        continue;
      }
    }

    // Sintético: `yTela` é a BASE (mesmo contrato de `pintor.desenharObjeto`) -- desloca pra baixo metade da
    // altura, pra o sprite ficar CENTRADO em `item.y` (coletável é um círculo, não um objeto apoiado no chão).
    const sintetico: ObjetoPista = { tipo: 'floco', x: item.x, largura: tamanho, altura: tamanho, variante: 0 };
    pintor.desenharObjeto(ctx, sintetico, centro.x, centro.y + alturaPx / 2, escala);
  }
}

/** Desenha a zona de cada kicker: uma faixa de brilho sobre o relevo + uma seta pulsando pra cima no meio. */
export function desenharKickers(ctx: CanvasRenderingContext2D, pista: PistaGerada, camada: CamadaJogo, camera: EstadoCamera, tick: number): void {
  if (camada.kickers.length === 0) return;
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const fatorEscala = escala / PX_POR_METRO;

  for (const k of camada.kickers) {
    ctx.save();
    ctx.strokeStyle = COR_KICKER;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = Math.max(4, 7 * fatorEscala);
    ctx.lineCap = 'round';
    ctx.beginPath();
    const PASSOS = 6;
    for (let i = 0; i <= PASSOS; i += 1) {
      const x = k.x + (k.largura * i) / PASSOS;
      const pt = mundoParaTela(x, alturaDoTerreno(pista, x) + 0.05, camera, PX_POR_METRO);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.restore();

    // 2 chevrons empilhados subindo em looping ("rampa de impulso"), tamanho generoso pra ler de longe.
    const xm = k.x + k.largura / 2;
    const base = mundoParaTela(xm, alturaDoTerreno(pista, xm), camera, PX_POR_METRO);
    const ciclo = ((tick * 4) % 40) / 40; // 0..1 contínuo
    const altSeta = 22 * fatorEscala;
    const meioLargura = 11 * fatorEscala;
    for (const fase of [0, 0.5]) {
      const c = (ciclo + fase) % 1;
      const y0 = base.y - 14 - c * altSeta * 2;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - c * 1.1);
      ctx.fillStyle = COR_KICKER;
      ctx.strokeStyle = '#0b1a33';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(base.x, y0 - 10);
      ctx.lineTo(base.x - meioLargura, y0 + 6);
      ctx.lineTo(base.x + meioLargura, y0 + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** Multiplicador da altura VISUAL do halo do galho: a barra agora é desenhada na altura de cabeça (~1,7x
 *  `obj.altura`, ver `desenharGalho<Tema>` em cada `render/temas/*.ts`), bem acima da caixa de colisão nominal
 *  (1,3 m -- a física só olha `x`/`largura`, nunca `altura`). Sem este fator o halo ficaria baixo, cobrindo só os
 *  postes e não a barra em si. */
const FATOR_ALTURA_VISUAL_GALHO = 1.9;

/** Desenha os obstáculos altos (`camada.obstaculosAltos`, tipo `'galho'`) -- mesmo padrão de `desenharObjetos`
 *  (`render/objetos.ts`), só que sobre a lista da CAMADA, não de `pista.objetos`. `tick` (default 0, compat)
 *  alimenta o MESMO halo pulsante de perigo do galho/pedra/tronco (`desenharAlertaObstaculo`) + a faixa de alerta
 *  no chão: o galho também tomba o piloto sem agachar, então merece o mesmo vocabulário visual de "cuidado". */
export function desenharObstaculosAltos(ctx: CanvasRenderingContext2D, pista: PistaGerada, camada: CamadaJogo, camera: EstadoCamera, pintor: PintorTema, tick = 0): void {
  if (camada.obstaculosAltos.length === 0) return;
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  for (const obj of camada.obstaculosAltos) {
    const centroXm = obj.x + obj.largura / 2;
    const baseTela = mundoParaTela(centroXm, alturaDoTerreno(pista, centroXm), camera, PX_POR_METRO);
    const larguraPx = Math.max(8, obj.largura * escala);
    const alturaPx = Math.max(8, obj.altura * escala) * FATOR_ALTURA_VISUAL_GALHO;
    desenharFaixaAlerta(ctx, baseTela.x, baseTela.y, larguraPx, tick);
    desenharAlertaObstaculo(ctx, baseTela.x, baseTela.y, larguraPx, alturaPx, tick);
    pintor.desenharObjeto(ctx, obj, baseTela.x, baseTela.y, escala);
  }
}

// --- Avisos de obstáculo (evento `aviso-obstaculo`, C4): "!" flutuando sobre o galho ~1,5s antes de chegar nele ---

/** ~1,5 s a 60 tps (`PASSO_S`/`TICKS_POR_SEGUNDO`) -- a mesma janela de `AVISO_SEGUNDOS` do motor (`descida/motor.ts`);
 *  não precisa ser EXATA (o galho real já fica visível por conta própria), só o bastante pra dar tempo de reação. */
const DURACAO_AVISO_TICKS = 90;
const CAPACIDADE_AVISOS = 8;
/** Metros acima do chão onde o "!" flutua -- acima da barra de cabeça redesenhada (galho agora vai até ~1,3*1,7 m
 *  + a capa de neve, ver `desenharGalho<Tema>`), folga pra não colidir visualmente com ela. */
const ALTURA_AVISO_M = 3.1;

/** Quantos avisos de galho (de TODA a sessão, não só desta pista) ainda ganham a dica "AGACHAR" por baixo do "!"
 *  -- pedido do dono: "pras primeiras vezes". Módulo (não dentro da factory): sobrevive entre descidas/corridas
 *  na mesma aba, só zera no reload -- mais fiel a "primeiras vezes jogando" do que resetar a cada pista. */
const LIMITE_DICA_AGACHAR = 3;
let avisosGalhoVistosSessao = 0;

interface AvisoObstaculo {
  ativo: boolean;
  x: number;
  vida: number;
  /** `true` só para os primeiros `LIMITE_DICA_AGACHAR` avisos da sessão (decidido na abertura, nunca muda depois). */
  mostrarDica: boolean;
}

export interface SistemaAvisosObstaculo {
  /** Lê os eventos do tick e abre um aviso novo a cada `'aviso-obstaculo'`; decai os já abertos. */
  atualizar(eventos: readonly EventoDescida[]): void;
  /** Desenha os avisos ativos, ancorados no `x` do mundo (não no piloto) -- `piloto`, se dado, ancora a dica
   *  "AGACHAR" (pedido do dono: "perto do personagem", não em cima do galho que pode nem estar na tela ainda). */
  desenhar(ctx: CanvasRenderingContext2D, pista: PistaGerada, camera: EstadoCamera, piloto?: PilotoLeitura): void;
}

/** Dica "AGACHAR" grande, ancorada perto do PERSONAGEM (pedido do dono, reforçado 2026-10-24: "letra minúscula,
 *  ilegível no iPhone... grande, com ícone de 2 dedos/seta pra baixo, perto do personagem"). Pílula opaca (lê
 *  contra qualquer fundo) + seta-chevron desenhada (não um glifo de fonte minúsculo) + "AGACHAR" em fonte grande
 *  + legenda pequena cobrindo teclado E toque na mesma linha. */
function desenharDicaAgachar(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number): void {
  const w = 172;
  const h = 60;
  const esquerdaX = x - w / 2;
  const topoY = y - h / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.roundRect(esquerdaX, topoY, w, h, 16);
  ctx.fillStyle = 'rgba(11, 26, 51, 0.78)';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = COR_AVISO;
  ctx.stroke();

  // Seta-chevron grande pra baixo (desenhada, não um glifo de fonte pequeno demais pra ler no iPhone).
  const ax = esquerdaX + 28;
  ctx.save();
  ctx.translate(ax, y);
  ctx.beginPath();
  ctx.moveTo(-13, -11);
  ctx.lineTo(0, 7);
  ctx.lineTo(13, -11);
  ctx.lineTo(13, -3);
  ctx.lineTo(0, 15);
  ctx.lineTo(-13, -3);
  ctx.closePath();
  ctx.fillStyle = '#fff4f4';
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.font = '900 22px "Barlow Condensed", sans-serif';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#0b1a33';
  ctx.strokeText('AGACHAR', ax + 24, y - 6);
  ctx.fillStyle = '#fff4f4';
  ctx.fillText('AGACHAR', ax + 24, y - 6);

  ctx.font = '700 13px "Barlow Condensed", sans-serif';
  ctx.lineWidth = 2.5;
  ctx.strokeText('Shift/↓ • 2 dedos', ax + 24, y + 14);
  ctx.fillText('Shift/↓ • 2 dedos', ax + 24, y + 14);
  ctx.restore();
}

/** Pool fixo pré-alocado (mesmo padrão de `render/manobra.ts`/`render/particulas.ts`): zero alocação por quadro. */
export function criarSistemaAvisosObstaculo(): SistemaAvisosObstaculo {
  const pool: AvisoObstaculo[] = Array.from({ length: CAPACIDADE_AVISOS }, () => ({ ativo: false, x: 0, vida: 0, mostrarDica: false }));
  let cabeca = 0;

  return {
    atualizar(eventos) {
      for (let i = 0; i < CAPACIDADE_AVISOS; i += 1) {
        const a = pool[i]!;
        if (!a.ativo) continue;
        a.vida -= 1;
        if (a.vida <= 0) a.ativo = false;
      }
      for (const ev of eventos) {
        if (ev.tipo !== 'aviso-obstaculo') continue;
        const a = pool[cabeca]!;
        a.ativo = true;
        a.x = ev.x;
        a.vida = DURACAO_AVISO_TICKS;
        a.mostrarDica = avisosGalhoVistosSessao < LIMITE_DICA_AGACHAR;
        avisosGalhoVistosSessao += 1;
        cabeca = (cabeca + 1) % CAPACIDADE_AVISOS;
      }
    },
    desenhar(ctx, pista, camera, piloto) {
      let alphaDica = 0;
      for (let i = 0; i < CAPACIDADE_AVISOS; i += 1) {
        const a = pool[i]!;
        if (!a.ativo) continue;
        const bounce = Math.sin(a.vida * 0.3) * 0.15;
        const pt = mundoParaTela(a.x, alturaDoTerreno(pista, a.x) + ALTURA_AVISO_M + bounce, camera, PX_POR_METRO);
        const alpha = Math.min(1, a.vida / 20); // nunca pisca de repente no fim da vida

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 13, 0, Math.PI * 2);
        ctx.fillStyle = COR_AVISO;
        ctx.fill();
        ctx.strokeStyle = '#0b1a33';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#fff4f4';
        ctx.font = '800 18px "Barlow Condensed", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', pt.x, pt.y + 1);
        ctx.restore();

        // Dica "AGACHAR" (pedido do dono: "nas primeiras vezes... perto do personagem"): não fica mais colada no
        // "!" (que pode estar longe, quase fora da tela) -- desenhada 1x, perto do PILOTO, depois do loop.
        if (a.mostrarDica) alphaDica = Math.max(alphaDica, alpha);
      }
      if (alphaDica > 0 && piloto) {
        const ptPiloto = mundoParaTela(piloto.x, piloto.y, camera, PX_POR_METRO);
        desenharDicaAgachar(ctx, ptPiloto.x, ptPiloto.y - 86, alphaDica);
      }
    },
  };
}

// --- Turbo de pouso (evento `pouso`, plano C-D7): só tem sentido em `modo === 'corrida'` -- por isso quem decide
// chamar este sistema é a CENA (`ui/cenas/corrida.ts`), nunca `descida.ts` (treino nunca ganha turbo de verdade). ---

const DURACAO_TURBO_TICKS = 18; // ~0,3 s de flash
const CAPACIDADE_TURBO = 6;
const COR_TURBO = '#ffe08a';

interface FlashTurbo {
  ativo: boolean;
  x: number;
  y: number;
  vida: number;
}

export interface SistemaTurboPouso {
  /** Pouso que NÃO foi 'torto' dispara o flash (mesma condição do motor para ganhar turbo, `descida/motor.ts`). */
  atualizar(piloto: PilotoLeitura, eventos: readonly EventoDescida[]): void;
  desenhar(ctx: CanvasRenderingContext2D, camera: EstadoCamera): void;
}

export function criarSistemaTurboPouso(): SistemaTurboPouso {
  const pool: FlashTurbo[] = Array.from({ length: CAPACIDADE_TURBO }, () => ({ ativo: false, x: 0, y: 0, vida: 0 }));
  let cabeca = 0;

  return {
    atualizar(piloto, eventos) {
      for (let i = 0; i < CAPACIDADE_TURBO; i += 1) {
        const f = pool[i]!;
        if (!f.ativo) continue;
        f.vida -= 1;
        if (f.vida <= 0) f.ativo = false;
      }
      for (const ev of eventos) {
        if (ev.tipo !== 'pouso' || ev.qualidade === 'torto') continue;
        const f = pool[cabeca]!;
        f.ativo = true;
        f.x = piloto.x;
        f.y = piloto.y;
        f.vida = DURACAO_TURBO_TICKS;
        cabeca = (cabeca + 1) % CAPACIDADE_TURBO;
      }
    },
    desenhar(ctx, camera) {
      const escala = pxPorMetro(PX_POR_METRO, camera.zoom) / PX_POR_METRO;
      for (let i = 0; i < CAPACIDADE_TURBO; i += 1) {
        const f = pool[i]!;
        if (!f.ativo) continue;
        const progresso = 1 - f.vida / DURACAO_TURBO_TICKS; // 0 -> 1
        const pt = mundoParaTela(f.x, f.y, camera, PX_POR_METRO);
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - progresso);
        ctx.strokeStyle = COR_TURBO;
        ctx.lineWidth = Math.max(2, 3 * escala);
        // 3 risquinhos horizontais atrás do piloto, afastando com o progresso -- leitura de "arrancada".
        for (const dy of [-6, 0, 6]) {
          const y = pt.y + dy * escala;
          const x1 = pt.x - (10 + progresso * 18) * escala;
          const x0 = x1 - 10 * escala;
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
          ctx.stroke();
        }
        ctx.restore();
      }
    },
  };
}
