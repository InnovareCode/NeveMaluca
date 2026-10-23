/**
 * Cena de Menu Principal (Canvas 2D).
 *
 * Requisitos atendidos:
 *  1. Botões estilizados: Jogar, Modos, Opções (toque e mouse).
 *  2. Capi em destaque com morro nevado ao fundo.
 *  3. Partículas de neve e céu alpino característico.
 */
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import { ALTURA, LARGURA } from '../../core/constantes';
import { seno } from '../../core/trig';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { criarCamadaEstatica, desenharBotao, desenharFlocos, type CamadaEstatica } from '../desenho';
import { eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import type { Cena } from '../tipos';

export interface OpcoesCenaMenu {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly aoJogar: () => void;
  readonly aoModos?: (() => void) | undefined;
  readonly aoOpcoes: () => void;
  /** Abre a tela de seleção de personagem; sem ela, o botão PERSONAGEM fica inerte (testes que não usam o recurso). */
  readonly aoPersonagem?: (() => void) | undefined;
  /** Id do personagem em destaque na vitrine (sprite + fallback); sem ele, mostra a `capi`. */
  readonly obterPersonagemAtivo?: (() => string) | undefined;
}

const COR_CEU_TOPO = '#1b4b8a';
const COR_CEU_BASE = '#70aae0';
const COR_NEVE = '#f4f9ff';
const COR_CONTORNO_NEVE = '#9fb6c9';
const COR_CONTORNO = '#0b1a33';

const BOTOES_LARGURA = 220;
const BOTOES_ALTURA = 54;
const BOTOES_X = 80;
const BOTAO_JOGAR_Y = 220;
const BOTAO_MODOS_Y = 295;
const BOTAO_OPCOES_Y = 370;
const BOTAO_PERSONAGEM_Y = 445;

const BOTAO_JOGAR: BotaoRetangular = { id: 'jogar', x: BOTOES_X, y: BOTAO_JOGAR_Y, w: BOTOES_LARGURA, h: BOTOES_ALTURA };
const BOTAO_MODOS: BotaoRetangular = { id: 'modos', x: BOTOES_X, y: BOTAO_MODOS_Y, w: BOTOES_LARGURA, h: BOTOES_ALTURA };
const BOTAO_OPCOES: BotaoRetangular = { id: 'opcoes', x: BOTOES_X, y: BOTAO_OPCOES_Y, w: BOTOES_LARGURA, h: BOTOES_ALTURA };
const BOTAO_PERSONAGEM: BotaoRetangular = { id: 'personagem', x: BOTOES_X, y: BOTAO_PERSONAGEM_Y, w: BOTOES_LARGURA, h: BOTOES_ALTURA };

function pintarCenarioMenu(ctx: Ctx): void {
  // 1. Céu em degradê
  const ceu = ctx.createLinearGradient(0, 0, 0, ALTURA);
  ceu.addColorStop(0, COR_CEU_TOPO);
  ceu.addColorStop(1, COR_CEU_BASE);
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  // 2. Montanhas distantes
  ctx.fillStyle = '#6f9fd6';
  ctx.beginPath();
  ctx.moveTo(0, ALTURA);
  ctx.lineTo(0, ALTURA * 0.65);
  ctx.lineTo(260, ALTURA * 0.48);
  ctx.lineTo(540, ALTURA * 0.62);
  ctx.lineTo(820, ALTURA * 0.44);
  ctx.lineTo(LARGURA, ALTURA * 0.54);
  ctx.lineTo(LARGURA, ALTURA);
  ctx.closePath();
  ctx.fill();

  // 3. Grande morro nevado descendo da direita para a esquerda
  ctx.fillStyle = COR_NEVE;
  ctx.beginPath();
  ctx.moveTo(0, ALTURA);
  ctx.lineTo(0, ALTURA * 0.76);
  ctx.bezierCurveTo(LARGURA * 0.35, ALTURA * 0.74, LARGURA * 0.65, ALTURA * 0.56, LARGURA, ALTURA * 0.42);
  ctx.lineTo(LARGURA, ALTURA);
  ctx.closePath();
  ctx.fill();

  // Contorno suave na crista do morro de neve
  ctx.lineWidth = 3;
  ctx.strokeStyle = COR_CONTORNO_NEVE;
  ctx.beginPath();
  ctx.moveTo(0, ALTURA * 0.76);
  ctx.bezierCurveTo(LARGURA * 0.35, ALTURA * 0.74, LARGURA * 0.65, ALTURA * 0.56, LARGURA, ALTURA * 0.42);
  ctx.stroke();

  // Pinheiros decorativos na montanha
  ctx.fillStyle = '#1e4738';
  const desenharPinheiro = (px: number, py: number, alturaArvore: number): void => {
    ctx.beginPath();
    ctx.moveTo(px, py - alturaArvore);
    ctx.lineTo(px + alturaArvore * 0.4, py);
    ctx.lineTo(px - alturaArvore * 0.4, py);
    ctx.closePath();
    ctx.fill();
  };
  desenharPinheiro(680, ALTURA * 0.54, 46);
  desenharPinheiro(720, ALTURA * 0.52, 38);
  desenharPinheiro(760, ALTURA * 0.50, 42);
  desenharPinheiro(860, ALTURA * 0.44, 34);

  // Título e subtítulo do Menu
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.font = 'italic 900 68px "Barlow Condensed", Impact, sans-serif';

  ctx.lineWidth = 10;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.strokeText('NEVE MALUCA', BOTOES_X, 130);

  const gradTitulo = ctx.createLinearGradient(BOTOES_X, 80, BOTOES_X, 140);
  gradTitulo.addColorStop(0, '#ffffff');
  gradTitulo.addColorStop(1, '#a8e0ff');
  ctx.fillStyle = gradTitulo;
  ctx.fillText('NEVE MALUCA', BOTOES_X, 130);

  ctx.font = '700 20px Barlow, sans-serif';
  ctx.fillStyle = COR_CONTORNO;
  ctx.fillText('DESCIDA RADICAL & COMÉDIA', BOTOES_X + 2, 162);
  ctx.restore();
}

export function criarCenaMenu(opcoes: OpcoesCenaMenu): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);

  let ticks = 0;
  let spriteCapi: SpritePersonagem | null = null;
  let botaoHover: string | null = null;
  let cenario: CamadaEstatica | null = null;

  void carregarSpritePersonagem(opcoes.obterPersonagemAtivo?.() ?? 'capi')
    .then((s) => {
      spriteCapi = s;
    })
    .catch(() => {
      // fallback silencioso
    });

  const aoMover = (e: Event): void => {
    const ev = e as PointerEvent;
    const pt = eventoParaPontoLogico(ev, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_JOGAR)) botaoHover = 'jogar';
    else if (pontoDentroDoBotao(pt, BOTAO_MODOS)) botaoHover = 'modos';
    else if (pontoDentroDoBotao(pt, BOTAO_OPCOES)) botaoHover = 'opcoes';
    else if (pontoDentroDoBotao(pt, BOTAO_PERSONAGEM)) botaoHover = 'personagem';
    else botaoHover = null;
  };

  const aoTocar = (e: Event): void => {
    e.preventDefault?.();
    const ev = e as PointerEvent;
    const pt = eventoParaPontoLogico(ev, opcoes.canvas);

    if (pontoDentroDoBotao(pt, BOTAO_JOGAR)) {
      opcoes.aoJogar();
    } else if (pontoDentroDoBotao(pt, BOTAO_MODOS)) {
      if (opcoes.aoModos) opcoes.aoModos();
      else opcoes.aoJogar();
    } else if (pontoDentroDoBotao(pt, BOTAO_OPCOES)) {
      opcoes.aoOpcoes();
    } else if (pontoDentroDoBotao(pt, BOTAO_PERSONAGEM)) {
      opcoes.aoPersonagem?.();
    }
  };

  const aoTeclar = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.code === 'Enter' || ev.code === 'Space') {
      opcoes.aoJogar();
    } else if (ev.code === 'KeyO') {
      opcoes.aoOpcoes();
    } else if (ev.code === 'KeyP') {
      opcoes.aoPersonagem?.();
    }
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  janela?.addEventListener('keydown', aoTeclar);

  return {
    id: 'menu',
    atualizar() {
      ticks += 1;
    },
    desenhar(ctx: Ctx, alpha: number) {
      if (!cenario && doc) {
        cenario = criarCamadaEstatica(doc, pintarCenarioMenu);
      }
      if (cenario) {
        cenario.desenhar(ctx);
      } else {
        pintarCenarioMenu(ctx);
      }

      const t = ticks + alpha;

      // Partículas de neve caindo
      desenharFlocos(ctx, 40, t);

      // Capi Barbosa em destaque
      const capiX = LARGURA * 0.72;
      const capiY = ALTURA * 0.68 + seno((t * 3) % 360) * 3;
      const quadroCapi = spriteCapi ? (spriteCapi.obterQuadro('ride0') ?? spriteCapi.obterQuadro('star')) : null;

      ctx.save();
      ctx.translate(capiX, capiY);
      ctx.rotate((-12 * Math.PI) / 180);

      if (quadroCapi) {
        const d = quadroCapi.dados;
        const escalaCapi = 145 / d.altura;
        const [ancoraX, ancoraY] = d.contato ?? d.pivo;
        ctx.drawImage(
          quadroCapi.imagem,
          -ancoraX * escalaCapi,
          -ancoraY * escalaCapi,
          d.largura * escalaCapi,
          d.altura * escalaCapi,
        );
      } else {
        ctx.fillStyle = '#8e5b23';
        ctx.beginPath();
        ctx.ellipse(0, -30, 36, 48, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ff9f43';
        ctx.fillRect(-45, 12, 90, 10);
      }
      ctx.restore();

      // Botões estilizados
      desenharBotao(ctx, {
        ...BOTAO_JOGAR,
        texto: 'JOGAR',
        corTopo: botaoHover === 'jogar' ? '#ffe066' : '#f6c90e',
        corBase: botaoHover === 'jogar' ? '#f39c12' : '#d35400',
        destaque: true,
        aoVivo: botaoHover === 'jogar',
      });

      desenharBotao(ctx, {
        ...BOTAO_MODOS,
        texto: 'MODOS',
        corTopo: botaoHover === 'modos' ? '#4da2ff' : '#2a7de1',
        corBase: botaoHover === 'modos' ? '#1f6fd0' : '#144d8f',
        aoVivo: botaoHover === 'modos',
      });

      desenharBotao(ctx, {
        ...BOTAO_OPCOES,
        texto: 'OPÇÕES',
        corTopo: botaoHover === 'opcoes' ? '#4da2ff' : '#2a7de1',
        corBase: botaoHover === 'opcoes' ? '#1f6fd0' : '#144d8f',
        aoVivo: botaoHover === 'opcoes',
      });

      desenharBotao(ctx, {
        ...BOTAO_PERSONAGEM,
        texto: 'PERSONAGEM',
        corTopo: botaoHover === 'personagem' ? '#4da2ff' : '#2a7de1',
        corBase: botaoHover === 'personagem' ? '#1f6fd0' : '#144d8f',
        aoVivo: botaoHover === 'personagem',
      });

      // Rodapé
      ctx.save();
      ctx.textAlign = 'left';
      ctx.font = '600 14px Barlow, sans-serif';
      ctx.fillStyle = '#2a517f';
      ctx.fillText('v1.0 · Neve Maluca · Innovare Games', 20, ALTURA - 16);
      ctx.restore();
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
