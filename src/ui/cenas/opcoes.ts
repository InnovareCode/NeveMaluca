/**
 * Tela de Configurações/Opções (Canvas 2D) -- redesenho "premium estilo Pixar" (`docs/direcao-ui-premium.md`,
 * Fase 1 §13: fundo fosco, Painel Geada, botão 3D, letreiro, VOLTAR redondo). É a tela mais simples do guia,
 * escolhida pelo Apolo pra validar o material novo antes de levá-lo pro resto da UI.
 *
 * Requisitos atendidos (inalterados desde a versão anterior):
 *  1. Alternar controles: Gestos (padrão D10) vs Botões na tela (grava em `save.cfg.controles`).
 *  2. Áudio on/off (sons e música juntos, gravando `cfg.som`/`cfg.musica`).
 *  3. Tela cheia (integra com `platform/tela-cheia.ts`: no iPhone abre o cartão "como ativar").
 *  4. Voltar (retorna ao Menu Principal, ou à Pausa quando chamada de dentro dela).
 *
 * A tela NÃO escreve no save por conta própria: quem entrega `cfg` é o orquestrador (`ui/cenas/gerenciador.ts`),
 * que já tem o `save` da sessão e o `armazenamento`. Assim o save tem UM só ponto de gravação.
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { emTelaCheia, situacaoDaTelaCheia } from '../../platform/tela-cheia';
import { escalonar, msParaTicks, poseEntrada, prefereMovimentoReduzido } from '../animacao';
import { caminhoArredondado, desenharFlocos, desenharTexto } from '../desenho';
import { criarEstadoPressao, eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import { botao3D, botaoRedondoVoltar, construirFundoFosco, desenharLetreiro, painelGeada, type TipoBotao3D } from '../kit-premium';
import type { Cena } from '../tipos';
import type { ModoControles } from '../../meta/tipos';
import { assetsMenuCapaProntos, precarregarAssetsMenuCapa } from './menu-capa';
import type { CamadaEstatica } from '../desenho';

export interface OpcoesCenaOpcoes {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly obterControles: () => ModoControles;
  readonly obterAudioLigado: () => boolean;
  readonly aoAlternarControles: () => void;
  readonly aoAlternarAudio: () => void;
  readonly aoTelaCheia: () => void;
  readonly aoVoltar: () => void;
}

const COR_FUNDO = '#0c1b30';
const COR_TEXTO = '#f4f9ff';
const COR_MUTED = '#aed0ef';

const PAINEL_X = 180;
const PAINEL_Y = 104;
const PAINEL_W = 600;
const PAINEL_H = 340;

const PASSO_LINHA = 104;
const LINHA_1_Y = PAINEL_Y + 78;
const LINHA_2_Y = LINHA_1_Y + PASSO_LINHA;
const LINHA_3_Y = LINHA_2_Y + PASSO_LINHA;

const MEDALHAO_CX = PAINEL_X + 66;
const ROTULO_X = PAINEL_X + 104;

const SEG_W = 232;
const SEG_H = 48;
const SEG_X = PAINEL_X + PAINEL_W - 40 - SEG_W;
const INT_W = 92;
const INT_H = 48; // alvo de toque mínimo (48 lógicos) -- o guia sugere 44 (§4.4), mas a regra de toque (§1.9) prevalece
const INT_X = PAINEL_X + PAINEL_W - 40 - INT_W;
const BOTAO_CHEIA_W = 196;
const BOTAO_CHEIA_H = 48;
const BOTAO_CHEIA_X = PAINEL_X + PAINEL_W - 40 - BOTAO_CHEIA_W;

const BOTAO_CONTROLES: BotaoRetangular = { id: 'controles', x: SEG_X, y: LINHA_1_Y - SEG_H / 2, w: SEG_W, h: SEG_H };
const BOTAO_AUDIO: BotaoRetangular = { id: 'audio', x: INT_X, y: LINHA_2_Y - INT_H / 2, w: INT_W, h: INT_H };
const BOTAO_TELA_CHEIA: BotaoRetangular = { id: 'tela_cheia', x: BOTAO_CHEIA_X, y: LINHA_3_Y - BOTAO_CHEIA_H / 2, w: BOTAO_CHEIA_W, h: BOTAO_CHEIA_H };
const BOTAO_VOLTAR: BotaoRetangular = { id: 'voltar', x: 32, y: 20, w: 56, h: 56 };

const ROTULO_CONTROLES = 'Controles por toque';
const ROTULO_AUDIO = 'Sons e música';
const ROTULO_TELA_CHEIA = 'Tela cheia';

/** Glifo simples em código (mão/alto-falante/setas) -- nunca emoji/glifo de fonte, que muda de cara por sistema. */
function desenharGlifoLinha(ctx: Ctx, indice: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#ffffff';
  const r = 11;
  if (indice === 0) {
    // "mão"/controle: um retângulo com um círculo em cima (bem abstrato, só pra ler como "controle").
    caminhoArredondado(ctx, { x: -r * 0.6, y: -r * 0.2, w: r * 1.2, h: r * 1.1 }, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -r * 0.6, r * 0.32, 0, Math.PI * 2);
    ctx.stroke();
  } else if (indice === 1) {
    // alto-falante
    ctx.beginPath();
    ctx.moveTo(-r * 0.5, -r * 0.35);
    ctx.lineTo(-r * 0.1, -r * 0.35);
    ctx.lineTo(r * 0.4, -r * 0.75);
    ctx.lineTo(r * 0.4, r * 0.75);
    ctx.lineTo(-r * 0.1, r * 0.35);
    ctx.lineTo(-r * 0.5, r * 0.35);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(r * 0.1, 0, r * 0.7, -0.5, 0.5);
    ctx.stroke();
  } else {
    // setas de expandir (tela cheia)
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      ctx.save();
      ctx.translate(sx * r * 0.5, sy * r * 0.5);
      ctx.beginPath();
      ctx.moveTo(sx * -r * 0.45, 0);
      ctx.lineTo(0, 0);
      ctx.lineTo(0, sy * -r * 0.45);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Medalhão simples (vidro) com o glifo da linha dentro. */
function desenharMedalhaoLinha(ctx: Ctx, cy: number, indice: number): void {
  const raio = 26;
  ctx.save();
  ctx.fillStyle = 'rgba(3,8,24,0.35)';
  ctx.beginPath();
  ctx.arc(MEDALHAO_CX, cy + 2, raio, 0, Math.PI * 2);
  ctx.fill();
  const grad = ctx.createLinearGradient(MEDALHAO_CX, cy - raio, MEDALHAO_CX, cy + raio);
  grad.addColorStop(0, 'rgba(140,210,255,0.3)');
  grad.addColorStop(1, 'rgba(10,24,60,0.65)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(MEDALHAO_CX, cy, raio, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.stroke();
  ctx.translate(MEDALHAO_CX, cy);
  desenharGlifoLinha(ctx, indice);
  ctx.restore();
}

/** Interruptor (§4.4): trilho-pílula + bola de neve que desliza. */
function desenharInterruptor(ctx: Ctx, x: number, y: number, w: number, h: number, ligado: boolean, aoVivo: boolean): void {
  const raio = h / 2;
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  if (ligado) {
    grad.addColorStop(0, '#9BF5C8');
    grad.addColorStop(1, '#1F9E66');
  } else {
    grad.addColorStop(0, 'rgba(60,78,110,0.9)');
    grad.addColorStop(1, 'rgba(10,24,60,0.85)');
  }
  ctx.fillStyle = grad;
  caminhoArredondado(ctx, { x, y, w, h }, raio);
  ctx.fill();
  ctx.lineWidth = aoVivo ? 2.5 : 1.5;
  ctx.strokeStyle = aoVivo ? '#ffffff' : 'rgba(255,255,255,0.3)';
  ctx.stroke();

  const bolaR = h / 2 - 3;
  const bolaX = ligado ? x + w - bolaR - 3 : x + bolaR + 3;
  const bolaGrad = ctx.createRadialGradient(bolaX - bolaR * 0.3, y + h / 2 - bolaR * 0.3, 1, bolaX, y + h / 2, bolaR);
  bolaGrad.addColorStop(0, '#ffffff');
  bolaGrad.addColorStop(1, '#cfe6f7');
  ctx.fillStyle = bolaGrad;
  ctx.beginPath();
  ctx.arc(bolaX, y + h / 2, bolaR, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#0B1630';
  ctx.stroke();
  ctx.restore();
}

// Entrada escalonada (§11.7 "painel (0), linhas deslizando +24px da direita (escalonadas a 70ms)").
const T_ENTRADA_LINHAS = 0;
const PASSO_ENTRADA_LINHA = msParaTicks(70);
const DUR_ENTRADA_LINHA = msParaTicks(360);

export function criarCenaOpcoes(opcoes: OpcoesCenaOpcoes): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  const reduzido = prefereMovimentoReduzido();
  let hover: string | null = null;
  let ticks = 0;
  let fundo: CamadaEstatica | null = null;
  const pressao = criarEstadoPressao();

  /** Cada linha do painel entra deslizando da DIREITA (`deslocaY` da pose é usado como offset em X aqui -- mesma
   *  pose, eixo diferente) -- §11.7. */
  const aplicarEntradaLinha = (ctx: Ctx, indice: number, t: number, fn: () => void): void => {
    const pose = poseEntrada(t, T_ENTRADA_LINHAS + escalonar(indice, PASSO_ENTRADA_LINHA), DUR_ENTRADA_LINHA, reduzido, 24);
    ctx.save();
    ctx.globalAlpha = pose.opacidade;
    ctx.translate(pose.deslocaY, 0);
    fn();
    ctx.restore();
  };

  void precarregarAssetsMenuCapa();

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
    if (pontoDentroDoBotao(pt, BOTAO_CONTROLES)) {
      pressao.marcar('controles', ticks);
      opcoes.aoAlternarControles();
    } else if (pontoDentroDoBotao(pt, BOTAO_AUDIO)) opcoes.aoAlternarAudio();
    else if (pontoDentroDoBotao(pt, BOTAO_TELA_CHEIA)) {
      pressao.marcar('tela_cheia', ticks);
      opcoes.aoTelaCheia();
    } else if (pontoDentroDoBotao(pt, BOTAO_VOLTAR)) opcoes.aoVoltar();
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
      ticks += 1;
    },
    desenhar(ctx: Ctx, alpha: number) {
      const t = ticks + alpha;
      const assets = assetsMenuCapaProntos();
      if (!fundo && assets && doc) fundo = construirFundoFosco(doc, assets.capa, { reducao: 16 });
      if (fundo) fundo.desenhar(ctx);
      else {
        ctx.save();
        ctx.fillStyle = COR_FUNDO;
        ctx.fillRect(0, 0, LARGURA, ALTURA);
        ctx.restore();
      }
      desenharFlocos(ctx, 22, t, 0.7);

      if (doc) {
        desenharLetreiro(ctx, doc, 'OPÇÕES', LARGURA / 2, 56, 40, 'gelo');
        painelGeada(ctx, doc, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: PAINEL_H });
      } else {
        desenharTexto(ctx, 'OPÇÕES', LARGURA / 2, 56, { fonte: 'italic 800 40px "Barlow Condensed", Impact, sans-serif', cor: COR_TEXTO, contorno: 6, alinhamento: 'center' });
      }

      const rotulo = (texto: string, ajuda: string, y: number): void => {
        desenharTexto(ctx, texto, ROTULO_X, y - 10, { fonte: 'italic 800 24px "Barlow Condensed", Impact, sans-serif', cor: COR_TEXTO });
        desenharTexto(ctx, ajuda, ROTULO_X, y + 14, { fonte: '600 15px Barlow, sans-serif', cor: COR_MUTED });
      };

      const controlesAtual = opcoes.obterControles();
      const gestos = controlesAtual === 'gestos';
      const audioLigado = opcoes.obterAudioLigado();
      const temApi = typeof window !== 'undefined' && situacaoDaTelaCheia(window) === 'disponivel';
      const cheiaAgora = typeof document !== 'undefined' && emTelaCheia(document);
      const tipoCheia: TipoBotao3D = temApi ? (cheiaAgora ? 'secundario' : 'confirmar') : 'secundario';

      aplicarEntradaLinha(ctx, 0, t, () => {
        desenharMedalhaoLinha(ctx, LINHA_1_Y, 0);
        rotulo(ROTULO_CONTROLES, 'Toque/arraste vs botões na tela', LINHA_1_Y);
        // Seletor segmentado GESTOS | BOTÕES: o segmento ativo é um botão 3D secundário com tampa pequena.
        ctx.save();
        ctx.fillStyle = 'rgba(4,10,30,0.55)';
        caminhoArredondado(ctx, BOTAO_CONTROLES, SEG_H / 2);
        ctx.fill();
        ctx.restore();
        const meioW = SEG_W / 2;
        const poseControles = pressao.pose('controles', ticks);
        botao3D(ctx, {
          x: gestos ? BOTAO_CONTROLES.x : BOTAO_CONTROLES.x + meioW,
          y: BOTAO_CONTROLES.y,
          w: meioW,
          h: SEG_H,
          texto: gestos ? 'GESTOS' : 'BOTÕES',
          tipo: 'secundario',
          aoVivo: hover === 'controles',
          tamanhoFonte: 17,
          pressionado: poseControles.pressionado,
          escalaExtra: poseControles.escalaExtra,
        });
        desenharTexto(ctx, gestos ? 'BOTÕES' : 'GESTOS', gestos ? BOTAO_CONTROLES.x + meioW + meioW / 2 : BOTAO_CONTROLES.x + meioW / 2, BOTAO_CONTROLES.y + SEG_H / 2 + 1, {
          fonte: 'italic 800 17px "Barlow Condensed", Impact, sans-serif',
          cor: 'rgba(255,255,255,0.55)',
          alinhamento: 'center',
          base: 'middle',
        });
      });

      aplicarEntradaLinha(ctx, 1, t, () => {
        desenharMedalhaoLinha(ctx, LINHA_2_Y, 1);
        rotulo(ROTULO_AUDIO, 'Sons e música juntos', LINHA_2_Y);
        desenharInterruptor(ctx, BOTAO_AUDIO.x, BOTAO_AUDIO.y, BOTAO_AUDIO.w, BOTAO_AUDIO.h, audioLigado, hover === 'audio');
      });

      aplicarEntradaLinha(ctx, 2, t, () => {
        desenharMedalhaoLinha(ctx, LINHA_3_Y, 2);
        rotulo(
          ROTULO_TELA_CHEIA,
          typeof window !== 'undefined' && situacaoDaTelaCheia(window) === 'disponivel' ? 'Atalho: tecla F' : 'No iPhone: Compartilhar > Adicionar à Tela de Início',
          LINHA_3_Y,
        );
        const poseTelaCheia = pressao.pose('tela_cheia', ticks);
        botao3D(ctx, {
          ...BOTAO_TELA_CHEIA,
          texto: temApi ? (cheiaAgora ? 'SAIR' : 'ENTRAR') : 'COMO ATIVAR',
          tipo: tipoCheia,
          aoVivo: hover === 'tela_cheia',
          pressionado: poseTelaCheia.pressionado,
          escalaExtra: poseTelaCheia.escalaExtra,
        });
      });

      // divisórias (desenhadas por último, por cima do deslize -- são decoração fixa do painel, não de uma linha)
      ctx.save();
      ctx.strokeStyle = 'rgba(159,227,255,0.22)';
      ctx.lineWidth = 1;
      for (const y of [LINHA_1_Y + PASSO_LINHA / 2, LINHA_2_Y + PASSO_LINHA / 2]) {
        const grad = ctx.createLinearGradient(PAINEL_X + 30, y, PAINEL_X + PAINEL_W - 30, y);
        grad.addColorStop(0, 'rgba(159,227,255,0)');
        grad.addColorStop(0.5, 'rgba(159,227,255,0.3)');
        grad.addColorStop(1, 'rgba(159,227,255,0)');
        ctx.strokeStyle = grad;
        ctx.beginPath();
        ctx.moveTo(PAINEL_X + 30, y);
        ctx.lineTo(PAINEL_X + PAINEL_W - 30, y);
        ctx.stroke();
      }
      ctx.restore();

      botaoRedondoVoltar(ctx, BOTAO_VOLTAR.x + BOTAO_VOLTAR.w / 2, BOTAO_VOLTAR.y + BOTAO_VOLTAR.h / 2, BOTAO_VOLTAR.w / 2, hover === 'voltar');

      desenharTexto(ctx, 'ESC volta', BOTAO_VOLTAR.x + BOTAO_VOLTAR.w / 2, BOTAO_VOLTAR.y + BOTAO_VOLTAR.h + 16, {
        fonte: '600 14px Barlow, sans-serif',
        cor: COR_MUTED,
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
