/**
 * Câmera de descida (plano §3.6). Só render: lê `PilotoLeitura` e os eventos do tick, nunca toca o motor.
 *
 *  - Mola com amortecimento CRÍTICO (sem oscilar) seguindo um ponto à frente do piloto: o olhar à frente é
 *    proporcional a `vx` (quanto mais rápido, mais a câmera antecipa o que vem).
 *  - Zoom de `ZOOM_PARADO` (1,0) até `ZOOM_VELOCIDADE_MAX` (~0,8) conforme a velocidade se aproxima de
 *    `VELOCIDADE_MAX_REF_MS` — ponto de partida para afinar no aparelho com a Vega e o dono (plano: "a medir").
 *  - Tremida curta no pouso pesado/torto e no tombo, com `rngVisual` (NUNCA `Math.random`: regra de todas as
 *    camadas) e decaimento linear em `DURACAO_TREMIDA_TICKS`.
 *  - "Soco" de câmera (feedback do dono, 2026-10-24: "zoom-punch/leve tremor no pouso forte e ao ser atingido"):
 *    um pulso de zoom BEM sutil (`ZOOM_PUNCH_MAX`, poucos % no pico) por cima do zoom de velocidade, decaindo em
 *    `DURACAO_PUNCH_TICKS` -- dispara sozinho no pouso não-perfeito/tombo (escala com `queda`), e também pelo
 *    método `golpe()`, chamado por fora (`ui/cenas/corrida.ts`) quando o jogador é ATINGIDO por um item de rival
 *    (`EventoCorrida 'acerto'`, que esta câmera não enxerga: só lê `EventoDescida`). Deliberadamente sutil --
 *    "sem enjoar" é requisito explícito (o dono joga no iPhone).
 *
 * As constantes de mola/tremida/soco são do RENDER (não do motor): mudar aqui não muda física nem replay.
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
export const DURACAO_PUNCH_TICKS = 8;
/** Pulso de zoom no pico do soco (fração, ex. 0,05 = +5%) -- deliberadamente pequeno, nunca mais que isto. */
export const ZOOM_PUNCH_MAX = 0.05;

export interface Camera {
  /** Um tick (chamar do `atualizar()` da cena, não do `desenhar()`: a câmera também é passo fixo). */
  atualizar(piloto: PilotoLeitura, eventos: readonly EventoDescida[], rngVisual: Rng): void;
  /** Soco de câmera disparado de FORA (ex. o jogador foi atingido por item de rival) -- `intensidade` 0..1;
   *  nunca derruba um soco mais forte já em andamento (o pouso/tombo interno continua ganhando se for maior). */
  golpe(intensidade: number): void;
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
  let ticksPunch = 0;
  let intensidadePunch = 0;

  function golpe(intensidade: number): void {
    const i = Math.max(0, Math.min(1, intensidade));
    if (ticksPunch === 0 || i >= intensidadePunch) {
      intensidadePunch = i;
      ticksPunch = DURACAO_PUNCH_TICKS;
    }
  }

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
          // Soco escala com a queda (pouso mais forte = soco mais forte), mesmo espírito da tremida acima.
          golpe(Math.min(1, 0.35 + ev.queda * 0.12));
        }
        if (ev.tipo === 'tombo') {
          ticksTremida = DURACAO_TREMIDA_TICKS * 2;
          forcaTremida = 10;
          golpe(1);
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
      if (ticksPunch > 0) ticksPunch -= 1;
      else intensidadePunch = 0;
    },
    golpe,
    leitura(): EstadoCamera {
      const fatorPunch = ticksPunch > 0 ? (ticksPunch / DURACAO_PUNCH_TICKS) * intensidadePunch : 0;
      return { x, y, zoom: zoom * (1 + ZOOM_PUNCH_MAX * fatorPunch), tremidaX, tremidaY };
    },
  };
}
