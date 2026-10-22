import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { carregarFontes, FACES_DO_JOGO } from '../../src/platform/fontes';

/*
 * Origem: adaptado de tests/unit/fontes.test.ts do InnoFighters. Fontes AUTO-HOSPEDADAS em public/assets/fontes (OFL), sem CDN.
 * Que a fonte carrega e desenha de verdade é provado no navegador (tests/e2e/neve-plataforma.spec.ts e tests/e2e-build).
 */
const PASTA = resolve('public/assets/fontes');
const ARQUIVOS = ['barlow-condensed-800-italic-latin.woff2', 'barlow-600-latin.woff2', 'bangers-latin-400-normal.woff2'];

describe('carregarFontes (antes do 1º quadro)', () => {
  it('as faces pedidas são as 3 declaradas no CSS', () => {
    expect(FACES_DO_JOGO).toEqual(['italic 800 20px "Barlow Condensed"', '600 20px "Barlow"', '400 24px "Bangers"']);
  });

  it('pede cada face com amostra de acentos do português e resolve true quando todas chegam', async () => {
    const pedidos: Array<[string, string | undefined]> = [];
    const ok = await carregarFontes({ load: async (f, t) => void pedidos.push([f, t]) }, FACES_DO_JOGO, 500);
    expect(ok).toBe(true);
    expect(pedidos.map(([f]) => f)).toEqual([...FACES_DO_JOGO]);
    for (const [, t] of pedidos) for (const c of 'ÃÕÇÁÉÍÓÚÂÊÔÀ') expect(t).toContain(c);
  });

  it('falha de carga (arquivo 404, rede) resolve false e NÃO rejeita: o jogo abre com a fonte de reserva', async () => {
    expect(await carregarFontes({ load: () => Promise.reject(new Error('404')) }, FACES_DO_JOGO, 500)).toBe(false);
  });

  it('carga que nunca termina estoura o teto e resolve false (nunca prende o boot)', async () => {
    const t0 = Date.now();
    expect(await carregarFontes({ load: () => new Promise(() => undefined) }, FACES_DO_JOGO, 30)).toBe(false);
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('sem document.fonts (ambiente sem navegador) resolve false sem lançar', async () => {
    expect(await carregarFontes(undefined, FACES_DO_JOGO, 30)).toBe(false);
  });
});

describe('arquivos das fontes', () => {
  it('os 3 woff2 existem, são woff2 de verdade (assinatura wOF2) e leves (subset latino, < 40 KB cada)', () => {
    for (const arq of ARQUIVOS) {
      const caminho = join(PASTA, arq);
      expect(existsSync(caminho), arq).toBe(true);
      expect(readFileSync(caminho).subarray(0, 4).toString('latin1'), arq).toBe('wOF2');
      expect(statSync(caminho).size, arq).toBeLessThan(40_000);
    }
  });

  it('a licença OFL de cada família está junto dos arquivos, e não há arquivo sobrando', () => {
    for (const arq of ['OFL-barlow.txt', 'OFL-barlow-condensed.txt']) {
      const txt = readFileSync(join(PASTA, arq), 'utf8');
      expect(txt, arq).toContain('SIL OPEN FONT LICENSE Version 1.1');
      expect(txt, arq).toContain('The Barlow Project Authors');
    }
    const bangers = readFileSync(join(PASTA, 'OFL-bangers.txt'), 'utf8');
    expect(bangers).toContain('SIL OPEN FONT LICENSE Version 1.1');
    expect(bangers).toContain('The Bangers Project Authors');
    expect(readdirSync(PASTA).sort()).toEqual(['LEIA-ME.txt', 'OFL-bangers.txt', 'OFL-barlow-condensed.txt', 'OFL-barlow.txt', ...ARQUIVOS].sort());
  });

  it('o CSS declara exatamente esses arquivos (woff2, font-display block); o index.html NÃO usa preload das fontes; nada de CDN', () => {
    const css = readFileSync(resolve('src/platform/fontes.css'), 'utf8');
    const html = readFileSync(resolve('index.html'), 'utf8');
    for (const arq of ARQUIVOS) expect(css).toContain(`url("/assets/fontes/${arq}") format("woff2")`);
    // sem <link rel=preload> das fontes (QA da Íris: no WebKit não casa com o @font-face e baixa tudo de novo); quem carrega é carregarFontes
    expect(html).not.toMatch(/<link[^>]*rel="preload"/i);
    expect(html).not.toMatch(/<link[^>]*assets\/fontes/i);
    expect(css).toMatch(/font-display:\s*block/);
    expect(css.match(/@font-face/g)).toHaveLength(3);
    for (const texto of [css, html, readFileSync(resolve('src/platform/plataforma.css'), 'utf8')]) {
      expect(texto).not.toMatch(/googleapis|gstatic|fonts\.google|cdn\.|https?:\/\//i);
    }
  });

  it('a CSP libera fonte só do próprio site (font-src self)', async () => {
    const { POLITICA_CSP } = await import('../../vite.config');
    expect(POLITICA_CSP).toContain("font-src 'self'");
    expect(POLITICA_CSP).not.toMatch(/https?:|\*/);
  });
});
