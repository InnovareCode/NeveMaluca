import { describe, expect, it } from 'vitest';
import type { EventoDescida, PilotoLeitura } from '../../src/core/contratos';
import { criarRng } from '../../src/core/rng';
import { criarCamera, DURACAO_TREMIDA_TICKS } from '../../src/render/camera';

function piloto(parcial: Partial<PilotoLeitura>): PilotoLeitura {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    velocidade: 0,
    angulo: 0,
    anguloTerreno: 0,
    modo: 'chao',
    pose: 'chao',
    grab: null,
    voltas: 0,
    ticksNoAr: 0,
    ...parcial,
  };
}

describe('render/camera: mola com amortecimento crítico e tremida', () => {
  it('converge para a posição do piloto parado, sem oscilar (amortecimento crítico: nunca passa muito do alvo)', () => {
    const camera = criarCamera(0, 0);
    const rng = criarRng(1);
    const alvo = piloto({ x: 20, y: 0, vx: 0, velocidade: 0 });
    let maximo = 0;
    for (let i = 0; i < 300; i += 1) {
      camera.atualizar(alvo, [], rng);
      maximo = Math.max(maximo, camera.leitura().x);
    }
    const final = camera.leitura().x;
    expect(final).toBeCloseTo(20, 1);
    // amortecimento crítico: não ultrapassa o alvo por mais que uma fração pequena (sem oscilação visível)
    expect(maximo).toBeLessThanOrEqual(20.5);
  });

  it('zoom vai de 1,0 (parado) em direção a ~0,8 conforme a velocidade sobe', () => {
    const camera = criarCamera(0, 0);
    const rng = criarRng(1);
    const rapido = piloto({ x: 0, vx: 60, velocidade: 60 });
    for (let i = 0; i < 200; i += 1) camera.atualizar(rapido, [], rng);
    expect(camera.leitura().zoom).toBeLessThan(1);
    expect(camera.leitura().zoom).toBeGreaterThanOrEqual(0.8 - 1e-6);
  });

  it('tremida: zero em repouso, aparece num pouso torto e some depois de DURACAO_TREMIDA_TICKS ticks', () => {
    const camera = criarCamera(0, 0);
    const rng = criarRng(1);
    const parado = piloto({});
    camera.atualizar(parado, [], rng);
    expect(camera.leitura().tremidaX).toBe(0);
    expect(camera.leitura().tremidaY).toBe(0);

    const eventoPousoTorto: EventoDescida = { tipo: 'pouso', qualidade: 'torto', queda: 10 };
    camera.atualizar(parado, [eventoPousoTorto], rng);
    const comTremida = camera.leitura();
    expect(Math.abs(comTremida.tremidaX) + Math.abs(comTremida.tremidaY)).toBeGreaterThan(0);

    for (let i = 0; i < DURACAO_TREMIDA_TICKS + 2; i += 1) camera.atualizar(parado, [], rng);
    expect(camera.leitura().tremidaX).toBe(0);
    expect(camera.leitura().tremidaY).toBe(0);
  });
});
