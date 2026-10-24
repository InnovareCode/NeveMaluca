/**
 * `ui/cenas/pausa.ts` (feedback do dono, playtest iPhone: "durante a partida não dá pra pausar, voltar ao menu,
 * abrir configuração nem reiniciar"). Cobre o hit-test puro (`botaoPausaEm`) e o controlador com toque/tecla
 * falsos (mesmo harness de `ui-cenas-fase1.test.ts`); o DESENHO real (painel, estilo visual) é provado no
 * navegador por `tests/e2e/pausa.spec.ts` (skill `medir-antes-de-afirmar`).
 */
import { describe, expect, it, vi } from 'vitest';
import type { AlvoTeclado } from '../../src/input/teclado';
import type { AlvoToque } from '../../src/input/toque';
import {
  BOTAO_CANCELAR_SAIDA,
  BOTAO_CONFIGURACOES,
  BOTAO_CONFIRMAR_SAIDA,
  BOTAO_CONTINUAR,
  BOTAO_REINICIAR,
  BOTAO_VOLTAR_MENU,
  botaoPausaEm,
  criarControladorPausa,
  desenharPainelPausa,
} from '../../src/ui/cenas/pausa';

function centro(b: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

interface PointerFalso {
  readonly clientX: number;
  readonly clientY: number;
}

function criarCanvasFalso(): AlvoToque & { disparar(tipo: string, p: PointerFalso): void } {
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
      const ev = { ...p, preventDefault: () => undefined } as unknown as Event;
      for (const fn of [...(ouvintes.get(tipo) ?? [])]) {
        if (typeof fn === 'function') fn(ev);
        else fn.handleEvent(ev);
      }
    },
  };
}

function criarJanelaFalsa(): AlvoTeclado & { disparar(codigo: string): void } {
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
      for (const fn of [...(ouvintes.get('keydown') ?? [])]) {
        if (typeof fn === 'function') fn(ev);
        else fn.handleEvent(ev);
      }
    },
  };
}

/** Contexto 2D falso genérico: qualquer método chamado é um no-op, qualquer propriedade pode ser lida/gravada --
 *  o suficiente pra `desenharBotao`/`desenharTexto`/`caminhoArredondado` rodarem sem lançar. */
function criarCtxFalso(): CanvasRenderingContext2D {
  const alvo: Record<string, unknown> = {};
  return new Proxy(alvo, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      if (prop === 'createLinearGradient') return () => ({ addColorStop: () => undefined });
      return () => undefined;
    },
    set(target, prop: string, valor) {
      target[prop] = valor;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

describe('ui/cenas/pausa: hit-test (botaoPausaEm)', () => {
  it('tela normal: acha CONTINUAR/REINICIAR/CONFIGURAÇÕES/VOLTAR AO MENU pelos centros', () => {
    expect(botaoPausaEm(centro(BOTAO_CONTINUAR), false)).toBe('continuar');
    expect(botaoPausaEm(centro(BOTAO_REINICIAR), false)).toBe('reiniciar');
    expect(botaoPausaEm(centro(BOTAO_CONFIGURACOES), false)).toBe('configuracoes');
    expect(botaoPausaEm(centro(BOTAO_VOLTAR_MENU), false)).toBe('voltar-menu');
  });

  it('fora de qualquer botão: null', () => {
    expect(botaoPausaEm({ x: 0, y: 0 }, false)).toBeNull();
  });

  it('sub-tela de confirmação: só SIM/CANCELAR respondem, os 4 botões normais não', () => {
    expect(botaoPausaEm(centro(BOTAO_CONFIRMAR_SAIDA), true)).toBe('confirmar-saida');
    expect(botaoPausaEm(centro(BOTAO_CANCELAR_SAIDA), true)).toBe('cancelar-saida');
    expect(botaoPausaEm(centro(BOTAO_CONTINUAR), true)).toBeNull();
  });

  it('desenharPainelPausa não lança nos dois estados (normal e confirmando)', () => {
    const ctx = criarCtxFalso();
    expect(() => desenharPainelPausa(ctx, { confirmandoSaida: false, podeReiniciar: true, hover: null })).not.toThrow();
    expect(() => desenharPainelPausa(ctx, { confirmandoSaida: true, podeReiniciar: false, hover: 'cancelar-saida' })).not.toThrow();
  });
});

describe('ui/cenas/pausa: criarControladorPausa', () => {
  it('nasce fechado; toque/tecla não fazem nada antes de abrir()', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoContinuar = vi.fn();
    const pausa = criarControladorPausa({
      canvas,
      janela,
      podeReiniciar: () => true,
      aoContinuar,
      aoReiniciar: vi.fn(),
      aoAbrirConfiguracoes: vi.fn(),
      aoConfirmarSaidaAoMenu: vi.fn(),
    });

    expect(pausa.pausado).toBe(false);
    const c = centro(BOTAO_CONTINUAR);
    canvas.disparar('pointerdown', { clientX: c.x, clientY: c.y });
    expect(aoContinuar).not.toHaveBeenCalled();
    pausa.destruir();
  });

  it('abrir() + tocar CONTINUAR: fecha e chama aoContinuar', () => {
    const canvas = criarCanvasFalso();
    const aoContinuar = vi.fn();
    const pausa = criarControladorPausa({
      canvas,
      podeReiniciar: () => true,
      aoContinuar,
      aoReiniciar: vi.fn(),
      aoAbrirConfiguracoes: vi.fn(),
      aoConfirmarSaidaAoMenu: vi.fn(),
    });

    pausa.abrir();
    expect(pausa.pausado).toBe(true);
    const c = centro(BOTAO_CONTINUAR);
    canvas.disparar('pointerdown', { clientX: c.x, clientY: c.y });
    expect(aoContinuar).toHaveBeenCalledTimes(1);
    expect(pausa.pausado).toBe(false);
    pausa.destruir();
  });

  it('Esc/P/Enter fecham a pausa (teclado), mesmo sem tocar em nada', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoContinuar = vi.fn();
    const pausa = criarControladorPausa({
      canvas,
      janela,
      podeReiniciar: () => true,
      aoContinuar,
      aoReiniciar: vi.fn(),
      aoAbrirConfiguracoes: vi.fn(),
      aoConfirmarSaidaAoMenu: vi.fn(),
    });

    pausa.abrir();
    janela.disparar('Escape');
    expect(aoContinuar).toHaveBeenCalledTimes(1);
    expect(pausa.pausado).toBe(false);

    pausa.abrir();
    janela.disparar('KeyP');
    expect(aoContinuar).toHaveBeenCalledTimes(2);

    pausa.abrir();
    janela.disparar('Enter');
    expect(aoContinuar).toHaveBeenCalledTimes(3);
    pausa.destruir();
  });

  it('REINICIAR desligado (já cruzou a chegada, plano C-D6): tocar não chama aoReiniciar nem fecha a pausa', () => {
    const canvas = criarCanvasFalso();
    const aoReiniciar = vi.fn();
    const pausa = criarControladorPausa({
      canvas,
      podeReiniciar: () => false,
      aoContinuar: vi.fn(),
      aoReiniciar,
      aoAbrirConfiguracoes: vi.fn(),
      aoConfirmarSaidaAoMenu: vi.fn(),
    });

    pausa.abrir();
    const c = centro(BOTAO_REINICIAR);
    canvas.disparar('pointerdown', { clientX: c.x, clientY: c.y });
    expect(aoReiniciar).not.toHaveBeenCalled();
    expect(pausa.pausado).toBe(true);
    pausa.destruir();
  });

  it('REINICIAR ligado: tocar chama aoReiniciar e fecha a pausa', () => {
    const canvas = criarCanvasFalso();
    const aoReiniciar = vi.fn();
    const pausa = criarControladorPausa({
      canvas,
      podeReiniciar: () => true,
      aoContinuar: vi.fn(),
      aoReiniciar,
      aoAbrirConfiguracoes: vi.fn(),
      aoConfirmarSaidaAoMenu: vi.fn(),
    });

    pausa.abrir();
    const c = centro(BOTAO_REINICIAR);
    canvas.disparar('pointerdown', { clientX: c.x, clientY: c.y });
    expect(aoReiniciar).toHaveBeenCalledTimes(1);
    expect(pausa.pausado).toBe(false);
    pausa.destruir();
  });

  it('VOLTAR AO MENU pede confirmação: CANCELAR volta pro menu de pausa sem sair; SIM sai', () => {
    const canvas = criarCanvasFalso();
    const aoConfirmarSaidaAoMenu = vi.fn();
    const pausa = criarControladorPausa({
      canvas,
      podeReiniciar: () => true,
      aoContinuar: vi.fn(),
      aoReiniciar: vi.fn(),
      aoAbrirConfiguracoes: vi.fn(),
      aoConfirmarSaidaAoMenu,
    });

    pausa.abrir();
    const voltar = centro(BOTAO_VOLTAR_MENU);
    canvas.disparar('pointerdown', { clientX: voltar.x, clientY: voltar.y });
    expect(pausa.pausado).toBe(true); // ainda não saiu, só abriu a confirmação
    expect(aoConfirmarSaidaAoMenu).not.toHaveBeenCalled();

    // Cancelar: continua pausado, confirmação fechada (o botão VOLTAR AO MENU volta a responder)
    const cancelar = centro(BOTAO_CANCELAR_SAIDA);
    canvas.disparar('pointerdown', { clientX: cancelar.x, clientY: cancelar.y });
    expect(pausa.pausado).toBe(true);
    expect(aoConfirmarSaidaAoMenu).not.toHaveBeenCalled();

    // Pede de novo e confirma
    canvas.disparar('pointerdown', { clientX: voltar.x, clientY: voltar.y });
    const confirmar = centro(BOTAO_CONFIRMAR_SAIDA);
    canvas.disparar('pointerdown', { clientX: confirmar.x, clientY: confirmar.y });
    expect(aoConfirmarSaidaAoMenu).toHaveBeenCalledTimes(1);
    expect(pausa.pausado).toBe(false);
    pausa.destruir();
  });

  it('CONFIGURAÇÕES chama o callback e NÃO fecha a pausa (quem decide suspender é o chamador)', () => {
    const canvas = criarCanvasFalso();
    const aoAbrirConfiguracoes = vi.fn();
    const pausa = criarControladorPausa({
      canvas,
      podeReiniciar: () => true,
      aoContinuar: vi.fn(),
      aoReiniciar: vi.fn(),
      aoAbrirConfiguracoes,
      aoConfirmarSaidaAoMenu: vi.fn(),
    });

    pausa.abrir();
    const c = centro(BOTAO_CONFIGURACOES);
    canvas.disparar('pointerdown', { clientX: c.x, clientY: c.y });
    expect(aoAbrirConfiguracoes).toHaveBeenCalledTimes(1);
    expect(pausa.pausado).toBe(true);
    pausa.destruir();
  });

  it('suspender()/retomar(): enquanto suspenso, toque/tecla não reagem (tela de Configurações por cima)', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoContinuar = vi.fn();
    const pausa = criarControladorPausa({
      canvas,
      janela,
      podeReiniciar: () => true,
      aoContinuar,
      aoReiniciar: vi.fn(),
      aoAbrirConfiguracoes: vi.fn(),
      aoConfirmarSaidaAoMenu: vi.fn(),
    });

    pausa.abrir();
    pausa.suspender();
    janela.disparar('Escape');
    expect(aoContinuar).not.toHaveBeenCalled();
    expect(pausa.pausado).toBe(true); // continua "logicamente" pausado, só não reage

    pausa.retomar();
    janela.disparar('Escape');
    expect(aoContinuar).toHaveBeenCalledTimes(1);
    expect(pausa.pausado).toBe(false);
    pausa.destruir();
  });

  it('destruir() remove os ouvintes: toque/tecla depois disso não fazem nada', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoContinuar = vi.fn();
    const pausa = criarControladorPausa({
      canvas,
      janela,
      podeReiniciar: () => true,
      aoContinuar,
      aoReiniciar: vi.fn(),
      aoAbrirConfiguracoes: vi.fn(),
      aoConfirmarSaidaAoMenu: vi.fn(),
    });

    pausa.abrir();
    pausa.destruir();
    janela.disparar('Escape');
    expect(aoContinuar).not.toHaveBeenCalled();
  });
});
