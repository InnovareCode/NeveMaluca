/**
 * `criarCenaCorrida` (plano "corrida em campeonato" §C2b): mesma técnica de `ui-descida-selecao-pista.test.ts`
 * (bot "cuidadoso" como sombra, dirigindo por teclas reais na janela falsa, modo `'corrida'` para bater com a
 * física real do jogador dentro de `corrida/criarCorrida` -- turbo de pouso incluso, plano C-D7), provando que dá
 * para RODAR uma corrida inteira (jogador + 5 rivais de IA) pela cena real até o pódio fechar.
 */
import { describe, expect, it } from 'vitest';
import { derivarComando, INPUT_NEUTRO } from '../../src/core/comandos';
import type { InputFrame, ResultadoCorrida } from '../../src/core/contratos';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { configDoPersonagem } from '../../src/descida/atributos';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { criarDescida } from '../../src/descida/motor';
import type { AlvoTeclado } from '../../src/input/teclado';
import type { AlvoToque } from '../../src/input/toque';
import { exigirPistaValida, gerarCamadaJogo } from '../../src/pista/index';
import { TICKS_CONTAGEM } from '../../src/ui/cenas/contagem';
import { criarCenaCorrida } from '../../src/ui/cenas/corrida';

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

/** Dirige `cena` pelo bot cuidadoso (teclas reais na `janela`) até `aoTerminar` disparar, ou estoura o teto. */
function rodarAteOFim(cena: { atualizar(): void }, janela: ReturnType<typeof criarJanelaFalsa>, obterResultado: () => ResultadoCorrida | null): void {
  const pistaSombra = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
  // Camada de jogo (plano corrida-campeonato §C3/C4): `ui/cenas/corrida.ts` gera `camada` e passa pro
  // `criarCorrida` -- a sombra precisa da MESMA (pura/determinística) pra não tombar num obstáculo que ela não
  // sabia existir (os rivais de IA já são camada-aware por dentro de `criarCorrida`, só o jogador é "sombra" aqui).
  const camadaSombra = gerarCamadaJogo(pistaSombra, PISTA_MORRO_DO_PINHAO);
  // modo 'corrida' (turbo de pouso, C-D7): mesma física do jogador real dentro de `corrida/criarCorrida` -- sem
  // isto a sombra fica mais devagar que o jogador real e o bot mistima pulos pela posição real (mais rápida).
  const motorSombra = criarDescida(pistaSombra, configDoPersonagem('capi'), { modo: 'corrida', camada: camadaSombra });
  const bot = criarBotCuidadoso(pistaSombra, undefined, camadaSombra.obstaculosAltos);
  let leituraSombra = motorSombra.leitura();
  let frameAnterior: InputFrame = INPUT_NEUTRO;

  for (let i = 0; i < LIMITE_TICKS && obterResultado() === null; i++) {
    if (i < TICKS_CONTAGEM) {
      // A cena está na contagem "3-2-1-JÁ" (§C1): não tica nem dirige a sombra, só a cena mesmo.
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
}

describe('criarCenaCorrida', () => {
  it('jogador + 5 rivais de IA correm até o fim; o pódio fecha com os 6, sem repetição', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    let resultado: ResultadoCorrida | null = null;
    const cena = criarCenaCorrida({ canvas, janela, aoTerminar: (r) => (resultado = r) });

    rodarAteOFim(cena, janela, () => resultado);

    expect(resultado, 'a corrida não terminou no teto de ticks deste teste').not.toBeNull();
    const r = resultado as unknown as ResultadoCorrida;
    expect(r.pista).toBe(PISTA_MORRO_DO_PINHAO.id);
    expect(r.ordem).toHaveLength(6);
    expect(new Set(r.ordem).size).toBe(6); // ninguém duplicado
    expect(r.ordem).toContain('capi');
    for (const id of r.ordem) expect(r.ticks[id]).toBeGreaterThan(0);
  });

  it('id de pista e de personagem desconhecidos caem no padrão (Morro/capi), nunca trava a corrida', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    let resultado: ResultadoCorrida | null = null;
    const cena = criarCenaCorrida({
      canvas,
      janela,
      pista: 'pista-que-nao-existe',
      personagem: 'personagem-que-nao-existe',
      aoTerminar: (r) => (resultado = r),
    });
    for (let i = 0; i < 5; i++) cena.atualizar();
    expect(resultado).toBeNull(); // só confere que não lançou (5 ticks não chegam nem perto da chegada)
  });
});
