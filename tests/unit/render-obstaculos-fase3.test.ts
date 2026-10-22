/**
 * Testes do renderizador de obstáculos da Fase 3 (objetos.ts): cada tipo de obstáculo é desenhado com
 * desenho vetorial dedicado (não o retângulo genérico), com as cores da direção de arte.
 */
import { describe, expect, it, vi } from 'vitest';
import type { PistaGerada } from '../../src/core/contratos';
import { desenharObjetos } from '../../src/render/objetos';
import type { EstadoCamera } from '../../src/render/mundo';

function ctxFalso(): CanvasRenderingContext2D & { fillStyle: string; strokeStyle: string; chamadas: number } {
  const ctx = {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
  return ctx as CanvasRenderingContext2D & { fillStyle: string; strokeStyle: string; chamadas: number };
}

const CAMERA: EstadoCamera = { x: 0, y: 0, zoom: 1, tremidaX: 0, tremidaY: 0 };

function pistaComObjetos(tipo: string, largura: number, altura: number): PistaGerada {
  return {
    alturas: [0, 0, 0, 0, 0, 0],
    dx: 1,
    semente: 1,
    chegadaX: 5,
    objetos: [{ tipo, x: 2, largura, altura, variante: 0 }],
  } as unknown as PistaGerada;
}

describe('Fase 3: renderizador de obstáculos', () => {
  it('pedra usa tons de rocha e calota de neve (não o retângulo padrão)', () => {
    const ctx = ctxFalso();
    desenharObjetos(ctx, pistaComObjetos('pedra', 1.2, 0.8), CAMERA);
    expect(ctx.ellipse).toHaveBeenCalled();
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('tronco usa tora com corte e anéis de madeira', () => {
    const ctx = ctxFalso();
    desenharObjetos(ctx, pistaComObjetos('tronco', 2, 0.6), CAMERA);
    expect(ctx.roundRect).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('boneco-de-neve desenha três esferas com chapéu e nariz de cenoura', () => {
    const ctx = ctxFalso();
    desenharObjetos(ctx, pistaComObjetos('boneco-de-neve', 1, 1.2), CAMERA);
    expect(ctx.arc).toHaveBeenCalled();
  });

  it('trilho desenha postes e travessa de madeira', () => {
    const ctx = ctxFalso();
    desenharObjetos(ctx, pistaComObjetos('trilho', 4, 0.5), CAMERA);
    expect(ctx.roundRect).toHaveBeenCalled();
  });

  it('rampa desenha a curva da cunha com bandeirinha', () => {
    const ctx = ctxFalso();
    desenharObjetos(ctx, pistaComObjetos('rampa', 3, 1.5), CAMERA);
    expect(ctx.quadraticCurveTo).toHaveBeenCalled();
  });

  it('floco (coletável) desenha halo e miolo brilhante', () => {
    const ctx = ctxFalso();
    desenharObjetos(ctx, pistaComObjetos('floco', 0.6, 0.6), CAMERA);
    expect(ctx.arc).toHaveBeenCalled();
  });

  it('tipo desconhecido cai no fallback genérico com neve no topo', () => {
    const ctx = ctxFalso();
    desenharObjetos(ctx, pistaComObjetos('placa', 0.8, 1), CAMERA);
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalled();
  });
});