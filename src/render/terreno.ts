/**
 * Terreno Morro do Pinhão estilo animação 3D / Pixar (direção de arte §2.1 e §2.2):
 * - Neve volumosa com luz (#F7FBFF) na manta superior e sombra (#BFD9EE) no corpo da montanha.
 * - Crista com iluminação vinda do alto à esquerda.
 * - Acabamento limpo sem artefatos de stroke no WebKit (contorno isolado do polígono estendido).
 */
import { PX_POR_METRO } from '../core/constantes';
import type { PistaGerada } from '../core/contratos';
import type { EstadoCamera } from './mundo';
import { larguraVisivelM, mundoParaTela, pxPorMetro } from './mundo';
import type { PintorTema } from './temas/tipos';

// Tokens de cor oficiais da direção de arte §2.1:
export const COR_NEVE_LUZ = '#F7FBFF';
export const COR_NEVE_SOMBRA = '#BFD9EE';
export const COR_NEVE = COR_NEVE_LUZ;
export const COR_CONTORNO_NEVE = '#E1EEF8';
export const COR_BORDA_SOMBRA = '#A8CDE8';

/** Espessura base da manta de neve fofa iluminada (pixels lógicos). */
export const ESPESSURA_MANTA_NEVE_PX = 18;

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

/**
 * Desenha o terreno visível (corpo sombreado + manta volumosa de neve iluminada + contorno limpo).
 * `pintor?.desenharTerreno`, se existir, assume a PELE (manta/corpo/faixas) do tema por cima da forma calculada
 * aqui (docs/temas-pistas-m3.md §0.4); sem ele, cai na pele genérica do Morro (compat, pixel-idêntico ao que já era).
 */
export function desenharTerreno(ctx: CanvasRenderingContext2D, pista: PistaGerada, camera: EstadoCamera, pintor?: PintorTema): void {
  const comprimentoM = comprimentoDaPistaM(pista);
  const margemM = larguraVisivelM(camera, PX_POR_METRO) * 0.6;
  // SEM `Math.max(0, ...)` aqui de propósito (pedido do dono, 2026-10-24): a câmera centra o piloto desde o 1º
  // quadro (nunca empurrada pra não cortar ninguém na largada, inclusive os 6 do campeonato) -- então é este
  // desenho que precisa se estender pra trás de x=0, nunca a câmera. `alturaDoTerreno` já devolve a altura de
  // `pista.alturas[0]` (achatada) pra qualquer `xm<0` -- a pista aqui simplesmente "continua" num platô na mesma
  // altura da largada, nunca um vazio/buraco. Mesmo array `superficie` abaixo alimenta `pintor?.desenharTerreno`
  // (todos os 5 temas raster): a extensão vale pra pele raster também, sem precisar tocar tema por tema.
  const xEsq = camera.x - margemM;
  const xDir = Math.min(comprimentoM, camera.x + margemM);
  if (xDir <= xEsq) return;

  // 1. Pontos da SUPERFÍCIE da pista em coordenadas de tela
  const superficie: { x: number; y: number }[] = [];
  for (let xm = xEsq; xm <= xDir; xm += pista.dx) {
    superficie.push(mundoParaTela(xm, alturaDoTerreno(pista, xm), camera, PX_POR_METRO));
  }
  if (superficie.length < 2) return;

  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const espessuraPx = Math.max(10, Math.round(ESPESSURA_MANTA_NEVE_PX * (escala / PX_POR_METRO)));

  if (pintor?.desenharTerreno) {
    pintor.desenharTerreno(ctx, pista, camera, superficie, espessuraPx);
    return;
  }

  const FUNDO_PX = 4000;
  const ultimo = superficie[superficie.length - 1]!;
  const primeiro = superficie[0]!;

  // 2. CORPO DO TERRENO EM SOMBRA (#BFD9EE): polígono fechado descendo 4000px além da tela
  // Permite cobrir tudo mesmo com rotações/tremidas extremas da câmera
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  ctx.lineTo(ultimo.x, ultimo.y + FUNDO_PX);
  ctx.lineTo(primeiro.x, primeiro.y + FUNDO_PX);
  ctx.closePath();
  ctx.fillStyle = COR_NEVE_SOMBRA;
  ctx.fill();

  // 3. MANTA VOLUMOSA DE NEVE EM LUZ (#F7FBFF):
  // Cria uma camada fofa de neve no topo com espessura real e profundidade 3D
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  // Volta pela linha de base da manta de neve (criando a faixa volumosa)
  for (let i = superficie.length - 1; i >= 0; i -= 1) {
    ctx.lineTo(superficie[i]!.x, superficie[i]!.y + espessuraPx);
  }
  ctx.closePath();
  ctx.fillStyle = COR_NEVE_LUZ;
  ctx.fill();

  // 4. LINHA DE CONTATO / RELEVO SUAVE NA TRANSIÇÃO DA MANTA PARA A SOMBRA
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y + espessuraPx);
  for (let i = 1; i < superficie.length; i += 1) {
    ctx.lineTo(superficie[i]!.x, superficie[i]!.y + espessuraPx);
  }
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COR_BORDA_SOMBRA;
  ctx.stroke();

  // 5. CONTORNO DA SUPERFÍCIE (ACABAMENTO LIMPO SEM ARTEFATOS NO WEBKIT):
  // Caminho isolado exclusivamente com os pontos da superfície — NUNCA com arestas estendidas
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = COR_CONTORNO_NEVE;
  ctx.stroke();
}
