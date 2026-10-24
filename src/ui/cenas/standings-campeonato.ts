/**
 * Classificação entre pistas do campeonato (plano `docs/plano-corrida-campeonato.md` §C5b/C8b, C-D1): soma de
 * pontos 10/8/6/4/2/1 de cada pista já corrida (`meta/campeonato.ts` → `classificacao`, nunca recalculado aqui),
 * jogador destacado. Fundo Pixar raster (`fundo-campeonato.ts`) com a PRÓXIMA pista (ou a última, se o campeonato
 * acabou) -- dá o gancho visual pro que vem a seguir.
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { IdPersonagem, IdTema } from '../../core/contratos';
import type { ClassificacaoItem } from '../../meta/campeonato';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { caminhoArredondado, desenharBotaoBala, desenharTexto } from '../desenho';
import { eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import type { Cena } from '../tipos';
import { criarFundoCampeonato } from './fundo-campeonato';

export interface OpcoesCenaStandings {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly classificacao: readonly ClassificacaoItem[];
  readonly nomesPorId: Readonly<Record<IdPersonagem, string>>;
  readonly idJogador: IdPersonagem;
  readonly pistaConcluidaNome: string;
  /** `undefined` = essa era a última pista (o campeonato já decidiu quem venceu). */
  readonly proximaPistaNome?: string | undefined;
  readonly temaFundo: IdTema;
  readonly aoContinuar: () => void;
}

const COR_TEXTO = '#f4f9ff';
const COR_CONTORNO = '#0b1a33';
const COR_DESTAQUE = '#ffd166';

const PAINEL_X = LARGURA / 2 - 240;
const PAINEL_Y = 128;
const PAINEL_W = 480;
const ALTURA_LINHA = 42;

const BOTAO_CONTINUAR: BotaoRetangular = { id: 'continuar', x: LARGURA / 2 - 160, y: ALTURA - 88, w: 320, h: 56 };

export function criarCenaStandings(opcoes: OpcoesCenaStandings): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  const fundo = criarFundoCampeonato(opcoes.temaFundo, doc);

  let hover = false;
  let ticks = 0;

  const continuar = (): void => opcoes.aoContinuar();

  const aoMover = (e: Event): void => {
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    hover = pontoDentroDoBotao(pt, BOTAO_CONTINUAR);
  };

  const aoTocar = (e: Event): void => {
    e.preventDefault?.();
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_CONTINUAR)) continuar();
  };

  const aoTeclar = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.code === 'Space' || ev.code === 'Enter') continuar();
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  janela?.addEventListener('keydown', aoTeclar);

  return {
    id: 'campeonato-standings',
    atualizar() {
      ticks += 1;
    },
    desenhar(ctx: Ctx, alpha: number) {
      fundo.desenhar(ctx, 0, ticks + alpha);
      ctx.save();
      ctx.fillStyle = 'rgba(8, 18, 36, 0.4)';
      ctx.fillRect(0, 0, LARGURA, ALTURA);
      ctx.restore();

      desenharTexto(ctx, 'CLASSIFICAÇÃO', LARGURA / 2, 62, {
        fonte: 'italic 900 42px "Barlow Condensed", Impact, sans-serif',
        cor: COR_DESTAQUE,
        contorno: 8,
        corContorno: COR_CONTORNO,
        alinhamento: 'center',
      });
      desenharTexto(ctx, `Depois de ${opcoes.pistaConcluidaNome}`, LARGURA / 2, 92, {
        fonte: '600 17px Barlow, sans-serif',
        cor: COR_TEXTO,
        contorno: 4,
        alinhamento: 'center',
      });

      ctx.save();
      ctx.fillStyle = 'rgba(12, 27, 48, 0.78)';
      caminhoArredondado(ctx, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: opcoes.classificacao.length * ALTURA_LINHA + 24 }, 16);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#2a517f';
      ctx.stroke();
      ctx.restore();

      opcoes.classificacao.forEach((item, indice) => {
        const posicao = indice + 1;
        const y = PAINEL_Y + 32 + indice * ALTURA_LINHA;
        const ehJogador = item.id === opcoes.idJogador;
        const nome = opcoes.nomesPorId[item.id] ?? item.id;

        if (ehJogador) {
          ctx.save();
          ctx.fillStyle = 'rgba(255, 209, 102, 0.18)';
          ctx.fillRect(PAINEL_X + 8, y - ALTURA_LINHA / 2 + 4, PAINEL_W - 16, ALTURA_LINHA - 8);
          ctx.restore();
        }

        desenharTexto(ctx, `${posicao}º`, PAINEL_X + 28, y, {
          fonte: '800 20px Barlow, sans-serif',
          cor: ehJogador ? COR_DESTAQUE : COR_TEXTO,
          base: 'middle',
          alinhamento: 'center',
        });
        desenharTexto(ctx, `${nome}${ehJogador ? ' (você)' : ''}`, PAINEL_X + 56, y, {
          fonte: ehJogador ? '700 19px Barlow, sans-serif' : '600 18px Barlow, sans-serif',
          cor: ehJogador ? COR_DESTAQUE : COR_TEXTO,
          base: 'middle',
        });
        desenharTexto(ctx, `${item.pontos} pts`, PAINEL_X + PAINEL_W - 24, y, {
          fonte: '700 18px Barlow, sans-serif',
          cor: COR_TEXTO,
          base: 'middle',
          alinhamento: 'right',
        });
      });

      if (opcoes.proximaPistaNome) {
        desenharTexto(ctx, `Próxima pista: ${opcoes.proximaPistaNome}`, LARGURA / 2, BOTAO_CONTINUAR.y - 14, {
          fonte: '600 15px Barlow, sans-serif',
          cor: '#8fb6e0',
          alinhamento: 'center',
        });
      }
      desenharBotaoBala(ctx, {
        ...BOTAO_CONTINUAR,
        texto: opcoes.proximaPistaNome ? 'CONTINUAR' : 'VER RESULTADO FINAL',
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
