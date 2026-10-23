/**
 * Replay C6 ponta a ponta pelo GERENCIADOR de cenas (não só pela cena de descida isolada, ver
 * `ui-descida-fantasma.test.ts`): ao chegar numa pista, `criarGerenciadorCenas` grava recorde + fantasma no save
 * (o #1 da pista) e persiste no armazenamento — e, na descida seguinte da MESMA pista, o fantasma salvo é passado
 * para a nova `criarCenaDescida` sem lançar erro.
 */
import { describe, expect, it } from 'vitest';
import { derivarComando, INPUT_NEUTRO } from '../../src/core/comandos';
import type { InputFrame } from '../../src/core/contratos';
import { validarReplayV1 } from '../../src/core/replay';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { criarDescida } from '../../src/descida/motor';
import type { AlvoTeclado } from '../../src/input/teclado';
import type { AlvoToque } from '../../src/input/toque';
import type { ArmazenamentoLike, SaveV1 } from '../../src/meta/tipos';
import { saveVazio } from '../../src/meta/storage';
import { exigirPistaValida } from '../../src/pista/index';
import { criarGerenciadorCenas } from '../../src/ui/cenas/gerenciador';

const PISTA_ID = PISTA_MORRO_DO_PINHAO.id;

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

function armazenamentoDeMapa(mapa: Map<string, string>): ArmazenamentoLike {
  return {
    getItem: (k) => mapa.get(k) ?? null,
    setItem: (k, v) => mapa.set(k, v),
    removeItem: (k) => mapa.delete(k),
  };
}

const TECLA_DO_GIRO: Readonly<Record<number, string | null>> = { [-1]: 'ArrowLeft', [0]: null, [1]: 'ArrowRight' };
const LIMITE_TICKS = 16_200;

/** Dirige o gerenciador (cena 'jogo') com o bot "cuidadoso" até o save ganhar um recorde desta pista. */
function descerAteRegistrar(save: SaveV1, armazenamento: ArmazenamentoLike): void {
  const canvas = criarCanvasFalso();
  const janela = criarJanelaFalsa();
  const gerenciador = criarGerenciadorCenas({ canvas, janela, save, armazenamento, cenaInicial: 'jogo' });

  const pistaSombra = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
  const motorSombra = criarDescida(pistaSombra);
  const bot = criarBotCuidadoso(pistaSombra);
  let leituraSombra = motorSombra.leitura();
  let frameAnterior: InputFrame = INPUT_NEUTRO;

  for (let i = 0; i < LIMITE_TICKS && (save.recordes[PISTA_ID]?.length ?? 0) === 0; i++) {
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
    gerenciador.atualizar();
    frameAnterior = frame;
  }

  gerenciador.destruir?.();
}

describe('gerenciador de cenas: recorde + fantasma persistem ao chegar (C6)', () => {
  it('ao chegar, o save ganha o recorde (#1 da pista) e o fantasma (replay válido); o armazenamento recebe os dois', () => {
    const save = saveVazio();
    const mapa = new Map<string, string>();
    const armazenamento = armazenamentoDeMapa(mapa);

    descerAteRegistrar(save, armazenamento);

    const recordes = save.recordes[PISTA_ID];
    expect(recordes).toHaveLength(1);
    expect(recordes?.[0]?.pontos).toBeGreaterThanOrEqual(0);

    const fantasma = save.fantasmas?.[PISTA_ID];
    expect(fantasma).toBeDefined();
    const validado = validarReplayV1(fantasma);
    expect(validado.ok).toBe(true);
    if (validado.ok) {
      expect(validado.valor.pista).toBe(PISTA_ID);
      expect(validado.valor.resultado.pontos).toBe(recordes?.[0]?.pontos);
    }

    // persistiu no disco (armazenamento), não só na memória:
    const gravado = JSON.parse(mapa.get('neve-maluca-v1') as string) as { recordes?: unknown; fantasmas?: unknown };
    expect(gravado.recordes).toBeDefined();
    expect(gravado.fantasmas).toBeDefined();
  });

  it('a descida seguinte na mesma pista recebe o fantasma salvo sem lançar erro (criarReprodutorFantasma aceita)', () => {
    const save = saveVazio();
    const mapa = new Map<string, string>();
    const armazenamento = armazenamentoDeMapa(mapa);
    descerAteRegistrar(save, armazenamento);
    expect(save.fantasmas?.[PISTA_ID]).toBeDefined();

    // Uma SEGUNDA sessão, com o MESMO save (já tem fantasma desta pista): só precisa montar e rodar alguns ticks
    // sem lançar — a leitura/validação do fantasma acontece na criação da cena de descida (dentro de 'jogo').
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const gerenciador = criarGerenciadorCenas({ canvas, janela, save, armazenamento, cenaInicial: 'jogo' });
    expect(() => {
      for (let i = 0; i < 10; i++) gerenciador.atualizar();
    }).not.toThrow();
    gerenciador.destruir?.();
  });
});
