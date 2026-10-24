/**
 * Prova no navegador (skill medir-antes-de-afirmar) do piloto raster "Pixar" do Pico do Picolé: screenshots com a
 * Bia real em 3 posições, prova do fallback vetorial, custo por quadro (raster vs vetorial) e memória dos bitmaps.
 * Lyra, 2026-10-23. Script de uso único (não faz parte do `npm run verificar`); roda contra o dev server já de pé.
 *
 * Cada medição abre seu PRÓPRIO navegador+aba (`newPage`) -- a 1ª versão empilhava várias cenas na mesma aba, o
 * que já derrubou o número uma vez (contenção entre páginas), mas não foi a causa toda: o resto era medir `ms/quadro`
 * num LOOP SÍNCRONO e apertado de `cena.desenhar()`, sem nunca ceder o controle ao navegador entre quadros. Esse
 * padrão faz o Chromium headless empacar numa rota de backpressure do canvas (~80 ms/quadro) que NUNCA acontece no
 * jogo de verdade -- o loop real é movido a `requestAnimationFrame`, que cede controle a cada quadro. Medindo com
 * `requestAnimationFrame` (como abaixo) em vez de um `for` apertado, o número bate com o jogo real: ~1,1-1,3 ms.
 */
import { chromium, webkit } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5273';
const SAIDA = 'C:/Projetos/Web/InnoGames/NeveMaluca/arte-fonte/preview/piloto-raster';

const CARREGAR = `const carregar = (c) => import(/* @vite-ignore */ c);`;

/**
 * Navegador + contexto + aba 100% NOVOS por medição: a 1ª tentativa reaproveitava o mesmo `BrowserContext` para as
 * 5 medições em sequência e o "ms/quadro raster" saiu 40-60x inflado (resíduo de trabalho das páginas anteriores
 * -- toDataURL/encode de PNG, decode de bitmap -- ainda ocupando a mesma thread/processo do renderer). Isolando
 * CADA medição na sua própria instância de navegador, o número bate com o microbenchmark isolado (~1-2 ms).
 */
async function novaPagina(navegador) {
  const instancia = await navegador.launch();
  const ctxNav = await instancia.newContext({ viewport: { width: 1000, height: 600 } });
  const pagina = await ctxNav.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(String(e)));
  pagina.on('console', (m) => {
    if (m.type() === 'error') erros.push(`console: ${m.text()}`);
  });
  await pagina.goto(BASE, { waitUntil: 'load' });
  await pagina.waitForSelector('html[data-pronto="true"]', { timeout: 30000 });
  return { instancia, pagina, erros };
}

async function provarFallback(navegador) {
  const { instancia, pagina, erros } = await novaPagina(navegador);
  const cor = await pagina.evaluate(async () => {
    const carregar = (c) => import(/* @vite-ignore */ c);
    const { criarCenaDescida } = await carregar('/src/ui/cenas/descida.ts');
    const { usarEspacoLogico } = await carregar('/src/platform/canvas.ts');
    const { _esquecerAssetsParqueRasterParaTeste } = await carregar('/src/render/temas/catalogo.ts');
    _esquecerAssetsParqueRasterParaTeste();

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d', { alpha: false });
    const cena = criarCenaDescida({ canvas, personagem: 'bia', pista: 'pico-do-picole' });
    for (let i = 0; i < 90; i += 1) cena.atualizar();
    usarEspacoLogico(ctx);
    cena.desenhar(ctx, 0);
    const px = ctx.getImageData(480, 200, 1, 1).data;
    return `#${[px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  });
  await instancia.close();
  return { cor, erros };
}

async function tirarScreenshots(navegador, nomeMotor) {
  const { instancia, pagina, erros } = await novaPagina(navegador);
  const shots = await pagina.evaluate(async () => {
    const carregar = (c) => import(/* @vite-ignore */ c);
    const { criarCenaDescida } = await carregar('/src/ui/cenas/descida.ts');
    const { usarEspacoLogico } = await carregar('/src/platform/canvas.ts');
    const { precarregarAssetsParqueRaster } = await carregar('/src/render/temas/catalogo.ts');
    const ok = await precarregarAssetsParqueRaster(document);
    if (!ok) throw new Error('assets raster não carregaram');

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d', { alpha: false });
    const cena = criarCenaDescida({ canvas, personagem: 'bia', pista: 'pico-do-picole' });
    await new Promise((r) => setTimeout(r, 300)); // sprite da Bia é fire-and-forget: cede controle antes do 1o desenhar

    const posicoes = { inicio: 70, rampa: 230, vao: 420 };
    const resultado = {};
    let tickAnterior = 0;
    for (const [nome, tickAlvo] of Object.entries(posicoes)) {
      for (let i = tickAnterior; i < tickAlvo; i += 1) cena.atualizar();
      tickAnterior = tickAlvo;
      usarEspacoLogico(ctx);
      cena.desenhar(ctx, 0);
      resultado[nome] = canvas.toDataURL('image/png');
    }
    return resultado;
  });

  mkdirSync(SAIDA, { recursive: true });
  for (const [nome, dataUrl] of Object.entries(shots)) {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    writeFileSync(`${SAIDA}/${nomeMotor}-${nome}.png`, Buffer.from(base64, 'base64'));
  }
  await instancia.close();
  return { caminhos: Object.keys(shots).map((n) => `${SAIDA}/${nomeMotor}-${n}.png`), erros };
}

async function medirQuadro(navegador, { raster }) {
  const { instancia, pagina, erros } = await novaPagina(navegador);
  const ms = await pagina.evaluate(async (usarRaster) => {
    const carregar = (c) => import(/* @vite-ignore */ c);
    const { criarCenaDescida } = await carregar('/src/ui/cenas/descida.ts');
    const { usarEspacoLogico } = await carregar('/src/platform/canvas.ts');
    const { precarregarAssetsParqueRaster, _esquecerAssetsParqueRasterParaTeste } = await carregar('/src/render/temas/catalogo.ts');
    if (usarRaster) await precarregarAssetsParqueRaster(document);
    else _esquecerAssetsParqueRasterParaTeste();

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d', { alpha: false });
    const cena = criarCenaDescida({ canvas, personagem: 'bia', pista: 'pico-do-picole' });
    for (let i = 0; i < 230; i += 1) cena.atualizar(); // posição "rampa" -- trilho + objetos em tela
    usarEspacoLogico(ctx);
    cena.desenhar(ctx, 0); // 1 quadro de aquecimento (JIT/cache), não entra na média

    // Pausado por `requestAnimationFrame`, igual ao loop real do jogo (main.ts) -- um `for` síncrono apertado
    // engana a medição (ver comentário no topo do arquivo).
    const tempos = [];
    await new Promise((resolve) => {
      let n = 0;
      function passo() {
        const t0 = performance.now();
        cena.desenhar(ctx, 0);
        tempos.push(performance.now() - t0);
        n += 1;
        if (n < 40) requestAnimationFrame(passo);
        else resolve(undefined);
      }
      requestAnimationFrame(passo);
    });
    return tempos.reduce((a, b) => a + b, 0) / tempos.length;
  }, raster);
  await instancia.close();
  return { ms, erros };
}

async function medirMemoria(navegador) {
  const { instancia, pagina, erros } = await novaPagina(navegador);
  const mb = await pagina.evaluate(async () => {
    const carregar = (c) => import(/* @vite-ignore */ c);
    const { precarregarAssetsParqueRaster, _dimensoesCacheParaTeste } = await carregar('/src/render/temas/catalogo.ts');
    await precarregarAssetsParqueRaster(document);
    const dimensoes = _dimensoesCacheParaTeste() ?? [];
    return dimensoes.reduce((soma, d) => soma + d.w * d.h * 4, 0) / (1024 * 1024);
  });
  await instancia.close();
  return { mb, erros };
}

async function rodar(nomeMotor, navegador) {
  const fallback = await provarFallback(navegador);
  const shots = await tirarScreenshots(navegador, nomeMotor);
  const raster = await medirQuadro(navegador, { raster: true });
  const vetorial = await medirQuadro(navegador, { raster: false });
  const memoria = await medirMemoria(navegador);

  const todosErros = [...fallback.erros, ...shots.erros, ...raster.erros, ...vetorial.erros, ...memoria.erros];
  console.log(`\n===== ${nomeMotor} =====`);
  console.log('erros de página:', todosErros.length, todosErros.slice(0, 5));
  console.log('cor do céu no fallback vetorial (prova que SEM asset cai pro parque.ts):', fallback.cor);
  console.log('ms/quadro: raster', raster.ms.toFixed(3), ' vetorial', vetorial.ms.toFixed(3));
  console.log('memória aprox. dos bitmaps do cenário raster (MB):', memoria.mb.toFixed(2));
  console.log('screenshots:', shots.caminhos);

  return { todosErros, fallback, raster, vetorial, memoria, shots };
}

await rodar('chromium', chromium);
await rodar('webkit', webkit);
console.log('\nMedição do piloto raster finalizada.');
