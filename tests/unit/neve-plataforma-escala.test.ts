import { describe, expect, it } from 'vitest';
import { ALTURA, ALTURA_BUFFER, LARGURA, LARGURA_BUFFER, RS } from '../../src/platform/constantes';
import { calcularAreaDoCanvas, calcularTamanhoCss, type Margens } from '../../src/platform/escala';

/*
 * Escala do canvas: o maior 16:9 em px inteiros que cabe na janela menos as margens seguras, centralizado (letterbox).
 * Origem do primeiro bloco: tests/unit/escala.test.ts do InnoFighters. Aqui os números dos aparelhos do dono (iPhone em paisagem).
 */

describe('contrato de geometria', () => {
  it('960x540 lógicos, buffer 2x = 1920x1080', () => {
    expect([LARGURA, ALTURA, RS]).toEqual([960, 540, 2]);
    expect([LARGURA_BUFFER, ALTURA_BUFFER]).toEqual([1920, 1080]);
  });
});

describe('calcularTamanhoCss (contrato do InnoFighters)', () => {
  it('janela 16:9 ocupa tudo', () => {
    expect(calcularTamanhoCss(1920, 1080)).toEqual({ largura: 1920, altura: 1080 });
    expect(calcularTamanhoCss(1280, 720)).toEqual({ largura: 1280, altura: 720 });
  });
  it('janela larga demais limita pela altura (barras laterais)', () => {
    expect(calcularTamanhoCss(2000, 540)).toEqual({ largura: 960, altura: 540 });
  });
  it('janela estreita limita pela largura (barras em cima/baixo)', () => {
    expect(calcularTamanhoCss(480, 1000)).toEqual({ largura: 480, altura: 270 });
    expect(calcularTamanhoCss(481, 1000)).toEqual({ largura: 481, altura: 270 }); // 270,56 -> piso: nunca passa da proporção
  });
  it('janela degenerada não explode (zero, negativa, NaN, infinita)', () => {
    expect(calcularTamanhoCss(0, 100)).toEqual({ largura: 0, altura: 0 });
    expect(calcularTamanhoCss(-5, 100)).toEqual({ largura: 0, altura: 0 });
    expect(calcularTamanhoCss(Number.NaN, 100)).toEqual({ largura: 0, altura: 0 });
    expect(calcularAreaDoCanvas(100, Number.POSITIVE_INFINITY, { topo: 0, direita: 0, base: 0, esquerda: 0 }).largura).toBeGreaterThanOrEqual(0);
  });
});

describe('calcularAreaDoCanvas: aparelhos reais em paisagem', () => {
  it('iPhone 915x412 (Pixel/Android grande): 732x412, centralizado na horizontal', () => {
    expect(calcularAreaDoCanvas(915, 412)).toEqual({ largura: 732, altura: 412, esquerda: 91, topo: 0 });
  });

  it('iPhone 844x390 (iPhone 12-14): 693x390, centralizado', () => {
    expect(calcularAreaDoCanvas(844, 390)).toEqual({ largura: 693, altura: 390, esquerda: 75, topo: 0 });
  });

  it('iPhone SE 667x375: 666x375 (arredonda para BAIXO: nunca passa da janela)', () => {
    const a = calcularAreaDoCanvas(667, 375);
    expect(a).toEqual({ largura: 666, altura: 375, esquerda: 0, topo: 0 });
  });

  it('com entalhe nas laterais (47 px) e barra de início embaixo (21 px) em 844x390: cabe na área útil e fica centralizado nela', () => {
    const m: Margens = { topo: 0, direita: 47, base: 21, esquerda: 47 };
    const a = calcularAreaDoCanvas(844, 390, m);
    expect(a.altura).toBe(369); // 390 - 21: a altura manda
    expect(a.largura).toBe(656); // floor(960 * 369/540)
    expect(a.esquerda).toBe(47 + Math.floor((750 - 656) / 2));
    expect(a.topo).toBe(0);
    expect(a.esquerda).toBeGreaterThanOrEqual(47);
    expect(a.esquerda + a.largura).toBeLessThanOrEqual(844 - 47);
    expect(a.topo + a.altura).toBeLessThanOrEqual(390 - 21);
  });

  it('entalhe só de um lado desloca o canvas para o lado livre (centro da ÁREA ÚTIL, não da janela)', () => {
    const a = calcularAreaDoCanvas(1000, 400, { topo: 0, direita: 0, base: 0, esquerda: 100 });
    // útil 900x400: manda a altura (400 -> 711x400), sobra 189 na largura -> 94 de cada lado, além dos 100 do entalhe
    expect(a).toEqual({ largura: 711, altura: 400, esquerda: 194, topo: 0 });
  });

  it('margens maiores que a janela não dão tamanho negativo', () => {
    expect(calcularAreaDoCanvas(100, 100, { topo: 60, direita: 0, base: 60, esquerda: 0 })).toEqual({ largura: 0, altura: 0, esquerda: 0, topo: 0 });
    expect(calcularAreaDoCanvas(100, 100, { topo: -10, direita: Number.NaN, base: -1, esquerda: -7 })).toEqual(calcularAreaDoCanvas(100, 100));
  });
});

describe('calcularAreaDoCanvas: propriedades em muitas janelas e margens', () => {
  const margensDeTeste: Margens[] = [
    { topo: 0, direita: 0, base: 0, esquerda: 0 },
    { topo: 0, direita: 47, base: 21, esquerda: 47 },
    { topo: 59, direita: 0, base: 34, esquerda: 0 },
    { topo: 3, direita: 11, base: 7, esquerda: 29 },
  ];

  it('inteiros, dentro da área útil, 16:9 com erro < 1 px, e encosta numa das duas dimensões (maior possível)', () => {
    for (const m of margensDeTeste) {
      for (let w = 320; w <= 2600; w += 37) {
        for (let h = 240; h <= 1500; h += 41) {
          const a = calcularAreaDoCanvas(w, h, m);
          const utilW = w - m.esquerda - m.direita;
          const utilH = h - m.topo - m.base;
          for (const n of [a.largura, a.altura, a.esquerda, a.topo]) expect(Number.isInteger(n)).toBe(true);
          expect(a.largura).toBeLessThanOrEqual(utilW);
          expect(a.altura).toBeLessThanOrEqual(utilH);
          expect(a.esquerda).toBeGreaterThanOrEqual(m.esquerda);
          expect(a.topo).toBeGreaterThanOrEqual(m.topo);
          expect(a.esquerda + a.largura).toBeLessThanOrEqual(w - m.direita);
          expect(a.topo + a.altura).toBeLessThanOrEqual(h - m.base);
          // proporção: a diferença para 16:9 exato é menor que 1 px de cada lado
          expect(Math.abs(a.largura - (a.altura * 16) / 9)).toBeLessThan(16 / 9 + 1);
          // exatamente uma das duas dimensões esgota a área útil e a outra é o piso da proporção (nunca arredonda para cima)
          const porLargura = a.largura === utilW && a.altura === Math.floor((utilW * 540) / 960);
          const porAltura = a.altura === utilH && a.largura === Math.floor((utilH * 960) / 540);
          expect(porLargura || porAltura, `${w}x${h} ${JSON.stringify(m)} -> ${JSON.stringify(a)}`).toBe(true);
          // maior possível: falta menos de 1 px (do lado que limita) para esgotar a área útil
          const folgaL = utilW - a.largura;
          const folgaA = utilH - a.altura;
          expect(Math.min(folgaL, folgaA)).toBeLessThan(2);
        }
      }
    }
  });
});
