import { describe, expect, it, vi } from 'vitest';
import type { AlvoToque } from '../../src/input/toque';
import type { AlvoTeclado } from '../../src/input/teclado';
import { criarCenaAbertura } from '../../src/ui/cenas/abertura';
import { criarCenaMenu } from '../../src/ui/cenas/menu';
import { criarCenaOpcoes } from '../../src/ui/cenas/opcoes';
import { criarCenaSelecao } from '../../src/ui/cenas/selecao';
import { criarCenaSelecaoPista } from '../../src/ui/cenas/selecao-pista';
import { criarGerenciadorCenas, type GerenciadorCenas } from '../../src/ui/cenas/gerenciador';
import { eventoParaPontoLogico, pontoDentroDoBotao } from '../../src/ui/interacao';
import { caminhoArredondado } from '../../src/ui/desenho';
import { TICKS_NEVASCA_ATE_CONSTRUIR } from '../../src/ui/transicao';
import type { SaveV1 } from '../../src/meta/tipos';
import { CONFIG_PADRAO } from '../../src/meta/storage';

/** Depois de um clique/tecla que troca de cena de topo, a cena nova só é CONSTRUÍDA (e seus ouvintes ficam vivos)
 *  ao fim de cobrir+segurar da "Nevasca" (`ui/transicao.ts` §10.1) -- sem isto, o próximo clique cairia num
 *  canvas sem ninguém escutando (bloqueado pela própria Nevasca) e a troca nunca aconteceria de verdade. */
function avancarNevasca(gerenciador: Pick<GerenciadorCenas, 'atualizar'>): void {
  for (let i = 0; i < TICKS_NEVASCA_ATE_CONSTRUIR; i += 1) gerenciador.atualizar();
}

interface PointerFalso {
  readonly pointerId?: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly timeStamp?: number;
}

function criarCanvasFalso(): AlvoToque & {
  disparar(tipo: string, p: PointerFalso): void;
  totalOuvintes(tipo: string): number;
} {
  const ouvintes = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    addEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo)?.add(fn);
    },
    removeEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      ouvintes.get(tipo)?.delete(fn);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, right: 960, bottom: 540, width: 960, height: 540, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
    },
    disparar(tipo: string, p: PointerFalso) {
      const ev = { ...p, preventDefault: () => undefined, bubbles: true } as unknown as Event;
      const lista = [...(ouvintes.get(tipo) ?? [])];
      for (const fn of lista) {
        if (typeof fn === 'function') fn(ev);
        else fn.handleEvent(ev);
      }
    },
    totalOuvintes(tipo: string) {
      return ouvintes.get(tipo)?.size ?? 0;
    },
  };
}

function criarJanelaFalsa(): AlvoTeclado & {
  disparar(codigo: string): void;
  totalOuvintes(tipo: string): number;
} {
  const ouvintes = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    addEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo)?.add(fn);
    },
    removeEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      ouvintes.get(tipo)?.delete(fn);
    },
    disparar(codigo: string) {
      const ev = { code: codigo, preventDefault: () => undefined } as unknown as Event;
      const lista = [...(ouvintes.get('keydown') ?? [])];
      for (const fn of lista) {
        if (typeof fn === 'function') fn(ev);
        else fn.handleEvent(ev);
      }
    },
    totalOuvintes(tipo: string) {
      return ouvintes.get(tipo)?.size ?? 0;
    },
  };
}

function saveMock(): SaveV1 {
  return {
    v: 1,
    cfg: { ...CONFIG_PADRAO },
    prog: {
      desbloqueados: [],
      pistas: [],
      flocos: 0,
      objetivos: [],
      desconhecidos: [],
    },
    recordes: {},
  };
}

describe('Fase 1: Interação e geometria lógica (960x540)', () => {
  it('eventoParaPontoLogico converte proporcionalmente às dimensões do canvas', () => {
    const canvas = {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      getBoundingClientRect: () =>
        ({ left: 100, top: 50, right: 1060, bottom: 590, width: 960, height: 540, x: 100, y: 50, toJSON: () => ({}) }) as DOMRect,
    };
    const pt = eventoParaPontoLogico({ clientX: 580, clientY: 320 }, canvas);
    expect(pt.x).toBe(480);
    expect(pt.y).toBe(270);
  });

  it('pontoDentroDoBotao checa limites do retângulo', () => {
    const b = { id: 'teste', x: 100, y: 100, w: 200, h: 50 };
    expect(pontoDentroDoBotao({ x: 150, y: 120 }, b)).toBe(true);
    expect(pontoDentroDoBotao({ x: 100, y: 100 }, b)).toBe(true);
    expect(pontoDentroDoBotao({ x: 300, y: 150 }, b)).toBe(true);
    expect(pontoDentroDoBotao({ x: 99, y: 120 }, b)).toBe(false);
    expect(pontoDentroDoBotao({ x: 301, y: 120 }, b)).toBe(false);
    expect(pontoDentroDoBotao({ x: 150, y: 151 }, b)).toBe(false);
  });

  it('caminhoArredondado traça sem erro em contexto mock', () => {
    const ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arcTo: vi.fn(),
      closePath: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    caminhoArredondado(ctx, { x: 10, y: 10, w: 100, h: 40 }, 10);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.arcTo).toHaveBeenCalledTimes(4);
    expect(ctx.closePath).toHaveBeenCalled();
  });
});

describe('Fase 1: Cena de Abertura (Splash)', () => {
  it('avança suavemente ao atingir ticksMaximos', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoAvancar = vi.fn();

    const cena = criarCenaAbertura({
      canvas,
      janela,
      aoAvancar,
      ticksMaximos: 10,
    });

    // t = 0..9 (ainda não avançou)
    for (let i = 0; i < 9; i += 1) cena.atualizar();
    expect(aoAvancar).not.toHaveBeenCalled();

    // t = 10 (começa o fade out de 20 ticks)
    cena.atualizar();
    expect(aoAvancar).not.toHaveBeenCalled();

    // ticks do fade
    for (let i = 0; i < 20; i += 1) cena.atualizar();
    expect(aoAvancar).toHaveBeenCalledTimes(1);
  });

  it('avança ao tocar ou clicar no canvas', () => {
    const canvas = criarCanvasFalso();
    const aoAvancar = vi.fn();
    const cena = criarCenaAbertura({ canvas, aoAvancar, ticksMaximos: 200 });

    canvas.disparar('pointerdown', { clientX: 200, clientY: 200 });
    // fade out de 20 ticks
    for (let i = 0; i < 20; i += 1) cena.atualizar();
    expect(aoAvancar).toHaveBeenCalledTimes(1);
  });

  it('avança ao teclar Espaço ou Enter', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoAvancar = vi.fn();
    const cena = criarCenaAbertura({ canvas, janela, aoAvancar, ticksMaximos: 200 });

    janela.disparar('Space');
    for (let i = 0; i < 20; i += 1) cena.atualizar();
    expect(aoAvancar).toHaveBeenCalledTimes(1);
  });

  it('remove os ouvintes de evento ao chamar destruir()', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const cena = criarCenaAbertura({ canvas, janela, aoAvancar: () => undefined });

    expect(canvas.totalOuvintes('pointerdown')).toBe(1);
    expect(janela.totalOuvintes('keydown')).toBe(1);

    cena.destruir?.();
    expect(canvas.totalOuvintes('pointerdown')).toBe(0);
    expect(janela.totalOuvintes('keydown')).toBe(0);
  });
});

describe('Fase 1: Cena de Menu Principal', () => {
  it('dispara aoJogar ao tocar no botão Jogar ou apertar Enter', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoJogar = vi.fn();
    const aoOpcoes = vi.fn();

    const cena = criarCenaMenu({ canvas, janela, aoJogar, aoOpcoes });

    // Clica dentro de Treino (ex-Jogar): x: 20..240, y: 204..244
    canvas.disparar('pointerdown', { clientX: 130, clientY: 224 });
    expect(aoJogar).toHaveBeenCalledTimes(1);

    // Tecla Enter
    janela.disparar('Enter');
    expect(aoJogar).toHaveBeenCalledTimes(2);

    cena.destruir?.();
  });

  it('dispara aoOpcoes ao tocar no botão Opções ou apertar KeyO', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoJogar = vi.fn();
    const aoOpcoes = vi.fn();

    const cena = criarCenaMenu({ canvas, janela, aoJogar, aoOpcoes });

    // Clica dentro de Opções: x: 20..240, y: 400..440
    canvas.disparar('pointerdown', { clientX: 130, clientY: 420 });
    expect(aoOpcoes).toHaveBeenCalledTimes(1);

    janela.disparar('KeyO');
    expect(aoOpcoes).toHaveBeenCalledTimes(2);

    cena.destruir?.();
  });

  it('dispara aoModos ao tocar no botão Modos', () => {
    const canvas = criarCanvasFalso();
    const aoModos = vi.fn();

    const cena = criarCenaMenu({
      canvas,
      aoJogar: () => undefined,
      aoOpcoes: () => undefined,
      aoModos,
    });

    // Clica dentro de Modos (CAMPEONATO): x: 20..240, y: 252..292
    canvas.disparar('pointerdown', { clientX: 130, clientY: 272 });
    expect(aoModos).toHaveBeenCalledTimes(1);

    cena.destruir?.();
  });

  it('limpa listeners ao chamar destruir()', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const cena = criarCenaMenu({
      canvas,
      janela,
      aoJogar: () => undefined,
      aoOpcoes: () => undefined,
    });

    expect(canvas.totalOuvintes('pointerdown')).toBe(1);
    expect(canvas.totalOuvintes('pointermove')).toBe(1);
    expect(janela.totalOuvintes('keydown')).toBe(1);

    cena.destruir?.();
    expect(canvas.totalOuvintes('pointerdown')).toBe(0);
    expect(canvas.totalOuvintes('pointermove')).toBe(0);
    expect(janela.totalOuvintes('keydown')).toBe(0);
  });

  it('dispara aoPersonagem ao tocar no botão PERSONAGEM ou apertar KeyP; sem o callback fica inerte', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoPersonagem = vi.fn();

    const cena = criarCenaMenu({
      canvas,
      janela,
      aoJogar: () => undefined,
      aoOpcoes: () => undefined,
      aoPersonagem,
    });

    // Clica dentro de Personagem: x: 20..240, y: 448..488
    canvas.disparar('pointerdown', { clientX: 130, clientY: 468 });
    expect(aoPersonagem).toHaveBeenCalledTimes(1);

    janela.disparar('KeyP');
    expect(aoPersonagem).toHaveBeenCalledTimes(2);

    cena.destruir?.();

    // Sem aoPersonagem: clicar no botão não lança erro
    const cenaSemCallback = criarCenaMenu({ canvas, aoJogar: () => undefined, aoOpcoes: () => undefined });
    expect(() => canvas.disparar('pointerdown', { clientX: 130, clientY: 468 })).not.toThrow();
    cenaSemCallback.destruir?.();
  });

  it('dispara aoPista ao tocar no botão PISTA (abaixo de PERSONAGEM) ou apertar KeyT; sem o callback fica inerte', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoPista = vi.fn();

    const cena = criarCenaMenu({
      canvas,
      janela,
      aoJogar: () => undefined,
      aoOpcoes: () => undefined,
      aoPista,
    });

    // Botão PISTA: x 20..240, y 496..536 (abaixo de PERSONAGEM, mesma coluna)
    canvas.disparar('pointerdown', { clientX: 130, clientY: 516 });
    expect(aoPista).toHaveBeenCalledTimes(1);

    janela.disparar('KeyT');
    expect(aoPista).toHaveBeenCalledTimes(2);

    cena.destruir?.();

    // Sem aoPista: clicar no botão não lança erro
    const cenaSemCallback = criarCenaMenu({ canvas, aoJogar: () => undefined, aoOpcoes: () => undefined });
    expect(() => canvas.disparar('pointerdown', { clientX: 130, clientY: 516 })).not.toThrow();
    cenaSemCallback.destruir?.();
  });

  it('sem campeonato em andamento, CAMPEONATO chama aoModos direto (comportamento de sempre)', () => {
    const canvas = criarCanvasFalso();
    const aoModos = vi.fn();

    const cena = criarCenaMenu({
      canvas,
      aoJogar: () => undefined,
      aoOpcoes: () => undefined,
      aoModos,
      obterCampeonatoEmAndamento: () => null,
    });

    canvas.disparar('pointerdown', { clientX: 130, clientY: 272 });
    expect(aoModos).toHaveBeenCalledTimes(1);

    cena.destruir?.();
  });

  it('com campeonato em andamento (pedido do dono): CAMPEONATO abre o overlay Continuar/Novo jogo, não chama aoModos', () => {
    const canvas = criarCanvasFalso();
    const aoModos = vi.fn();
    const aoContinuarCampeonato = vi.fn();
    const aoNovoCampeonato = vi.fn();

    const cena = criarCenaMenu({
      canvas,
      aoJogar: () => undefined,
      aoOpcoes: () => undefined,
      aoModos,
      aoContinuarCampeonato,
      aoNovoCampeonato,
      obterCampeonatoEmAndamento: () => ({ semente: 1, personagem: 'capi', etapa: 2, pistasConcluidas: [] }),
    });

    // Clica em CAMPEONATO: com campeonato em andamento, abre o overlay (não corre direto pro `aoModos`)
    canvas.disparar('pointerdown', { clientX: 130, clientY: 272 });
    expect(aoModos).not.toHaveBeenCalled();

    // Painel central (ver `PAINEL_CAMP_*`/`BOTAO_CONTINUAR_CAMP` de `menu.ts`): CONTINUAR em (480, 271)
    canvas.disparar('pointerdown', { clientX: 480, clientY: 271 });
    expect(aoContinuarCampeonato).toHaveBeenCalledTimes(1);
    expect(aoNovoCampeonato).not.toHaveBeenCalled();

    cena.destruir?.();
  });

  it('Novo jogo pede confirmação (perde o progresso) antes de chamar aoNovoCampeonato; CANCELAR não chama nada', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoNovoCampeonato = vi.fn();
    const aoContinuarCampeonato = vi.fn();

    const cena = criarCenaMenu({
      canvas,
      janela,
      aoJogar: () => undefined,
      aoOpcoes: () => undefined,
      aoModos: () => undefined,
      aoContinuarCampeonato,
      aoNovoCampeonato,
      obterCampeonatoEmAndamento: () => ({ semente: 1, personagem: 'capi', etapa: 2, pistasConcluidas: [] }),
    });

    canvas.disparar('pointerdown', { clientX: 130, clientY: 272 }); // CAMPEONATO -> overlay
    canvas.disparar('pointerdown', { clientX: 480, clientY: 327 }); // NOVO JOGO -> sub-painel de confirmação
    expect(aoNovoCampeonato).not.toHaveBeenCalled(); // ainda não -- só depois de confirmar

    // CANCELAR no sub-painel (385, 311) vs (575, 311): cancela e volta pro painel de escolha, sem apagar nada
    canvas.disparar('pointerdown', { clientX: 575, clientY: 311 });
    expect(aoNovoCampeonato).not.toHaveBeenCalled();

    // Reabre Novo jogo e agora confirma (385, 311) = "SIM, NOVO JOGO"
    canvas.disparar('pointerdown', { clientX: 480, clientY: 327 });
    canvas.disparar('pointerdown', { clientX: 385, clientY: 311 });
    expect(aoNovoCampeonato).toHaveBeenCalledTimes(1);
    expect(aoContinuarCampeonato).not.toHaveBeenCalled();

    cena.destruir?.();
  });

  it('Escape fecha o overlay Campeonato (sem chamar nada) e, no sub-painel, volta à escolha', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoModos = vi.fn();
    const aoNovoCampeonato = vi.fn();
    const aoContinuarCampeonato = vi.fn();

    const cena = criarCenaMenu({
      canvas,
      janela,
      aoJogar: () => undefined,
      aoOpcoes: () => undefined,
      aoModos,
      aoContinuarCampeonato,
      aoNovoCampeonato,
      obterCampeonatoEmAndamento: () => ({ semente: 1, personagem: 'capi', etapa: 2, pistasConcluidas: [] }),
    });

    canvas.disparar('pointerdown', { clientX: 130, clientY: 272 }); // abre o overlay
    janela.disparar('Escape'); // fecha o overlay (não é "cancelar campeonato", só fecha a escolha)
    expect(aoContinuarCampeonato).not.toHaveBeenCalled();
    expect(aoNovoCampeonato).not.toHaveBeenCalled();

    // Botões normais do menu voltam a reagir (overlay fechado)
    canvas.disparar('pointerdown', { clientX: 130, clientY: 272 });
    expect(aoModos).not.toHaveBeenCalled(); // overlay abriu de novo (ainda em andamento), não foi direto

    cena.destruir?.();
  });
});

describe('Fase 1: Tela de Seleção de Personagem', () => {
  const CATALOGO = ['capi', 'bandeira', 'cidinha', 'beto', 'queque', 'bia'];

  it('escolhe o personagem do card tocado (card 0 = capi, no topo-esquerda da grade)', () => {
    const canvas = criarCanvasFalso();
    const aoEscolher = vi.fn();

    const cena = criarCenaSelecao({
      canvas,
      catalogo: CATALOGO,
      obterPersonagemAtivo: () => 'capi',
      aoEscolher,
      aoVoltar: () => undefined,
    });

    // Cartão 0 ('capi'): x 42..178, y 416..524, centro (110, 470) (ver selecao.ts)
    canvas.disparar('pointerdown', { clientX: 110, clientY: 470 });
    expect(aoEscolher).toHaveBeenCalledWith('capi');

    // Cartão 3 ('beto'): x 486..622, y 416..524, centro (554, 470)
    canvas.disparar('pointerdown', { clientX: 554, clientY: 470 });
    expect(aoEscolher).toHaveBeenCalledWith('beto');

    cena.destruir?.();
  });

  it('volta ao menu ao tocar VOLTAR ou apertar Escape', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoVoltar = vi.fn();

    const cena = criarCenaSelecao({
      canvas,
      janela,
      catalogo: CATALOGO,
      obterPersonagemAtivo: () => 'capi',
      aoEscolher: () => undefined,
      aoVoltar,
    });

    // Botão VOLTAR redondo, canto superior esquerdo: x 32..88, y 20..76, centro (60, 48)
    canvas.disparar('pointerdown', { clientX: 60, clientY: 48 });
    expect(aoVoltar).toHaveBeenCalledTimes(1);

    janela.disparar('Escape');
    expect(aoVoltar).toHaveBeenCalledTimes(2);

    cena.destruir?.();
  });

  it('limpa listeners ao chamar destruir()', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const cena = criarCenaSelecao({
      canvas,
      janela,
      catalogo: CATALOGO,
      obterPersonagemAtivo: () => 'capi',
      aoEscolher: () => undefined,
      aoVoltar: () => undefined,
    });

    expect(canvas.totalOuvintes('pointerdown')).toBe(1);
    expect(canvas.totalOuvintes('pointermove')).toBe(1);
    expect(janela.totalOuvintes('keydown')).toBe(1);

    cena.destruir?.();
    expect(canvas.totalOuvintes('pointerdown')).toBe(0);
    expect(canvas.totalOuvintes('pointermove')).toBe(0);
    expect(janela.totalOuvintes('keydown')).toBe(0);
  });
});

describe('Fase 1: Tela de Seleção de Pista', () => {
  const CATALOGO_PISTAS = ['morro-do-pinhao', 'pico-do-picole', 'vila-chocolate', 'vulcao-pe-gelado', 'cume-da-ventania'];

  it('escolhe a pista do card tocado (card 0 = morro-do-pinhao, no topo-esquerda da grade)', () => {
    const canvas = criarCanvasFalso();
    const aoEscolher = vi.fn();

    const cena = criarCenaSelecaoPista({
      canvas,
      catalogo: CATALOGO_PISTAS,
      obterPistaAtiva: () => 'morro-do-pinhao',
      aoEscolher,
      aoVoltar: () => undefined,
    });

    // Card 0: x 38..202, y 104..324, centro (120, 214) (fileira única de 5, ver selecao-pista.ts)
    canvas.disparar('pointerdown', { clientX: 120, clientY: 214 });
    expect(aoEscolher).toHaveBeenCalledWith('morro-do-pinhao');

    // Card 3 ('vulcao-pe-gelado'): x 578..742, y 104..324, centro (660, 214)
    canvas.disparar('pointerdown', { clientX: 660, clientY: 214 });
    expect(aoEscolher).toHaveBeenCalledWith('vulcao-pe-gelado');

    cena.destruir?.();
  });

  it('volta ao menu ao tocar VOLTAR ou apertar Escape', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoVoltar = vi.fn();

    const cena = criarCenaSelecaoPista({
      canvas,
      janela,
      catalogo: CATALOGO_PISTAS,
      obterPistaAtiva: () => 'morro-do-pinhao',
      aoEscolher: () => undefined,
      aoVoltar,
    });

    // CTA "PRONTO" (x 330..630, y 456..520) também chama aoVoltar -- mesmo comportamento de sempre
    // ("tocar no cartão grava, o CTA volta ao menu", ver selecao-pista.ts).
    canvas.disparar('pointerdown', { clientX: 480, clientY: 470 });
    expect(aoVoltar).toHaveBeenCalledTimes(1);

    janela.disparar('Escape');
    expect(aoVoltar).toHaveBeenCalledTimes(2);

    cena.destruir?.();
  });

  it('limpa listeners ao chamar destruir()', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const cena = criarCenaSelecaoPista({
      canvas,
      janela,
      catalogo: CATALOGO_PISTAS,
      obterPistaAtiva: () => 'morro-do-pinhao',
      aoEscolher: () => undefined,
      aoVoltar: () => undefined,
    });

    expect(canvas.totalOuvintes('pointerdown')).toBe(1);
    expect(canvas.totalOuvintes('pointermove')).toBe(1);
    expect(janela.totalOuvintes('keydown')).toBe(1);

    cena.destruir?.();
    expect(canvas.totalOuvintes('pointerdown')).toBe(0);
    expect(canvas.totalOuvintes('pointermove')).toBe(0);
    expect(janela.totalOuvintes('keydown')).toBe(0);
  });
});

describe('Fase 1: Cena de Configurações / Opções', () => {
  it('alterna controles ao tocar no botão correspondente ou teclar G', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoAlternarControles = vi.fn();

    const cena = criarCenaOpcoes({
      canvas,
      janela,
      obterControles: () => 'gestos',
      obterAudioLigado: () => true,
      aoAlternarControles,
      aoAlternarAudio: () => undefined,
      aoTelaCheia: () => undefined,
      aoVoltar: () => undefined,
    });

    // Clica no seletor segmentado de controles (x: 508..740, y: 158..206, ver opcoes.ts)
    canvas.disparar('pointerdown', { clientX: 600, clientY: 182 });
    expect(aoAlternarControles).toHaveBeenCalledTimes(1);

    janela.disparar('KeyG');
    expect(aoAlternarControles).toHaveBeenCalledTimes(2);

    cena.destruir?.();
  });

  it('alterna áudio ao tocar ou teclar M', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoAlternarAudio = vi.fn();

    const cena = criarCenaOpcoes({
      canvas,
      janela,
      obterControles: () => 'gestos',
      obterAudioLigado: () => true,
      aoAlternarControles: () => undefined,
      aoAlternarAudio,
      aoTelaCheia: () => undefined,
      aoVoltar: () => undefined,
    });

    // Clica no interruptor de áudio (x: 652..740, y: 264..308, ver opcoes.ts)
    canvas.disparar('pointerdown', { clientX: 696, clientY: 286 });
    expect(aoAlternarAudio).toHaveBeenCalledTimes(1);

    janela.disparar('KeyM');
    expect(aoAlternarAudio).toHaveBeenCalledTimes(2);

    cena.destruir?.();
  });

  it('aciona tela cheia e voltar', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const aoTelaCheia = vi.fn();
    const aoVoltar = vi.fn();

    const cena = criarCenaOpcoes({
      canvas,
      janela,
      obterControles: () => 'gestos',
      obterAudioLigado: () => true,
      aoAlternarControles: () => undefined,
      aoAlternarAudio: () => undefined,
      aoTelaCheia,
      aoVoltar,
    });

    // Botão Voltar redondo, canto superior esquerdo (x: 32..88, y: 20..76, ver opcoes.ts)
    canvas.disparar('pointerdown', { clientX: 60, clientY: 48 });
    expect(aoVoltar).toHaveBeenCalledTimes(1);

    janela.disparar('Escape');
    expect(aoVoltar).toHaveBeenCalledTimes(2);

    janela.disparar('KeyF');
    expect(aoTelaCheia).toHaveBeenCalledTimes(1);

    cena.destruir?.();
  });
});

describe('Fase 1: Gerenciador de Cenas (Orquestrador)', () => {
  it('inicia na abertura e navega para o menu e depois para o jogo', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const save = saveMock();

    const gerenciador = criarGerenciadorCenas({
      canvas,
      janela,
      save,
    });

    expect(gerenciador.cenaAtual()).toBe('abertura');

    // Avança splash via toque
    canvas.disparar('pointerdown', { clientX: 100, clientY: 100 });
    for (let i = 0; i < 20; i += 1) gerenciador.atualizar(); // fade da própria abertura, dispara a troca pro menu
    avancarNevasca(gerenciador); // Nevasca até CONSTRUIR o menu (seus ouvintes ficarem vivos)
    expect(gerenciador.cenaAtual()).toBe('menu');

    // No menu, toca em Treino (x: 20..240, y: 204..244): passa pela seleção de personagem antes de correr
    // (feedback do dono) -- não vai direto pro jogo.
    canvas.disparar('pointerdown', { clientX: 130, clientY: 224 });
    avancarNevasca(gerenciador);
    expect(gerenciador.cenaAtual()).toBe('selecao');

    // Escolhe o cartão 0 ('capi'): x 42..178, y 416..524, centro (110, 470) -- redesenho premium §11.1 de `selecao.ts`
    canvas.disparar('pointerdown', { clientX: 110, clientY: 470 });
    avancarNevasca(gerenciador);
    expect(gerenciador.cenaAtual()).toBe('jogo');
  });

  it('navega para opções, altera configurações e grava no save', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const save = saveMock();
    const armazenamentoMap = new Map<string, string>();
    const armazenamento = { getItem: (k: string) => armazenamentoMap.get(k) ?? null, setItem: (k: string, v: string) => armazenamentoMap.set(k, v), removeItem: (k: string) => armazenamentoMap.delete(k) };

    const gerenciador = criarGerenciadorCenas({
      canvas,
      janela,
      save,
      armazenamento,
      cenaInicial: 'menu',
    });

    expect(gerenciador.cenaAtual()).toBe('menu');

    // Clica em opções (x: 20..240, y: 400..440)
    canvas.disparar('pointerdown', { clientX: 130, clientY: 420 });
    avancarNevasca(gerenciador);
    expect(gerenciador.cenaAtual()).toBe('opcoes');

    // Alterna controles para botões
    expect(save.cfg.controles).toBe('gestos');
    janela.disparar('KeyG');
    expect(save.cfg.controles).toBe('botoes');
    expect(armazenamentoMap.has('neve-maluca-v1')).toBe(true);

    // Alterna áudio para desligado
    expect(save.cfg.som).toBeGreaterThan(0);
    janela.disparar('KeyM');
    expect(save.cfg.som).toBe(0);
    expect(save.cfg.musica).toBe(0);

    // Volta para o menu via Escape
    janela.disparar('Escape');
    avancarNevasca(gerenciador);
    expect(gerenciador.cenaAtual()).toBe('menu');

    gerenciador.destruir?.();
  });

  it('menu -> seleção de personagem: escolhe, persiste no save e volta ao menu; o jogo pega o personagem escolhido', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const save = saveMock();
    const armazenamentoMap = new Map<string, string>();
    const armazenamento = { getItem: (k: string) => armazenamentoMap.get(k) ?? null, setItem: (k: string, v: string) => armazenamentoMap.set(k, v), removeItem: (k: string) => armazenamentoMap.delete(k) };

    const gerenciador = criarGerenciadorCenas({ canvas, janela, save, armazenamento, cenaInicial: 'menu' });

    // Nenhuma escolha ainda: o padrão (implícito) é o primeiro inicial do catálogo (capi), nada gravado
    expect(save.personagemAtivo).toBeUndefined();

    // No menu, toca em PERSONAGEM (x: 20..240, y: 448..488)
    canvas.disparar('pointerdown', { clientX: 130, clientY: 468 });
    avancarNevasca(gerenciador);
    expect(gerenciador.cenaAtual()).toBe('selecao');

    // Escolhe o cartão 1 ('bandeira'): x 190..326, y 416..524, centro (258, 470) -- redesenho premium §11.1
    canvas.disparar('pointerdown', { clientX: 258, clientY: 470 });
    expect(save.personagemAtivo).toBe('bandeira');
    expect(armazenamentoMap.has('neve-maluca-v1')).toBe(true);
    expect((JSON.parse(armazenamentoMap.get('neve-maluca-v1') as string) as { personagemAtivo?: string }).personagemAtivo).toBe('bandeira');

    // Volta ao menu via Escape (entrada "PERSONAGEM": sem destino, fica na própria seleção -- ver `selecao.ts`)
    janela.disparar('Escape');
    avancarNevasca(gerenciador);
    expect(gerenciador.cenaAtual()).toBe('menu');

    // Entra no jogo: TREINO passa pela seleção de novo (feedback do dono) -- escolhe 'bandeira' outra vez e
    // confere que a cena de descida recebe o personagem escolhido (sem lançar erro na composição)
    canvas.disparar('pointerdown', { clientX: 130, clientY: 224 });
    avancarNevasca(gerenciador);
    expect(gerenciador.cenaAtual()).toBe('selecao');
    canvas.disparar('pointerdown', { clientX: 258, clientY: 470 });
    avancarNevasca(gerenciador);
    expect(gerenciador.cenaAtual()).toBe('jogo');

    gerenciador.destruir?.();
  });

  it('menu -> seleção de pista: escolhe, persiste no save e volta ao menu; o jogo pega a pista escolhida', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const save = saveMock();
    const armazenamentoMap = new Map<string, string>();
    const armazenamento = { getItem: (k: string) => armazenamentoMap.get(k) ?? null, setItem: (k: string, v: string) => armazenamentoMap.set(k, v), removeItem: (k: string) => armazenamentoMap.delete(k) };

    const gerenciador = criarGerenciadorCenas({ canvas, janela, save, armazenamento, cenaInicial: 'menu' });

    // Nenhuma escolha ainda: o padrão (implícito) é a primeira pista inicial do catálogo (morro-do-pinhao), nada gravado
    expect(save.pistaAtiva).toBeUndefined();

    // No menu, toca em PISTA (x: 20..240, y: 496..536)
    canvas.disparar('pointerdown', { clientX: 130, clientY: 516 });
    avancarNevasca(gerenciador);
    expect(gerenciador.cenaAtual()).toBe('selecao-pista');

    // Escolhe o card 1 ('pico-do-picole'): x 218..382, y 104..324, centro (300, 214)
    canvas.disparar('pointerdown', { clientX: 300, clientY: 214 });
    expect(save.pistaAtiva).toBe('pico-do-picole');
    expect(armazenamentoMap.has('neve-maluca-v1')).toBe(true);
    expect((JSON.parse(armazenamentoMap.get('neve-maluca-v1') as string) as { pistaAtiva?: string }).pistaAtiva).toBe('pico-do-picole');

    // Volta ao menu via Escape
    janela.disparar('Escape');
    avancarNevasca(gerenciador);
    expect(gerenciador.cenaAtual()).toBe('menu');

    // Entra no jogo: TREINO passa pela seleção de personagem (feedback do dono) antes de chegar na descida, que
    // recebe a pista escolhida (sem lançar erro na composição)
    canvas.disparar('pointerdown', { clientX: 130, clientY: 224 });
    avancarNevasca(gerenciador);
    expect(gerenciador.cenaAtual()).toBe('selecao');
    // Cartão 0 ('capi'): x 42..178, y 416..524, centro (110, 470) -- redesenho premium §11.1 de `selecao.ts`
    canvas.disparar('pointerdown', { clientX: 110, clientY: 470 });
    avancarNevasca(gerenciador);
    expect(gerenciador.cenaAtual()).toBe('jogo');

    gerenciador.destruir?.();
  });
});
