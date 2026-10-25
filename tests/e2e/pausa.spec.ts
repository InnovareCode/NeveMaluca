/**
 * e2e do menu de pausa (feedback do dono, playtest iPhone: "durante a partida não dá pra pausar, voltar ao
 * menu, abrir configuração nem reiniciar"). Roda nos 3 projetos do `playwright.config.ts` (desktop, celular,
 * webkit-se = iPhone SE em PAISAGEM no motor do iPhone) -- é esse 3º projeto que dá o print "no iPhone" do DoD.
 *
 * Prova: o botão de pausa do HUD (toque real, mouse.click) abre o painel; CONTINUAR/CONFIGURAÇÕES/VOLTAR AO
 * MENU (com confirmação)/REINICIAR respondem; Esc/P também abrem/fecham; perder o foco da janela abre a pausa
 * sozinha (feedback do dono: "pausa automática" precisa ser VISÍVEL, não só o laço mudo por baixo).
 *
 * Técnica de leitura sem OCR (mesma de `campeonato-corrida.spec.ts`/pódio): amostra um pixel num ponto do
 * painel que NUNCA tem texto/botão por cima (`PROBE_PAUSA`/`PROBE_OPCOES`) e compara com a cor medida do Painel
 * Geada daquela tela (`COR_PAINEL_PAUSA`/`COR_PAINEL_OPCOES`, ver o comentário antes delas) -- se bate, o painel
 * está na tela; se não bate, não está. Os dois pontos ficam em regiões que só o painel da PRÓPRIA tela cobre
 * (nunca o da outra), o que distingue as duas sem precisar ler texto.
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

// O Painel Geada (`kit-premium.ts`) tem uma chapa opaca por dentro -- a cor final do corpo do painel NÃO
// depende do que está congelado por baixo, então basta medir uma vez no navegador (skill `medir-antes-de-
// afirmar`) pra ter uma constante estável. Os dois painéis (pausa.ts e opcoes.ts) usam a MESMA receita, mas como
// têm alturas diferentes (380 vs 340) e os pontos abaixo caem em frações diferentes do degradê de tinta, as
// cores medidas são distintas -- por isso duas constantes, não uma.
const COR_PAINEL_PAUSA: readonly [number, number, number] = [12, 26, 63]; // medido no navegador (Chromium), ver ui/cenas/pausa.ts
const COR_PAINEL_OPCOES: readonly [number, number, number] = [33, 52, 88]; // medido no navegador (Chromium), ver ui/cenas/opcoes.ts
// Ponto dentro do painel de pausa (x 280..680, y 80..460) mas fora do de Opções (y 104..444) -- só o de pausa
// desenha aqui, e está longe de qualquer texto/botão/aro.
const PROBE_PAUSA = { x: 380, y: 450 };
// Dentro do painel de Opções (x 180..780, y 104..444) mas fora do de pausa (x 280..680 -- 200 < 280) -- só cobre
// quando a tela de Opções está por cima.
const PROBE_OPCOES = { x: 220, y: 200 };

/** Compara com tolerância de ±2 por canal: o gradiente do Painel Geada (`kit-premium.ts`) interpola 1 valor
 *  diferente no WebKit do iPhone (motor diferente do Chromium onde `COR_PAINEL_*` foi medido -- mesma causa de
 *  `[[pixel-identico-precisa-baseline-por-motor]]`), não é o painel estar ausente. */
function corProxima(amostra: readonly (number | undefined)[], esperado: readonly [number, number, number], tolerancia = 2): boolean {
  return esperado.every((v, i) => Math.abs((amostra[i] ?? 0) - v) <= tolerancia);
}

test.describe('Menu de pausa (Treino e Corrida)', () => {
  test('HUD: botão de pausa abre o painel; CONTINUAR fecha; Esc/P também fecham/abrem', async ({ page }, testInfo) => {
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
    const clicarLogico = (x: number, y: number) => page.mouse.click(caixa.x + x * escalaX, caixa.y + y * escalaY);

    // TREINO -> seleção de personagem (feedback do dono) -> escolhe o card 0 ('capi') -> jogo
    await clicarLogico(130, 224);
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.cena.cenaAtual()))
      .toBe('selecao');
    await clicarLogico(110, 470); // cartão 0 ('capi')
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.cena.cenaAtual()))
      .toBe('jogo');

    // Congela o laço real (igual aos e2e de campeonato) e avança a contagem "3-2-1-JÁ" na mão, pra ter gameplay
    // de verdade atrás do painel de pausa.
    await page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.laco.pausar('e2e-pausa'));
    await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { TICKS_CONTAGEM } = await carregar('/src/ui/cenas/contagem.ts');
      const neve = (window as unknown as { __neve: NeveHook }).__neve;
      for (let i = 0; i < TICKS_CONTAGEM + 60; i++) neve.cena.atualizar();
    });

    const desenharEAmostrar = (p: { x: number; y: number }) =>
      page.evaluate(
        ({ px, py }) => {
          const neve = (window as unknown as { __neve: NeveHook }).__neve;
          const ctx = neve.canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
          neve.cena.desenhar(ctx, 0);
          const d = ctx.getImageData(px * (neve.canvas.width / 960), py * (neve.canvas.height / 540), 1, 1).data;
          return [d[0], d[1], d[2]];
        },
        { px: p.x, py: p.y },
      );

    // Antes de pausar: o ponto do painel ainda não é a cor do painel (é gameplay: céu/neve/HUD).
    expect(corProxima(await desenharEAmostrar(PROBE_PAUSA), COR_PAINEL_PAUSA)).toBe(false);

    // Botão de pausa do HUD (`render/hud.ts: RETANGULO_BOTAO_PAUSA`, canto superior direito) -- toque real.
    const retanguloBotaoPausa = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { RETANGULO_BOTAO_PAUSA } = await carregar('/src/render/hud.ts');
      return RETANGULO_BOTAO_PAUSA as { x: number; y: number; w: number; h: number };
    });
    const centroPausa = { x: retanguloBotaoPausa.x + retanguloBotaoPausa.w / 2, y: retanguloBotaoPausa.y + retanguloBotaoPausa.h / 2 };
    await clicarLogico(centroPausa.x, centroPausa.y);

    const fotoPausado = await page.evaluate(() => {
      const neve = (window as unknown as { __neve: NeveHook }).__neve;
      const ctx = neve.canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
      neve.cena.desenhar(ctx, 0);
      return neve.canvas.toDataURL('image/png');
    });
    writeFileSync(testInfo.outputPath('pausa-aberta.png'), Buffer.from(fotoPausado.split(',')[1] ?? '', 'base64'));
    await testInfo.attach('pausa-aberta', { path: testInfo.outputPath('pausa-aberta.png'), contentType: 'image/png' });

    // Screenshot da PÁGINA de verdade (não só o buffer do canvas): mostra o letterbox/área segura real do
    // viewport do projeto (desktop 1280x720; no `webkit-se` é o iPhone SE em paisagem de verdade).
    await page.screenshot({ path: testInfo.outputPath('pausa-aberta-viewport.png') });
    await testInfo.attach('pausa-aberta-viewport', { path: testInfo.outputPath('pausa-aberta-viewport.png'), contentType: 'image/png' });

    expect(corProxima(await desenharEAmostrar(PROBE_PAUSA), COR_PAINEL_PAUSA)).toBe(true);
    expect(await page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.cena.cenaAtual())).toBe('jogo');

    // Tecla Esc fecha (continua)
    await page.keyboard.press('Escape');
    expect(corProxima(await desenharEAmostrar(PROBE_PAUSA), COR_PAINEL_PAUSA)).toBe(false);

    // Tecla P abre de novo (mesmo atalho do teclado)
    await page.keyboard.press('KeyP');
    expect(corProxima(await desenharEAmostrar(PROBE_PAUSA), COR_PAINEL_PAUSA)).toBe(true);

    // CONFIGURAÇÕES: reaproveita a cena de Opções de verdade, depois VOLTAR retorna pra pausa
    const config = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { BOTAO_CONFIGURACOES } = await carregar('/src/ui/cenas/pausa.ts');
      return BOTAO_CONFIGURACOES as { x: number; y: number; w: number; h: number };
    });
    await clicarLogico(config.x + config.w / 2, config.y + config.h / 2);
    expect(corProxima(await desenharEAmostrar(PROBE_OPCOES), COR_PAINEL_OPCOES)).toBe(true); // painel Geada da tela de Opções
    expect(corProxima(await desenharEAmostrar(PROBE_PAUSA), COR_PAINEL_PAUSA)).toBe(false); // pausa não desenha por baixo

    await clicarLogico(60, 48); // botão VOLTAR redondo de `opcoes.ts` (x=32..88, y=20..76)
    expect(corProxima(await desenharEAmostrar(PROBE_OPCOES), COR_PAINEL_OPCOES)).toBe(false);
    expect(corProxima(await desenharEAmostrar(PROBE_PAUSA), COR_PAINEL_PAUSA)).toBe(true); // voltou pra pausa, não pro menu

    // VOLTAR AO MENU pede confirmação: CANCELAR continua no jogo pausado
    const botoes = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const m = (await carregar('/src/ui/cenas/pausa.ts')) as {
        readonly BOTAO_VOLTAR_MENU: { x: number; y: number; w: number; h: number };
        readonly BOTAO_CANCELAR_SAIDA: { x: number; y: number; w: number; h: number };
        readonly BOTAO_CONFIRMAR_SAIDA: { x: number; y: number; w: number; h: number };
      };
      return { voltarMenu: m.BOTAO_VOLTAR_MENU, cancelar: m.BOTAO_CANCELAR_SAIDA, confirmar: m.BOTAO_CONFIRMAR_SAIDA };
    });
    await clicarLogico(botoes.voltarMenu.x + botoes.voltarMenu.w / 2, botoes.voltarMenu.y + botoes.voltarMenu.h / 2);
    await clicarLogico(botoes.cancelar.x + botoes.cancelar.w / 2, botoes.cancelar.y + botoes.cancelar.h / 2);
    expect(await page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.cena.cenaAtual())).toBe('jogo');
    expect(corProxima(await desenharEAmostrar(PROBE_PAUSA), COR_PAINEL_PAUSA)).toBe(true); // ainda pausado

    // Confirma de verdade: SIM volta ao menu principal
    await clicarLogico(botoes.voltarMenu.x + botoes.voltarMenu.w / 2, botoes.voltarMenu.y + botoes.voltarMenu.h / 2);
    await clicarLogico(botoes.confirmar.x + botoes.confirmar.w / 2, botoes.confirmar.y + botoes.confirmar.h / 2);
    // "Nevasca" (ui/transicao.ts §10.1): a troca pra 'menu' só termina de CONSTRUIR (e `cenaAtual()` só reflete
    // o destino) no início da revelação, e isso só avança com `atualizar()` -- o `laco` real está PAUSADO desde
    // `laco.pausar('e2e-pausa')` (lá em cima, pra congelar o gameplay atrás da pausa), então precisa tickar na
    // mão (como a contagem acima), sem depender do rAF de verdade.
    await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { TICKS_NEVASCA_TOTAL } = await carregar('/src/ui/transicao.ts');
      const neve = (window as unknown as { __neve: NeveHook }).__neve;
      for (let i = 0; i < TICKS_NEVASCA_TOTAL; i++) neve.cena.atualizar();
    });
    expect(await page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.cena.cenaAtual())).toBe('menu');

    expect(erros, `erros de página: ${erros.join('; ')}`).toEqual([]);
  });

  test('REINICIAR fecha a pausa sem travar; perder o foco abre a pausa sozinha', async ({ page }, testInfo) => {
    test.setTimeout(30_000);
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');

    const canvas = page.locator('canvas#jogo');
    await canvas.click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.cena.cenaAtual()))
      .toBe('menu');
    const caixa = await canvas.boundingBox();
    expect(caixa).not.toBeNull();
    if (!caixa) return;
    const escalaX = caixa.width / 960;
    const escalaY = caixa.height / 540;
    const clicarLogico = (x: number, y: number) => page.mouse.click(caixa.x + x * escalaX, caixa.y + y * escalaY);

    await clicarLogico(130, 224); // TREINO
    // "Nevasca" (§10.1): só dá pra clicar no cartão depois que a seleção TERMINA de construir (senão a Nevasca
    // ainda está bloqueando/a cena nem existe, e o clique cai no vazio) -- por isso o `.poll()` ANTES do 2º clique.
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.cena.cenaAtual()))
      .toBe('selecao');
    await clicarLogico(110, 470); // cartão 0 ('capi')
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.cena.cenaAtual()))
      .toBe('jogo');

    await page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.laco.pausar('e2e-pausa-reiniciar'));
    await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { TICKS_CONTAGEM } = await carregar('/src/ui/cenas/contagem.ts');
      const neve = (window as unknown as { __neve: NeveHook }).__neve;
      for (let i = 0; i < TICKS_CONTAGEM + 30; i++) neve.cena.atualizar();
    });

    const desenharEAmostrar = (p: { x: number; y: number }) =>
      page.evaluate(
        ({ px, py }) => {
          const neve = (window as unknown as { __neve: NeveHook }).__neve;
          const ctx = neve.canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
          neve.cena.desenhar(ctx, 0);
          const d = ctx.getImageData(px * (neve.canvas.width / 960), py * (neve.canvas.height / 540), 1, 1).data;
          return [d[0], d[1], d[2]];
        },
        { px: p.x, py: p.y },
      );

    await page.keyboard.press('Escape'); // abre a pausa
    expect(corProxima(await desenharEAmostrar(PROBE_PAUSA), COR_PAINEL_PAUSA)).toBe(true);

    const reiniciar = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { BOTAO_REINICIAR } = await carregar('/src/ui/cenas/pausa.ts');
      return BOTAO_REINICIAR as { x: number; y: number; w: number; h: number };
    });
    await clicarLogico(reiniciar.x + reiniciar.w / 2, reiniciar.y + reiniciar.h / 2);

    // REINICIAR troca a sub-cena (descida nova) pela "Nevasca" interna de `ui/cenas/jogo.ts` (§10.1) -- precisa
    // tickar na mão (o `laco` real está pausado desde `laco.pausar('e2e-pausa-reiniciar')`, ver acima).
    await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { TICKS_NEVASCA_TOTAL } = await carregar('/src/ui/transicao.ts');
      const neve = (window as unknown as { __neve: NeveHook }).__neve;
      for (let i = 0; i < TICKS_NEVASCA_TOTAL; i++) neve.cena.atualizar();
    });

    expect(corProxima(await desenharEAmostrar(PROBE_PAUSA), COR_PAINEL_PAUSA)).toBe(false); // painel fechou
    expect(await page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.cena.cenaAtual())).toBe('jogo'); // sem travar/navegar

    // Pausa automática ao perder o foco (feedback do dono: não é só o laço mudo, o menu tem que aparecer)
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    expect(corProxima(await desenharEAmostrar(PROBE_PAUSA), COR_PAINEL_PAUSA)).toBe(true);

    const fotoFinal = await page.evaluate(() => {
      const neve = (window as unknown as { __neve: NeveHook }).__neve;
      const ctx = neve.canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
      neve.cena.desenhar(ctx, 0);
      return neve.canvas.toDataURL('image/png');
    });
    writeFileSync(testInfo.outputPath('pausa-automatica-por-blur.png'), Buffer.from(fotoFinal.split(',')[1] ?? '', 'base64'));
    await testInfo.attach('pausa-automatica-por-blur', { path: testInfo.outputPath('pausa-automatica-por-blur.png'), contentType: 'image/png' });

    expect(erros, `erros de página: ${erros.join('; ')}`).toEqual([]);
  });
});
