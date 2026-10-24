/**
 * `data/evolucao.ts` (plano `docs/plano-corrida-campeonato.md` §Arquitetura/C-D3/C-D4, C5a): custo por nível,
 * compra (carteira única de flocos) e a conversão de uma corrida em flocos ganhos.
 */
import { describe, expect, it } from 'vitest';
import type { ResultadoCorrida, ResumoDescida } from '../../src/core/contratos';
import {
  ATRIBUTOS_EVOLUCAO,
  comprarNivel,
  custoAcumulado,
  custoDoNivel,
  flocosDaCorrida,
  FLOCOS_POR_PONTOS,
  NIVEL_MAXIMO_EVOLUCAO,
} from '../../src/data/evolucao';

describe('custoDoNivel / custoAcumulado', () => {
  it('nivel 1..5 tem custo positivo, crescente; fora da faixa é undefined', () => {
    let anterior = 0;
    for (let n = 1; n <= NIVEL_MAXIMO_EVOLUCAO; n++) {
      const custo = custoDoNivel(n) as number;
      expect(custo).toBeGreaterThan(anterior);
      anterior = custo;
    }
    for (const fora of [0, -1, NIVEL_MAXIMO_EVOLUCAO + 1, 1.5, Number.NaN]) expect(custoDoNivel(fora)).toBeUndefined();
  });

  it('custoAcumulado(0, 5) é a soma de todos os 5 níveis', () => {
    const soma = Array.from({ length: NIVEL_MAXIMO_EVOLUCAO }, (_, i) => custoDoNivel(i + 1) as number).reduce((a, b) => a + b, 0);
    expect(custoAcumulado(0, NIVEL_MAXIMO_EVOLUCAO)).toBe(soma);
  });

  it('custoAcumulado(nivelAlvo <= nivelAtual) é 0; fora da faixa é undefined', () => {
    expect(custoAcumulado(3, 3)).toBe(0);
    expect(custoAcumulado(3, 1)).toBe(0);
    expect(custoAcumulado(-1, 3)).toBeUndefined();
    expect(custoAcumulado(0, NIVEL_MAXIMO_EVOLUCAO + 1)).toBeUndefined();
  });
});

describe('comprarNivel', () => {
  it('com flocos suficientes: sobe 1 nível e debita o custo exato; não muta a entrada', () => {
    const custoNivel1 = custoDoNivel(1) as number;
    const evolucao = { flocos: custoNivel1 + 5, niveis: {} };
    const antes = JSON.stringify(evolucao);
    const r = comprarNivel(evolucao, 'kaka');
    expect(JSON.stringify(evolucao)).toBe(antes);
    expect(r).toEqual({ comprou: true, evolucao: { flocos: 5, niveis: { kaka: 1 } } });
  });

  it('sem flocos: nao compra, devolve a evolucao intacta', () => {
    const evolucao = { flocos: 0, niveis: {} };
    expect(comprarNivel(evolucao, 'kaka')).toEqual({ comprou: false, evolucao });
  });

  it('no teto (NIVEL_MAXIMO_EVOLUCAO): nao compra mesmo com flocos de sobra', () => {
    const evolucao = { flocos: 999_999, niveis: { kaka: NIVEL_MAXIMO_EVOLUCAO } };
    expect(comprarNivel(evolucao, 'kaka')).toEqual({ comprou: false, evolucao });
  });

  it('personagens diferentes têm níveis independentes (carteira de flocos é a única coisa compartilhada)', () => {
    const custoNivel1 = custoDoNivel(1) as number;
    const r1 = comprarNivel({ flocos: custoNivel1 * 2, niveis: {} }, 'kaka');
    const r2 = comprarNivel(r1.evolucao, 'pingu');
    expect(r2.evolucao.niveis).toEqual({ kaka: 1, pingu: 1 });
  });
});

const RESUMO = (pontos: number, concluiu = true): ResumoDescida => ({
  pontos,
  ticks: 1000,
  tombos: 0,
  maiorVoltasNumSalto: 0,
  maiorTicksNoAr: 0,
  maiorGrindTicks: 0,
  pousosPerfeitos: 0,
  maiorMult: 0,
  maiorComboManobras: 0,
  bonecos: 0,
  concluiu,
});

function resultado(ordem: readonly string[], pontosJogador: number, concluiu = true): ResultadoCorrida {
  const ticks: Record<string, number> = {};
  ordem.forEach((id) => (ticks[id] = 1000));
  return { pista: 'vale', ordem, ticks, resumoJogador: RESUMO(pontosJogador, concluiu), flocosGanhos: 0 };
}

describe('flocosDaCorrida', () => {
  it('nao concluiu: 0 flocos, mesmo com pontos', () => {
    expect(flocosDaCorrida(resultado(['jogador', 'bia'], 10_000, false), 'jogador')).toBe(0);
  });

  it('pontos convertidos (FLOCOS_POR_PONTOS) + bonus de podio pela posicao', () => {
    const r1o = resultado(['jogador', 'bia', 'capi'], FLOCOS_POR_PONTOS * 3);
    const flocos1o = flocosDaCorrida(r1o, 'jogador');
    const r3o = resultado(['bia', 'capi', 'jogador'], FLOCOS_POR_PONTOS * 3);
    const flocos3o = flocosDaCorrida(r3o, 'jogador');
    expect(flocos1o).toBeGreaterThan(flocos3o); // mesmos pontos, mas o 1o lugar ganha bonus maior
    expect(flocos1o).toBe(3 + 8); // 3 flocos dos pontos + bonus do 1o lugar
    expect(flocos3o).toBe(3 + 4); // bonus do 3o lugar
  });

  it('ultimo lugar (sem bonus) so converte os pontos', () => {
    const r = resultado(['bia', 'capi', 'bandeira', 'cidinha', 'beto', 'jogador'], FLOCOS_POR_PONTOS * 2);
    expect(flocosDaCorrida(r, 'jogador')).toBe(2);
  });
});

describe('ATRIBUTOS_EVOLUCAO', () => {
  it('os 3 atributos do plano C-D4 (giro fica fora)', () => {
    expect(ATRIBUTOS_EVOLUCAO).toEqual(['velocidade', 'equilibrio', 'forca']);
  });
});
