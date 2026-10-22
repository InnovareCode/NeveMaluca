/**
 * Trigonometria TABELADA e determinística (plano §3.3). Substitui `Math.sin/cos/atan2` no motor e no gerador de pista.
 *
 * Por quê: `Math.sin` e companhia podem diferir no último dígito entre motores (V8 no PC e no servidor,
 * JavaScriptCore no iPhone). Um replay feito no iPhone divergiria se conferido em outro motor. Aqui:
 *  - as tabelas são construídas só com + - * / (ver `trig-tabelas.ts`) e conferidas por hash no import;
 *  - a interpolação é feita em INTEIROS (ponto fixo 2^30), sem erro de arredondamento dependente de motor;
 *  - a saída é o inteiro dividido por 2^30 (divisão por potência de 2: exata).
 * `Math.round`, `Math.floor` e `%` em doubles são exatos pela especificação, então o resultado é idêntico em qualquer motor.
 *
 * Unidade de ângulo da API: GRAUS (o plano fala em graus: janela de pouso de 20°, inclinação de 5° a 35°). Convertida
 * internamente para UNIDADES de 2^24 por volta (resolução de 0,0000215°). Variantes `*U` recebem unidades inteiras.
 *
 * Precisão (medida em tests/unit/trig.test.ts contra `Math.sin`/`Math.atan2` do próprio teste):
 *  - seno/cosseno: erro absoluto máximo < 5e-7 (interpolação linear em 1024 passos por quarto de volta + quantização do ângulo);
 *  - atan2: erro máximo < 1e-5 grau.
 * Entrada não finita (NaN, Infinity) devolve NaN em vez de virar um ângulo qualquer em silêncio.
 */
import { ErroDeContrato } from './erros';
import { criarHasher } from './hash';
import {
  BITS_PASSO_SENO,
  ESCALA_FIXA,
  PASSO_SENO,
  SEGMENTOS_ATAN,
  UNIDADES_POR_VOLTA,
  UNIDADES_QUARTO,
  construirTabelaAtan,
  construirTabelaSeno,
} from './trig-tabelas';

export { UNIDADES_POR_VOLTA, UNIDADES_QUARTO };

const TAB_SENO = construirTabelaSeno();
const TAB_ATAN = construirTabelaAtan();

/**
 * Hash das duas tabelas. Fixo: se mudar, as pistas e os replays gravados deixam de valer. Mudança PROPOSITAL de
 * tabela = atualizar este valor E tratar como mudança de versão do motor (recordes e fantasmas antigos).
 */
export const HASH_TABELAS_TRIG = '11246e61fddfa40a';

export function hashDasTabelasTrig(): string {
  return criarHasher().i32s(TAB_SENO).i32s(TAB_ATAN).hex();
}

/** Confere as tabelas contra o hash fixo. Roda no import deste módulo: divergência derruba o boot com erro claro. */
export function exigirTabelasTrigValidas(): void {
  const obtido = hashDasTabelasTrig();
  if (obtido !== HASH_TABELAS_TRIG) {
    throw new ErroDeContrato('trig-tabela-divergente', 'tabelas de trigonometria divergem do hash fixo', [
      `esperado=${HASH_TABELAS_TRIG}`,
      `obtido=${obtido}`,
    ]);
  }
}
exigirTabelasTrigValidas();

// --- Conversões ---

const UNIDADES_POR_GRAU = UNIDADES_POR_VOLTA / 360;
const GRAUS_POR_UNIDADE = 360 / UNIDADES_POR_VOLTA;
const GRAUS_POR_FIXO = 360 / ESCALA_FIXA; // 360 * 2^-30: exato
const RAD_POR_GRAU = Math.PI / 180;
const GRAU_POR_RAD = 180 / Math.PI;

export function grausParaRadianos(graus: number): number {
  return graus * RAD_POR_GRAU;
}

export function radianosParaGraus(rad: number): number {
  return rad * GRAU_POR_RAD;
}

/** Graus (qualquer valor finito) para unidades inteiras em [0, 2^24). Não finito => NaN. */
export function grausParaUnidades(graus: number): number {
  if (!Number.isFinite(graus)) return NaN;
  const u = Math.round(graus * UNIDADES_POR_GRAU) % UNIDADES_POR_VOLTA;
  return (u + UNIDADES_POR_VOLTA) % UNIDADES_POR_VOLTA;
}

export function unidadesParaGraus(unidades: number): number {
  return unidades * GRAUS_POR_UNIDADE;
}

/** Normaliza para (-180, 180]. Não finito => NaN. Exato para múltiplos de 360 até ~1e9 graus. */
export function normalizarGraus(graus: number): number {
  if (!Number.isFinite(graus)) return NaN;
  let g = graus % 360; // resto de double: exato pela especificação
  if (g > 180) g -= 360;
  else if (g <= -180) g += 360;
  return g === 0 ? 0 : g; // sem -0
}

// --- Seno e cosseno ---

/** Seno do primeiro quarto, 0 <= r <= UNIDADES_QUARTO, em ponto fixo 2^30, interpolação inteira. */
function senoDoQuarto(r: number): number {
  const i = r >> BITS_PASSO_SENO;
  const frac = r & (PASSO_SENO - 1);
  const a = TAB_SENO[i] as number;
  if (frac === 0) return a;
  const b = TAB_SENO[i + 1] as number;
  // (b - a) <= ~1,65e6 e frac < 4096: o produto cabe com folga em um double; a divisão por 4096 é exata e o floor é inteiro.
  return a + Math.floor(((b - a) * frac) / PASSO_SENO);
}

/** Seno em ponto fixo (escala 2^30) para um ângulo em unidades inteiras [0, 2^24). */
function senoFixo(u: number): number {
  const q = u >> 22; // quadrante 0..3
  const r = u & (UNIDADES_QUARTO - 1);
  switch (q) {
    case 0:
      return senoDoQuarto(r);
    case 1:
      return senoDoQuarto(UNIDADES_QUARTO - r);
    case 2:
      return 0 - senoDoQuarto(r); // 0 - x, não -x: evita o zero negativo
    default:
      return 0 - senoDoQuarto(UNIDADES_QUARTO - r);
  }
}

/** Seno de um ângulo em UNIDADES inteiras (2^24 por volta). Aceita qualquer inteiro (dá a volta). */
export function senoU(unidades: number): number {
  if (!Number.isInteger(unidades)) return NaN;
  const u = ((unidades % UNIDADES_POR_VOLTA) + UNIDADES_POR_VOLTA) % UNIDADES_POR_VOLTA;
  return senoFixo(u) / ESCALA_FIXA;
}

export function cossenoU(unidades: number): number {
  return senoU(unidades + UNIDADES_QUARTO);
}

/** Seno de um ângulo em graus. Resultado em [-1, 1]. */
export function seno(graus: number): number {
  const u = grausParaUnidades(graus);
  if (Number.isNaN(u)) return NaN;
  return senoFixo(u) / ESCALA_FIXA;
}

/** Cosseno de um ângulo em graus. Resultado em [-1, 1]. */
export function cosseno(graus: number): number {
  const u = grausParaUnidades(graus);
  if (Number.isNaN(u)) return NaN;
  return senoFixo((u + UNIDADES_QUARTO) % UNIDADES_POR_VOLTA) / ESCALA_FIXA;
}

// --- Arco-tangente de dois argumentos ---

const FRACOES_ATAN = 1048576; // 2^20: fração de 20 bits (o produto ~1,7e5 x 1e6 cabe com folga num double)
const VOLTA_FIXA = ESCALA_FIXA; // uma volta em ponto fixo
const MEIA_VOLTA_FIXA = VOLTA_FIXA / 2;
const QUARTO_VOLTA_FIXA = VOLTA_FIXA / 4;

/** atan(r), 0 <= r <= 1, em voltas com escala 2^30, interpolação inteira (20 bits de fração). */
function atanDaRazao(r: number): number {
  const pos = r * SEGMENTOS_ATAN; // multiplicação por potência de 2: exata
  const i = Math.floor(pos);
  const a = TAB_ATAN[i] as number;
  if (i >= SEGMENTOS_ATAN) return a;
  const frac = Math.floor((pos - i) * FRACOES_ATAN); // pos - i é exato (mesmo expoente), * 2^20 é exato
  if (frac === 0) return a;
  const b = TAB_ATAN[i + 1] as number;
  return a + Math.floor(((b - a) * frac) / FRACOES_ATAN);
}

/**
 * Ângulo, em GRAUS, do vetor (x, y): 0 = eixo +x, 90 = +y, +-180 = -x. Resultado em (-180, 180].
 * (0, 0) devolve 0. y = -0 conta como y = 0 (então (-1, -0) dá +180, não -180). Não finito => NaN.
 * Mesma ordem dos argumentos de `Math.atan2(y, x)`.
 */
export function atan2(y: number, x: number): number {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return NaN;
  const ax = x < 0 ? -x : x;
  const ay = y < 0 ? -y : y;
  if (ax === 0 && ay === 0) return 0;
  const trocar = ay > ax;
  const razao = trocar ? ax / ay : ay / ax; // em [0, 1]; razão de doubles é correta por IEEE
  let a = atanDaRazao(razao);
  if (trocar) a = QUARTO_VOLTA_FIXA - a;
  if (x < 0) a = MEIA_VOLTA_FIXA - a;
  if (y < 0) a = -a;
  return a === 0 ? 0 : a * GRAUS_POR_FIXO;
}
