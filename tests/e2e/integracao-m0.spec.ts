/**
 * Integração do M0 (Vega), no servidor de desenvolvimento: save lido no boot (localStorage REAL), aviso quando o progresso não pode ser
 * salvo, AudioContext criado só depois do gesto, e falha do núcleo aparecendo na caixa #err em vez de tela em branco.
 * Roda nos 3 projetos (desktop, celular, webkit-se). O gancho `window.__neve` só existe no dev server.
 */
import { expect, test } from '@playwright/test';

const CHAVE = 'neve-maluca-v1';
const CHAVE_QUEBRADA = 'neve-maluca-v1-quebrada';

interface Gancho {
  save: { estado: string; avisar: boolean };
  audio: { ctx: unknown };
}

const lerGancho = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const g = (window as unknown as { __neve: Gancho }).__neve;
    return { estado: g.save.estado, avisar: g.save.avisar, temContexto: g.audio.ctx !== null };
  });

test.describe('boot integrado', () => {
  test('aparelho novo: save "novo", nada gravado no localStorage, sem aviso, áudio ainda sem contexto', async ({ page }) => {
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
    expect(await lerGancho(page)).toEqual({ estado: 'novo', avisar: false, temContexto: false });
    expect(await page.evaluate((c) => [localStorage.getItem(c), localStorage.length], CHAVE)).toEqual([null, 0]);
    await expect(page.locator('#aviso')).toBeHidden();
    await expect(page.locator('#err')).toBeHidden();
    expect(erros).toEqual([]);
  });

  test('AudioContext (falso, igual nos 3 motores): nada no boot; o 1º gesto cria UM contexto e chama resume; o 2º gesto não cria outro', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __ac: { criados: number; resumes: number } };
      w.__ac = { criados: 0, resumes: 0 };
      class ACFalso {
        state = 'suspended';
        constructor() {
          w.__ac.criados += 1;
        }
        resume(): Promise<void> {
          w.__ac.resumes += 1;
          this.state = 'running';
          return Promise.resolve();
        }
      }
      (window as unknown as { AudioContext: unknown }).AudioContext = ACFalso;
    });
    const contagem = () => page.evaluate(() => (window as unknown as { __ac: { criados: number; resumes: number } }).__ac);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
    expect(await contagem()).toEqual({ criados: 0, resumes: 0 });
    await page.locator('canvas#jogo').click();
    await expect.poll(contagem).toEqual({ criados: 1, resumes: 1 });
    await page.locator('canvas#jogo').click(); // já running: não cria nem religa
    await page.keyboard.press('Space');
    expect(await contagem()).toEqual({ criados: 1, resumes: 1 });
    await expect(page.locator('#err')).toBeHidden();
  });

  test('AudioContext REAL: o gesto cria o contexto (pula onde o motor de teste não tem Web Audio: o WebKit do Playwright no Windows)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
    const temWebAudio = await page.evaluate(() => typeof AudioContext !== 'undefined' || typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined');
    test.skip(!temWebAudio, 'este motor de teste não tem Web Audio; o aparelho real (iPhone) fica com o dono');
    expect((await lerGancho(page)).temContexto).toBe(false);
    await page.locator('canvas#jogo').click();
    await expect.poll(async () => (await lerGancho(page)).temContexto).toBe(true);
    await expect(page.locator('#err')).toBeHidden();
  });

  test('aparelho SEM Web Audio: o gesto não quebra nada (ctx continua nulo, sem erro)', async ({ page }) => {
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.addInitScript(() => {
      delete (window as unknown as { AudioContext?: unknown }).AudioContext;
      delete (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext;
    });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
    await page.locator('canvas#jogo').click();
    await page.keyboard.press('Space');
    expect((await lerGancho(page)).temContexto).toBe(false);
    await expect(page.locator('#err')).toBeHidden();
    expect(erros).toEqual([]);
  });

  test('save de um build mais novo (v:2): lido, avisa "Progresso não salvo neste aparelho" e NÃO é sobrescrito', async ({ page }) => {
    const futuro = JSON.stringify({ v: 2, coisa: 'de um build futuro' });
    await page.addInitScript(
      ([c, v]) => localStorage.setItem(c as string, v as string),
      [CHAVE, futuro],
    );
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
    expect(await lerGancho(page)).toMatchObject({ estado: 'futuro', avisar: true });
    await expect(page.locator('#aviso')).toBeVisible();
    await expect(page.locator('#aviso')).toHaveText('Progresso não salvo neste aparelho');
    expect(await page.evaluate((c) => localStorage.getItem(c), CHAVE)).toBe(futuro);
  });

  test('save com lixo: recupera (estado "recuperado"), guarda a cópia -quebrada, não avisa', async ({ page }) => {
    await page.addInitScript(([c]) => localStorage.setItem(c as string, '{isto não é json'), [CHAVE]);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
    expect(await lerGancho(page)).toMatchObject({ estado: 'recuperado', avisar: false });
    await expect(page.locator('#aviso')).toBeHidden();
    expect(await page.evaluate((c) => localStorage.getItem(c), CHAVE_QUEBRADA)).toBe('{isto não é json');
  });

  test('localStorage bloqueado (modo privado/cookies): o jogo sobe e o aviso aparece (armazenamento só em memória)', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('bloqueado', 'SecurityError');
        },
        configurable: true,
      });
    });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
    // com o ArmazenamentoResiliente a leitura não falha (cai para memória), então o estado é "novo": o sinal do aviso é `!persistente`
    expect(await page.evaluate(() => (window as unknown as { __neve: { armazenamento: { persistente: boolean } } }).__neve.armazenamento.persistente)).toBe(false);
    await expect(page.locator('#aviso')).toHaveText('Progresso não salvo neste aparelho');
  });

  test('núcleo adulterado (hash das tabelas de trig errado): o erro aparece na caixa #err e o jogo NÃO fica "pronto"', async ({ page }) => {
    // troca só o hash fixo, servindo o resto do módulo como está: simula tabela divergente no aparelho
    await page.route(/\/src\/core\/trig\.ts/, async (route) => {
      const resposta = await route.fetch();
      const corpo = (await resposta.text()).replace('11246e61fddfa40a', '0000000000000000');
      await route.fulfill({ response: resposta, body: corpo });
    });
    await page.goto('/');
    await expect(page.locator('#err')).toBeVisible();
    await expect(page.locator('#err')).toContainText('tabelas de trigonometria divergem do hash fixo');
    expect(await page.evaluate(() => document.documentElement.dataset['pronto'])).toBeUndefined();
  });
});
