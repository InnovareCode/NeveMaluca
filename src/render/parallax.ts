/**
 * Cenário procedural em camadas estilo animação 3D / Pixar da Fase 2 para o Morro do Pinhão
 * conforme docs/direcao-arte-neve-maluca.md §2.1 e §2.2:
 *
 * 1. Céu em degradê quente/frio (#4FA8F0 -> #BFE6FF) com iluminação sutil vinda do alto à esquerda.
 * 2. Montanhas distantes com facetas de luz à esquerda (#D2E4F7) e corpo em sombra (#A9C7E6).
 * 3. Montanhas médias com facetas de luz à esquerda (#9EBFE3) e corpo em sombra (#7FA3C9).
 * 4. Camada de floresta regional: araucárias em taça e pinheiros com capuz de neve (#2E6B3A + #F7FBFF),
 *    e o celeiro alpino vermelho (#B83A2B) ao longe.
 * 5. Flocos de neve em camadas de profundidade.
 *
 * Performance 60fps garantida:
 * - Todas as camadas de relevo/floresta são pré-renderizadas em offscreen canvas uma única vez no boot.
 * - Durante a descida, cada quadro executa apenas 2 drawImage() por camada para o tiling contínuo.
 * - Zero Math.random em runtime (usa Rng determinístico com semente no canal visual).
 */
import { ALTURA, LARGURA } from '../core/constantes';
import { criarRng, type Rng } from '../core/rng';
import { desenharFlocosProfundidadeFundo } from './particulas';

// Tokens oficiais de cores para o Morro do Pinhão (§2.1):
export const COR_CEU_TOPO = '#4FA8F0';
export const COR_CEU_HORIZONTE = '#BFE6FF';

export const COR_MONTANHA_DISTANTE_SOMBRA = '#A9C7E6';
export const COR_MONTANHA_DISTANTE_LUZ = '#D2E4F7';
export const COR_MONTANHA_DISTANTE_NEVE = '#F7FBFF';

export const COR_MONTANHA_MEDIA_SOMBRA = '#7FA3C9';
export const COR_MONTANHA_MEDIA_LUZ = '#9EBFE3';
export const COR_MONTANHA_MEDIA_NEVE = '#EAF2FA';

export const COR_FLORESTA_BASE = '#5C82A6';
export const COR_FOLHAGEM_PINHEIRO = '#2E6B3A';
export const COR_NEVE_CAPUZ = '#F7FBFF';
export const COR_TRONCO_MADEIRA = '#4A2E1B';
export const COR_CELEIRO_VERMELHO = '#B83A2B';
export const COR_CELEIRO_DETALHE = '#6E1F16';

export interface CamadaParallax {
  readonly fatorParallax: number;
  readonly tile: HTMLCanvasElement;
}

export interface Parallax {
  /** `cameraXm` = posição horizontal da câmera no mundo (metros); `tempoTicks` = ticks + alpha. */
  desenhar(ctx: CanvasRenderingContext2D, cameraXm: number, tempoTicks: number): void;
}

const SEMENTE_VISUAL_PARALLAX = 20261022;

/**
 * Desenha a camada de montanhas distantes com facetas 3D estilo Pixar:
 * Iluminação direcional vinda do alto à esquerda (luz à esquerda, sombra à direita, cume de neve).
 */
function desenharMontanhasDistantes(ctx: CanvasRenderingContext2D, rng: Rng): void {
  const baseY = ALTURA * 0.32;
  ctx.fillStyle = COR_MONTANHA_DISTANTE_SOMBRA;

  // Picos triangulares contínuos (com wrapping contínuo no final)
  const picos: { x: number; y: number }[] = [
    { x: 0, y: baseY - 35 },
    { x: 120, y: baseY - 80 },
    { x: 250, y: baseY - 50 },
    { x: 390, y: baseY - 95 },
    { x: 530, y: baseY - 45 },
    { x: 670, y: baseY - 85 },
    { x: 810, y: baseY - 60 },
    { x: LARGURA, y: baseY - 35 }, // mesmo y do x=0 para encaixe perfeito
  ];

  // Base geral preenchida até o fundo
  ctx.beginPath();
  ctx.moveTo(0, ALTURA);
  ctx.lineTo(0, picos[0]!.y);
  for (let i = 1; i < picos.length; i += 1) {
    ctx.lineTo(picos[i]!.x, picos[i]!.y);
  }
  ctx.lineTo(LARGURA, ALTURA);
  ctx.closePath();
  ctx.fillStyle = COR_MONTANHA_DISTANTE_SOMBRA;
  ctx.fill();

  // Facetas iluminadas do lado esquerdo de cada pico
  for (let i = 1; i < picos.length; i += 1) {
    const pAnterior = picos[i - 1]!;
    const pAtual = picos[i]!;
    const cume = pAtual.y < pAnterior.y ? pAtual : pAnterior;
    const vale = pAtual.y < pAnterior.y ? pAnterior : pAtual;

    if (pAtual.y < pAnterior.y) {
      // Encosta subindo para a direita (face voltada para a esquerda -> pega luz do sol)
      ctx.beginPath();
      ctx.moveTo(vale.x, vale.y);
      ctx.lineTo(cume.x, cume.y);
      ctx.lineTo(cume.x, baseY + 40);
      ctx.lineTo(vale.x, baseY + 40);
      ctx.closePath();
      ctx.fillStyle = COR_MONTANHA_DISTANTE_LUZ;
      ctx.fill();
    }

    // Capuz de neve no cume
    const raioNeve = 16 + rng.inteiro(6);
    ctx.beginPath();
    ctx.moveTo(cume.x - raioNeve, cume.y + raioNeve * 0.7);
    ctx.lineTo(cume.x, cume.y);
    ctx.lineTo(cume.x + raioNeve * 0.9, cume.y + raioNeve * 0.9);
    ctx.lineTo(cume.x, cume.y + raioNeve * 0.4);
    ctx.closePath();
    ctx.fillStyle = COR_MONTANHA_DISTANTE_NEVE;
    ctx.fill();
  }
}

/**
 * Desenha a camada de montanhas médias com relevo mais detalhado e facetas recortadas.
 */
function desenharMontanhasMedias(ctx: CanvasRenderingContext2D, _rng: Rng): void {
  const baseY = ALTURA * 0.42;

  const pontos: { x: number; y: number }[] = [
    { x: 0, y: baseY - 20 },
    { x: 90, y: baseY - 55 },
    { x: 180, y: baseY - 30 },
    { x: 300, y: baseY - 70 },
    { x: 420, y: baseY - 40 },
    { x: 520, y: baseY - 65 },
    { x: 640, y: baseY - 35 },
    { x: 760, y: baseY - 75 },
    { x: 860, y: baseY - 45 },
    { x: LARGURA, y: baseY - 20 },
  ];

  // Base sombreada
  ctx.beginPath();
  ctx.moveTo(0, ALTURA);
  ctx.lineTo(0, pontos[0]!.y);
  for (let i = 1; i < pontos.length; i += 1) {
    ctx.lineTo(pontos[i]!.x, pontos[i]!.y);
  }
  ctx.lineTo(LARGURA, ALTURA);
  ctx.closePath();
  ctx.fillStyle = COR_MONTANHA_MEDIA_SOMBRA;
  ctx.fill();

  // Facetas iluminadas voltadas para o alto à esquerda
  for (let i = 1; i < pontos.length; i += 1) {
    const p0 = pontos[i - 1]!;
    const p1 = pontos[i]!;
    if (p1.y < p0.y) {
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.lineTo(p1.x, baseY + 60);
      ctx.lineTo(p0.x, baseY + 60);
      ctx.closePath();
      ctx.fillStyle = COR_MONTANHA_MEDIA_LUZ;
      ctx.fill();
    }

    // Crista com manto de neve estilizado
    const cume = p1.y < p0.y ? p1 : p0;
    ctx.beginPath();
    ctx.moveTo(cume.x - 14, cume.y + 10);
    ctx.lineTo(cume.x, cume.y);
    ctx.lineTo(cume.x + 12, cume.y + 12);
    ctx.lineTo(cume.x, cume.y + 5);
    ctx.closePath();
    ctx.fillStyle = COR_MONTANHA_MEDIA_NEVE;
    ctx.fill();
  }
}

/**
 * Desenha um pinheiro cônico estilizado com capuz de neve nos andares.
 */
function desenharPinheiro(ctx: CanvasRenderingContext2D, x: number, basePéY: number, alturaPx: number): void {
  const larguraPx = alturaPx * 0.55;
  // Tronco
  ctx.fillStyle = COR_TRONCO_MADEIRA;
  ctx.fillRect(x - 2, basePéY - alturaPx * 0.2, 4, alturaPx * 0.2);

  // 3 andares triangulares de folhagem verde com capuz de neve no topo
  const andares = 3;
  for (let a = 0; a < andares; a += 1) {
    const fracY = a / andares;
    const yAndar = basePéY - alturaPx * 0.2 - fracY * (alturaPx * 0.7);
    const hAndar = (alturaPx * 0.4) * (1 - fracY * 0.25);
    const wAndar = larguraPx * (1 - fracY * 0.3);

    // Folhagem verde
    ctx.beginPath();
    ctx.moveTo(x - wAndar / 2, yAndar);
    ctx.lineTo(x, yAndar - hAndar);
    ctx.lineTo(x + wAndar / 2, yAndar);
    ctx.closePath();
    ctx.fillStyle = COR_FOLHAGEM_PINHEIRO;
    ctx.fill();

    // Capuz de neve fofa sobre a crista do andar
    ctx.beginPath();
    ctx.moveTo(x - wAndar * 0.4, yAndar - hAndar * 0.3);
    ctx.lineTo(x, yAndar - hAndar);
    ctx.lineTo(x + wAndar * 0.35, yAndar - hAndar * 0.35);
    ctx.lineTo(x, yAndar - hAndar * 0.6);
    ctx.closePath();
    ctx.fillStyle = COR_NEVE_CAPUZ;
    ctx.fill();
  }
}

/**
 * Desenha uma Araucária (pinheiro-do-paraná típico da serra gaúcha/catarinense do Morro do Pinhão):
 * Tronco marrom longo que abre galhos em candelabro/taça, com tufos arredondados de folhagem e capuz de neve.
 */
function desenharAraucaria(ctx: CanvasRenderingContext2D, x: number, basePéY: number, alturaPx: number): void {
  const topoTroncoY = basePéY - alturaPx * 0.72;

  // Tronco principal esguio
  ctx.fillStyle = COR_TRONCO_MADEIRA;
  ctx.beginPath();
  ctx.moveTo(x - 2.5, basePéY);
  ctx.lineTo(x - 1.5, topoTroncoY);
  ctx.lineTo(x + 1.5, topoTroncoY);
  ctx.lineTo(x + 2.5, basePéY);
  ctx.closePath();
  ctx.fill();

  // Galhos arqueados para cima em formato de candelabro/taça
  const raiosGalhos = [-26, -15, 0, 15, 26];
  const alturasTufo = [-12, -22, -28, -22, -12];

  ctx.strokeStyle = COR_TRONCO_MADEIRA;
  ctx.lineWidth = 2;
  for (let i = 0; i < raiosGalhos.length; i += 1) {
    const gx = x + raiosGalhos[i]!;
    const gy = topoTroncoY + alturasTufo[i]!;
    ctx.beginPath();
    ctx.moveTo(x, topoTroncoY);
    ctx.quadraticCurveTo(x + raiosGalhos[i]! * 0.5, topoTroncoY + 4, gx, gy);
    ctx.stroke();

    // Tufo de folhagem arredondada no topo do galho
    const raioTufo = 8.5;
    ctx.beginPath();
    ctx.arc(gx, gy, raioTufo, 0, Math.PI * 2);
    ctx.fillStyle = COR_FOLHAGEM_PINHEIRO;
    ctx.fill();

    // Capuz de neve branca fofa em formato de calota sobre o tufo
    ctx.beginPath();
    ctx.arc(gx, gy - 2, raioTufo * 0.85, Math.PI, 0, false);
    ctx.closePath();
    ctx.fillStyle = COR_NEVE_CAPUZ;
    ctx.fill();
  }
}

/**
 * Desenha o celeiro alpino vermelho ao longe (§2.1 e §2.2):
 * Paredes em vermelho-tijolo (#B83A2B), vigas cruzadas e telhado com grossa camada de neve.
 */
function desenharCeleiroAlpino(ctx: CanvasRenderingContext2D, x: number, basePéY: number): void {
  const w = 42;
  const h = 26;
  const telhadoH = 18;

  // Corpo de madeira vermelha do celeiro
  ctx.fillStyle = COR_CELEIRO_VERMELHO;
  ctx.fillRect(x - w / 2, basePéY - h, w, h);

  // Vigas e acabamento da porta alpina
  ctx.strokeStyle = COR_CELEIRO_DETALHE;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - w / 2, basePéY - h, w, h);

  // Portão de madeira com cruz em 'X'
  const portaW = 14;
  const portaH = 17;
  const portaX = x - portaW / 2;
  const portaY = basePéY - portaH;
  ctx.fillStyle = COR_CELEIRO_DETALHE;
  ctx.fillRect(portaX, portaY, portaW, portaH);
  ctx.strokeStyle = '#F2E3C2';
  ctx.beginPath();
  ctx.moveTo(portaX, portaY);
  ctx.lineTo(portaX + portaW, portaY + portaH);
  ctx.moveTo(portaX + portaW, portaY);
  ctx.lineTo(portaX, portaY + portaH);
  ctx.stroke();

  // Janelinha do sótão
  ctx.fillStyle = '#FFEAA7';
  ctx.fillRect(x - 4, basePéY - h + 3, 8, 7);

  // Telhado inclinado de duas águas
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 5, basePéY - h);
  ctx.lineTo(x, basePéY - h - telhadoH);
  ctx.lineTo(x + w / 2 + 5, basePéY - h);
  ctx.closePath();
  ctx.fillStyle = '#6E1F16';
  ctx.fill();

  // Capuz espesso de neve fofa sobre o telhado
  const neveEspessura = 6.5;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 7, basePéY - h + 1);
  ctx.lineTo(x, basePéY - h - telhadoH - neveEspessura * 0.4);
  ctx.lineTo(x + w / 2 + 7, basePéY - h + 1);
  ctx.lineTo(x + w / 2 + 5, basePéY - h - neveEspessura);
  ctx.lineTo(x, basePéY - h - telhadoH - neveEspessura);
  ctx.lineTo(x - w / 2 - 5, basePéY - h - neveEspessura);
  ctx.closePath();
  ctx.fillStyle = COR_NEVE_CAPUZ;
  ctx.fill();
}

/**
 * Desenha a camada de floresta: colina suave de base com araucárias, pinheiros e celeiro alpino vermelho.
 */
function desenharCamadaFloresta(ctx: CanvasRenderingContext2D, _rng: Rng): void {
  const baseY = ALTURA * 0.52;

  // 1. Colina suave de chão com neve/bosque ao fundo
  ctx.beginPath();
  ctx.moveTo(0, ALTURA);
  ctx.lineTo(0, baseY - 8);
  ctx.quadraticCurveTo(LARGURA * 0.25, baseY - 26, LARGURA * 0.5, baseY - 14);
  ctx.quadraticCurveTo(LARGURA * 0.75, baseY, LARGURA, baseY - 8);
  ctx.lineTo(LARGURA, ALTURA);
  ctx.closePath();
  ctx.fillStyle = COR_FLORESTA_BASE;
  ctx.fill();

  // 2. Celeiro alpino vermelho (§2.1 / §2.2) posicionado ao longe na encosta da colina
  desenharCeleiroAlpino(ctx, 380, baseY - 14);

  // 3. Araucárias e pinheiros em posições ricas ao longo do tile
  // Araucárias gaúchas em destaque com capuz de neve bem visível
  desenharAraucaria(ctx, 70, baseY - 10, 78);
  desenharAraucaria(ctx, 220, baseY - 18, 84);
  desenharAraucaria(ctx, 510, baseY - 12, 82);
  desenharAraucaria(ctx, 720, baseY - 6, 76);
  desenharAraucaria(ctx, 890, baseY - 10, 80);

  // Pinheiros intercalados com capuz de neve
  desenharPinheiro(ctx, 140, baseY - 14, 56);
  desenharPinheiro(ctx, 175, baseY - 16, 50);
  desenharPinheiro(ctx, 310, baseY - 15, 54);
  desenharPinheiro(ctx, 440, baseY - 14, 58);
  desenharPinheiro(ctx, 620, baseY - 8, 52);
  desenharPinheiro(ctx, 810, baseY - 6, 54);
}

export function criarParallax(doc?: Document): Parallax {
  const documento = doc ?? (typeof document !== 'undefined' ? document : undefined);
  const rng = criarRng(SEMENTE_VISUAL_PARALLAX);

  const criarTile = (
    desenho: (c: CanvasRenderingContext2D, r: Rng) => void,
    fatorParallax: number
  ): CamadaParallax | null => {
    if (!documento) return null;
    const tile = documento.createElement('canvas');
    tile.width = LARGURA;
    tile.height = ALTURA;
    const ctxTile = tile.getContext('2d');
    if (!ctxTile) throw new Error('Canvas 2D indisponível neste navegador');
    desenho(ctxTile, rng);
    return { fatorParallax, tile };
  };

  const camadas: CamadaParallax[] = [];
  if (documento) {
    const cDist = criarTile(desenharMontanhasDistantes, 0.04);
    if (cDist) camadas.push(cDist);
    const cMedia = criarTile(desenharMontanhasMedias, 0.10);
    if (cMedia) camadas.push(cMedia);
    const cFloresta = criarTile(desenharCamadaFloresta, 0.22);
    if (cFloresta) camadas.push(cFloresta);
  }

  return {
    desenhar(ctx, cameraXm, tempoTicks) {
      // 1. Céu em degradê límpido quente/frio (#4FA8F0 -> #BFE6FF) conforme §2.1
      const ceu = ctx.createLinearGradient(0, 0, 0, ALTURA);
      ceu.addColorStop(0, COR_CEU_TOPO);
      ceu.addColorStop(1, COR_CEU_HORIZONTE);
      ctx.fillStyle = ceu;
      ctx.fillRect(0, 0, LARGURA, ALTURA);

      // 2. Luz solar suave no alto à esquerda (consistência com a iluminação 3D das folhas e cristas)
      const brilhoSol = ctx.createRadialGradient(LARGURA * 0.18, ALTURA * 0.12, 10, LARGURA * 0.18, ALTURA * 0.12, 220);
      brilhoSol.addColorStop(0, 'rgba(255, 252, 240, 0.35)');
      brilhoSol.addColorStop(0.5, 'rgba(255, 252, 240, 0.12)');
      brilhoSol.addColorStop(1, 'rgba(255, 252, 240, 0)');
      ctx.fillStyle = brilhoSol;
      ctx.fillRect(0, 0, LARGURA, ALTURA);

      // 3. Camadas de parallax pré-renderizadas
      for (const camada of camadas) {
        const deslocPx = (((cameraXm * camada.fatorParallax * 8) % LARGURA) + LARGURA) % LARGURA;
        ctx.drawImage(camada.tile, -deslocPx, 0, LARGURA, ALTURA);
        ctx.drawImage(camada.tile, LARGURA - deslocPx, 0, LARGURA, ALTURA);
      }

      // 4. Flocos de neve de fundo (profundidade atmosférica)
      desenharFlocosProfundidadeFundo(ctx, cameraXm, tempoTicks);
    },
  };
}
