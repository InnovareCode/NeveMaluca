/**
 * Trigonometria tabelada (core/trig.ts). Os testes usam `Math.sin/cos/atan2` como RÉGUA (aqui é permitido: tests/ não é
 * varrido; a regra vale para src/) e fixam um hash dourado das saídas, que é o que protege o determinismo entre motores.
 */
import { describe, expect, it } from 'vitest';
import { hashDeFloat64s } from '../../src/core/hash';
import { criarRng } from '../../src/core/rng';
import {
  HASH_TABELAS_TRIG,
  UNIDADES_POR_VOLTA,
  UNIDADES_QUARTO,
  atan2,
  cosseno,
  cossenoU,
  exigirTabelasTrigValidas,
  grausParaRadianos,
  grausParaUnidades,
  hashDasTabelasTrig,
  normalizarGraus,
  radianosParaGraus,
  seno,
  senoU,
  unidadesParaGraus,
} from '../../src/core/trig';
import { construirTabelaAtan, construirTabelaSeno } from '../../src/core/trig-tabelas';
import { criarHasher } from '../../src/core/hash';

const RAD = Math.PI / 180;
const GRAU = 180 / Math.PI;

/** Diferença entre dois ângulos em graus, com a volta (179,99999 e -179,99999 estão a 0,00002 um do outro). */
const distAngular = (a: number, b: number): number => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

describe('tabelas', () => {
  it('o hash das tabelas é o fixo (se mudar, pistas e replays gravados deixam de valer)', () => {
    expect(hashDasTabelasTrig()).toBe(HASH_TABELAS_TRIG);
    expect(() => exigirTabelasTrigValidas()).not.toThrow();
  });

  it('o hash é sensível: mexer em uma única entrada de qualquer tabela muda o hash', () => {
    const s = construirTabelaSeno();
    const a = construirTabelaAtan();
    expect(criarHasher().i32s(s).i32s(a).hex()).toBe(HASH_TABELAS_TRIG);
    for (const i of [0, 1, 511, 1023, 1024]) {
      const s2 = s.slice();
      s2[i] = (s2[i] as number) + 1;
      expect(criarHasher().i32s(s2).i32s(a).hex(), `seno[${i}]`).not.toBe(HASH_TABELAS_TRIG);
      const a2 = a.slice();
      a2[i] = (a2[i] as number) + 1;
      expect(criarHasher().i32s(s).i32s(a2).hex(), `atan[${i}]`).not.toBe(HASH_TABELAS_TRIG);
    }
  });

  it('a construção é reprodutível e as tabelas são monótonas crescentes, com os extremos exatos', () => {
    const s = construirTabelaSeno();
    const a = construirTabelaAtan();
    expect(construirTabelaSeno()).toEqual(s);
    expect(s[0]).toBe(0);
    expect(s[1024]).toBe(1073741824); // sen 90° = 1,0 em ponto fixo 2^30
    expect(a[0]).toBe(0);
    expect(a[1024]).toBe(134217728); // atan 1 = 45° = 1/8 de volta = 2^27
    for (let i = 1; i < s.length; i++) expect(s[i] as number, `seno[${i}]`).toBeGreaterThan(s[i - 1] as number);
    for (let i = 1; i < a.length; i++) expect(a[i] as number, `atan[${i}]`).toBeGreaterThan(a[i - 1] as number);
  });
});

describe('seno e cosseno: varredura de erro máximo contra Math.sin/Math.cos', () => {
  it('passo de 0,001° em duas voltas (720 mil pontos): erro máximo < 4e-7', () => {
    let maxS = 0;
    let maxC = 0;
    for (let i = -360000; i <= 360000; i++) {
      const g = i / 1000;
      maxS = Math.max(maxS, Math.abs(seno(g) - Math.sin(g * RAD)));
      maxC = Math.max(maxC, Math.abs(cosseno(g) - Math.cos(g * RAD)));
    }
    expect(maxS).toBeLessThan(4e-7);
    expect(maxC).toBeLessThan(4e-7);
  });

  it('propriedade: ângulos aleatórios de -1e6 a 1e6 graus (200 mil sorteios) ficam sob o mesmo erro', () => {
    const rng = criarRng(20261022);
    let pior = 0;
    for (let i = 0; i < 200000; i++) {
      const g = rng.entre(-1e6, 1e6);
      // a régua também sofre com ângulo enorme: reduz primeiro, em aritmética exata (resto de double)
      const reduzido = g % 360;
      pior = Math.max(pior, Math.abs(seno(g) - Math.sin(reduzido * RAD)), Math.abs(cosseno(g) - Math.cos(reduzido * RAD)));
    }
    expect(pior).toBeLessThan(5e-7);
  });

  it('valores notáveis: exatos nos eixos e dentro de 1e-6 nos ângulos clássicos', () => {
    expect([seno(0), seno(90), seno(180), seno(270), seno(360)]).toEqual([0, 1, 0, -1, 0]);
    expect([cosseno(0), cosseno(90), cosseno(180), cosseno(270), cosseno(360)]).toEqual([1, 0, -1, 0, 1]);
    expect(Math.abs(seno(30) - 0.5)).toBeLessThan(1e-6);
    expect(Math.abs(cosseno(60) - 0.5)).toBeLessThan(1e-6);
    expect(Math.abs(seno(45) - Math.SQRT1_2)).toBeLessThan(1e-6);
    expect(Math.abs(seno(-30) + 0.5)).toBeLessThan(1e-6);
  });

  it('o resultado nunca sai de [-1, 1]', () => {
    const rng = criarRng(7);
    let fora = 0;
    for (let i = 0; i < 100000; i++) {
      const g = rng.entre(-1000, 1000);
      if (!(Math.abs(seno(g)) <= 1) || !(Math.abs(cosseno(g)) <= 1)) fora++;
    }
    expect(fora).toBe(0);
  });

  it('identidade sen² + cos² = 1 (tolerância 2e-6) e cos(x) = sen(x + 90°) exatamente', () => {
    const rng = criarRng(11);
    let pior = 0;
    for (let i = 0; i < 50000; i++) {
      const g = rng.entre(-720, 720);
      pior = Math.max(pior, Math.abs(seno(g) ** 2 + cosseno(g) ** 2 - 1));
    }
    expect(pior).toBeLessThan(2e-6);
    let diferentes = 0;
    for (let u = 0; u < UNIDADES_POR_VOLTA; u += 997) if (cossenoU(u) !== senoU(u + UNIDADES_QUARTO)) diferentes++;
    expect(diferentes).toBe(0);
  });
});

describe('monotonicidade e simetrias exatas (domínio inteiro)', () => {
  it('seno cresce de 0° a 90° e decresce de 90° a 180°, em TODAS as unidades inteiras (8,4 milhões); os outros quadrantes vêm por simetria exata', () => {
    let anterior = senoU(0);
    for (let u = 1; u <= UNIDADES_QUARTO; u++) {
      const v = senoU(u);
      if (v < anterior) throw new Error(`seno decresceu em u=${u} (${anterior} -> ${v}) dentro de [0°, 90°]`);
      anterior = v;
    }
    for (let u = UNIDADES_QUARTO + 1; u <= 2 * UNIDADES_QUARTO; u++) {
      const v = senoU(u);
      if (v > anterior) throw new Error(`seno cresceu em u=${u} (${anterior} -> ${v}) dentro de [90°, 180°]`);
      anterior = v;
    }
    // simetria exata em TODA a volta, de 3 em 3 unidades: sen(-u) = -sen(u) e sen(180° - u) = sen(u)
    let falhas = 0;
    for (let u = 0; u < UNIDADES_POR_VOLTA; u += 3) {
      if (senoU(-u) !== 0 - senoU(u)) falhas++;
      if (senoU(2 * UNIDADES_QUARTO - u) !== senoU(u)) falhas++;
    }
    expect(falhas).toBe(0);
  }, 60_000);

  it('cosseno decresce de 0° a 180° e cresce de 180° a 360° (passo de 0,0005°)', () => {
    let anterior = cosseno(0);
    for (let g = 0.0005; g <= 180; g += 0.0005) {
      const v = cosseno(g);
      if (v > anterior) throw new Error(`cosseno cresceu em ${g}°`);
      anterior = v;
    }
    for (let g = 180.0005; g <= 360; g += 0.0005) {
      const v = cosseno(g);
      if (v < anterior) throw new Error(`cosseno decresceu em ${g}°`);
      anterior = v;
    }
  });

  it('simetrias exatas: ímpar, espelho em 90° e periodicidade (em unidades inteiras)', () => {
    const rng = criarRng(3);
    let falhas = 0;
    for (let i = 0; i < 20000; i++) {
      const u = rng.inteiro(UNIDADES_POR_VOLTA);
      if (senoU(-u) !== 0 - senoU(u)) falhas++;
      if (senoU(2 * UNIDADES_QUARTO - u) !== senoU(u)) falhas++;
      if (senoU(u + UNIDADES_POR_VOLTA) !== senoU(u)) falhas++;
      if (senoU(u - 7 * UNIDADES_POR_VOLTA) !== senoU(u)) falhas++;
    }
    expect(falhas).toBe(0);
  });
});

describe('atan2', () => {
  it('varredura: volta inteira em 3 raios (600 mil pontos), erro máximo < 6e-6 grau', () => {
    let pior = 0;
    for (let i = 0; i < 200000; i++) {
      const t = (i / 200000) * 2 * Math.PI - Math.PI;
      for (const r of [1, 0.001, 1000]) {
        const x = Math.cos(t) * r;
        const y = Math.sin(t) * r;
        pior = Math.max(pior, distAngular(atan2(y, x), Math.atan2(y, x) * GRAU));
      }
    }
    expect(pior).toBeLessThan(6e-6);
  });

  it('propriedade: vetores aleatórios de escalas muito diferentes (200 mil sorteios)', () => {
    const rng = criarRng(99);
    let pior = 0;
    for (let i = 0; i < 200000; i++) {
      const x = rng.entre(-1, 1) * 10 ** rng.entre(-6, 6);
      const y = rng.entre(-1, 1) * 10 ** rng.entre(-6, 6);
      if (x === 0 && y === 0) continue;
      pior = Math.max(pior, distAngular(atan2(y, x), Math.atan2(y, x) * GRAU));
    }
    expect(pior).toBeLessThan(6e-6);
  });

  it('eixos e diagonais exatos; (0,0) é 0; y = -0 conta como 0', () => {
    expect([atan2(0, 1), atan2(1, 0), atan2(0, -1), atan2(-1, 0)]).toEqual([0, 90, 180, -90]);
    expect([atan2(1, 1), atan2(1, -1), atan2(-1, 1), atan2(-1, -1)]).toEqual([45, 135, -45, -135]);
    expect(atan2(0, 0)).toBe(0);
    expect(Object.is(atan2(0, 5), 0)).toBe(true);
    expect(Object.is(atan2(-0, 5), 0)).toBe(true);
    expect(atan2(-0, -5)).toBe(180);
  });

  it('o resultado fica em (-180, 180], e escala do vetor não muda o ângulo', () => {
    const rng = criarRng(5);
    let falhas = 0;
    for (let i = 0; i < 50000; i++) {
      const x = rng.entre(-5, 5);
      const y = rng.entre(-5, 5);
      const a = atan2(y, x);
      if (!(a > -180 && a <= 180)) falhas++;
      if (distAngular(a, atan2(y * 8, x * 8)) !== 0) falhas++; // multiplicar por potência de 2 não muda a razão
    }
    expect(falhas).toBe(0);
  });

  it('monotonia: atan2(y, 1) cresce com y, e atan2(1, x) decresce com x', () => {
    let anterior = atan2(-1e6, 1);
    for (let y = -1000; y <= 1000; y += 0.01) {
      const v = atan2(y, 1);
      if (v < anterior) throw new Error(`atan2(${y}, 1) decresceu`);
      anterior = v;
    }
    anterior = atan2(1, -1000);
    for (let x = -1000; x <= 1000; x += 0.01) {
      const v = atan2(1, x);
      if (v > anterior) throw new Error(`atan2(1, ${x}) cresceu`);
      anterior = v;
    }
  });

  it('ida e volta com seno/cosseno: atan2(seno(g), cosseno(g)) volta a g (erro < 1e-4 grau)', () => {
    const rng = criarRng(21);
    let pior = 0;
    for (let i = 0; i < 50000; i++) {
      const g = rng.entre(-179.9, 179.9);
      pior = Math.max(pior, distAngular(atan2(seno(g), cosseno(g)), g));
    }
    expect(pior).toBeLessThan(1e-4);
  });
});

describe('conversões, normalização e entrada inválida', () => {
  it('graus para unidades fica sempre em [0, 2^24) e ida e volta erra no máximo meia unidade', () => {
    const rng = criarRng(8);
    let falhas = 0;
    for (let i = 0; i < 50000; i++) {
      const g = rng.entre(-5000, 5000);
      const u = grausParaUnidades(g);
      if (!Number.isInteger(u) || u < 0 || u >= UNIDADES_POR_VOLTA) falhas++;
      if (distAngular(unidadesParaGraus(u), g) > 180 / UNIDADES_POR_VOLTA + 1e-9) falhas++;
    }
    expect(falhas).toBe(0);
    expect(grausParaUnidades(360)).toBe(0);
    expect(grausParaUnidades(-90)).toBe(3 * UNIDADES_QUARTO);
    expect(Object.is(grausParaUnidades(-0), 0)).toBe(true);
  });

  it('normalizarGraus leva a (-180, 180] e nunca devolve -0', () => {
    expect([0, 180, -180, 181, -181, 360, 540, -540, 720.5].map(normalizarGraus)).toEqual([0, 180, 180, -179, 179, 0, 180, 180, 0.5]);
    expect(Object.is(normalizarGraus(-360), 0)).toBe(true);
  });

  it('entrada não finita dá NaN em vez de virar um ângulo qualquer em silêncio', () => {
    for (const ruim of [NaN, Infinity, -Infinity]) {
      expect(seno(ruim)).toBeNaN();
      expect(cosseno(ruim)).toBeNaN();
      expect(atan2(ruim, 1)).toBeNaN();
      expect(atan2(1, ruim)).toBeNaN();
      expect(normalizarGraus(ruim)).toBeNaN();
      expect(grausParaUnidades(ruim)).toBeNaN();
    }
    expect(senoU(1.5)).toBeNaN();
  });

  it('graus <-> radianos', () => {
    expect(grausParaRadianos(180)).toBe(Math.PI);
    expect(radianosParaGraus(Math.PI)).toBe(180);
  });
});

describe('determinismo entre motores: hash dourado das saídas', () => {
  it('as saídas numa grade fixa dão o hash gravado (pegaria V8 e JavaScriptCore divergindo no último bit)', () => {
    const v: number[] = [];
    for (let g = -720; g <= 720; g += 0.37) v.push(seno(g), cosseno(g));
    for (let i = -50; i <= 50; i++) for (let j = -50; j <= 50; j++) v.push(atan2(i * 0.7, j * 1.3));
    expect(v).toHaveLength(17985);
    expect(hashDeFloat64s(v)).toBe('da2e145b7467964c');
    // valores legíveis, para o diff mostrar o que mudou
    expect(seno(30)).toBe(0.4999997606500983);
    expect(seno(45)).toBe(0.7071067811921239);
    expect(atan2(1, 2)).toBe(26.565051041543484);
  });
});
