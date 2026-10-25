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
  'dee61c70b09ee13d', 'd760a09d6df2f272', 'ec2c51f35a0b41b6', '6dd91621aafc62d9', '0eea987b45747265',
  'a585a7567d8793b8', '666f524780b39e98', '04c358888bc32786', '6a8deb241bc9ba1f', 'b1fee5a94c118e30',
  '411c36cff12e7c3b', 'e25df8895ad24b9b', '07927b2936bc855c', 'a1b26ce0be410b0c', '8de23f8781123e1b',
  '5a1b329b4089ab08', '8a1d11ef899ca241', 'b5328c0d37456cdd', '43cee8dfafa21e89', '43ceecee9b7aae75',
  '4c2c092e9e35652b', 'a41d791aa7f17a43', '949300353ff2a357', '968d15381bf3c128', '31d12436b90a15e6',
  'd40c2b40a91f5d5c', 'a73041725c338896', '208645c4112fbc82', 'a4ac559b690de777', '8601dacdd891d013',
  '6adc7b39b2846cf8', '8f046eae506a5bc1', '23fb81a0e3a848c9', '3428fe3e1f11c10e', 'be8e4d6bb2b83594',
  'cb93ec625ea185b3', '657ec1780a985b7d', '14b6e19367e57a8a', '4bdbab6b4756e320', '2bdcd6e51fa91a74',
  'c85ba08e3af4df1c', 'ce1a0a0f0e65eb70', 'a0c6b46c3b988aae', 'b941bf9469ac56c0', '758b81427a321650',
  'a5c00fccceb685a9', '336e58790e7f3bc0', '876ef953f59e2d44', '669e655b5e784bb9', '46ed51de41b0a3e1',
  'c8b9a1a438094eeb', '62472530b1ffa3c9', 'e48c192d92924257',
];

const RESULTADO_DOURADO = {
  pista: 'morro-do-pinhao',
  ordem: ['beto', 'bia', 'cidinha', 'queque', 'bandeira', 'capi'],
  ticks: { capi: 2174, bandeira: 1864, cidinha: 1846, beto: 1825, queque: 1860, bia: 1837 },
  resumoJogador: {
    pontos: 3080, ticks: 2174, tombos: 0, maiorVoltasNumSalto: 0, maiorTicksNoAr: 214, maiorGrindTicks: 0,
    pousosPerfeitos: 0, maiorMult: 2, maiorComboManobras: 1, bonecos: 2, concluiu: true,
  },
  flocosGanhos: 15,
  itens: { acertosDados: 0, acertosSofridos: 5 },
};

test('corrida + itens: mesma semente/comandos do jogador (bot cuidadoso, usarItem sempre true) bate EXATO com o Node em qualquer motor JS (hashEstado tick a tick, ResultadoCorrida e hash da pista)', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto('/');
  const r = (await page.evaluate(PROGRAMA)) as Record<string, unknown>;
  expect(erros).toEqual([]);
  expect(r['pistaHash']).toBe('1c4d551601d3a6ae');
  expect(r['totalTicks']).toBe(2175);
  // Comparação ponto a ponto (não só `toEqual` da lista inteira) pra apontar o ÍNDICE exato (tick = índice*25,
  // exceto o último) onde este motor divergiu do Node, se divergir.
  const trilha = r['trilha'] as string[];
  for (let idx = 0; idx < TRILHA_DOURADA.length; idx++) {
    expect(trilha[idx], `hashEstado diverge no índice ${idx} (tick ~${idx * 25}, semente=2026, pista=morro-do-pinhao)`).toBe(TRILHA_DOURADA[idx]);
  }
  expect(r['hashNaChegada']).toBe('e48c192d92924257');
  expect(r['resultado']).toEqual(RESULTADO_DOURADO);
  expect(r['hashAposFinalizar']).toBe('e48c192d92924257');
});
