/**
 * Coordenadas lógicas do jogo: 960x540.
 * Converte coordenadas de um ponteiro / clique / toque no canvas para o espaço lógico.
 */
import { ALTURA, LARGURA } from '../core/constantes';
import type { AlvoToque } from '../input/toque';

export interface PontoLogico {
  readonly x: number;
  readonly y: number;
}

export function eventoParaPontoLogico(e: { clientX: number; clientY: number }, canvas: AlvoToque): PontoLogico {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width > 0 ? LARGURA / rect.width : 1;
  const scaleY = rect.height > 0 ? ALTURA / rect.height : 1;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  return { x, y };
}

export interface BotaoRetangular {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function pontoDentroDoBotao(p: PontoLogico, b: BotaoRetangular): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}
