/**
 * Prova no navegador (skill medir-antes-de-afirmar) da integração raster "Pixar" do Vulcão Pé-Gelado: screenshot
 * de uma descida real, prova do fallback vetorial (asset ausente) e, por chamada DIRETA (`PistaGerada` fabricada
 * à mão), prova do contorno triplo (aro frio + aro quente) sobre a colina escura, da baforada na crista da SUBIDA,
 * da parede de basalto na QUEDA e do trilho (ponte de basalto) ladrilhado com pilares de altura explícita -- ver
 * memória `pintor-raster-objetos-raros-provar-com-chamada-direta` (não dá pra confiar na RNG de uma descida real
 * pra esses trechos aparecerem perto da câmera). Lyra, 2026-10-24. Script de uso único (não faz parte do
 * `npm run verificar`); roda contra o dev server já de pé (`npm run dev`).
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5273';
const SAIDA = 'C:/Projetos/Web/InnoGames/NeveMaluca/arte-fonte/preview/vulcao-raster';

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
    const { _esquecerAssetsVulcaoRasterParaTeste } = await carregar('/src/render/temas/catalogo.ts');
    _esquecerAssetsVulcaoRasterParaTeste();

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d', { alpha: false });
    const cena = criarCenaDescida({ canvas, personagem: 'bia', pista: 'vulcao-pe-gelado' });
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
    const { precarregarAssetsVulcaoRaster } = await carregar('/src/render/temas/catalogo.ts');
    const ok = await precarregarAssetsVulcaoRaster(document);
    if (!ok) throw new Error('assets raster do vulcão não carregaram');

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d', { alpha: false });
    const cena = criarCenaDescida({ canvas, personagem: 'bia', pista: 'vulcao-pe-gelado' });
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
    writeFileSync(`${SAIDA}/vulcao-${nome}.png`, Buffer.from(base64, 'base64'));
  }
  await instancia.close();
  return { caminhos: Object.keys(shots).map((n) => `${SAIDA}/vulcao-${n}.png`), erros };
}

/** PistaGerada fabricada à mão (memória `pintor-raster-objetos-raros-provar-com-chamada-direta`): garante SUBIDA
 * (baforada na crista), QUEDA (parede de basalto) e um trilho (ponte de basalto), sem depender da RNG do gerador. */
async function provarFeicoesETrilho() {
  const { instancia, pagina, erros } = await novaPagina();
  const shots = await pagina.evaluate(async () => {
    const carregar = (c) => import(/* @vite-ignore */ c);
    const { precarregarAssetsVulcaoRaster } = await carregar('/src/render/temas/catalogo.ts');
    const { pintorVulcaoRaster } = await carregar('/src/render/temas/vulcao-raster.ts');
    const { desenharTerreno, alturaDoTerreno } = await carregar('/src/render/terreno.ts');
    const { usarEspacoLogico } = await carregar('/src/platform/canvas.ts');
    const ok = await precarregarAssetsVulcaoRaster(document);
    if (!ok) throw new Error('assets raster do vulcão não carregaram');

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
      id: 'vulcao-pe-gelado',
      semente: 1,
      versaoGerador: 'prova-direta',
      dx,
      alturas,
      objetos: [],
      trilhos: [{ x0: 70, x1: 95, altura: 1.6 }],
    };

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d', { alpha: false });

    const resultado = {};
    const capturar = (nome, camera, comTrilho) => {
      usarEspacoLogico(ctx);
      ctx.fillStyle = '#1F2A55';
      ctx.fillRect(0, 0, 960, 540);
      desenharTerreno(ctx, pista, camera, pintorVulcaoRaster);
      if (comTrilho) pintorVulcaoRaster.desenharTrilho(ctx, pista.trilhos[0], pista, camera);
      resultado[nome] = canvas.toDataURL('image/png');
    };

    const camaraEm = (xm, zoom) => ({ x: xm, y: alturaDoTerreno(pista, xm), zoom, tremidaX: 0, tremidaY: 0 });
    capturar('subida-baforada', camaraEm(25, 0.55), false);
    capturar('queda-basalto', camaraEm(63, 0.55), false);
    capturar('trilho-ponte', camaraEm(82, 0.55), true);

    return resultado;
  });

  mkdirSync(SAIDA, { recursive: true });
  for (const [nome, dataUrl] of Object.entries(shots)) {
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    writeFileSync(`${SAIDA}/vulcao-${nome}.png`, Buffer.from(base64, 'base64'));
  }
  await instancia.close();
  return { caminhos: Object.keys(shots).map((n) => `${SAIDA}/vulcao-${n}.png`), erros };
}

/** Objeto isolado perto da câmera, pra conferir o contorno TRIPLO (aro frio + aro quente) sobre fundo escuro --
 * sem depender da colina atrás (prova direta, mesma técnica das demais). */
async function provarContornoTriplo() {
  const { instancia, pagina, erros } = await novaPagina();
  const shots = await pagina.evaluate(async () => {
    const carregar = (c) => import(/* @vite-ignore */ c);
    const { precarregarAssetsVulcaoRaster } = await carregar('/src/render/temas/catalogo.ts');
    const { pintorVulcaoRaster } = await carregar('/src/render/temas/vulcao-raster.ts');
    const { usarEspacoLogico } = await carregar('/src/platform/canvas.ts');
    const ok = await precarregarAssetsVulcaoRaster(document);
    if (!ok) throw new Error('assets raster do vulcão não carregaram');

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d', { alpha: false });
    usarEspacoLogico(ctx);
    ctx.fillStyle = '#2A2638'; // colina escura do Vulcão, o caso mais crítico (ficha §6.8)
    ctx.fillRect(0, 0, 960, 540);
    pintorVulcaoRaster.desenharObjeto(ctx, { tipo: 'pedra', x: 0, largura: 1.3, altura: 1.0, variante: 0 }, 480, 400, 60);
    return { contorno: canvas.toDataURL('image/png') };
  });

  mkdirSync(SAIDA, { recursive: true });
  const base64 = shots.contorno.replace(/^data:image\/png;base64,/, '');
  writeFileSync(`${SAIDA}/vulcao-contorno-triplo.png`, Buffer.from(base64, 'base64'));
  await instancia.close();
  return { caminho: `${SAIDA}/vulcao-contorno-triplo.png`, erros };
}

const fallback = await provarFallback();
const descida = await tirarScreenshotsDescida();
const feicoes = await provarFeicoesETrilho();
const contorno = await provarContornoTriplo();
const todosErros = [...fallback.erros, ...descida.erros, ...feicoes.erros, ...contorno.erros];
console.log('erros de página:', todosErros.length, todosErros.slice(0, 5));
console.log('cor do céu no fallback vetorial (prova que SEM asset cai pro vulcao.ts):', fallback.cor);
console.log('screenshots da descida:', descida.caminhos);
console.log('screenshots de feição/trilho (chamada direta):', feicoes.caminhos);
console.log('screenshot do contorno triplo sobre colina escura:', contorno.caminho);
