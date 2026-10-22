/**
 * Origem: copiado do InnoFighters (src/core/rng.ts) e adaptado para o Neve Maluca em 2026-10-22.
 * Diferenças: sem `sementeAleatoria()` com `Math.random`/`Date` (aqui o núcleo é puro: quem quer entropia de verdade
 * injeta a fonte); canais por finalidade (`rngDoCanal`); `estado()` documentado como contrato de serialização.
 *
 * RNG com semente (mulberry32). Substitui `Math.random` na lógica e nos efeitos (plano §3.3): mesma semente =>
 * mesma sequência, em qualquer navegador/Node. Só usa soma, `Math.imul`, xor e deslocamentos de inteiros de 32 bits,
 * que a especificação define bit a bit, então V8 e JavaScriptCore produzem exatamente os mesmos números.
 *
 * Use geradores SEPARADOS por finalidade (lógica, visual, ui, áudio, falas): o replay da lógica não pode depender de
 * quantas partículas o render criou. Ver `CANAL_RNG` e `rngDoCanal`.
 */
import { CANAL_RNG } from './constantes';

export interface Rng {
  /** Próximo float em [0, 1). */
  proximo(): number;
  /** Float em [a, b). */
  entre(a: number, b: number): number;
  /** Inteiro em [0, n). `n` precisa ser inteiro >= 1; outro valor lança (erro de programação, não de dado). */
  inteiro(n: number): number;
  /** Elemento aleatório de uma lista não vazia. */
  escolher<T>(itens: readonly T[]): T;
  /**
   * Estado interno (uint32, serializável em JSON). `criarRng(estado)` retoma a sequência exatamente de onde parou:
   * o próximo valor de `criarRng(r.estado())` é o próximo valor de `r`.
   */
  estado(): number;
}

export function criarRng(semente: number): Rng {
  let a = semente | 0;
  const proximo = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    proximo,
    entre: (x, y) => x + proximo() * (y - x),
    inteiro: (n) => {
      if (!Number.isInteger(n) || n < 1) throw new RangeError(`inteiro(n): n precisa ser inteiro >= 1, recebi ${String(n)}`);
      return Math.floor(proximo() * n);
    },
    escolher: <T>(itens: readonly T[]): T => {
      if (itens.length === 0) throw new Error('escolher: lista vazia');
      return itens[Math.floor(proximo() * itens.length)] as T;
    },
    estado: () => a >>> 0,
  };
}

export type CanalRng = keyof typeof CANAL_RNG;

/** Gerador de um canal (lógica = semente, visual = semente + 1, ui + 2, áudio + 3, falas + 4), plano §3.3. */
export function rngDoCanal(semente: number, canal: CanalRng): Rng {
  return criarRng((semente + CANAL_RNG[canal]) | 0);
}

/**
 * Semente nova para uma partida que não é de pista fixa. O núcleo não tem fonte de entropia própria (nada de
 * `Math.random`, `Date` ou `crypto` global aqui): o chamador (ui/main) passa `globalThis.crypto`.
 */
export function sementeAleatoria(fonte: { getRandomValues(a: Uint32Array<ArrayBuffer>): unknown }): number {
  const a = new Uint32Array(1);
  fonte.getRandomValues(a);
  return a[0] as number;
}
