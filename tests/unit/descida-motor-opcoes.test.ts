/**
 * `criarDescida(pista, config, opcoes?)` (plano `docs/plano-corrida-campeonato.md` §Contratos, C0): o 3º parâmetro
 * é novo, mas OMITIR (nem `{}`, nem `{modo:'treino'}`, nem sem `camada`) não muda NADA do resultado hoje. Prova
 * objetiva de "nível 0 + treino = idêntico a hoje" além do golden da Capi em `m3-congelamento-capi.test.ts`.
 * A prova de que uma `camada` de VERDADE afeta o motor (C3: kicker, coleta, turbo de pouso) é
 * `descida-motor-camada.test.ts` — este arquivo só prova a parte "sem camada = sem mudança".
 */
import { describe, expect, it } from 'vitest';
import type { CamadaJogo } from '../../src/core/contratos';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { CONFIG_PADRAO } from '../../src/descida/constantes';
import { criarDescida } from '../../src/descida/motor';
import { gerarPista } from '../../src/pista/gerador';

const MAX_TICKS = 16200;
/** Uma camada bem distante de qualquer coisa que o jogador vai tocar: prova que camada VAZIA de efeito = sem camada. */
const CAMADA_SEM_EFEITO: CamadaJogo = { itens: [], kickers: [], obstaculosAltos: [], porticoX: 999999, versao: '1', hash: '0000000000000000' };

/** Só o que a física/pontuação já expunha ANTES deste parâmetro novo existir — nunca `motor.modo` (ver teste dedicado). */
function fisicaDe(opcoes?: Parameters<typeof criarDescida>[2]) {
  const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
  const motor = opcoes === undefined ? criarDescida(pista, CONFIG_PADRAO) : criarDescida(pista, CONFIG_PADRAO, opcoes);
  const bot = criarBotCuidadoso(pista);
  let leitura = motor.leitura();
  for (let i = 0; i < MAX_TICKS; i++) {
    leitura = motor.processar(bot(leitura));
    if (leitura.fase === 'chegou') break;
  }
  return { hashFinal: motor.hashEstado(), pontos: leitura.pontos, ticks: leitura.tick };
}
const descer = fisicaDe;

describe('criarDescida: opcoes novo (modo/camada) não muda o resultado hoje', () => {
  it('omitir opcoes, {} e {modo: "treino"} dão EXATAMENTE o mesmo resultado', () => {
    const semOpcoes = descer(undefined);
    const vazio = descer({});
    const treinoExplicito = descer({ modo: 'treino' });
    expect(vazio).toEqual(semOpcoes);
    expect(treinoExplicito).toEqual(semOpcoes);
  });

  it('modo "corrida" agora PODE mudar a física (turbo de pouso, C3): pontos iguais, hash/ticks podem diferir', () => {
    const treino = descer(undefined);
    const corrida = descer({ modo: 'corrida' });
    expect(corrida.pontos).toBe(treino.pontos); // turbo nunca muda pontuação, só velocidade.
    expect(corrida.ticks).toBeLessThanOrEqual(treino.ticks); // turbo só ajuda a chegar, nunca atrasa.
  });

  it('uma "camada" sem kickers/itens no caminho do bot não afeta nada (C3: sem camada = camada sem efeito)', () => {
    expect(descer({ camada: CAMADA_SEM_EFEITO })).toEqual(descer(undefined));
  });

  it('motor.modo reflete o que foi pedido (padrão "treino")', () => {
    expect(criarDescida(gerarPista(PISTA_MORRO_DO_PINHAO), CONFIG_PADRAO).modo).toBe('treino');
    expect(criarDescida(gerarPista(PISTA_MORRO_DO_PINHAO), CONFIG_PADRAO, { modo: 'corrida' }).modo).toBe('corrida');
  });
});
