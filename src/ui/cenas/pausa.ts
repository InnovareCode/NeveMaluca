/**
 * Overlay de pausa (feedback do dono, playtest iPhone: "durante a partida não dá pra pausar, voltar ao menu,
 * abrir configuração nem reiniciar"). Compartilhado por `ui/cenas/jogo.ts` (Treino) e `ui/cenas/campeonato.ts`
 * (Corrida): os dois compõem a descida/corrida real por baixo (congelada, nunca destruída) com este painel por
 * cima, mesma receita de `opcoes.ts`/`selecao.ts` (painel escuro, `desenho.ts`, ESC volta).
 *
 * Congelar o motor (o compositor para de chamar `atualizar()`) não basta pra isolar o INPUT: o toque/teclado da
 * descida/corrida por baixo continua com os PRÓPRIOS ouvintes vivos no mesmo `canvas`/`janela` (nunca destruído,
 * só congelado -- CONTINUAR precisa voltar exatamente de onde parou). Sem bloquear, o MESMO toque que fecha a
 * pausa tocando em CONTINUAR também seria lido como um pulo pelo toque de baixo, e disparar no próximo tick real
 * (mesmo risco pro Escape/P: fechar a pausa sem travar reabriria na hora, lido de novo pelo teclado de baixo).
 * Por isso, sempre que este controlador está ATIVO (pausado e não suspenso) ele chama
 * `stopImmediatePropagation()` em TODO toque/tecla antes de devolver o controle -- não só `stopPropagation()`,
 * que pararia a subida pro `document`/`window` mas NÃO impede outro ouvinte já registrado no MESMO `canvas`/
 * `janela` (caso daqui: `input/toque.ts`/`teclado.ts` da cena de baixo). Esta ordem só funciona porque o
 * controlador é criado (e seus ouvintes registrados) ANTES da descida/corrida em `jogo.ts`/`campeonato.ts` --
 * ouvintes do MESMO nó disparam na ordem de registro, então o de pausa sempre roda primeiro.
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { caminhoArredondado, desenharBotao, desenharTexto } from '../desenho';
import { eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';

const COR_VEU = 'rgba(5, 12, 26, 0.72)';
const COR_PAINEL = '#162b47';
const COR_BORDA = '#2a517f';
const COR_TEXTO = '#f4f9ff';
const COR_CONTORNO = '#0b1a33';
const COR_DESATIVADO_TOPO = '#55606a';
const COR_DESATIVADO_BASE = '#2c343b';

const PAINEL_W = 420;
const PAINEL_H = 380;
const PAINEL_X = LARGURA / 2 - PAINEL_W / 2;
const PAINEL_Y = ALTURA / 2 - PAINEL_H / 2;

const BOTAO_W = 320;
const BOTAO_H = 52;
const BOTAO_X = LARGURA / 2 - BOTAO_W / 2;
const PASSO_Y = BOTAO_H + 16;
const PRIMEIRA_Y = PAINEL_Y + 100;

export const BOTAO_CONTINUAR: BotaoRetangular = { id: 'continuar', x: BOTAO_X, y: PRIMEIRA_Y, w: BOTAO_W, h: BOTAO_H };
export const BOTAO_REINICIAR: BotaoRetangular = { id: 'reiniciar', x: BOTAO_X, y: PRIMEIRA_Y + PASSO_Y, w: BOTAO_W, h: BOTAO_H };
export const BOTAO_CONFIGURACOES: BotaoRetangular = { id: 'configuracoes', x: BOTAO_X, y: PRIMEIRA_Y + 2 * PASSO_Y, w: BOTAO_W, h: BOTAO_H };
export const BOTAO_VOLTAR_MENU: BotaoRetangular = { id: 'voltar-menu', x: BOTAO_X, y: PRIMEIRA_Y + 3 * PASSO_Y, w: BOTAO_W, h: BOTAO_H };

export const BOTAO_CONFIRMAR_SAIDA: BotaoRetangular = { id: 'confirmar-saida', x: LARGURA / 2 - 170, y: PRIMEIRA_Y + PASSO_Y + 10, w: 150, h: 52 };
export const BOTAO_CANCELAR_SAIDA: BotaoRetangular = { id: 'cancelar-saida', x: LARGURA / 2 + 20, y: PRIMEIRA_Y + PASSO_Y + 10, w: 150, h: 52 };

export type AlvoHoverPausa = 'continuar' | 'reiniciar' | 'configuracoes' | 'voltar-menu' | 'confirmar-saida' | 'cancelar-saida' | null;

export interface EstadoVisualPausa {
  readonly confirmandoSaida: boolean;
  readonly podeReiniciar: boolean;
  readonly hover: AlvoHoverPausa;
}

/** Acha qual botão (se algum) está sob o ponto, de acordo com a sub-tela atual (normal ou confirmação de saída). */
export function botaoPausaEm(pt: { x: number; y: number }, confirmandoSaida: boolean): AlvoHoverPausa {
  if (confirmandoSaida) {
    if (pontoDentroDoBotao(pt, BOTAO_CONFIRMAR_SAIDA)) return 'confirmar-saida';
    if (pontoDentroDoBotao(pt, BOTAO_CANCELAR_SAIDA)) return 'cancelar-saida';
    return null;
  }
  if (pontoDentroDoBotao(pt, BOTAO_CONTINUAR)) return 'continuar';
  if (pontoDentroDoBotao(pt, BOTAO_REINICIAR)) return 'reiniciar';
  if (pontoDentroDoBotao(pt, BOTAO_CONFIGURACOES)) return 'configuracoes';
  if (pontoDentroDoBotao(pt, BOTAO_VOLTAR_MENU)) return 'voltar-menu';
  return null;
}

/** Painel de pausa, estilo visual já estabelecido do jogo (mesma paleta/tipografia de `opcoes.ts`/`selecao.ts`). */
export function desenharPainelPausa(ctx: Ctx, estado: EstadoVisualPausa): void {
  ctx.save();
  ctx.fillStyle = COR_VEU;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  ctx.fillStyle = COR_PAINEL;
  caminhoArredondado(ctx, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: PAINEL_H }, 18);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COR_BORDA;
  ctx.stroke();

  desenharTexto(ctx, 'PAUSADO', LARGURA / 2, PAINEL_Y + 56, {
    fonte: 'italic 800 40px "Barlow Condensed", Impact, sans-serif',
    cor: COR_TEXTO,
    contorno: 6,
    corContorno: COR_CONTORNO,
    alinhamento: 'center',
  });
  ctx.restore();

  if (estado.confirmandoSaida) {
    desenharTexto(ctx, 'Sair da corrida e voltar ao menu?', LARGURA / 2, PRIMEIRA_Y + 4, {
      fonte: '700 19px Barlow, sans-serif',
      cor: COR_TEXTO,
      alinhamento: 'center',
    });
    desenharTexto(ctx, 'O progresso desta pista não é salvo.', LARGURA / 2, PRIMEIRA_Y + 30, {
      fonte: '500 15px Barlow, sans-serif',
      cor: '#8fb6e0',
      alinhamento: 'center',
    });
    desenharBotao(ctx, {
      ...BOTAO_CONFIRMAR_SAIDA,
      texto: 'SIM, SAIR',
      corTopo: estado.hover === 'confirmar-saida' ? '#e85d4a' : '#c0392b',
      corBase: estado.hover === 'confirmar-saida' ? '#b03a26' : '#7d241a',
      aoVivo: estado.hover === 'confirmar-saida',
    });
    desenharBotao(ctx, {
      ...BOTAO_CANCELAR_SAIDA,
      texto: 'CANCELAR',
      corTopo: estado.hover === 'cancelar-saida' ? '#4da2ff' : '#2a7de1',
      corBase: estado.hover === 'cancelar-saida' ? '#1f6fd0' : '#144d8f',
      aoVivo: estado.hover === 'cancelar-saida',
    });
    return;
  }

  desenharBotao(ctx, {
    ...BOTAO_CONTINUAR,
    texto: 'CONTINUAR',
    corTopo: estado.hover === 'continuar' ? '#4ad17d' : '#31c66d',
    corBase: estado.hover === 'continuar' ? '#239254' : '#1d7f45',
    aoVivo: estado.hover === 'continuar',
    destaque: true,
  });

  desenharBotao(ctx, {
    ...BOTAO_REINICIAR,
    texto: 'REINICIAR CORRIDA',
    corTopo: !estado.podeReiniciar ? COR_DESATIVADO_TOPO : estado.hover === 'reiniciar' ? '#4da2ff' : '#2a7de1',
    corBase: !estado.podeReiniciar ? COR_DESATIVADO_BASE : estado.hover === 'reiniciar' ? '#1f6fd0' : '#144d8f',
    aoVivo: estado.podeReiniciar && estado.hover === 'reiniciar',
  });
  if (!estado.podeReiniciar) {
    desenharTexto(ctx, 'só antes de cruzar a chegada', LARGURA / 2, BOTAO_REINICIAR.y + BOTAO_REINICIAR.h + 14, {
      fonte: '500 13px Barlow, sans-serif',
      cor: '#8fb6e0',
      alinhamento: 'center',
    });
  }

  desenharBotao(ctx, {
    ...BOTAO_CONFIGURACOES,
    texto: 'CONFIGURAÇÕES',
    corTopo: estado.hover === 'configuracoes' ? '#4da2ff' : '#2a7de1',
    corBase: estado.hover === 'configuracoes' ? '#1f6fd0' : '#144d8f',
    aoVivo: estado.hover === 'configuracoes',
  });

  desenharBotao(ctx, {
    ...BOTAO_VOLTAR_MENU,
    texto: 'VOLTAR AO MENU',
    corTopo: estado.hover === 'voltar-menu' ? '#e85d4a' : '#c0392b',
    corBase: estado.hover === 'voltar-menu' ? '#b03a26' : '#7d241a',
    aoVivo: estado.hover === 'voltar-menu',
  });

  desenharTexto(ctx, 'ESC/P continua', LARGURA / 2, PAINEL_Y + PAINEL_H - 14, {
    fonte: '500 13px Barlow, sans-serif',
    cor: '#8fb6e0',
    alinhamento: 'center',
  });
}

export interface OpcoesControladorPausa {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  /** Lido a cada clique/tecla (nunca cacheado): reflete "já cruzou a chegada" na hora (plano C-D6). */
  readonly podeReiniciar: () => boolean;
  readonly aoContinuar: () => void;
  readonly aoReiniciar: () => void;
  readonly aoAbrirConfiguracoes: () => void;
  /** Confirmou "sim, sair" no sub-painel: quem decide o que "sair" significa é o chamador (jogo.ts/campeonato.ts). */
  readonly aoConfirmarSaidaAoMenu: () => void;
}

export interface ControladorPausa {
  readonly pausado: boolean;
  abrir(): void;
  continuar(): void;
  /** Suspende a reação a toque/tecla SEM fechar a pausa (usado enquanto a tela de Configurações, que tem os
   *  próprios ouvintes, está por cima) — `desenhar` também não pinta o painel nesse meio tempo. */
  suspender(): void;
  retomar(): void;
  desenhar(ctx: Ctx): void;
  destruir(): void;
}

/** Controlador da pausa: estado (pausado/confirmando-saída/suspenso) + ouvintes de toque/tecla + desenho. */
export function criarControladorPausa(opcoes: OpcoesControladorPausa): ControladorPausa {
  const janela = opcoes.janela;
  let pausado = false;
  let confirmandoSaida = false;
  let suspenso = false;
  let hover: AlvoHoverPausa = null;

  const ativo = (): boolean => pausado && !suspenso;

  const aoTocar = (ev: Event): void => {
    if (!ativo()) return;
    const e = ev as PointerEvent;
    e.preventDefault?.();
    // Essencial (ver cabeçalho do arquivo): sem isto, o MESMO toque que fecha a pausa também vira pulo no toque
    // congelado de baixo, que só seria lido no tick real seguinte -- jogador "pula" ao tocar CONTINUAR.
    e.stopImmediatePropagation?.();
    const pt = eventoParaPontoLogico(e, opcoes.canvas);
    const alvo = botaoPausaEm(pt, confirmandoSaida);
    if (confirmandoSaida) {
      if (alvo === 'confirmar-saida') {
        pausado = false;
        confirmandoSaida = false;
        opcoes.aoConfirmarSaidaAoMenu();
      } else if (alvo === 'cancelar-saida') {
        confirmandoSaida = false;
      }
      return;
    }
    if (alvo === 'continuar') {
      pausado = false;
      opcoes.aoContinuar();
    } else if (alvo === 'reiniciar') {
      if (!opcoes.podeReiniciar()) return;
      pausado = false;
      opcoes.aoReiniciar();
    } else if (alvo === 'configuracoes') {
      opcoes.aoAbrirConfiguracoes();
    } else if (alvo === 'voltar-menu') {
      confirmandoSaida = true;
    }
  };

  const aoMover = (ev: Event): void => {
    if (!ativo()) {
      hover = null;
      return;
    }
    (ev as PointerEvent).stopImmediatePropagation?.();
    const pt = eventoParaPontoLogico(ev as PointerEvent, opcoes.canvas);
    hover = botaoPausaEm(pt, confirmandoSaida);
  };

  const aoTeclar = (ev: Event): void => {
    if (!ativo()) return;
    const e = ev as KeyboardEvent;
    // Essencial (ver cabeçalho): sem isto, Escape/P pra FECHAR a pausa também seria lido pelo teclado de baixo
    // (que chamaria `aoPausar` de novo e reabriria na hora).
    e.stopImmediatePropagation?.();
    if (confirmandoSaida) {
      if (e.code === 'Escape') confirmandoSaida = false;
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Enter') {
      pausado = false;
      opcoes.aoContinuar();
    }
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  janela?.addEventListener('keydown', aoTeclar);

  return {
    get pausado() {
      return pausado;
    },
    abrir() {
      pausado = true;
      confirmandoSaida = false;
    },
    continuar() {
      pausado = false;
      confirmandoSaida = false;
    },
    suspender() {
      suspenso = true;
    },
    retomar() {
      suspenso = false;
    },
    desenhar(ctx) {
      if (!ativo()) return;
      desenharPainelPausa(ctx, { confirmandoSaida, podeReiniciar: opcoes.podeReiniciar(), hover });
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
