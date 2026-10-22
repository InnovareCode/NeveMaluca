import { describe, expect, it, vi } from 'vitest';
import type { AlvoToque } from '../../src/input/toque';
import type { AlvoTeclado } from '../../src/input/teclado';
import { criarCenaAbertura } from '../../src/ui/cenas/abertura';
import { criarCenaMenu } from '../../src/ui/cenas/menu';
import { criarCenaOpcoes } from '../../src/ui/cenas/opcoes';
import { criarGerenciadorCenas } from '../../src/ui/cenas/gerenciador';
import { eventoParaPontoLogico, pontoDentroDoBotao } from '../../src/ui/interacao';
import { caminhoArredondado } from '../../src/ui/desenho';
import type { SaveV1 } from '../../src/meta/tipos';
import { CONFIG_PADRAO } from '../../src/meta/storage';

interface PointerFalso {
  readonly pointerId?: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly timeStamp?: number;
}

function criarCanvasFalso(): AlvoToque & {
  disparar(tipo: string, p: PointerFalso): void;
  totalOuvintes(tipo: string): number;
} {
  const ouvintes = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    addEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo)?.add(fn);
    },
    removeEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      ouvintes.get(tipo)?.delete(fn);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, right: 960, bottom: 540, width: 960, height: 540, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    },
    disparar(tipo: string, p: PointerFalso) {
      const ev = { ...p, preventDefault: () => undefined, bubbles: true } as unknown as Event;
      const lista = [...(ouvintes.get(tipo) ?? [])];
      for (const fn of lista) {
        if (typeof fn === 'function') fn(ev);
        else fn.handleEvent(ev);
      }
    },
    totalOuvintes(tipo: string) {
      return ouvintes.get(tipo)?.size ?? 0;
    },
  };
}

function criarJanelaFalsa(): AlvoTeclado & {
  disparar(codigo: string): void;
  totalOuvintes(tipo: string): number;
} {
  const ouvintes = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    addEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo)?.add(fn);
    },
    removeEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      ouvintes.get(tipo)?.delete(fn);
    },
    disparar(codigo: string) {
      const ev = { code: codigo, preventDefault: () => undefined } as unknown as Event;
      const lista = [...(ouvintes.get('keydown') ?? [])];
      for (const fn of lista) {
        if (typeof fn === 'function') fn(ev);
        else fn.handleEvent(ev);
      }
    },
    totalOuvintes(tipo: string) {
      return ouvintes.get(tipo)?.size ?? 0;
    },
  };
}

function saveMock(): SaveV1 {
  return {
    v: 1,
    cfg: { ...CONFIG_PADRAO },
    prog: {
      desbloqueados: [],
      pistas: [],
      flocos: 0,
      objetivos: [],
      desconhecidos: [],
    },
    recordes: {},
  };
}

describe('Fase 1: Interação e geometria lógica (960x540)', () => {
  it('eventoParaPontoLogico converte proporcionalmente às dimensões do canvas', () => {
    const canvas = {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      getBoundingClientRect: () =>
        ({ left: 100, top: 50, right: 1060, bottom: 590, width: 960, height: 540, x: 100, y: 50, toJSON: () => ({}) }) as DOMRect,
    };
    const pt = eventoParaPontoLogico({ clientX: 580, clientY: 320 }, canvas);
    expect(pt.x).toBe(480);
    expect(pt.y).toBe(270);
  });

  it('pontoDentroDoBotao checa limites do retângulo', () => {
    const b = { id: 'teste', x: 100, y: 100, w: 200, h: 50 };
    expect(pontoDentroDoBotao({ x: 150, y: 120 }, b)).toBe(true);
    expect(pontoDentroDoBotao({ x: 100, y: 100 }, b)).toBe(true);
    expect(pontoDentroDoBotao({ x: 300, y: 150 }, b)).toBe(true);
    expect(pontoDentroDoBotao({ x: 99, y: 120 }, b)).toBe(false);
    expect(pontoDentroDoBotao({ x: 301, y: 120 }, b)).toBe(false);
    expect(pontoDentroDoBotao({ x: 150, y: 151 }, b)).toBe(false);
  });

  it('caminhoArredondado traça sem erro em contexto mock', () => {
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    caminhoArredondado(ctx, { x: 10, y: 10, w: 100, h: 40 }, 10);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.arcTo).toHaveBeenCalledTimes(4);
    expect(ctx.closePath).toHaveBeenCalled();
  });
});

describe('Fase 1: Cena de Abertura (Splash)', () => {
  it('avança suavemente ao atingir ticksMaximos', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoAvancar = vi.fn();

    const cena = criarCenaAbertura({
      canvas,
      janela,
      aoAvancar,
      ticksMaximos: 10,
    });

    // t = 0..9 (ainda não avançou)
    for (let i = 0; i < 9; i += 1) cena.atualizar();
    expect(aoAvancar).not.toHaveBeenCalled();

    // t = 10 (começa o fade out de 20 ticks)
    cena.atualizar();
    expect(aoAvancar).not.toHaveBeenCalled();

    // ticks do fade
    for (let i = 0; i < 20; i += 1) cena.atualizar();
    expect(aoAvancar).toHaveBeenCalledTimes(1);
  });

  it('avança ao tocar ou clicar no canvas', () => {
    const canvas = criarCanvasFalso();
    const aoAvancar = vi.fn();
    const cena = criarCenaAbertura({ canvas, aoAvancar, ticksMaximos: 200 });

    canvas.disparar('pointerdown', { clientX: 200, clientY: 200 });
    // fade out de 20 ticks
    for (let i = 0; i < 20; i += 1) cena.atualizar();
    expect(aoAvancar).toHaveBeenCalledTimes(1);
  });

  it('avança ao teclar Espaço ou Enter', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoAvancar = vi.fn();
    const cena = criarCenaAbertura({ canvas, janela, aoAvancar, ticksMaximos: 200 });

    janela.disparar('Space');
    for (let i = 0; i < 20; i += 1) cena.atualizar();
    expect(aoAvancar).toHaveBeenCalledTimes(1);
  });

  it('remove os ouvintes de evento ao chamar destruir()', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const cena = criarCenaAbertura({ canvas, janela, aoAvancar: () => undefined });

    expect(canvas.totalOuvintes('pointerdown')).toBe(1);
    expect(janela.totalOuvintes('keydown')).toBe(1);

    cena.destruir?.();
    expect(canvas.totalOuvintes('pointerdown')).toBe(0);
    expect(janela.totalOuvintes('keydown')).toBe(0);
  });
});

describe('Fase 1: Cena de Menu Principal', () => {
  it('dispara aoJogar ao tocar no botão Jogar ou apertar Enter', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoJogar = vi.fn();
    const aoOpcoes = vi.fn();

    const cena = criarCenaMenu({ canvas, janela, aoJogar, aoOpcoes });

    // Clica dentro de Jogar: x: 80..300, y: 220..274
    canvas.disparar('pointerdown', { clientX: 120, clientY: 240 });
    expect(aoJogar).toHaveBeenCalledTimes(1);

    // Tecla Enter
    janela.disparar('Enter');
    expect(aoJogar).toHaveBeenCalledTimes(2);

    cena.destruir?.();
  });

  it('dispara aoOpcoes ao tocar no botão Opções ou apertar KeyO', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoJogar = vi.fn();
    const aoOpcoes = vi.fn();

    const cena = criarCenaMenu({ canvas, janela, aoJogar, aoOpcoes });

    // Clica dentro de Opções: x: 80..300, y: 370..424
    canvas.disparar('pointerdown', { clientX: 120, clientY: 390 });
    expect(aoOpcoes).toHaveBeenCalledTimes(1);

    janela.disparar('KeyO');
    expect(aoOpcoes).toHaveBeenCalledTimes(2);

    cena.destruir?.();
  });

  it('dispara aoModos ao tocar no botão Modos', () => {
    const canvas = criarCanvasFalso();
    const aoModos = vi.fn();

    const cena = criarCenaMenu({
      canvas,
      aoJogar: () => undefined,
      aoOpcoes: () => undefined,
      aoModos,
    });

    // Clica dentro de Modos: x: 80..300, y: 295..349
    canvas.disparar('pointerdown', { clientX: 120, clientY: 310 });
    expect(aoModos).toHaveBeenCalledTimes(1);

    cena.destruir?.();
  });

  it('limpa listeners ao chamar destruir()', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const cena = criarCenaMenu({
      canvas,
      janela,
      aoJogar: () => undefined,
      aoOpcoes: () => undefined,
    });

    expect(canvas.totalOuvintes('pointerdown')).toBe(1);
    expect(canvas.totalOuvintes('pointermove')).toBe(1);
    expect(janela.totalOuvintes('keydown')).toBe(1);

    cena.destruir?.();
    expect(canvas.totalOuvintes('pointerdown')).toBe(0);
    expect(canvas.totalOuvintes('pointermove')).toBe(0);
    expect(janela.totalOuvintes('keydown')).toBe(0);
  });
});

describe('Fase 1: Cena de Configurações / Opções', () => {
  it('alterna controles ao tocar no botão correspondente ou teclar G', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoAlternarControles = vi.fn();

    const cena = criarCenaOpcoes({
      canvas,
      janela,
      obterControles: () => 'gestos',
      obterAudioLigado: () => true,
      aoAlternarControles,
      aoAlternarAudio: () => undefined,
      aoTelaCheia: () => undefined,
      aoVoltar: () => undefined,
    });

    // Clica no botão de controles (x: 520..770, y: 155..205)
    canvas.disparar('pointerdown', { clientX: 600, clientY: 170 });
    expect(aoAlternarControles).toHaveBeenCalledTimes(1);

    janela.disparar('KeyG');
    expect(aoAlternarControles).toHaveBeenCalledTimes(2);

    cena.destruir?.();
  });

  it('alterna áudio ao tocar ou teclar M', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoAlternarAudio = vi.fn();

    const cena = criarCenaOpcoes({
      canvas,
      janela,
      obterControles: () => 'gestos',
      obterAudioLigado: () => true,
      aoAlternarControles: () => undefined,
      aoAlternarAudio,
      aoTelaCheia: () => undefined,
      aoVoltar: () => undefined,
    });

    // Clica no botão de áudio (x: 520..770, y: 230..280)
    canvas.disparar('pointerdown', { clientX: 600, clientY: 245 });
    expect(aoAlternarAudio).toHaveBeenCalledTimes(1);

    janela.disparar('KeyM');
    expect(aoAlternarAudio).toHaveBeenCalledTimes(2);

    cena.destruir?.();
  });

  it('aciona tela cheia e voltar', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoTelaCheia = vi.fn();
    const aoVoltar = vi.fn();

    const cena = criarCenaOpcoes({
      canvas,
      janela,
      obterControles: () => 'gestos',
      obterAudioLigado: () => true,
      aoAlternarControles: () => undefined,
      aoAlternarAudio: () => undefined,
      aoTelaCheia,
      aoVoltar,
    });

    // Botão Voltar (x: 380..580, y: 408..458)
    canvas.disparar('pointerdown', { clientX: 480, clientY: 420 });
    expect(aoVoltar).toHaveBeenCalledTimes(1);

    janela.disparar('Escape');
    expect(aoVoltar).toHaveBeenCalledTimes(2);

    janela.disparar('KeyF');
    expect(aoTelaCheia).toHaveBeenCalledTimes(1);

    cena.destruir?.();
  });
});

describe('Fase 1: Gerenciador de Cenas (Orquestrador)', () => {
  it('inicia na abertura e navega para o menu e depois para o jogo', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const save = saveMock();

    const gerenciador = criarGerenciadorCenas({
      canvas,
      janela,
      save,
    });

    expect(gerenciador.cenaAtual()).toBe('abertura');

    // Avança splash via toque
    canvas.disparar('pointerdown', { clientX: 100, clientY: 100 });
    for (let i = 0; i < 20; i += 1) gerenciador.atualizar();
    expect(gerenciador.cenaAtual()).toBe('menu');

    // No menu, toca em Jogar (x: 80..300, y: 220..274)
    canvas.disparar('pointerdown', { clientX: 120, clientY: 240 });
    expect(gerenciador.cenaAtual()).toBe('jogo');
  });

  it('navega para opções, altera configurações e grava no save', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const save = saveMock();
    const armazenamentoMap = new Map<string, string>();
    const armazenamento = { getItem: (k: string) => armazenamentoMap.get(k) ?? null, setItem: (k: string, v: string) => armazenamentoMap.set(k, v), removeItem: (k: string) => armazenamentoMap.delete(k) };

    const gerenciador = criarGerenciadorCenas({
      canvas,
      janela,
      save,
      armazenamento,
      cenaInicial: 'menu',
    });

    expect(gerenciador.cenaAtual()).toBe('menu');

    // Clica em opções (x: 80..300, y: 370..424)
    canvas.disparar('pointerdown', { clientX: 120, clientY: 390 });
    expect(gerenciador.cenaAtual()).toBe('opcoes');

    // Alterna controles para botões
    expect(save.cfg.controles).toBe('gestos');
    janela.disparar('KeyG');
    expect(save.cfg.controles).toBe('botoes');
    expect(armazenamentoMap.has('neve-maluca-v1')).toBe(true);

    // Alterna áudio para desligado
    expect(save.cfg.som).toBeGreaterThan(0);
    janela.disparar('KeyM');
    expect(save.cfg.som).toBe(0);
    expect(save.cfg.musica).toBe(0);

    // Volta para o menu via Escape
    janela.disparar('Escape');
    expect(gerenciador.cenaAtual()).toBe('menu');

    gerenciador.destruir?.();
  });
});
