/**
 * Tela de Configurações/Opções (Canvas 2D).
 *
 * Requisitos atendidos:
 *  1. Alternar controles: Gestos (padrão D10) vs Botões na tela (grava em `save.cfg.controles`).
 *  2. Áudio on/off (sons e música juntos, gravando `cfg.som`/`cfg.musica`).
 *  3. Tela cheia (integra com `platform/tela-cheia.ts`: no iPhone abre o cartão "como ativar").
 *  4. Voltar (retorna ao Menu Principal).
 *
 * A tela NÃO escreve no save por conta própria: quem entrega `cfg` é o orquestrador (`ui/cenas/gerenciador.ts`),
 * que já tem o `save` da sessão e o `armazenamento`. Assim o save tem UM só ponto de gravação.
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { emTelaCheia, situacaoDaTelaCheia } from '../../platform/tela-cheia';
import { caminhoArredondado, desenharBotao, desenharTexto } from '../desenho';
import { eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import type { Cena } from '../tipos';
import type { ModoControles } from '../../meta/tipos';

export interface OpcoesCenaOpcoes {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly obterControles: () => ModoControles;
  readonly obterAudioLigado: () => boolean;
  readonly aoAlternarControles: () => void;
  readonly aoAlternarAudio: () => void;
  readonly aoTelaCheia: () => void;
  readonly aoVoltar: () => void;
}

const COR_FUNDO = '#0c1b30';
const COR_PAINEL = '#162b47';
const COR_BORDA = '#2a517f';
const COR_TEXTO = '#f4f9ff';
const COR_CONTORNO = '#0b1a33';

const PAINEL_X = 150;
const PAINEL_Y = 60;
const PAINEL_W = 660;
const PAINEL_H = 420;

const LARGURA_ALTERNATIVA = 250;
const ALTURA_ALTERNATIVA = 50;
const COLUNA_ALTERNATIVA = PAINEL_X + PAINEL_W - LARGURA_ALTERNATIVA - 40;

const LINHA_1_Y = PAINEL_Y + 120;
const LINHA_2_Y = PAINEL_Y + 195;
const LINHA_3_Y = PAINEL_Y + 270;

const BOTAO_CONTROLES: BotaoRetangular = { id: 'controles', x: COLUNA_ALTERNATIVA, y: LINHA_1_Y - 25, w: LARGURA_ALTERNATIVA, h: ALTURA_ALTERNATIVA };
const BOTAO_AUDIO: BotaoRetangular = { id: 'audio', x: COLUNA_ALTERNATIVA, y: LINHA_2_Y - 25, w: LARGURA_ALTERNATIVA, h: ALTURA_ALTERNATIVA };
const BOTAO_TELA_CHEIA: BotaoRetangular = { id: 'tela_cheia', x: COLUNA_ALTERNATIVA, y: LINHA_3_Y - 25, w: LARGURA_ALTERNATIVA, h: ALTURA_ALTERNATIVA };
const BOTAO_VOLTAR: BotaoRetangular = { id: 'voltar', x: LARGURA / 2 - 100, y: PAINEL_Y + PAINEL_H - 85, w: 200, h: 46 };

const ROTULO_CONTROLES = 'Controles por toque';
const ROTULO_AUDIO = 'Sons e música';
const ROTULO_TELA_CHEIA = 'Tela cheia';

export function criarCenaOpcoes(opcoes: OpcoesCenaOpcoes): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  let hover: string | null = null;

  const aoMover = (e: Event): void => {
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    hover = pontoDentroDoBotao(pt, BOTAO_CONTROLES)
      ? 'controles'
      : pontoDentroDoBotao(pt, BOTAO_AUDIO)
        ? 'audio'
        : pontoDentroDoBotao(pt, BOTAO_TELA_CHEIA)
          ? 'tela_cheia'
          : pontoDentroDoBotao(pt, BOTAO_VOLTAR)
            ? 'voltar'
            : null;
  };

  const aoTocar = (e: Event): void => {
    e.preventDefault?.();
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_CONTROLES)) opcoes.aoAlternarControles();
    else if (pontoDentroDoBotao(pt, BOTAO_AUDIO)) opcoes.aoAlternarAudio();
    else if (pontoDentroDoBotao(pt, BOTAO_TELA_CHEIA)) opcoes.aoTelaCheia();
    else if (pontoDentroDoBotao(pt, BOTAO_VOLTAR)) opcoes.aoVoltar();
  };

  const aoTeclar = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.code === 'Escape' || ev.code === 'Backspace') {
      ev.preventDefault?.();
      opcoes.aoVoltar();
    } else if (ev.code === 'KeyM') {
      opcoes.aoAlternarAudio();
    } else if (ev.code === 'KeyG') {
      opcoes.aoAlternarControles();
    } else if (ev.code === 'KeyF') {
      opcoes.aoTelaCheia();
    }
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  janela?.addEventListener('keydown', aoTeclar);

  return {
    id: 'opcoes',
    atualizar() {
      // nada a avançar: as opções são controladas pelos eventos
    },
    desenhar(ctx: Ctx) {
      ctx.save();
      ctx.fillStyle = COR_FUNDO;
      ctx.fillRect(0, 0, LARGURA, ALTURA);

      // painel
      ctx.fillStyle = COR_PAINEL;
      caminhoArredondado(ctx, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: PAINEL_H }, 18);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = COR_BORDA;
      ctx.stroke();

      // título
      desenharTexto(ctx, 'OPÇÕES', LARGURA / 2, PAINEL_Y + 62, {
        fonte: 'italic 800 48px "Barlow Condensed", Impact, sans-serif',
        cor: COR_TEXTO,
        contorno: 7,
        corContorno: COR_CONTORNO,
        alinhamento: 'center',
      });
      desenharTexto(ctx, 'Ajuste o jogo do seu jeito', LARGURA / 2, PAINEL_Y + 88, {
        fonte: '600 18px Barlow, sans-serif',
        cor: '#8fb6e0',
        alinhamento: 'center',
      });

      // divisória
      ctx.strokeStyle = COR_BORDA;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAINEL_X + 40, PAINEL_Y + 105);
      ctx.lineTo(PAINEL_X + PAINEL_W - 40, PAINEL_Y + 105);
      ctx.stroke();

      // rótulos das linhas
      const rotulo = (texto: string, y: number): void => {
        desenharTexto(ctx, texto, PAINEL_X + 40, y + 7, {
          fonte: '600 24px Barlow, sans-serif',
          cor: COR_TEXTO,
        });
      };
      rotulo(ROTULO_CONTROLES, LINHA_1_Y);
      rotulo(ROTULO_AUDIO, LINHA_2_Y);
      rotulo(ROTULO_TELA_CHEIA, LINHA_3_Y);

      // dica de como cada modo funciona
      desenharTexto(ctx, 'Toque/arraste vs botões na tela', PAINEL_X + 40, LINHA_1_Y + 26, {
        fonte: '500 15px Barlow, sans-serif',
        cor: '#8fb6e0',
      });

      ctx.restore();

      // linha 1: modo de controles
      const controlesAtual = opcoes.obterControles();
      const controlesTexto = controlesAtual === 'gestos' ? 'GESTOS' : 'BOTÕES';
      desenharBotao(ctx, {
        ...BOTAO_CONTROLES,
        texto: controlesTexto,
        corTopo: controlesAtual === 'gestos' ? '#31c66d' : '#2a7de1',
        corBase: controlesAtual === 'gestos' ? '#1d7f45' : '#144d8f',
        aoVivo: hover === 'controles',
      });

      // linha 2: áudio
      const audioLigado = opcoes.obterAudioLigado();
      desenharBotao(ctx, {
        ...BOTAO_AUDIO,
        texto: audioLigado ? 'LIGADO' : 'DESLIGADO',
        corTopo: audioLigado ? '#31c66d' : '#55606a',
        corBase: audioLigado ? '#1d7f45' : '#2c343b',
        aoVivo: hover === 'audio',
      });

      // linha 3: tela cheia (texto depende da plataforma: no iPhone não existe a API)
      const temApi = typeof window !== 'undefined' && situacaoDaTelaCheia(window) === 'disponivel';
      const cheiaAgora = typeof document !== 'undefined' && emTelaCheia(document);
      desenharBotao(ctx, {
        ...BOTAO_TELA_CHEIA,
        texto: temApi ? (cheiaAgora ? 'SAIR' : 'ENTRAR') : 'COMO ATIVAR',
        corTopo: temApi ? (cheiaAgora ? '#31c66d' : '#2a7de1') : '#f6c90e',
        corBase: temApi ? (cheiaAgora ? '#1d7f45' : '#144d8f') : '#a06e00',
        aoVivo: hover === 'tela_cheia',
      });
      desenharTexto(ctx, temApi ? 'Atalho: tecla F' : 'No iPhone: Compartilhar > Adicionar à Tela de Início', PAINEL_X + 40, LINHA_3_Y + 26, {
        fonte: '500 15px Barlow, sans-serif',
        cor: '#8fb6e0',
      });

      // botão voltar
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