/** Primitivas de síntese (src/audio/sintese.ts): tom/ruído respeitam volume 0 e agendam no relógio do contexto falso. */
import { describe, expect, it } from 'vitest';
import { criarRng } from '../../src/core/rng';
import { criarBufferRuido, ruido, tom } from '../../src/audio/sintese';
import { criarContextoSinteseFalso } from '../support/audio-falso';

describe('tom', () => {
  it('agenda um oscilador com a frequência e a forma pedidas, e o inicia', () => {
    const { ctx, osciladores } = criarContextoSinteseFalso();
    tom(ctx, ctx.destination, { forma: 'square', f0: 440, duracao: 0.1, volume: 0.5 });
    expect(osciladores).toHaveLength(1);
    expect(osciladores[0]).toMatchObject({ forma: 'square', f0: 440, f1: null, iniciado: true });
  });

  it('com f1, agenda a rampa exponencial até o f1 pedido', () => {
    const { ctx, osciladores } = criarContextoSinteseFalso();
    tom(ctx, ctx.destination, { forma: 'sine', f0: 300, f1: 900, duracao: 0.1, volume: 0.5 });
    expect(osciladores[0]).toMatchObject({ f0: 300, f1: 900 });
  });

  it('volume <= 0 não cria nenhum nó (silêncio não aloca grafo)', () => {
    const { ctx, osciladores } = criarContextoSinteseFalso();
    tom(ctx, ctx.destination, { f0: 440, duracao: 0.1, volume: 0 });
    tom(ctx, ctx.destination, { f0: 440, duracao: 0.1, volume: -1 });
    expect(osciladores).toHaveLength(0);
  });

  it('com filtro, o oscilador passa pelo filtro antes do ganho (grafo correto)', () => {
    const { ctx, filtros } = criarContextoSinteseFalso();
    tom(ctx, ctx.destination, { f0: 440, duracao: 0.1, volume: 0.5, filtro: { tipo: 'lowpass', f: 900, q: 2 } });
    expect(filtros).toHaveLength(1);
    expect(filtros[0]).toMatchObject({ tipo: 'lowpass', f0: 900, q: 2 });
  });
});

describe('ruido', () => {
  it('toca a partir do buffer dado, com o filtro pedido', () => {
    const { ctx, ruidos } = criarContextoSinteseFalso();
    const rng = criarRng(7);
    const buffer = criarBufferRuido(ctx, rng, 0.01);
    ruido(ctx, buffer, ctx.destination, { tipo: 'bandpass', f0: 1000, f1: 2000, duracao: 0.1, volume: 0.3 });
    expect(ruidos).toHaveLength(1);
    expect(ruidos[0]).toMatchObject({ tipo: 'bandpass', f0: 1000, f1: 2000, iniciado: true });
  });

  it('volume <= 0 não cria nenhum nó', () => {
    const { ctx, ruidos } = criarContextoSinteseFalso();
    const buffer = criarBufferRuido(ctx, criarRng(1), 0.01);
    ruido(ctx, buffer, ctx.destination, { duracao: 0.1, volume: 0 });
    expect(ruidos).toHaveLength(0);
  });
});

describe('criarBufferRuido', () => {
  it('mesma semente => mesmo conteúdo; sementes diferentes divergem (nunca Math.random)', () => {
    const { ctx } = criarContextoSinteseFalso();
    const a = criarBufferRuido(ctx, criarRng(42), 0.01);
    const b = criarBufferRuido(ctx, criarRng(42), 0.01);
    const c = criarBufferRuido(ctx, criarRng(43), 0.01);
    expect(Array.from(a.getChannelData(0))).toEqual(Array.from(b.getChannelData(0)));
    expect(Array.from(a.getChannelData(0))).not.toEqual(Array.from(c.getChannelData(0)));
  });

  it('todas as amostras ficam em [-1, 1) e o tamanho é sampleRate * segundos', () => {
    const { ctx } = criarContextoSinteseFalso();
    const buffer = criarBufferRuido(ctx, criarRng(1), 0.5);
    const dados = buffer.getChannelData(0);
    expect(dados.length).toBe(Math.round(ctx.sampleRate * 0.5));
    for (const v of dados) {
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThan(1);
    }
  });
});

