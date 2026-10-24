/**
 * Entidades de item no mundo (`render/itens.ts`, plano itens-corrida §I5): caixa/bola/poça desenhadas pela
 * posição certa (via `render/mundo.ts: mundoParaTela`) e com a identidade visual certa por tipo -- mesma técnica
 * de ctx-que-registra de `render-hud-combo.test.ts`/`render-hud-item.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { desenharAvisoAlvo, desenharEntidadesItens, desenharEscudo, type EntidadeItemVisual } from '../../src/render/itens';
import type { EstadoCamera } from '../../src/render/mundo';

interface ChamadaForma {
  readonly tipo: 'arc' | 'ellipse' | 'fillRect' | 'strokeRect';
  readonly x: number;
  readonly y: number;
}
interface ChamadaEstilo {
  readonly tipo: 'fillStyle';
  readonly valor: string;
}

function criarCtxFake(): { ctx: CanvasRenderingContext2D; chamadas: (ChamadaForma | ChamadaEstilo)[] } {
  const chamadas: (ChamadaForma | ChamadaEstilo)[] = [];
  let fillStyleAtual = '';
  const ctx = {
    save: () => undefined,
    restore: () => undefined,
    translate: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    closePath: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    arc: (x: number, y: number) => chamadas.push({ tipo: 'arc', x, y }),
    ellipse: (x: number, y: number) => chamadas.push({ tipo: 'ellipse', x, y }),
    fillRect: (x: number, y: number) => chamadas.push({ tipo: 'fillRect', x, y }),
    strokeRect: (x: number, y: number) => chamadas.push({ tipo: 'strokeRect', x, y }),
    fillText: () => undefined,
  };
  Object.defineProperties(ctx, {
    fillStyle: {
      get: () => fillStyleAtual,
      set: (v: string) => {
        fillStyleAtual = v;
        chamadas.push({ tipo: 'fillStyle', valor: v });
      },
      enumerable: true,
    },
    strokeStyle: { get: () => '', set: () => undefined, enumerable: true },
    lineWidth: { get: () => 0, set: () => undefined, enumerable: true },
    globalAlpha: { get: () => 1, set: () => undefined, enumerable: true },
    textAlign: { get: () => '', set: () => undefined, enumerable: true },
    textBaseline: { get: () => '', set: () => undefined, enumerable: true },
    font: { get: () => '', set: () => undefined, enumerable: true },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, chamadas };
}

const CAMERA_PARADA: EstadoCamera = { x: 0, y: 0, zoom: 1, tremidaX: 0, tremidaY: 0 };

describe('desenharEntidadesItens: cada tipo usa a forma/cor certa, na posição certa', () => {
  it('sem entidades: nada desenhado (early return, zero trabalho)', () => {
    const { ctx, chamadas } = criarCtxFake();
    desenharEntidadesItens(ctx, CAMERA_PARADA, [], 0);
    expect(chamadas).toHaveLength(0);
  });

  it('caixa: quadrado (fillRect), cor dourada', () => {
    const entidades: EntidadeItemVisual[] = [{ id: 'caixa-0', tipo: 'caixa', xM: 0, yM: 0 }];
    const { ctx, chamadas } = criarCtxFake();
    desenharEntidadesItens(ctx, CAMERA_PARADA, entidades, 0);
    expect(chamadas.some((c) => c.tipo === 'fillRect')).toBe(true);
    expect(chamadas.some((c) => c.tipo === 'fillStyle' && (c as { valor: string }).valor === '#ffd166')).toBe(true);
  });

  it('bola: círculo (arc), cor clara de gelo', () => {
    const entidades: EntidadeItemVisual[] = [{ id: 'bola-0', tipo: 'bola', xM: 5, yM: 1 }];
    const { ctx, chamadas } = criarCtxFake();
    desenharEntidadesItens(ctx, CAMERA_PARADA, entidades, 0);
    expect(chamadas.some((c) => c.tipo === 'arc')).toBe(true);
    expect(chamadas.some((c) => c.tipo === 'fillStyle' && (c as { valor: string }).valor === '#eaf6ff')).toBe(true);
  });

  it('poça: elipse achatada, cor de caramelo', () => {
    const entidades: EntidadeItemVisual[] = [{ id: 'poca-0', tipo: 'poca', xM: 3, yM: 0.5 }];
    const { ctx, chamadas } = criarCtxFake();
    desenharEntidadesItens(ctx, CAMERA_PARADA, entidades, 0);
    expect(chamadas.some((c) => c.tipo === 'ellipse')).toBe(true);
    expect(chamadas.some((c) => c.tipo === 'fillStyle' && (c as { valor: string }).valor === '#c87f3c')).toBe(true);
  });

  it('várias entidades juntas: cada uma desenha a própria forma, nenhuma pula a vez', () => {
    const entidades: EntidadeItemVisual[] = [
      { id: 'caixa-0', tipo: 'caixa', xM: 0, yM: 0 },
      { id: 'bola-0', tipo: 'bola', xM: 5, yM: 1 },
      { id: 'poca-0', tipo: 'poca', xM: 10, yM: 0 },
    ];
    const { ctx, chamadas } = criarCtxFake();
    desenharEntidadesItens(ctx, CAMERA_PARADA, entidades, 0);
    expect(chamadas.some((c) => c.tipo === 'fillRect')).toBe(true);
    expect(chamadas.some((c) => c.tipo === 'arc')).toBe(true);
    expect(chamadas.some((c) => c.tipo === 'ellipse')).toBe(true);
  });
});

describe('desenharEscudo / desenharAvisoAlvo: nunca lançam e desenham um círculo', () => {
  it('desenharEscudo desenha pelo menos 1 arco', () => {
    const { ctx, chamadas } = criarCtxFake();
    expect(() => desenharEscudo(ctx, CAMERA_PARADA, 2, 0, 0)).not.toThrow();
    expect(chamadas.some((c) => c.tipo === 'arc')).toBe(true);
  });

  it('desenharAvisoAlvo desenha pelo menos 1 arco', () => {
    const { ctx, chamadas } = criarCtxFake();
    expect(() => desenharAvisoAlvo(ctx, CAMERA_PARADA, 2, 0, 0)).not.toThrow();
    expect(chamadas.some((c) => c.tipo === 'arc')).toBe(true);
  });
});
