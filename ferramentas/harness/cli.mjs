#!/usr/bin/env node
/**
 * Harness da pista (plano §3.4/§7, M1a): `npm run harness -- [opções]`. Para cada semente, troca `DefPista.semente`
 * (o id/catálogo/tema continuam os da pista real) para gerar N layouts diferentes, desce cada um com o bot "cuidadoso"
 * (`src/descida/bot.ts`) e mede taxa de conclusão, tombos, ticks e checkpoints. Portão do plano: bot conclui 100% das
 * sementes sem travar. O timeout por rodada é generoso (não é o portão de duração 60-90 s do jogo real: aqui só
 * precisamos saber se a pista É vencível, não se está no tempo ideal).
 *
 *   --sementes N     quantas sementes testar (padrão 100)
 *   --base N         primeira semente (padrão 1; a semente real da pista publicada não é testada aqui de propósito)
 *   --pista <id>      qual `DefPista` de `src/data/` usar como base (padrão: a primeira pista de `PISTAS_DE_DADOS`)
 *   --max-ticks N    timeout por rodada, em ticks (padrão 10800 = 180 s)
 *
 * O TypeScript do repositório é carregado pelo Vite (modo SSR), o mesmo transformador do Vitest e do
 * `ferramentas/balanco` do InnoFighters (ver o cabeçalho de `ferramentas/balanco/cli.mjs` lá). Nada aqui grava no save
 * nem no disco do jogo; só lê `src/` em memória e imprime o relatório.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function lerArgumentos(argv) {
  const a = { sementes: 100, base: 1, pista: null, maxTicks: 10800 };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    const valor = () => argv[++i];
    if (t === '--sementes') a.sementes = Number(valor());
    else if (t === '--base') a.base = Number(valor());
    else if (t === '--pista') a.pista = valor();
    else if (t === '--max-ticks') a.maxTicks = Number(valor());
  }
  return a;
}

async function carregarModulos() {
  const server = await createServer({
    root: RAIZ,
    configFile: false,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const m = {
    data: await server.ssrLoadModule('/src/data/index.ts'),
    pista: await server.ssrLoadModule('/src/pista/index.ts'),
    descida: await server.ssrLoadModule('/src/descida/index.ts'),
  };
  return { server, m };
}

/** Desce UMA pista gerada com o bot até a chegada, o tombo-travado ou o timeout. */
function descerComBot(m, pistaGerada, maxTicks) {
  const motor = m.descida.criarDescida(pistaGerada);
  const bot = m.descida.criarBotCuidadoso(pistaGerada);
  let leitura = motor.leitura();
  let tombos = 0;
  for (let i = 0; i < maxTicks; i++) {
    const cmd = bot(leitura);
    leitura = motor.processar(cmd);
    for (const ev of leitura.eventos) if (ev.tipo === 'tombo') tombos++;
    if (leitura.fase === 'chegou') return { concluiu: true, ticks: leitura.tick, tombos, hash: motor.hashEstado() };
  }
  return { concluiu: false, ticks: leitura.tick, tombos, hash: motor.hashEstado() };
}

async function main() {
  const a = lerArgumentos(process.argv.slice(2));
  const { server, m } = await carregarModulos();
  try {
    const defBase = a.pista ? m.data.PISTAS_DE_DADOS.find((p) => p.id === a.pista) : m.data.PISTAS_DE_DADOS[0];
    if (!defBase) throw new Error(`pista não encontrada em PISTAS_DE_DADOS: ${a.pista ?? '(primeira)'}`);
    console.log(`Harness: pista base "${defBase.id}" (${defBase.comprimentoM} m), ${a.sementes} sementes a partir de ${a.base}, timeout ${a.maxTicks} ticks.`);

    const resultados = [];
    for (let s = 0; s < a.sementes; s++) {
      const semente = a.base + s;
      const def = { ...defBase, semente };
      const pistaGerada = m.pista.gerarPista(def);
      resultados.push({ semente, ...descerComBot(m, pistaGerada, a.maxTicks) });
    }

    const concluidas = resultados.filter((r) => r.concluiu);
    const taxa = (concluidas.length / resultados.length) * 100;
    const mediaTicks = concluidas.length > 0 ? concluidas.reduce((acc, r) => acc + r.ticks, 0) / concluidas.length : 0;
    const totalTombos = resultados.reduce((acc, r) => acc + r.tombos, 0);

    console.log(`Concluídas: ${concluidas.length}/${resultados.length} (${taxa.toFixed(1)}%).`);
    console.log(`Duração média (concluídas): ${mediaTicks.toFixed(0)} ticks (${(mediaTicks / 60).toFixed(1)} s).`);
    console.log(`Tombos somados (todas as rodadas): ${totalTombos}.`);
    const falhas = resultados.filter((r) => !r.concluiu);
    if (falhas.length > 0) {
      console.log(`NÃO concluíram (semente: ticks/tombos): ${falhas.map((r) => `${r.semente}: ${r.ticks}/${r.tombos}`).join(', ')}`);
    }

    // Hash da PISTA PUBLICADA (semente real, sem variação), útil para colar em `src/data/pistas.ts` (hashEsperado).
    const publicada = m.pista.gerarPista(defBase);
    console.log(`Hash da pista publicada "${defBase.id}" (semente ${defBase.semente}): ${publicada.hash}`);

    process.exitCode = falhas.length > 0 ? 1 : 0;
  } finally {
    await server.close();
  }
}

await main();
