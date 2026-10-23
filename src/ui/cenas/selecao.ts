/**
 * Tela de Seleção de Personagem (Canvas 2D), acessível pelo botão PERSONAGEM do Menu.
 *
 * Mostra o catálogo INTEIRO (`REGRAS_SAVE.personagens`, 6 ids), não só os desbloqueados: o gating de desbloqueio
 * ainda não existe (M3-futuro), então por ora qualquer um dos 6 é escolhível para poder testar o jogo com todos.
 * Escolher um card grava na hora (mesmo padrão de `opcoes.ts`: a tela só avisa, quem grava é `gerenciador.ts`,
 * ponto único de escrita do save).
 *
 * Mesmo padrão visual/estrutural de `opcoes.ts`: painel escuro, botões com `desenho.ts`, ESC volta ao Menu.
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { caminhoArredondado, desenharBotao, desenharTexto } from '../desenho';
import { eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import type { Cena } from '../tipos';

export interface OpcoesCenaSelecao {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  /** Catálogo inteiro de ids de personagem (ordem de exibição = ordem dos cards). */
  readonly catalogo: readonly string[];
  readonly obterPersonagemAtivo: () => string;
  /** Escolheu um card: quem persiste é o chamador (gerenciador), esta tela só avisa. */
  readonly aoEscolher: (id: string) => void;
  readonly aoVoltar: () => void;
}

/** Nomes de exibição amigáveis para o elenco conhecido (direção de arte §3); id cru é o fallback para um id futuro. */
const NOMES_EXIBICAO: Readonly<Record<string, string>> = {
  capi: 'Capi',
  bandeira: 'Prof. Bandeira',
  cidinha: 'Vó Cidinha',
  beto: 'Tio Beto',
  queque: 'Quequé',
  bia: 'Bia Pipoca',
};

function nomeExibicao(id: string): string {
  return NOMES_EXIBICAO[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
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

export function criarCenaSelecao(opcoes: OpcoesCenaSelecao): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  let hover: string | null = null;

  // Sprites dos cards: melhor esforço (só `capi` tem assets reais hoje); sem o manifesto, cai no fallback silencioso.
  const sprites = new Map<string, SpritePersonagem>();
  for (const id of opcoes.catalogo) {
    void carregarSpritePersonagem(id)
      .then((s) => {
        sprites.set(id, s);
      })
      .catch(() => {
        // fallback silencioso: o card mostra a cápsula genérica
      });
  }

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
    const ativo = opcoes.obterPersonagemAtivo() === id;
    const aoVivo = hover === `card-${indice}`;

    ctx.save();
    ctx.fillStyle = ativo ? '#1d3a5c' : COR_PAINEL;
    caminhoArredondado(ctx, r, 14);
    ctx.fill();
    ctx.lineWidth = ativo ? 4 : 2;
    ctx.strokeStyle = ativo ? COR_SELECIONADO : aoVivo ? '#ffffff' : COR_BORDA;
    ctx.stroke();
    ctx.restore();

    // Retrato: sprite real (pose 'ride0' ou 'star') se já carregou, senão uma cápsula genérica
    const centroX = r.x + r.w / 2;
    const centroY = r.y + 60;
    const sprite = sprites.get(id);
    const quadro = sprite ? (sprite.obterQuadro('ride0') ?? sprite.obterQuadro('star')) : null;

    ctx.save();
    ctx.translate(centroX, centroY);
    if (quadro) {
      const d = quadro.dados;
      const escala = 90 / d.altura;
      const [ancoraX, ancoraY] = d.contato ?? d.pivo;
      ctx.drawImage(quadro.imagem, -ancoraX * escala, -ancoraY * escala, d.largura * escala, d.altura * escala);
    } else {
      ctx.fillStyle = '#8e5b23';
      ctx.beginPath();
      ctx.ellipse(0, 0, 26, 34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff9f43';
      ctx.fillRect(-32, 26, 64, 7);
    }
    ctx.restore();

    desenharTexto(ctx, nomeExibicao(id), centroX, r.y + r.h - 16, {
      fonte: '700 19px Barlow, sans-serif',
      cor: ativo ? COR_SELECIONADO : COR_TEXTO,
      alinhamento: 'center',
    });

    if (ativo) {
      desenharTexto(ctx, 'EM USO', centroX, r.y + r.h - 36, {
        fonte: '700 12px Barlow, sans-serif',
        cor: COR_SELECIONADO,
        alinhamento: 'center',
      });
    }
  }

  return {
    id: 'selecao',
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

      desenharTexto(ctx, 'ESCOLHA SEU PERSONAGEM', LARGURA / 2, PAINEL_Y + 48, {
        fonte: 'italic 800 40px "Barlow Condensed", Impact, sans-serif',
        cor: COR_TEXTO,
        contorno: 6,
        corContorno: COR_CONTORNO,
        alinhamento: 'center',
      });
      desenharTexto(ctx, 'Todos liberados por enquanto — escolha e desça a montanha', LARGURA / 2, PAINEL_Y + 74, {
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
