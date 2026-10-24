/**
 * F0 do M3 (`docs/plano-m3.md` §0 e §C): rede de segurança ANTES de qualquer física por personagem.
 *
 * 1. Teste-congelamento da Capi: grava como constante o `hashEstado()` final + pontos + ticks de uma descida
 *    completa da Capi (`CONFIG_PADRAO`, bot "cuidadoso") na semente OFICIAL do Morro do Pinhão e mais 3 sementes
 *    (1, 2, 3). Se algum destes 4 valores mudar no futuro SEM uma mudança de física aprovada, a física ou a
 *    pontuação da Capi regrediu (proibido pelo plano, "a Capi é a mesma", R-M3-1): este teste é o que transforma
 *    essa regra em prova, não em opinião.
 *
 *    REGERADO em 2026-10-24 (calibragem "pulo mais forte / travar menos", autorizada pelo dono depois do playtest
 *    no iPhone): `CONFIG_PADRAO` mudou de propósito (`impulsoPuloMs`, janela de pouso — ver `descida/
 *    constantes.ts`) e muda a física da Capi TAMBÉM (ela É `CONFIG_PADRAO`). Os 4 valores abaixo são o resultado
 *    REAL de rodar este mesmo teste (motor real + bot cuidadoso real) depois da mudança — não foram "ajustados pra
 *    passar"; `VERSAO_MOTOR` foi de '2' pra '3' no mesmo commit (replays antigos passam a rodar sem fantasma).
 * 2. Teste do hash do Morro congelado: `gerarPista` com a semente oficial dá o mesmo hash gravado em
 *    `PISTA_MORRO_DO_PINHAO.hashEsperado`. Mudar o catálogo/algoritmo do gerador (proibido no M3, R-M3-2) quebra
 *    este teste antes de mandar os recordes do dono para "antigos".
 */
import { describe, expect, it } from 'vitest';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { CONFIG_PADRAO } from '../../src/descida/constantes';
import { criarDescida } from '../../src/descida/motor';
import { gerarPista } from '../../src/pista/gerador';

const MAX_TICKS = 16200; // mesmo teto generoso de `descida-bot-harness.test.ts`.

/** Semente oficial do Morro do Pinhão + 3 sementes extras, pedidas no F0 do plano (§0, achado 3). */
const GOLDEN_CAPI: ReadonlyArray<{
  readonly semente: number;
  readonly hashPista: string;
  readonly hashFinal: string;
  readonly pontos: number;
  readonly ticks: number;
}> = [
  { semente: 20261022, hashPista: '1c4d551601d3a6ae', hashFinal: 'a5539929a05d45b6', pontos: 190, ticks: 2181 }, // semente oficial (= hashEsperado de PISTA_MORRO_DO_PINHAO)
  { semente: 1, hashPista: '02d8e8e29c9d955a', hashFinal: '2397ad7e7afbf426', pontos: 330, ticks: 2183 },
  { semente: 2, hashPista: 'efd2a151526472f5', hashFinal: '87a4463c5aa92dc0', pontos: 170, ticks: 2258 },
  { semente: 3, hashPista: '4e2448b6243ae405', hashFinal: 'abaa27393f3f649c', pontos: 865, ticks: 2247 },
];

function descerComBotCuidadoso(semente: number): { readonly hashPista: string; readonly hashFinal: string; readonly pontos: number; readonly ticks: number } {
  const pista = gerarPista({ ...PISTA_MORRO_DO_PINHAO, semente });
  const motor = criarDescida(pista, CONFIG_PADRAO); // a Capi É o CONFIG_PADRAO (plano §A.1)
  const bot = criarBotCuidadoso(pista);
  let leitura = motor.leitura();
  for (let i = 0; i < MAX_TICKS; i++) {
    leitura = motor.processar(bot(leitura));
    if (leitura.fase === 'chegou') break;
  }
  if (leitura.fase !== 'chegou') throw new Error(`semente ${semente}: bot não concluiu no teto de ticks deste teste`);
  return { hashPista: pista.hash, hashFinal: motor.hashEstado(), pontos: leitura.pontos, ticks: leitura.tick };
}

describe('F0 M3: congelamento da física/pontuação da Capi (CONFIG_PADRAO)', () => {
  for (const golden of GOLDEN_CAPI) {
    it(`semente ${golden.semente}: hashPista, hashFinal, pontos e ticks batem com o golden gravado`, () => {
      const resultado = descerComBotCuidadoso(golden.semente);
      expect(resultado).toEqual({
        hashPista: golden.hashPista,
        hashFinal: golden.hashFinal,
        pontos: golden.pontos,
        ticks: golden.ticks,
      });
    });
  }
});

describe('F0 M3: o Morro do Pinhão continua congelado', () => {
  it("gerarPista(PISTA_MORRO_DO_PINHAO).hash === '1c4d551601d3a6ae'", () => {
    expect(gerarPista(PISTA_MORRO_DO_PINHAO).hash).toBe('1c4d551601d3a6ae');
  });
});
