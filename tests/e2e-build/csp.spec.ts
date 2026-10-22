/**
 * Origem: adaptado de tests/e2e-build/csp.spec.ts do InnoFighters. Valida a CSP (<meta http-equiv>) e os
 * artefatos estáticos contra o BUILD: playwright.build.config.ts, `npm run test:e2e:build`.
 * A string da política é fixada aqui DE PROPÓSITO (não importa do vite.config): mudar a política exige mudar os dois.
 */
import { expect, test } from '@playwright/test';

const POLITICA =
  "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:; connect-src 'self'; media-src 'self' blob:; object-src 'none'; base-uri 'self'";

test.describe('build de produção', () => {
  test('a meta CSP está no HTML, vem antes de qualquer script/link e bate com a política', async ({ request }) => {
    const html = await (await request.get('/')).text();
    const meta = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)"/);
    expect(meta, 'meta CSP ausente no HTML do build').not.toBeNull();
    expect((meta?.[1] ?? '').replaceAll('&#39;', "'")).toBe(POLITICA);
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script'));
    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<link'));
    // sem script inline, sem <style> e sem style="" no HTML (senão script-src/style-src 'self' o quebram)
    expect(html.match(/<script(?![^>]*\bsrc=)[^>]*>/g) ?? []).toEqual([]);
    const semComentarios = html.replace(/<!--[\s\S]*?-->/g, ''); // comentários citam <style> de propósito
    expect(semComentarios).not.toMatch(/<style[\s>]/);
    expect(semComentarios).not.toMatch(/\sstyle="/);
    expect(html).toContain('name="robots" content="noindex"');
  });

  test('a página sobe sem violação de CSP, sem erro de console e sem requisição falha', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.effectiveDirective}: ${e.blockedURI}`));
    });
    const erros: string[] = [];
    const falhas: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') erros.push(m.text());
    });
    page.on('requestfailed', (r) => falhas.push(r.url()));

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
    // o CSS externo foi aplicado (vide o fundo definido em src/estilo.css)
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 26, 51)');

    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
    expect(erros).toEqual([]);
    expect(falhas).toEqual([]);
  });

  test('manifest, ícones e version.json são servidos', async ({ request }) => {
    for (const caminho of ['/manifest.webmanifest', '/icones/icone-192.png', '/icones/icone-512.png', '/icones/apple-touch-icon-180.png', '/icones/favicon-32.png']) {
      const r = await request.get(caminho);
      expect(r.status(), caminho).toBe(200);
    }
    const v = (await (await request.get('/version.json')).json()) as { commit: string; data: string; sujo: boolean };
    expect(typeof v.commit).toBe('string');
    expect(Number.isFinite(Date.parse(v.data))).toBe(true);
  });
});
