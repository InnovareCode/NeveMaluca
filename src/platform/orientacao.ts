/**
 * Origem: adaptado de src/platform/orientacao.ts do InnoFighters (2026-10-22). Novidade: `observarOrientacao`, que avisa a quem
 * pausa o jogo quando o aparelho vai para retrato (o aviso visual "vire o aparelho" é só CSS, em plataforma.css, e usa a MESMA
 * condição que `emRetrato`).
 */

/**
 * Janela em retrato? Igual à media query `(orientation: portrait)` do CSS: altura >= largura (quadrada conta como retrato).
 * O jogo é paisagem (decisão D2): em retrato o aviso cobre a tela e a simulação pausa.
 */
export function emRetrato(largura: number, altura: number): boolean {
  return altura >= largura;
}

/** O que `observarOrientacao` precisa da janela (permite testar em Node). */
export type AlvoOrientacao = Pick<Window, 'matchMedia'>;

/**
 * Chama `aoMudar(emRetrato)` agora e a cada mudança de orientação. Usa a mesma media query do CSS, então o aviso e a pausa nunca
 * discordam. Devolve a função que desfaz a ligação.
 */
export function observarOrientacao(alvo: AlvoOrientacao, aoMudar: (retrato: boolean) => void): () => void {
  const consulta = alvo.matchMedia('(orientation: portrait)');
  const aoAlterar = (e: { matches: boolean }): void => aoMudar(e.matches);
  consulta.addEventListener('change', aoAlterar);
  aoMudar(consulta.matches);
  return () => consulta.removeEventListener('change', aoAlterar);
}

/**
 * Tenta travar a tela em paisagem (só funciona em tela cheia e em navegadores que oferecem a API; o iOS não oferece). Melhor esforço:
 * nunca lança. Chamada pela tela cheia (tela-cheia.ts) ao entrar.
 */
export async function travarPaisagem(alvo: Window = window): Promise<boolean> {
  try {
    const orientacao = alvo.screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (!orientacao || typeof orientacao.lock !== 'function') return false;
    await orientacao.lock('landscape');
    return true;
  } catch {
    return false;
  }
}
