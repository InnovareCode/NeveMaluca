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

  // pontos da SUPERFÍCIE (só a linha de cima): usados tanto no preenchimento quanto no contorno.
  const superficie: { x: number; y: number }[] = [];
  for (let xm = xEsq; xm <= xDir; xm += pista.dx) {
    superficie.push(mundoParaTela(xm, alturaDoTerreno(pista, xm), camera, PX_POR_METRO));
  }

  // Preenchimento: polígono fechado descendo bem além do fundo da tela (sem furo mesmo com a câmera inclinada ou
  // girada por tremida). Bug real medido no WebKit do iPhone (e2e, 2026-10-22): ao fazer `ctx.stroke()` no MESMO
  // caminho que inclui essas arestas de 4000 px, o WebKit rasteriza mal o traço e pinta uma faixa enorme da tela
  // com a cor do contorno — o Chromium não tem esse problema. Por isso o PREENCHIMENTO e o CONTORNO usam dois
  // `beginPath()` separados: o contorno some do caminho estendido e traça só a linha da superfície.
  ctx.beginPath();
  ctx.moveTo(superficie[0]!.x, superficie[0]!.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  const FUNDO_PX = 4000;
  const ultimo = superficie[superficie.length - 1]!;
  const primeiro = superficie[0]!;
  ctx.lineTo(ultimo.x, ultimo.y + FUNDO_PX);
  ctx.lineTo(primeiro.x, primeiro.y + FUNDO_PX);
  ctx.closePath();
  ctx.fillStyle = COR_NEVE;
  ctx.fill();

  // Contorno: só a linha da superfície (caminho novo, sem as arestas estendidas).
  ctx.beginPath();
  ctx.moveTo(superficie[0]!.x, superficie[0]!.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  ctx.lineWidth = 2;
  ctx.strokeStyle = COR_CONTORNO_NEVE;
  ctx.stroke();
}
