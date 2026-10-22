import { ALTURA, ALTURA_BUFFER, LARGURA, LARGURA_BUFFER, RS } from '../../platform/constantes';
import type { Ctx } from '../../platform/canvas';
import type { Cena } from '../tipos';

/**
 * Cena vazia de boot (M0): degradê de céu, ladeira de neve, flocos e o título PROVISÓRIO (sem logo ainda). Existe para provar a
 * plataforma (escala, laço, fontes) num aparelho de verdade. Não tem entrada nem lógica de jogo.
 *
 * Desempenho (medido, ferramentas/medir/fps.mjs): degradê + `strokeText` de 132 px redesenhados todo quadro custavam ~65 ms por
 * quadro num canvas por software; o fundo e o título são desenhados UMA vez numa camada 1920x1080 e cada quadro faz um `drawImage`
 * mais os flocos (um único caminho). A camada nasce no primeiro desenho (já com as fontes carregadas).
 */

export const TITULO_PROVISORIO = 'NEVE MALUCA';
export const SUBTITULO_PROVISORIO = 'em construção';

const COR_CEU_TOPO = '#2a7de1';
const COR_CEU_BASE = '#bfe4ff';
const COR_NEVE = '#f4f9ff';
const COR_TINTA = '#0b1a33';

/** Flocos determinísticos (sem sorteio): posição = função do índice e do tempo em ticks. */
const FLOCOS = 28;
const LADEIRA = { esquerdaY: ALTURA * 0.8, direitaY: ALTURA * 0.62 };

export interface OpcoesBoot {
  /** "6c4d09e+ · 22/10 12:30": prova na tela qual build está rodando. */
  readonly rotuloDaVersao: string;
}

/** Desenha o que não se mexe (céu, ladeira, título, subtítulo e versão) em coordenadas lógicas 960x540. */
function desenharFundo(ctx: Ctx, rotuloDaVersao: string): void {
  const ceu = ctx.createLinearGradient(0, 0, 0, ALTURA);
  ceu.addColorStop(0, COR_CEU_TOPO);
  ceu.addColorStop(1, COR_CEU_BASE);
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  ctx.fillStyle = COR_NEVE;
  ctx.beginPath();
  ctx.moveTo(0, LADEIRA.esquerdaY);
  ctx.lineTo(LARGURA, LADEIRA.direitaY);
  ctx.lineTo(LARGURA, ALTURA);
  ctx.lineTo(0, ALTURA);
  ctx.closePath();
  ctx.fill();

  // título provisório: contorno marinho + miolo neve (legível sobre qualquer trecho do céu)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.font = 'italic 800 132px "Barlow Condensed", Impact, sans-serif';
  ctx.lineWidth = 12;
  ctx.strokeStyle = COR_TINTA;
  ctx.strokeText(TITULO_PROVISORIO, LARGURA / 2, 250);
  ctx.fillStyle = COR_NEVE;
  ctx.fillText(TITULO_PROVISORIO, LARGURA / 2, 250);

  ctx.fillStyle = COR_TINTA;
  ctx.font = '600 30px Barlow, sans-serif';
  ctx.fillText(SUBTITULO_PROVISORIO, LARGURA / 2, 300);

  // versão do build, sobre a neve (contraste marinho/neve ~17:1)
  ctx.textAlign = 'left';
  ctx.font = '600 16px Barlow, sans-serif';
  ctx.fillText(rotuloDaVersao, 16, ALTURA - 14);
}

export function criarCenaBoot(opcoes: OpcoesBoot): Cena {
  let ticks = 0;
  let camada: HTMLCanvasElement | null = null;

  return {
    id: 'boot',
    atualizar() {
      ticks += 1;
    },
    desenhar(ctx: Ctx, alpha: number) {
      if (!camada) {
        camada = ctx.canvas.ownerDocument.createElement('canvas');
        camada.width = LARGURA_BUFFER;
        camada.height = ALTURA_BUFFER;
        const c = camada.getContext('2d', { alpha: false });
        if (!c) throw new Error('Canvas 2D indisponível neste navegador');
        c.setTransform(RS, 0, 0, RS, 0, 0);
        desenharFundo(c, opcoes.rotuloDaVersao);
      }
      ctx.drawImage(camada, 0, 0, LARGURA, ALTURA);

      // flocos, por cima de tudo (um único caminho, um único fill)
      const t = ticks + alpha;
      ctx.fillStyle = COR_NEVE;
      ctx.beginPath();
      for (let i = 0; i < FLOCOS; i += 1) {
        const x = (((i * 977) % LARGURA) + (0.3 + (i % 3) * 0.1) * t) % LARGURA;
        const y = (((i * 313) % ALTURA) + (0.6 + (i % 5) * 0.25) * t) % ALTURA;
        const raio = 2 + (i % 3);
        ctx.moveTo(x + raio, y);
        ctx.arc(x, y, raio, 0, Math.PI * 2);
      }
      ctx.fill();
    },
  };
}
