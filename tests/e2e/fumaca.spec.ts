/**
 * Origem: adaptado de tests/e2e/fumaca.spec.ts do InnoFighters. Roda no servidor de desenvolvimento
 * (projetos desktop, celular e webkit-se).
 */
import { expect, test } from '@playwright/test';

test('a página sobe, o canvas tem 1920x1080 (960x540 lógicos x 2) e escala sem distorcer', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text());
  });

  await page.goto('/');
  await expect(page).toHaveTitle('Neve Maluca');
  await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');

  const canvas = page.locator('canvas#jogo');
  await expect(canvas).toHaveAttribute('width', '1920');
  await expect(canvas).toHaveAttribute('height', '1080');

  // medido no navegador: 16:9 e dentro da janela
  const caixa = await canvas.boundingBox();
  const janela = page.viewportSize();
  expect(caixa).not.toBeNull();
  expect(janela).not.toBeNull();
  if (!caixa || !janela) return;
  expect(Math.abs(caixa.width / caixa.height - 16 / 9)).toBeLessThan(0.02);
  expect(caixa.width).toBeLessThanOrEqual(janela.width);
  expect(caixa.height).toBeLessThanOrEqual(janela.height);

  // o canvas foi de fato desenhado (mais de uma cor), e não só criado
  const cores = await canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    const set = new Set<number>();
    for (let i = 0; i < d.length; i += 4 * 997) set.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
    return set.size;
  });
  expect(cores).toBeGreaterThan(3);

  expect(erros).toEqual([]);
});
