/**
 * Tela final do campeonato (plano `docs/plano-corrida-campeonato.md` §C-D1/C-D9, C5b/C8b): venceu (total do
 * jogador maior que TODOS os 5 rivais) ou perdeu, com a classificação final e -- se venceu -- o troféu
 * (`SaveV1.trofeus`, plano C-D9: "vencer o campeonato com cada um dá um troféu"). Fundo Pixar raster da última
 * pista corrida (`fundo-campeonato.ts`).
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { IdPersonagem, IdTema } from '../../core/contratos';
import type { ClassificacaoItem } from '../../meta/campeonato';
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { caminhoArredondado, desenharBotaoBala, desenharFlocos, desenharTexto } from '../desenho';
import { eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import type { Cena } from '../tipos';
import { criarFundoCampeonato } from './fundo-campeonato';

export interface OpcoesCenaFinalCampeonato {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly venceu: boolean;
  readonly classificacaoFinal: readonly ClassificacaoItem[];
  readonly idJogador: IdPersonagem;
  readonly nomePersonagem: string;
  readonly nomesPorId: Readonly<Record<IdPersonagem, string>>;
  readonly ganhouTrofeu: boolean;
  readonly temaFundo: IdTema;
  readonly aoMenu: () => void;
}

const COR_TEXTO = '#f4f9ff';
const COR_CONTORNO = '#0b1a33';
const COR_OURO = '#ffd166';

const PAINEL_X = LARGURA / 2 - 220;
const PAINEL_Y = 190;
const PAINEL_W = 440;
const ALTURA_LINHA = 36;

const BOTAO_MENU: BotaoRetangular = { id: 'menu', x: LARGURA / 2 - 110, y: ALTURA - 76, w: 220, h: 50 };

export function criarCenaFinalCampeonato(opcoes: OpcoesCenaFinalCampeonato): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  const fundo = criarFundoCampeonato(opcoes.temaFundo, doc);

  let sprite: SpritePersonagem | null = null;
  void carregarSpritePersonagem(opcoes.idJogador)
    .then((s) => {
      sprite = s;
    })
    .catch(() => {
      // fallback silencioso
    });

  let hover = false;
  let ticks = 0;

  const aoMenu = (): void => opcoes.aoMenu();

  const aoMover = (e: Event): void => {
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    hover = pontoDentroDoBotao(pt, BOTAO_MENU);
  };
  const aoTocar = (e: Event): void => {
    e.preventDefault?.();
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_MENU)) aoMenu();
  };
  const aoTeclar = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.code === 'Space' || ev.code === 'Enter' || ev.code === 'Escape') aoMenu();
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  janela?.addEventListener('keydown', aoTeclar);

  return {
    id: 'campeonato-final',
    atualizar() {
      ticks += 1;
    },
    desenhar(ctx: Ctx, alpha: number) {
      const t = ticks + alpha;
      fundo.desenhar(ctx, 0, t);
      ctx.save();
      ctx.fillStyle = opcoes.venceu ? 'rgba(8, 18, 36, 0.3)' : 'rgba(8, 10, 16, 0.55)';
      ctx.fillRect(0, 0, LARGURA, ALTURA);
      ctx.restore();

      if (opcoes.venceu) desenharFlocos(ctx, 36, t);

      const titulo = opcoes.venceu ? 'CAMPEÃO DA MONTANHA!' : 'NÃO FOI DESSA VEZ...';
      ctx.save();
      ctx.font = 'italic 900 48px "Barlow Condensed", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 10;
      ctx.strokeStyle = COR_CONTORNO;
      ctx.strokeText(titulo, LARGURA / 2, 80);
      ctx.fillStyle = opcoes.venceu ? COR_OURO : COR_TEXTO;
      ctx.fillText(titulo, LARGURA / 2, 80);
      ctx.restore();

      desenharTexto(
        ctx,
        opcoes.venceu
          ? opcoes.ganhouTrofeu
            ? `${opcoes.nomePersonagem} ganhou o troféu!`
            : `${opcoes.nomePersonagem} venceu as 5 pistas!`
          : `${opcoes.nomePersonagem} não teve mais pontos que todos os rivais. Tenta de novo!`,
        LARGURA / 2,
        112,
        { fonte: '600 17px Barlow, sans-serif', cor: COR_TEXTO, contorno: 4, alinhamento: 'center' },
      );

      // Retrato do personagem.
      const quadro = sprite ? (sprite.obterQuadro(opcoes.venceu ? 'celeb' : 'fall') ?? sprite.obterQuadro('ride0')) : null;
      ctx.save();
      ctx.translate(LARGURA / 2 - PAINEL_W / 2 - 90, PAINEL_Y + 90);
      if (quadro) {
        const d = quadro.dados;
        const escala = 190 / d.altura;
        const [ancoraX, ancoraY] = d.contato ?? d.pivo;
        ctx.drawImage(quadro.imagem, -ancoraX * escala, -ancoraY * escala, d.largura * escala, d.altura * escala);
      } else {
        ctx.fillStyle = '#8e5b23';
        ctx.beginPath();
        ctx.ellipse(0, 0, 36, 48, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.fillStyle = 'rgba(12, 27, 48, 0.78)';
      caminhoArredondado(ctx, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: opcoes.classificacaoFinal.length * ALTURA_LINHA + 20 }, 16);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#2a517f';
      ctx.stroke();
      ctx.restore();

      opcoes.classificacaoFinal.forEach((item, indice) => {
        const posicao = indice + 1;
        const y = PAINEL_Y + 28 + indice * ALTURA_LINHA;
        const ehJogador = item.id === opcoes.idJogador;
        const nome = opcoes.nomesPorId[item.id] ?? item.id;
        desenharTexto(ctx, `${posicao}º`, PAINEL_X + 24, y, {
          fonte: '800 17px Barlow, sans-serif',
          cor: ehJogador ? COR_OURO : COR_TEXTO,
          base: 'middle',
        });
        desenharTexto(ctx, `${nome}${ehJogador ? ' (você)' : ''}`, PAINEL_X + 52, y, {
          fonte: ehJogador ? '700 17px Barlow, sans-serif' : '600 16px Barlow, sans-serif',
          cor: ehJogador ? COR_OURO : COR_TEXTO,
          base: 'middle',
        });
        desenharTexto(ctx, `${item.pontos} pts`, PAINEL_X + PAINEL_W - 20, y, {
          fonte: '700 16px Barlow, sans-serif',
          cor: COR_TEXTO,
          alinhamento: 'right',
          base: 'middle',
        });
      });

      desenharBotaoBala(ctx, {
        ...BOTAO_MENU,
        texto: 'MENU',
        destaque: true,
        corTopo: hover ? '#4da2ff' : '#2a7de1',
        corBase: hover ? '#1f6fd0' : '#144d8f',
        aoVivo: hover,
      });
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
