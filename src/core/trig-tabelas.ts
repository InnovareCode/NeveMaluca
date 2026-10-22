/**
 * Construção das tabelas de seno e de arco-tangente, SÓ com soma, subtração, multiplicação e divisão de doubles
 * (operações que o padrão IEEE 754 e o ECMAScript definem bit a bit, sem aproximação do motor) e `Math.round`.
 * É isso que garante a mesma tabela em V8 (PC/servidor) e JavaScriptCore (iPhone). Nenhuma chamada a `Math.sin`,
 * `Math.atan` ou semelhantes, porque elas "podem diferir no último dígito entre motores" (plano §3.3).
 *
 * Quem usa as tabelas é `trig.ts`; ele confere o hash delas no import e derruba o boot se divergirem.
 *
 * Unidades:
 *  - ângulo em UNIDADES: 2^24 por volta (0,00002146 grau cada). Quarto de volta = 2^22; a tabela de seno cobre um quarto
 *    em 1024 passos de 2^12 unidades.
 *  - valores em ponto fixo: seno com escala 2^30 (cabe em Int32: 1,0 = 1073741824); arco-tangente em "voltas" com a
 *    mesma escala 2^30 (45 graus = 2^27).
 */

export const ESCALA_FIXA = 1073741824; // 2^30
export const UNIDADES_POR_VOLTA = 16777216; // 2^24
export const UNIDADES_QUARTO = 4194304; // 2^22
export const BITS_PASSO_SENO = 12;
export const PASSO_SENO = 4096; // 2^12 unidades por entrada da tabela
export const SEGMENTOS_SENO = 1024; // UNIDADES_QUARTO / PASSO_SENO
export const SEGMENTOS_ATAN = 1024; // razão 0..1 em 1024 passos

const PI = Math.PI;

/** sen(x) para x em radianos, 0 <= x <= pi/2, por série de Taylor (termos até x^21: erro < 2e-18, muito abaixo da grade de 2^-30 da tabela). */
function senoTaylor(x: number): number {
  const x2 = x * x;
  let termo = x;
  let soma = x;
  for (let k = 1; k <= 10; k++) {
    termo = (-termo * x2) / ((2 * k) * (2 * k + 1));
    soma += termo;
  }
  return soma;
}

/** atan(r) para 0 <= r <= 0,4143, por série de Taylor (40 termos: erro < 1e-30). */
function atanTaylor(r: number): number {
  const r2 = r * r;
  let potencia = r;
  let soma = r;
  for (let k = 1; k <= 40; k++) {
    potencia = -potencia * r2;
    soma += potencia / (2 * k + 1);
  }
  return soma;
}

/** atan(r) em radianos para 0 <= r <= 1. Acima de 0,4142: atan(r) = pi/4 - atan((1 - r) / (1 + r)). */
function atanRadianos(r: number): number {
  if (r <= 0.4142) return atanTaylor(r);
  return PI / 4 - atanTaylor((1 - r) / (1 + r));
}

/** seno do primeiro quarto de volta, 1025 entradas (0..90 graus), escala 2^30. Monótona crescente. */
export function construirTabelaSeno(): Int32Array {
  const t = new Int32Array(SEGMENTOS_SENO + 1);
  const radPorUnidade = (2 * PI) / UNIDADES_POR_VOLTA; // divisão por potência de 2: exata
  for (let i = 0; i <= SEGMENTOS_SENO; i++) {
    t[i] = Math.round(senoTaylor(i * PASSO_SENO * radPorUnidade) * ESCALA_FIXA);
  }
  return t;
}

/** atan(i / 1024) em voltas com escala 2^30, 1025 entradas (0..45 graus). Monótona crescente. */
export function construirTabelaAtan(): Int32Array {
  const t = new Int32Array(SEGMENTOS_ATAN + 1);
  for (let i = 0; i <= SEGMENTOS_ATAN; i++) {
    t[i] = Math.round((atanRadianos(i / SEGMENTOS_ATAN) / (2 * PI)) * ESCALA_FIXA);
  }
  return t;
}
