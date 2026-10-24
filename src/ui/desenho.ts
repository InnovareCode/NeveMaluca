/**
 * Primitivas de desenho da UI em Canvas 2D (coordenadas lógicas 960x540).
 *
 * São PEÇAS PEQUENAS e reutilizáveis de propósito: nada aqui sabe de cena, de jogo ou de evento. As telas
 * (abertura, menu, opções) só compõem estas funções.
 *
 * Duas lições do projeto que já vêm embutidas aqui:
 *  - **`roundRect` não é usado**: `CanvasRenderingContext2D.roundRect` só existe em navegadores recentes
 *    (Chrome 99+, Safari 16.4+) e o aparelho principal é o iPhone com WebKit. O caminho equivalente com
 *    `arcTo` funciona em qualquer motor e custa o mesmo.
 *  - **fundo estático vai para uma camada**: o `cenas/boot.ts` mediu ~65 ms por quadro ao redesenhar
 *    degradê + texto grande todo quadro num canvas por software. `criarCamadaEstatica` desenha o cenário
 *    UMA vez num canvas fora da tela e devolve um `desenhar` que é só um `drawImage`.
 */
import { ALTURA_BUFFER, LARGURA_BUFFER, RS } from '../platform/constantes';
import type { Ctx } from '../platform/canvas';

export interface Retangulo {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Caminho de um retângulo de cantos arredondados (substitui `ctx.roundRect`, que falta em WebKit antigo). */
export function caminhoArredondado(ctx: Ctx, r: Retangulo, raio: number): void {
  const raioMax = Math.max(0, Math.min(raio, r.w / 2, r.h / 2));
  const { x, y, w, h } = r;
  ctx.beginPath();
  ctx.moveTo(x + raioMax, y);
  ctx.lineTo(x + w - raioMax, y);
  ctx.arcTo(x + w, y, x + w, y + raioMax, raioMax);
  ctx.lineTo(x + w, y + h - raioMax);
  ctx.arcTo(x + w, y + h, x + w - raioMax, y + h, raioMax);
  ctx.lineTo(x + raioMax, y + h);
  ctx.arcTo(x, y + h, x, y + h - raioMax, raioMax);
  ctx.lineTo(x, y + raioMax);
  ctx.arcTo(x, y, x + raioMax, y, raioMax);
  ctx.closePath();
}

export interface RetratoDeBotao {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly texto: string;
  /** Cor do gradiente no topo. */
  readonly corTopo: string;
  /** Cor do gradiente na base. */
  readonly corBase: string;
  /** Desenha o contorno e o texto com o dobro de destaque (botão principal). */
  readonly destaque?: boolean | undefined;
  readonly aoVivo?: boolean | undefined;
}

/** Botão padrão: sombra, gradiente, borda e texto com contorno (legível sobre céu ou neve). */
export function desenharBotao(ctx: Ctx, b: RetratoDeBotao): void {
  const raio = 12;
  ctx.save();

  // Sombra: dá profundidade sem filtro (filter é lento em canvas por software)
  ctx.fillStyle = 'rgba(11, 26, 51, 0.38)';
  caminhoArredondado(ctx, { x: b.x + 3, y: b.y + 5, w: b.w, h: b.h }, raio);
  ctx.fill();

  const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  grad.addColorStop(0, b.corTopo);
  grad.addColorStop(1, b.corBase);
  ctx.fillStyle = grad;
  caminhoArredondado(ctx, b, raio);
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = b.aoVivo ? '#ffffff' : '#0b1a33';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.font = b.destaque ? 'italic 800 28px "Barlow Condensed", Impact, sans-serif' : 'italic 800 25px "Barlow Condensed", Impact, sans-serif';

  ctx.lineWidth = 5;
  ctx.strokeStyle = '#0b1a33';
  ctx.strokeText(b.texto, b.x + b.w / 2, b.y + b.h / 2);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(b.texto, b.x + b.w / 2, b.y + b.h / 2);

  ctx.restore();
}

export interface RetratoDeBotaoBala extends RetratoDeBotao {
  /** Etiqueta pequena no canto (ex. "EM BREVE"); omitir quando não precisar. */
  readonly etiqueta?: string | undefined;
}

/**
 * Botão "bala"/pill (plano "corrida em campeonato" §C8a, key art): mesma receita de `desenharBotao` (sombra,
 * gradiente, contorno, texto com contorno), só com o raio = metade da altura (cápsula) e um brilho vítreo na
 * metade de cima -- sem `shadowBlur`/`filter` (caro em canvas por software, mesma regra do README de `render/`).
 */
export function desenharBotaoBala(ctx: Ctx, b: RetratoDeBotaoBala): void {
  const raio = b.h / 2;
  ctx.save();

  ctx.fillStyle = 'rgba(11, 26, 51, 0.38)';
  caminhoArredondado(ctx, { x: b.x + 3, y: b.y + 5, w: b.w, h: b.h }, raio);
  ctx.fill();

  const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  grad.addColorStop(0, b.corTopo);
  grad.addColorStop(1, b.corBase);
  ctx.fillStyle = grad;
  caminhoArredondado(ctx, b, raio);
  ctx.fill();

  ctx.save();
  caminhoArredondado(ctx, b, raio);
  ctx.clip();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.beginPath();
  ctx.ellipse(b.x + b.w / 2, b.y + b.h * 0.18, b.w * 0.46, b.h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.lineWidth = 3;
  ctx.strokeStyle = b.aoVivo ? '#ffffff' : '#0b1a33';
  caminhoArredondado(ctx, b, raio);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.font = b.destaque ? 'italic 900 26px "Barlow Condensed", Impact, sans-serif' : 'italic 800 22px "Barlow Condensed", Impact, sans-serif';

  ctx.lineWidth = 5;
  ctx.strokeStyle = '#0b1a33';
  ctx.strokeText(b.texto, b.x + b.w / 2, b.y + b.h / 2);

  ctx.fillStyle = '#ffffff';
  ctx.fillText(b.texto, b.x + b.w / 2, b.y + b.h / 2);

  if (b.etiqueta) {
    ctx.save();
    ctx.translate(b.x + b.w - 8, b.y - 2);
    ctx.rotate((-8 * Math.PI) / 180);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '800 11px Barlow, sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0b1a33';
    ctx.strokeText(b.etiqueta, 0, 0);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(b.etiqueta, 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

export interface OpcoesDeTexto {
  readonly fonte?: string | undefined;
  readonly cor?: string | undefined;
  /** Espessura do contorno; 0 = sem contorno. */
  readonly contorno?: number | undefined;
  readonly corContorno?: string | undefined;
  readonly alinhamento?: CanvasTextAlign | undefined;
  readonly base?: CanvasTextBaseline | undefined;
}

/** Texto com contorno opcional: legível sobre qualquer fundo (céu, neve, painel escuro). */
export function desenharTexto(ctx: Ctx, texto: string, x: number, y: number, opcoes: OpcoesDeTexto = {}): void {
  ctx.save();
  ctx.textAlign = opcoes.alinhamento ?? 'left';
  ctx.textBaseline = opcoes.base ?? 'alphabetic';
  ctx.font = opcoes.fonte ?? '600 20px Barlow, sans-serif';
  if ((opcoes.contorno ?? 0) > 0) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = opcoes.contorno ?? 0;
    ctx.strokeStyle = opcoes.corContorno ?? '#0b1a33';
    ctx.strokeText(texto, x, y);
  }
  ctx.fillStyle = opcoes.cor ?? '#f4f9ff';
  ctx.fillText(texto, x, y);
  ctx.restore();
}

export interface CamadaEstatica {
  /** Desenha o cenário (já desenhado uma vez) em 0,0. */
  desenhar(ctx: Ctx): void;
}

/**
 * Desenha o cenário UMA vez num canvas fora da tela e devolve um `desenhar` que é só um `drawImage`.
 * `pintar` recebe o contexto JÁ no espaço lógico (RS aplicado), então pode usar 960x540 diretamente.
 */
export function criarCamadaEstatica(doc: Document, pintar: (ctx: Ctx) => void): CamadaEstatica {
  const camada = doc.createElement('canvas');
  camada.width = LARGURA_BUFFER;
  camada.height = ALTURA_BUFFER;
  const ctxCamada = camada.getContext('2d', { alpha: false });
  if (!ctxCamada) throw new Error('Canvas 2D indisponível neste navegador');
  ctxCamada.setTransform(RS, 0, 0, RS, 0, 0);
  pintar(ctxCamada);
  return {
    desenhar(ctx: Ctx) {
      ctx.drawImage(camada, 0, 0, 960, 540);
    },
  };
}

/** Camada transparente (alpha: true): para cenários que precisam deixar o céu aparecer atrás. */
export function criarCamadaTransparente(doc: Document, pintar: (ctx: Ctx) => void): CamadaEstatica {
  const camada = doc.createElement('canvas');
  camada.width = LARGURA_BUFFER;
  camada.height = ALTURA_BUFFER;
  const ctxCamada = camada.getContext('2d');
  if (!ctxCamada) throw new Error('Canvas 2D indisponível neste navegador');
  ctxCamada.setTransform(RS, 0, 0, RS, 0, 0);
  pintar(ctxCamada);
  return {
    desenhar(ctx: Ctx) {
      ctx.drawImage(camada, 0, 0, 960, 540);
    },
  };
}

/**
 * Flocos de neve determinísticos (sem `Math.random`, proibido em `src/`): a posição de cada floco é função do
 * índice e do tempo em ticks. Um único `beginPath`/`fill` para todos — o número de chamadas de desenho é o que
 * pesa num canvas por software.
 */
export function desenharFlocos(ctx: Ctx, quantidade: number, tempo: number, tamanho = 1): void {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < quantidade; i += 1) {
    const velX = 0.22 + (i % 4) * 0.13;
    const velY = 0.7 + (i % 5) * 0.22;
    const x = (((i * 941) % 960) + velX * tempo) % 960;
    const y = (((i * 431) % 540) + velY * tempo) % 540;
    const r = (1.4 + (i % 3) * 0.9) * tamanho;
    ctx.moveTo(x + r, y);
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.restore();
}