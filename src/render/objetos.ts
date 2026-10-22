/**
 * Objetos da pista (C5 `ObjetoPista`) em CINZA/formas geométricas simples (sem arte, plano §7 M1a): um retângulo
 * colorido por tipo, apoiado no terreno em `obj.x`. Protótipo: a arte real (Apolo, M1b) troca isto por sprites.
 */
import { PX_POR_METRO } from '../core/constantes';
import type { ObjetoPista, PistaGerada } from '../core/contratos';
import { alturaDoTerreno } from './terreno';
import { mundoParaTela, pxPorMetro, type EstadoCamera } from './mundo';

const COR_POR_TIPO: Readonly<Partial<Record<ObjetoPista['tipo'], string>>> = {
  pinheiro: '#4a6b57',
  pedra: '#7a7f85',
  tronco: '#6b4a35',
  rampa: '#c7cdd3',
  trilho: '#9aa3ab',
  'boneco-de-neve': '#ffffff',
  bandeira: '#d64545',
  portico: '#d64545',
  floco: '#8ecbe8',
  placa: '#caa15a',
};
const COR_PADRAO = '#888888';

export function desenharObjetos(ctx: CanvasRenderingContext2D, pista: PistaGerada, camera: EstadoCamera): void {
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  for (const obj of pista.objetos) {
    const baseM = alturaDoTerreno(pista, obj.x);
    const centro = mundoParaTela(obj.x, baseM + obj.altura / 2, camera, PX_POR_METRO);
    const larguraPx = Math.max(3, obj.largura * escala);
    const alturaPx = Math.max(3, obj.altura * escala);
    ctx.fillStyle = COR_POR_TIPO[obj.tipo] ?? COR_PADRAO;
    ctx.fillRect(centro.x - larguraPx / 2, centro.y - alturaPx / 2, larguraPx, alturaPx);
    ctx.strokeStyle = '#1b2733';
    ctx.lineWidth = 1;
    ctx.strokeRect(centro.x - larguraPx / 2, centro.y - alturaPx / 2, larguraPx, alturaPx);
  }
}
