/**
 * Hash estável (core/hash.ts): vetores publicados do FNV-1a de 64 bits, oráculo independente em BigInt,
 * insensibilidade a como se fatia a entrada, sensibilidade a mudanças, e o hash de valor estruturado.
 */
import { describe, expect, it } from 'vitest';
import { ErroDeContrato } from '../../src/core/erros';
import {
  FORMATO_HASH,
  criarHasher,
  exigirHashIgual,
  hashDeBytes,
  hashDeFloat64s,
  hashDeTexto,
  hashDeValor,
} from '../../src/core/hash';
import { criarRng } from '../../src/core/rng';

/** Oráculo: FNV-1a 64 com BigInt, escrito direto da definição (xor do byte, multiplica pelo primo, módulo 2^64). */
function fnv1a64Oraculo(bytes: ArrayLike<number>): string {
  let h = 0xcbf29ce484222325n;
  for (let i = 0; i < bytes.length; i++) {
    h ^= BigInt(bytes[i] as number);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, '0');
}

const utf8 = (s: string): number[] => [...new TextEncoder().encode(s)];

describe('FNV-1a 64: vetores publicados (Fowler/Noll/Vo)', () => {
  it.each([
    ['', 'cbf29ce484222325'],
    ['a', 'af63dc4c8601ec8c'],
    ['b', 'af63df4c8601f1a5'],
    ['foobar', '85944171f73967e8'],
    ['foo', 'dcb27518fed9d577'],
    ['hello', 'a430d84680aabd0b'],
  ])('hashDeTexto(%j) = %s', (entrada, esperado) => {
    expect(hashDeTexto(entrada)).toBe(esperado);
  });

  it('o formato é sempre 16 dígitos hexadecimais minúsculos', () => {
    expect(hashDeTexto('x')).toMatch(FORMATO_HASH);
    expect(FORMATO_HASH.test('ABCDEF0123456789')).toBe(false);
    expect(FORMATO_HASH.test('abc')).toBe(false);
  });
});

describe('contra o oráculo BigInt', () => {
  it('propriedade: 3000 sequências aleatórias de bytes (tamanhos de 0 a 300) dão o mesmo hash', () => {
    const rng = criarRng(1234);
    let divergencias = 0;
    for (let i = 0; i < 3000; i++) {
      const n = rng.inteiro(301);
      const bytes = Array.from({ length: n }, () => rng.inteiro(256));
      if (hashDeBytes(bytes) !== fnv1a64Oraculo(bytes)) divergencias++;
    }
    expect(divergencias).toBe(0);
  });

  it('casos de borda do multiplicador: todos os bytes 0x00, todos 0xff, e mil bytes iguais', () => {
    for (const b of [0, 1, 0x80, 0xff]) {
      const bytes = new Array<number>(1000).fill(b);
      expect(hashDeBytes(bytes), `byte ${b}`).toBe(fnv1a64Oraculo(bytes));
    }
  });

  it('texto: UTF-8 igual ao TextEncoder para ASCII, acentos, CJK e emoji (par substituto)', () => {
    for (const s of ['', 'neve', 'maluca é ótimo', 'ação!', '日本語', 'a😀b', '😀😀', 'çÇãÃ']) {
      expect(hashDeTexto(s), s).toBe(fnv1a64Oraculo(utf8(s)));
    }
  });

  it('substituto isolado vira U+FFFD (como o TextEncoder), em vez de depender do motor', () => {
    for (const s of ['\ud800', 'a\udc00b', '\ud800\ud800', '\udc00\ud800']) {
      expect(hashDeTexto(s), JSON.stringify(s)).toBe(fnv1a64Oraculo(utf8(s)));
    }
  });
});

describe('alimentação em pedaços', () => {
  it('propriedade: fatiar a mesma entrada de qualquer jeito dá o mesmo hash', () => {
    const rng = criarRng(55);
    let divergencias = 0;
    for (let i = 0; i < 300; i++) {
      const bytes = Array.from({ length: rng.inteiro(200) + 1 }, () => rng.inteiro(256));
      const corte = rng.inteiro(bytes.length + 1);
      const h = criarHasher().bytes(bytes.slice(0, corte)).bytes(bytes.slice(corte));
      if (h.hex() !== hashDeBytes(bytes)) divergencias++;
    }
    expect(divergencias).toBe(0);
  });

  it('hex() não consome o estado: dá para continuar alimentando', () => {
    const h = criarHasher().texto('foo');
    expect(h.hex()).toBe(hashDeTexto('foo'));
    expect(h.texto('bar').hex()).toBe(hashDeTexto('foobar'));
  });

  it('u32/i32/f64 usam little-endian fixo', () => {
    expect(criarHasher().u32(0x04030201).hex()).toBe(hashDeBytes([1, 2, 3, 4]));
    expect(criarHasher().i32(-1).hex()).toBe(hashDeBytes([255, 255, 255, 255]));
    expect(criarHasher().f64(1).hex()).toBe(hashDeBytes([0, 0, 0, 0, 0, 0, 0xf0, 0x3f]));
    expect(criarHasher().f64(-2).hex()).toBe(hashDeBytes([0, 0, 0, 0, 0, 0, 0, 0xc0]));
    expect(criarHasher().booleano(true).booleano(false).hex()).toBe(hashDeBytes([1, 0]));
  });

  it('f64: -0 e +0 dão o mesmo hash, todo NaN dá o mesmo hash, e valores próximos diferem', () => {
    expect(criarHasher().f64(-0).hex()).toBe(criarHasher().f64(0).hex());
    expect(criarHasher().f64(NaN).hex()).toBe(criarHasher().f64(Number.NaN * -1).hex());
    expect(criarHasher().f64(1).hex()).not.toBe(criarHasher().f64(1 + Number.EPSILON).hex());
    expect(hashDeFloat64s(new Float64Array([1, 2, 3]))).toBe(hashDeFloat64s([1, 2, 3]));
  });

  it('entrada fora do intervalo lança (hash errado em silêncio seria o pior caso)', () => {
    expect(() => criarHasher().byte(256)).toThrow(RangeError);
    expect(() => criarHasher().byte(-1)).toThrow(RangeError);
    expect(() => criarHasher().byte(1.5)).toThrow(RangeError);
    expect(() => criarHasher().u32(-1)).toThrow(RangeError);
    expect(() => criarHasher().u32(2 ** 32)).toThrow(RangeError);
    expect(() => criarHasher().i32(2 ** 31)).toThrow(RangeError);
  });
});

describe('sensibilidade (sem colisão em mudanças pequenas)', () => {
  it('propriedade: trocar UM bit de uma sequência de 64 bytes muda o hash, nas 512 posições', () => {
    const rng = criarRng(9);
    const base = Array.from({ length: 64 }, () => rng.inteiro(256));
    const h0 = hashDeBytes(base);
    const vistos = new Set<string>([h0]);
    for (let i = 0; i < 64; i++) {
      for (let bit = 0; bit < 8; bit++) {
        const m = base.slice();
        m[i] = (m[i] as number) ^ (1 << bit);
        vistos.add(hashDeBytes(m));
      }
    }
    expect(vistos.size).toBe(513);
  });

  it('20 mil entradas curtas distintas não colidem', () => {
    const vistos = new Set<string>();
    for (let i = 0; i < 20000; i++) vistos.add(hashDeTexto(`pista-${i}`));
    expect(vistos.size).toBe(20000);
  });

  it('a ordem importa e o tamanho importa', () => {
    expect(hashDeBytes([1, 2])).not.toBe(hashDeBytes([2, 1]));
    expect(hashDeBytes([0])).not.toBe(hashDeBytes([0, 0]));
    expect(hashDeBytes([])).not.toBe(hashDeBytes([0]));
  });
});

describe('hashDeValor: dado estruturado (DefPista, tabelas)', () => {
  it('a ordem das chaves do objeto não importa; a ordem da lista importa', () => {
    expect(hashDeValor({ a: 1, b: [1, 2], c: 'x' })).toBe(hashDeValor({ c: 'x', b: [1, 2], a: 1 }));
    expect(hashDeValor([1, 2])).not.toBe(hashDeValor([2, 1]));
  });

  it('tipos distintos com a mesma "cara" não colidem: 1 / "1" / true / [1] / {a:1}, null / false, [] / {}, ["ab","c"] / ["a","bc"]', () => {
    const amostras = [1, '1', true, false, null, [1], { a: 1 }, [], {}, '', 0, ['ab', 'c'], ['a', 'bc'], [[]], [[], []], { a: {} }, { a: [] }, { '': 1 }];
    const hashes = amostras.map((v) => hashDeValor(v));
    expect(new Set(hashes).size).toBe(amostras.length);
  });

  it('aceita Float64Array, Int32Array e Uint8Array, e eles se distinguem de listas comuns', () => {
    const f = hashDeValor({ alturas: new Float64Array([0, -1.5, 2]) });
    expect(f).toBe(hashDeValor({ alturas: new Float64Array([0, -1.5, 2]) }));
    expect(f).not.toBe(hashDeValor({ alturas: [0, -1.5, 2] }));
    expect(hashDeValor(new Int32Array([1, 2]))).not.toBe(hashDeValor(new Uint8Array([1, 2])));
    expect(hashDeValor({ a: new Float64Array([1]) })).not.toBe(hashDeValor({ a: new Float64Array([2]) }));
  });

  it('é estável: valor fixo gravado (se mudar, hashEsperado de toda pista muda)', () => {
    const def = { id: 'bosque', semente: 123456, dificuldade: [0.1, 0.9], trechos: { reta: 3, rampa: 1 }, ok: true, obs: null };
    expect(hashDeValor(def)).toBe('4833f7f2ed839dd6');
  });

  it('o layout dos bytes é o documentado: confere {a:1} e ["x", true, null] contra bytes montados à mão (oráculo BigInt)', () => {
    // objeto(6), 1 chave (u32 LE), tamanho da chave (u32 LE), 'a', número(3), f64 de 1 em LE
    const objeto = [6, 1, 0, 0, 0, 1, 0, 0, 0, 97, 3, 0, 0, 0, 0, 0, 0, 0xf0, 0x3f];
    expect(hashDeValor({ a: 1 })).toBe(fnv1a64Oraculo(objeto));
    // lista(5), 3 itens, texto(4) + tamanho 1 + 'x', verdadeiro(2), nulo(0)
    const lista = [5, 3, 0, 0, 0, 4, 1, 0, 0, 0, 120, 2, 0];
    expect(hashDeValor(['x', true, null])).toBe(fnv1a64Oraculo(lista));
    // Float64Array(7): tamanho + f64 de cada um
    expect(hashDeValor(new Float64Array([1]))).toBe(fnv1a64Oraculo([7, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xf0, 0x3f]));
  });

  it('recusa o que não tem hash estável: undefined, função, símbolo, bigint, Map, Set, Date, classe, ciclo', () => {
    class Coisa { x = 1; }
    const ciclo: Record<string, unknown> = {};
    ciclo['eu'] = ciclo;
    const ruins: unknown[] = [undefined, () => 1, Symbol('s'), 1n, new Map(), new Set(), new Date(0), new Coisa(), ciclo, { a: undefined }, [undefined]];
    for (const r of ruins) expect(() => hashDeValor(r), String(typeof r)).toThrow(ErroDeContrato);
    expect(() => hashDeValor(ciclo)).toThrowError(/fundo demais/);
  });
});

describe('exigirHashIgual', () => {
  it('passa quando iguais; lança ErroDeContrato hash-divergente com os dois valores quando diferem ou mal formado', () => {
    const h = hashDeTexto('pista');
    expect(() => exigirHashIgual('pista bosque', h, h)).not.toThrow();
    try {
      exigirHashIgual('pista bosque', h, hashDeTexto('outra'));
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ErroDeContrato);
      expect((e as ErroDeContrato).codigo).toBe('hash-divergente');
      expect((e as ErroDeContrato).message).toContain('pista bosque');
      expect((e as ErroDeContrato).detalhes).toEqual([`esperado=${h}`, `obtido=${hashDeTexto('outra')}`]);
    }
    expect(() => exigirHashIgual('x', 'ABC', 'ABC')).toThrowError(/mal formado/);
    expect(() => exigirHashIgual('x', '', '')).toThrow(ErroDeContrato);
  });
});
