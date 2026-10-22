import { describe, expect, it } from 'vitest';
import { criarEntradaToque, type AlvoToque } from '../../src/input/toque';

const RETANGULO = { left: 0, top: 0, right: 960, bottom: 540, width: 960, height: 540, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

interface PointerFalso {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly timeStamp: number;
}

/** Alvo falso (sem DOM; o vitest deste projeto roda em `environment: 'node'`). Mesma ideia do `AlvoFoco` de platform. */
function criarAlvoFalso(): AlvoToque & { disparar(tipo: string, p: PointerFalso): boolean } {
  const ouvintes = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    addEventListener(tipo: string, ouvinte: EventListenerOrEventListenerObject) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo)?.add(ouvinte);
    },
    removeEventListener(tipo: string, ouvinte: EventListenerOrEventListenerObject) {
      ouvintes.get(tipo)?.delete(ouvinte);
    },
    getBoundingClientRect() {
      return RETANGULO;
    },
    disparar(tipo, p) {
      let evitado = false;
      const evento = { ...p, preventDefault: () => (evitado = true) } as unknown as Event;
      for (const ouvinte of ouvintes.get(tipo) ?? []) {
        if (typeof ouvinte === 'function') ouvinte(evento);
        else ouvinte.handleEvent(evento);
      }
      return evitado;
    },
  };
}

describe('input/toque: Pointer Events -> InputFrame (C2)', () => {
  it('tocar em qualquer lugar = pular; metade esquerda = giro -1', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);
    const evitado = alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    expect(evitado).toBe(true); // R6: preventDefault sempre
    const frame = entrada.quadro();
    expect(frame.pular).toBe(true);
    expect(frame.giro).toBe(-1);
  });

  it('metade direita = giro +1', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 800, clientY: 300, timeStamp: 0 });
    expect(entrada.quadro().giro).toBe(1);
  });

  it('margem da borda (R6): tocar perto da borda não conta como "segurar" um lado', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 5, clientY: 300, timeStamp: 0 });
    const frame = entrada.quadro();
    expect(frame.pular).toBe(true); // pular funciona em qualquer lugar, inclusive na borda
    expect(frame.giro).toBe(0);
  });

  it('soltar o dedo zera pular e giro', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointerup', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 10 });
    const frame = entrada.quadro();
    expect(frame.pular).toBe(false);
    expect(frame.giro).toBe(0);
  });

  it('deslize rápido (acima do limiar, dentro da janela) vira grab na direção dominante e some o giro', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo, { limiarDeslizePx: 24, janelaGestoMs: 150 });
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointermove', { pointerId: 1, clientX: 150, clientY: 302, timeStamp: 50 }); // dx=50 >= 24, dt=50<=150
    const frame = entrada.quadro();
    expect(frame.grab).toBe('frente'); // dx positivo e |dx|>=|dy|
    expect(frame.giro).toBe(0);
    expect(entrada.quadro().grab).toBeNull(); // borda: consumido
  });

  it('segurar sem deslizar além da janela classifica como "segurar" (giro continua valendo)', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo, { limiarDeslizePx: 24, janelaGestoMs: 150 });
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointermove', { pointerId: 1, clientX: 105, clientY: 300, timeStamp: 200 }); // dt > 150, dist pequena
    const frame = entrada.quadro();
    expect(frame.grab).toBeNull();
    expect(frame.giro).toBe(-1);
  });

  it('um segundo ponteiro é ignorado enquanto o primeiro ainda está ativo (plano: "com um dedo")', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointerdown', { pointerId: 2, clientX: 800, clientY: 300, timeStamp: 0 });
    expect(entrada.quadro().giro).toBe(-1); // o segundo (que pediria +1) foi ignorado
  });

  it('destruir() remove os listeners', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);
    entrada.destruir();
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    expect(entrada.quadro().pular).toBe(false);
  });
});
