/**
 * Tela de Seleção de Pista (Canvas 2D), acessível pelo botão PISTA do Menu. Mesmo molde de `selecao.ts`
 * (seleção de PERSONAGEM): painel escuro, grade de cartões, ESC/VOLTAR, escolher grava na hora (a tela só avisa,
 * quem grava é `gerenciador.ts`, ponto único de escrita do save).
 *
 * Mostra o catálogo INTEIRO (as 5 pistas de `REGRAS_SAVE.pistas`), não só `prog.pistas`: o gating de desbloqueio
 * por objetivos ainda não existe (M3-futuro, mesmo estado que a seleção de personagem — ver
 * `selecao-personagem-catalogo-inteiro-vs-desbloqueados` na memória), então toda pista é escolhível desde já para
 * poder testar o recurso. Cada cartão mostra nome amigável (`DefPista.nome`) + um swatch do tema (`DefTema.cores`,
 * via `render/temas/catalogo.ts`: mesmo mapa que `ui/cenas/descida.ts` usa para pintar a pista de verdade, não
 * duplica a escolha de cor aqui).
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import { obterPistaDeDados, PISTAS_DE_DADOS } from '../../data/pistas';
import { temaDeRenderDoTema } from '../../render/temas/catalogo';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { caminhoArredondado, desenharBotao, desenharTexto } from '../desenho';
import { eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import type { Cena } from '../tipos';

export interface OpcoesCenaSelecaoPista {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  /** Catálogo inteiro de ids de pista (ordem de exibição = ordem dos cards). */
  readonly catalogo: readonly string[];
  readonly obterPistaAtiva: () => string;
  /** Escolheu um card: quem persiste é o chamador (gerenciador), esta tela só avisa. */
  readonly aoEscolher: (id: string) => void;
  readonly aoVoltar: () => void;
}

const COR_FUNDO = '#0c1b30';
const COR_PAINEL = '#162b47';
const COR_BORDA = '#2a517f';
const COR_TEXTO = '#f4f9ff';
const COR_CONTORNO = '#0b1a33';
const COR_SELECIONADO = '#f6c90e';

const PAINEL_X = 40;
const PAINEL_Y = 28;
const PAINEL_W = 880;
const PAINEL_H = 484;

const COLUNAS = 3;
const GRID_X = 70;
const GRID_Y = 112;
const CARD_W = 260;
const CARD_H = 150;
const GAP_X = 20;
const GAP_Y = 16;

const BOTAO_VOLTAR: BotaoRetangular = { id: 'voltar', x: LARGURA / 2 - 100, y: 452, w: 200, h: 46 };

function cartao(indice: number): BotaoRetangular {
  const coluna = indice % COLUNAS;
  const linha = Math.floor(indice / COLUNAS);
  return {
    id: `card-${indice}`,
    x: GRID_X + coluna * (CARD_W + GAP_X),
    y: GRID_Y + linha * (CARD_H + GAP_Y),
    w: CARD_W,
    h: CARD_H,
  };
}

export function criarCenaSelecaoPista(opcoes: OpcoesCenaSelecaoPista): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  let hover: string | null = null;

  const cartaoNoPonto = (pt: { x: number; y: number }): number | null => {
    for (let i = 0; i < opcoes.catalogo.length; i += 1) {
      if (pontoDentroDoBotao(pt, cartao(i))) return i;
    }
    return null;
  };

  const aoMover = (e: Event): void => {
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    const indice = cartaoNoPonto(pt);
    if (indice !== null) hover = `card-${indice}`;
    else if (pontoDentroDoBotao(pt, BOTAO_VOLTAR)) hover = 'voltar';
    else hover = null;
  };

  const aoTocar = (e: Event): void => {
    e.preventDefault?.();
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    const indice = cartaoNoPonto(pt);
    if (indice !== null) {
      opcoes.aoEscolher(opcoes.catalogo[indice] as string);
    } else if (pontoDentroDoBotao(pt, BOTAO_VOLTAR)) {
      opcoes.aoVoltar();
    }
  };

  const aoTeclar = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.code === 'Escape' || ev.code === 'Backspace') {
      ev.preventDefault?.();
      opcoes.aoVoltar();
    }
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  janela?.addEventListener('keydown', aoTeclar);

  function desenharCartao(ctx: Ctx, indice: number, id: string): void {
    const r = cartao(indice);
    const ativo = opcoes.obterPistaAtiva() === id;
    const aoVivo = hover === `card-${indice}`;
    const def = obterPistaDeDados(id, PISTAS_DE_DADOS);
    const nome = def?.nome ?? id;
    const tema = temaDeRenderDoTema(def?.tema ?? 'bosque');

    ctx.save();
    ctx.fillStyle = ativo ? '#1d3a5c' : COR_PAINEL;
    caminhoArredondado(ctx, r, 14);
    ctx.fill();
    ctx.lineWidth = ativo ? 4 : 2;
    ctx.strokeStyle = ativo ? COR_SELECIONADO : aoVivo ? '#ffffff' : COR_BORDA;
    ctx.stroke();
    ctx.restore();

    // Swatch do tema: miniatura do céu (gradiente de `DefTema.cores.ceu`) + um chip da cor de destaque,
    // mesmas cores que `ui/cenas/descida.ts` usa para pintar a pista de verdade.
    const swatchX = r.x + 14;
    const swatchY = r.y + 14;
    const swatchW = r.w - 28;
    const swatchH = 72;

    ctx.save();
    const grad = ctx.createLinearGradient(swatchX, swatchY, swatchX, swatchY + swatchH);
    grad.addColorStop(0, tema.cores.ceu[0]);
    grad.addColorStop(1, tema.cores.ceu[1]);
    ctx.fillStyle = grad;
    caminhoArredondado(ctx, { x: swatchX, y: swatchY, w: swatchW, h: swatchH }, 10);
    ctx.fill();

    ctx.fillStyle = tema.cores.silhueta;
    ctx.beginPath();
    ctx.moveTo(swatchX, swatchY + swatchH);
    ctx.lineTo(swatchX, swatchY + swatchH * 0.55);
    ctx.lineTo(swatchX + swatchW * 0.4, swatchY + swatchH * 0.3);
    ctx.lineTo(swatchX + swatchW * 0.7, swatchY + swatchH * 0.6);
    ctx.lineTo(swatchX + swatchW, swatchY + swatchH * 0.4);
    ctx.lineTo(swatchX + swatchW, swatchY + swatchH);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = tema.cores.destaque;
    ctx.beginPath();
    ctx.ellipse(swatchX + swatchW - 14, swatchY + 14, 8, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const centroX = r.x + r.w / 2;
    desenharTexto(ctx, nome, centroX, r.y + r.h - 16, {
      fonte: '700 19px Barlow, sans-serif',
      cor: ativo ? COR_SELECIONADO : COR_TEXTO,
      alinhamento: 'center',
    });

    if (ativo) {
      desenharTexto(ctx, 'PISTA ATUAL', centroX, r.y + r.h - 36, {
        fonte: '700 12px Barlow, sans-serif',
        cor: COR_SELECIONADO,
        alinhamento: 'center',
      });
    }
  }

  return {
    id: 'selecao-pista',
    atualizar() {
      // nada a avançar: a tela é controlada pelos eventos
    },
    desenhar(ctx: Ctx) {
      ctx.save();
      ctx.fillStyle = COR_FUNDO;
      ctx.fillRect(0, 0, LARGURA, ALTURA);

      ctx.fillStyle = COR_PAINEL;
      caminhoArredondado(ctx, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: PAINEL_H }, 18);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = COR_BORDA;
      ctx.stroke();

      desenharTexto(ctx, 'ESCOLHA SUA PISTA', LARGURA / 2, PAINEL_Y + 48, {
        fonte: 'italic 800 40px "Barlow Condensed", Impact, sans-serif',
        cor: COR_TEXTO,
        contorno: 6,
        corContorno: COR_CONTORNO,
        alinhamento: 'center',
      });
      desenharTexto(ctx, 'Todas liberadas por enquanto — escolha e desça a montanha', LARGURA / 2, PAINEL_Y + 74, {
        fonte: '600 16px Barlow, sans-serif',
        cor: '#8fb6e0',
        alinhamento: 'center',
      });
      ctx.restore();

      opcoes.catalogo.forEach((id, indice) => desenharCartao(ctx, indice, id));

      desenharBotao(ctx, {
        ...BOTAO_VOLTAR,
        texto: 'VOLTAR',
        corTopo: hover === 'voltar' ? '#e85d4a' : '#c0392b',
        corBase: hover === 'voltar' ? '#b03a26' : '#7d241a',
        aoVivo: hover === 'voltar',
      });
      desenharTexto(ctx, 'ESC volta ao menu', LARGURA / 2, BOTAO_VOLTAR.y + BOTAO_VOLTAR.h + 18, {
        fonte: '500 14px Barlow, sans-serif',
        cor: '#8fb6e0',
        alinhamento: 'center',
      });
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
