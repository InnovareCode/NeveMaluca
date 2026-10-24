/**
 * `criarEntrada` (`input/index.ts`): `usarItemBorda()` combina teclado + toque (mesmo padrão de `obterComando`
 * mesclando os dois pra `InputFrame`) — prova que nenhum dos dois "rouba" a borda do outro quando os dois
 * disparam no mesmo tick, e que sem nenhum dos dois (nem gamepad, que não existe em Node) o padrão é `false`.
 */
import { describe, expect, it } from 'vitest';
import { criarEntrada } from '../../src/input/index';
import type { AlvoTeclado } from '../../src/input/teclado';
import type { AlvoToque } from '../../src/input/toque';

function criarCanvasFalso(): AlvoToque & { disparar(tipo: string, p: { pointerId: number; clientX: number; clientY: number; timeStamp: number }): void } {
  const ouvintes = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    addEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo)?.add(fn);
    },
    removeEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      ouvintes.get(tipo)?.delete(fn);
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 960, bottom: 540, width: 960, height: 540, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
    disparar(tipo, p) {
      const ev = { ...p, preventDefault: () => undefined } as unknown as Event;
      for (const fn of [...(ouvintes.get(tipo) ?? [])]) {
        if (typeof fn === 'function') fn(ev);
        else fn.handleEvent(ev);
      }
    },
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

const BOTAO_ITEM = { x: 860, y: 440, w: 76, h: 76 };

describe('input/index: usarItemBorda() combina teclado + toque', () => {
  it('sem nenhum sinal: false (e nunca lança por falta de gamepad em Node)', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const entrada = criarEntrada(canvas, janela, { toque: { botaoItem: BOTAO_ITEM } });
    expect(entrada.usarItemBorda()).toBe(false);
    entrada.destruir();
  });

  it('tecla E dispara a borda mesmo sem tocar o botão de item', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const entrada = criarEntrada(canvas, janela, { toque: { botaoItem: BOTAO_ITEM } });
    janela.disparar('keydown', 'KeyE');
    expect(entrada.usarItemBorda()).toBe(true);
    expect(entrada.usarItemBorda()).toBe(false); // consumido
    entrada.destruir();
  });

  it('tap no botão de item dispara a borda mesmo sem tecla nenhuma', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const entrada = criarEntrada(canvas, janela, { toque: { botaoItem: BOTAO_ITEM } });
    canvas.disparar('pointerdown', { pointerId: 1, clientX: 890, clientY: 470, timeStamp: 0 });
    expect(entrada.usarItemBorda()).toBe(true);
    expect(entrada.usarItemBorda()).toBe(false); // consumido
    entrada.destruir();
  });

  it('tecla E e tap no botão no MESMO tick: nenhum consumo fica pendurado pro tick seguinte', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const entrada = criarEntrada(canvas, janela, { toque: { botaoItem: BOTAO_ITEM } });
    janela.disparar('keydown', 'KeyE');
    canvas.disparar('pointerdown', { pointerId: 1, clientX: 890, clientY: 470, timeStamp: 0 });
    expect(entrada.usarItemBorda()).toBe(true);
    expect(entrada.usarItemBorda()).toBe(false); // os dois foram consumidos no tick anterior, nenhum sobrou
    entrada.destruir();
  });

  it('usarItemBorda() nunca aparece em obterComando()/quadroBruto() (não é InputFrame/ComandoDescida)', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const entrada = criarEntrada(canvas, janela, { toque: { botaoItem: BOTAO_ITEM } });
    janela.disparar('keydown', 'KeyE');
    const cmd = entrada.obterComando();
    expect(cmd).toEqual({ pulo: false, giro: 0, grab: null, agachar: false });
    expect(entrada.usarItemBorda()).toBe(true); // a borda ainda está lá, intocada por obterComando()
    entrada.destruir();
  });
});
