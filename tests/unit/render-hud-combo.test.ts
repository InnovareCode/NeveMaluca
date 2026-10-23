/**
 * Barra de combo do HUD (`render/hud.ts`, M2 §3.5). Fechava a lacuna registrada na memória
 * `m2-combo-render-sem-teste-automatizado`: a barra só tinha prova visual manual.
 *
 * O que estes testes PROVAM:
 * - com `combo.ativo === false` a barra não desenha NADA (nem fundo, nem contorno, nem texto);
 * - com combo ativo, mostra "xMULT  +soma" e a barra de preenchimento é proporcional a
 *   `janela / JANELA_LIGACAO_TICKS`, corretamente travada em [0, 1] nos extremos;
 * - a soma exibida é arredondada;
 * - INTEGRAÇÃO real com `descida/combo.ts` (não um `ComboLeitura` só imaginado pelo teste): ao
 *   `fechar()` (chegada) ou `perder()` (tombo) o estado real do combo, a leitura fica `ativo: false`
 *   e a barra desaparece no próximo quadro — é exatamente o comportamento que o Atlas pediu provar.
 *
 * O que NÃO provam: posição/legibilidade real na tela do aparelho (e2e/visual, fora desta rodada).
 */
import { describe, expect, it } from 'vitest';
import type { ComboLeitura, FaseDescida } from '../../src/core/contratos';
import { abrirJanela, adicionarManobra, comboInicial, fechar, leituraCombo, perder } from '../../src/descida/combo';
import { desenharHud, type DadosHud } from '../../src/render/hud';

// Espelham constantes internas de render/hud.ts (não exportadas): LARGURA_BARRA_COMBO, ALTURA_BARRA_COMBO e o `y` fixo.
const LARGURA = 960;
const LARGURA_BARRA_COMBO = 220;
const ALTURA_BARRA_COMBO = 10;
const X_BARRA = LARGURA / 2 - LARGURA_BARRA_COMBO / 2;
const Y_BARRA = 48;

interface ChamadaRetangulo {
  readonly tipo: 'fillRect' | 'strokeRect';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
interface ChamadaTexto {
  readonly tipo: 'fillText' | 'strokeText';
  readonly texto: string;
}

/** Contexto falso que registra retângulos e textos desenhados (sem se importar com estilo/fonte). */
function criarCtxHud(): { ctx: CanvasRenderingContext2D; chamadas: (ChamadaRetangulo | ChamadaTexto)[] } {
  const chamadas: (ChamadaRetangulo | ChamadaTexto)[] = [];
  const ctx = {
    save: () => undefined,
    restore: () => undefined,
    fillRect: (x: number, y: number, w: number, h: number) => chamadas.push({ tipo: 'fillRect', x, y, w, h }),
    strokeRect: (x: number, y: number, w: number, h: number) => chamadas.push({ tipo: 'strokeRect', x, y, w, h }),
    fillText: (texto: string) => chamadas.push({ tipo: 'fillText', texto }),
    strokeText: (texto: string) => chamadas.push({ tipo: 'strokeText', texto }),
  };
  Object.defineProperties(ctx, {
    fillStyle: { get: () => '', set: () => undefined, enumerable: true },
    strokeStyle: { get: () => '', set: () => undefined, enumerable: true },
    textAlign: { get: () => '', set: () => undefined, enumerable: true },
    textBaseline: { get: () => '', set: () => undefined, enumerable: true },
    lineJoin: { get: () => '', set: () => undefined, enumerable: true },
    lineWidth: { get: () => 0, set: () => undefined, enumerable: true },
    font: { get: () => '', set: () => undefined, enumerable: true },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, chamadas };
}

function dados(combo: ComboLeitura, fase: FaseDescida = 'descendo'): DadosHud {
  return { velocidadeMs: 0, pontos: 0, fase, combo };
}

const fillRects = (chamadas: readonly (ChamadaRetangulo | ChamadaTexto)[]): ChamadaRetangulo[] =>
  chamadas.filter((c): c is ChamadaRetangulo => c.tipo === 'fillRect');
const strokeRects = (chamadas: readonly (ChamadaRetangulo | ChamadaTexto)[]): ChamadaRetangulo[] =>
  chamadas.filter((c): c is ChamadaRetangulo => c.tipo === 'strokeRect');

describe('barra de combo: nada quando inativo', () => {
  it('combo.ativo === false: nenhum retângulo e nenhum texto de multiplicador desenhados', () => {
    const combo: ComboLeitura = { ativo: false, manobras: [], soma: 0, mult: 1, janela: 0 };
    const { ctx, chamadas } = criarCtxHud();
    desenharHud(ctx, dados(combo));

    expect(fillRects(chamadas)).toHaveLength(0);
    expect(strokeRects(chamadas)).toHaveLength(0);
    expect(chamadas.some((c) => c.tipo === 'fillText' && /^x\d/.test(c.texto))).toBe(false);
  });
});

describe('barra de combo: ativo mostra multiplicador, soma e janela proporcional', () => {
  it('mult=2, soma=13, janela=30 (metade de 60): texto "x2  +13" e barra na metade', () => {
    const combo: ComboLeitura = { ativo: true, manobras: ['ar', 'grab'], soma: 13, mult: 2, janela: 30 };
    const { ctx, chamadas } = criarCtxHud();
    desenharHud(ctx, dados(combo));

    expect(chamadas.some((c) => c.tipo === 'fillText' && c.texto === 'x2  +13')).toBe(true);

    const retFundo = fillRects(chamadas);
    expect(retFundo).toHaveLength(2); // fundo + preenchimento
    expect(retFundo[0]).toMatchObject({ x: X_BARRA, y: Y_BARRA, w: LARGURA_BARRA_COMBO, h: ALTURA_BARRA_COMBO });
    expect(retFundo[1]).toMatchObject({ x: X_BARRA, y: Y_BARRA, w: LARGURA_BARRA_COMBO * 0.5, h: ALTURA_BARRA_COMBO });

    const bordas = strokeRects(chamadas);
    expect(bordas).toHaveLength(1);
    expect(bordas[0]).toMatchObject({ x: X_BARRA, y: Y_BARRA, w: LARGURA_BARRA_COMBO, h: ALTURA_BARRA_COMBO });
  });

  it.each([0, -5])('janela %i: só o fundo é desenhado, sem a barra de preenchimento (fração travada em 0)', (janela) => {
    const combo: ComboLeitura = { ativo: true, manobras: ['ar'], soma: 5, mult: 1, janela };
    const { ctx, chamadas } = criarCtxHud();
    desenharHud(ctx, dados(combo));
    expect(fillRects(chamadas)).toHaveLength(1); // só o fundo
  });

  it('janela muito maior que JANELA_LIGACAO_TICKS (60): preenchimento travado em 100%, nunca passa da barra', () => {
    const combo: ComboLeitura = { ativo: true, manobras: ['ar'], soma: 5, mult: 1, janela: 9999 };
    const { ctx, chamadas } = criarCtxHud();
    desenharHud(ctx, dados(combo));
    const preenchimento = fillRects(chamadas)[1];
    expect(preenchimento?.w).toBe(LARGURA_BARRA_COMBO);
  });

  it('a soma exibida é arredondada (13,6 -> "+14")', () => {
    const combo: ComboLeitura = { ativo: true, manobras: ['ar'], soma: 13.6, mult: 2, janela: 10 };
    const { ctx, chamadas } = criarCtxHud();
    desenharHud(ctx, dados(combo));
    expect(chamadas.some((c) => c.tipo === 'fillText' && c.texto === 'x2  +14')).toBe(true);
  });
});

describe('integração com descida/combo.ts: a barra segue o estado REAL do combo (não um ComboLeitura imaginado)', () => {
  it('fechar() o combo (chegada/janela esgotada) zera `ativo` e a barra desaparece no próximo quadro', () => {
    const estado = comboInicial();
    adicionarManobra(estado, { id: 'ar', familia: 'ar', pontos: 10 });
    abrirJanela(estado);

    const ativo = leituraCombo(estado);
    expect(ativo.ativo).toBe(true);
    const regAtivo = criarCtxHud();
    desenharHud(regAtivo.ctx, dados(ativo));
    expect(fillRects(regAtivo.chamadas).length).toBeGreaterThan(0);

    fechar(estado);
    const fechado = leituraCombo(estado);
    expect(fechado.ativo).toBe(false);

    const regFechado = criarCtxHud();
    desenharHud(regFechado.ctx, dados(fechado));
    expect(fillRects(regFechado.chamadas)).toHaveLength(0);
    expect(strokeRects(regFechado.chamadas)).toHaveLength(0);
  });

  it('perder() o combo (tombo) também zera `ativo`/`soma` e a barra desaparece no próximo quadro', () => {
    const estado = comboInicial();
    adicionarManobra(estado, { id: 'grab', familia: 'grab', pontos: 50 });
    abrirJanela(estado);
    expect(leituraCombo(estado).ativo).toBe(true);

    perder(estado);
    const perdido = leituraCombo(estado);
    expect(perdido.ativo).toBe(false);
    expect(perdido.soma).toBe(0);

    const { ctx, chamadas } = criarCtxHud();
    desenharHud(ctx, dados(perdido));
    expect(fillRects(chamadas)).toHaveLength(0);
    expect(strokeRects(chamadas)).toHaveLength(0);
  });
});
