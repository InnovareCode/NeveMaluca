/**
 * Botão/slot de item + feedback de eventos (`render/hud.ts`, plano itens-corrida §I4b/I5). Mesma técnica de
 * `render-hud-combo.test.ts` (ctx falso que REGISTRA as chamadas, sem precisar de DOM/canvas real) -- fecha a
 * mesma lacuna que aquele teste fechou pra barra de combo: prova visual automatizada, não só manual.
 */
import { describe, expect, it } from 'vitest';
import type { EventoCorrida } from '../../src/core/contratos';
import { criarSistemaFeedbackItens, desenharBotaoItem, RETANGULO_BOTAO_ITEM, type DadosBotaoItem } from '../../src/render/hud';

interface ChamadaArco {
  readonly tipo: 'arc';
  readonly x: number;
  readonly y: number;
  readonly raio: number;
}
interface ChamadaTexto {
  readonly tipo: 'fillText' | 'strokeText';
  readonly texto: string;
}
interface ChamadaEstilo {
  readonly tipo: 'fillStyle';
  readonly valor: string;
}

/** Contexto falso que registra arcos/textos/fillStyle -- o resto (save/restore/lineWidth/...) é no-op. */
function criarCtxFake(): { ctx: CanvasRenderingContext2D; chamadas: (ChamadaArco | ChamadaTexto | ChamadaEstilo)[] } {
  const chamadas: (ChamadaArco | ChamadaTexto | ChamadaEstilo)[] = [];
  let fillStyleAtual = '';
  const ctx = {
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    fill: () => undefined,
    stroke: () => undefined,
    setLineDash: () => undefined,
    arc: (x: number, y: number, raio: number) => chamadas.push({ tipo: 'arc', x, y, raio }),
    fillText: (texto: string) => chamadas.push({ tipo: 'fillText', texto }),
    strokeText: (texto: string) => chamadas.push({ tipo: 'strokeText', texto }),
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
    textAlign: { get: () => '', set: () => undefined, enumerable: true },
    textBaseline: { get: () => '', set: () => undefined, enumerable: true },
    lineWidth: { get: () => 0, set: () => undefined, enumerable: true },
    lineJoin: { get: () => '', set: () => undefined, enumerable: true },
    font: { get: () => '', set: () => undefined, enumerable: true },
    globalAlpha: { get: () => 1, set: () => undefined, enumerable: true },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, chamadas };
}

const arcos = (c: readonly (ChamadaArco | ChamadaTexto | ChamadaEstilo)[]) => c.filter((x): x is ChamadaArco => x.tipo === 'arc');
const textos = (c: readonly (ChamadaArco | ChamadaTexto | ChamadaEstilo)[]) => c.filter((x): x is ChamadaTexto => x.tipo === 'fillText' || x.tipo === 'strokeText');
const estilos = (c: readonly (ChamadaArco | ChamadaTexto | ChamadaEstilo)[]) => c.filter((x): x is ChamadaEstilo => x.tipo === 'fillStyle');

describe('RETANGULO_BOTAO_ITEM: canto inferior direito, margem segura (I-D3)', () => {
  it('fica >= 24px de qualquer borda, dentro dos 960x540 lógicos', () => {
    const r = RETANGULO_BOTAO_ITEM;
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(960 - (r.x + r.w)).toBeGreaterThanOrEqual(24);
    expect(540 - (r.y + r.h)).toBeGreaterThanOrEqual(24);
    expect(r.x).toBeGreaterThanOrEqual(24); // também >= 24 da borda esquerda/de cima (canto, não colado)
    expect(r.y).toBeGreaterThanOrEqual(24);
  });
});

describe('desenharBotaoItem: slot vazio x com item x roleta girando', () => {
  it('slot vazio: 2 arcos (fundo + anel pontilhado), NENHUM texto (sem letra de item)', () => {
    const { ctx, chamadas } = criarCtxFake();
    const dados: DadosBotaoItem = { item: null };
    desenharBotaoItem(ctx, dados, 0);
    expect(arcos(chamadas).length).toBeGreaterThanOrEqual(2);
    expect(textos(chamadas)).toHaveLength(0);
  });

  it('com item no slot: desenha a letra do item (ex. "B" de bola) e usa a cor daquele item', () => {
    const { ctx, chamadas } = criarCtxFake();
    const dados: DadosBotaoItem = { item: 'bola' };
    desenharBotaoItem(ctx, dados, 0);
    expect(textos(chamadas).some((t) => t.texto === 'B')).toBe(true);
    expect(estilos(chamadas).some((e) => e.valor === '#eaf6ff')).toBe(true); // COR_ITEM.bola
  });

  it('roleta girando (ticksRestantes alto): cicla pelos tipos conforme o tick, sem travar no `item` do slot', () => {
    const { ctx: ctx0, chamadas: c0 } = criarCtxFake();
    const dados: DadosBotaoItem = { item: null, roleta: { ticksRestantes: 30, resultado: 'turbo' } };
    desenharBotaoItem(ctx0, dados, 0); // tick 0 -> TIPOS_ITEM[0] = 'bola'
    expect(textos(c0).some((t) => t.texto === 'B')).toBe(true);

    const { ctx: ctx1, chamadas: c1 } = criarCtxFake();
    desenharBotaoItem(ctx1, dados, 1); // tick 1 -> TIPOS_ITEM[1] = 'poca'
    expect(textos(c1).some((t) => t.texto === 'P')).toBe(true);
  });

  it('roleta nos últimos ticks (<= 4): assenta no resultado, não cicla mais', () => {
    const { ctx, chamadas } = criarCtxFake();
    const dados: DadosBotaoItem = { item: null, roleta: { ticksRestantes: 2, resultado: 'escudo' } };
    desenharBotaoItem(ctx, dados, 123); // tick alto, qualquer um -- já assentou
    expect(textos(chamadas).some((t) => t.texto === 'E')).toBe(true); // 'escudo' -> 'E'
  });
});

describe('criarSistemaFeedbackItens: só eventos que envolvem o jogador', () => {
  const JOGADOR = 'capi';
  const RIVAL = 'bia';

  it('item-pego/item-usado DO jogador abrem toast; de outro corredor, não', () => {
    const sis = criarSistemaFeedbackItens();
    const { ctx: ctx1, chamadas: c1 } = criarCtxFake();
    sis.atualizar([{ tipo: 'item-pego', id: RIVAL, item: 'bola' }], JOGADOR);
    sis.desenhar(ctx1);
    expect(textos(c1)).toHaveLength(0); // não é do jogador: nada desenhado

    const sis2 = criarSistemaFeedbackItens();
    const { ctx: ctx2, chamadas: c2 } = criarCtxFake();
    sis2.atualizar([{ tipo: 'item-pego', id: JOGADOR, item: 'bola' }], JOGADOR);
    sis2.desenhar(ctx2);
    expect(textos(c2).some((t) => t.texto === 'ITEM!')).toBe(true);
  });

  it('acerto: "ACERTOU!" quando o jogador é `de`, "ATINGIDO!" quando é `em`', () => {
    const sisDe = criarSistemaFeedbackItens();
    const { ctx: ctxDe, chamadas: cDe } = criarCtxFake();
    const evDe: EventoCorrida = { tipo: 'acerto', de: JOGADOR, em: RIVAL, item: 'poca' };
    sisDe.atualizar([evDe], JOGADOR);
    sisDe.desenhar(ctxDe);
    expect(textos(cDe).some((t) => t.texto === 'ACERTOU!')).toBe(true);

    const sisEm = criarSistemaFeedbackItens();
    const { ctx: ctxEm, chamadas: cEm } = criarCtxFake();
    const evEm: EventoCorrida = { tipo: 'acerto', de: RIVAL, em: JOGADOR, item: 'poca' };
    sisEm.atualizar([evEm], JOGADOR);
    sisEm.desenhar(ctxEm);
    expect(textos(cEm).some((t) => t.texto === 'ATINGIDO!')).toBe(true);
  });

  it('sem eventos ativos (vida esgotada), nada é desenhado', () => {
    const sis = criarSistemaFeedbackItens();
    sis.atualizar([{ tipo: 'item-pego', id: JOGADOR, item: 'bola' }], JOGADOR);
    for (let i = 0; i < 60; i++) sis.atualizar([], JOGADOR); // passa da vida do toast
    const { ctx, chamadas } = criarCtxFake();
    sis.desenhar(ctx);
    expect(textos(chamadas)).toHaveLength(0);
  });
});
