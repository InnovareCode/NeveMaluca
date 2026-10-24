/**
 * `OpcoesCenaDescida.pista` (M3 F3): a cena carrega a pista pedida (`pico-do-picole`), não só o Morro fixo. Mesma
 * técnica de `ui-descida-fantasma.test.ts` (bot "cuidadoso" como sombra, dirigindo por teclas reais na janela
 * falsa), aqui generalizada para outra pista, provando que dá para RODAR uma descida completa nela pela cena real
 * (não só pelo gerador puro).
 */
import { describe, expect, it } from 'vitest';
import { derivarComando, INPUT_NEUTRO } from '../../src/core/comandos';
import type { InputFrame, ReplayV1 } from '../../src/core/contratos';
import { PISTA_PICO_DO_PICOLE } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { criarDescida } from '../../src/descida/motor';
import type { AlvoTeclado } from '../../src/input/teclado';
import type { AlvoToque } from '../../src/input/toque';
import { exigirPistaValida, gerarCamadaJogo } from '../../src/pista/index';
import { criarCenaDescida, TICKS_CONTAGEM_DESCIDA, type ResultadoDescida } from '../../src/ui/cenas/descida';

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

describe('criarCenaDescida({ pista: "pico-do-picole" })', () => {
  it('roda a descida nessa pista até a chegada, e o replay gravado aponta pra ela (não pro Morro)', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    let resultado: ResultadoDescida | null = null;
    const cena = criarCenaDescida({ canvas, janela, pista: 'pico-do-picole', aoTerminar: (r) => (resultado = r) });

    const pistaSombra = exigirPistaValida(PISTA_PICO_DO_PICOLE);
    // Camada de jogo (plano corrida-campeonato §C3/C4): a cena real passa `camada` -- a sombra precisa da MESMA
    // (pura/determinística) pra não tombar num obstáculo que ela não sabia existir.
    const camadaSombra = gerarCamadaJogo(pistaSombra, PISTA_PICO_DO_PICOLE);
    const motorSombra = criarDescida(pistaSombra, undefined, { camada: camadaSombra });
    const bot = criarBotCuidadoso(pistaSombra, undefined, camadaSombra.obstaculosAltos);
    let leituraSombra = motorSombra.leitura();
    let frameAnterior: InputFrame = INPUT_NEUTRO;

    for (let i = 0; i < LIMITE_TICKS && resultado === null; i++) {
      if (i < TICKS_CONTAGEM_DESCIDA) {
        // A cena está na contagem "3-2-1-JÁ" (§C1): não tica nem dirige o motor sombra, só a cena mesmo
        // (ela própria não tica o motor real nesta janela — ver `ui/cenas/descida.ts`).
        cena.atualizar();
        continue;
      }
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

    expect(resultado, 'o bot não concluiu pico-do-picole no teto de ticks deste teste').not.toBeNull();
    const replay = (resultado as unknown as ResultadoDescida).replay as ReplayV1;
    expect(replay.pista).toBe('pico-do-picole');
    expect(replay.hashPista).toBe(pistaSombra.hash);
  });

  it('id de pista desconhecido cai no Morro (nunca trava o jogo, mesma filosofia do fantasma incompatível)', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    let resultado: ResultadoDescida | null = null;
    const cena = criarCenaDescida({ canvas, janela, pista: 'pista-que-nao-existe', aoTerminar: (r) => (resultado = r) });
    for (let i = 0; i < 5; i++) cena.atualizar();
    expect(resultado).toBeNull(); // só confere que não lançou (5 ticks não chegam nem perto da chegada)
  });
});
