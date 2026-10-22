/**
 * Plataforma do M0 contra o BUILD de produção (CSP ativa, sem ganchos de teste): fontes servidas do próprio site, escala por CSSOM
 * sem violação de CSP, aviso de retrato e cartão de tela cheia do iPhone (que cria DOM por script) sem violação de CSP.
 * Roda no Chromium e no WebKit (a CSP se comporta diferente por motor).
 */
import { expect, test, type Page } from '@playwright/test';

async function vigiarCsp(page: Page): Promise<{ violacoes: () => Promise<string[]>; erros: string[] }> {
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.effectiveDirective}: ${e.blockedURI}`));
  });
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text());
  });
  return { violacoes: () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp), erros };
}

test.describe('plataforma no build', () => {
  test('as 3 fontes saem do próprio site como woff2, e a escala (por CSSOM) não viola a CSP: 844x390 vira 693x390', async ({ page }) => {
    const csp = await vigiarCsp(page);
    const fontes: Array<{ url: string; status: number; tipo: string }> = [];
    page.on('response', (r) => {
      if (r.url().includes('/assets/fontes/')) fontes.push({ url: r.url(), status: r.status(), tipo: r.headers()['content-type'] ?? '' });
    });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
    expect(await page.locator('canvas#jogo').boundingBox()).toEqual({ x: 75, y: 0, width: 693, height: 390 });
    expect(fontes.length).toBeGreaterThanOrEqual(2);
    for (const f of fontes) {
      expect(f.status, f.url).toBe(200);
      expect(f.tipo, f.url).toMatch(/font\/woff2|application\/octet-stream|font\/woff/);
    }
    expect(await page.evaluate(() => document.fonts.check('italic 800 20px "Barlow Condensed"'))).toBe(true);
    expect(await csp.violacoes()).toEqual([]);
    expect(csp.erros).toEqual([]);
  });

  test('retrato mostra o aviso (CSS externo) sem violação de CSP; girar esconde', async ({ page }) => {
    const csp = await vigiarCsp(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
    await expect(page.locator('#rot')).toBeVisible();
    await expect(page.locator('#rot')).toContainText('Vire o aparelho');
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('#rot')).toBeHidden();
    expect(await csp.violacoes()).toEqual([]);
    expect(csp.erros).toEqual([]);
  });

  test('cartão do iPhone (DOM criado por script) abre e fecha sem violação de CSP', async ({ page }) => {
    const csp = await vigiarCsp(page);
    await page.addInitScript(() => {
      const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1';
      Object.defineProperty(navigator, 'userAgent', { get: () => UA, configurable: true });
      delete (Element.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen;
      delete (Element.prototype as unknown as { webkitRequestFullscreen?: unknown }).webkitRequestFullscreen;
      Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => undefined, configurable: true });
    });
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
    await expect(page.locator('#btn-tela-cheia')).toContainText('COMO ATIVAR');
    await page.locator('#btn-tela-cheia').click();
    const cartao = page.locator('#cartao-tela-cheia [role="dialog"]');
    await expect(cartao).toBeVisible();
    await expect(cartao).toContainText('Adicionar à Tela de Início');
    // o estilo do cartão veio do CSS externo (fundo neve), não de style inline
    expect(await cartao.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(244, 249, 255)');
    await page.keyboard.press('Escape');
    await expect(cartao).toBeHidden();
    expect(await csp.violacoes()).toEqual([]);
    expect(csp.erros).toEqual([]);
  });

  test('o build não expõe ganchos de teste (window.__neve) e o HTML não tem style inline', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
    expect(await page.evaluate(() => '__neve' in window)).toBe(false);
    const html = await (await request.get('/')).text();
    expect(html.replace(/<!--[\s\S]*?-->/g, '')).not.toMatch(/\sstyle="/);
  });
});
