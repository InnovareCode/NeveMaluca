/**
 * Dados das manobras do M2 (plano §3.5). Só números e ids; a lógica de combo mora em `descida/combo.ts` e a
 * detecção no `descida/motor.ts`. Os NOMES CÔMICOS de exibição são do Apolo (`data/textos.pt-BR.ts`) — aqui fica
 * só o `id` da manobra. Os números são PONTOS DE PARTIDA (plano §3.5): afinar no harness, por
 * isso vivem em dados, não embutidos no motor.
 */
import { PASSO_S, TETO_PONTOS } from '../core/constantes';

export const FAMILIAS_MANOBRA = ['ar', 'mortal', 'grab', 'trilho'] as const;
export type FamiliaManobra = (typeof FAMILIAS_MANOBRA)[number];

/** Id de manobra do M2 (subconjunto de `IdManobra`, que é `string` no contrato C3). */
export type IdManobraM2 = FamiliaManobra;

/** Ticks equivalentes a `s` segundos no passo fixo. `Math.round` é exato o bastante e permitido no núcleo. */
export function ticksDeSegundos(s: number): number {
  return Math.round(s / PASSO_S);
}

// --- Ar: 10 pontos a cada 0,1 s acima de 0,5 s (plano §3.5) ---
export const AR_LIMIAR_TICKS = ticksDeSegundos(0.5);
export const AR_PASSO_TICKS = ticksDeSegundos(0.1);
export const AR_PONTOS_POR_PASSO = 10;

// --- Mortal: por volta COMPLETA (meia volta não conta); 1/2/3 voltas ---
export const MORTAL_PONTOS_POR_VOLTAS = [0, 500, 1200, 2500] as const; // índice = min(voltas, 3)
export const MORTAL_VOLTAS_MAX = 3;

// --- Grab: 150 + 50 a cada 0,25 s segurando ---
export const GRAB_BASE = 150;
export const GRAB_PASSO_TICKS = ticksDeSegundos(0.25);
export const GRAB_PONTOS_POR_PASSO = 50;

// --- Trilho: 20 a cada 0,1 s deslizando ---
export const TRILHO_PASSO_TICKS = ticksDeSegundos(0.1);
export const TRILHO_PONTOS_POR_PASSO = 20;

// --- Combo (plano §3.5) ---
/** Janela de ligação: ticks no chão, depois de um pouso bom, para o próximo pulo CONTINUAR o combo. */
export const JANELA_LIGACAO_TICKS = 60;
/** Multiplicador = 1 + famílias distintas, com este teto. */
export const MULT_TETO = 10;
/** Fator por repetição da MESMA família no combo: 1ª vez cheia, 2ª 50%, 3ª+ 25%. */
export const FATOR_REPETICAO = [1, 0.5, 0.25] as const;
/** Bônus de estilo (+25%) aplicado às manobras do voo quando o pouso é perfeito. */
export const BONUS_ESTILO_PERFEITO = 0.25;

export { TETO_PONTOS };
