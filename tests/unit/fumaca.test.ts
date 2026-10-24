/**
 * Teste de fumaça do M0: prova que o Vitest roda, que o TypeScript estrito compila os módulos e que cada camada
 * prevista no plano (§3.1) existe e é importável. Não testa lógica de jogo (não há ainda).
 * Vega acrescenta aqui (ou ao lado) o teste de arquitetura de camadas e de funções proibidas.
 */
import { describe, expect, it } from 'vitest';
import { rotuloDaVersao, VERSAO } from '../../src/versao';

describe('fumaça do M0', () => {
  it('o rótulo da versão mostra o commit e a data em horário de Brasília', () => {
    expect(rotuloDaVersao({ commit: 'abc1234', data: '2026-10-22T15:30:00.000Z', sujo: false })).toBe('abc1234 · 22/10 12:30');
    expect(rotuloDaVersao({ commit: 'abc1234', data: '', sujo: true })).toBe('abc1234+');
    expect(typeof VERSAO.commit).toBe('string');
  });

  it('toda camada de src/ existe e é importável', async () => {
    const camadas = import.meta.glob('../../src/*/index.ts');
    expect(Object.keys(camadas).sort()).toEqual(
      ['assets', 'audio', 'core', 'corrida', 'data', 'descida', 'input', 'meta', 'pista', 'platform', 'render', 'ui'].map((c) => `../../src/${c}/index.ts`),
    );
    for (const carregar of Object.values(camadas)) await expect(carregar()).resolves.toBeDefined();
  });
});
