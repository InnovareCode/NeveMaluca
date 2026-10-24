/**
 * e2e: Menu -> Seleção de Pista -> persiste a escolha -> volta ao Menu -> Jogar.
 * Segue as skills `medir-antes-de-afirmar` e `handoff-da-equipe`. Espelha `selecao-personagem.spec.ts`.
 */
import { expect, test } from '@playwright/test';

test.describe('Seleção de Pista', () => {
  test('escolhe uma pista no Menu, a escolha persiste no save e o Jogo entra sem erro', async ({ page }) => {
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');

    const canvas = page.locator('canvas#jogo');
    const caixa = await canvas.boundingBox();
    expect(caixa).not.toBeNull();
    if (!caixa) return;
    const escalaX = caixa.width / 960;
    const escalaY = caixa.height / 540;
    const clicarLogico = (x: number, y: number) => page.mouse.click(caixa.x + x * escalaX, caixa.y + y * escalaY);

    // Avança o splash para o Menu
    await canvas.click();
    await expect.poll(() =>
      page.evaluate(() => (window as unknown as { __neve: { cena: { cenaAtual: () => string } } }).__neve.cena.cenaAtual()),
    ).toBe('menu');

    // Nenhuma escolha ainda
    const antes = await page.evaluate(
      () => (window as unknown as { __neve: { save: { dados: { pistaAtiva?: string } } } }).__neve.save.dados.pistaAtiva,
    );
    expect(antes).toBeUndefined();

    // Clica no botão PISTA (960x540 lógicos: x=320..540, y=445..499; centro x=430, y=472)
    await clicarLogico(430, 472);
    await expect.poll(() =>
      page.evaluate(() => (window as unknown as { __neve: { cena: { cenaAtual: () => string } } }).__neve.cena.cenaAtual()),
    ).toBe('selecao-pista');

    // Escolhe o 2º card (coluna 2, linha 1 = 'pico-do-picole'; card em x 350..610, y 112..262 -> centro x=480, y=180)
    await clicarLogico(480, 180);

    const escolhida = await page.evaluate(
      () => (window as unknown as { __neve: { save: { dados: { pistaAtiva?: string } } } }).__neve.save.dados.pistaAtiva,
    );
    expect(escolhida).toBe('pico-do-picole');

    // A escolha já está no localStorage (persistirConfig grava na hora, não só na troca de cena)
    const noDisco = await page.evaluate(() => {
      const bruto = localStorage.getItem('neve-maluca-v1');
      return bruto ? (JSON.parse(bruto) as { pistaAtiva?: string }).pistaAtiva : undefined;
    });
    expect(noDisco).toBe('pico-do-picole');

    // Volta ao Menu via Escape
    await page.keyboard.press('Escape');
    await expect.poll(() =>
      page.evaluate(() => (window as unknown as { __neve: { cena: { cenaAtual: () => string } } }).__neve.cena.cenaAtual()),
    ).toBe('menu');

    // Entra no Jogo (centro do botão Jogar: x=190, y=247) sem lançar erro, já com a pista escolhida
    await clicarLogico(190, 247);
    await expect.poll(() =>
      page.evaluate(() => (window as unknown as { __neve: { cena: { cenaAtual: () => string } } }).__neve.cena.cenaAtual()),
    ).toBe('jogo');

    expect(erros).toEqual([]);
  });
});
