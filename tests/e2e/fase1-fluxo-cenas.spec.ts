/**
 * e2e da Fase 1: Fluxo completo de telas (Abertura -> Menu -> Opções -> Jogo) medido no navegador.
 * Segue as skills `medir-antes-de-afirmar` e `handoff-da-equipe`.
 */
import { expect, test } from '@playwright/test';

test.describe('Fase 1: Fluxo de Cenas e Telas', () => {
  test('abre na Cena de Abertura (Splash), avança para o Menu, entra em Opções e navega para o Jogo', async ({ page }) => {
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');

    // 1. Confere que a cena inicial é 'abertura'
    const cenaInicial = await page.evaluate(() => {
      const g = (window as unknown as { __neve: { cena: { cenaAtual: () => string } } }).__neve;
      return g.cena.cenaAtual();
    });
    expect(cenaInicial).toBe('abertura');

    // 2. Clica no canvas para avançar o splash para o Menu Principal
    const canvas = page.locator('canvas#jogo');
    await canvas.click();

    // Espera a transição suave (fade out de 20 ticks = ~330ms)
    await expect.poll(async () => {
      return page.evaluate(() => {
        const g = (window as unknown as { __neve: { cena: { cenaAtual: () => string } } }).__neve;
        return g.cena.cenaAtual();
      });
    }, { timeout: 3000 }).toBe('menu');

    // Confere que no Menu há cores variadas desenhadas (céu, morro nevado, pinheiros, botões)
    const coresMenu = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      const set = new Set<number>();
      for (let i = 0; i < d.length; i += 4 * 997) set.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
      return set.size;
    });
    expect(coresMenu).toBeGreaterThan(10);

    // 3. No Menu, clica no botão Opções (em 960x540 lógicos: x=20..240, y=400..440)
    // Converte a posição lógica para a coordenada no elemento canvas na tela
    const caixa = await canvas.boundingBox();
    expect(caixa).not.toBeNull();
    if (!caixa) return;

    const escalaX = caixa.width / 960;
    const escalaY = caixa.height / 540;

    // Clica no centro do botão Opções (x=130, y=420)
    await page.mouse.click(caixa.x + 130 * escalaX, caixa.y + 420 * escalaY);

    // Confere que a cena mudou para 'opcoes'
    await expect.poll(async () => {
      return page.evaluate(() => {
        const g = (window as unknown as { __neve: { cena: { cenaAtual: () => string } } }).__neve;
        return g.cena.cenaAtual();
      });
    }).toBe('opcoes');

    // 4. Na tela de opções, testa alternar controles via tecla G
    const controlesAntes = await page.evaluate(() => {
      const g = (window as unknown as { __neve: { save: { dados: { cfg: { controles: string } } } } }).__neve;
      return g.save.dados.cfg.controles;
    });
    expect(controlesAntes).toBe('gestos');

    await page.keyboard.press('KeyG');

    const controlesDepois = await page.evaluate(() => {
      const g = (window as unknown as { __neve: { save: { dados: { cfg: { controles: string } } } } }).__neve;
      return g.save.dados.cfg.controles;
    });
    expect(controlesDepois).toBe('botoes');

    // 5. Volta para o Menu Principal via tecla Escape
    await page.keyboard.press('Escape');
    await expect.poll(async () => {
      return page.evaluate(() => {
        const g = (window as unknown as { __neve: { cena: { cenaAtual: () => string } } }).__neve;
        return g.cena.cenaAtual();
      });
    }).toBe('menu');

    // 6. No Menu, clica no botão Treino (em 960x540 lógicos: centro x=130, y=224)
    await page.mouse.click(caixa.x + 130 * escalaX, caixa.y + 224 * escalaY);

    // Confere que a cena mudou para 'jogo'
    await expect.poll(async () => {
      return page.evaluate(() => {
        const g = (window as unknown as { __neve: { cena: { cenaAtual: () => string } } }).__neve;
        return g.cena.cenaAtual();
      });
    }).toBe('jogo');

    expect(erros).toEqual([]);
  });
});
