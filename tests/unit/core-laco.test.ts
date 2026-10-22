/**
 * Laço de passo fixo (core/laco.ts) com RELÓGIO SINTÉTICO: o núcleo não tem relógio, então cada teste decide o tempo.
 * Propriedades: nenhum tick perdido ou inventado, teto do acumulador, tick contínuo, robustez a relógio ruim.
 */
import { describe, expect, it } from 'vitest';
import { ACUMULADOR_MAX_MS, MAX_PASSOS_POR_QUADRO, PASSO_MS } from '../../src/core/constantes';
import { ErroDeContrato } from '../../src/core/erros';
import { criarLaco } from '../../src/core/laco';
import { criarRng } from '../../src/core/rng';

/** Roda `quadros` quadros com intervalo `dt` e devolve os ticks por quadro. */
function rodar(dt: number, quadros: number, inicio = 1000): number[] {
  const laco = criarLaco();
  const porQuadro: number[] = [];
  for (let i = 0; i <= quadros; i++) porQuadro.push(laco.quadro(inicio + i * dt, () => {}));
  return porQuadro;
}

describe('cadência', () => {
  it('a primeira chamada só marca a referência (0 ticks)', () => {
    expect(criarLaco().quadro(123456, () => { throw new Error('não devia rodar'); })).toBe(0);
  });

  it('60 Hz exatos: 1 tick por quadro, 600 quadros = 600 ticks, nenhum a mais', () => {
    const r = rodar(PASSO_MS, 600);
    expect(r[0]).toBe(0);
    expect(r.slice(1).every((n) => n === 1)).toBe(true);
    expect(r.reduce((a, b) => a + b, 0)).toBe(600);
  });

  it('120 Hz: alterna 0 e 1; 30 Hz: 2 por quadro; 144 Hz: média de 60 ticks por segundo', () => {
    const r120 = rodar(1000 / 120, 1200);
    expect(r120.reduce((a, b) => a + b, 0)).toBe(600);
    expect(Math.max(...r120)).toBe(1);
    const r30 = rodar(1000 / 30, 300);
    expect(r30.slice(1).every((n) => n === 2)).toBe(true);
    const r144 = rodar(1000 / 144, 1440);
    expect(Math.abs(r144.reduce((a, b) => a + b, 0) - 600)).toBeLessThanOrEqual(1);
  });

  it('o número do tick é 0, 1, 2, ... sem repetir nem pular, atravessando quadros', () => {
    const laco = criarLaco();
    const vistos: number[] = [];
    for (let i = 0; i < 50; i++) laco.quadro(i * 40, (t) => vistos.push(t)); // 25 Hz: 2 ticks quase sempre
    expect(vistos).toEqual(Array.from({ length: vistos.length }, (_, i) => i));
    expect(laco.ticks()).toBe(vistos.length);
  });
});

describe('teto do acumulador (aba parada não vira salto)', () => {
  it('uma parada de 1 s, 10 s ou 1 hora devolve no máximo 6 ticks e depois volta ao normal', () => {
    expect(MAX_PASSOS_POR_QUADRO).toBe(6);
    for (const parada of [200, 1000, 10000, 3600000]) {
      const laco = criarLaco();
      laco.quadro(0, () => {});
      expect(laco.quadro(parada, () => {}), `parada ${parada} ms`).toBe(6);
      // depois da parada o laço está alinhado: a cadência normal continua a 1 tick por quadro
      let t = parada;
      const seguintes: number[] = [];
      for (let i = 0; i < 10; i++) seguintes.push(laco.quadro((t += PASSO_MS), () => {}));
      expect(seguintes.slice(-5).every((n) => n === 1 || n === 0 || n === 2)).toBe(true);
      expect(seguintes.reduce((a, b) => a + b, 0), `parada ${parada}`).toBeGreaterThanOrEqual(9);
    }
  });

  it('propriedade: com intervalos aleatórios de 0 a 500 ms, nunca passa de 6 ticks por quadro e o total fica no limite do tempo real', () => {
    const rng = criarRng(1);
    for (let rodada = 0; rodada < 200; rodada++) {
      const laco = criarLaco();
      let agora = rng.entre(0, 1e6);
      laco.quadro(agora, () => {});
      let total = 0;
      let tempo = 0;
      for (let i = 0; i < 300; i++) {
        const dt = rng.proximo() < 0.1 ? rng.entre(100, 500) : rng.entre(0, 40);
        agora += dt;
        tempo += dt;
        const n = laco.quadro(agora, () => {});
        if (n > 6) throw new Error(`quadro com ${n} ticks`);
        total += n;
      }
      // nunca roda MAIS tempo do que passou (o excesso é descartado, nunca inventado)
      expect(total * PASSO_MS).toBeLessThanOrEqual(tempo + 1e-3);
      expect(laco.ticks()).toBe(total);
    }
  });

  it('propriedade: sem paradas longas (todo intervalo <= 100 ms) nenhum tempo é perdido: total = floor(tempo / passo) ± 1', () => {
    const rng = criarRng(2);
    for (let rodada = 0; rodada < 200; rodada++) {
      const laco = criarLaco();
      let agora = 5000;
      laco.quadro(agora, () => {});
      let tempo = 0;
      let total = 0;
      for (let i = 0; i < 400; i++) {
        const dt = rng.entre(1, ACUMULADOR_MAX_MS - 20);
        agora += dt;
        tempo += dt;
        total += laco.quadro(agora, () => {});
      }
      expect(Math.abs(total - Math.floor(tempo / PASSO_MS))).toBeLessThanOrEqual(1);
    }
  });

  it('alfa fica em [0, 1) e cresce entre ticks', () => {
    const laco = criarLaco();
    laco.quadro(0, () => {});
    laco.quadro(10, () => {});
    expect(laco.alfa()).toBeCloseTo(10 / PASSO_MS, 9);
    laco.quadro(25, () => {});
    const a = laco.alfa();
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(1);
    const rng = criarRng(3);
    let agora = 25;
    for (let i = 0; i < 1000; i++) {
      agora += rng.entre(0, 150);
      laco.quadro(agora, () => {});
      expect(laco.alfa()).toBeGreaterThanOrEqual(0);
      expect(laco.alfa()).toBeLessThan(1);
    }
  });
});

describe('relógio ruim e pausa', () => {
  it('relógio que anda para trás não gera tick, repõe a referência e o jogo segue depois', () => {
    const laco = criarLaco();
    laco.quadro(1000, () => {});
    expect(laco.quadro(900, () => {})).toBe(0);
    expect(laco.quadro(900 + PASSO_MS, () => {})).toBe(1); // contou a partir do novo ponto
  });

  it('timestamp não finito (NaN, Infinity) é ignorado e não corrompe o estado', () => {
    const laco = criarLaco();
    laco.quadro(0, () => {});
    for (const ruim of [NaN, Infinity, -Infinity]) expect(laco.quadro(ruim, () => { throw new Error('não devia rodar'); })).toBe(0);
    expect(laco.quadro(PASSO_MS, () => {})).toBe(1);
  });

  it('mesmo instante duas vezes não gera tick', () => {
    const laco = criarLaco();
    laco.quadro(0, () => {});
    expect(laco.quadro(50, () => {})).toBe(3);
    expect(laco.quadro(50, () => {})).toBe(0);
  });

  it('reiniciar(): o tempo parado não conta; com argumento marca a nova referência, sem argumento a próxima chamada é "a primeira"', () => {
    const laco = criarLaco();
    laco.quadro(0, () => {});
    laco.quadro(10, () => {});
    laco.reiniciar(5000);
    expect(laco.alfa()).toBe(0);
    expect(laco.quadro(5000 + PASSO_MS, () => {})).toBe(1);
    laco.reiniciar();
    expect(laco.quadro(99999, () => {})).toBe(0);
    expect(laco.quadro(99999 + PASSO_MS, () => {})).toBe(1);
    expect(laco.ticks()).toBe(2); // o contador de ticks NÃO é zerado pela pausa
  });

  it('se o passo lança, o erro sobe para quem chamou e o contador não conta o tick que falhou', () => {
    const laco = criarLaco();
    laco.quadro(0, () => {});
    expect(() => laco.quadro(PASSO_MS, () => { throw new Error('bug no motor'); })).toThrow('bug no motor');
    expect(laco.ticks()).toBe(0);
  });
});

describe('opções e validação', () => {
  it('passo e teto configuráveis (30 Hz com teto de 200 ms)', () => {
    const laco = criarLaco({ passoMs: 1000 / 30, maxAcumuladoMs: 200 });
    laco.quadro(0, () => {});
    expect(laco.quadro(1000, () => {})).toBe(6);
    expect(laco.quadro(1000 + 1000 / 30, () => {})).toBe(1);
  });

  it('opção inválida lança ErroDeContrato laco-invalido', () => {
    for (const o of [{ passoMs: 0 }, { passoMs: -1 }, { passoMs: NaN }, { passoMs: Infinity }, { maxAcumuladoMs: 5 }, { maxAcumuladoMs: NaN }]) {
      try {
        criarLaco(o);
        expect.unreachable(JSON.stringify(o));
      } catch (e) {
        expect(e, JSON.stringify(o)).toBeInstanceOf(ErroDeContrato);
        expect((e as ErroDeContrato).codigo).toBe('laco-invalido');
      }
    }
  });
});
