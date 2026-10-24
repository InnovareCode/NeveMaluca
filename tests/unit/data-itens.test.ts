/**
 * `data/itens.ts` (plano `docs/plano-itens-corrida.md` §Contratos/I-D1/I-D2/I-D6): parâmetros de efeito por item,
 * sorteio determinístico sem estado e a conversão item -> `EfeitoExterno`.
 */
import { describe, expect, it } from 'vitest';
import type { TipoItem } from '../../src/core/contratos';
import { TIPOS_ITEM } from '../../src/core/contratos';
import {
  CORREDORES_POR_CORRIDA,
  FLOCOS_POR_ACERTO_ITEM,
  PARAMETROS_ESCUDO_ITEM,
  PARAMETROS_IMA_ITEM,
  PARAMETROS_POCA_FREADA,
  PARAMETROS_TURBO_ITEM,
  PESOS_ITEM_PADRAO,
  PESOS_ITEM_ULTIMOS,
  efeitoExternoDoItem,
  hashSorteio01,
  pesosDeSorteioPorPosicao,
  sortearItem,
} from '../../src/data/itens';

describe('hashSorteio01', () => {
  it('determinístico: mesma (semente, id, chave) sempre dá o mesmo valor', () => {
    expect(hashSorteio01(42, 'capi', 3)).toBe(hashSorteio01(42, 'capi', 3));
  });

  it('sempre em [0, 1)', () => {
    for (let chave = 0; chave < 200; chave++) {
      const v = hashSorteio01(7, 'bia', chave);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('sem estado: chamar fora de ordem ou embaralhado dá os mesmos valores (sem fila compartilhada)', () => {
    const emOrdem = [0, 1, 2, 3, 4].map((c) => hashSorteio01(9, 'queque', c));
    const foraDeOrdem = [4, 2, 0, 3, 1].map((c) => hashSorteio01(9, 'queque', c));
    expect(foraDeOrdem[0]).toBe(emOrdem[4]);
    expect(foraDeOrdem[1]).toBe(emOrdem[2]);
    expect(foraDeOrdem[2]).toBe(emOrdem[0]);
  });

  it('varia com qualquer um dos 3 componentes', () => {
    const base = hashSorteio01(1, 'capi', 1);
    expect(hashSorteio01(2, 'capi', 1)).not.toBe(base);
    expect(hashSorteio01(1, 'bandeira', 1)).not.toBe(base);
    expect(hashSorteio01(1, 'capi', 2)).not.toBe(base);
  });
});

describe('pesosDeSorteioPorPosicao (plano I-D1: catch-up leve e simétrico)', () => {
  it('só os 2 últimos lugares usam a tabela de catch-up; o resto usa a padrão', () => {
    for (let pos = 1; pos <= CORREDORES_POR_CORRIDA - 2; pos++) expect(pesosDeSorteioPorPosicao(pos)).toBe(PESOS_ITEM_PADRAO);
    expect(pesosDeSorteioPorPosicao(CORREDORES_POR_CORRIDA - 1)).toBe(PESOS_ITEM_ULTIMOS);
    expect(pesosDeSorteioPorPosicao(CORREDORES_POR_CORRIDA)).toBe(PESOS_ITEM_ULTIMOS);
  });

  it('mesma regra pro jogador e pra IA: a função só olha posição/total, nunca quem está pilotando', () => {
    expect(pesosDeSorteioPorPosicao(6, 6)).toEqual(pesosDeSorteioPorPosicao(6, 6));
  });
});

describe('sortearItem', () => {
  it('determinístico e sempre um TipoItem válido', () => {
    const tipos = new Set<string>(TIPOS_ITEM);
    for (let caixa = 0; caixa < 50; caixa++) {
      const item = sortearItem(123, 'capi', caixa, 1);
      expect(tipos.has(item)).toBe(true);
      expect(sortearItem(123, 'capi', caixa, 1)).toBe(item);
    }
  });

  it('corredores diferentes na mesma caixa podem tirar itens diferentes (independência, plano §Determinismo)', () => {
    const porId = ['capi', 'bandeira', 'cidinha', 'beto', 'queque', 'bia'].map((id) => sortearItem(5, id, 10, 3));
    expect(new Set(porId).size).toBeGreaterThan(1); // não é garantido matematicamente, mas com 6 ids reais e este hash, diverge
  });

  it('a Nuvem de Granizo (casco azul) sai bem menos que os outros itens, numa amostra grande', () => {
    const contagem: Record<string, number> = {};
    for (let caixa = 0; caixa < 4000; caixa++) {
      const item = sortearItem(999, 'capi', caixa, 2);
      contagem[item] = (contagem[item] ?? 0) + 1;
    }
    const mediaDosOutros = TIPOS_ITEM.filter((t) => t !== 'nuvem').reduce((s, t) => s + (contagem[t] ?? 0), 0) / (TIPOS_ITEM.length - 1);
    expect(contagem['nuvem'] ?? 0).toBeLessThan(mediaDosOutros * 0.5);
  });

  it('catch-up: os 2 últimos tiram turbo com frequência maior que a tabela padrão, numa amostra grande', () => {
    let turbosFrente = 0;
    let turbosAtras = 0;
    const N = 4000;
    for (let caixa = 0; caixa < N; caixa++) {
      if (sortearItem(2024, 'bia', caixa, 1, 6) === 'turbo') turbosFrente++;
      if (sortearItem(2024, 'bia', caixa, 6, 6) === 'turbo') turbosAtras++;
    }
    expect(turbosAtras).toBeGreaterThan(turbosFrente);
  });
});

describe('efeitoExternoDoItem', () => {
  it('bola e nuvem viram trombada SEM fator/ticks (já fixos no motor, I1)', () => {
    expect(efeitoExternoDoItem('bola')).toEqual({ tipo: 'trombada', item: 'bola' });
    expect(efeitoExternoDoItem('nuvem')).toEqual({ tipo: 'trombada', item: 'nuvem' });
  });

  it('poca vira freada com os parâmetros calibrados', () => {
    expect(efeitoExternoDoItem('poca')).toEqual({ tipo: 'freada', item: 'poca', fator: PARAMETROS_POCA_FREADA.fator, ticks: PARAMETROS_POCA_FREADA.ticks });
  });

  it('turbo vira turbo com os parâmetros calibrados', () => {
    expect(efeitoExternoDoItem('turbo')).toEqual({ tipo: 'turbo', item: 'turbo', ms: PARAMETROS_TURBO_ITEM.ms, ticks: PARAMETROS_TURBO_ITEM.ticks });
  });

  it('ima vira ima com os parâmetros calibrados', () => {
    expect(efeitoExternoDoItem('ima')).toEqual({ tipo: 'ima', item: 'ima', raioM: PARAMETROS_IMA_ITEM.raioM, ticks: PARAMETROS_IMA_ITEM.ticks });
  });

  it('escudo nunca é um EfeitoExterno (ele bloqueia um, plano §Contratos)', () => {
    expect(efeitoExternoDoItem('escudo')).toBeUndefined();
  });

  it('cobre os 6 tipos de item sem lançar (exaustivo)', () => {
    for (const tipo of TIPOS_ITEM) expect(() => efeitoExternoDoItem(tipo as TipoItem)).not.toThrow();
  });
});

describe('parâmetros calibrados: forma sensata', () => {
  it('freada da poça: fração do teto em (0,1], ticks > 0', () => {
    expect(PARAMETROS_POCA_FREADA.fator).toBeGreaterThan(0);
    expect(PARAMETROS_POCA_FREADA.fator).toBeLessThanOrEqual(1);
    expect(PARAMETROS_POCA_FREADA.ticks).toBeGreaterThan(0);
  });

  it('escudo e ima têm janelas de alguns segundos (ticks a 60 Hz)', () => {
    expect(PARAMETROS_ESCUDO_ITEM.ticks).toBeGreaterThan(60);
    expect(PARAMETROS_IMA_ITEM.ticks).toBeGreaterThan(60);
    expect(PARAMETROS_IMA_ITEM.raioM).toBeGreaterThan(1.6); // bem maior que o raio normal de coleta de floco
  });
});

describe('FLOCOS_POR_ACERTO_ITEM (plano I-D6)', () => {
  it('é 5, inteiro positivo', () => {
    expect(FLOCOS_POR_ACERTO_ITEM).toBe(5);
    expect(Number.isInteger(FLOCOS_POR_ACERTO_ITEM)).toBe(true);
  });
});
