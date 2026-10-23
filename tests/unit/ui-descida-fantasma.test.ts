/**
 * Replay C6 ponta a ponta pela CENA (não só pelo motor puro, ver `descida-replay.test.ts`): a corrida gravada por
 * `criarCenaDescida` decodifica e reproduz certo (`aoTerminar` entrega um `ReplayV1` válido), e o fantasma — quando
 * passado em `OpcoesCenaDescida.fantasma` — é desenhado translúcido ANTES do piloto real.
 *
 * Mesma técnica do e2e `tests/e2e/descida-m1a.spec.ts` ("sombra" com `criarBotCuidadoso` decidindo o comando e
 * despachando teclas REAIS), mas em Node (sem navegador): a janela falsa suporta keydown/keyup de verdade, então
 * dá para dirigir `criarCenaDescida` pelo `input/` de verdade, como no app.
 */
import { describe, expect, it } from 'vitest';
import { derivarComando, INPUT_NEUTRO } from '../../src/core/comandos';
import type { InputFrame, ReplayV1 } from '../../src/core/contratos';
import { validarReplayV1 } from '../../src/core/replay';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { criarDescida } from '../../src/descida/motor';
import type { AlvoTeclado } from '../../src/input/teclado';
import type { AlvoToque } from '../../src/input/toque';
import { exigirPistaValida } from '../../src/pista/index';
import { criarCenaDescida, type ResultadoDescida } from '../../src/ui/cenas/descida';

function criarCanvasFalso(): AlvoToque {
  return {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 960, bottom: 540, width: 960, height: 540, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
  };
}

/** Janela falsa com keydown/keyup DE VERDADE (a `criarJanelaFalsa` de `ui-cenas-fase1.test.ts` só dispara keydown). */
function criarJanelaFalsa(): AlvoTeclado & { disparar(tipo: 'keydown' | 'keyup', codigo: string): void } {
  const ouvintes = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    addEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo)?.add(fn);
    },
    removeEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      ouvintes.get(tipo)?.delete(fn);
    },
    disparar(tipo, codigo) {
      const ev = { code: codigo, preventDefault: () => undefined } as unknown as Event;
      for (const fn of [...(ouvintes.get(tipo) ?? [])]) {
        if (typeof fn === 'function') fn(ev);
        else fn.handleEvent(ev);
      }
    },
  };
}

/** Contexto 2D falso: todo método vira no-op, exceto `globalAlpha`, cujo histórico de valores atribuídos é gravado. */
function criarCtxFalso(): CanvasRenderingContext2D & { globalAlphaHistorico: readonly number[] } {
  const historico: number[] = [];
  let alpha = 1;
  const noop = (): void => undefined;
  const obj: Record<string, unknown> = {
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    arc: noop,
    arcTo: noop,
    roundRect: noop,
    ellipse: noop,
    fill: noop,
    stroke: noop,
    fillRect: noop,
    strokeRect: noop,
    drawImage: noop,
    fillText: noop,
    strokeText: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    globalAlphaHistorico: historico,
  };
  Object.defineProperty(obj, 'globalAlpha', {
    get: () => alpha,
    set: (v: number) => {
      alpha = v;
      historico.push(v);
    },
    enumerable: true,
  });
  for (const prop of ['fillStyle', 'strokeStyle', 'lineWidth', 'lineJoin', 'font', 'textAlign', 'textBaseline']) {
    let v: unknown = '';
    Object.defineProperty(obj, prop, { get: () => v, set: (x: unknown) => (v = x), enumerable: true });
  }
  return obj as unknown as CanvasRenderingContext2D & { globalAlphaHistorico: readonly number[] };
}

const TECLA_DO_GIRO: Readonly<Record<number, string | null>> = { [-1]: 'ArrowLeft', [0]: null, [1]: 'ArrowRight' };
const LIMITE_TICKS = 16_200; // mesmo teto generoso do harness do bot (270 s)

/**
 * Monta uma `criarCenaDescida` (com `fantasma` opcional) e dirige com o bot "cuidadoso" (sombra em lockstep,
 * decidindo o comando e despachando teclas reais na janela falsa) até `aoTerminar` disparar.
 */
function criarEDescerComBot(fantasma?: ReplayV1): { resultado: ResultadoDescida; janela: ReturnType<typeof criarJanelaFalsa> } {
  const canvas = criarCanvasFalso();
  const janela = criarJanelaFalsa();
  let resultado: ResultadoDescida | null = null;
  const cena = criarCenaDescida({ canvas, janela, fantasma, aoTerminar: (r) => (resultado = r) });

  const pistaSombra = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
  const motorSombra = criarDescida(pistaSombra);
  const bot = criarBotCuidadoso(pistaSombra);
  let leituraSombra = motorSombra.leitura();
  let frameAnterior: InputFrame = INPUT_NEUTRO;

  for (let i = 0; i < LIMITE_TICKS && resultado === null; i++) {
    const cmdBot = bot(leituraSombra);
    const frame: InputFrame = { pular: cmdBot.pulo, giro: cmdBot.giro, grab: cmdBot.grab, agachar: cmdBot.agachar };

    if (frame.pular !== frameAnterior.pular) janela.disparar(frame.pular ? 'keydown' : 'keyup', 'Space');
    if (frame.giro !== frameAnterior.giro) {
      const antiga = TECLA_DO_GIRO[frameAnterior.giro];
      const nova = TECLA_DO_GIRO[frame.giro];
      if (antiga) janela.disparar('keyup', antiga);
      if (nova) janela.disparar('keydown', nova);
    }
    if (frame.agachar !== frameAnterior.agachar) janela.disparar(frame.agachar ? 'keydown' : 'keyup', 'ArrowDown');

    leituraSombra = motorSombra.processar(derivarComando(frameAnterior, frame));
    cena.atualizar();
    frameAnterior = frame;
  }

  expect(resultado, 'o bot não concluiu a pista no teto de ticks deste teste').not.toBeNull();
  return { resultado: resultado as unknown as ResultadoDescida, janela };
}

describe('criarCenaDescida grava o replay C6 da corrida', () => {
  it('ao chegar, aoTerminar entrega um ReplayV1 válido (forma, limites, comandos decodificáveis)', () => {
    const { resultado } = criarEDescerComBot();
    expect(resultado.replay).toBeDefined();
    const replay = resultado.replay as ReplayV1;

    expect(replay.pista).toBe('morro-do-pinhao');
    expect(replay.resultado.pontos).toBe(resultado.pontos);
    expect(replay.resultado.ticks).toBe(resultado.ticks);
    expect(validarReplayV1(replay).ok).toBe(true);
  });
});

describe('criarCenaDescida desenha o fantasma translúcido (globalAlpha 0.4) ANTES do piloto real', () => {
  it('com `fantasma`, o quadro seguinte passa por globalAlpha = 0.4 (o bloco do fantasma) em algum momento', () => {
    // 1) grava uma corrida completa para servir de fantasma.
    const { resultado: gravado } = criarEDescerComBot();
    const fantasma = gravado.replay as ReplayV1;

    // 2) uma SEGUNDA cena, agora com esse replay como fantasma: poucos ticks bastam (não precisa chegar ao fim).
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const cena = criarCenaDescida({ canvas, janela, fantasma });
    for (let i = 0; i < 5; i++) cena.atualizar();

    const ctx = criarCtxFalso();
    cena.desenhar(ctx, 0);

    expect(ctx.globalAlphaHistorico).toContain(0.4);
  });

  it('sem `fantasma`, nenhum quadro passa por globalAlpha = 0.4 (nos mesmos ticks, sem manobra ativa)', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const cena = criarCenaDescida({ canvas, janela });
    for (let i = 0; i < 5; i++) cena.atualizar();

    const ctx = criarCtxFalso();
    cena.desenhar(ctx, 0);

    expect(ctx.globalAlphaHistorico).not.toContain(0.4);
  });
});
