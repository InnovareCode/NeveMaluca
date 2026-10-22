/**
 * Piloto como CÁPSULA/forma geométrica (sem arte, plano §7 M1a): uma elipse (corpo) sobre um traço (prancha),
 * colorida por `modo`. A arte real (Apolo, M1b) troca isto pelo atlas C1 com `contato`/`pivo`.
 *
 * Conversão de ângulo: o contrato (`core/contratos.ts`) usa GRAUS, 0 = +x, ANTI-horário (convenção matemática,
 * mundo com y para cima). O canvas roda em RADIANOS, sentido horário, com y para baixo. Daí o sinal invertido.
 */
import { PX_POR_METRO } from '../core/constantes';
import type { PilotoLeitura } from '../core/contratos';
import { mundoParaTela, pxPorMetro, type EstadoCamera } from './mundo';

export const COR_POR_MODO: Readonly<Record<PilotoLeitura['modo'], string>> = {
  chao: '#2a7de1',
  ar: '#ff9f43',
  trilho: '#2ecc71',
  tombo: '#e74c3c',
};

const RAIO_CORPO_M = 0.35;
const COMPRIMENTO_PRANCHA_M = 1.3;

export function desenharPiloto(ctx: CanvasRenderingContext2D, piloto: PilotoLeitura, camera: EstadoCamera): void {
  const centro = mundoParaTela(piloto.x, piloto.y, camera, PX_POR_METRO);
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const anguloCanvasRad = (-piloto.angulo * Math.PI) / 180;

  ctx.save();
  ctx.translate(centro.x, centro.y);
  ctx.rotate(anguloCanvasRad);

  ctx.strokeStyle = '#1b2733';
  ctx.lineWidth = Math.max(2, 0.08 * escala);
  ctx.beginPath();
  ctx.moveTo(-(COMPRIMENTO_PRANCHA_M / 2) * escala, 0.32 * escala);
  ctx.lineTo((COMPRIMENTO_PRANCHA_M / 2) * escala, 0.32 * escala);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, -0.08 * escala, RAIO_CORPO_M * escala * 0.8, RAIO_CORPO_M * escala * 1.25, 0, 0, Math.PI * 2);
  ctx.fillStyle = COR_POR_MODO[piloto.modo];
  ctx.fill();
  ctx.lineWidth = Math.max(1, 0.03 * escala);
  ctx.strokeStyle = '#1b2733';
  ctx.stroke();

  ctx.restore();
}
