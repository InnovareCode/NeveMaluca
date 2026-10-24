/**
 * Núcleo da corrida (plano `docs/plano-corrida-campeonato.md` §Arquitetura, C2a): forma da `LeituraCorrida`, os 6
 * chegando (pódio na hora via `finalizar()`) e determinismo do `ResultadoCorrida`.
 */
import { describe, expect, it } from 'vitest';
import type { ComandoDescida, ParticipanteCorrida } from '../../src/core/contratos';
import { PERSONAGENS_DE_DADOS } from '../../src/data/personagens';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { gerarPista } from '../../src/pista/gerador';
import { criarCorrida } from '../../src/corrida/corrida';

const MAX_TICKS_JOGADOR = 16200; // mesmo teto generoso do golden do F0 e dos harnesses de bot.
const CMD_VAZIO: ComandoDescida = { pulo: false, giro: 0, grab: null, agachar: false };

function participantes(idJogador: string): ParticipanteCorrida[] {
  return PERSONAGENS_DE_DADOS.map((def) => ({
    id: def.id,
    config: def,
    piloto: def.id === idJogador ? { tipo: 'jogador' as const } : { tipo: 'ia' as const, perfil: def.id, nivel: 0 },
  }));
}

/** Jogador dirigido pelo bot "cuidadoso" até chegar (ou até o teto); depois `finalizar()` fecha o pódio. */
function correrCorridaCompleta(semente: number, idJogador = 'capi') {
  const pista = gerarPista({ ...PISTA_MORRO_DO_PINHAO, semente });
  const corrida = criarCorrida({ pista, semente, participantes: participantes(idJogador) });
  const bot = criarBotCuidadoso(pista);
  let leitura = corrida.leitura();
  for (let i = 0; i < MAX_TICKS_JOGADOR && leitura.jogador.fase !== 'chegou'; i++) {
    leitura = corrida.processar(bot(leitura.jogador));
  }
  const resultado = corrida.finalizar();
  return { leituraFinal: leitura, resultado };
}

describe('criarCorrida: forma e regras básicas', () => {
  it('exige exatamente um participante com piloto jogador', () => {
    const semJogador: ParticipanteCorrida[] = PERSONAGENS_DE_DADOS.map((def) => ({
      id: def.id,
      config: def,
      piloto: { tipo: 'ia' as const, perfil: def.id, nivel: 0 },
    }));
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    expect(() => criarCorrida({ pista, semente: 1, participantes: semJogador })).toThrow();
  });

  it('leitura() antes de processar: fase "contagem", 5 rivais (6 participantes), sem chegadas', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const corrida = criarCorrida({ pista, semente: 1, participantes: participantes('capi') });
    const leitura = corrida.leitura();
    expect(leitura.jogador.fase).toBe('contagem');
    expect(leitura.rivais).toHaveLength(5);
    expect(leitura.posicoes).toHaveLength(6);
    expect(leitura.chegadas).toEqual([]);
  });

  it('cada processar() avança 1 tick (jogador e corrida andam juntos)', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const corrida = criarCorrida({ pista, semente: 1, participantes: participantes('capi') });
    const l1 = corrida.processar(CMD_VAZIO);
    const l2 = corrida.processar(CMD_VAZIO);
    expect(l2.tick).toBe(l1.tick + 1);
    expect(l2.jogador.tick).toBe(l1.jogador.tick + 1);
  });
});

describe('criarCorrida: os 6 chegam e o pódio sai na hora', () => {
  it('semente oficial do Morro: os 6 participantes chegam, sem duplicado nem id faltando', () => {
    const { resultado } = correrCorridaCompleta(20261022);
    expect(resultado.ordem).toHaveLength(6);
    expect(new Set(resultado.ordem).size).toBe(6);
    for (const id of resultado.ordem) expect(resultado.ticks[id], id).toBeGreaterThan(0);
  });

  it('resumoJogador bate com a leitura final do jogador (concluiu, pontos, ticks)', () => {
    const { leituraFinal, resultado } = correrCorridaCompleta(1);
    expect(resultado.resumoJogador.concluiu).toBe(true);
    expect(resultado.resumoJogador.pontos).toBe(leituraFinal.jogador.pontos);
    expect(resultado.ticks['capi']).toBe(leituraFinal.jogador.tick);
  });
});

describe('criarCorrida: determinismo', () => {
  it('mesma semente + mesmos comandos do jogador (bot) => sempre o mesmo ResultadoCorrida', () => {
    const a = correrCorridaCompleta(42);
    const b = correrCorridaCompleta(42);
    expect(a.resultado).toEqual(b.resultado);
  });
});
