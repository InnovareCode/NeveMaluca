/**
 * `OpcoesCenaDescida.pista` com "vulcao-pe-gelado" (M3 F3): mesma prova de `ui-descida-selecao-pista-vila.test.ts`
 * (Vila), generalizada para o Vulcão — a cena REALMENTE roda essa pista até a chegada (não só o gerador puro). O
 * fallback de id desconhecido já está provado no teste do Picolé, não repetido aqui.
 */
import { describe, expect, it } from 'vitest';
import { derivarComando, INPUT_NEUTRO } from '../../src/core/comandos';
import type { InputFrame, ReplayV1 } from '../../src/core/contratos';
import { PISTA_VULCAO_PE_GELADO } from '../../src/data/pistas';
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

const TECLA_DO_GIRO: Readonly<Record<number, string | null>> = { [-1]: 'ArrowLeft', [0]: null, [1]: 'ArrowRight' };
const LIMITE_TICKS = 16_200;

describe('criarCenaDescida({ pista: "vulcao-pe-gelado" })', () => {
  it('roda a descida nessa pista até a chegada, e o replay gravado aponta pra ela (não pro Morro)', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    let resultado: ResultadoDescida | null = null;
    const cena = criarCenaDescida({ canvas, janela, pista: 'vulcao-pe-gelado', aoTerminar: (r) => (resultado = r) });

    const pistaSombra = exigirPistaValida(PISTA_VULCAO_PE_GELADO);
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

    expect(resultado, 'o bot não concluiu vulcao-pe-gelado no teto de ticks deste teste').not.toBeNull();
    const replay = (resultado as unknown as ResultadoDescida).replay as ReplayV1;
    expect(replay.pista).toBe('vulcao-pe-gelado');
    expect(replay.hashPista).toBe(pistaSombra.hash);
  });
});
