import { ALTURA_BUFFER, LARGURA_BUFFER, RS } from './constantes';

export type Ctx = CanvasRenderingContext2D;

/**
 * Pega o canvas do index.html, fixa o buffer em 1920x1080 (960x540 lógicos x RS) e devolve o contexto 2D. Mudar `width`/`height` do
 * canvas REINICIA o contexto (suavização etc.), então o buffer é fixado uma vez, aqui, antes de qualquer configuração.
 */
export function prepararCanvas(doc: Document = document): { readonly canvas: HTMLCanvasElement; readonly ctx: Ctx } {
  const canvas = doc.getElementById('jogo');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('canvas#jogo ausente no index.html');
  if (canvas.width !== LARGURA_BUFFER) canvas.width = LARGURA_BUFFER;
  if (canvas.height !== ALTURA_BUFFER) canvas.height = ALTURA_BUFFER;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador');
  return { canvas, ctx };
}

/** Coloca o contexto no espaço lógico 960x540 (chamar no começo de cada quadro, depois de `save`/`restore` ou `setTransform`). */
export function usarEspacoLogico(ctx: Ctx): void {
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
}
