/**
 * Catálogo de objetivos (`data/objetivos.ts`, plano M3 §B.4): forma válida, ids batendo com `REGRAS_SAVE.objetivos`
 * e `CondicaoObjetivo.campo` sempre dentro de `CAMPOS_RESUMO_DESCIDA` (senão, quando `descida/resumo.ts` nascer na
 * F5, as duas listas divergem em silêncio).
 */
import { describe, expect, it } from 'vitest';
import { CAMPOS_RESUMO_DESCIDA } from '../../src/core/contratos';
import { OBJETIVOS_DE_DADOS, PICOLE_O1, PICOLE_O2, PICOLE_O3, problemasDosObjetivosDeDados, VILA_O1, VILA_O2, VILA_O3 } from '../../src/data/objetivos';
import { REGRAS_SAVE } from '../../src/data/regras-save';

describe('OBJETIVOS_DE_DADOS: validação de forma', () => {
  it('não acusa nenhum problema (catálogo publicado é válido)', () => {
    expect(problemasDosObjetivosDeDados()).toEqual([]);
  });

  it('os 3 objetivos do Picolé e os 3 da Vila existem, na ordem o1..o3, e estão em REGRAS_SAVE.objetivos', () => {
    expect(OBJETIVOS_DE_DADOS.map((d) => d.id)).toEqual([
      'pico-do-picole-o1',
      'pico-do-picole-o2',
      'pico-do-picole-o3',
      'vila-chocolate-o1',
      'vila-chocolate-o2',
      'vila-chocolate-o3',
    ]);
    for (const def of OBJETIVOS_DE_DADOS) expect(REGRAS_SAVE.objetivos).toContain(def.id);
  });

  it('o1 é "minimo" sobre maiorGrindTicks, o2 sobre maiorMult, o3 sobre pontos (escada de dificuldade do plano)', () => {
    expect(PICOLE_O1.condicao).toMatchObject({ tipo: 'minimo', campo: 'maiorGrindTicks' });
    expect(PICOLE_O2.condicao).toMatchObject({ tipo: 'minimo', campo: 'maiorMult', valor: 3 });
    expect(PICOLE_O3.condicao).toMatchObject({ tipo: 'minimo', campo: 'pontos', valor: 15_000 });
    expect(VILA_O1.condicao).toMatchObject({ tipo: 'minimo', campo: 'maiorGrindTicks' });
    expect(VILA_O2.condicao).toMatchObject({ tipo: 'minimo', campo: 'maiorMult', valor: 4 });
    expect(VILA_O3.condicao).toMatchObject({ tipo: 'minimo', campo: 'pontos', valor: 18_000 });
  });

  it('todo CondicaoObjetivo.campo (inclusive dentro de "todos") está em CAMPOS_RESUMO_DESCIDA', () => {
    function campos(c: (typeof OBJETIVOS_DE_DADOS)[number]['condicao']): string[] {
      if (c.tipo === 'minimo' || c.tipo === 'maximo') return [c.campo];
      if (c.tipo === 'todos') return c.condicoes.flatMap(campos);
      return [];
    }
    for (const def of OBJETIVOS_DE_DADOS) {
      for (const campo of campos(def.condicao)) expect(CAMPOS_RESUMO_DESCIDA as readonly string[]).toContain(campo);
    }
  });

  it('acusa pista que não existe em REGRAS_SAVE.pistas (mutação)', () => {
    const quebrado = [{ ...PICOLE_O1, pista: 'pista-que-nao-existe' }];
    expect(problemasDosObjetivosDeDados(quebrado, REGRAS_SAVE).some((p) => p.includes('pista'))).toBe(true);
  });

  it('acusa campo fora de CAMPOS_RESUMO_DESCIDA (mutação)', () => {
    const quebrado = [{ ...PICOLE_O1, condicao: { tipo: 'minimo' as const, campo: 'campo-inventado' as never, valor: 1 } }];
    expect(problemasDosObjetivosDeDados(quebrado, REGRAS_SAVE).some((p) => p.includes('CAMPOS_RESUMO_DESCIDA'))).toBe(true);
  });

  it('acusa id repetido (mutação)', () => {
    expect(problemasDosObjetivosDeDados([PICOLE_O1, PICOLE_O1], REGRAS_SAVE).some((p) => p.includes('repetido'))).toBe(true);
  });
});
