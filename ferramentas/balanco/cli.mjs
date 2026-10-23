#!/usr/bin/env node
/**
 * Harness de BALANÇO do elenco (plano M3 §A.4, F2): `npm run balanco -- [opções]`. Para cada um dos 6 personagens,
 * roda a `ConfigDescida` dele (`descida.configDoPersonagem`) com o bot "manobreiro" (`descida.criarBotManobreiro`,
 * que lê a PRÓPRIA física pra decidir quantas voltas arrisca) em N sementes diferentes da pista base (mesmo
 * catálogo/tema, só a semente do layout muda — mesmo espírito do `ferramentas/harness/cli.mjs`), em cada um dos
 * níveis de ousadia pedidos, e conta o MELHOR resultado entre eles (plano: "tem 2 ou 3 níveis de ousadia, e conta o
 * melhor deles" — mitiga o risco de um nível só privilegiar um personagem por acaso).
 *
 * Portão do plano (D5, G3): por pista e no agregado, pontos médios do manobreiro de cada personagem a até ±10% da
 * MEDIANA do elenco (mediana das médias dos 6, não a média pontual de uma corrida). Quem decide se um desvio > 10%
 * é motivo pra mexer em algum `MAPA_ATRIBUTOS` (ou escopo da Íris) é o Atlas/dono — este script só MEDE e APONTA o
 * atributo mais provável, nunca edita `src/descida/atributos.ts`.
 *
 *   --sementes N      quantas sementes de layout testar por personagem (padrão 20)
 *   --base N          primeira semente (padrão 1; igual ao harness de pista, não usa a semente real publicada)
 *   --pista <id>      qual `DefPista` de `src/data/` usar como base (padrão: a primeira de `PISTAS_DE_DADOS`)
 *   --max-ticks N     timeout por corrida, em ticks (padrão 16200 = 270 s, igual ao golden do F0)
 *   --ousadias "0,1,2" níveis do bot manobreiro testados; conta o melhor por (personagem, semente)
 *   --out <arquivo>   onde grava o relatório versionado (padrão docs/balanco-m3.md; "" não grava nada)
 *
 * Carregado via Vite (modo SSR), igual ao `ferramentas/harness/cli.mjs`: nada aqui grava no save do jogo, só lê
 * `src/` em memória e imprime/grava o relatório.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function lerArgumentos(argv) {
  const a = { sementes: 20, base: 1, pista: null, maxTicks: 16200, ousadias: [0, 1, 2], out: 'docs/balanco-m3.md' };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    const valor = () => argv[++i];
    if (t === '--sementes') a.sementes = Number(valor());
    else if (t === '--base') a.base = Number(valor());
    else if (t === '--pista') a.pista = valor();
    else if (t === '--max-ticks') a.maxTicks = Number(valor());
    else if (t === '--ousadias') a.ousadias = valor().split(',').map(Number);
    else if (t === '--out') a.out = valor();
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

/** Desce UMA pista gerada com o bot manobreiro num nível de ousadia, até a chegada ou o timeout. */
function descerComManobreiro(m, pistaGerada, config, ousadia, maxTicks) {
  const motor = m.descida.criarDescida(pistaGerada, config);
  const bot = m.descida.criarBotManobreiro(pistaGerada, config, { ousadia });
  let leitura = motor.leitura();
  let tombos = 0;
  for (let i = 0; i < maxTicks; i++) {
    const cmd = bot(leitura);
    leitura = motor.processar(cmd);
    for (const ev of leitura.eventos) if (ev.tipo === 'tombo') tombos++;
    if (leitura.fase === 'chegou') return { concluiu: true, ticks: leitura.tick, pontos: leitura.pontos, tombos };
  }
  return { concluiu: false, ticks: leitura.tick, pontos: leitura.pontos, tombos };
}

function media(xs) {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
function mediana(xs) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const meio = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[meio - 1] + s[meio]) / 2 : s[meio];
}
function percentil(xs, p) {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[idx];
}

/** Atributo do personagem que mais se desvia do da Capi (heurística de "provável causador" — nunca prova causa). */
function atributoMaisDesviante(defPersonagem, defCapi) {
  let piorAtributo = null;
  let piorDiff = -1;
  for (const atributo of Object.keys(defPersonagem.atributos)) {
    const diff = Math.abs(defPersonagem.atributos[atributo] - defCapi.atributos[atributo]);
    if (diff > piorDiff) {
      piorDiff = diff;
      piorAtributo = atributo;
    }
  }
  return { atributo: piorAtributo, diferenca: piorDiff };
}

/**
 * Caso especial: quando a PRÓPRIA Capi é a outlier, "o atributo em que ela mais se desvia dela mesma" não faz
 * sentido (diferença sempre 0). O que importa aí é achar um atributo em que TODOS os outros 5 estejam do MESMO
 * lado dela (todos maiores, ou todos menores) — um desnível estrutural do elenco inteiro contra/a favor da
 * referência, não um acaso de um personagem só. Devolve o de maior "garantia" (a menor vantagem entre os 5, para
 * não acusar um atributo que só é vantajoso por 1 personagem perto do zero).
 */
function atributoUniformeContraCapi(capi, elenco) {
  const outros = elenco.filter((p) => p.id !== capi.id);
  let melhor = null;
  for (const atributo of Object.keys(capi.atributos)) {
    const diffs = outros.map((p) => p.atributos[atributo] - capi.atributos[atributo]);
    const mesmoSentido = diffs.every((d) => d > 0) || diffs.every((d) => d < 0);
    if (!mesmoSentido) continue;
    const garantia = Math.min(...diffs.map((d) => Math.abs(d)));
    if (melhor === null || garantia > melhor.garantia) melhor = { atributo, garantia, sentido: diffs[0] > 0 ? 'maior' : 'menor' };
  }
  return melhor;
}

async function main() {
  const a = lerArgumentos(process.argv.slice(2));
  const { server, m } = await carregarModulos();
  try {
    const defBase = a.pista ? m.data.PISTAS_DE_DADOS.find((p) => p.id === a.pista) : m.data.PISTAS_DE_DADOS[0];
    if (!defBase) throw new Error(`pista não encontrada em PISTAS_DE_DADOS: ${a.pista ?? '(primeira)'}`);
    const capi = m.data.PERSONAGENS_DE_DADOS.find((p) => p.id === m.descida.PERSONAGEM_REFERENCIA);
    if (!capi) throw new Error('referência (capi) não encontrada em PERSONAGENS_DE_DADOS');

    console.log(`Balanço M3: pista "${defBase.id}" (${defBase.comprimentoM} m), ${a.sementes} sementes a partir de ${a.base}, ousadias [${a.ousadias.join(', ')}], timeout ${a.maxTicks} ticks.`);

    const linhas = [];
    for (const def of m.data.PERSONAGENS_DE_DADOS) {
      const config = m.descida.configDoPersonagem(def.id);
      const pontosConcluidos = [];
      const falhas = [];
      for (let s = 0; s < a.sementes; s++) {
        const semente = a.base + s;
        const pistaGerada = m.pista.gerarPista({ ...defBase, semente });
        let melhor = null;
        for (const ousadia of a.ousadias) {
          const r = descerComManobreiro(m, pistaGerada, config, ousadia, a.maxTicks);
          if (r.concluiu && (melhor === null || r.pontos > melhor)) melhor = r.pontos;
        }
        if (melhor === null) falhas.push(semente);
        else pontosConcluidos.push(melhor);
      }
      linhas.push({
        id: def.id,
        nome: def.nome,
        taxaConclusao: (pontosConcluidos.length / a.sementes) * 100,
        falhas,
        media: media(pontosConcluidos),
        p50: mediana(pontosConcluidos),
        p90: percentil(pontosConcluidos, 90),
        min: pontosConcluidos.length > 0 ? Math.min(...pontosConcluidos) : 0,
        max: pontosConcluidos.length > 0 ? Math.max(...pontosConcluidos) : 0,
        amostras: pontosConcluidos.length,
      });
    }

    const medianaDoElenco = mediana(linhas.map((l) => l.media));
    for (const l of linhas) {
      l.desvioPct = medianaDoElenco === 0 ? 0 : ((l.media - medianaDoElenco) / medianaDoElenco) * 100;
      l.foraDoCriterio = Math.abs(l.desvioPct) > 10;
      const def = m.data.PERSONAGENS_DE_DADOS.find((p) => p.id === l.id);
      l.causadorProvavel = l.id === capi.id ? null : atributoMaisDesviante(def, capi);
    }
    const causaDoDesvioDaCapi = atributoUniformeContraCapi(capi, m.data.PERSONAGENS_DE_DADOS);

    console.log('');
    console.log('personagem        | conclui% | média    | p50      | p90      | min..max          | desvio vs mediana | status');
    console.log('-------------------|----------|----------|----------|----------|-------------------|--------------------|-------');
    for (const l of linhas) {
      const faixa = `${l.min.toFixed(0)}..${l.max.toFixed(0)}`;
      const status = l.amostras === 0 ? 'SEM DADOS' : l.foraDoCriterio ? 'FORA (>10%)' : 'ok';
      const desvioTxt = `${l.desvioPct >= 0 ? '+' : ''}${l.desvioPct.toFixed(1)}%`;
      console.log(
        `${l.nome.padEnd(18)} | ${`${l.taxaConclusao.toFixed(0)}%`.padStart(7)} | ${l.media.toFixed(0).padStart(8)} | ${l.p50.toFixed(0).padStart(8)} | ${l.p90.toFixed(0).padStart(8)} | ${faixa.padEnd(17)} | ${desvioTxt.padStart(18)} | ${status}`,
      );
    }
    console.log('');
    console.log(`Mediana do elenco (médias dos 6): ${medianaDoElenco.toFixed(0)} pontos.`);
    for (const l of linhas) {
      if (l.falhas.length > 0) console.log(`  aviso: ${l.nome} não concluiu nas sementes ${l.falhas.join(', ')} (nenhuma ousadia).`);
    }

    /** Texto da "causa provável" de UM personagem fora do critério — nunca prova causa, só aponta candidato. */
    function explicarDesvio(l) {
      const sentido = l.desvioPct > 0 ? 'ACIMA' : 'ABAIXO';
      const base = `${l.nome} (${l.id}): ${sentido} em ${Math.abs(l.desvioPct).toFixed(1)}% (média ${l.media.toFixed(0)} vs mediana ${medianaDoElenco.toFixed(0)}).`;
      if (l.id === capi.id) {
        if (causaDoDesvioDaCapi === null) {
          return `${base} Nenhum atributo isolado explica (a Capi é a referência): o desvio vem de combinação de atributos, não de um só. A Capi NUNCA é ajustada — se for mexer, é no ganho do(s) atributo(s) suspeito(s) dos outros.`;
        }
        return (
          `${base} TODOS os outros 5 têm "${causaDoDesvioDaCapi.atributo}" ${causaDoDesvioDaCapi.sentido} que a Capi (vantagem mínima garantida: ${causaDoDesvioDaCapi.garantia} pontos de ficha) — ` +
          `desnível estrutural do elenco inteiro, coerente com o plano M3 §A.1 ("a Capi é a de iniciante"). A Capi NUNCA é ajustada: o candidato a mexer é o ganho de "${causaDoDesvioDaCapi.atributo}" em MAPA_ATRIBUTOS (encolhe a vantagem dos outros 5 por igual).`
        );
      }
      return (
        `${base} Atributo mais desviante da Capi: "${l.causadorProvavel.atributo}" (diferença de ${l.causadorProvavel.diferenca} pontos de ficha) — ` +
        `candidato a levar o ajuste de ganho em MAPA_ATRIBUTOS (nunca a Capi).`
      );
    }

    const foraDoCriterio = linhas.filter((l) => l.foraDoCriterio);
    const semDados = linhas.filter((l) => l.amostras === 0);
    console.log('');
    if (semDados.length > 0) {
      console.log(`VEREDITO: SEM DADOS para ${semDados.map((l) => l.nome).join(', ')} — nenhuma semente concluiu (G1 falharia antes do G3; investigar física/pista, não o ganho).`);
    } else if (foraDoCriterio.length === 0) {
      console.log(`VEREDITO: BALANCEADO pelo critério D5 — todos os 6 personagens dentro de ±10% da mediana do elenco (${medianaDoElenco.toFixed(0)} pontos).`);
    } else {
      console.log('VEREDITO: FORA DO BALANÇO (D5) —');
      for (const l of foraDoCriterio) console.log(`  - ${explicarDesvio(l)}`);
    }

    if (a.out) {
      const dataIso = new Date().toISOString().slice(0, 10);
      const ganhos = Object.entries(m.descida.MAPA_ATRIBUTOS)
        .map(([atributo, regras]) => `  - ${atributo}: ${regras.map((r) => `${r.campo} (sentido ${r.sentido}, ganho ${r.ganho})`).join('; ')}`)
        .join('\n');
      const tabelaMd = [
        '| personagem | conclui% | média | p50 | p90 | min..max | desvio vs mediana | status |',
        '|---|---|---|---|---|---|---|---|',
        ...linhas.map(
          (l) =>
            `| ${l.nome} | ${l.taxaConclusao.toFixed(0)}% | ${l.media.toFixed(0)} | ${l.p50.toFixed(0)} | ${l.p90.toFixed(0)} | ${l.min.toFixed(0)}..${l.max.toFixed(0)} | ${(l.desvioPct >= 0 ? '+' : '') + l.desvioPct.toFixed(1)}% | ${l.amostras === 0 ? 'SEM DADOS' : l.foraDoCriterio ? 'FORA (>10%)' : 'ok'} |`,
        ),
      ].join('\n');
      const veredito =
        semDados.length > 0
          ? `SEM DADOS para ${semDados.map((l) => l.nome).join(', ')}.`
          : foraDoCriterio.length === 0
            ? `BALANCEADO — todos dentro de ±10% da mediana (${medianaDoElenco.toFixed(0)} pontos).`
            : foraDoCriterio.map((l) => explicarDesvio(l)).join(' ');
      const secao = `\n## Rodada ${dataIso} — pista "${defBase.id}", ${a.sementes} sementes (base ${a.base}), ousadias [${a.ousadias.join(', ')}], mediana do elenco ${medianaDoElenco.toFixed(0)} pontos\n\n${tabelaMd}\n\n**Veredito D5 (±10% da mediana):** ${veredito}\n\n**Ganhos em vigor (\`MAPA_ATRIBUTOS\`, \`src/descida/atributos.ts\`) nesta rodada:**\n${ganhos}\n`;
      const cabecalho =
        '# Balanço M3 (plano §A.4, F2)\n\nRelatório versionado do `npm run balanco`: uma seção por rodada, mais recente no topo. Medição, nunca ajuste — quem muda `MAPA_ATRIBUTOS` é o Atlas/dono, a partir do veredito de cada rodada.\n';
      let rodadasAnteriores = '';
      try {
        const anterior = readFileSync(resolve(RAIZ, a.out), 'utf8');
        rodadasAnteriores = anterior.startsWith(cabecalho) ? anterior.slice(cabecalho.length) : anterior;
      } catch {
        rodadasAnteriores = '';
      }
      writeFileSync(resolve(RAIZ, a.out), `${cabecalho}${secao}${rodadasAnteriores}`, 'utf8');
      console.log(`\nRelatório gravado em ${a.out}`);
    }

    process.exitCode = semDados.length > 0 || foraDoCriterio.length > 0 ? 1 : 0;
  } finally {
    await server.close();
  }
}

await main();
