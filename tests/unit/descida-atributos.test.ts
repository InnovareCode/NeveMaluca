/**
 * `configDoPersonagem` (plano M3 §A.1/§A.2): a conversão A1 ("relativa à Capi, linear, com ganho por atributo").
 * O teste mais importante não é nenhum número isolado — é que a Capi devolve `CONFIG_PADRAO` BIT A BIT (o golden
 * de `m3-congelamento-capi.test.ts` é quem prova, em uma descida inteira, que isso não regride).
 */
import { describe, expect, it } from 'vitest';
import type { DefPersonagem, Evolucao } from '../../src/core/contratos';
import { BANDEIRA, BETO, CIDINHA, PERSONAGENS_DE_DADOS, QUEQUE } from '../../src/data/personagens';
import { NIVEL_MAXIMO_EVOLUCAO } from '../../src/data/evolucao';
import { aplicarAtributos, aplicarEvolucao, configDoPersonagem, MAPA_ATRIBUTOS, PERSONAGEM_REFERENCIA } from '../../src/descida/atributos';
import { CONFIG_PADRAO } from '../../src/descida/constantes';

describe('configDoPersonagem: a Capi é a referência (plano §A.1)', () => {
  it("PERSONAGEM_REFERENCIA === 'capi'", () => {
    expect(PERSONAGEM_REFERENCIA).toBe('capi');
  });

  it('configDoPersonagem("capi") === CONFIG_PADRAO campo a campo (===, não toEqual: mesmos bits)', () => {
    const config = configDoPersonagem('capi');
    for (const campo of Object.keys(CONFIG_PADRAO) as (keyof typeof CONFIG_PADRAO)[]) {
      expect(config[campo], campo).toBe(CONFIG_PADRAO[campo]);
    }
  });

  it('um personagem desconhecido (save corrompido/elenco velho) cai na física da referência, não trava', () => {
    expect(configDoPersonagem('ninguem-com-esse-id')).toEqual(configDoPersonagem('capi'));
  });
});

describe('configDoPersonagem: números de partida do plano §A.2 nos extremos do elenco', () => {
  it('velocidade: Beto (110) 29,68 m/s · Quequé (90) 26,32 m/s (Capi 28)', () => {
    expect(configDoPersonagem('beto').velocidadeMaxMs).toBeCloseTo(29.68, 9);
    expect(configDoPersonagem('queque').velocidadeMaxMs).toBeCloseTo(26.32, 9);
  });

  it('aceleração: Quequé (110) fatorEmbalo 1,08 e respawn 4,6 · Bandeira (90) fatorEmbalo 0,92', () => {
    expect(configDoPersonagem('queque').fatorEmbalo).toBeCloseTo(1.08, 9);
    expect(configDoPersonagem('queque').velocidadeRespawnMs).toBeCloseTo(4.6, 9);
    expect(configDoPersonagem('bandeira').fatorEmbalo).toBeCloseTo(0.92, 9);
  });

  it('giro: Cidinha (110, Capi 90) 7,2 °/tick', () => {
    expect(configDoPersonagem('cidinha').giroVelMaxGrausPorTick).toBeCloseTo(7.2, 9);
  });

  it('equilíbrio: Beto (90, Capi 110) 6,4 / 19,2 / 46,4°', () => {
    const c = configDoPersonagem('beto');
    expect(c.limiarPerfeitoGraus).toBeCloseTo(6.4, 9);
    expect(c.limiarBomGraus).toBeCloseTo(19.2, 9);
    expect(c.limiarTortoGraus).toBeCloseTo(46.4, 9);
  });

  it('pulo: Bandeira (110) 6,6 m/s · Cidinha (90) 5,4 m/s', () => {
    expect(configDoPersonagem('bandeira').impulsoPuloMs).toBeCloseTo(6.6, 9);
    expect(configDoPersonagem('cidinha').impulsoPuloMs).toBeCloseTo(5.4, 9);
  });

  it('campos que nunca variam por personagem ficam iguais ao CONFIG_PADRAO para todo o elenco', () => {
    const invariantes: readonly (keyof typeof CONFIG_PADRAO)[] = [
      'gravidadeMs2',
      'atrito',
      'atritoAgachado',
      'arrasto',
      'fatorRampaMsPorGrau',
      'atrasoGiroTicks',
      'amortecimentoGiro',
      'fatorPerdaBom',
      'fatorPerdaTorto',
      'ticksTombo',
      'fatorBonecoDeNeve',
      'velocidadeMinimaChaoMs',
    ];
    for (const def of PERSONAGENS_DE_DADOS) {
      const config = configDoPersonagem(def.id);
      for (const campo of invariantes) expect(config[campo], `${def.id}.${campo}`).toBe(CONFIG_PADRAO[campo]);
    }
  });

  it('cada personagem do elenco tem uma config DISTINTA da Capi (exceto a própria Capi)', () => {
    const daCapi = configDoPersonagem('capi');
    for (const def of PERSONAGENS_DE_DADOS) {
      if (def.id === 'capi') continue;
      expect(configDoPersonagem(def.id), def.id).not.toEqual(daCapi);
    }
  });
});

describe('aplicarAtributos: a fórmula isolada (sem depender do catálogo nem de CONFIG_PADRAO reais)', () => {
  const REF: DefPersonagem = {
    id: 'ref',
    nome: 'Ref',
    bordao: '',
    nomeAssinatura: '',
    atributos: { velocidade: 100, aceleracao: 100, giro: 100, equilibrio: 100, pulo: 100 },
    casa: 'x',
    desbloqueio: { tipo: 'inicial' },
  };
  const BASE = { ...CONFIG_PADRAO, velocidadeMaxMs: 10 };

  it('diferença 0 (mesmos atributos da referência) devolve a base exatamente', () => {
    expect(aplicarAtributos(REF, REF, MAPA_ATRIBUTOS, BASE)).toEqual(BASE);
  });

  it('ganho e sentido respondem como a fórmula manda: campo = base × (1 + sentido×ganho×diff/100)', () => {
    const def: DefPersonagem = { ...REF, id: 'def', atributos: { ...REF.atributos, velocidade: 150 } };
    const mapa = { ...MAPA_ATRIBUTOS, velocidade: [{ campo: 'velocidadeMaxMs' as const, sentido: -1 as const, ganho: 2 }] };
    // diff = 50, sentido=-1, ganho=2 -> fator = 1 - 2*50/100 = 0 -> velocidadeMaxMs vira 0.
    expect(aplicarAtributos(def, REF, mapa, BASE).velocidadeMaxMs).toBeCloseTo(0, 9);
  });

  it('BANDEIRA/BETO/CIDINHA/QUEQUE batem com configDoPersonagem usando o catálogo real (mesma conta, dois caminhos)', () => {
    const capiDef = PERSONAGENS_DE_DADOS.find((d) => d.id === 'capi')!;
    for (const def of [BANDEIRA, BETO, CIDINHA, QUEQUE]) {
      expect(aplicarAtributos(def, capiDef)).toEqual(configDoPersonagem(def.id));
    }
  });
});

describe('aplicarEvolucao (plano C-D3/C-D4/C6): upgrade entre campeonatos, camada por cima da ficha', () => {
  it('U1: nível 0 (sem evolucao.niveis para este id) devolve a MESMA config (===, não só toEqual)', () => {
    for (const def of PERSONAGENS_DE_DADOS) {
      const config = configDoPersonagem(def.id);
      expect(aplicarEvolucao(config, def, {})).toBe(config);
      expect(aplicarEvolucao(config, def, { [def.id]: 0 })).toBe(config);
    }
  });

  it('U1: nível de OUTRO personagem não afeta este (devolve a mesma config)', () => {
    const config = configDoPersonagem('capi');
    const capiDef = PERSONAGENS_DE_DADOS.find((d) => d.id === 'capi')!;
    expect(aplicarEvolucao(config, capiDef, { beto: 5 })).toBe(config);
  });

  it('nível > 0 sobe velocidade/equilíbrio/força (pulo+embalo), NUNCA giro', () => {
    const capiDef = PERSONAGENS_DE_DADOS.find((d) => d.id === 'capi')!;
    const config = configDoPersonagem('capi');
    const evoluido = aplicarEvolucao(config, capiDef, { capi: 1 });
    expect(evoluido.velocidadeMaxMs).toBeGreaterThan(config.velocidadeMaxMs);
    expect(evoluido.limiarPerfeitoGraus).toBeGreaterThan(config.limiarPerfeitoGraus);
    expect(evoluido.fatorEmbalo).toBeGreaterThan(config.fatorEmbalo);
    expect(evoluido.impulsoPuloMs).toBeGreaterThan(config.impulsoPuloMs);
    expect(evoluido.giroVelMaxGrausPorTick).toBe(config.giroVelMaxGrausPorTick);
    expect(evoluido.giroAcelGrausPorTick2).toBe(config.giroAcelGrausPorTick2);
  });

  it('nível MÁXIMO dá um salto maior que nível 1 (monotônico no nível)', () => {
    const capiDef = PERSONAGENS_DE_DADOS.find((d) => d.id === 'capi')!;
    const config = configDoPersonagem('capi');
    const nivel1 = aplicarEvolucao(config, capiDef, { capi: 1 }).velocidadeMaxMs;
    const nivelMax = aplicarEvolucao(config, capiDef, { capi: NIVEL_MAXIMO_EVOLUCAO }).velocidadeMaxMs;
    expect(nivelMax).toBeGreaterThan(nivel1);
  });

  it('nível fora da faixa (save adulterado) satura no teto/piso em vez de explodir ou ficar negativo', () => {
    const capiDef = PERSONAGENS_DE_DADOS.find((d) => d.id === 'capi')!;
    const config = configDoPersonagem('capi');
    const niveisAbsurdos: Evolucao['niveis'] = { capi: 999 };
    expect(aplicarEvolucao(config, capiDef, niveisAbsurdos)).toEqual(aplicarEvolucao(config, capiDef, { capi: NIVEL_MAXIMO_EVOLUCAO }));
    expect(aplicarEvolucao(config, capiDef, { capi: -5 })).toBe(config); // negativo cai no nível 0 (identidade).
  });
});
