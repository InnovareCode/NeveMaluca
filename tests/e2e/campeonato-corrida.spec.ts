/**
 * e2e do campeonato (plano "corrida em campeonato" §C2b): clica CAMPEONATO no menu real, confere que a cena muda
 * para `'campeonato'` e que o jogador corre ao lado de 5 rivais de IA na MESMA pista -- screenshot "os 6 na tela"
 * (anéis coloridos + nomes, seta fora da tela + rosto + distância, HUD "Xº/6", barra de progresso com os 6).
 *
 * A corrida INTEIRA até a chegada (jogador + 5 rivais) já é provada -- rápido e determinístico -- por
 * `tests/unit/ui-cenas-corrida.test.ts` (mesma técnica de bot+teclas de `fantasma.spec.ts`, mas em Node). Dirigir
 * a corrida TODA por tecla dentro de um browser real até a chegada seria lento/instável aqui (o bot reage à
 * posição de uma sombra; qualquer folga de sincronismo entre o evento DOM real e o motor soma erro a cada pouso
 * com turbo, C-D7) -- por isso este e2e só prova FLUXO + RENDER com uma corrida CURTA, e o pódio (`ui/cenas/podio.ts`)
 * é screenshotado chamando a cena direto com um `ResultadoCorrida` sintético (mesmo padrão de "objeto raro: prove
 * com chamada direta" da memória de pintores raster) -- sem depender de rodar a corrida até o fim no navegador.
 */
import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface NeveHook {
  readonly laco: { pausar(motivo: string): void };
  readonly cena: {
    atualizar(): void;
    desenhar(ctx: CanvasRenderingContext2D, alpha: number): void;
    cenaAtual: () => string;
  };
  readonly canvas: HTMLCanvasElement;
}

test.describe('Campeonato (corrida em campeonato, C2b)', () => {
  test('menu -> CAMPEONATO: os 6 aparecem na tela (jogador, anéis+nomes, seta fora da tela, HUD de posição)', async ({
    page,
  }, testInfo) => {
    test.setTimeout(30_000);
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');

    const canvas = page.locator('canvas#jogo');
    await canvas.click(); // Abertura -> Menu
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.cena.cenaAtual()))
      .toBe('menu');

    const caixa = await canvas.boundingBox();
    expect(caixa).not.toBeNull();
    if (!caixa) return;
    const escalaX = caixa.width / 960;
    const escalaY = caixa.height / 540;

    // Botão CAMPEONATO (posição que era MODOS): x 80..300, y 295..349 -> centro (190, 322)
    await page.mouse.click(caixa.x + 190 * escalaX, caixa.y + 322 * escalaY);
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.cena.cenaAtual()))
      .toBe('campeonato');

    await page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.laco.pausar('e2e-campeonato'));

    // ~1,8 s depois da contagem "3-2-1-JÁ" (plano §C1): a corrida já está rolando, os 6 devem estar na tela
    // (nenhuma tecla precisa ser pressionada -- o jogador parado já mostra o HUD e os rivais se movendo).
    const foto = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { TICKS_CONTAGEM } = await carregar('/src/ui/cenas/contagem.ts');
      const neve = (window as unknown as { __neve: NeveHook }).__neve;
      const ctx = neve.canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;

      for (let i = 0; i < TICKS_CONTAGEM + 110; i++) neve.cena.atualizar();
      neve.cena.desenhar(ctx, 0);
      return neve.canvas.toDataURL('image/png');
    });

    expect(erros, `erros de página: ${erros.join('; ')}`).toEqual([]);
    writeFileSync(testInfo.outputPath('campeonato-corrida-6-na-tela.png'), Buffer.from(foto.split(',')[1] ?? '', 'base64'));
    await testInfo.attach('campeonato-corrida-6-na-tela', { path: testInfo.outputPath('campeonato-corrida-6-na-tela.png'), contentType: 'image/png' });

    // Cores variadas na tela (céu, neve, piloto, HUD) -- prova mínima de que algo de verdade foi desenhado
    // (mesma técnica de `fase1-fluxo-cenas.spec.ts`), sem depender de OCR pro "Xº/6"/nomes dos rivais.
    const cores = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      const set = new Set<number>();
      for (let i = 0; i < d.length; i += 4 * 997) set.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
      return set.size;
    });
    expect(cores).toBeGreaterThan(10);
  });

  test('pódio (`ui/cenas/podio.ts`): ordem de chegada dos 6 com o jogador destacado', async ({ page }, testInfo) => {
    test.setTimeout(30_000);
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
    await page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.laco.pausar('e2e-podio'));

    // `ResultadoCorrida` SINTÉTICO (plano §Contratos): prova o RENDER do pódio sem depender de rodar a corrida
    // inteira no navegador (essa prova de ponta a ponta já é do `ui-cenas-corrida.test.ts`, em Node).
    const foto = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { criarCenaPodio } = await carregar('/src/ui/cenas/podio.ts');
      const { PERSONAGENS_DE_DADOS } = await carregar('/src/data/personagens.ts');

      const neve = (window as unknown as { __neve: NeveHook }).__neve;
      const ctx = neve.canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
      const nomesPorId = Object.fromEntries(PERSONAGENS_DE_DADOS.map((d: { id: string; nome: string }) => [d.id, d.nome]));

      const resultado = {
        pista: 'morro-do-pinhao',
        ordem: ['bandeira', 'capi', 'queque', 'cidinha', 'bia', 'beto'],
        ticks: { capi: 2500, bandeira: 2400, cidinha: 2800, beto: 3100, queque: 2700, bia: 3000 },
        resumoJogador: {
          pontos: 0,
          ticks: 2500,
          tombos: 0,
          maiorVoltasNumSalto: 0,
          maiorTicksNoAr: 0,
          maiorGrindTicks: 0,
          pousosPerfeitos: 0,
          maiorMult: 0,
          maiorComboManobras: 0,
          bonecos: 0,
          concluiu: true,
        },
        flocosGanhos: 0,
      };

      const cena = criarCenaPodio({
        resultado,
        nomesPorId,
        idJogador: 'capi',
        canvas: neve.canvas,
        aoContinuar: () => undefined,
      });
      cena.atualizar();
      cena.desenhar(ctx, 0);
      cena.destruir?.();
      const pixel = ctx.getImageData(5, 5, 1, 1).data;
      return { foto: neve.canvas.toDataURL('image/png'), pixelCanto: [pixel[0], pixel[1], pixel[2]] };
    });

    expect(erros, `erros de página: ${erros.join('; ')}`).toEqual([]);
    writeFileSync(testInfo.outputPath('campeonato-podio.png'), Buffer.from(foto.foto.split(',')[1] ?? '', 'base64'));
    await testInfo.attach('campeonato-podio', { path: testInfo.outputPath('campeonato-podio.png'), contentType: 'image/png' });

    // `ui/cenas/podio.ts` pinta o fundo INTEIRO com a cor sólida `#0b1a33` antes de qualquer texto -- o canto (5,5)
    // nunca tem texto/botão por cima, então vira a prova de "é mesmo a tela do pódio" sem depender de OCR.
    expect(foto.pixelCanto).toEqual([11, 26, 51]);
  });
});
