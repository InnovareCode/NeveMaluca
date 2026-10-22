/**
 * Transformação MUNDO (metros, y para CIMA, convenção de `core/contratos.ts`) -> TELA LÓGICA (px, y para BAIXO,
 * origem no canto superior esquerdo, 960x540 — plano §3.2). Só esta função sabe fazer essa conta; o resto do
 * `render/` (terreno, objetos, piloto) desenha em px lógicos a partir dela.
 *
 * `ANCORA_HORIZONTE_FRAC`: a altura do piloto na tela não é o meio da tela, e sim um pouco abaixo (plano §3.6,
 * "enquadramento vertical que mantém o terreno à frente visível na descida íngreme"). Ponto de partida para afinar
 * no aparelho junto com a câmera; não é valor de motor.
 */
import { ALTURA, LARGURA } from '../core/constantes';

export const ANCORA_HORIZONTE_FRAC = 0.58;

/** Estado da câmera que o render lê a cada quadro (produzido por `camera.ts`). Só render; o motor nunca vê isto. */
export interface EstadoCamera {
  /** Centro da câmera no mundo, metros. */
  readonly x: number;
  readonly y: number;
  /** 1,0 parado até ~0,8 no teto de velocidade (plano §3.6). */
  readonly zoom: number;
  /** Tremida (px lógicos), decai a 0 entre impactos. */
  readonly tremidaX: number;
  readonly tremidaY: number;
}

/** Pixels lógicos por metro, com o zoom da câmera aplicado. */
export function pxPorMetro(pxPorMetroBase: number, zoom: number): number {
  return pxPorMetroBase * zoom;
}

export interface PontoTela {
  readonly x: number;
  readonly y: number;
}

/** Converte um ponto do mundo (metros) para a tela lógica (px), dada a câmera e a escala-base (`PX_POR_METRO`). */
export function mundoParaTela(xM: number, yM: number, camera: EstadoCamera, pxPorMetroBase: number): PontoTela {
  const escala = pxPorMetro(pxPorMetroBase, camera.zoom);
  return {
    x: LARGURA / 2 + (xM - camera.x) * escala + camera.tremidaX,
    y: ALTURA * ANCORA_HORIZONTE_FRAC - (yM - camera.y) * escala + camera.tremidaY,
  };
}

/** Largura visível, em metros, com a escala atual (útil para decidir a janela de desenho do terreno). */
export function larguraVisivelM(camera: EstadoCamera, pxPorMetroBase: number): number {
  return LARGURA / pxPorMetro(pxPorMetroBase, camera.zoom);
}
