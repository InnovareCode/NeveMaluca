/**
 * Prova no navegador (skill medir-antes-de-afirmar) da integração raster "Pixar" do Cume da Ventania: screenshot
 * de uma descida real, prova do fallback vetorial (asset ausente) e, por chamada DIRETA (`PistaGerada` fabricada
 * à mão), prova da biruta na crista da SUBIDA, da parede de fenda na QUEDA, do trilho "corda" ladrilhado (altura
 * < 1 m) e do trilho "cabo de teleférico" por código (altura >= 1 m) -- ver memória
 * `pintor-raster-objetos-raros-provar-com-chamada-direta` (não dá pra confiar na RNG de uma descida real pra esses
 * trechos aparecerem perto da câmera). Lyra, 2026-10-24. Script de uso único (não faz parte do `npm run verificar`);
 * roda contra o dev server já de pé (`npm run dev`).
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5273';
const SAIDA = 'C:/Projetos/Web/InnoGames/NeveMaluca/arte-fonte/preview/cume-raster';

async function novaPagina() {
  const instancia = await chromium.launch();
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

async function provarFallback() {
  const { instancia, pagina, erros } = await novaPagina();
  const cor = await pagina.evaluate(async () => {
    const carregar = (c) => import(/* @vite-ignore */ c);
    const { criarCenaDescida } = await carregar('/src/ui/cenas/descida.ts');
    const { usarEspacoLogico } = await carregar('/src/platform/canvas.ts');
    const { _esquecerAssetsCumeRasterParaTeste } = await carregar('/src/render/temas/catalogo.ts');
    _esquecerAssetsCumeRasterParaTeste();

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d', { alpha: false });
    const cena = criarCenaDescida({ canvas, personagem: 'bia', pista: 'cume-da-ventania' });
    for (let i = 0; i < 90; i += 1) cena.atualizar();
    usarEspacoLogico(ctx);
    cena.desenhar(ctx, 0);
    const px = ctx.getImageData(480, 150, 1, 1).data;
    return `#${[px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  });
  await instancia.close();
  return { cor, erros };
}

async function tirarScreenshotsDescida() {
  const { instancia, pagina, erros } = await novaPagina();
  const shots = await pagina.evaluate(async () => {
    const carregar = (c) => import(/* @vite-ignore */ c);
    const { criarCenaDescida } = await carregar('/src/ui/cenas/descida.ts');
    const { usarEspacoLogico } = await carregar('/src/platform/canvas.ts');
    const { precarregarAssetsCumeRaster } = await carregar('/src/render/temas/catalogo.ts');
    const ok = await precarregarAssetsCumeRaster(document);
    if (!ok) throw new Error('assets raster do cume não carregaram');

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d', { alpha: false });
    const cena = criarCenaDescida({ canvas, personagem: 'bia', pista: 'cume-da-ventania' });
    await new Promise((r) => setTimeout(r, 300)); // sprite da Bia é fire-and-forget: cede controle antes do 1o desenhar

    const posicoes = { inicio: 40, meio: 300, final: 700 };
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
    writeFileSync(`${SAIDA}/cume-${nome}.png`, Buffer.from(base64, 'base64'));
  }
  await instancia.close();
  return { caminhos: Object.keys(shots).map((n) => `${SAIDA}/cume-${n}.png`), erros };
}

/** PistaGerada fabricada à mão (memória `pintor-raster-objetos-raros-provar-com-chamada-direta`): garante SUBIDA
 * (biruta na crista), QUEDA (parede de fenda) e os DOIS trilhos (corda < 1 m, cabo >= 1 m), sem depender da RNG. */
async function provarFeicoesETrilhos() {
  const { instancia, pagina, erros } = await novaPagina();
  const shots = await pagina.evaluate(async () => {
    const carregar = (c) => import(/* @vite-ignore */ c);
    const { precarregarAssetsCumeRaster } = await carregar('/src/render/temas/catalogo.ts');
    const { pintorCumeRaster } = await carregar('/src/render/temas/cume-raster.ts');
    const { desenharTerreno, alturaDoTerreno } = await carregar('/src/render/terreno.ts');
    const { usarEspacoLogico } = await carregar('/src/platform/canvas.ts');
    const ok = await precarregarAssetsCumeRaster(document);
    if (!ok) throw new Error('assets raster do cume não carregaram');

    const dx = 0.5;
    const n = 400;
    const alturas = new Float64Array(n);
    let h = 60;
    for (let i = 0; i < n; i += 1) {
      if (i >= 40 && i < 60) h += 0.2; // SUBIDA ~21,8° (tan=0,4), 20 amostras = 10 m de rampa
      else if (i >= 120 && i < 132) h -= 0.42; // QUEDA ~40°, 12 amostras = 6 m
      else h -= 0.02; // leve declive geral (descida normal)
      alturas[i] = h;
    }
    const pista = {
      id: 'cume-da-ventania',
      semente: 1,
      versaoGerador: 'prova-direta',
      dx,
      alturas,
      objetos: [],
      trilhos: [
        { x0: 70, x1: 83, altura: 0.5 }, // corda (< 1 m)
        { x0: 140, x1: 174, altura: 1.3 }, // cabo de teleférico (>= 1 m)
      ],
    };

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d', { alpha: false });

    const resultado = {};
    const capturar = (nome, camera, indiceTrilho) => {
      usarEspacoLogico(ctx);
      ctx.fillStyle = '#0C1230';
      ctx.fillRect(0, 0, 960, 540);
      desenharTerreno(ctx, pista, camera, pintorCumeRaster);
      if (indiceTrilho !== null) pintorCumeRaster.desenharTrilho(ctx, pista.trilhos[indiceTrilho], pista, camera);
      resultado[nome] = canvas.toDataURL('image/png');
    };

    const camaraEm = (xm, zoom) => ({ x: xm, y: alturaDoTerreno(pista, xm), zoom, tremidaX: 0, tremidaY: 0 });
    capturar('subida-biruta', camaraEm(25, 0.55), null);
    capturar('queda-fenda', camaraEm(63, 0.55), null);
    capturar('trilho-corda', camaraEm(76, 0.55), 0);
    capturar('trilho-cabo', camaraEm(157, 0.4), 1);

    return resultado;
  });

  mkdirSync(SAIDA, { recursive: true });
  for (const [nome, dataUrl] of Object.entries(shots)) {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    writeFileSync(`${SAIDA}/cume-${nome}.png`, Buffer.from(base64, 'base64'));
  }
  await instancia.close();
  return { caminhos: Object.keys(shots).map((n) => `${SAIDA}/cume-${n}.png`), erros };
}

const fallback = await provarFallback();
const descida = await tirarScreenshotsDescida();
const feicoes = await provarFeicoesETrilhos();
const todosErros = [...fallback.erros, ...descida.erros, ...feicoes.erros];
console.log('erros de página:', todosErros.length, todosErros.slice(0, 5));
console.log('cor do céu no fallback vetorial (prova que SEM asset cai pro cume.ts):', fallback.cor);
console.log('screenshots da descida:', descida.caminhos);
console.log('screenshots de feição/trilhos (chamada direta):', feicoes.caminhos);
