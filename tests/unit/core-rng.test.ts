/** RNG semeado (core/rng.ts): reprodutibilidade, estado serializável, canais separados e propriedades estatísticas básicas. */
import { describe, expect, it } from 'vitest';
import { CANAL_RNG } from '../../src/core/constantes';
import { criarRng, rngDoCanal, sementeAleatoria } from '../../src/core/rng';

describe('mulberry32', () => {
  it('mesma semente => mesma sequência; sementes diferentes divergem', () => {
    const a = criarRng(123);
    const b = criarRng(123);
    const c = criarRng(124);
    const sa = Array.from({ length: 8 }, () => a.proximo());
    expect(Array.from({ length: 8 }, () => b.proximo())).toEqual(sa);
    expect(Array.from({ length: 8 }, () => c.proximo())).not.toEqual(sa);
  });

  it('valores de referência (trava a implementação; são os mesmos do InnoFighters)', () => {
    const r = criarRng(1);
    expect([r.proximo(), r.proximo(), r.proximo()]).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  });

  it('propriedade: proximo() fica em [0,1), entre() em [a,b), inteiro() em [0,n), para 50 sementes', () => {
    let fora = 0;
    for (let semente = 0; semente < 50; semente++) {
      const r = criarRng(semente * 2654435761);
      for (let i = 0; i < 2000; i++) {
        const v = r.proximo();
        if (!(v >= 0 && v < 1)) fora++;
        const e = r.entre(-5, 5);
        if (!(e >= -5 && e < 5)) fora++;
        const n = r.inteiro(7);
        if (!(Number.isInteger(n) && n >= 0 && n < 7)) fora++;
      }
    }
    expect(fora).toBe(0);
  });

  it('distribuição: 10 baldes de 100 mil sorteios ficam dentro de 3% do esperado, e inteiro(6) cobre os 6 valores', () => {
    const r = criarRng(2026);
    const baldes = new Array<number>(10).fill(0);
    for (let i = 0; i < 100000; i++) baldes[Math.floor(r.proximo() * 10)]!++;
    for (const b of baldes) expect(Math.abs(b - 10000)).toBeLessThan(300);
    const dado = new Set<number>();
    for (let i = 0; i < 200; i++) dado.add(r.inteiro(6));
    expect([...dado].sort()).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('inteiro(n) só aceita inteiro >= 1; escolher em lista vazia lança; escolher devolve item da lista', () => {
    const r = criarRng(1);
    for (const ruim of [0, -1, 1.5, NaN, Infinity]) expect(() => r.inteiro(ruim)).toThrow(RangeError);
    expect(r.inteiro(1)).toBe(0);
    expect(() => r.escolher([])).toThrow();
    const itens = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) expect(itens).toContain(r.escolher(itens));
  });
});

describe('estado serializável', () => {
  it('propriedade: salvar o estado depois de k sorteios e retomar continua IDÊNTICO (100 sementes x ponto de corte aleatório)', () => {
    const mestre = criarRng(77);
    let divergencias = 0;
    for (let i = 0; i < 100; i++) {
      const semente = (mestre.proximo() * 0xffffffff) | 0;
      const k = mestre.inteiro(500);
      const a = criarRng(semente);
      for (let j = 0; j < k; j++) a.proximo();
      const b = criarRng(a.estado());
      for (let j = 0; j < 50; j++) if (a.proximo() !== b.proximo()) divergencias++;
    }
    expect(divergencias).toBe(0);
  });

  it('o estado é um uint32 e sobrevive a JSON (ida e volta por texto)', () => {
    const r = criarRng(31337);
    for (let i = 0; i < 1000; i++) r.proximo();
    const e = r.estado();
    expect(Number.isInteger(e) && e >= 0 && e <= 0xffffffff).toBe(true);
    const restaurado = criarRng((JSON.parse(JSON.stringify({ e })) as { e: number }).e);
    expect(restaurado.proximo()).toBe(r.proximo());
  });

  it('semente negativa, fracionária ou maior que 32 bits vira inteiro de 32 bits (não quebra, e é estável)', () => {
    for (const s of [-1, -2147483649, 1.9, 2 ** 32 + 5, 2 ** 40]) {
      expect(criarRng(s).proximo()).toBe(criarRng(s).proximo());
      const v = criarRng(s).proximo();
      expect(v >= 0 && v < 1).toBe(true);
    }
    expect(criarRng(2 ** 32 + 5).proximo()).toBe(criarRng(5).proximo());
  });
});

describe('canais separados (plano §3.3)', () => {
  it('lógica = semente; visual +1, ui +2, áudio +3, falas +4, camada +5; canais diferentes dão sequências diferentes', () => {
    expect(CANAL_RNG).toEqual({ logica: 0, visual: 1, ui: 2, audio: 3, falas: 4, camada: 5 });
    expect(rngDoCanal(100, 'logica').proximo()).toBe(criarRng(100).proximo());
    expect(rngDoCanal(100, 'visual').proximo()).toBe(criarRng(101).proximo());
    expect(rngDoCanal(100, 'falas').proximo()).toBe(criarRng(104).proximo());
    expect(rngDoCanal(100, 'camada').proximo()).toBe(criarRng(105).proximo());
    const primeiros = (['logica', 'visual', 'ui', 'audio', 'falas', 'camada'] as const).map((c) => rngDoCanal(100, c).proximo());
    expect(new Set(primeiros).size).toBe(6);
  });

  it('consumir o canal visual não muda o canal da lógica (o replay não depende de quantas partículas o render criou)', () => {
    const solo = rngDoCanal(5, 'logica');
    const esperado = Array.from({ length: 20 }, () => solo.proximo());
    const logica = rngDoCanal(5, 'logica');
    const visual = rngDoCanal(5, 'visual');
    const obtido: number[] = [];
    for (let i = 0; i < 20; i++) {
      for (let k = 0; k < i; k++) visual.proximo();
      obtido.push(logica.proximo());
    }
    expect(obtido).toEqual(esperado);
  });

  it('semente perto do limite de 32 bits dá a volta sem erro', () => {
    expect(rngDoCanal(0xffffffff, 'visual').proximo()).toBe(criarRng(0).proximo());
  });
});

describe('sementeAleatoria: a entropia entra por parâmetro', () => {
  it('usa a fonte injetada e devolve um uint32', () => {
    const fonte = { getRandomValues: (a: Uint32Array): Uint32Array => { a[0] = 4000000000; return a; } };
    expect(sementeAleatoria(fonte)).toBe(4000000000);
  });

  it('com o crypto real devolve uint32', () => {
    const s = sementeAleatoria(globalThis.crypto);
    expect(Number.isInteger(s) && s >= 0 && s <= 0xffffffff).toBe(true);
  });
});
