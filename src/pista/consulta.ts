/**
 * Consultas sobre uma `PistaGerada` já pronta: altura do chão e inclinação da tangente em qualquer `x` contínuo
 * (não só nos pontos amostrados a cada 0,5 m), trilho e obstáculo sob um ponto. Usado pelo motor (`descida/`) e pelo
 * bot a cada tick; por isso é tudo aritmética simples sobre o `Float64Array` já amostrado (nada de recalcular Hermite
 * em tempo real) e `atan2` do `core/trig.ts` (determinístico, nunca `Math.atan2`).
 */
import { atan2 } from '../core/trig';
import type { ObjetoPista, PistaGerada, Trilho } from '../core/contratos';
import { TIPOS_OBSTACULO_DURO, TIPO_BONECO_DE_NEVE } from './catalogo';

/** Altura do chão (metros) em qualquer `x` (interpola entre as duas amostras vizinhas; fora da pista, prende nas bordas). */
export function alturaEm(pista: PistaGerada, x: number): number {
  const { alturas, dx } = pista;
  const n = alturas.length;
  const xMax = (n - 1) * dx;
  const xClamp = x < 0 ? 0 : x > xMax ? xMax : x;
  const i = Math.floor(xClamp / dx);
  const i2 = Math.min(i + 1, n - 1);
  const frac = xClamp / dx - i;
  const a = alturas[i] as number;
  const b = alturas[i2] as number;
  return a + (b - a) * frac;
}

/** Trilho que cobre `x` (ou `null`). Em caso de sobreposição (não deveria haver), devolve o primeiro encontrado. */
export function trilhoEm(pista: PistaGerada, x: number): Trilho | null {
  for (const t of pista.trilhos) if (x >= t.x0 && x <= t.x1) return t;
  return null;
}

/**
 * Altura EFETIVA do "chão que se pisa" em `x`: a altura do terreno, somada à altura do trilho quando `x` está sobre
 * um (plano §3.3: pousar sobre um trilho prende o piloto no segmento). Unifica chão e trilho para o motor.
 */
export function alturaEfetivaEm(pista: PistaGerada, x: number): number {
  const trilho = trilhoEm(pista, x);
  return alturaEm(pista, x) + (trilho === null ? 0 : trilho.altura);
}

/** Inclinação da tangente (graus, convenção de `core/trig.ts`) em `x`, pela diferença finita entre amostras vizinhas. */
export function inclinacaoGrausEm(pista: PistaGerada, x: number): number {
  const h = pista.dx;
  const y0 = alturaEm(pista, x);
  const y1 = alturaEm(pista, x + h);
  return atan2(y1 - y0, h);
}

/** Primeiro objeto de obstáculo DURO (pedra/tronco/pinheiro) cujo retângulo `[x, x+largura]` toca `x`, ou `null`. */
export function obstaculoDuroEm(pista: PistaGerada, x: number): ObjetoPista | null {
  for (const o of pista.objetos) {
    if (TIPOS_OBSTACULO_DURO.has(o.tipo) && x >= o.x && x <= o.x + o.largura) return o;
  }
  return null;
}

/** Primeiro boneco de neve cujo retângulo toca `x`, ou `null` (plano §3.3: atravessa, perde um pouco de velocidade). */
export function bonecoDeNeveEm(pista: PistaGerada, x: number): ObjetoPista | null {
  for (const o of pista.objetos) {
    if (o.tipo === TIPO_BONECO_DE_NEVE && x >= o.x && x <= o.x + o.largura) return o;
  }
  return null;
}

/** Existe algum obstáculo duro (pedra/tronco/pinheiro) cujo retângulo cruza o intervalo `[x0, x1]`? Para o bot "olhar à frente". */
export function obstaculoDuroNaFaixa(pista: PistaGerada, x0: number, x1: number): boolean {
  for (const o of pista.objetos) {
    if (TIPOS_OBSTACULO_DURO.has(o.tipo) && o.x <= x1 && o.x + o.largura >= x0) return true;
  }
  return false;
}

/**
 * Fim (x + largura) do obstáculo duro (pedra/tronco/pinheiro) MAIS LONGE cujo INÍCIO cai em `[x0, x1]`, ou `null`
 * se não houver nenhum. Diferente de `obstaculoDuroNaFaixa` (só diz "existe"): usado pelo respawn
 * (`descida/motor.ts`, correção "preso perto de obstáculo") pra saber ATÉ ONDE empurrar o ponto de volta — sempre
 * o mais distante dentro da janela, pra já pular por cima de uma cadeia de obstáculos próximos de uma vez.
 */
export function fimDoObstaculoDuroMaisLongeNaFaixa(pista: PistaGerada, x0: number, x1: number): number | null {
  let fim: number | null = null;
  for (const o of pista.objetos) {
    if (!TIPOS_OBSTACULO_DURO.has(o.tipo) || o.x < x0 || o.x > x1) continue;
    const fimObjeto = o.x + o.largura;
    if (fim === null || fimObjeto > fim) fim = fimObjeto;
  }
  return fim;
}
