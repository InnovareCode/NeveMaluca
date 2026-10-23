import { describe, expect, it } from 'vitest';
import { ticksDeSegundos } from '../../src/data/manobras';
import {
  TETO_CARACTERES_CALLOUT,
  nomeDaManobra,
  nomeDoComboPerdido,
  nomeDoFechamentoDeCombo,
  nomeDoVoo,
  problemasDosTextos,
} from '../../src/data/textos.pt-BR';

describe('textos pt-BR das manobras (M2, Apolo)', () => {
  it('a tabela inteira passa na validação (caixa alta, não vazia, cabe no callout)', () => {
    expect(problemasDosTextos()).toEqual([]);
    expect(TETO_CARACTERES_CALLOUT).toBe(22);
  });

  it('sem contexto sai o nome base de cada família', () => {
    expect(nomeDaManobra('ar')).toBe('VOO DE CAPIVARA');
    expect(nomeDaManobra('mortal')).toBe('MORTAL MALUCO');
    expect(nomeDaManobra('grab')).toBe('AGARRA ESSA!');
    expect(nomeDaManobra('trilho')).toBe('ESCORREGA, CAPIVARA!');
  });

  it('mortal muda com as voltas (1 / 2 / 3+)', () => {
    expect(nomeDaManobra('mortal', { voltas: 1 })).toBe('CAMBALHOTA DE QUINTAL');
    expect(nomeDaManobra('mortal', { voltas: 2 })).toBe('PONCHO HELICÓPTERO');
    expect(nomeDaManobra('mortal', { voltas: 3 })).toBe('LIQUIDIFICADOR NA NEVE');
    expect(nomeDaManobra('mortal', { voltas: 7 })).toBe('LIQUIDIFICADOR NA NEVE');
  });

  it('grab: segurado ganha da direção; direção ganha do base', () => {
    expect(nomeDaManobra('grab', { grab: 'frente' })).toBe('PEGOU NO BICO');
    expect(nomeDaManobra('grab', { grab: 'frente', ticksSegurando: ticksDeSegundos(1) })).toBe('COLOU QUE NEM CHICLETE');
    expect(nomeDaManobra('grab', { grab: 'tras', ticksSegurando: ticksDeSegundos(0.5) })).toBe('PUXOU O RABICHO');
  });

  it('ar e trilho mudam pelo tempo', () => {
    expect(nomeDaManobra('ar', { ticksNoAr: ticksDeSegundos(0.6) })).toBe('PULINHO DE PIPOCA');
    expect(nomeDaManobra('ar', { ticksNoAr: ticksDeSegundos(1.2) })).toBe('PIPA SEM LINHA');
    expect(nomeDaManobra('ar', { ticksNoAr: ticksDeSegundos(2) })).toBe('DEU TCHAU PRAS NUVENS');
    expect(nomeDaManobra('trilho', { ticksDeslizando: ticksDeSegundos(0.3) })).toBe('BEIJINHO NO FERRO');
    expect(nomeDaManobra('trilho', { ticksDeslizando: ticksDeSegundos(1.5) })).toBe('CORRIMÃO DA RODOVIÁRIA');
    expect(nomeDaManobra('trilho', { ticksDeslizando: ticksDeSegundos(3) })).toBe('EXPRESSO CHIMARRÃO');
  });

  it('combinação mortal + grab no mesmo voo vira a Roda de Chimarrão (pelas voltas)', () => {
    const voo = ['mortal', 'ar', 'grab'] as const;
    expect(nomeDaManobra('mortal', { junto: voo, voltas: 1 })).toBe('RODA DE CHIMARRÃO');
    expect(nomeDaManobra('grab', { junto: voo, voltas: 2 })).toBe('CHIMARRÃO CENTRIFUGADO');
    expect(nomeDoVoo(voo, { junto: voo, voltas: 3 })).toBe('CUIA NO LIQUIDIFICADOR');
    // ar sozinho não entra na combinação
    expect(nomeDaManobra('ar', { junto: voo })).toBe('VOO DE CAPIVARA');
    // nomeDoVoo prioriza o grab quando não há mortal
    expect(nomeDoVoo(['ar', 'grab'], { grab: 'cima' })).toBe('PRANCHA PRO CÉU');
  });

  it('semente escolhe o sinônimo de forma determinística', () => {
    expect(nomeDaManobra('mortal', { voltas: 2, semente: 1 })).toBe('MORTAL DUPLO DE PONCHO');
    expect(nomeDaManobra('mortal', { voltas: 2, semente: 2 })).toBe('PONCHO HELICÓPTERO');
    expect(nomeDaManobra('mortal', { voltas: 2, semente: -1 })).toBe('PONCHO HELICÓPTERO');
  });

  it('fechamento de combo por faixa de multiplicador e combo perdido', () => {
    expect(nomeDoFechamentoDeCombo(2)).toBe('DEU PRO GASTO!');
    expect(nomeDoFechamentoDeCombo(3)).toBe('BAH, QUE COMBO!');
    expect(nomeDoFechamentoDeCombo(4)).toBe('COMBO DE RESPEITO!');
    expect(nomeDoFechamentoDeCombo(5)).toBe('LENDA DA MONTANHA!');
    expect(nomeDoFechamentoDeCombo(10, 1)).toBe('DESCEU RINDO!');
    expect(nomeDoComboPerdido()).toBe('ESTABACOU!');
  });
});
