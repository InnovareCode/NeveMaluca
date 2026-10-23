/**
 * Catálogo de temas (`data/temas.ts`, plano M3 §B.3): forma válida e o `TEMA_BOSQUE` daqui tem que continuar
 * IGUAL ao `TEMA_BOSQUE` de `render/temas/bosque.ts` — são cópias independentes (`data/` não importa `render/`),
 * então sem este teste as duas listas podiam divergir em silêncio.
 */
import { describe, expect, it } from 'vitest';
import { TEMA_BOSQUE as TEMA_BOSQUE_DO_RENDER } from '../../src/render/temas/bosque';
import { problemasDosTemasDeDados, TEMA_BOSQUE, TEMA_CUME, TEMA_PARQUE, TEMA_VILA, TEMA_VULCAO } from '../../src/data/temas';

describe('TEMAS_DE_DADOS: validação de forma', () => {
  it('não acusa nenhum problema (catálogo publicado é válido)', () => {
    expect(problemasDosTemasDeDados()).toEqual([]);
  });

  it('TEMA_BOSQUE daqui é igual, campo a campo, ao TEMA_BOSQUE de render/temas/bosque.ts', () => {
    expect(TEMA_BOSQUE).toEqual(TEMA_BOSQUE_DO_RENDER);
  });

  it('TEMA_PARQUE (Pico do Picolé) tem os 7 campos de cor e o clima "confeito"', () => {
    expect(TEMA_PARQUE.id).toBe('parque');
    expect(TEMA_PARQUE.clima).toBe('confeito');
    expect(TEMA_PARQUE.cores.ceu).toHaveLength(2);
  });

  it('TEMA_VILA (Vila do Chocolate Quente) tem os 7 campos de cor e o clima "neve-noturna"', () => {
    expect(TEMA_VILA.id).toBe('vila');
    expect(TEMA_VILA.clima).toBe('neve-noturna');
    expect(TEMA_VILA.cores.ceu).toHaveLength(2);
  });

  it('TEMA_VULCAO (Vulcão Pé-Gelado) tem os 7 campos de cor e o clima "vapor"', () => {
    expect(TEMA_VULCAO.id).toBe('vulcao');
    expect(TEMA_VULCAO.clima).toBe('vapor');
    expect(TEMA_VULCAO.cores.ceu).toHaveLength(2);
  });

  it('TEMA_CUME (Cume da Ventania) tem os 7 campos de cor e o clima "vento-aurora"', () => {
    expect(TEMA_CUME.id).toBe('cume');
    expect(TEMA_CUME.clima).toBe('vento-aurora');
    expect(TEMA_CUME.cores.ceu).toHaveLength(2);
  });

  it('acusa cor fora do formato hex (mutação)', () => {
    const quebrado = [{ ...TEMA_PARQUE, cores: { ...TEMA_PARQUE.cores, destaque: 'verde' } }];
    expect(problemasDosTemasDeDados(quebrado).some((p) => p.includes('destaque'))).toBe(true);
  });

  it('acusa id repetido (mutação)', () => {
    expect(problemasDosTemasDeDados([TEMA_BOSQUE, TEMA_BOSQUE]).some((p) => p.includes('repetido'))).toBe(true);
  });

  it('acusa clima fora da lista válida (mutação)', () => {
    const quebrado = [{ ...TEMA_PARQUE, clima: 'ensolarado' as never }];
    expect(problemasDosTemasDeDados(quebrado).some((p) => p.includes('clima'))).toBe(true);
  });
});
