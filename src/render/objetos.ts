/**
 * Renderizador de Objetos da Pista estilo animação 3D / Pixar (Fase 3, plano §2.2):
 * Desenho vetorial estilizado de obstáculos, trilhos de grind, rampas e coletáveis do Morro do Pinhão.
 *
 * Iluminação consistente vinda do alto à esquerda (luz à esquerda/topo, sombra à direita/base).
 * Alto desempenho: apenas primitivas limpas do Canvas 2D sem alocação dinâmica por quadro.
 */
import { PX_POR_METRO } from '../core/constantes';
import type { PistaGerada } from '../core/contratos';
import { mundoParaTela, pxPorMetro, type EstadoCamera } from './mundo';
import { alturaDoTerreno } from './terreno';

const COR_NEVE_LUZ = '#F7FBFF';
const COR_MADEIRA_ESCURA = '#4A2E1B';
const COR_MADEIRA_CLARA = '#7A4D2E';
const COR_ROCHA_SOMBRA = '#4A5B6C';
const COR_ROCHA_LUZ = '#7B8F9F';
const COR_CONTORNO = '#1B2733';

/** Desenha uma pedra de montanha com facetas 3D e neve fofa no topo */
function desenharPedra(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  // Corpo sombreado da rocha
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.4, w * 0.48, h * 0.45, 0, 0, Math.PI * 2);
  ctx.fillStyle = COR_ROCHA_SOMBRA;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.stroke();

  // Faceta iluminada à esquerda (luz solar do alto à esquerda)
  ctx.beginPath();
  ctx.ellipse(x - w * 0.15, y - h * 0.48, w * 0.28, h * 0.32, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = COR_ROCHA_LUZ;
  ctx.fill();

  // Capuz de neve acumulada na crista superior da pedra
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.75, w * 0.42, h * 0.2, 0, Math.PI, 0, false);
  ctx.quadraticCurveTo(x + w * 0.2, y - h * 0.65, x, y - h * 0.68);
  ctx.quadraticCurveTo(x - w * 0.2, y - h * 0.65, x - w * 0.42, y - h * 0.75);
  ctx.closePath();
  ctx.fillStyle = COR_NEVE_LUZ;
  ctx.fill();
  ctx.strokeStyle = '#D5E6F5';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Desenha um tronco de araucária tombado com corte transversal e anéis de crescimento */
function desenharTronco(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const raioCorte = h * 0.48;
  const topoY = y - h * 0.5;

  // Corpo de casca da tora de madeira
  ctx.fillStyle = COR_MADEIRA_ESCURA;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, topoY - raioCorte, w, raioCorte * 2, 4);
  ctx.fill();
  ctx.strokeStyle = COR_CONTORNO;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Corte lateral iluminado na ponta esquerda com anéis de madeira
  ctx.beginPath();
  ctx.ellipse(x - w / 2 + 5, topoY, 5, raioCorte * 0.9, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#C49A6C';
  ctx.fill();
  ctx.stroke();
  // Miolo/anel de crescimento
  ctx.beginPath();
  ctx.ellipse(x - w / 2 + 5, topoY, 2.5, raioCorte * 0.45, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#8A5D3B';
  ctx.fill();

  // Faixa de neve fofa sobre a tora de madeira
  ctx.fillStyle = COR_NEVE_LUZ;
  ctx.beginPath();
  ctx.roundRect(x - w / 2 + 4, topoY - raioCorte - 2, w - 8, 5, 2.5);
  ctx.fill();
}

/** Desenha um boneco de neve cômico de 3 esferas com cenoura e chapéu torto */
function desenharBonecoDeNeve(ctx: CanvasRenderingContext2D, x: number, y: number, _w: number, h: number): void {
  const baseR = h * 0.28;
  const meioR = h * 0.21;
  const cabecaR = h * 0.16;

  const baseCy = y - baseR;
  const meioCy = baseCy - baseR * 0.75 - meioR * 0.75;
  const cabecaCy = meioCy - meioR * 0.75 - cabecaR * 0.75;

  // 1. Bola inferior (base)
  ctx.beginPath();
  ctx.arc(x, baseCy, baseR, 0, Math.PI * 2);
  ctx.fillStyle = COR_NEVE_LUZ;
  ctx.fill();
  ctx.strokeStyle = '#BDD5EA';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 2. Bola média
  ctx.beginPath();
  ctx.arc(x, meioCy, meioR, 0, Math.PI * 2);
  ctx.fillStyle = COR_NEVE_LUZ;
  ctx.fill();
  ctx.stroke();
  // Botões de carvão no peito
  ctx.fillStyle = '#222B35';
  ctx.beginPath();
  ctx.arc(x, meioCy - 3, 2, 0, Math.PI * 2);
  ctx.arc(x, meioCy + 4, 2, 0, Math.PI * 2);
  ctx.fill();

  // 3. Cabeça
  ctx.beginPath();
  ctx.arc(x, cabecaCy, cabecaR, 0, Math.PI * 2);
  ctx.fillStyle = COR_NEVE_LUZ;
  ctx.fill();
  ctx.stroke();

  // Olhos pretos de carvão
  ctx.fillStyle = '#222B35';
  ctx.beginPath();
  ctx.arc(x - 3, cabecaCy - 2, 1.8, 0, Math.PI * 2);
  ctx.arc(x + 3, cabecaCy - 2, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Nariz pontudo de cenoura laranja
  ctx.fillStyle = '#FF7B25';
  ctx.beginPath();
  ctx.moveTo(x, cabecaCy);
  ctx.lineTo(x + 10, cabecaCy + 2);
  ctx.lineTo(x, cabecaCy + 3);
  ctx.closePath();
  ctx.fill();

  // Chapéu de feltro torto no topo da cabeça
  ctx.save();
  ctx.translate(x, cabecaCy - cabecaR + 2);
  ctx.rotate(0.2);
  ctx.fillStyle = '#C0392B';
  ctx.fillRect(-8, -2, 16, 3);
  ctx.fillRect(-5, -11, 10, 9);
  ctx.restore();
}

/** Desenha um trilho de madeira de fazenda serrana para grind */
function desenharTrilho(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const posteW = 6;
  const travessaH = 7;
  const topoY = y - h;

  // 2 Postes verticais cravados no chão da montanha
  ctx.fillStyle = COR_MADEIRA_ESCURA;
  ctx.fillRect(x - w / 2 + 4, topoY, posteW, h);
  ctx.fillRect(x + w / 2 - 4 - posteW, topoY, posteW, h);
  ctx.strokeStyle = COR_CONTORNO;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x - w / 2 + 4, topoY, posteW, h);
  ctx.strokeRect(x + w / 2 - 4 - posteW, topoY, posteW, h);

  // Barra/travessa horizontal de madeira polida onde o piloto faz o grind
  ctx.fillStyle = COR_MADEIRA_CLARA;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, topoY - 2, w, travessaH, 2);
  ctx.fill();
  ctx.strokeStyle = COR_CONTORNO;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Brilho de neve/metal polido no fio superior de grind
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillRect(x - w / 2 + 2, topoY - 2, w - 4, 2);
}

/** Desenha uma rampa esculpida na neve com bandeirinha indicativa de decolagem */
function desenharRampa(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  // Cunha de rampa com curva ascendente suave para lançamento
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y, x + w / 2, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  ctx.fillStyle = COR_NEVE_LUZ;
  ctx.fill();
  ctx.strokeStyle = '#9EBFE3';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Linha de sombra suave na base traseira da rampa
  ctx.fillStyle = '#BFD9EE';
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - 4, y - h);
  ctx.lineTo(x + w / 2, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w / 2 - 4, y);
  ctx.closePath();
  ctx.fill();

  // Bandeirinha triangular vermelha na saída da rampa
  ctx.strokeStyle = COR_MADEIRA_ESCURA;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y - h);
  ctx.lineTo(x + w / 2, y - h - 14);
  ctx.stroke();
  ctx.fillStyle = '#E74C3C';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y - h - 14);
  ctx.lineTo(x + w / 2 + 10, y - h - 10);
  ctx.lineTo(x + w / 2, y - h - 6);
  ctx.closePath();
  ctx.fill();
}

/** Desenha o pinhão dourado ou floco coletável com brilho radiante */
function desenharColetavel(ctx: CanvasRenderingContext2D, x: number, y: number, _w: number, h: number): void {
  const r = h * 0.45;
  const cy = y - h * 0.5;

  // Halo de brilho suave
  ctx.beginPath();
  ctx.arc(x, cy, r * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 235, 120, 0.28)';
  ctx.fill();

  // Pinhão dourado (gota esticada)
  ctx.beginPath();
  ctx.moveTo(x, cy - r * 1.1);
  ctx.quadraticCurveTo(x + r, cy, x, cy + r * 1.1);
  ctx.quadraticCurveTo(x - r, cy, x, cy - r * 1.1);
  ctx.closePath();
  ctx.fillStyle = '#F5B041';
  ctx.fill();
  ctx.strokeStyle = '#D68910';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Miolo brilhante interno
  ctx.beginPath();
  ctx.arc(x - 1, cy - 2, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF9DB';
  ctx.fill();
}

/**
 * Desenha todos os objetos visíveis da pista com acabamento artístico de animação 3D.
 */
export function desenharObjetos(ctx: CanvasRenderingContext2D, pista: PistaGerada, camera: EstadoCamera): void {
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);

  for (const obj of pista.objetos) {
    const baseM = alturaDoTerreno(pista, obj.x);
    // Ponto na tela do ponto de apoio no chão (base do objeto)
    const baseTela = mundoParaTela(obj.x, baseM, camera, PX_POR_METRO);
    const larguraPx = Math.max(8, obj.largura * escala);
    const alturaPx = Math.max(8, obj.altura * escala);

    ctx.save();
    switch (obj.tipo) {
      case 'pedra':
        desenharPedra(ctx, baseTela.x, baseTela.y, larguraPx, alturaPx);
        break;
      case 'tronco':
        desenharTronco(ctx, baseTela.x, baseTela.y, larguraPx, alturaPx);
        break;
      case 'boneco-de-neve':
        desenharBonecoDeNeve(ctx, baseTela.x, baseTela.y, larguraPx, alturaPx);
        break;
      case 'trilho':
        desenharTrilho(ctx, baseTela.x, baseTela.y, larguraPx, alturaPx);
        break;
      case 'rampa':
        desenharRampa(ctx, baseTela.x, baseTela.y, larguraPx, alturaPx);
        break;
      case 'floco':
        desenharColetavel(ctx, baseTela.x, baseTela.y, larguraPx, alturaPx);
        break;
      default:
        // Fallback genérico elegante com contorno escuro e neve no topo
        ctx.fillStyle = '#7A8F9F';
        ctx.fillRect(baseTela.x - larguraPx / 2, baseTela.y - alturaPx, larguraPx, alturaPx);
        ctx.strokeStyle = COR_CONTORNO;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(baseTela.x - larguraPx / 2, baseTela.y - alturaPx, larguraPx, alturaPx);
        ctx.fillStyle = COR_NEVE_LUZ;
        ctx.fillRect(baseTela.x - larguraPx / 2, baseTela.y - alturaPx, larguraPx, 3);
        break;
    }
    ctx.restore();
  }
}
