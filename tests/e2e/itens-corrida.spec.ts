/**
 * Botão/tecla de ITEM na corrida (plano `docs/plano-itens-corrida.md` §I4b/I5, Lyra), medido NO NAVEGADOR (skill
 * medir-antes-de-afirmar): `src/input/toque.ts` reagindo a `PointerEvent` NATIVO do Chromium (não um objeto falso
 * de teste unitário) contra um `<canvas>` real do DOM, e a cena de corrida completa desenhando o botão/slot de
 * item sem erro de página.
 */
import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

interface RetanguloLogico {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

test.describe('Itens na corrida: botão de item no toque (I4b)', () => {
  test('tap no botão nunca pula/agacha (mesmo sendo o 1º toque); fora do botão, pulo/agachar continuam normais; tap simultâneo no botão não quebra nenhum dos dois', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');

    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));

    const resultado = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { criarEntrada } = await carregar('/src/input/index.ts');
      const { RETANGULO_BOTAO_ITEM } = await carregar('/src/render/hud.ts');
      const r = RETANGULO_BOTAO_ITEM as RetanguloLogico;

      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      canvas.style.width = '960px';
      canvas.style.height = '540px';
      document.body.appendChild(canvas);

      const entrada = criarEntrada(canvas, window, { toque: { botaoItem: r } });
      // `rect` é a posição REAL na página (o canvas de teste pode cair abaixo de outro elemento já na tela, ex.
      // o `#jogo` do boot) -- `clientX/clientY` do evento tem que ser absoluto na VIEWPORT, não relativo ao canvas.
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + r.x + r.w / 2;
      const cy = rect.top + r.y + r.h / 2;

      // 1) O botão como o PRIMEIRO toque da tela inteira: nunca pode virar pulo (qualquer outro lugar pularia).
      canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: cx, clientY: cy, bubbles: true }));
      const cmdBotao = entrada.obterComando();
      const usouNoBotao = entrada.usarItemBorda();
      canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: cx, clientY: cy, bubbles: true }));

      // 2) Fora do botão, pulo (1º dedo) e agachar (2º dedo) continuam funcionando normalmente. `pulo` do
      //    `ComandoDescida` é BORDA (só true na transição) -- pra conferir que o dedo continua SEGURADO (held),
      //    lê `quadroBruto()` (não consome nada), não `obterComando()` de novo.
      canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, clientX: 100, clientY: 300, bubbles: true }));
      canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, clientX: 500, clientY: 300, bubbles: true }));
      const cmdForaDoBotao = entrada.obterComando(); // consome a borda do pulo (1ª vez que vira true)
      const segurandoForaDoBotao = entrada.quadroBruto();

      // 3) Um 3º toque simultâneo, DENTRO do botão, enquanto pulo+agachar já estão ativos (segurados): não
      //    derruba nenhum dos dois (`quadroBruto`), e ainda assim registra o uso do item.
      canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 4, clientX: cx, clientY: cy, bubbles: true }));
      entrada.obterComando();
      const usouComOsTres = entrada.usarItemBorda();
      const segurandoComOsTres = entrada.quadroBruto();

      entrada.destruir();
      document.body.removeChild(canvas);
      return { cmdBotao, usouNoBotao, cmdForaDoBotao, segurandoForaDoBotao, usouComOsTres, segurandoComOsTres };
    });

    expect(erros, `erros de página: ${erros.join('; ')}`).toEqual([]);

    // (1) tap no botão, 1º toque da tela: nunca pula/gira/agacha.
    expect(resultado.cmdBotao).toEqual({ pulo: false, giro: 0, grab: null, agachar: false });
    expect(resultado.usouNoBotao).toBe(true);

    // (2) fora do botão: pulo + agachar funcionam normalmente (comportamento de sempre, sem o botão no caminho).
    expect(resultado.cmdForaDoBotao.pulo).toBe(true); // borda: 1ª vez que o dedo do pulo desceu
    expect(resultado.segurandoForaDoBotao.pular).toBe(true);
    expect(resultado.segurandoForaDoBotao.agachar).toBe(true);

    // (3) tap simultâneo no botão não derruba pulo nem agachar (continuam SEGURADOS), e ainda assim usa o item.
    expect(resultado.segurandoComOsTres.pular).toBe(true);
    expect(resultado.segurandoComOsTres.agachar).toBe(true);
    expect(resultado.usouComOsTres).toBe(true);
  });
});

test.describe('Itens na corrida: render do botão/slot numa corrida real', () => {
  test('cena de corrida real: botão de item aparece na tela, roleta/slot não lançam erro durante o jogo', async ({ page }, testInfo) => {
    test.setTimeout(30_000);
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');

    const foto = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { criarCenaCorrida } = await carregar('/src/ui/cenas/corrida.ts');
      const { TICKS_CONTAGEM } = await carregar('/src/ui/cenas/contagem.ts');
      const { RETANGULO_BOTAO_ITEM } = await carregar('/src/render/hud.ts');
      const r = RETANGULO_BOTAO_ITEM as RetanguloLogico;

      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      canvas.style.width = '960px';
      canvas.style.height = '540px';
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;

      const cena = criarCenaCorrida({ canvas });

      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      for (let i = 0; i < (TICKS_CONTAGEM as number) + 240; i++) {
        // Mashea o botão real (toque de verdade no canvas) ~1x por segundo -- inofensivo com o slot vazio, e
        // prova que o ciclo tap -> usarItemBorda -> Corrida.processar roda inteiro dentro do loop real da cena.
        if (i % 60 === 0) {
          canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 50, clientX: cx, clientY: cy, bubbles: true }));
          canvas.dispatchEvent(new PointerEvent('pointerup', { pointerId: 50, clientX: cx, clientY: cy, bubbles: true }));
        }
        cena.atualizar();
      }
      cena.desenhar(ctx, 0);
      return canvas.toDataURL('image/png');
    });

    expect(erros, `erros de página: ${erros.join('; ')}`).toEqual([]);
    writeFileSync(testInfo.outputPath('corrida-botao-item.png'), Buffer.from(foto.split(',')[1] ?? '', 'base64'));
    await testInfo.attach('corrida-botao-item', { path: testInfo.outputPath('corrida-botao-item.png'), contentType: 'image/png' });
  });
});
