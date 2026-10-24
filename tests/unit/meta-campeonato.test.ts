/**
 * `meta/campeonato.ts` (plano `docs/plano-corrida-campeonato.md` §Arquitetura/C-D1, C5a): pontuação, classificação,
 * desempate, situação e o ciclo de vida de `EstadoCampeonato`.
 */
import { describe, expect, it } from 'vitest';
import type { ResultadoCorrida, ResumoDescida } from '../../src/core/contratos';
import {
  classificacao,
  desempate,
  iniciarCampeonato,
  pontosDaPosicao,
  registrarResultado,
  situacao,
} from '../../src/meta/campeonato';

const RESUMO_VAZIO: ResumoDescida = {
  pontos: 0,
  ticks: 0,
  tombos: 0,
  maiorVoltasNumSalto: 0,
  maiorTicksNoAr: 0,
  maiorGrindTicks: 0,
  pousosPerfeitos: 0,
  maiorMult: 0,
  maiorComboManobras: 0,
  bonecos: 0,
  concluiu: true,
};

/** `ResultadoCorrida` minimo, so com o `ordem` que `classificacao`/`situacao` de fato usam. */
function resultado(pista: string, ordem: readonly string[]): ResultadoCorrida {
  const ticks: Record<string, number> = {};
  ordem.forEach((id, i) => (ticks[id] = 1000 + i * 100));
  return { pista, ordem, ticks, resumoJogador: RESUMO_VAZIO, flocosGanhos: 0 };
}

const SEIS = ['jogador', 'bia', 'capi', 'bandeira', 'cidinha', 'beto'] as const;

describe('pontosDaPosicao', () => {
  it('10/8/6/4/2/1 para as posicoes 1..6 (plano C-D1)', () => {
    expect([1, 2, 3, 4, 5, 6].map(pontosDaPosicao)).toEqual([10, 8, 6, 4, 2, 1]);
  });

  it('fora de 1..6, ou nao inteiro, vale 0', () => {
    for (const p of [0, -1, 7, 100, 1.5, Number.NaN]) expect(pontosDaPosicao(p)).toBe(0);
  });
});

describe('classificacao', () => {
  it('soma pontosDaPosicao do ordem de cada pista; nunca um total guardado', () => {
    const r1 = resultado('vale', [...SEIS]);
    const r2 = resultado('cume', [SEIS[1] as string, SEIS[0] as string, ...SEIS.slice(2)]); // bia na frente agora
    const tabela = classificacao([r1, r2]);
    const jogador = tabela.find((c) => c.id === 'jogador');
    const bia = tabela.find((c) => c.id === 'bia');
    expect(jogador?.pontos).toBe(10 + 8); // 1o na vale, 2o no cume
    expect(bia?.pontos).toBe(8 + 10);
    expect(jogador?.vitorias).toBe(1);
    expect(bia?.vitorias).toBe(1);
  });

  it('ultimaPosicao reflete a ULTIMA pista da lista recebida (ordem de chamada, nao de pontos)', () => {
    const r1 = resultado('vale', [...SEIS]); // jogador 1o
    const r2 = resultado('cume', [SEIS[5] as string, ...SEIS.slice(0, 5)]); // jogador agora 2o
    const tabela = classificacao([r1, r2]);
    expect(tabela.find((c) => c.id === 'jogador')?.ultimaPosicao).toBe(2);
  });

  it('lista vazia -> classificacao vazia', () => {
    expect(classificacao([])).toEqual([]);
  });

  it('ordenada por desempate: pontos desc, depois vitorias, depois melhor ultimaPosicao', () => {
    const r1 = resultado('vale', [...SEIS]);
    const tabela = classificacao([r1]);
    expect(tabela.map((c) => c.id)).toEqual([...SEIS]); // mesma ordem de chegada = mesma ordem de pontos
    expect([...tabela].sort(desempate).map((c) => c.id)).toEqual(tabela.map((c) => c.id));
  });
});

describe('desempate', () => {
  it('mais pontos primeiro', () => {
    const a = { id: 'a', pontos: 10, vitorias: 0, ultimaPosicao: 1 };
    const b = { id: 'b', pontos: 8, vitorias: 5, ultimaPosicao: 1 };
    expect(desempate(a, b)).toBeLessThan(0);
  });

  it('pontos empatados: mais vitorias', () => {
    const a = { id: 'a', pontos: 10, vitorias: 2, ultimaPosicao: 3 };
    const b = { id: 'b', pontos: 10, vitorias: 1, ultimaPosicao: 1 };
    expect(desempate(a, b)).toBeLessThan(0);
  });

  it('pontos e vitorias empatados: melhor (menor) ultimaPosicao', () => {
    const a = { id: 'a', pontos: 10, vitorias: 1, ultimaPosicao: 2 };
    const b = { id: 'b', pontos: 10, vitorias: 1, ultimaPosicao: 1 };
    expect(desempate(a, b)).toBeGreaterThan(0);
  });
});

describe('situacao', () => {
  it('andamento enquanto faltar pista', () => {
    const r1 = resultado('vale', [...SEIS]);
    expect(situacao([r1], 'jogador')).toBe('andamento');
    expect(situacao([], 'jogador')).toBe('andamento');
  });

  it('vencido: total do jogador maior que TODOS os 5 adversarios nas 5 pistas', () => {
    const resultados = Array.from({ length: 5 }, (_, i) => resultado(`pista-${i}`, [...SEIS]));
    expect(situacao(resultados, 'jogador')).toBe('vencido');
  });

  it('perdido: empate em pontos com algum adversario NAO conta como vencido (> estrito, plano C-D1)', () => {
    const r1 = resultado('vale', [...SEIS]); // jogador 1o (10), bia 2o (8)
    const r2 = resultado('cume', [SEIS[1] as string, SEIS[0] as string, ...SEIS.slice(2)]); // bia 1o (10), jogador 2o (8)
    // jogador: 10+8=18; bia: 8+10=18 -> empate, "> estrito" significa que isso NAO e vitoria.
    expect(situacao([r1, r2], 'jogador', 2)).toBe('perdido');
  });

  it('perdido: algum adversario tem total maior que o jogador', () => {
    const resultados = Array.from({ length: 5 }, () => resultado('pista-x', [SEIS[1] as string, ...SEIS.slice(0, 1), ...SEIS.slice(2)]));
    expect(situacao(resultados, 'jogador')).toBe('perdido');
  });

  it('totalPistas injetavel (teste nao depende do 5 fixo)', () => {
    const resultados = [resultado('vale', [...SEIS]), resultado('cume', [...SEIS])];
    expect(situacao(resultados, 'jogador', 2)).toBe('vencido');
  });
});

describe('ciclo de vida do EstadoCampeonato', () => {
  it('iniciarCampeonato: etapa 0, sem pistas', () => {
    expect(iniciarCampeonato(42, 'kaka')).toEqual({ semente: 42, personagem: 'kaka', etapa: 0, pistasConcluidas: [] });
  });

  it('registrarResultado: grava o podio COMPLETO (nao so a posicao do jogador) e avanca a etapa; nao muta o estado anterior', () => {
    const estado0 = iniciarCampeonato(1, 'kaka');
    const ordem = [SEIS[2] as string, 'kaka', ...SEIS.slice(3)]; // kaka em 2o
    const r = resultado('vale', ordem);
    const estado1 = registrarResultado(estado0, r, 'kaka');
    expect(estado0.etapa).toBe(0);
    expect(estado1).toEqual({ semente: 1, personagem: 'kaka', etapa: 1, pistasConcluidas: [{ pista: 'vale', ordem, ticks: r.ticks['kaka'] }] });
  });

  it('classificacao/situacao funcionam direto sobre EstadoCampeonato.pistasConcluidas (apos reload, sem o ResultadoCorrida rico)', () => {
    let estado = iniciarCampeonato(1, 'jogador');
    for (let i = 0; i < 5; i++) estado = registrarResultado(estado, resultado(`pista-${i}`, [...SEIS]), 'jogador');
    expect(situacao(estado.pistasConcluidas, 'jogador')).toBe('vencido');
    expect(classificacao(estado.pistasConcluidas)[0]?.id).toBe('jogador');
  });
});
