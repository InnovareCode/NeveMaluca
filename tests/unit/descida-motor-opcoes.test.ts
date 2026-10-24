/**
 * `criarDescida(pista, config, opcoes?)` (plano `docs/plano-corrida-campeonato.md` §Contratos, C0): o 3º parâmetro
 * é novo, mas por construção não muda NADA do resultado hoje — nem omitido, nem `{}`, nem `{modo:'treino'}`, nem
 * com uma `camada` qualquer (C3 ainda não lê isso). Prova objetiva de "nível 0 + treino = idêntico a hoje" além do
 * golden da Capi em `m3-congelamento-capi.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import type { ObjetoPista } from '../../src/core/contratos';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { CONFIG_PADRAO } from '../../src/descida/constantes';
import { criarDescida } from '../../src/descida/motor';
import { gerarPista } from '../../src/pista/gerador';

const MAX_TICKS = 16200;
const CAMADA_QUALQUER: readonly ObjetoPista[] = [{ tipo: 'floco', x: 100, largura: 1, altura: 1.5, variante: 0 }];

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

  it('modo "corrida" ainda não afeta a física/pontuação (turbo de pouso é C3/C6, não C0/C2a)', () => {
    expect(descer({ modo: 'corrida' })).toEqual(descer(undefined));
  });

  it('uma "camada" qualquer ainda não afeta nada (C3 não implementada): motor só aceita e ignora', () => {
    expect(descer({ camada: CAMADA_QUALQUER })).toEqual(descer(undefined));
  });

  it('motor.modo reflete o que foi pedido (padrão "treino")', () => {
    expect(criarDescida(gerarPista(PISTA_MORRO_DO_PINHAO), CONFIG_PADRAO).modo).toBe('treino');
    expect(criarDescida(gerarPista(PISTA_MORRO_DO_PINHAO), CONFIG_PADRAO, { modo: 'corrida' }).modo).toBe('corrida');
  });
});
