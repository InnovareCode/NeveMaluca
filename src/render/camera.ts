/**
 * Câmera de descida (plano §3.6). Só render: lê `PilotoLeitura` e os eventos do tick, nunca toca o motor.
 *
 *  - Mola com amortecimento CRÍTICO (sem oscilar) seguindo um ponto à frente do piloto: o olhar à frente é
 *    proporcional a `vx` (quanto mais rápido, mais a câmera antecipa o que vem).
 *  - Zoom de `ZOOM_PARADO` (1,0) até `ZOOM_VELOCIDADE_MAX` (~0,8) conforme a velocidade se aproxima de
 *    `VELOCIDADE_MAX_REF_MS` — ponto de partida para afinar no aparelho com a Vega e o dono (plano: "a medir").
 *  - Tremida curta no pouso pesado/torto e no tombo, com `rngVisual` (NUNCA `Math.random`: regra de todas as
 *    camadas) e decaimento linear em `DURACAO_TREMIDA_TICKS`.
 *
 * As constantes de mola/tremida são do RENDER (não do motor): mudar aqui não muda física nem replay.
 */
import { PASSO_S, ZOOM_PARADO, ZOOM_VELOCIDADE_MAX } from '../core/constantes';
import type { EventoDescida, PilotoLeitura } from '../core/contratos';
import type { Rng } from '../core/rng';
import type { EstadoCamera } from './mundo';

/** m/s que corresponde ao zoom mínimo. Ponto de partida (plano §3.6); a velocidade máxima real é de `data/personagens`. */
export const VELOCIDADE_MAX_REF_MS = 40;
/** Rigidez da mola (1/s²) e amortecimento crítico (2*sqrt(rigidez): sem oscilação). */
export const RIGIDEZ_CAMERA = 70;
export const AMORTECIMENTO_CAMERA = 2 * Math.sqrt(RIGIDEZ_CAMERA);
/** Quantos segundos de `vx` a câmera antecipa (olhar à frente, plano §3.6). */
export const OLHAR_FRENTE_S = 0.6;
export const DURACAO_TREMIDA_TICKS = 10;

export interface Camera {
  /** Um tick (chamar do `atualizar()` da cena, não do `desenhar()`: a câmera também é passo fixo). */
  atualizar(piloto: PilotoLeitura, eventos: readonly EventoDescida[], rngVisual: Rng): void;
  leitura(): EstadoCamera;
}

export function criarCamera(xInicial: number, yInicial: number): Camera {
  let x = xInicial;
  let y = yInicial;
  let vx = 0;
  let vy = 0;
  let zoom = ZOOM_PARADO;
  let ticksTremida = 0;
  let forcaTremida = 0;
  let tremidaX = 0;
  let tremidaY = 0;

  return {
    atualizar(piloto, eventos, rngVisual) {
      const alvoX = piloto.x + piloto.vx * OLHAR_FRENTE_S;
      const alvoY = piloto.y;
      const acelX = RIGIDEZ_CAMERA * (alvoX - x) - AMORTECIMENTO_CAMERA * vx;
      const acelY = RIGIDEZ_CAMERA * (alvoY - y) - AMORTECIMENTO_CAMERA * vy;
      vx += acelX * PASSO_S;
      vy += acelY * PASSO_S;
      x += vx * PASSO_S;
      y += vy * PASSO_S;

      const t = Math.min(1, piloto.velocidade / VELOCIDADE_MAX_REF_MS);
      const zoomAlvo = ZOOM_PARADO + (ZOOM_VELOCIDADE_MAX - ZOOM_PARADO) * t;
      zoom += (zoomAlvo - zoom) * 0.1;

      for (const ev of eventos) {
        if (ev.tipo === 'pouso' && ev.qualidade !== 'perfeito') {
          ticksTremida = DURACAO_TREMIDA_TICKS;
          forcaTremida = ev.qualidade === 'torto' ? 6 : 3;
        }
        if (ev.tipo === 'tombo') {
          ticksTremida = DURACAO_TREMIDA_TICKS * 2;
          forcaTremida = 10;
        }
      }
      if (ticksTremida > 0) {
        const escalaTremida = ticksTremida / DURACAO_TREMIDA_TICKS;
        tremidaX = rngVisual.entre(-forcaTremida, forcaTremida) * escalaTremida;
        tremidaY = rngVisual.entre(-forcaTremida, forcaTremida) * escalaTremida;
        ticksTremida -= 1;
      } else {
        tremidaX = 0;
        tremidaY = 0;
      }
    },
    leitura(): EstadoCamera {
      return { x, y, zoom, tremidaX, tremidaY };
    },
  };
}
