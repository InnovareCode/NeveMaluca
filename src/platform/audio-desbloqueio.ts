/**
 * Origem: copiado do InnoFighters (src/platform/audio-desbloqueio.ts) em 2026-10-22, sem mudança de comportamento. A cena/áudio do Neve Maluca
 * (audio/, da Vega) implementa `AudioDestravavel` (ctx, init, resume) e chama `desbloquearAudio(window, audio)` UMA vez no boot.
 */
/**
 * Desbloqueio do áudio em iOS/WebKit (o aparelho do dono é um iPhone; o Chrome do iOS usa o motor do Safari). O `AudioContext` nasce `suspended` e só passa a
 * `running` se `resume()` for chamado DENTRO de um gesto que o WebKit reconhece: `touchend`, `click`, `pointerup`/`mouseup` ou tecla. O `touchstart` NÃO conta, e o
 * toque no canvas do jogo é tratado no `touchstart` (com `preventDefault`, que ainda suprime o `click`): sem isto, a cena de abertura criaria o contexto e ele
 * ficaria mudo no iPhone. Também cobre o estado `interrupted` do iOS (ligação, volta do segundo plano): o próximo gesto religa.
 *
 * É idempotente e barato: com o contexto já `running` cada gesto só confere o estado. `init()` e `resume()` do AudioSys são os de sempre (o `iniciarAudio` da cena de
 * abertura continua valendo; isto só garante que o contexto exista e esteja rodando depois de um gesto reconhecido).
 */
export interface AudioDestravavel {
  ctx: { state: string } | null;
  init(): void;
  resume(): void;
}

const GESTOS = ['touchend', 'pointerup', 'mouseup', 'click', 'keydown'] as const;

/**
 * Quem quer saber que o contexto existe depois de um gesto (as amostras reais decodificam as folhas AGORA, não no meio da primeira luta). Roda em todo gesto, com o
 * contexto já `running` ou não, e precisa ser barato; erro de um ouvinte nunca derruba o desbloqueio.
 */
const ouvintes = new Set<(audio: AudioDestravavel) => void>();
export function aoGestoDeAudio(fn: (audio: AudioDestravavel) => void): () => void {
  ouvintes.add(fn);
  return () => void ouvintes.delete(fn);
}

/** Liga o desbloqueio em `alvo` (a janela). Devolve a função que o desfaz. */
export function desbloquearAudio(alvo: Pick<EventTarget, 'addEventListener' | 'removeEventListener'>, audio: AudioDestravavel): () => void {
  const aoGesto = (): void => {
    if (audio.ctx?.state !== 'running') {
      audio.init();
      audio.resume();
    }
    for (const fn of ouvintes) {
      try {
        fn(audio);
      } catch (e) {
        console.error('ouvinte do desbloqueio de áudio falhou', e);
      }
    }
  };
  for (const g of GESTOS) alvo.addEventListener(g, aoGesto, { capture: true, passive: true });
  return () => {
    for (const g of GESTOS) alvo.removeEventListener(g, aoGesto, { capture: true } as EventListenerOptions);
  };
}
