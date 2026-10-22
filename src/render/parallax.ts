/**
 * Cenário procedural em camadas (parallax, plano §3.1/§7 M1a): céu em degradê + 3 camadas de montanhas (cada uma
 * desenhada UMA vez numa camada fora da tela — lição do boot.ts do M0: redesenhar degradê/formas todo quadro
 * custava ~65 ms por quadro num canvas por software) + neve caindo (determinística, mesma técnica do boot.ts:
 * posição = função do índice e do tempo, SEM `Math.random`, que é proibido em toda `src/`).
 *
 * `criarRng` (não `Math.random`) gera o perfil das montanhas: é visual, então usa o canal `visual` do RNG
 * (plano §3.3), nunca o da lógica.
 */
import { ALTURA, LARGURA } from '../core/constantes';
import { criarRng, type Rng } from '../core/rng';

export interface CamadaMontanha {
  readonly fatorParallax: number;
  readonly cor: string;
  readonly alturaBaseFrac: number;
}

export const CAMADAS_MONTANHA: readonly CamadaMontanha[] = [
  { fatorParallax: 0.04, cor: '#8fb6e0', alturaBaseFrac: 0.42 },
  { fatorParallax: 0.1, cor: '#6f9fd6', alturaBaseFrac: 0.52 },
  { fatorParallax: 0.2, cor: '#4f7fb8', alturaBaseFrac: 0.64 },
];

const FLOCOS_FUNDO = 40;
const SEMENTE_VISUAL_FUNDO = 20261022;

function desenharSilhueta(ctx: CanvasRenderingContext2D, cor: string, alturaBaseFrac: number, rng: Rng): void {
  ctx.fillStyle = cor;
  ctx.beginPath();
  ctx.moveTo(0, ALTURA);
  const baseY = ALTURA * alturaBaseFrac;
  let x = 0;
  let yAnterior = baseY;
  while (x <= LARGURA) {
    ctx.lineTo(x, yAnterior);
    x += 50 + rng.inteiro(70);
    yAnterior = baseY - rng.entre(0, ALTURA * 0.16);
  }
  ctx.lineTo(LARGURA, baseY);
  ctx.lineTo(LARGURA, ALTURA);
  ctx.closePath();
  ctx.fill();
}

export interface Parallax {
  /** `cameraXm` = posição horizontal da câmera no mundo (metros); `tempoTicks` = ticks + alpha, para a neve cair. */
  desenhar(ctx: CanvasRenderingContext2D, cameraXm: number, tempoTicks: number): void;
}

export function criarParallax(doc: Document = document): Parallax {
  const rng = criarRng(SEMENTE_VISUAL_FUNDO);
  const camadas = CAMADAS_MONTANHA.map((c) => {
    const tile = doc.createElement('canvas');
    tile.width = LARGURA;
    tile.height = ALTURA;
    const ctxTile = tile.getContext('2d');
    if (!ctxTile) throw new Error('Canvas 2D indisponível neste navegador');
    desenharSilhueta(ctxTile, c.cor, c.alturaBaseFrac, rng);
    return { ...c, tile };
  });

  return {
    desenhar(ctx, cameraXm, tempoTicks) {
      const ceu = ctx.createLinearGradient(0, 0, 0, ALTURA);
      ceu.addColorStop(0, '#1f6fd0');
      ceu.addColorStop(1, '#bfe0f7');
      ctx.fillStyle = ceu;
      ctx.fillRect(0, 0, LARGURA, ALTURA);

      for (const camada of camadas) {
        const deslocPx = (((cameraXm * camada.fatorParallax * 8) % LARGURA) + LARGURA) % LARGURA;
        ctx.drawImage(camada.tile, -deslocPx, 0, LARGURA, ALTURA);
        ctx.drawImage(camada.tile, LARGURA - deslocPx, 0, LARGURA, ALTURA);
      }

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      for (let i = 0; i < FLOCOS_FUNDO; i += 1) {
        const xBruto = ((i * 977) % LARGURA) + (0.18 + (i % 4) * 0.07) * tempoTicks - cameraXm * 0.3;
        const x = ((xBruto % LARGURA) + LARGURA) % LARGURA;
        const y = (((i * 613) % ALTURA) + (0.35 + (i % 5) * 0.14) * tempoTicks) % ALTURA;
        const raio = 1.4 + (i % 3) * 0.6;
        ctx.moveTo(x + raio, y);
        ctx.arc(x, y, raio, 0, Math.PI * 2);
      }
      ctx.fill();
    },
  };
}
