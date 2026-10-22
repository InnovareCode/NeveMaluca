/**
 * Terreno CINZA (sem arte, plano §7 M1a) a partir de `PistaGerada.alturas` (C5): um polígono cheio, amostrado em
 * `pista.dx` metros, do ponto mais à esquerda visível até o mais à direita, descendo até o fundo da tela.
 */
import { PX_POR_METRO } from '../core/constantes';
import type { PistaGerada } from '../core/contratos';
import type { EstadoCamera } from './mundo';
import { larguraVisivelM, mundoParaTela } from './mundo';

export const COR_NEVE = '#eef3f8';
export const COR_CONTORNO_NEVE = '#9fb6c9';

/** Comprimento total amostrado da pista, em metros. */
export function comprimentoDaPistaM(pista: PistaGerada): number {
  return (pista.alturas.length - 1) * pista.dx;
}

/** Altura do terreno (m) em `xM`, por interpolação linear entre as amostras de `pista.alturas`. Fora da pista: mantém a borda. */
export function alturaDoTerreno(pista: PistaGerada, xM: number): number {
  const i = xM / pista.dx;
  const n = pista.alturas.length;
  const i0 = Math.min(Math.max(Math.floor(i), 0), n - 1);
  const i1 = Math.min(i0 + 1, n - 1);
  const a0 = pista.alturas[i0] as number;
  const a1 = pista.alturas[i1] as number;
  const f = Math.min(Math.max(i - i0, 0), 1);
  return a0 + (a1 - a0) * f;
}

/** Desenha o terreno visível (polígono cheio + contorno) em coordenadas lógicas. */
export function desenharTerreno(ctx: CanvasRenderingContext2D, pista: PistaGerada, camera: EstadoCamera): void {
  const comprimentoM = comprimentoDaPistaM(pista);
  const margemM = larguraVisivelM(camera, PX_POR_METRO) * 0.6;
  const xEsq = Math.max(0, camera.x - margemM);
  const xDir = Math.min(comprimentoM, camera.x + margemM);
  if (xDir <= xEsq) return;

  ctx.beginPath();
  let primeiro = true;
  for (let xm = xEsq; xm <= xDir; xm += pista.dx) {
    const p = mundoParaTela(xm, alturaDoTerreno(pista, xm), camera, PX_POR_METRO);
    if (primeiro) {
      ctx.moveTo(p.x, p.y);
      primeiro = false;
    } else {
      ctx.lineTo(p.x, p.y);
    }
  }
  // desce bem além do fundo da tela (margem grande: sem furo mesmo com a câmera inclinada ou girada por tremida)
  const FUNDO_PX = 4000;
  const pBaseDir = mundoParaTela(xDir, alturaDoTerreno(pista, xDir), camera, PX_POR_METRO);
  const pBaseEsq = mundoParaTela(xEsq, alturaDoTerreno(pista, xEsq), camera, PX_POR_METRO);
  ctx.lineTo(pBaseDir.x, pBaseDir.y + FUNDO_PX);
  ctx.lineTo(pBaseEsq.x, pBaseEsq.y + FUNDO_PX);
  ctx.closePath();
  ctx.fillStyle = COR_NEVE;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COR_CONTORNO_NEVE;
  ctx.stroke();
}
