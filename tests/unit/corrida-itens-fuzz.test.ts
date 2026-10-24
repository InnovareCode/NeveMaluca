/**
 * Fuzzing leve e determinístico do núcleo de itens (`docs/plano-itens-corrida.md` §Núcleo, I2 teste): a Vega provou
 * a ORDEM permutada para 1 cenário só (semente=99, `usarItem` sempre `true`, `tests/unit/corrida-itens.test.ts`).
 * Este arquivo varre VÁRIAS sementes x VÁRIAS sequências de `usarItem` (cada uma derivada por hash da própria
 * semente via `criarRng`, então 100% reprodutível) x 2 pistas, caçando um empate exato de posição/distância que o
 * único cenário da Vega não cobre — é exatamente onde o desempate por `id` (`porId`/`compararIds`, nunca a ordem de
 * `participantes`) pode falhar se algum ponto do código esquecer de usá-lo.
 *
 * Em cada cenário, as DUAS corridas (ordem normal e ordem embaralhada) usam a MESMA sequência de `usarItem`
 * (gerador de RNG reiniciado com a mesma semente a cada chamada de `rodar` — plano §Determinismo: a física não
 * depende da ordem de `participantes`, então o Nº de ticks até a chegada do jogador é igual nas duas, e os dois
 * geradores avançam em lockstep). Comparação tick a tick (não só no final): se divergir, a mensagem aponta a
 * semente, a pista e o tick exatos.
 */
import { describe, expect, it } from 'vitest';
import type { ComandoCorrida, ParticipanteCorrida } from '../../src/core/contratos';
import { criarRng } from '../../src/core/rng';
import { PERSONAGENS_DE_DADOS } from '../../src/data/personagens';
import { PISTA_MORRO_DO_PINHAO, PISTA_PICO_DO_PICOLE } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { gerarCamadaJogo } from '../../src/pista/camada-jogo';
import { gerarPista } from '../../src/pista/gerador';
import { criarCorrida } from '../../src/corrida/corrida';

const MAX_TICKS = 16200; // mesmo teto generoso do golden do F0 e dos harnesses de bot/corrida.
const IDS_PADRAO = PERSONAGENS_DE_DADOS.map((d) => d.id);
const ID_JOGADOR = 'capi';

// Sementes de fuzz (arbitrárias, só precisam ser fixas pra reprodutibilidade — Fibonacci por conveniência de leitura).
const SEMENTES_FUZZ = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233];
// Probabilidade de `usarItem=true` em cada tick, ciclando por cenário (de "quase nunca" a "quase sempre") — cobre
// timings de uso bem diferentes dos 2 extremos já testados pela Vega (sempre `true`) e pelo 1º teste (idem).
const PROBABILIDADES_USAR_ITEM = [0.15, 0.4, 0.7, 0.95];

const PISTAS_FUZZ = [
  { nome: 'morro-do-pinhao', def: PISTA_MORRO_DO_PINHAO },
  { nome: 'pico-do-picole', def: PISTA_PICO_DO_PICOLE },
];

function participantesEm(ids: readonly string[], idJogador: string): ParticipanteCorrida[] {
  return ids.map((id) => {
    const def = PERSONAGENS_DE_DADOS.find((d) => d.id === id)!;
    return { id, config: def, piloto: id === idJogador ? { tipo: 'jogador' as const } : { tipo: 'ia' as const, perfil: id, nivel: 0 } };
  });
}

/** Fisher-Yates com RNG derivado da semente do cenário (independente do RNG de `usarItem` — fluxos separados não
 *  se misturam, senão a mesma semente geraria sequências de item diferentes entre ordem A e ordem B). */
function embaralhar(ids: readonly string[], semente: number): string[] {
  const arr = [...ids];
  const rng = criarRng((semente ^ 0x5bd1e995) | 0);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng.inteiro(i + 1);
    const tmp = arr[i] as string;
    arr[i] = arr[j] as string;
    arr[j] = tmp;
  }
  return arr;
}

interface ResultadoRodada {
  readonly trilhaHash: readonly string[];
  readonly resultado: ReturnType<ReturnType<typeof criarCorrida>['finalizar']>;
}

function rodar(ordem: readonly string[], semente: number, pista: ReturnType<typeof gerarPista>, camada: ReturnType<typeof gerarCamadaJogo>, probabilidadeUsarItem: number): ResultadoRodada {
  const corrida = criarCorrida({ pista, camada, semente, participantes: participantesEm(ordem, ID_JOGADOR) });
  const bot = criarBotCuidadoso(pista, {}, camada.obstaculosAltos);
  const rngItem = criarRng(semente); // reiniciado aqui: mesma sequência de `usarItem` em QUALQUER ordem de participantes.
  let leitura = corrida.leitura();
  const trilhaHash: string[] = [];
  for (let i = 0; i < MAX_TICKS && leitura.jogador.fase !== 'chegou'; i++) {
    const cmd: ComandoCorrida = { descida: bot(leitura.jogador), usarItem: rngItem.proximo() < probabilidadeUsarItem };
    leitura = corrida.processar(cmd);
    trilhaHash.push(corrida.hashEstado());
  }
  if (leitura.jogador.fase !== 'chegou') {
    throw new Error(`cenário semente=${semente}: jogador não chegou em ${MAX_TICKS} ticks (teto de segurança do fuzz)`);
  }
  return { trilhaHash, resultado: corrida.finalizar() };
}

describe('corrida + itens: fuzz determinístico — várias sementes x várias sequências de usarItem x ordem embaralhada', () => {
  for (const { nome: nomePista, def: defPista } of PISTAS_FUZZ) {
    describe(`pista ${nomePista}`, () => {
      for (let idx = 0; idx < SEMENTES_FUZZ.length; idx++) {
        const semente = SEMENTES_FUZZ[idx] as number;
        const probabilidadeUsarItem = PROBABILIDADES_USAR_ITEM[idx % PROBABILIDADES_USAR_ITEM.length] as number;

        it(`semente=${semente}, p(usarItem)=${probabilidadeUsarItem}: ordem embaralhada bate hashEstado tick a tick e ResultadoCorrida com a ordem padrão`, () => {
          const pista = gerarPista(defPista);
          const camada = gerarCamadaJogo(pista, defPista);
          const ordemEmbaralhada = embaralhar(IDS_PADRAO, semente);

          const a = rodar(IDS_PADRAO, semente, pista, camada, probabilidadeUsarItem);
          const b = rodar(ordemEmbaralhada, semente, pista, camada, probabilidadeUsarItem);

          expect(b.trilhaHash.length, `semente=${semente}, pista=${nomePista}: nº de ticks até a chegada diverge entre ordens (${a.trilhaHash.length} vs ${b.trilhaHash.length}) — já aponta física lendo a ordem de participantes`).toBe(a.trilhaHash.length);
          for (let tick = 0; tick < a.trilhaHash.length; tick++) {
            expect(b.trilhaHash[tick], `semente=${semente}, pista=${nomePista}, tick=${tick}: hashEstado diverge entre ordem padrão e ordem embaralhada (${JSON.stringify(ordemEmbaralhada)})`).toBe(a.trilhaHash[tick]);
          }
          expect(b.resultado, `semente=${semente}, pista=${nomePista}: ResultadoCorrida diverge entre ordens`).toEqual(a.resultado);
        });
      }
    });
  }
});
