/**
 * IA de itens da corrida (plano `docs/plano-itens-corrida.md` §Fases, I3): `corrida/ia-itens.ts` — quando um rival
 * usa o item do slot (determinístico, sem estado) e quando ele pula pra desviar de uma Bola de Neve/Poça de Calda.
 */
import { describe, expect, it } from 'vitest';
import {
  agressividadePorPistaOrdem,
  decidirUsoItemIA,
  devePularPraDesviar,
  type AmeacasIA,
  type ContextoUsoItemIA,
} from '../../src/corrida/ia-itens';

const BASE: ContextoUsoItemIA = {
  semente: 42,
  id: 'capi',
  tick: 0,
  ousadia: 1,
  agressividadePista: 1,
  item: null,
  escudoAtivo: false,
  alvoDeNuvemAtiva: false,
  existeRivalNaFrente: true,
};

describe('agressividadePorPistaOrdem (plano I-D9: pistas 1-2 menos agressivas)', () => {
  it('pistas 1 e 2 usam a metade da agressividade', () => {
    expect(agressividadePorPistaOrdem(1)).toBe(0.5);
    expect(agressividadePorPistaOrdem(2)).toBe(0.5);
  });

  it('pistas 3-5 usam agressividade cheia', () => {
    expect(agressividadePorPistaOrdem(3)).toBe(1);
    expect(agressividadePorPistaOrdem(4)).toBe(1);
    expect(agressividadePorPistaOrdem(5)).toBe(1);
  });

  it('ordem indefinida (treino/teste sem def) cai na cheia — mesmo padrão de "omitido = hoje"', () => {
    expect(agressividadePorPistaOrdem(undefined)).toBe(1);
  });
});

describe('decidirUsoItemIA: determinismo (plano §Determinismo: hash(semente, id, tick), sem estado)', () => {
  it('mesmo contexto => mesma decisão, em qualquer número de chamadas', () => {
    const ctx: ContextoUsoItemIA = { ...BASE, item: 'turbo', tick: 17 };
    const a = decidirUsoItemIA(ctx);
    const b = decidirUsoItemIA(ctx);
    const c = decidirUsoItemIA(ctx);
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('sem item no slot: nunca decide usar', () => {
    for (let tick = 0; tick < 200; tick++) {
      expect(decidirUsoItemIA({ ...BASE, item: null, tick })).toBe(false);
    }
  });

  it('varrendo os ticks, eventualmente decide usar (a chance não é sempre 0) para cada item', () => {
    const itens: ContextoUsoItemIA['item'][] = ['turbo', 'ima', 'poca', 'nuvem', 'escudo'];
    for (const item of itens) {
      let algumUso = false;
      for (let tick = 0; tick < 500 && !algumUso; tick++) {
        if (decidirUsoItemIA({ ...BASE, item, tick })) algumUso = true;
      }
      expect(algumUso, `item ${item} nunca decidiu usar em 500 ticks`).toBe(true);
    }
  });
});

describe('decidirUsoItemIA: Bola de Neve só se houver alguém pra acertar', () => {
  it('sem rival na frente, nunca usa a bola, em nenhum tick', () => {
    for (let tick = 0; tick < 500; tick++) {
      expect(decidirUsoItemIA({ ...BASE, item: 'bola', existeRivalNaFrente: false, tick })).toBe(false);
    }
  });

  it('com rival na frente, eventualmente usa', () => {
    let algumUso = false;
    for (let tick = 0; tick < 500 && !algumUso; tick++) {
      if (decidirUsoItemIA({ ...BASE, item: 'bola', existeRivalNaFrente: true, tick })) algumUso = true;
    }
    expect(algumUso).toBe(true);
  });
});

describe('decidirUsoItemIA: Bolha de Gelo (escudo) — prioridade reativa contra a Nuvem de Granizo', () => {
  it('alvo de nuvem e sem escudo ativo: usa NA HORA (tick 0, sem depender de sorteio)', () => {
    expect(decidirUsoItemIA({ ...BASE, item: 'escudo', alvoDeNuvemAtiva: true, escudoAtivo: false, tick: 0 })).toBe(true);
  });

  it('alvo de nuvem mas já com escudo ativo: não usa de novo (sem item sobra, mas a regra reativa não força)', () => {
    // Já ativo: cai na chance-base normal, não na prioridade reativa (não teria efeito usar 2x o mesmo escudo).
    const semReativa = decidirUsoItemIA({ ...BASE, item: 'escudo', alvoDeNuvemAtiva: true, escudoAtivo: true, tick: 0 });
    const comChanceBase = decidirUsoItemIA({ ...BASE, item: 'escudo', alvoDeNuvemAtiva: false, escudoAtivo: true, tick: 0 });
    expect(semReativa).toBe(comChanceBase); // mesma decisão: a reativa só se aplica com escudoAtivo:false.
  });
});

describe('devePularPraDesviar (plano: "pular bola/poça"; nuvem NUNCA entra aqui)', () => {
  it('sem nenhuma ameaça: nunca pula', () => {
    const semAmeaca: AmeacasIA = { bolaAlvoX: null, pocasX: [] };
    expect(devePularPraDesviar({ x: 100, modo: 'chao' }, semAmeaca)).toBe(false);
  });

  it('bola mirando o corredor, perto por trás (dentro do limiar): pula', () => {
    const ameaca: AmeacasIA = { bolaAlvoX: 98, pocasX: [] }; // 2m atrás.
    expect(devePularPraDesviar({ x: 100, modo: 'chao' }, ameaca)).toBe(true);
  });

  it('bola mirando o corredor, mas ainda longe: não pula ainda', () => {
    const ameaca: AmeacasIA = { bolaAlvoX: 50, pocasX: [] }; // 50m atrás.
    expect(devePularPraDesviar({ x: 100, modo: 'chao' }, ameaca)).toBe(false);
  });

  it('poça perto na frente (dentro do limiar): pula', () => {
    const ameaca: AmeacasIA = { bolaAlvoX: null, pocasX: [103] }; // 3m na frente.
    expect(devePularPraDesviar({ x: 100, modo: 'chao' }, ameaca)).toBe(true);
  });

  it('poça já passada (atrás do corredor): não pula (não ameaça mais)', () => {
    const ameaca: AmeacasIA = { bolaAlvoX: null, pocasX: [90] };
    expect(devePularPraDesviar({ x: 100, modo: 'chao' }, ameaca)).toBe(false);
  });

  it('já no ar ou no trilho: nunca força outro pulo (o salto não ajuda de novo)', () => {
    const ameaca: AmeacasIA = { bolaAlvoX: 99, pocasX: [101] };
    expect(devePularPraDesviar({ x: 100, modo: 'ar' }, ameaca)).toBe(false);
    expect(devePularPraDesviar({ x: 100, modo: 'trilho' }, ameaca)).toBe(false);
  });
});
