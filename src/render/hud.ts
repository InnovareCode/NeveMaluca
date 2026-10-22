/**
 * HUD de velocidade e pontos (plano §7 M1a). Tipografia igual à do boot.ts (Barlow/Barlow Condensed, já carregada
 * por `platform/fontes.ts` antes do 1º quadro). Contorno marinho + miolo claro: legível sobre céu ou neve.
 */
import { LARGURA } from '../core/constantes';
import type { FaseDescida } from '../core/contratos';

export interface DadosHud {
  readonly velocidadeMs: number;
  readonly pontos: number;
  readonly fase: FaseDescida;
}

const COR_TEXTO = '#f4f9ff';
const COR_CONTORNO = '#0b1a33';

export function desenharHud(ctx: CanvasRenderingContext2D, dados: DadosHud): void {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.font = '700 28px "Barlow Condensed", sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.fillStyle = COR_TEXTO;

  const kmh = Math.round(dados.velocidadeMs * 3.6);
  ctx.textAlign = 'left';
  ctx.strokeText(`${kmh} km/h`, 16, 36);
  ctx.fillText(`${kmh} km/h`, 16, 36);

  ctx.textAlign = 'right';
  const pontosTxt = String(Math.max(0, Math.round(dados.pontos))).padStart(6, '0');
  ctx.strokeText(pontosTxt, LARGURA - 16, 36);
  ctx.fillText(pontosTxt, LARGURA - 16, 36);

  if (dados.fase === 'contagem') {
    ctx.textAlign = 'center';
    ctx.font = 'italic 800 48px "Barlow Condensed", sans-serif';
    ctx.strokeText('PREPARA...', LARGURA / 2, 100);
    ctx.fillText('PREPARA...', LARGURA / 2, 100);
  }
  ctx.restore();
}
