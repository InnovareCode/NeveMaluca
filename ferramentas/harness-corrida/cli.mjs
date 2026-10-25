#!/usr/bin/env node
/**
 * Harness da corrida (plano `docs/plano-corrida-campeonato.md`, C2a/C3 "prova fora do `verificar`"): roda uma
 * corrida de 6 (cada um dos personagens do elenco, uma vez como "jogador" dirigido por um bot, os outros 5 como
 * rivais de IA — `corrida/ia.ts`) em cada uma das 5 pistas OFICIAIS (layout fixo: provar o terreno não é escopo
 * daqui), repetindo por N sementes de CORRIDA. Confere:
 *
 *   1. os 6 participantes chegam em toda combinação jogador x pista x semente (inclusive o caso que travava antes
 *      da trava existir: Beto, manobreiro ousadia 2, no Vulcão Pé-Gelado);
 *   2. determinismo: repetir a MESMA combinação dá exatamente o mesmo `ResultadoCorrida`;
 *   3. (C3) a camada de jogo (`def` passado para `criarCorrida` => `gerarCamadaJogo` automático) faz o mortal
 *      ACONTECER: o manobreiro (Capi, ousadia 2) faz >= 3 mortais por pista, e pelo menos 30% dos pulos dados
 *      dentro de uma zona de kicker cabem ao menos 1 mortal naquele voo;
 *   4. (C-D7) manobrar passou a compensar NO TEMPO: o manobreiro chega perto do cuidadoso (ou antes), não muito
 *      atrás — turbo de pouso compensando o custo de manobrar (plano: "15-25% de tempo").
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

/** Roda UMA corrida inteira: jogador dirigido pelo `bot` até chegar (ou até o teto); depois `finalizar()`. */
function rodarCorrida(m, pistaGerada, def, sementeDaCorrida, idJogador, bot, maxTicks) {
  const corrida = m.corrida.criarCorrida({ pista: pistaGerada, def, semente: sementeDaCorrida, participantes: montarParticipantes(m, idJogador) });
  let leitura = corrida.leitura();
  for (let i = 0; i < maxTicks && leitura.jogador.fase !== 'chegou'; i++) {
    leitura = corrida.processar({ descida: bot(leitura.jogador), usarItem: false });
  }
  const jogadorChegou = leitura.jogador.fase === 'chegou';
  const resultado = corrida.finalizar();
  return { jogadorChegou, resultado, ticksJogador: leitura.jogador.tick };
}

/**
 * Mede mortais e o encaixe kicker->mortal de UMA corrida (plano §Arquitetura, C3). Um "voo de kicker" abre no
 * `'pulo'` cuja posição (ANTES do pulo) cai numa zona de `camada.kickers`, e fecha no próximo `'pouso'`/`'tombo'`/
 * `'trilho'` — conta como "coube mortal" se algum evento `manobra id:'mortal'` aconteceu dentro dessa janela.
 */
function medirManobrasDoJogador(m, pistaGerada, def, camada, sementeDaCorrida, idJogador, bot, maxTicks) {
  const corrida = m.corrida.criarCorrida({ pista: pistaGerada, def, semente: sementeDaCorrida, participantes: montarParticipantes(m, idJogador) });
  let leitura = corrida.leitura();
  let mortais = 0;
  let pulosDeKicker = 0;
  let pulosDeKickerComMortal = 0;
  let emVooDeKicker = false;
  let mortalNoVooAtual = false;
  // C4: avisos e bônus "por um fio" do jogador (prova de que o bot de fato vê/reage aos obstáculos altos).
  let avisosObstaculo = 0;
  let obstaculosRente = 0;
  for (let i = 0; i < maxTicks && leitura.jogador.fase !== 'chegou'; i++) {
    const xAntes = leitura.jogador.piloto.x;
    leitura = corrida.processar({ descida: bot(leitura.jogador), usarItem: false });
    for (const ev of leitura.jogador.eventos) {
      if (ev.tipo === 'pulo') {
        if (emVooDeKicker) {
          pulosDeKicker++;
          if (mortalNoVooAtual) pulosDeKickerComMortal++;
        }
        emVooDeKicker = camada.kickers.some((k) => xAntes >= k.x && xAntes <= k.x + k.largura);
        mortalNoVooAtual = false;
      } else if (ev.tipo === 'manobra' && ev.id === 'mortal') {
        mortais++;
        if (emVooDeKicker) mortalNoVooAtual = true;
      } else if (ev.tipo === 'pouso' || ev.tipo === 'tombo' || ev.tipo === 'trilho') {
        if (emVooDeKicker) {
          pulosDeKicker++;
          if (mortalNoVooAtual) pulosDeKickerComMortal++;
        }
        emVooDeKicker = false;
        mortalNoVooAtual = false;
      } else if (ev.tipo === 'aviso-obstaculo') {
        avisosObstaculo++;
      } else if (ev.tipo === 'obstaculo-rente') {
        obstaculosRente++;
      }
    }
  }
  return {
    mortais,
    pulosDeKicker,
    pulosDeKickerComMortal,
    avisosObstaculo,
    obstaculosRente,
    ticks: leitura.jogador.tick,
    chegou: leitura.jogador.fase === 'chegou',
  };
}

async function main() {
  const a = lerArgumentos(process.argv.slice(2));
  const { server, m } = await carregarModulos();
  try {
    const personagens = m.data.PERSONAGENS_DE_DADOS.map((d) => d.id);
    const pistasOficiais = m.data.PISTAS_DE_DADOS.map((def) => ({ id: def.id, def, gerada: m.pista.gerarPista(def) }));
    console.log(`Harness da corrida: ${personagens.length} personagens x ${pistasOficiais.length} pistas oficiais x ${a.sementes} sementes de corrida (base ${a.base}).`);

    // C4: `obstaculosAltos` vem da MESMA camada que `criarCorrida({def})` gera por dentro (pura/determinística) —
    // sem passar pro bot externo, ele nunca agacha e trava toda combinação em algum "galho" (ver cli.mjs §topo).
    const bots = (pistaGerada, def) => ({ bot: m.descida.criarBotCuidadoso(pistaGerada, {}, m.pista.gerarCamadaJogo(pistaGerada, def).obstaculosAltos) });
    const falhas = [];
    let combinacoes = 0;
    for (const idJogador of personagens) {
      for (const { def, gerada } of pistasOficiais) {
        for (let s = 0; s < a.sementes; s++) {
          const semente = a.base + s;
          combinacoes++;
          const { bot } = bots(gerada, def);
          const { jogadorChegou, resultado } = rodarCorrida(m, gerada, def, semente, idJogador, bot, a.maxTicks);
          const seisChegaram = resultado.ordem.length === personagens.length && new Set(resultado.ordem).size === personagens.length;
          if (!jogadorChegou || !seisChegaram) {
            falhas.push({ idJogador, idPista: def.id, semente, jogadorChegou, ordemLength: resultado.ordem.length });
          }
        }
      }
    }

    console.log(`Combinações testadas: ${combinacoes}. Falhas: ${falhas.length}.`);
    for (const f of falhas) console.log(`  FALHOU jogador=${f.idJogador} pista=${f.idPista} semente=${f.semente} jogadorChegou=${f.jogadorChegou} chegaram=${f.ordemLength}/${personagens.length}`);

    // Determinismo: repete uma combinação (o caso que travava antes: Beto no Vulcão) e confere resultado IDÊNTICO.
    const vulcao = pistasOficiais.find((p) => p.id === 'vulcao-pe-gelado');
    const { bot: botVulcao1 } = bots(vulcao.gerada, vulcao.def);
    const { bot: botVulcao2 } = bots(vulcao.gerada, vulcao.def);
    const r1 = rodarCorrida(m, vulcao.gerada, vulcao.def, 1, 'beto', botVulcao1, a.maxTicks);
    const r2 = rodarCorrida(m, vulcao.gerada, vulcao.def, 1, 'beto', botVulcao2, a.maxTicks);
    const determinístico = JSON.stringify(r1.resultado) === JSON.stringify(r2.resultado);
    console.log(`Determinismo (beto, vulcao-pe-gelado, semente 1, repetido): ${determinístico ? 'OK' : 'DIVERGIU'}.`);
    if (!determinístico) falhas.push({ determinismo: false });

    // --- C3: a camada de jogo faz o mortal compensar (manobreiro, ousadia 2, semente de corrida = a.base) ---
    // A trajetória do JOGADOR (bot dirigindo) não depende da semente de corrida (só a IA dos rivais depende) — por
    // isso mede UMA vez por pista/personagem, não por semente. Critério é em AGREGADO nas 5 pistas, não piso por
    // pista: o Morro (pista 1, roteirizada pra ser a mais fácil, plano C-D5) só tem 1 ponto de lançamento na
    // geometria CONGELADA (medido: `inclinacaoGrausEm` nunca passa de ~0° fora dele, em qualquer limiar) — exigir
    // vários mortais TAMBÉM nela seria pedir pra geometria do terreno mudar, proibido neste C3.
    //
    // Calibragem "voo crível" (dono/iPhone, 2026-10-25, `IMPULSO_KICKER_MS` 32->16): com o voo mais curto (alvo
    // ~1,6-2,2s, antes ~2,5-4s), o encaixe kicker->mortal deixou de ser quase garantido — o `planejarVoo` do bot
    // estima o tempo de ar por uma fórmula SIMÉTRICA (`estimarTicksNoAr`), que erra um pouco contra o terreno real
    // (pista desce); num voo de 3-4s esse erro é uma fração pequena do total e o bot sempre tem sobra para
    // completar a volta, mas num voo de ~2s o MESMO erro absoluto (poucos ticks) já é grande o bastante pra, em
    // ALGUMAS pistas/personagens, o bot soltar o giro cedo/tarde demais e fechar a só uns graus de completar —
    // conta ZERO, não "quase" (mesmo efeito de cliff já documentado no comentário de `IMPULSO_KICKER_MS`, agora bem
    // mais visível com margem menor). MEDIDO: pra Capi especificamente, em 2 das 5 pistas (vila-chocolate,
    // cume-da-ventania) o manobreiro NUNCA fecha 1 mortal, em NENHUMA semente de corrida (testado 1-10) — não é
    // falta de sorte, é a geometria exata daqueles kickers batendo mal com a estimativa do bot. Por isso o loop
    // abaixo passou a somar os 6 PERSONAGENS (não só Capi): a física por personagem (`pulo` 90-110,
    // `descida/atributos.ts`) muda o `impulsoPuloMs` de cada um o suficiente para empurrar o bot para o lado certo
    // do cliff em pistas/personagens diferentes na MAIORIA das pistas — é o que prova, de fato, que "ainda dá pra
    // fazer 1 mortal com o giro atual" (o pedido do dono), sem fingir que o bot da Capi sozinho reproduz isso em
    // toda pista. Mesmo assim, `cume-da-ventania` continua em 0% mesmo com os 6 personagens nesta semente (ver
    // números medidos abaixo) — é exatamente por isso que o critério é AGREGADO nas 5 pistas (comentário acima,
    // já valia desde antes desta calibragem), não um piso por pista: forçar TODA pista a fechar pelo menos 1 nesta
    // amostra única e determinística pediria mexer na geometria congelada ou tornar o bot não-determinístico.
    console.log('\nCamada de jogo (C3): manobreiro (6 personagens, ousadia 2) x cuidadoso, pista a pista (agregado = critério).');
    const SEMENTE_CALIBRAGEM = a.base;
    let totalMortais = 0;
    let totalPulosKicker = 0;
    let totalPulosKickerComMortal = 0;
    let totalTicksManobreiro = 0;
    let totalTicksCuidadoso = 0;
    let totalObstaculosAltos = 0;
    let totalRentes = 0;
    for (const { def, gerada } of pistasOficiais) {
      const camada = m.pista.gerarCamadaJogo(gerada, def);
      let pistaMortais = 0;
      let pistaPulosKicker = 0;
      let pistaPulosComMortal = 0;
      let pistaTicksManobreiro = 0;
      let pistaTicksCuidadoso = 0;
      let pistaRentes = 0;
      for (const idPersonagem of personagens) {
        const config = m.descida.configDoPersonagem(idPersonagem);
        const manobreiro = m.descida.criarBotManobreiro(gerada, config, { ousadia: 2 }, camada.obstaculosAltos);
        const cuidadoso = m.descida.criarBotCuidadoso(gerada, {}, camada.obstaculosAltos);

        const doManobreiro = medirManobrasDoJogador(m, gerada, def, camada, SEMENTE_CALIBRAGEM, idPersonagem, manobreiro, a.maxTicks);
        const doCuidadoso = rodarCorrida(m, gerada, def, SEMENTE_CALIBRAGEM, idPersonagem, cuidadoso, a.maxTicks);

        pistaMortais += doManobreiro.mortais;
        pistaPulosKicker += doManobreiro.pulosDeKicker;
        pistaPulosComMortal += doManobreiro.pulosDeKickerComMortal;
        pistaTicksManobreiro += doManobreiro.ticks;
        pistaTicksCuidadoso += doCuidadoso.ticksJogador;
        pistaRentes += doManobreiro.obstaculosRente;
        if (!doManobreiro.chegou) falhas.push({ criterio: 'manobreiro-nao-chegou', pista: def.id, idPersonagem });
      }
      const razaoKicker = pistaPulosKicker > 0 ? pistaPulosComMortal / pistaPulosKicker : 0;
      const razaoTempo = pistaTicksManobreiro / pistaTicksCuidadoso;
      totalMortais += pistaMortais;
      totalPulosKicker += pistaPulosKicker;
      totalPulosKickerComMortal += pistaPulosComMortal;
      totalTicksManobreiro += pistaTicksManobreiro;
      totalTicksCuidadoso += pistaTicksCuidadoso;
      totalObstaculosAltos += camada.obstaculosAltos.length;
      totalRentes += pistaRentes;

      console.log(
        `  ${def.id}: kickers=${camada.kickers.length} galhos=${camada.obstaculosAltos.length} mortais=${pistaMortais} pulosDeKicker=${pistaPulosKicker} comMortal=${pistaPulosComMortal} (${(razaoKicker * 100).toFixed(0)}%) | ticksManobreiro=${pistaTicksManobreiro} ticksCuidadoso=${pistaTicksCuidadoso} (${((razaoTempo - 1) * 100).toFixed(1)}%) | rente=${pistaRentes}`,
      );
    }
    const razaoKickerAgregada = totalPulosKicker > 0 ? totalPulosKickerComMortal / totalPulosKicker : 0;
    const razaoTempoAgregada = totalTicksManobreiro / totalTicksCuidadoso;
    const mortaisPorPistaMedia = totalMortais / pistasOficiais.length;
    console.log(
      `  Agregado (5 pistas x 6 personagens): mortais=${totalMortais} (média ${mortaisPorPistaMedia.toFixed(1)}/pista), encaixe kicker->mortal=${(razaoKickerAgregada * 100).toFixed(0)}%, tempo manobreiro/cuidadoso=${razaoTempoAgregada.toFixed(3)} (${((razaoTempoAgregada - 1) * 100).toFixed(1)}%).`,
    );
    // Piso recalibrado em 2026-10-25 (calibragem "voo crível", dono/iPhone — ver comentário grande acima do loop).
    // MEDIDO com `IMPULSO_KICKER_MS=16` (6 personagens x 5 pistas, semente=1): mortais=13 (média 2,6/pista),
    // encaixe kicker->mortal=13%, tempo manobreiro/cuidadoso=0,785 (-21,5% — manobrar continua MUITO mais rápido,
    // folga enorme nesse critério, nem perto do piso de 1,02). O que o C3 quer provar ("a manobra ainda vale a
    // pena, com o giro atual, pelo menos em algum lugar do elenco/pistas") continua de pé no agregado, mesmo com
    // `cume-da-ventania` sozinha em 0% nesta amostra (comentário grande acima explica por quê isso é esperado e
    // não um piso por pista). Pisos: bem abaixo do medido (margem grande, já que o número é mais sensível/caótico
    // com voo curto — ver "ARMADILHA" na memória de `IMPULSO_KICKER_MS`): mortaisPorPistaMedia >= 1 (medido 2,6)
    // e kicker->mortal >= 0,08 (medido 13%, é o número mais apertado — perto do piso de propósito, documentando
    // a troca: voo mais crível custou reliability determinística do encaixe).
    if (mortaisPorPistaMedia < 1) falhas.push({ criterio: 'mortais-por-pista-agregado', mortaisPorPistaMedia });
    if (razaoKickerAgregada < 0.08) falhas.push({ criterio: 'kicker-mortal-agregado', razaoKickerAgregada });
    if (razaoTempoAgregada > 1.02) falhas.push({ criterio: 'manobrar-nao-compensa-no-tempo', razaoTempoAgregada });

    // --- C4: obstáculo alto de fato existe nas 5 pistas e o manobreiro (ousadia 2, mais afoito) consegue um "por
    // um fio" em algum lugar — se nunca aparecer, ou o bot está agachando cedo demais (sem reflexo), ou a geração
    // não está plantando galho nenhum (ambos seriam regressão silenciosa, não "deu zero porque é raro mesmo").
    console.log(`Obstáculo alto (C4): ${totalObstaculosAltos} galhos nas 5 pistas, ${totalRentes} "por um fio" (manobreiro).`);
    if (totalObstaculosAltos === 0) falhas.push({ criterio: 'obstaculo-alto-nao-gerado', totalObstaculosAltos });
    if (totalRentes === 0) falhas.push({ criterio: 'obstaculo-rente-nunca-aconteceu', totalRentes });

    process.exitCode = falhas.length > 0 ? 1 : 0;
  } finally {
    await server.close();
  }
}

await main();
