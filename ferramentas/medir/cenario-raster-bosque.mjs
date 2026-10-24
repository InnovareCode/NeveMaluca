/**
 * Prova no navegador (skill medir-antes-de-afirmar) da integração raster "Pixar" do Morro do Pinhão: screenshot de
 * uma descida real, prova do fallback vetorial (asset ausente) e checagem de erro de console. Lyra, 2026-10-23.
 * Script de uso único (não faz parte do `npm run verificar`); roda contra o dev server já de pé.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5273';
const SAIDA = 'C:/Projetos/Web/InnoGames/NeveMaluca/arte-fonte/preview/piloto-raster';

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
    const { _esquecerAssetsBosqueRasterParaTeste } = await carregar('/src/render/temas/catalogo.ts');
    _esquecerAssetsBosqueRasterParaTeste();

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d', { alpha: false });
    const cena = criarCenaDescida({ canvas, personagem: 'bia', pista: 'morro-do-pinhao' });
    for (let i = 0; i < 90; i += 1) cena.atualizar();
    usarEspacoLogico(ctx);
    cena.desenhar(ctx, 0);
    const px = ctx.getImageData(480, 150, 1, 1).data;
    return `#${[px[0], px[1], px[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  });
  await instancia.close();
  return { cor, erros };
}

async function tirarScreenshots() {
  const { instancia, pagina, erros } = await novaPagina();
  const shots = await pagina.evaluate(async () => {
    const carregar = (c) => import(/* @vite-ignore */ c);
    const { criarCenaDescida } = await carregar('/src/ui/cenas/descida.ts');
    const { usarEspacoLogico } = await carregar('/src/platform/canvas.ts');
    const { precarregarAssetsBosqueRaster } = await carregar('/src/render/temas/catalogo.ts');
    const ok = await precarregarAssetsBosqueRaster(document);
    if (!ok) throw new Error('assets raster do bosque não carregaram');

    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;
    const ctx = canvas.getContext('2d', { alpha: false });
    const cena = criarCenaDescida({ canvas, personagem: 'bia', pista: 'morro-do-pinhao' });
    await new Promise((r) => setTimeout(r, 300)); // sprite da Bia é fire-and-forget: cede controle antes do 1o desenhar

    const posicoes = { inicio: 40, meio: 260, trilho: 520, final: 780 };
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
    writeFileSync(`${SAIDA}/bosque-${nome}.png`, Buffer.from(base64, 'base64'));
  }
  await instancia.close();
  return { caminhos: Object.keys(shots).map((n) => `${SAIDA}/bosque-${n}.png`), erros };
}

const fallback = await provarFallback();
const shots = await tirarScreenshots();
const todosErros = [...fallback.erros, ...shots.erros];
console.log('erros de página:', todosErros.length, todosErros.slice(0, 5));
console.log('cor do céu no fallback vetorial (prova que SEM asset cai pro bosque.ts):', fallback.cor);
console.log('screenshots:', shots.caminhos);
