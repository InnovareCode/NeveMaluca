/**
 * Abertura do campeonato completo (plano `docs/plano-corrida-campeonato.md` §C5b/C8b): mostra o personagem, as 5
 * pistas em ordem (com o que já foi corrido, se o jogador está RETOMANDO um campeonato em andamento) e o botão
 * pra começar/continuar. Fundo Pixar raster (`fundo-campeonato.ts`), mesmo padrão visual de `ui/cenas/menu.ts`
 * (retrato real do personagem via sprite, nunca um cenário vetorial "do nada").
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { IdTema } from '../../core/contratos';
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { caminhoArredondado, desenharBotaoBala, desenharFlocos, desenharTexto } from '../desenho';
import { eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import type { Cena } from '../tipos';
import { criarFundoCampeonato } from './fundo-campeonato';

export interface PistaDoCampeonato {
  readonly id: string;
  readonly nome: string;
  readonly tema: IdTema;
}

export interface OpcoesCenaAberturaCampeonato {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly personagem: string;
  readonly nomePersonagem: string;
  /** As 5 pistas, na ordem em que serão corridas. */
  readonly pistas: readonly PistaDoCampeonato[];
  /** Quantas já foram concluídas nesta rodada (0 = campeonato novo); `> 0` = está RETOMANDO. */
  readonly etapaAtual: number;
  readonly aoComecar: () => void;
  readonly aoVoltar: () => void;
}

const COR_TEXTO = '#f4f9ff';
const COR_CONTORNO = '#0b1a33';
const COR_DESTAQUE = '#ffd166';

const PAINEL_X = 36;
const PAINEL_Y = 150;
const PAINEL_W = 330;
const PAINEL_H = 300;

const BOTAO_COMECAR: BotaoRetangular = { id: 'comecar', x: LARGURA / 2 - 130, y: ALTURA - 96, w: 260, h: 58 };
const BOTAO_VOLTAR: BotaoRetangular = { id: 'voltar', x: 20, y: 20, w: 120, h: 40 };

export function criarCenaAberturaCampeonato(opcoes: OpcoesCenaAberturaCampeonato): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  const retomando = opcoes.etapaAtual > 0;
  const temaFundo = opcoes.pistas[Math.min(opcoes.etapaAtual, opcoes.pistas.length - 1)]?.tema ?? 'bosque';
  const fundo = criarFundoCampeonato(temaFundo, doc);

  let hover: string | null = null;
  let sprite: SpritePersonagem | null = null;
  void carregarSpritePersonagem(opcoes.personagem)
    .then((s) => {
      sprite = s;
    })
    .catch(() => {
      // fallback silencioso: cápsula genérica enquanto não carrega
    });

  const aoMover = (e: Event): void => {
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_COMECAR)) hover = 'comecar';
    else if (pontoDentroDoBotao(pt, BOTAO_VOLTAR)) hover = 'voltar';
    else hover = null;
  };

  const aoTocar = (e: Event): void => {
    e.preventDefault?.();
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_COMECAR)) opcoes.aoComecar();
    else if (pontoDentroDoBotao(pt, BOTAO_VOLTAR)) opcoes.aoVoltar();
  };

  const aoTeclar = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.code === 'Space' || ev.code === 'Enter') opcoes.aoComecar();
    else if (ev.code === 'Escape' || ev.code === 'Backspace') opcoes.aoVoltar();
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  janela?.addEventListener('keydown', aoTeclar);

  let ticks = 0;

  return {
    id: 'campeonato-abertura',
    atualizar() {
      ticks += 1;
    },
    desenhar(ctx: Ctx, alpha: number) {
      const t = ticks + alpha;
      fundo.desenhar(ctx, 0, t);

      // Véu escuro pra legibilidade do texto, sem apagar o cenário Pixar atrás.
      ctx.save();
      ctx.fillStyle = 'rgba(8, 18, 36, 0.32)';
      ctx.fillRect(0, 0, LARGURA, ALTURA);
      ctx.restore();

      desenharFlocos(ctx, 24, t);

      ctx.save();
      ctx.font = 'italic 900 52px "Barlow Condensed", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 10;
      ctx.strokeStyle = COR_CONTORNO;
      ctx.strokeText('CAMPEONATO DA MONTANHA', LARGURA / 2, 78);
      ctx.fillStyle = COR_DESTAQUE;
      ctx.fillText('CAMPEONATO DA MONTANHA', LARGURA / 2, 78);
      ctx.restore();

      desenharTexto(ctx, retomando ? 'Retomando sua corrida pelas 5 pistas' : '5 pistas. Pontos de 1º a 6º. Vença de todos pra levar o troféu.', LARGURA / 2, 108, {
        fonte: '600 17px Barlow, sans-serif',
        cor: COR_TEXTO,
        contorno: 4,
        alinhamento: 'center',
      });

      // Painel das 5 pistas.
      ctx.save();
      ctx.fillStyle = 'rgba(12, 27, 48, 0.72)';
      caminhoArredondado(ctx, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: PAINEL_H }, 16);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#2a517f';
      ctx.stroke();
      ctx.restore();

      opcoes.pistas.forEach((pista, indice) => {
        const y = PAINEL_Y + 44 + indice * 48;
        const concluida = indice < opcoes.etapaAtual;
        const proxima = indice === opcoes.etapaAtual;
        const marcador = concluida ? '✓' : proxima ? '▶' : `${indice + 1}`;
        const cor = concluida ? '#8fd99f' : proxima ? COR_DESTAQUE : COR_TEXTO;
        desenharTexto(ctx, marcador, PAINEL_X + 28, y, { fonte: '800 20px Barlow, sans-serif', cor, alinhamento: 'center', base: 'middle' });
        desenharTexto(ctx, pista.nome, PAINEL_X + 56, y, {
          fonte: proxima ? '700 19px Barlow, sans-serif' : '600 18px Barlow, sans-serif',
          cor,
          base: 'middle',
        });
      });

      // Retrato do personagem (lado direito), mesma técnica de `ui/cenas/selecao.ts`.
      const quadro = sprite ? (sprite.obterQuadro('star') ?? sprite.obterQuadro('ride0')) : null;
      const centroX = 720;
      const centroY = 340;
      ctx.save();
      ctx.translate(centroX, centroY);
      if (quadro) {
        const d = quadro.dados;
        const escala = 230 / d.altura;
        const [ancoraX, ancoraY] = d.contato ?? d.pivo;
        ctx.drawImage(quadro.imagem, -ancoraX * escala, -ancoraY * escala, d.largura * escala, d.altura * escala);
      } else {
        ctx.fillStyle = '#8e5b23';
        ctx.beginPath();
        ctx.ellipse(0, 0, 44, 58, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      desenharTexto(ctx, opcoes.nomePersonagem, centroX, centroY + 130, {
        fonte: 'italic 700 24px "Barlow Condensed", Impact, sans-serif',
        cor: COR_TEXTO,
        contorno: 5,
        alinhamento: 'center',
      });

      desenharBotaoBala(ctx, {
        ...BOTAO_COMECAR,
        texto: retomando ? 'CONTINUAR' : 'COMEÇAR',
        destaque: true,
        corTopo: hover === 'comecar' ? '#ffe066' : '#f6c90e',
        corBase: hover === 'comecar' ? '#f39c12' : '#d35400',
        aoVivo: hover === 'comecar',
      });
      desenharBotaoBala(ctx, {
        ...BOTAO_VOLTAR,
        texto: 'VOLTAR',
        corTopo: hover === 'voltar' ? '#e85d4a' : '#c0392b',
        corBase: hover === 'voltar' ? '#b03a26' : '#7d241a',
        aoVivo: hover === 'voltar',
      });
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
