/**
 * Integração do M0 (Vega) contra o BUILD de produção (CSP ativa, sem ganchos de teste): o save é lido no boot, o aviso aparece quando o
 * progresso não pode ser salvo, o clique cria o áudio sem violar a CSP (`media-src blob:` não é necessário ainda) e nada vai para o
 * localStorage num aparelho novo. Chromium e WebKit.
 */
import { expect, test } from '@playwright/test';

const CHAVE = 'neve-maluca-v1';

test.describe('boot integrado no build', () => {
  test('aparelho novo: sobe sem erro nem violação de CSP, nada gravado, clique não quebra', async ({ page }) => {
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') erros.push(m.text());
    });
    await page.addInitScript(() => {
      const w = window as unknown as { __csp: string[] };
      w.__csp = [];
      document.addEventListener('securitypolicyviolation', (e) => w.__csp.push(`${e.effectiveDirective}: ${e.blockedURI}`));
    });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
    await page.locator('canvas#jogo').click();
    await page.waitForTimeout(200);
    expect(await page.evaluate((c) => [localStorage.getItem(c), localStorage.length], CHAVE)).toEqual([null, 0]);
    await expect(page.locator('#aviso')).toBeHidden();
    await expect(page.locator('#err')).toBeHidden();
    expect(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)).toEqual([]);
    expect(await page.evaluate(() => '__neve' in window)).toBe(false);
    expect(erros).toEqual([]);
  });

  test('save de um build mais novo: aviso visível no build, save intacto', async ({ page }) => {
    const futuro = JSON.stringify({ v: 2 });
    await page.addInitScript(([c, v]) => localStorage.setItem(c as string, v as string), [CHAVE, futuro]);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
    await expect(page.locator('#aviso')).toHaveText('Progresso não salvo neste aparelho');
    expect(await page.evaluate((c) => localStorage.getItem(c), CHAVE)).toBe(futuro);
  });
});
