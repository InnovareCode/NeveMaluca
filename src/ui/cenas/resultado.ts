/**
 * Cena de resultado (plano §7 M1a, pilar 4 "de novo em 1 toque"): mostra pontos e tempo, e volta para uma nova
 * descida no toque ou tecla (Espaço/Enter), ou Menu ao clicar no botão "MENU" ou apertar Escape/M.
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import { desenharBotao } from '../desenho';
import { eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import type { Cena } from '../tipos';
import type { ResultadoDescida } from './descida';

export interface OpcoesCenaResultado {
  readonly dados: ResultadoDescida;
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly aoReiniciar?: (() => void) | undefined;
  readonly aoMenu?: (() => void) | undefined;
}

const COR_FUNDO = '#0b1a33';
const COR_TEXTO = '#f4f9ff';

const BOTAO_MENU: BotaoRetangular = {
  id: 'menu',
  x: LARGURA / 2 - 90,
  y: ALTURA * 0.72,
  w: 180,
  h: 46,
};

export function criarCenaResultado(opcoes: OpcoesCenaResultado): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const reiniciar = (): void => opcoes.aoReiniciar?.();
  const voltarMenu = (): void => {
    if (opcoes.aoMenu) opcoes.aoMenu();
    else reiniciar();
  };

  let hoverMenu = false;

  const aoMover = (ev: Event): void => {
    if (!opcoes.aoMenu) return;
    const pt = eventoParaPontoLogico(ev as PointerEvent, opcoes.canvas);
    hoverMenu = pontoDentroDoBotao(pt, BOTAO_MENU);
  };

  const aoTecla = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (e.code === 'Space' || e.code === 'Enter') {
      reiniciar();
    } else if (e.code === 'Escape' || e.code === 'KeyM') {
      voltarMenu();
    }
  };

  const aoTocar = (ev: Event): void => {
    if (opcoes.aoMenu) {
      const pt = eventoParaPontoLogico(ev as PointerEvent, opcoes.canvas);
      if (pontoDentroDoBotao(pt, BOTAO_MENU)) {
        voltarMenu();
        return;
      }
    }
    reiniciar();
  };

  janela?.addEventListener('keydown', aoTecla);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  opcoes.canvas.addEventListener('pointerdown', aoTocar);

  let ticks = 0;
  return {
    id: 'resultado',
    atualizar() {
      ticks += 1;
    },
    desenhar(ctx) {
      ctx.save();
      ctx.fillStyle = COR_FUNDO;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
      ctx.textAlign = 'center';
      ctx.fillStyle = COR_TEXTO;
      ctx.font = 'italic 800 56px "Barlow Condensed", sans-serif';
      ctx.fillText('CHEGOU!', LARGURA / 2, ALTURA * 0.35);
      ctx.font = '700 32px Barlow, sans-serif';
      ctx.fillText(`${opcoes.dados.pontos} pontos`, LARGURA / 2, ALTURA * 0.35 + 56);
      ctx.font = '600 20px Barlow, sans-serif';
      ctx.fillText(`${(opcoes.dados.ticks / 60).toFixed(1)} s`, LARGURA / 2, ALTURA * 0.35 + 92);
      if (ticks % 60 < 40) {
        ctx.font = '600 18px Barlow, sans-serif';
        ctx.fillText('toque ou aperte ESPAÇO para jogar de novo', LARGURA / 2, ALTURA * 0.35 + 140);
      }

      if (opcoes.aoMenu) {
        desenharBotao(ctx, {
          ...BOTAO_MENU,
          texto: 'MENU PRINCIPAL',
          corTopo: hoverMenu ? '#4da2ff' : '#2a7de1',
          corBase: hoverMenu ? '#1f6fd0' : '#144d8f',
          aoVivo: hoverMenu,
        });
      }
      ctx.restore();
    },
    destruir() {
      janela?.removeEventListener('keydown', aoTecla);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
    },
  };
}
