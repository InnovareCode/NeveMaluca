/**
 * Cena de Abertura (Splash) do Neve Maluca.
 *
 * Requisitos atendidos:
 *  1. Logo animado NEVE MALUCA sobre a CAPA oficial (`capa.webp` + `logo.webp`, os mesmos do menu via `menu-capa.ts`),
 *     com entrada e flutuação senoidal suave (`core/trig`). Enquanto a capa não decodifica: só fundo liso + neve
 *     (nunca cenário vetorial — pedido do dono: tudo no padrão Pixar).
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
import { assetsMenuCapaProntos, precarregarAssetsMenuCapa } from './menu-capa';

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

const COR_CEU_TOPO = '#0b1a33';
const COR_CEU_BASE = '#1f3f86';
const COR_CONTORNO = '#0b1a33';
/** Logo centralizado na abertura: ~58% da largura (818x433 de origem: razão 1,889). */
const LOGO_W = LARGURA * 0.58;
const LOGO_H = LOGO_W / 1.889;

/** Fundo de espera (só os quadros antes de `capa.webp` decodificar): gradiente liso, sem fingir cenário. */
function pintarCenarioFixo(ctx: Ctx): void {
  const grad = ctx.createLinearGradient(0, 0, 0, ALTURA);
  grad.addColorStop(0, COR_CEU_TOPO);
  grad.addColorStop(1, COR_CEU_BASE);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, LARGURA, ALTURA);
}

/** Capa cobrindo os 960x540 lógicos (sem distorcer), escurecida pra o logo e o convite saltarem. */
function desenharCapa(ctx: Ctx, img: HTMLImageElement): void {
  const escala = Math.max(LARGURA / img.naturalWidth, ALTURA / img.naturalHeight);
  const w = img.naturalWidth * escala;
  const h = img.naturalHeight * escala;
  ctx.drawImage(img, (LARGURA - w) / 2, (ALTURA - h) / 2, w, h);
  ctx.fillStyle = 'rgba(11, 26, 51, 0.45)';
  ctx.fillRect(0, 0, LARGURA, ALTURA);
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
  // Mesma capa do menu: começa a carregar já na abertura, então o menu abre sem espera.
  void precarregarAssetsMenuCapa();

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
      const assets = assetsMenuCapaProntos();
      if (assets) {
        desenharCapa(ctx, assets.capa);
      } else {
        if (!cenario && doc) {
          cenario = criarCamadaEstatica(doc, pintarCenarioFixo);
        }
        if (cenario) {
          cenario.desenhar(ctx);
        } else {
          pintarCenarioFixo(ctx);
        }
      }

      const t = ticks + alpha;

      // Partículas de neve caindo
      desenharFlocos(ctx, 35, t);

      // Logo animado (a arte oficial; sem ela ainda, nada de título improvisado)
      if (assets) {
        const progressoEntrada = Math.min(1, t / 25);
        const oscilacao = seno((t * 3.6) % 360) * 5;
        const escalaLogo = (0.78 + 0.22 * progressoEntrada) * (1 + 0.02 * seno((t * 2.4) % 360));

        ctx.save();
        ctx.translate(LARGURA / 2, ALTURA * 0.42 + oscilacao);
        ctx.scale(escalaLogo, escalaLogo);
        ctx.drawImage(assets.logo, -LOGO_W / 2, -LOGO_H / 2, LOGO_W, LOGO_H);
        ctx.restore();
      }

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
        ctx.strokeText('toque ou aperte ESPAÇO para entrar', LARGURA / 2, ALTURA * 0.8);
        ctx.fillStyle = '#f4f9ff';
        ctx.fillText('toque ou aperte ESPAÇO para entrar', LARGURA / 2, ALTURA * 0.8);
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
