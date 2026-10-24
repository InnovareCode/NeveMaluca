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
  'a585a7567d8793b8', '8712190e1fd42cd1', 'bd50e81dac3449e2', '5bc766235c76dc42', '9d6f02b69c298e04',
  '2be64eee97684d15', '7a337545a7329b00', '0e8a350c7034c167', '66c832298dbad4c2', '6fb4aeaceb6d4cb1',
  'bffd58d9781d5bb3', '59a23fde0cb5cfbf', 'c656c5478f6fe759', '8ad4cf8a6dfb630b', '94fe7b195c75fac6',
  '2aca7aac3b7605e9', 'e2e8390f8b987eb7', '80d0d3ce425792a2', '1c199c82f6a9ef53', 'c530072c41058791',
  'a47a8c1bf42e841f', '8c1b7c820593dbd0', '19316af2a6401f60', 'fde6f2e067fc5fa6', 'e634b90dc72f3c74',
  'afd49e43bf7349d6', '10ae258ef2427e78', '5a28b286c381349f', 'ad4aa46acdd4c793', 'd51808d5d5153b47',
  '9e4e05ea1a6b5b39', 'fdf3ba72c6f2e2a7', 'ad5f2985538523a2', '0a8a06bf94c183c6', '7dcdb4a8729320ed',
  'e50f95a003298e02', '283b27d5fdffe39a', 'dbd9c998d9b71361', '91e690b73e5e0edc', '036ac09dc5c411e7',
  '7bdf92bf241a1024', '1f926796f851c05c', '002b02af34403f6f', '03f69f4d92b92fd7', '9b68cd696268057f',
  '0ee937db9611cb92',
];

const RESULTADO_DOURADO = {
  pista: 'morro-do-pinhao',
  ordem: ['queque', 'cidinha', 'bandeira', 'bia', 'beto', 'capi'],
  ticks: { capi: 2124, bandeira: 1863, cidinha: 1858, beto: 1941, queque: 1854, bia: 1925 },
  resumoJogador: {
    pontos: 3080, ticks: 2124, tombos: 0, maiorVoltasNumSalto: 0, maiorTicksNoAr: 214, maiorGrindTicks: 0,
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
  expect(r['totalTicks']).toBe(2125);
  // Comparação ponto a ponto (não só `toEqual` da lista inteira) pra apontar o ÍNDICE exato (tick = índice*25,
  // exceto o último) onde este motor divergiu do Node, se divergir.
  const trilha = r['trilha'] as string[];
  for (let idx = 0; idx < TRILHA_DOURADA.length; idx++) {
    expect(trilha[idx], `hashEstado diverge no índice ${idx} (tick ~${idx * 25}, semente=2026, pista=morro-do-pinhao)`).toBe(TRILHA_DOURADA[idx]);
  }
  expect(r['hashNaChegada']).toBe('0ee937db9611cb92');
  expect(r['resultado']).toEqual(RESULTADO_DOURADO);
  expect(r['hashAposFinalizar']).toBe('0ee937db9611cb92');
});
