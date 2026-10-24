/**
 * Prova no navegador (skill medir-antes-de-afirmar) do polimento "Pixar no gameplay" (corrida em campeonato,
 * reforço do dono 2026-10-24): TREINO e CAMPEONATO abertos DIRETO do menu (sem passar por `selecao-pista.ts`)
 * têm que mostrar o cenário raster "Pixar" o quanto antes -- e os nomes dos rivais agrupados no início da corrida
 * têm que ficar legíveis (sem texto empilhado/colado). Deixa o LAÇO REAL (`main.ts: laco.iniciar()`, já rodando
 * desde o boot) pintar os quadros -- nunca chama `cena.desenhar()` na mão (isso compete com o laço de verdade e
 * lê quadros que nem o jogador veria). Script de uso único (não faz parte do `npm run verificar`); roda contra o
 * dev server já de pé (`npm run dev`, porta 5273).
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5273';
const SAIDA = 'C:/Projetos/Web/InnoGames/NeveMaluca/arte-fonte/preview/pixar-gameplay';

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

function salvar(nome, dataUrl) {
  mkdirSync(SAIDA, { recursive: true });
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  writeFileSync(`${SAIDA}/${nome}.png`, Buffer.from(base64, 'base64'));
  return `${SAIDA}/${nome}.png`;
}

/** Troca de cena (como um clique real faria) e lê o canvas depois de N quadros do LAÇO REAL (nunca desenha na
 * mão): `esperarQuadros(1)` é o 1o quadro que o jogador realmente veria após o clique. */
async function trocarETirarFoto(pagina, { antes, depois, quadros }) {
  return pagina.evaluate(
    async ({ antes, depois, quadros }) => {
      const neve = window.__neve;
      if (antes) neve.cena.irPara(antes);
      if (antes && depois) await new Promise((r) => setTimeout(r, 0)); // deixa o clique "assentar" como um evento real faria
      if (depois) neve.cena.irPara(depois);
      const canvas = document.getElementById('jogo');
      for (let i = 0; i < quadros; i += 1) {
        await new Promise((r) => requestAnimationFrame(r));
      }
      return canvas.toDataURL('image/png');
    },
    { antes, depois, quadros }
  );
}

async function provarTreino() {
  const { instancia, pagina, erros } = await novaPagina();
  // Pior caso real: entra no menu e clica TREINO no quadro seguinte (sem ficar olhando o menu).
  const piorCaso = await trocarETirarFoto(pagina, { antes: 'menu', depois: 'jogo', quadros: 1 });
  await instancia.close();
  return { caminho: salvar('treino-pior-caso', piorCaso), erros };
}

async function provarTreinoComFolga() {
  const { instancia, pagina, erros } = await novaPagina();
  // Uso real: ~300ms olhando o menu (tempo de reação humana) antes de clicar TREINO.
  await pagina.evaluate(() => window.__neve.cena.irPara('menu'));
  await pagina.waitForTimeout(300);
  const dataUrl = await trocarETirarFoto(pagina, { antes: null, depois: 'jogo', quadros: 1 });
  await instancia.close();
  return { caminho: salvar('treino-300ms-de-folga', dataUrl), erros };
}

async function provarCampeonato() {
  const { instancia, pagina, erros } = await novaPagina();
  const dataUrl = await trocarETirarFoto(pagina, { antes: 'menu', depois: 'campeonato', quadros: 1 });
  await instancia.close();
  return { caminho: salvar('campeonato-pior-caso', dataUrl), erros };
}

/** Pelotão agrupado no início da corrida (todos juntos, saindo da contagem): nomes dos rivais têm que ficar
 * legíveis (sem texto colado/empilhado) -- a mudança foi em `render/rivais.ts`. */
async function provarRivaisAgrupados() {
  const { instancia, pagina, erros } = await novaPagina();
  const dataUrl = await pagina.evaluate(async () => {
    window.__neve.cena.irPara('campeonato');
    await new Promise((r) => setTimeout(r, 4200)); // contagem (3s) + ~1s de corrida, pelotão ainda junto
    return document.getElementById('jogo').toDataURL('image/png');
  });
  await instancia.close();
  return { caminho: salvar('corrida-pelotao-agrupado', dataUrl), erros };
}

const treino = await provarTreino();
const treinoComFolga = await provarTreinoComFolga();
const campeonato = await provarCampeonato();
const rivais = await provarRivaisAgrupados();
const todosErros = [...treino.erros, ...treinoComFolga.erros, ...campeonato.erros, ...rivais.erros];
console.log('erros de página:', todosErros.length, todosErros.slice(0, 10));
console.log('treino (pior caso -- clica no quadro seguinte ao entrar no menu):', treino.caminho);
console.log('treino (300ms de folga no menu -- uso real):', treinoComFolga.caminho);
console.log('campeonato (pior caso):', campeonato.caminho);
console.log('corrida, pelotão agrupado (contagem + ~1,2s de corrida):', rivais.caminho);
