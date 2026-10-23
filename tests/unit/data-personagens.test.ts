/**
 * Elenco final do M3 (`docs/elenco-m3.md` §4): soma 500, inteiros 90..110, casa/desbloqueio válidos contra
 * `REGRAS_SAVE`, e a regra de desenho "cada atributo tem um único dono do 110" (não derruba o boot — plano §A.3 —
 * mas tem que valer, senão a Capi vira "mais um" em algum atributo e a ficha perde sentido).
 */
import { describe, expect, it } from 'vitest';
import { ATRIBUTOS } from '../../src/core/contratos';
import {
  atributosComMaisDeUmDonoDe110,
  PERSONAGENS_DE_DADOS,
  problemasDosPersonagensDeDados,
} from '../../src/data/personagens';
import { REGRAS_SAVE } from '../../src/data/regras-save';

describe('PERSONAGENS_DE_DADOS: validação de forma', () => {
  it('não acusa nenhum problema (elenco publicado é válido)', () => {
    expect(problemasDosPersonagensDeDados()).toEqual([]);
  });

  it('são os 6 ids de REGRAS_SAVE.personagens, sem faltar nem sobrar', () => {
    const ids = PERSONAGENS_DE_DADOS.map((d) => d.id);
    expect(new Set(ids)).toEqual(new Set(REGRAS_SAVE.personagens));
    expect(ids).toHaveLength(6);
  });

  it('cada personagem soma exatamente 500 e cada atributo cai em 90..110', () => {
    for (const def of PERSONAGENS_DE_DADOS) {
      const soma = ATRIBUTOS.reduce((acc, a) => acc + def.atributos[a], 0);
      expect(soma, `soma de ${def.id}`).toBe(500);
      for (const a of ATRIBUTOS) {
        expect(Number.isInteger(def.atributos[a]), `${def.id}.${a} é inteiro`).toBe(true);
        expect(def.atributos[a], `${def.id}.${a}`).toBeGreaterThanOrEqual(90);
        expect(def.atributos[a], `${def.id}.${a}`).toBeLessThanOrEqual(110);
      }
    }
  });

  it('existe exatamente uma referência (capi)', () => {
    expect(PERSONAGENS_DE_DADOS.filter((d) => d.id === 'capi')).toHaveLength(1);
  });

  it('acusa soma errada (mutação: prova que a validação realmente olha a soma)', () => {
    const quebrado = [{ ...PERSONAGENS_DE_DADOS[0]!, atributos: { ...PERSONAGENS_DE_DADOS[0]!.atributos, pulo: 999 } }];
    expect(problemasDosPersonagensDeDados(quebrado, REGRAS_SAVE).some((p) => p.includes('soma'))).toBe(true);
  });

  it('acusa casa que não existe em REGRAS_SAVE.pistas (mutação)', () => {
    const quebrado = [{ ...PERSONAGENS_DE_DADOS[0]!, casa: 'pista-que-nao-existe' }];
    expect(problemasDosPersonagensDeDados(quebrado, REGRAS_SAVE).some((p) => p.includes('casa'))).toBe(true);
  });
});

describe('regra de desenho: um único dono do 110 por atributo', () => {
  it('nenhum atributo do elenco publicado tem dois donos do 110', () => {
    expect(atributosComMaisDeUmDonoDe110()).toEqual([]);
  });

  it('acusa quando dois personagens empatam em 110 no mesmo atributo (mutação: prova que a regra olha de verdade)', () => {
    const empatado = PERSONAGENS_DE_DADOS.map((d) => (d.id === 'bia' ? { ...d, atributos: { ...d.atributos, equilibrio: 110 } } : d));
    // bia (equilibrio 95 -> 110) empata com a capi (equilibrio 110): a soma deixa de ser 500, mas o teste é só sobre a
    // regra de "dono único", então uso atributosComMaisDeUmDonoDe110 isoladamente, sem passar por problemasDos...
    expect(atributosComMaisDeUmDonoDe110(empatado)).toContain('equilibrio');
  });
});
