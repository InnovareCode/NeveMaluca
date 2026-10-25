/**
 * Cena de pódio da pista (plano `docs/plano-corrida-campeonato.md` §C2b/C5a): mostra a ordem de chegada
 * (`ResultadoCorrida.ordem`) dos 6, com o jogador destacado, e volta ao chamador (`aoContinuar`) no toque/tecla.
 * Mesmo padrão de `ui/cenas/resultado.ts` (tela escura, lista central, botão "bala" para continuar).
 *
 * O fluxo de campeonato completo (standings entre etapas, oficina de upgrade, C5a/C5b) ainda não existe --
 * `aoContinuar` hoje só volta ao menu (`ui/cenas/campeonato.ts`); quando as etapas existirem, troca por "próxima
 * etapa" sem mudar nada aqui (esta cena só sabe desenhar UM pódio).
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { IdPersonagem, ResultadoCorrida } from '../../core/contratos';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import { desenharBotao } from '../desenho';
import { eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import type { Cena } from '../tipos';

export interface OpcoesCenaPodio {
  readonly resultado: ResultadoCorrida;
  /** Nome de exibição por id (`DefPersonagem.nome`); id sem entrada cai no próprio id (nunca trava o pódio). */
  readonly nomesPorId: Readonly<Record<IdPersonagem, string>>;
  readonly idJogador: IdPersonagem;
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly aoContinuar?: (() => void) | undefined;
}

const COR_FUNDO = '#0b1a33';
const COR_TEXTO = '#f4f9ff';
const COR_DESTAQUE = '#ffd166';

const LARGURA_LISTA = 420;
const X_LISTA = LARGURA / 2 - LARGURA_LISTA / 2;
const Y_LISTA_TOPO = 150;
const ALTURA_LINHA = 42;

const BOTAO_CONTINUAR: BotaoRetangular = {
  id: 'continuar',
  x: LARGURA / 2 - 100,
  y: ALTURA - 90,
  w: 200,
  h: 50,
};

/** "1º", "2º"... */
function rotuloPosicao(posicao1Baseado: number): string {
  return `${posicao1Baseado}º`;
}

export function criarCenaPodio(opcoes: OpcoesCenaPodio): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const continuar = (): void => opcoes.aoContinuar?.();

  let hoverContinuar = false;

  const aoMover = (ev: Event): void => {
    const pt = eventoParaPontoLogico(ev as PointerEvent, opcoes.canvas);
    hoverContinuar = pontoDentroDoBotao(pt, BOTAO_CONTINUAR);
  };

  const aoTecla = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') continuar();
  };

  const aoTocar = (ev: Event): void => {
    const pt = eventoParaPontoLogico(ev as PointerEvent, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_CONTINUAR)) {
      continuar();
      return;
    }
  };

  janela?.addEventListener('keydown', aoTecla);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  opcoes.canvas.addEventListener('pointerdown', aoTocar);

  return {
    id: 'podio',
    atualizar() {
      // sem estado próprio: a ordem já vem fechada em `opcoes.resultado`
    },
    desenhar(ctx) {
      ctx.save();
      ctx.fillStyle = COR_FUNDO;
      ctx.fillRect(0, 0, LARGURA, ALTURA);

      ctx.textAlign = 'center';
      ctx.fillStyle = COR_DESTAQUE;
      ctx.font = 'italic 900 48px "Barlow Condensed", Impact, sans-serif';
      ctx.fillText('PÓDIO', LARGURA / 2, 96);

      ctx.font = '700 22px Barlow, sans-serif';
      opcoes.resultado.ordem.forEach((id, indice) => {
        const posicao = indice + 1;
        const y = Y_LISTA_TOPO + indice * ALTURA_LINHA;
        const ehJogador = id === opcoes.idJogador;
        const nome = opcoes.nomesPorId[id] ?? id;
        const ticks = opcoes.resultado.ticks[id] ?? 0;
        const segundos = (ticks / 60).toFixed(1);

        if (ehJogador) {
          ctx.fillStyle = 'rgba(255, 209, 102, 0.18)';
          ctx.fillRect(X_LISTA, y - ALTURA_LINHA / 2 + 4, LARGURA_LISTA, ALTURA_LINHA - 8);
        }

        ctx.textAlign = 'left';
        ctx.fillStyle = ehJogador ? COR_DESTAQUE : COR_TEXTO;
        ctx.fillText(`${rotuloPosicao(posicao)}  ${nome}${ehJogador ? ' (você)' : ''}`, X_LISTA + 14, y);

        ctx.textAlign = 'right';
        ctx.fillStyle = COR_TEXTO;
        ctx.font = '600 18px Barlow, sans-serif';
        ctx.fillText(`${segundos} s`, X_LISTA + LARGURA_LISTA - 14, y);
        ctx.font = '700 22px Barlow, sans-serif';
      });

      desenharBotao(ctx, {
        ...BOTAO_CONTINUAR,
        // "CONTINUAR" (não "MENU" -- rótulo antigo mentia: `aoContinuar` leva à classificação do campeonato,
        // `ui/cenas/campeonato.ts`, nunca ao menu principal; corrigido junto da fluidez da transição campeonato).
        texto: 'CONTINUAR',
        corTopo: hoverContinuar ? '#4da2ff' : '#2a7de1',
        corBase: hoverContinuar ? '#1f6fd0' : '#144d8f',
        aoVivo: hoverContinuar,
      });
      ctx.restore();
    },
    destruir() {
      janela?.removeEventListener('keydown', aoTecla);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
    },
  };
}
