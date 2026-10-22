/**
 * Cena de Abertura (Splash) do Neve Maluca.
 *
 * Requisitos atendidos:
 *  1. Logo animado NEVE MALUCA (efeito de entrada e flutuação senoidal suave, usando `core/trig`).
 *  2. Partículas de neve caindo determinísticas (`ui/desenho.ts`).
 *  3. Transição suave (fade out para fade in no menu) ao clicar/tocar, apertar tecla ou após 3s (~180 ticks).
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import { seno } from '../../core/trig';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { criarCamadaEstatica, desenharFlocos, type CamadaEstatica } from '../desenho';
import type { Cena } from '../tipos';

export interface OpcoesCenaAbertura {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly aoAvancar: () => void;
  /** Duração em ticks antes do fade automático (padrão 180 ticks = 3s). */
  readonly ticksMaximos?: number | undefined;
}

const TICKS_SPLASH = 180;
const TICKS_FADE = 20;

const COR_CEU_TOPO = '#1b4b8a';
const COR_CEU_BASE = '#70aae0';
const COR_NEVE = '#f4f9ff';
const COR_CONTORNO = '#0b1a33';

function pintarCenarioFixo(ctx: Ctx): void {
  const grad = ctx.createLinearGradient(0, 0, 0, ALTURA);
  grad.addColorStop(0, COR_CEU_TOPO);
  grad.addColorStop(1, COR_CEU_BASE);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  ctx.fillStyle = '#9dc6eb';
  ctx.beginPath();
  ctx.moveTo(0, ALTURA);
  ctx.lineTo(0, ALTURA * 0.72);
  ctx.lineTo(LARGURA * 0.35, ALTURA * 0.55);
  ctx.lineTo(LARGURA * 0.7, ALTURA * 0.68);
  ctx.lineTo(LARGURA, ALTURA * 0.58);
  ctx.lineTo(LARGURA, ALTURA);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COR_NEVE;
  ctx.beginPath();
  ctx.moveTo(0, ALTURA);
  ctx.lineTo(0, ALTURA * 0.85);
  ctx.quadraticCurveTo(LARGURA * 0.45, ALTURA * 0.78, LARGURA, ALTURA * 0.82);
  ctx.lineTo(LARGURA, ALTURA);
  ctx.closePath();
  ctx.fill();
}

export function criarCenaAbertura(opcoes: OpcoesCenaAbertura): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  const duracao = opcoes.ticksMaximos ?? TICKS_SPLASH;

  let ticks = 0;
  let saindo = false;
  let avancou = false;
  let fadeTick = 0;
  let cenario: CamadaEstatica | null = null;

  const avancar = (): void => {
    if (saindo) return;
    saindo = true;
    fadeTick = 0;
  };

  const aoTocar = (e: Event): void => {
    e.preventDefault?.();
    avancar();
  };

  const aoTeclar = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.code === 'Space' || ev.code === 'Enter' || ev.code === 'Escape') {
      avancar();
    }
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  janela?.addEventListener('keydown', aoTeclar);

  return {
    id: 'abertura',
    atualizar() {
      ticks += 1;
      if (!saindo && ticks >= duracao) {
        avancar();
      }
      if (saindo && !avancou) {
        fadeTick += 1;
        if (fadeTick >= TICKS_FADE) {
          avancou = true;
          opcoes.aoAvancar();
        }
      }
    },
    desenhar(ctx: Ctx, alpha: number) {
      if (!cenario && doc) {
        cenario = criarCamadaEstatica(doc, pintarCenarioFixo);
      }
      if (cenario) {
        cenario.desenhar(ctx);
      } else {
        pintarCenarioFixo(ctx);
      }

      const t = ticks + alpha;

      // Partículas de neve caindo
      desenharFlocos(ctx, 35, t);

      // Logo Animado NEVE MALUCA
      const progressoEntrada = Math.min(1, t / 25);
      const oscilacao = seno((t * 3.6) % 360) * 5;
      const escalaLogo = (0.78 + 0.22 * progressoEntrada) * (1 + 0.02 * seno((t * 2.4) % 360));

      ctx.save();
      ctx.translate(LARGURA / 2, ALTURA * 0.42 + oscilacao);
      ctx.scale(escalaLogo, escalaLogo);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';

      // Sombra
      ctx.font = 'italic 900 108px "Barlow Condensed", Impact, sans-serif';
      ctx.fillStyle = 'rgba(11, 26, 51, 0.45)';
      ctx.fillText('NEVE MALUCA', 6, 10);

      // Contorno espesso
      ctx.lineWidth = 14;
      ctx.strokeStyle = COR_CONTORNO;
      ctx.strokeText('NEVE MALUCA', 0, 0);

      // Gradiente de preenchimento
      const textoGrad = ctx.createLinearGradient(0, -50, 0, 50);
      textoGrad.addColorStop(0, '#ffffff');
      textoGrad.addColorStop(0.5, '#eaf5ff');
      textoGrad.addColorStop(1, '#9cd5ff');
      ctx.fillStyle = textoGrad;
      ctx.fillText('NEVE MALUCA', 0, 0);

      ctx.restore();

      // Indicador interativo
      if (t > 15) {
        const opac = 0.55 + 0.45 * seno((t * 4) % 360);
        ctx.save();
        ctx.globalAlpha = Math.max(0.2, Math.min(1, opac));
        ctx.textAlign = 'center';
        ctx.font = '700 22px Barlow, sans-serif';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 5;
        ctx.strokeStyle = COR_CONTORNO;
        ctx.strokeText('toque ou aperte ESPAÇO para entrar', LARGURA / 2, ALTURA * 0.72);
        ctx.fillStyle = '#f4f9ff';
        ctx.fillText('toque ou aperte ESPAÇO para entrar', LARGURA / 2, ALTURA * 0.72);
        ctx.restore();
      }

      // Transição suave (fade out)
      if (saindo) {
        const opacidade = Math.min(1, fadeTick / TICKS_FADE);
        ctx.fillStyle = `rgba(11, 26, 51, ${opacidade})`;
        ctx.fillRect(0, 0, LARGURA, ALTURA);
      }
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
