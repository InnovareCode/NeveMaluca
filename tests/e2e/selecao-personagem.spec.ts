/**
 * e2e: Menu -> Seleção de Personagem -> persiste a escolha -> volta ao Menu -> Jogar.
 * Segue as skills `medir-antes-de-afirmar` e `handoff-da-equipe`.
 */
import { expect, test } from '@playwright/test';

test.describe('Seleção de Personagem', () => {
  test('escolhe um personagem no Menu, a escolha persiste no save e o Jogo entra sem erro', async ({ page }) => {
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
      () => (window as unknown as { __neve: { save: { dados: { personagemAtivo?: string } } } }).__neve.save.dados.personagemAtivo,
    );
    expect(antes).toBeUndefined();

    // Clica no botão PERSONAGEM (960x540 lógicos: x=20..240, y=448..488; centro x=130, y=468)
    await clicarLogico(130, 468);
    await expect.poll(() =>
      page.evaluate(() => (window as unknown as { __neve: { cena: { cenaAtual: () => string } } }).__neve.cena.cenaAtual()),
    ).toBe('selecao');

    // Escolhe o 2º card (coluna 2, linha 1 = 'bandeira'; card em x 350..610, y 112..262 -> centro x=480, y=180)
    await clicarLogico(480, 180);

    const escolhido = await page.evaluate(
      () => (window as unknown as { __neve: { save: { dados: { personagemAtivo?: string } } } }).__neve.save.dados.personagemAtivo,
    );
    expect(escolhido).toBe('bandeira');

    // A escolha já está no localStorage (persistirConfig grava na hora, não só na troca de cena)
    const noDisco = await page.evaluate(() => {
      const bruto = localStorage.getItem('neve-maluca-v1');
      return bruto ? (JSON.parse(bruto) as { personagemAtivo?: string }).personagemAtivo : undefined;
    });
    expect(noDisco).toBe('bandeira');

    // Volta ao Menu via Escape
    await page.keyboard.press('Escape');
    await expect.poll(() =>
      page.evaluate(() => (window as unknown as { __neve: { cena: { cenaAtual: () => string } } }).__neve.cena.cenaAtual()),
    ).toBe('menu');

    // Entra no Jogo (centro do botão Treino: x=130, y=224) sem lançar erro
    await clicarLogico(130, 224);
    await expect.poll(() =>
      page.evaluate(() => (window as unknown as { __neve: { cena: { cenaAtual: () => string } } }).__neve.cena.cenaAtual()),
    ).toBe('jogo');

    expect(erros).toEqual([]);
  });
});
