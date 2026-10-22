/**
 * Origem: adaptado de src/platform/foco.ts do InnoFighters (2026-10-22). Novidade: avisa também a VOLTA (foco e visibilidade),
 * porque o laço retoma sozinho quando o jogador volta.
 */
export interface CallbacksFoco {
  /** A janela perdeu o foco (blur). */
  aoPerderFoco?: () => void;
  /** A janela ganhou o foco de volta. */
  aoGanharFoco?: () => void;
  /** A aba foi para segundo plano (visibilitychange com document.hidden). */
  aoOcultar?: () => void;
  /** A aba voltou a ficar visível. */
  aoMostrar?: () => void;
}

/** O que `observarFoco` usa da janela (permite testar em Node com um objeto falso). */
export type AlvoFoco = Pick<Window, 'addEventListener' | 'removeEventListener'> & {
  readonly document: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;
};

/**
 * Pausa por foco/visibilidade: o jogo pausa sozinho ao trocar de app, abrir o seletor de abas ou bloquear a tela, e retoma na volta.
 * Devolve a função que desfaz a ligação.
 */
export function observarFoco(alvo: AlvoFoco, cb: CallbacksFoco): () => void {
  const blur = (): void => cb.aoPerderFoco?.();
  const focus = (): void => cb.aoGanharFoco?.();
  const visibilidade = (): void => {
    if (alvo.document.hidden) cb.aoOcultar?.();
    else cb.aoMostrar?.();
  };
  alvo.addEventListener('blur', blur);
  alvo.addEventListener('focus', focus);
  alvo.document.addEventListener('visibilitychange', visibilidade);
  return () => {
    alvo.removeEventListener('blur', blur);
    alvo.removeEventListener('focus', focus);
    alvo.document.removeEventListener('visibilitychange', visibilidade);
  };
}
