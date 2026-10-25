/**
 * Módulo único de animação "estilo Pixar" (`docs/direcao-ui-premium.md` §8), para toda a UI fora da corrida.
 *
 * Deliberadamente SEM estado mutável: toda pose é `pose = função(t)`, onde `t` é tempo em TICKS (1 tick = 1/60 s,
 * igual ao relógio do jogo -- nunca `Date.now()`/relógio de parede). Isso mantém determinismo (mesmo `t` sempre
 * produz a mesma pose, testável sem esperar nada de verdade) e evita a classe de bug "esqueci de resetar o
 * tween" -- não há tween para resetar.
 *
 * Cada tela mantém só um contador de ticks (`tEntrada`, "há quantos ticks esta tela ficou visível") e passa pelas
 * funções daqui para saber a pose de cada elemento NESTE quadro. Nenhuma função aqui lança nem depende de DOM:
 * são puras, 100% testáveis em `tests/unit` sem mock de Canvas.
 */

/** Converte milissegundos (como escritos no guia de UI) para ticks de 60 Hz (como o relógio do jogo conta). */
export function msParaTicks(ms: number): number {
  return ms / (1000 / 60);
}

/** [0,1] limitado -- qualquer progresso fora da janela de uma animação satura nas pontas, nunca extrapola. */
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * p;
}

/** Progresso [0,1] de uma animação que começou em `tInicio` (ticks) e dura `duracaoTicks`; `tAtual` é o tick (ou
 *  tick+alpha) atual da cena. Antes de começar = 0; depois de terminar = 1 (satura, nunca passa de 1). */
export function progresso(tAtual: number, tInicio: number, duracaoTicks: number): number {
  if (duracaoTicks <= 0) return tAtual >= tInicio ? 1 : 0;
  return clamp01((tAtual - tInicio) / duracaoTicks);
}

/** Atraso (em ticks) do item `indice` numa entrada escalonada (irmãos de lista/cartões/botões), dado o passo em
 *  ticks entre um e o próximo. Some a `tInicio` do grupo para achar o `tInicio` de CADA item. */
export function escalonar(indice: number, passoTicks: number): number {
  return indice * passoTicks;
}

/** Ponto numa curva de Bézier quadrática em `p` ∈ [0,1] -- usada para o "arco" que tudo que viaja (moeda, cartão,
 *  personagem) deve seguir em vez de linha reta (princípio de animação, §8.1). */
export function bezierQuad(p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, p: number): { x: number; y: number } {
  const um = 1 - p;
  return {
    x: um * um * p0.x + 2 * um * p * p1.x + p * p * p2.x,
    y: um * um * p0.y + 2 * um * p * p1.y + p * p * p2.y,
  };
}

// --- Curvas de easing (§8.2), todas em [0,1] -> [0,1] -------------------------------------------------------

export function easeOutCubic(p: number): number {
  const q = clamp01(p);
  return 1 - (1 - q) ** 3;
}

export function easeInCubic(p: number): number {
  const q = clamp01(p);
  return q ** 3;
}

export function easeInOutCubic(p: number): number {
  const q = clamp01(p);
  return q < 0.5 ? 4 * q ** 3 : 1 - (-2 * q + 2) ** 3 / 2;
}

export function easeInOutSine(p: number): number {
  const q = clamp01(p);
  return 0.5 - 0.5 * Math.cos(Math.PI * q);
}

/** `s = 1,70` dá ~10% de overshoot (entradas normais); `s = 2,6` dá ~20% (comemorações). NÃO satura em 0..1: o
 *  overshoot é o ponto -- passa de 1 e volta. Chamar com `s = 0` (movimento reduzido) degenera em algo bem
 *  próximo de `easeOutCubic` (sem passar de 1). */
export function easeOutBack(s: number): (p: number) => number {
  return (p: number) => {
    const q = Math.max(0, Math.min(1, p)) - 1;
    return 1 + (s + 1) * q ** 3 + s * q ** 2;
  };
}

/** Mola (pouso, soltar botão): passa ~13,5% em p≈0,33, volta ~1,8% em p≈0,67, assenta em 1. */
export function mola(p: number): number {
  const q = clamp01(p);
  return 1 - Math.exp(-6 * q) * Math.cos(3 * Math.PI * q);
}

/** Mola forte (carimbos, medalhas): passa ~19%, volta ~3,6%. */
export function molaForte(p: number): number {
  const q = clamp01(p);
  return 1 - Math.exp(-5 * q) * Math.cos(3 * Math.PI * q);
}

// --- Movimento reduzido (§8.4) ------------------------------------------------------------------------------

export interface AlvoMovimentoReduzido {
  readonly matchMedia?: (consulta: string) => { readonly matches: boolean };
}

/** `true` quando o sistema pede `prefers-reduced-motion: reduce`. Seguro fora do navegador (testes/SSR): sem
 *  `matchMedia`, devolve `false` (nunca lança). */
export function prefereMovimentoReduzido(alvo: AlvoMovimentoReduzido | undefined = typeof window !== 'undefined' ? window : undefined): boolean {
  try {
    return alvo?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

/** `s` de `easeOutBack` a usar nas entradas: 0 (sem overshoot, vira praticamente `easeOutCubic`) quando o
 *  movimento reduzido está ativo, senão o valor pedido (padrão 1,7, o "10% de overshoot" do guia). */
export function overshootPadrao(reduzido: boolean, s = 1.7): number {
  return reduzido ? 0 : s;
}
