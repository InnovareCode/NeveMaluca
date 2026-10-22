import { describe, expect, it } from 'vitest';
import { ALTURA, LARGURA, PX_POR_METRO } from '../../src/core/constantes';
import { ANCORA_HORIZONTE_FRAC, larguraVisivelM, mundoParaTela, pxPorMetro } from '../../src/render/mundo';

const CAMERA_ORIGEM = { x: 0, y: 0, zoom: 1, tremidaX: 0, tremidaY: 0 };

describe('render/mundo: transformação metros (y para cima) -> px lógicos (y para baixo)', () => {
  it('a câmera na origem, zoom 1: o ponto (0,0) do mundo cai na âncora do horizonte, centralizado em x', () => {
    const p = mundoParaTela(0, 0, CAMERA_ORIGEM, PX_POR_METRO);
    expect(p.x).toBeCloseTo(LARGURA / 2);
    expect(p.y).toBeCloseTo(ALTURA * ANCORA_HORIZONTE_FRAC);
  });

  it('x do mundo cresce para a direita na tela; y do mundo para cima faz a tela subir (y menor)', () => {
    const base = mundoParaTela(0, 0, CAMERA_ORIGEM, PX_POR_METRO);
    const direita = mundoParaTela(1, 0, CAMERA_ORIGEM, PX_POR_METRO);
    const cima = mundoParaTela(0, 1, CAMERA_ORIGEM, PX_POR_METRO);
    expect(direita.x).toBeGreaterThan(base.x);
    expect(cima.y).toBeLessThan(base.y);
  });

  it('mover a câmera é equivalente a mover o piloto ao contrário: ponto na posição da câmera cai no centro', () => {
    const camera = { x: 10, y: 2, zoom: 1, tremidaX: 0, tremidaY: 0 };
    const p = mundoParaTela(10, 2, camera, PX_POR_METRO);
    expect(p.x).toBeCloseTo(LARGURA / 2);
    expect(p.y).toBeCloseTo(ALTURA * ANCORA_HORIZONTE_FRAC);
  });

  it('a tremida soma direto em px, sem passar pela escala', () => {
    const camera = { x: 0, y: 0, zoom: 1, tremidaX: 5, tremidaY: -3 };
    const p = mundoParaTela(0, 0, camera, PX_POR_METRO);
    expect(p.x).toBeCloseTo(LARGURA / 2 + 5);
    expect(p.y).toBeCloseTo(ALTURA * ANCORA_HORIZONTE_FRAC - 3);
  });

  it('o zoom reduz a escala (pxPorMetro) e portanto a largura visível aumenta', () => {
    const cheio = pxPorMetro(PX_POR_METRO, 1);
    const afastado = pxPorMetro(PX_POR_METRO, 0.8);
    expect(afastado).toBeLessThan(cheio);
    const camZoom = { x: 0, y: 0, zoom: 0.8, tremidaX: 0, tremidaY: 0 };
    expect(larguraVisivelM(camZoom, PX_POR_METRO)).toBeGreaterThan(larguraVisivelM(CAMERA_ORIGEM, PX_POR_METRO));
  });

  it('com zoom 1,0 a largura visível é LARGURA/PX_POR_METRO (24 m, plano §3.3: "a tela mostra 24 m de largura")', () => {
    expect(larguraVisivelM(CAMERA_ORIGEM, PX_POR_METRO)).toBeCloseTo(LARGURA / PX_POR_METRO);
  });
});
