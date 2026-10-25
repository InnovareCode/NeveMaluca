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
 * `hashSorteio01(semente, id, tick)`) e podem acertar o JOGADOR.
 *
 * REGERADO DE NOVO em 2026-10-24 (calibragem "pulo mais forte / travar menos", dono/iPhone — ver `descida/
 * constantes.ts`): `CONFIG_PADRAO` mudou de propósito (física da Capi inclusa — ela É `CONFIG_PADRAO`) e
 * `PARAMETROS_TROMBADA_ITEM`/`PARAMETROS_POCA_FREADA` (`data/itens.ts`) foram suavizados (I6). Não é regressão:
 * os 3 motores (desktop/celular/webkit-se) bateram EXATO entre si no valor NOVO (determinismo cross-engine
 * intacto) — só o valor fixado aqui ficou velho. Regerado com `node ferramentas/harness-corrida/gerar-golden-
 * temp.mjs` (script descartável, mesma técnica do `PROGRAMA` abaixo rodando via Vite SSR no Node em vez do
 * navegador).
 *
 * REGERADO DE NOVO em 2026-10-24 (calibragem "cai sobre obstáculo", dono/iPhone — ver `pista/camada-jogo.ts`,
 * `VERSAO_CAMADA_JOGO` '3'->'4'): `perigosoParaObstaculo` passou a proteger a janela de pouso de QUALQUER rampa
 * de verdade, não só da promovida a kicker — muda ONDE `galho`/caixa entram na pista do Morro, então a trilha de
 * `hashEstado()` diverge do valor anterior a partir do ponto em que a Capi passa perto de um obstáculo que mudou
 * de lugar (primeiros ~1000 ticks batem igual; diverge dali pra frente — esperado, não regressão). Mesma técnica
 * descartável (Vite SSR/Node) de antes; `pistaHash` do terreno continua INTACTO (camada nunca toca o terreno).
 *
 * REGERADO DE NOVO em 2026-10-25 (calibragem "voo crível", dono/iPhone — ver `pista/camada-jogo.ts`,
 * `IMPULSO_KICKER_MS` 32->16, `VERSAO_CAMADA_JOGO` '4'->'5'): o kicker da pista do Morro dá menos impulso, então o
 * voo da Capi em cima dele muda (tempo no ar, ponto de pouso) — a trilha diverge a partir do ponto em que ela
 * passa pelo kicker (índices 0-37, tick ~925, batem IGUAL ao golden anterior; diverge dali pra frente, esperado,
 * não regressão). `pistaHash` continua INTACTO (camada nunca toca o terreno). Mesma técnica descartável (Vite
 * SSR/Node, `ferramentas/gerar-golden-itens-tmp.mjs`, removido depois de extrair os números) de antes, CONFIRMADO
 * batendo nos 3 motores (desktop/celular/webkit-se) antes de fixar o novo valor.
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
  'ce5d37c11c5f3c8f', '28181ad657cf3fe3', '595287e5cc2ee5f3', 'd99f15383b89194c', 'f80d831335ea82ef',
  'b0bdaeb0fa98b8d6', '780542d5fa331208', '751349fc1f26aecc', 'a9648a03c4249d75', '1965c44941b733c4',
  'e1067c256f01bb1c', '3cf628866ec6d7dc', 'e04c76355597caac', '288f2f95a189deff', '930864ca13c151b8',
  'b32b49a00c9107ad', '450c6cdd2d8dc356', '4cc78d565b39863e', 'b5a7e7d53264ab47', '932055afb6cfff53',
  '7eb6f680f9271e1f', '9217eac34c98a7d0', 'c0d57e07dc294004', '5a6b20e846a2afa3', '255d05f4bf013f7a',
  '3331ed2b0bc71017', '1d4c732fe2ca44b2', 'da277c87c8c1f07b', 'dd47a2921f5fb1b1', 'd554012d48a5080a',
  '4033ee40368f70a1', 'a5c57911b3995bbb', '8c22e24bb89985c1', '74ae40670efd4232', '304928657890d97c',
  'dee61c70b09ee13d', 'd760a09d6df2f272', 'ec2c51f35a0b41b6', 'f2e23729d75fece9', 'e8a235486e75f472',
  'b8f314f7d64aab17', 'c10a1c0f4aa44ab5', 'dd4f73ce09f4d6ec', 'ef80e147f3967149', 'a76ef19690b8b53b',
  '98ee19d350fe132c', 'b71eb14608a655d3', 'f2a1c0a546b35c97', '8988657d7a4b503e', 'eb1c1879e263cedb',
  '12c7953b65f2e687', '9a1f7441e2b14bed', '5c70cea2433ed2bc', 'd1541793653d82b3', '279edb53f56a5eb3',
  '12dec66bd62526bc', '89cd1e4ba7bc1006', '74b7987ffe187504', '0acdaa3f040c2eb9', 'e0d6e77092cb0bdf',
  'a6153ef2f138c6b5', '15f18dbdb784b513', '43bb0479c64c8937', 'f6062272f22cefe9', 'ed81d9f81aa0ab57',
  'd60b12651def5211', '3cb5bbd5ea4e693b', '4cb9710127709abf', '960aaf2856326a2c', '946d570be4399a53',
  '7f78551c98253a91', '842040cba59465b9', 'e854704bbf23c2f8', 'f81367399fb36d16', 'ac8cf01e728c7076',
  'f2e0bd35332e0835', 'fb54f9817f5a886f', 'fba29d5b8b8931c5', 'f8b617ae17c0da51', '80c9db4d34fbe9ac',
  '81550cd2bb3af184', '874e947eae0aa42f', 'fa4ef29a46bc85c2', '496ac267b6ef4403', '5965d521f45b0866',
  'c2431b83bb18e588', '65426da2ef900d6c', 'a3d515faf5428dee',
];

const RESULTADO_DOURADO = {
  pista: 'morro-do-pinhao',
  ordem: ['bia', 'beto', 'bandeira', 'cidinha', 'queque', 'capi'],
  ticks: { capi: 2159, bandeira: 1864, cidinha: 1870, beto: 1848, queque: 1952, bia: 1840 },
  resumoJogador: {
    pontos: 2970, ticks: 2159, tombos: 0, maiorVoltasNumSalto: 0, maiorTicksNoAr: 126, maiorGrindTicks: 0,
    pousosPerfeitos: 0, maiorMult: 2, maiorComboManobras: 2, bonecos: 3, concluiu: true,
  },
  flocosGanhos: 19,
  itens: { acertosDados: 1, acertosSofridos: 5 },
};

test('corrida + itens: mesma semente/comandos do jogador (bot cuidadoso, usarItem sempre true) bate EXATO com o Node em qualquer motor JS (hashEstado tick a tick, ResultadoCorrida e hash da pista)', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto('/');
  const r = (await page.evaluate(PROGRAMA)) as Record<string, unknown>;
  expect(erros).toEqual([]);
  expect(r['pistaHash']).toBe('1c4d551601d3a6ae');
  expect(r['totalTicks']).toBe(2160);
  // Comparação ponto a ponto (não só `toEqual` da lista inteira) pra apontar o ÍNDICE exato (tick = índice*25,
  // exceto o último) onde este motor divergiu do Node, se divergir.
  const trilha = r['trilha'] as string[];
  for (let idx = 0; idx < TRILHA_DOURADA.length; idx++) {
    expect(trilha[idx], `hashEstado diverge no índice ${idx} (tick ~${idx * 25}, semente=2026, pista=morro-do-pinhao)`).toBe(TRILHA_DOURADA[idx]);
  }
  expect(r['hashNaChegada']).toBe('a3d515faf5428dee');
  expect(r['resultado']).toEqual(RESULTADO_DOURADO);
  expect(r['hashAposFinalizar']).toBe('a3d515faf5428dee');
});
