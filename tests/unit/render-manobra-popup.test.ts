/**
 * Popups de manobra/combo (`render/manobra.ts`, M2 §3.5). Fechava a lacuna registrada na memória
 * `m2-combo-render-sem-teste-automatizado`: só havia prova manual (Playwright ad-hoc) de que o popup
 * aparecia; nada no CI acusava se a seleção de contexto, o texto ou a vida do popup quebrassem.
 *
 * O que estes testes PROVAM:
 * - o popup de manobra abre com o nome cômico CERTO (via o contexto do voo montado por `atualizar`,
 *   não um texto fixo) e os pontos certos, na posição esperada (mundo -> tela via `mundoParaTela`);
 * - duas manobras no mesmo voo (ex.: mortal + grab) usam o nome COMBINADO com o contexto do voo inteiro
 *   (voltas, ticksNoAr, grab, ticksSegurando) — a parte não-trivial que a memória apontava como frágil;
 * - combo-fechado mostra "xMULT  +total"; combo-perdido só tem a linha cômica (sem números);
 * - cada popup some exatamente depois da sua janela de vida (50 ou 70 ticks) — nem antes, nem depois;
 * - o fade de alpha só começa no último terço da vida;
 * - o pool é circular (capacidade 16): abrir mais que isso não deixa "vazar" popups extras.
 *
 * O que NÃO provam: legibilidade real da fonte, cor percebida na tela do aparelho, ou que o `desenhar`
 * roda a 60fps sem engasgo — isso é e2e/visual no navegador real (fora do escopo desta rodada; ver
 * PENDÊNCIAS no handoff da Íris).
 */
import { describe, expect, it } from 'vitest';
import type { EventoDescida, PilotoLeitura } from '../../src/core/contratos';
import { nomeDaManobra, nomeDoComboPerdido, nomeDoFechamentoDeCombo, nomeDoVoo, type ContextoManobra } from '../../src/data/textos.pt-BR';
import { criarSistemaPopupsManobra, type SistemaPopupsManobra } from '../../src/render/manobra';
import { mundoParaTela, type EstadoCamera } from '../../src/render/mundo';
import { PX_POR_METRO } from '../../src/core/constantes';

/** Câmera neutra (sem pan/zoom/tremida): tela = `mundoParaTela(xM, yM, CAMERA, PX_POR_METRO)` direto. */
const CAMERA: EstadoCamera = { x: 0, y: 0, zoom: 1, tremidaX: 0, tremidaY: 0 };

/** Entrelinha entre o callout e os números, em px lógicos (espelha `ENTRELINHA_PX` de render/manobra.ts). */
const ENTRELINHA_PX = 22;
/** Vidas dos popups, em ticks (espelham `VIDA_MANOBRA_TICKS`/`VIDA_COMBO_TICKS` de render/manobra.ts). */
const VIDA_MANOBRA_TICKS = 50;
const VIDA_COMBO_TICKS = 70;
/** Capacidade do pool circular (espelha `CAPACIDADE` de render/manobra.ts). */
const CAPACIDADE = 16;

function criarPiloto(parcial: Partial<PilotoLeitura> = {}): PilotoLeitura {
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

interface ChamadaTexto {
  readonly metodo: 'fill' | 'stroke';
  readonly texto: string;
  readonly x: number;
  readonly y: number;
  readonly alpha: number;
}

/** Contexto falso que REGISTRA toda chamada de fillText/strokeText, com o `globalAlpha` vigente no momento. */
function criarCtxPopup(): { ctx: CanvasRenderingContext2D; chamadas: ChamadaTexto[] } {
  const chamadas: ChamadaTexto[] = [];
  let alpha = 1;
  let font = '';
  const ctx = {
    save: () => undefined,
    restore: () => undefined,
    fillText: (texto: string, x: number, y: number) => chamadas.push({ metodo: 'fill', texto, x, y, alpha }),
    strokeText: (texto: string, x: number, y: number) => chamadas.push({ metodo: 'stroke', texto, x, y, alpha }),
  };
  Object.defineProperties(ctx, {
    globalAlpha: { get: () => alpha, set: (v: number) => (alpha = v), enumerable: true },
    font: { get: () => font, set: (v: string) => (font = v), enumerable: true },
    fillStyle: { get: () => '', set: () => undefined, enumerable: true },
    strokeStyle: { get: () => '', set: () => undefined, enumerable: true },
    textAlign: { get: () => '', set: () => undefined, enumerable: true },
    textBaseline: { get: () => '', set: () => undefined, enumerable: true },
    lineJoin: { get: () => '', set: () => undefined, enumerable: true },
    lineWidth: { get: () => 0, set: () => undefined, enumerable: true },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, chamadas };
}

/** Desenha num ctx novo e diz se algum popup ainda está visível (algum fillText aconteceu). */
function visivel(sistema: SistemaPopupsManobra): boolean {
  const { ctx, chamadas } = criarCtxPopup();
  sistema.desenhar(ctx, CAMERA);
  return chamadas.some((c) => c.metodo === 'fill');
}

describe('popup de manobra: nome certo, pontos certos, posição certa', () => {
  it('ao pousar com uma manobra "ar" longa, abre com o nome de voo longo e "+pontos", na posição do piloto', () => {
    const sistema = criarSistemaPopupsManobra();
    // voo: 2 ticks no ar (ticksNoAr alto = voo "longo"), pousa no tick 2 com o evento `manobra`.
    sistema.atualizar(criarPiloto({ modo: 'ar', ticksNoAr: 50, x: 5, y: 2.3 }), [], 0);
    sistema.atualizar(criarPiloto({ modo: 'ar', ticksNoAr: 200, x: 5, y: 2.3 }), [], 1);
    sistema.atualizar(criarPiloto({ modo: 'chao', ticksNoAr: 0, x: 5, y: 2 }), [{ tipo: 'manobra', id: 'ar', pontos: 10 }], 2);

    const { ctx, chamadas } = criarCtxPopup();
    sistema.desenhar(ctx, CAMERA);
    const linhas = chamadas.filter((c) => c.metodo === 'fill');
    expect(linhas).toHaveLength(2);

    // o nome esperado vem da MESMA função de dados, com o contexto que o render deveria montar
    // (ticksNoAr = 200, o último tick no ar antes do pouso; semente = tick do pouso).
    const esperado = nomeDaManobra('ar', { junto: ['ar'], semente: 2, ticksNoAr: 200 });
    expect(linhas[0]?.texto).toBe(esperado);
    expect(linhas[1]?.texto).toBe('+10');

    const pt = mundoParaTela(5, 2 + 0.6, CAMERA, PX_POR_METRO); // y+0.6: posição do callout de manobra
    expect(linhas[0]?.x).toBeCloseTo(pt.x, 5);
    expect(linhas[0]?.y).toBeCloseTo(pt.y, 5);
    expect(linhas[1]?.y).toBeCloseTo(pt.y + ENTRELINHA_PX, 5);
  });

  it('popup de manobra some exatamente depois de VIDA_MANOBRA_TICKS (50) ticks sem evento novo', () => {
    const sistema = criarSistemaPopupsManobra();
    sistema.atualizar(criarPiloto({ modo: 'chao' }), [{ tipo: 'manobra', id: 'ar', pontos: 1 }], 0);

    for (let i = 0; i < VIDA_MANOBRA_TICKS - 1; i += 1) sistema.atualizar(criarPiloto({ modo: 'chao' }), [], i + 1);
    expect(visivel(sistema)).toBe(true); // ainda com 1 tick de vida

    sistema.atualizar(criarPiloto({ modo: 'chao' }), [], VIDA_MANOBRA_TICKS);
    expect(visivel(sistema)).toBe(false); // vida chegou a 0
  });

  it('o fade (alpha < 1) só começa no último terço da vida, nunca antes', () => {
    const sistema = criarSistemaPopupsManobra();
    sistema.atualizar(criarPiloto({ modo: 'chao' }), [{ tipo: 'manobra', id: 'ar', pontos: 1 }], 0);

    for (let i = 0; i < 30; i += 1) sistema.atualizar(criarPiloto({ modo: 'chao' }), [], i + 1); // vida 50 -> 20 (40%)
    let reg = criarCtxPopup();
    sistema.desenhar(reg.ctx, CAMERA);
    expect(reg.chamadas[0]?.alpha).toBe(1);

    for (let i = 30; i < 40; i += 1) sistema.atualizar(criarPiloto({ modo: 'chao' }), [], i + 1); // vida 20 -> 10 (20%)
    reg = criarCtxPopup();
    sistema.desenhar(reg.ctx, CAMERA);
    expect(reg.chamadas[0]?.alpha).toBeGreaterThan(0);
    expect(reg.chamadas[0]?.alpha).toBeLessThan(1);
  });
});

describe('popup de combo: fechamento mostra números, perda não', () => {
  it('combo-fechado mostra "xMULT  +total" na posição y+1.0, e some depois de VIDA_COMBO_TICKS (70) ticks', () => {
    const sistema = criarSistemaPopupsManobra();
    sistema.atualizar(criarPiloto({ modo: 'chao', x: 1, y: 1 }), [{ tipo: 'combo-fechado', soma: 100, mult: 3, total: 320 }], 5);

    const { ctx, chamadas } = criarCtxPopup();
    sistema.desenhar(ctx, CAMERA);
    const linhas = chamadas.filter((c) => c.metodo === 'fill');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]?.texto).toBe(nomeDoFechamentoDeCombo(3, 5));
    expect(linhas[1]?.texto).toBe('x3  +320');

    const pt = mundoParaTela(1, 1 + 1.0, CAMERA, PX_POR_METRO);
    expect(linhas[0]?.x).toBeCloseTo(pt.x, 5);
    expect(linhas[0]?.y).toBeCloseTo(pt.y, 5);

    for (let i = 0; i < VIDA_COMBO_TICKS - 1; i += 1) sistema.atualizar(criarPiloto({ modo: 'chao' }), [], i + 6);
    expect(visivel(sistema)).toBe(true);
    sistema.atualizar(criarPiloto({ modo: 'chao' }), [], 6 + VIDA_COMBO_TICKS);
    expect(visivel(sistema)).toBe(false);
  });

  it('combo-perdido só tem a linha cômica (sem números), e some depois de VIDA_MANOBRA_TICKS (50) ticks', () => {
    const sistema = criarSistemaPopupsManobra();
    sistema.atualizar(criarPiloto({ modo: 'chao', x: 2, y: 2 }), [{ tipo: 'combo-perdido', soma: 40 }], 7);

    const { ctx, chamadas } = criarCtxPopup();
    sistema.desenhar(ctx, CAMERA);
    const linhas = chamadas.filter((c) => c.metodo === 'fill');
    expect(linhas).toHaveLength(1); // nenhuma linha de números
    expect(linhas[0]?.texto).toBe(nomeDoComboPerdido(7));

    const pt = mundoParaTela(2, 2 + 0.6, CAMERA, PX_POR_METRO); // y+0.6: posição do callout de combo-perdido
    expect(linhas[0]?.x).toBeCloseTo(pt.x, 5);
    expect(linhas[0]?.y).toBeCloseTo(pt.y, 5);

    for (let i = 0; i < VIDA_MANOBRA_TICKS - 1; i += 1) sistema.atualizar(criarPiloto({ modo: 'chao' }), [], i + 8);
    expect(visivel(sistema)).toBe(true);
    sistema.atualizar(criarPiloto({ modo: 'chao' }), [], 8 + VIDA_MANOBRA_TICKS);
    expect(visivel(sistema)).toBe(false);
  });
});

describe('contexto do voo: duas manobras no mesmo pouso usam o nome COMBINADO', () => {
  it('mortal + grab no mesmo voo usa o nome de combinação, com voltas/ticksSegurando do voo inteiro', () => {
    const sistema = criarSistemaPopupsManobra();
    // 2 ticks no ar segurando grab 'cima', completando 2 voltas; pousa no tick 2 com mortal+grab juntos.
    sistema.atualizar(criarPiloto({ modo: 'ar', voltas: 0, grab: 'cima', ticksNoAr: 5 }), [], 0);
    sistema.atualizar(criarPiloto({ modo: 'ar', voltas: 2, grab: 'cima', ticksNoAr: 40 }), [], 1);
    sistema.atualizar(
      criarPiloto({ modo: 'chao', voltas: 2, x: 0, y: 0 }),
      [
        { tipo: 'manobra', id: 'mortal', pontos: 1200 },
        { tipo: 'manobra', id: 'grab', pontos: 150 },
      ],
      2
    );

    const { ctx, chamadas } = criarCtxPopup();
    sistema.desenhar(ctx, CAMERA);
    const linhas = chamadas.filter((c) => c.metodo === 'fill');

    const ctxEsperado: ContextoManobra = { junto: ['mortal', 'grab'], semente: 2, voltas: 2, ticksNoAr: 40, grab: 'cima', ticksSegurando: 2 };
    expect(linhas[0]?.texto).toBe(nomeDoVoo(['mortal', 'grab'], ctxEsperado));
    expect(linhas[1]?.texto).toBe('+1350'); // 1200 + 150, somados no mesmo voo
  });
});

describe('pool circular: nunca mais que CAPACIDADE (16) popups visíveis ao mesmo tempo', () => {
  it('abrir 20 popups sem deixar nenhum expirar mantém só os 16 mais recentes', () => {
    const sistema = criarSistemaPopupsManobra();
    for (let i = 0; i < 20; i += 1) {
      sistema.atualizar(criarPiloto({ modo: 'chao', x: i, y: 0 }), [{ tipo: 'manobra', id: 'ar', pontos: 1 }], i);
    }

    const { ctx, chamadas } = criarCtxPopup();
    sistema.desenhar(ctx, CAMERA);
    const linhas = chamadas.filter((c) => c.metodo === 'fill');
    expect(linhas).toHaveLength(CAPACIDADE * 2); // comic + números, por popup vivo

    const xsUnicos = [...new Set(linhas.map((l) => Math.round(l.x)))].sort((a, b) => a - b);
    expect(xsUnicos).toHaveLength(CAPACIDADE);
    // i=0..3 foram sobrescritos (20 aberturas - 16 de capacidade = 4 perdidos); sobrevivem i=4..19.
    const pt4 = mundoParaTela(4, 0.6, CAMERA, PX_POR_METRO);
    const pt19 = mundoParaTela(19, 0.6, CAMERA, PX_POR_METRO);
    expect(xsUnicos[0]).toBeCloseTo(pt4.x, 5);
    expect(xsUnicos[xsUnicos.length - 1]).toBeCloseTo(pt19.x, 5);
  });
});

describe('limpar(): zera todos os popups ativos', () => {
  it('depois de limpar(), nada é desenhado mesmo com popups recém-abertos', () => {
    const sistema = criarSistemaPopupsManobra();
    sistema.atualizar(criarPiloto({ modo: 'chao' }), [{ tipo: 'manobra', id: 'ar', pontos: 1 }], 0);
    expect(visivel(sistema)).toBe(true);

    sistema.limpar();
    expect(visivel(sistema)).toBe(false);
  });
});

describe('eventos que não abrem popup de manobra/combo', () => {
  it('pulo, pouso, tombo, trilho(fim), coleta, boneco, checkpoint, chegada: nenhum popup', () => {
    const sistema = criarSistemaPopupsManobra();
    const eventos: EventoDescida[] = [
      { tipo: 'pulo', forca: 1 },
      { tipo: 'pouso', qualidade: 'bom', queda: 1 },
      { tipo: 'tombo', causa: 'angulo' },
      { tipo: 'trilho', etapa: 'fim' },
      { tipo: 'coleta', item: 'moeda' },
      { tipo: 'boneco', x: 1 },
      { tipo: 'checkpoint', indice: 1 },
      { tipo: 'chegada', pontos: 1, ticks: 1 },
    ];
    sistema.atualizar(criarPiloto({ modo: 'chao' }), eventos, 0);
    expect(visivel(sistema)).toBe(false);
  });
});
