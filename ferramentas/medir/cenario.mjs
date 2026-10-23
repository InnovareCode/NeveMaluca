/**
 * MEDIÇÃO do cenário da Fase 2 no navegador de verdade (skill medir-antes-de-afirmar).
 */
import { chromium, webkit } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:5273';
const SAIDA = 'C:/Projetos/Web/InnoGames/NeveMaluca/arte-fonte/preview';

const PROVA = async (nome, navegador) => {
  const navegadorConectado = await navegador.launch();
  const ctx = await navegadorConectado.newContext({ viewport: { width: 1280, height: 720 } });
  const pagina = await ctx.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(String(e)));
  pagina.on('console', (m) => {
    if (m.type() === 'error') erros.push(`console: ${m.text()}`);
  });

  await pagina.goto(BASE, { waitUntil: 'load' });
  await pagina.waitForSelector('html[data-pronto="true"]', { timeout: 30000 });

  const leitura = await pagina.evaluate(async () => {
    const carregar = (caminho) => import(/* @vite-ignore */ caminho);
    const { criarCenaDescida } = await carregar('/src/ui/cenas/descida.ts');
    const { usarEspacoLogico } = await carregar('/src/platform/canvas.ts');

    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    canvas.id = 'medicao';
    canvas.style.cssText = 'position:fixed;left:0;top:0;width:960px;height:540px;z-index:9999';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('sem ctx');

    const cena = criarCenaDescida({ canvas });
    for (let i = 0; i < 150; i += 1) cena.atualizar(); // 2.5s: descida com terreno, piloto, araucárias, montanhas e spray
    usarEspacoLogico(ctx);
    cena.desenhar(ctx, 0);

    const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const faixas = { ceu: new Map(), meio: new Map(), chao: new Map() };
    for (let y = 0; y < canvas.height; y += 1) {
      const faixa = y < 160 ? 'ceu' : y < 340 ? 'meio' : 'chao';
      for (let x = 0; x < canvas.width; x += 1) {
        const i = (y * canvas.width + x) * 4;
        const hex = `#${[img[i], img[i + 1], img[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
        faixas[faixa].set(hex, (faixas[faixa].get(hex) ?? 0) + 1);
      }
    }
    const maisComuns = (m) =>
      [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([hex, n]) => ({ hex, n }));

    return {
      cores: { ceu: maisComuns(faixas.ceu), meio: maisComuns(faixas.meio), chao: maisComuns(faixas.chao) },
      todasCores: new Set([...faixas.ceu.keys(), ...faixas.meio.keys(), ...faixas.chao.keys()]),
      unicasTotal: new Set([...faixas.ceu.keys(), ...faixas.meio.keys(), ...faixas.chao.keys()]).size,
    };
  });

  mkdirSync(SAIDA, { recursive: true });
  const elemento = await pagina.$('#medicao');
  await elemento.screenshot({ path: `${SAIDA}/${nome}.png` });

  await navegadorConectado.close();

  const contem = (faixa, hex) => leitura.cores[faixa].some((c) => c.hex.toUpperCase() === hex.toUpperCase());
  console.log(`\n===== ${nome} =====`);
  console.log(`erros: ${erros.length}`);
  console.log(`cores únicas: ${leitura.unicasTotal}`);
  console.log('céu:', leitura.cores.ceu.slice(0, 8).map((c) => `${c.hex}:${c.n}`).join(' '));
  console.log('meio:', leitura.cores.meio.slice(0, 8).map((c) => `${c.hex}:${c.n}`).join(' '));
  console.log('chão:', leitura.cores.chao.slice(0, 8).map((c) => `${c.hex}:${c.n}`).join(' '));

  return { nome, leitura };
};

await PROVA('cenario-fase2-chromium', chromium);
await PROVA('cenario-fase2-webkit', webkit);
console.log('\nMedição finalizada com sucesso.');
