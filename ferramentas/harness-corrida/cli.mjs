#!/usr/bin/env node
/**
 * Harness da corrida (plano `docs/plano-corrida-campeonato.md`, C2a "prova fora do `verificar`"): roda uma
 * corrida de 6 (cada um dos personagens do elenco, uma vez como "jogador" dirigido pelo bot cuidadoso, os outros 5
 * como rivais de IA — `corrida/ia.ts`) em cada uma das 5 pistas OFICIAIS (layout fixo: provar o terreno não é
 * escopo daqui), repetindo por N sementes de CORRIDA. Confere:
 *
 *   1. os 6 participantes chegam em toda combinação jogador x pista x semente (inclusive o caso que travava antes
 *      da trava existir: Beto, manobreiro ousadia 2, no Vulcão Pé-Gelado);
 *   2. determinismo: repetir a MESMA combinação dá exatamente o mesmo `ResultadoCorrida`.
 *
 *   --sementes N   quantas sementes de corrida por combinação jogador x pista (padrão 10)
 *   --base N       primeira semente de corrida (padrão 1)
 *   --max-ticks N  teto de ticks do jogador (padrão 16200, igual ao golden do F0)
 *
 * Mesmo padrão de `ferramentas/harness/cli.mjs`: carrega `src/` via Vite SSR, não grava nada no disco do jogo.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function lerArgumentos(argv) {
  const a = { sementes: 10, base: 1, maxTicks: 16200 };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    const valor = () => argv[++i];
    if (t === '--sementes') a.sementes = Number(valor());
    else if (t === '--base') a.base = Number(valor());
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
    corrida: await server.ssrLoadModule('/src/corrida/index.ts'),
  };
  return { server, m };
}

function montarParticipantes(m, idJogador) {
  return m.data.PERSONAGENS_DE_DADOS.map((def) => ({
    id: def.id,
    config: def,
    piloto: def.id === idJogador ? { tipo: 'jogador' } : { tipo: 'ia', perfil: def.id, nivel: 0 },
  }));
}

/** Roda UMA corrida inteira: jogador dirigido pelo bot cuidadoso até chegar (ou até o teto); depois `finalizar()`. */
function rodarCorrida(m, pistaGerada, sementeDaCorrida, idJogador, maxTicks) {
  const corrida = m.corrida.criarCorrida({ pista: pistaGerada, semente: sementeDaCorrida, participantes: montarParticipantes(m, idJogador) });
  const bot = m.descida.criarBotCuidadoso(pistaGerada);
  let leitura = corrida.leitura();
  for (let i = 0; i < maxTicks && leitura.jogador.fase !== 'chegou'; i++) {
    leitura = corrida.processar(bot(leitura.jogador));
  }
  const jogadorChegou = leitura.jogador.fase === 'chegou';
  const resultado = corrida.finalizar();
  return { jogadorChegou, resultado };
}

async function main() {
  const a = lerArgumentos(process.argv.slice(2));
  const { server, m } = await carregarModulos();
  try {
    const personagens = m.data.PERSONAGENS_DE_DADOS.map((d) => d.id);
    const pistasOficiais = m.data.PISTAS_DE_DADOS.map((def) => ({ id: def.id, gerada: m.pista.gerarPista(def) }));
    console.log(`Harness da corrida: ${personagens.length} personagens x ${pistasOficiais.length} pistas oficiais x ${a.sementes} sementes de corrida (base ${a.base}).`);

    const falhas = [];
    let combinacoes = 0;
    for (const idJogador of personagens) {
      for (const { id: idPista, gerada } of pistasOficiais) {
        for (let s = 0; s < a.sementes; s++) {
          const semente = a.base + s;
          combinacoes++;
          const { jogadorChegou, resultado } = rodarCorrida(m, gerada, semente, idJogador, a.maxTicks);
          const seisChegaram = resultado.ordem.length === personagens.length && new Set(resultado.ordem).size === personagens.length;
          if (!jogadorChegou || !seisChegaram) {
            falhas.push({ idJogador, idPista, semente, jogadorChegou, ordemLength: resultado.ordem.length });
          }
        }
      }
    }

    console.log(`Combinações testadas: ${combinacoes}. Falhas: ${falhas.length}.`);
    for (const f of falhas) console.log(`  FALHOU jogador=${f.idJogador} pista=${f.idPista} semente=${f.semente} jogadorChegou=${f.jogadorChegou} chegaram=${f.ordemLength}/${personagens.length}`);

    // Determinismo: repete uma combinação (o caso que travava antes: Beto no Vulcão) e confere resultado IDÊNTICO.
    const vulcao = pistasOficiais.find((p) => p.id === 'vulcao-pe-gelado');
    const r1 = rodarCorrida(m, vulcao.gerada, 1, 'beto', a.maxTicks);
    const r2 = rodarCorrida(m, vulcao.gerada, 1, 'beto', a.maxTicks);
    const determinístico = JSON.stringify(r1.resultado) === JSON.stringify(r2.resultado);
    console.log(`Determinismo (beto, vulcao-pe-gelado, semente 1, repetido): ${determinístico ? 'OK' : 'DIVERGIU'}.`);
    if (!determinístico) falhas.push({ determinismo: false });

    process.exitCode = falhas.length > 0 ? 1 : 0;
  } finally {
    await server.close();
  }
}

await main();
