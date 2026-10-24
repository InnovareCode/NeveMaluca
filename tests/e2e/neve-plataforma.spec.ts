/**
 * e2e da plataforma do M0 (Lyra): escala, orientação, foco/pausa, laço, fontes, tela cheia (com o cartão do iPhone) e destrave de áudio.
 * Roda no servidor de desenvolvimento, nos 3 projetos (desktop, celular Pixel 7 paisagem, webkit-se iPhone SE paisagem).
 * Geometria e layout são MEDIDOS no navegador (getBoundingClientRect, elementFromPoint, getComputedStyle), não deduzidos do CSS.
 *
 * Ganchos: `window.__neve` (laco, cena, canvas) só existe no dev server (src/main.ts).
 */
import { expect, test, type Page } from '@playwright/test';

interface EstadoDoLaco {
  ticks: number;
  quadros: number;
  pausado: boolean;
  rodando: boolean;
  motivos: string[];
}

const lerLaco = (page: Page): Promise<EstadoDoLaco> =>
  page.evaluate(() => {
    const l = (window as unknown as { __neve: { laco: { ticks: number; quadros: number; pausado: boolean; rodando: boolean; motivosDePausa: string[] } } }).__neve.laco;
    return { ticks: l.ticks, quadros: l.quadros, pausado: l.pausado, rodando: l.rodando, motivos: [...l.motivosDePausa] };
  });

/** Sobe a página, espera o boot e devolve os erros de console/página coletados até o fim do teste. */
async function abrir(page: Page, largura: number, altura: number): Promise<string[]> {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') erros.push(m.text());
  });
  await page.setViewportSize({ width: largura, height: altura });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');
  return erros;
}

const caixaDoCanvas = async (page: Page): Promise<{ x: number; y: number; width: number; height: number }> => {
  const c = await page.locator('canvas#jogo').boundingBox();
  expect(c).not.toBeNull();
  return c as { x: number; y: number; width: number; height: number };
};

/** Quem está no ponto (x, y) da janela: 'canvas', 'rot' ou o id/tag do elemento. */
const quemEstaEm = (page: Page, x: number, y: number): Promise<string> =>
  page.evaluate(
    ([px, py]) => {
      const el = document.elementFromPoint(px as number, py as number);
      return el ? (el.id || el.tagName.toLowerCase()) : 'nada';
    },
    [x, y],
  );

test.describe('paisagem: desenha e anda', () => {
  test('o canvas é desenhado (céu, terreno), o laço roda a ~60 ticks por segundo e não há erro de console', async ({ page }) => {
    const erros = await abrir(page, 844, 390);

    // buffer fixo 1920x1080 (960x540 x 2)
    const canvas = page.locator('canvas#jogo');
    await expect(canvas).toHaveAttribute('width', '1920');
    await expect(canvas).toHaveAttribute('height', '1080');

    // pixels de verdade: céu azul no topo, terreno (neve) no centro-base. Desde a integração do M1a (Atlas), o
    // boot monta `criarCenaJogo` (descida com o motor/pista REAIS da Vega), não mais a cena de título do M0 —
    // por isso não há mais título/contorno marinho fixos para medir aqui (ver `descida-m1a.spec.ts` para a cena
    // de descida em si). `baseMeio` (centro da base), e não a borda esquerda: medido que a borda esquerda do
    // terreno some no 1º quadro quando a câmera ainda não alcançou aquele trecho do mundo (fica só o cenário de
    // fundo ali) — o centro-base é coberto pelo terreno desde o 1º quadro.
    const amostra = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const g = c.getContext('2d')!;
      const px = (x: number, y: number): number[] => Array.from(g.getImageData(x, y, 1, 1).data.slice(0, 3));
      const cores = new Set<number>();
      const d = g.getImageData(0, 0, c.width, c.height).data;
      for (let i = 0; i < d.length; i += 4 * 499) cores.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
      return { topo: px(10, 4), baseMeio: px(960, 1070), cores: cores.size };
    });
    expect(amostra.topo[2]).toBeGreaterThan(amostra.topo[0]!); // céu: mais azul que vermelho
    expect(amostra.topo[0]).toBeLessThan(100);
    // A abertura agora é a CAPA oficial escurecida (ou, nos quadros antes de decodificar, o fundo liso azul-noite) —
    // não existe mais o chão de neve vetorial branco que este teste media (pedido do dono: nada fora do padrão
    // Pixar). O que importa aqui é a base estar PINTADA (não transparente/preta), não a cor exata.
    expect(amostra.baseMeio.reduce((s, v) => s + v, 0)).toBeGreaterThan(40);
    expect(amostra.cores).toBeGreaterThan(10); // capa/degradê + neve caindo + convite

    // laço: ~60 ticks/s (tolerante: máquina carregada). Mede um intervalo em regime estável, não um instante —
    // medido (e2e, 2026-10-22): no 1º segundo após o boot a cena de descida ainda está "aquecendo" (1ª criação
    // das camadas de parallax fora da tela etc.), com rajada de ticks de catch-up bem acima de 60/s; a MÉDIA ao
    // longo de alguns segundos já fica certa (~60-62/s). A pausa de 300 ms deixa esse aquecimento passar antes
    // de abrir a janela de medição.
    await page.waitForTimeout(300);
    const a = await lerLaco(page);
    await page.waitForTimeout(1000);
    const b = await lerLaco(page);
    expect(a.pausado).toBe(false);
    expect(b.ticks - a.ticks).toBeGreaterThan(35);
    expect(b.ticks - a.ticks).toBeLessThan(80);
    expect(b.quadros).toBeGreaterThan(a.quadros);

    expect(erros).toEqual([]);
  });

  test('a cena anima de verdade: dois quadros em instantes diferentes são diferentes (flocos)', async ({ page }) => {
    await abrir(page, 844, 390);
    const hash = (): Promise<number> =>
      page.locator('canvas#jogo').evaluate((el) => {
        const c = el as HTMLCanvasElement;
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, 540).data; // metade de cima: céu e flocos
        let h = 0;
        for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i]! + d[i + 1]! * 3) | 0;
        return h;
      });
    const h1 = await hash();
    await page.waitForTimeout(400);
    const h2 = await hash();
    expect(h2).not.toBe(h1);
  });
});

test.describe('escala 960x540 com letterbox, medida no navegador', () => {
  const casos = [
    { largura: 915, altura: 412, esperado: { width: 732, height: 412, x: 91, y: 0 } },
    { largura: 844, altura: 390, esperado: { width: 693, height: 390, x: 75, y: 0 } },
    { largura: 1280, altura: 720, esperado: { width: 1280, height: 720, x: 0, y: 0 } },
  ];

  for (const c of casos) {
    test(`${c.largura}x${c.altura}: ${c.esperado.width}x${c.esperado.height}, 16:9, inteiro, centrado, dentro da janela`, async ({ page }) => {
      const erros = await abrir(page, c.largura, c.altura);
      const caixa = await caixaDoCanvas(page);
      expect(caixa).toEqual(c.esperado);
      expect(Math.abs(caixa.width / caixa.height - 16 / 9)).toBeLessThan(0.01);
      // centrado: sobras iguais dos dois lados (diferem no máximo 1 px por causa do inteiro)
      const sobraEsq = caixa.x;
      const sobraDir = c.largura - (caixa.x + caixa.width);
      expect(Math.abs(sobraEsq - sobraDir)).toBeLessThanOrEqual(1);
      // o buffer não mudou (o CSS escala, o desenho continua 1920x1080)
      await expect(page.locator('canvas#jogo')).toHaveAttribute('width', '1920');
      // as bordas do canvas são reais: um pixel dentro é o canvas, um pixel fora (no letterbox) não é
      expect(await quemEstaEm(page, caixa.x + 1, caixa.y + 1)).toBe('jogo');
      expect(await quemEstaEm(page, caixa.x + caixa.width - 2, caixa.y + caixa.height - 2)).toBe('jogo');
      if (caixa.x > 4) expect(await quemEstaEm(page, caixa.x - 2, caixa.y + 40)).not.toBe('jogo');
      expect(erros).toEqual([]);
    });
  }

  test('girar de retrato para paisagem reescala (e o inverso), sem recarregar', async ({ page }) => {
    await abrir(page, 390, 844);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(async () => (await caixaDoCanvas(page)).width).toBe(693);
    await page.setViewportSize({ width: 915, height: 412 });
    await expect.poll(async () => (await caixaDoCanvas(page)).width).toBe(732);
  });

  test('com entalhe simulado (47 px nas laterais, 21 px embaixo) em 915x412: o canvas fica na área segura e centrado nela', async ({ page }) => {
    const erros = await abrir(page, 915, 412);
    await page.evaluate(() => {
      const raiz = document.documentElement.style;
      raiz.setProperty('--teste-esq', '47px');
      raiz.setProperty('--teste-direita', '47px');
      raiz.setProperty('--teste-base', '21px');
      window.dispatchEvent(new Event('resize'));
    });
    // área útil 821x391: manda a altura -> 695x391; sobra 126 na largura -> 63 de cada lado + 47 do entalhe
    await expect.poll(() => caixaDoCanvas(page)).toEqual({ x: 110, y: 0, width: 695, height: 391 });
    const caixa = await caixaDoCanvas(page);
    expect(caixa.x).toBeGreaterThanOrEqual(47);
    expect(caixa.x + caixa.width).toBeLessThanOrEqual(915 - 47);
    expect(caixa.y + caixa.height).toBeLessThanOrEqual(412 - 21);
    expect(Math.abs(caixa.width / caixa.height - 16 / 9)).toBeLessThan(0.01);
    // 844x390 com o mesmo entalhe
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(() => caixaDoCanvas(page)).toEqual({ x: 94, y: 0, width: 656, height: 369 });
    // entalhe sumiu (aparelho sem entalhe): volta ao tamanho cheio
    await page.evaluate(() => {
      const raiz = document.documentElement.style;
      for (const v of ['--teste-esq', '--teste-direita', '--teste-base']) raiz.removeProperty(v);
      window.dispatchEvent(new Event('resize'));
    });
    await expect.poll(() => caixaDoCanvas(page)).toEqual({ x: 75, y: 0, width: 693, height: 390 });
    expect(erros).toEqual([]);
  });
});

test.describe('orientação: retrato mostra o aviso e pausa', () => {
  test('em retrato o aviso "vire o aparelho" cobre a tela, tem contraste alto e o laço está pausado', async ({ page }) => {
    const erros = await abrir(page, 390, 844);
    const aviso = page.locator('#rot');
    await expect(aviso).toBeVisible();
    await expect(aviso).toContainText('Vire o aparelho');
    // cobre a janela inteira e fica POR CIMA do canvas e do botão de tela cheia
    const caixa = await aviso.boundingBox();
    expect(caixa).toEqual({ x: 0, y: 0, width: 390, height: 844 });
    for (const [x, y] of [
      [195, 422],
      [20, 20],
      [370, 20],
    ] as const) {
      expect(['rot', 'p', 'span']).toContain(await quemEstaEm(page, x, y));
    }
    // contraste medido (fundo sólido): texto neve sobre marinho
    const cores = await aviso.evaluate((el) => {
      const e = getComputedStyle(el);
      return { fundo: e.backgroundColor, texto: e.color, papel: el.getAttribute('role') };
    });
    expect(contraste(cores.texto, cores.fundo)).toBeGreaterThan(7);
    expect(cores.papel).toBe('status');
    // laço pausado por 'retrato' e parado de verdade
    const a = await lerLaco(page);
    expect(a.pausado).toBe(true);
    expect(a.motivos).toContain('retrato');
    await page.waitForTimeout(400);
    const b = await lerLaco(page);
    expect(b.ticks).toBe(a.ticks);
    expect(b.quadros).toBe(a.quadros);
    // mesmo pausado, o primeiro quadro foi desenhado (nada de canvas em branco por trás do aviso)
    const cores2 = await page.locator('canvas#jogo').evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      const set = new Set<number>();
      for (let i = 0; i < d.length; i += 4 * 997) set.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
      return set.size;
    });
    expect(cores2).toBeGreaterThan(3);
    expect(erros).toEqual([]);
  });

  test('girar para paisagem esconde o aviso e retoma o laço; girar de volta pausa de novo', async ({ page }) => {
    await abrir(page, 390, 844);
    await expect(page.locator('#rot')).toBeVisible();
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('#rot')).toBeHidden();
    await expect.poll(async () => (await lerLaco(page)).rodando).toBe(true);
    const a = await lerLaco(page);
    await page.waitForTimeout(400);
    expect((await lerLaco(page)).ticks).toBeGreaterThan(a.ticks + 10);
    // o tempo que ficou pausado em retrato não virou salto de simulação
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('#rot')).toBeVisible();
    await expect.poll(async () => (await lerLaco(page)).motivos).toContain('retrato');
  });

  test('o aviso aparece ANTES do JS (é só CSS): sem script, em retrato, ele já está visível', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(baseURL ?? '/');
    await expect(page.locator('#rot')).toBeVisible();
    await ctx.close();
  });

  test('em paisagem o aviso não ocupa espaço nem aparece', async ({ page }) => {
    await abrir(page, 844, 390);
    await expect(page.locator('#rot')).toBeHidden();
    expect(await page.locator('#rot').evaluate((el) => getComputedStyle(el).display)).toBe('none');
  });
});

test.describe('foco e visibilidade pausam o laço', () => {
  test('blur pausa e focus retoma, e o tempo parado não vira ticks', async ({ page }) => {
    await abrir(page, 844, 390);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const a = await lerLaco(page);
    expect(a.motivos).toContain('foco');
    await page.waitForTimeout(1200);
    const b = await lerLaco(page);
    expect(b.ticks).toBe(a.ticks);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(250);
    const c = await lerLaco(page);
    expect(c.pausado).toBe(false);
    expect(c.ticks).toBeGreaterThan(b.ticks);
    // 1,2 s parado + 0,25 s rodando: no máximo ~15 ticks (os 0,25 s), nunca os 72 do tempo parado
    expect(c.ticks - b.ticks).toBeLessThan(30);
  });

  test('aba oculta pausa e voltar a mostrar retoma', async ({ page }) => {
    await abrir(page, 844, 390);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect((await lerLaco(page)).motivos).toContain('oculta');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(async () => (await lerLaco(page)).pausado).toBe(false);
  });

  test('perder o foco EM retrato e voltar o foco não retoma: só gira de volta', async ({ page }) => {
    await abrir(page, 390, 844);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    expect((await lerLaco(page)).pausado).toBe(true);
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(async () => (await lerLaco(page)).pausado).toBe(false);
  });
});

test.describe('fontes auto-hospedadas', () => {
  test('as 3 faces carregam do próprio site (woff2, 200) e o título é desenhado com a fonte verdadeira', async ({ page }) => {
    const respostas: Array<{ url: string; status: number; tipo: string }> = [];
    page.on('response', (r) => {
      if (r.url().includes('/assets/fontes/')) respostas.push({ url: r.url(), status: r.status(), tipo: r.headers()['content-type'] ?? '' });
    });
    const erros = await abrir(page, 844, 390);
    const faces = await page.evaluate(async () => {
      await document.fonts.ready;
      return {
        titulo: document.fonts.check('italic 800 20px "Barlow Condensed"'),
        corpo: document.fonts.check('600 20px "Barlow"'),
        carregadas: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replaceAll('"', '')).sort(),
      };
    });
    expect(faces.titulo).toBe(true);
    expect(faces.corpo).toBe(true);
    expect(faces.carregadas).toEqual(expect.arrayContaining(['Barlow', 'Barlow Condensed']));
    const hosts = new Set(respostas.map((r) => new URL(r.url).host));
    expect(hosts.size).toBe(1); // nada de CDN: tudo do mesmo host
    expect(respostas.length).toBeGreaterThanOrEqual(2);
    for (const r of respostas) expect(r.status, r.url).toBe(200);
    // o título foi medido com a fonte condensada: "NEVE MALUCA" a 132 px cabe em bem menos que a reserva larga
    const largura = await page.evaluate(() => {
      const g = document.createElement('canvas').getContext('2d')!;
      g.font = 'italic 800 132px "Barlow Condensed", Impact, sans-serif';
      const verdadeira = g.measureText('NEVE MALUCA').width;
      g.font = 'italic 800 132px sans-serif';
      return { verdadeira, reserva: g.measureText('NEVE MALUCA').width };
    });
    expect(largura.verdadeira).toBeLessThan(largura.reserva * 0.9);
    expect(erros).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// tela cheia
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Fullscreen API falsa e determinística (o motor real varia: o Playwright WebKit nem sempre a tem). `recusa` simula o navegador recusando.
 * O Playwright serializa a função: ela só pode usar o argumento, nunca variáveis de fora.
 */
const fullscreenFalso = async (page: Page, recusa: boolean): Promise<void> => {
  await page.addInitScript((recusar: boolean) => {
    let atual: Element | null = null;
    const avisar = (): void => void document.dispatchEvent(new Event('fullscreenchange'));
    Object.defineProperty(Document.prototype, 'fullscreenElement', { get: () => atual, configurable: true });
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => true, configurable: true });
    (Element.prototype as unknown as { requestFullscreen: () => Promise<void> }).requestFullscreen = function (this: Element) {
      if (recusar) return Promise.reject(new TypeError('API can only be initiated by a user gesture.'));
      atual = this;
      avisar();
      return Promise.resolve();
    };
    (Document.prototype as unknown as { exitFullscreen: () => Promise<void> }).exitFullscreen = () => {
      atual = null;
      avisar();
      return Promise.resolve();
    };
  }, recusa);
};

/** Aparelho iOS: UA de iPhone com Chrome e SEM Fullscreen API em elementos (como o WebKit do iOS). `instalado` = aberto pelo ícone da Tela de Início. */
const iphone = async (page: Page, instalado: boolean): Promise<void> => {
  await page.addInitScript((standalone: boolean) => {
    const UA =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1';
    Object.defineProperty(navigator, 'userAgent', { get: () => UA, configurable: true });
    delete (Element.prototype as unknown as { requestFullscreen?: unknown }).requestFullscreen;
    delete (Element.prototype as unknown as { webkitRequestFullscreen?: unknown }).webkitRequestFullscreen;
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { get: () => undefined, configurable: true });
    if (standalone) Object.defineProperty(navigator, 'standalone', { get: () => true, configurable: true });
  }, instalado);
};

test.describe('tela cheia (botão acessível)', () => {
  test('com a API: o botão tem rótulo, alvo >= 44 px; clique e tecla F entram e saem', async ({ page }) => {
    await fullscreenFalso(page, false);
    const erros = await abrir(page, 844, 390);
    const botao = page.locator('#btn-tela-cheia');
    await expect(botao).toBeVisible();
    await expect(botao).toHaveAttribute('aria-label', 'Tela cheia');
    // alvo de toque medido
    const caixa = await botao.boundingBox();
    expect(caixa!.width).toBeGreaterThanOrEqual(44);
    expect(caixa!.height).toBeGreaterThanOrEqual(44);
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(844);
    // clique entra
    await botao.click();
    await expect(botao).toHaveAttribute('aria-label', 'Sair da tela cheia');
    expect(await page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
    // tecla F sai e volta a entrar
    await page.keyboard.press('f');
    await expect(botao).toHaveAttribute('aria-label', 'Tela cheia');
    await page.keyboard.press('F');
    await expect(botao).toHaveAttribute('aria-label', 'Sair da tela cheia');
    await botao.click();
    await expect(botao).toHaveAttribute('aria-label', 'Tela cheia');
    expect(erros).toEqual([]);
  });

  test('foco por teclado: o botão é alcançável com Tab e o foco é visível (contorno de 3 px amarelo)', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'WebKit do Playwright não faz Tab até botões sem a opção do sistema; o contorno é conferido no Chromium');
    await fullscreenFalso(page, false);
    await abrir(page, 844, 390);
    await page.keyboard.press('Tab'); // canvas (tabindex=0)
    await page.keyboard.press('Tab'); // botão
    await expect(page.locator('#btn-tela-cheia')).toBeFocused();
    const contorno = await page.locator('#btn-tela-cheia').evaluate((el) => {
      const e = getComputedStyle(el);
      return { estilo: e.outlineStyle, largura: e.outlineWidth, cor: e.outlineColor };
    });
    expect(contorno).toEqual({ estilo: 'solid', largura: '3px', cor: 'rgb(255, 210, 63)' });
    await page.keyboard.press('Enter');
    await expect(page.locator('#btn-tela-cheia')).toHaveAttribute('aria-label', 'Sair da tela cheia');
  });

  test('navegador recusa: aparece o aviso discreto (role=status) e o botão continua utilizável', async ({ page }) => {
    await fullscreenFalso(page, true);
    await abrir(page, 844, 390);
    await page.locator('#btn-tela-cheia').click();
    const aviso = page.locator('#aviso');
    await expect(aviso).toBeVisible({ timeout: 5000 });
    await expect(aviso).toContainText('recusou a tela cheia');
    expect(await aviso.getAttribute('role')).toBe('status');
    // o aviso não captura toque (não atrapalha o jogo)
    expect(await aviso.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
    await expect(page.locator('#btn-tela-cheia')).toHaveAttribute('aria-label', 'Tela cheia');
  });
});

test.describe('tela cheia no iPhone: cartão COMO ATIVAR', () => {
  test('sem Fullscreen API o botão vira COMO ATIVAR e abre o cartão com o caminho do iPhone; Esc, botão e fundo fecham; o foco volta', async ({ page }) => {
    await iphone(page, false);
    const erros = await abrir(page, 844, 390);
    const botao = page.locator('#btn-tela-cheia');
    await expect(botao).toBeVisible();
    await expect(botao).toContainText('COMO ATIVAR');
    await expect(botao).toHaveAttribute('aria-label', 'Tela cheia: como ativar');
    const cartao = page.locator('#cartao-tela-cheia [role="dialog"]');
    await expect(cartao).toBeHidden();

    await botao.click();
    await expect(cartao).toBeVisible();
    await expect(cartao).toHaveAttribute('aria-modal', 'true');
    await expect(cartao.locator('h2')).toHaveText('TELA CHEIA NO IPHONE / IPAD');
    await expect(cartao).toContainText('Compartilhar');
    await expect(cartao).toContainText('Adicionar à Tela de Início');
    await expect(cartao.locator('li')).toHaveCount(3);
    // a janela cabe na tela (medido) e o foco foi para dentro do cartão
    const c = await cartao.boundingBox();
    expect(c!.x).toBeGreaterThanOrEqual(0);
    expect(c!.y).toBeGreaterThanOrEqual(0);
    expect(c!.x + c!.width).toBeLessThanOrEqual(844);
    expect(c!.y + c!.height).toBeLessThanOrEqual(390);
    await expect(page.getByRole('button', { name: 'Entendi' })).toBeFocused();
    // o rótulo do diálogo existe (leitor de tela)
    const nome = await cartao.evaluate((el) => document.getElementById(el.getAttribute('aria-labelledby') ?? '')?.textContent);
    expect(nome).toBe('TELA CHEIA NO IPHONE / IPAD');
    // contraste do cartão (fundo sólido)
    const cores = await cartao.evaluate((el) => ({ fundo: getComputedStyle(el).backgroundColor, texto: getComputedStyle(el).color }));
    expect(contraste(cores.texto, cores.fundo)).toBeGreaterThan(7);

    // Tab não escapa do cartão
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Entendi' })).toBeFocused();
    // Esc fecha e o foco volta ao botão que abriu
    await page.keyboard.press('Escape');
    await expect(cartao).toBeHidden();
    await expect(botao).toBeFocused();

    // botão "Entendi" fecha
    await botao.click();
    await page.getByRole('button', { name: 'Entendi' }).click();
    await expect(cartao).toBeHidden();
    // toque no fundo fecha
    await botao.click();
    await page.locator('#cartao-tela-cheia').click({ position: { x: 3, y: 3 } });
    await expect(cartao).toBeHidden();
    expect(erros).toEqual([]);
  });

  test('aberto pelo ícone da Tela de Início (standalone) já está sem barras: o botão some', async ({ page }) => {
    await iphone(page, true);
    await abrir(page, 844, 390);
    await expect(page.locator('#btn-tela-cheia')).toBeHidden();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// destrave de áudio
// ---------------------------------------------------------------------------------------------------------------------

test.describe('destrave de áudio no gesto (WebKit/iOS)', () => {
  test('touchstart sozinho NÃO destrava; toque, clique e tecla reais destravam; `interrupted` religa', async ({ page }, info) => {
    await abrir(page, 844, 390);
    const temToque = Boolean(info.project.use.hasTouch);
    const aposTouchstart = await page.evaluate(async () => {
      const { desbloquearAudio } = (await import(/* @vite-ignore */ '/src/platform/audio-desbloqueio.ts' as string)) as typeof import('../../src/platform/audio-desbloqueio');
      const audio = {
        ctx: { state: 'suspended' } as { state: string },
        chamadas: [] as string[],
        init() {
          this.chamadas.push('init');
        },
        resume() {
          this.chamadas.push('resume');
          this.ctx.state = 'running';
        },
      };
      (window as unknown as { __audioFalso: typeof audio }).__audioFalso = audio;
      desbloquearAudio(window, audio);
      window.dispatchEvent(new Event('touchstart')); // o WebKit NÃO conta o touchstart como gesto
      return audio.chamadas.length;
    });
    expect(aposTouchstart).toBe(0);
    const ler = (): Promise<{ estado: string; chamadas: string[] }> =>
      page.evaluate(() => {
        const a = (window as unknown as { __audioFalso: { ctx: { state: string }; chamadas: string[] } }).__audioFalso;
        return { estado: a.ctx.state, chamadas: [...a.chamadas] };
      });
    const interromper = (): Promise<void> =>
      page.evaluate(() => {
        (window as unknown as { __audioFalso: { ctx: { state: string } } }).__audioFalso.ctx.state = 'interrupted';
      });

    // o toque no canvas (touchstart + touchend + pointerup + click reais) destrava
    if (temToque) await page.touchscreen.tap(420, 195);
    else await page.mouse.click(420, 195);
    await expect.poll(async () => (await ler()).estado).toBe('running');
    // interrompido (ligação, volta do segundo plano): o próximo gesto religa
    await interromper();
    await page.keyboard.press('Space');
    await expect.poll(async () => (await ler()).estado).toBe('running');
    expect((await ler()).chamadas.filter((c) => c === 'resume').length).toBe(2);
    // com o contexto rodando, o gesto só confere (não chama de novo)
    await page.keyboard.press('Space');
    expect((await ler()).chamadas.filter((c) => c === 'resume').length).toBe(2);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// utilidades
// ---------------------------------------------------------------------------------------------------------------------

/** Razão de contraste WCAG entre duas cores "rgb(r, g, b)" / "rgba(r, g, b, a)" (a do fundo é ignorada: use fundos sólidos). */
function contraste(a: string, b: string): number {
  const lum = (css: string): number => {
    const m = css.match(/[\d.]+/g)!.slice(0, 3).map(Number);
    const [r, g, bl] = m.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [la, lb] = [lum(a), lum(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
