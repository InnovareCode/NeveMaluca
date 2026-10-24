/**
 * Determinismo CROSS-ENGINE do núcleo de itens (`docs/plano-itens-corrida.md` §Núcleo, I2 teste): a Vega provou
 * em `tests/unit/corrida-itens.test.ts` que a ORDEM dos participantes não muda `ResultadoCorrida`/`hashEstado`,
 * mas tudo isso rodou DENTRO de 1 processo Node/V8. Este spec prova a outra metade do plano ("a interação entre
 * corredores... Íris prova... em 2 navegadores" — mesmo texto do cabeçalho de `corrida/corrida.ts`): a MESMA
 * corrida (mesma semente + mesma sequência de `ComandoCorrida`, incluindo `usarItem`) rodando no motor REAL de
 * `corrida/corrida.ts` servido pelo Vite dentro do navegador, em 2 motores JS diferentes do Node que gerou os
 * valores dourados abaixo (V8 do Chromium nos projetos `desktop`/`celular`, JavaScriptCore no `webkit-se`).
 *
 * Os valores dourados (trilha de `hashEstado()` a cada 25 ticks + no tick da chegada + depois de `finalizar()`,
 * `ResultadoCorrida` e o hash da própria `PistaGerada`) foram gerados 1x em Node/Vitest com o CÓDIGO REAL (mesmo
 * cenário de `corrida-itens.test.ts`: semente=2026, pista do Morro, bot cuidadoso, `usarItem` em TODO tick) e
 * fixados aqui — igual ao padrão já usado por `core-determinismo.spec.ts` para o `core/`. Se ESTE spec reprovar
 * (em qualquer um dos 3 projetos do Playwright), a trilha aponta o primeiro índice (tick = índice*25, exceto o
 * último) em que o navegador divergiu do Node — é aí que mora o bug de ponto-flutuante/iteração que o V8 do Node
 * não pega sozinho.
 *
 * REGERADO na I3 (`docs/plano-itens-corrida.md` §Fases, Vega): até I2 os 5 rivais nunca usavam item (`usarItem`
 * sempre `false` pra eles, só o jogador jogava de verdade) — a trilha/`ResultadoCorrida` anteriores refletiam
 * exatamente isso. Com a I3 (`corrida/ia-itens.ts`), os rivais passaram a usar item de verdade (determinístico,
 * `hashSorteio01(semente, id, tick)`) e podem acertar o JOGADOR — nesta semente, uma Poça de Calda da `bia` pega o
 * jogador perto do tick 425 (índice 17 da trilha), mudando a corrida inteira a partir daí (chega mais tarde, com
 * menos pontos/flocos, e `acertosSofridos` sai de 0). Isto NÃO é regressão: os 3 motores (desktop/celular/
 * webkit-se) bateram EXATO entre si no valor novo (determinismo cross-engine intacto) — só o valor fixado aqui
 * ficou velho. Regerado com `node ferramentas/harness-corrida/gerar-golden-temp.mjs` (script descartável, mesma
 * técnica do `PROGRAMA` abaixo rodando via Vite SSR no Node em vez do navegador).
 *
 * Mesmo truque de `core-determinismo.spec.ts`: o código roda como TEXTO no navegador (não como função do teste)
 * pro Playwright não reescrever os `import()`.
 */
import { expect, test } from '@playwright/test';

const PROGRAMA = `(async () => {
  const Pistas = await import(new URL('/src/data/pistas.ts', location.href).href);
  const Personagens = await import(new URL('/src/data/personagens.ts', location.href).href);
  const Gerador = await import(new URL('/src/pista/gerador.ts', location.href).href);
  const CamadaJogo = await import(new URL('/src/pista/camada-jogo.ts', location.href).href);
  const Bot = await import(new URL('/src/descida/bot.ts', location.href).href);
  const Corrida = await import(new URL('/src/corrida/corrida.ts', location.href).href);

  const defs = Personagens.PERSONAGENS_DE_DADOS;
  const ids = defs.map((d) => d.id);
  const idJogador = 'capi';
  const participantes = ids.map((id) => {
    const def = defs.find((d) => d.id === id);
    return { id, config: def, piloto: id === idJogador ? { tipo: 'jogador' } : { tipo: 'ia', perfil: id, nivel: 0 } };
  });

  const pista = Gerador.gerarPista(Pistas.PISTA_MORRO_DO_PINHAO);
  const camada = CamadaJogo.gerarCamadaJogo(pista, Pistas.PISTA_MORRO_DO_PINHAO);
  const semente = 2026;
  const corrida = Corrida.criarCorrida({ pista, camada, semente, participantes });
  const bot = Bot.criarBotCuidadoso(pista, {}, camada.obstaculosAltos);

  const MAX_TICKS = 16200;
  let leitura = corrida.leitura();
  const trilha = [];
  let i = 0;
  for (; i < MAX_TICKS && leitura.jogador.fase !== 'chegou'; i++) {
    const cmd = { descida: bot(leitura.jogador), usarItem: true };
    leitura = corrida.processar(cmd);
    if (i % 25 === 0) trilha.push(corrida.hashEstado());
  }
  trilha.push(corrida.hashEstado());
  const hashNaChegada = corrida.hashEstado();
  const resultado = corrida.finalizar();
  const hashAposFinalizar = corrida.hashEstado();

  return { pistaHash: pista.hash, totalTicks: i, trilha, hashNaChegada, resultado, hashAposFinalizar };
})()`;

/** Trilha dourada (Node/Vitest, `corrida/corrida.ts` real): `hashEstado()` a cada 25 ticks (0, 25, 50, ...) + o
 *  último tick antes da chegada do jogador (2026, fora do passo de 25 — por isso repete no índice seguinte). */
const TRILHA_DOURADA = [
  'ce5d37c11c5f3c8f', '28181ad657cf3fe3', 'f6be93f96fc553b3', 'be0034a4b211be51', '3beef75c273d026c',
  'ed17e55fd7940142', '59a6f82c5bb61003', '6d3e39ee286997fe', 'be9f98fe9a5d7058', '3a76a1d55551370c',
  '05394ec65c033dec', 'fea8fc3205cad6aa', 'b87c67b42af63725', '64dc40d417bf26a0', 'ded74abba408ee27',
  '4515b4345f3a1429', '083929af58428791', '90d57d13c85cde92', '7f6d8c4d375ea04a', '4de7b5043ee43668',
  'cbd94cf1f6c09785', '89874f8cc92aaabc', '0bc373a4020c20a8', 'e146c226b10c978c', '2961d644c002d5cc',
  '39a888a4fa5c0a38', '0dbac0b2e6360204', '6bf0824d09bb55d4', '757981c782c78cd3', 'c22b3bf5683bee77',
  'd71458a114027356', '9df577e2a41f7162', '46186f86b5a20682', 'b8b50465e4f5eceb', '16ff5fce8930c095',
  '65bd3ac91f9cd5f3', '04a624dc6acafad9', '6bbed46b80281720', '13bd8ee5971ec652', '882ca810a11e21ad',
  '5488a20c2021f766', '9ad174864c253cb8', '6a432457bce00932', '216bda761c15c127', 'e1a536cc97e93b24',
  '5cf0d954ab4c4cec', 'd02f51bbd121acf1', 'b0865cc9c009eeb7', '860fbd97380cce79', '3b42cb11f2df0fc8',
  '30a1afbee98b21be', 'b4ecc6f1e9e20c0d', '9884deae1733f9ea', 'dba175f688dfc76b', '6414bf5e5dd0c704',
  'af35e1cb801fa15f', '8aa3520bada0f764', 'af6d3031aac9296a', '8f8a9fe1ad891eba', '8ed37947828295d1',
  '1e87097d76256665', '9a817294df7bc6c0', '4a4261662a2d8f55', '6fa412cc0aab0a24', '8448708638a8bf70',
  '5f4462b212727aef', '6f5d3180d971f48e', '6606e44a6cab2465', '547870f4b5488f07', 'ee73436ee1721d77',
  '42f8b7fd3bc84d05', '6a30edb1e8525879', '2dd59b365205e0bf', '675418903287224b', '24dfeeb8b2bc6328',
  'a500699d7a0c4ae0', 'afb85b7103e304d6', '66380824e67afe9c', '4ff01ba6c08e44fa', '4aa3f1d9f79fd21c',
  '4f27458d7548e8d2', '512f19af114de8a5', '8ea779195fc590fa', '0f8813f5805fe729', '57b6a449197b00f6',
  'f83175af9496c091', 'f26ad706bb39244c', '1ad72ee4d096a52d', 'd6025f2f7eb3ffa2', '7743267fa7ca8d4b',
  'c70ceff30d9ca3bd', '1c06dc787c9d29c5', '76e6b6fff19de7cd',
];

const RESULTADO_DOURADO = {
  pista: 'morro-do-pinhao',
  ordem: ['bandeira', 'queque', 'capi', 'cidinha', 'beto', 'bia'],
  ticks: { capi: 2293, bandeira: 2170, cidinha: 2392, beto: 2613, queque: 2209, bia: 2864 },
  resumoJogador: {
    pontos: 3000, ticks: 2293, tombos: 0, maiorVoltasNumSalto: 0, maiorTicksNoAr: 201, maiorGrindTicks: 0,
    pousosPerfeitos: 0, maiorMult: 2, maiorComboManobras: 1, bonecos: 3, concluiu: true,
  },
  flocosGanhos: 24,
  itens: { acertosDados: 1, acertosSofridos: 6 },
};

test('corrida + itens: mesma semente/comandos do jogador (bot cuidadoso, usarItem sempre true) bate EXATO com o Node em qualquer motor JS (hashEstado tick a tick, ResultadoCorrida e hash da pista)', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto('/');
  const r = (await page.evaluate(PROGRAMA)) as Record<string, unknown>;
  expect(erros).toEqual([]);
  expect(r['pistaHash']).toBe('1c4d551601d3a6ae');
  expect(r['totalTicks']).toBe(2294);
  // Comparação ponto a ponto (não só `toEqual` da lista inteira) pra apontar o ÍNDICE exato (tick = índice*25,
  // exceto o último) onde este motor divergiu do Node, se divergir.
  const trilha = r['trilha'] as string[];
  for (let idx = 0; idx < TRILHA_DOURADA.length; idx++) {
    expect(trilha[idx], `hashEstado diverge no índice ${idx} (tick ~${idx * 25}, semente=2026, pista=morro-do-pinhao)`).toBe(TRILHA_DOURADA[idx]);
  }
  expect(r['hashNaChegada']).toBe('76e6b6fff19de7cd');
  expect(r['resultado']).toEqual(RESULTADO_DOURADO);
  expect(r['hashAposFinalizar']).toBe('717329527441185c');
});
