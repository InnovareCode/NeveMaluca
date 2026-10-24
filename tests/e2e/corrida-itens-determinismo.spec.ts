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
  '4515b4345f3a1429', '083929af58428791', '0ef08e233a2f19fb', '6a999927d45266d1', 'a26732fbe813391a',
  '564b74b4704d3de6', '88fc24425bd96d9e', 'c04cfcd79a025e50', '7bc03b056576691a', 'fe264dc2860c3895',
  '6a150208dbaeba59', '4b3cfb55f3409b3a', 'e01a3749efa02926', 'f2a045bf2115a171', 'c8e144864b88b001',
  'c715ddb14cf7ebf9', '08b98f956551ab86', 'e6545ae733ce4cde', '42deb543e6e276f7', 'edd383b350edd705',
  '46ad8d0b0070ed7c', '9d0c103b01c63766', '79bbf07b5e8b7c70', 'ab7a4c72e184a1bd', '798441f5f347a2bd',
  'a386dae53337e9d9', 'bf3141fa3fc40079', 'cc1213fca6aa0d63', '883b73aee8fbf30d', 'bf403d02a5794434',
  '7ea166b2e6bedba3', 'c67282e711f63a75', '79b192ad443d9844', '2f810b8454c424f7', '5ab24e275b14671f',
  '7d235d78722bc40c', 'f3b6648c6f4fcc0c', '59cd56fb6e1c47fa', '479ac797fbf3dbcf', '1e095ac66b61a1d8',
  '9eeeec59716d835c', 'c533ee0257b7dcdd', 'ac7005911f91500a', 'c2b962a1a7a7f838', 'fb57470ead099ef5',
  '6d4c36c7714ee1ae', '4ba0ec92c158fb94', 'eff28f86e352e93a', '1cf4a6baf6b42c74', 'bc71f9aeea8e6c2a',
  '78c8e1820afbe762', '331a1b8754336bc6', 'cac6a0c672eff2b9', 'ea7e1549dae1a937', '5d3232bacc2b7be3',
  'cbdf7f141baf29fd', 'c8fefd7e523f070a', 'b91c1d376e4e9557', 'fcaa8b100a339903', 'd845a389d205c4cd',
  '78340295b0d93ee7', '99057f2ba765f3f6', '9a16f4ab1cef8b54', '7d0c3d5b106bf55b', '05c946d5ccaee2fa',
  '6ee0684a6cc1a40b', '39c5e727726e4acb', '4841973579c1128e',
];

const RESULTADO_DOURADO = {
  pista: 'morro-do-pinhao',
  ordem: ['capi', 'bandeira', 'queque', 'cidinha', 'beto', 'bia'],
  ticks: { capi: 2026, bandeira: 2268, cidinha: 2380, beto: 2451, queque: 2302, bia: 2473 },
  resumoJogador: {
    pontos: 3150, ticks: 2026, tombos: 0, maiorVoltasNumSalto: 0, maiorTicksNoAr: 201, maiorGrindTicks: 0,
    pousosPerfeitos: 0, maiorMult: 2, maiorComboManobras: 1, bonecos: 3, concluiu: true,
  },
  flocosGanhos: 33,
  itens: { acertosDados: 2, acertosSofridos: 0 },
};

test('corrida + itens: mesma semente/comandos do jogador (bot cuidadoso, usarItem sempre true) bate EXATO com o Node em qualquer motor JS (hashEstado tick a tick, ResultadoCorrida e hash da pista)', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto('/');
  const r = (await page.evaluate(PROGRAMA)) as Record<string, unknown>;
  expect(erros).toEqual([]);
  expect(r['pistaHash']).toBe('1c4d551601d3a6ae');
  expect(r['totalTicks']).toBe(2027);
  // Comparação ponto a ponto (não só `toEqual` da lista inteira) pra apontar o ÍNDICE exato (tick = índice*25,
  // exceto o último) onde este motor divergiu do Node, se divergir.
  const trilha = r['trilha'] as string[];
  for (let idx = 0; idx < TRILHA_DOURADA.length; idx++) {
    expect(trilha[idx], `hashEstado diverge no índice ${idx} (tick ~${idx * 25}, semente=2026, pista=morro-do-pinhao)`).toBe(TRILHA_DOURADA[idx]);
  }
  expect(r['hashNaChegada']).toBe('4841973579c1128e');
  expect(r['resultado']).toEqual(RESULTADO_DOURADO);
  expect(r['hashAposFinalizar']).toBe('46fcab6c0ff1ba6a');
});
