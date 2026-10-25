/**
 * Tema `bosque` (Morro do Pinhão): a pele visual que estava hardcoded em `render/parallax.ts` e `render/objetos.ts`
 * antes do M3, extraída SEM MUDAR NENHUM PIXEL para o formato `PintorTema` (plano §B.3/§B.6). Prova por pixel:
 * `tests/e2e/_tmp-pixel-check.spec.ts` (temporário, Lyra) comparou o canvas da descida real, tick a tick, antes e
 * depois deste refactor.
 *
 * Cenário estilo animação 3D / Pixar (docs/direcao-arte-neve-maluca.md §2.1 e §2.2):
 * 1. Céu em degradê quente/frio (#4FA8F0 -> #BFE6FF) com iluminação sutil vinda do alto à esquerda.
 * 2. Montanhas distantes com facetas de luz à esquerda (#D2E4F7) e corpo em sombra (#A9C7E6).
 * 3. Montanhas médias com facetas de luz à esquerda (#9EBFE3) e corpo em sombra (#7FA3C9).
 * 4. Camada de floresta regional: araucárias em taça e pinheiros com capuz de neve (#2E6B3A + #F7FBFF),
 *    e o celeiro alpino vermelho (#B83A2B) ao longe.
 *
 * Performance 60fps garantida: as 3 camadas de relevo/floresta são pré-renderizadas em offscreen canvas uma única
 * vez no boot (`construirCamadas`); zero `Math.random` em runtime (usa `Rng` determinístico do canal `visual`).
 */
import { PX_POR_METRO } from '../../core/constantes';
import { criarRng, type Rng } from '../../core/rng';
import type { DefTema, ObjetoPista, PistaGerada, Trilho } from '../../core/contratos';
import type { EstadoCamera } from '../mundo';
import { mundoParaTela, pxPorMetro } from '../mundo';
import { alturaDoTerreno } from '../terreno';
import type { CamadaParallax, Parallax } from '../parallax';
import type { PintorTema } from './tipos';

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

// Tokens de objetos (ex-`render/objetos.ts`):
const COR_NEVE_LUZ_OBJ = '#F7FBFF';
const COR_MADEIRA_ESCURA = '#4A2E1B';
const COR_MADEIRA_CLARA = '#7A4D2E';
const COR_ROCHA_SOMBRA = '#4A5B6C';
const COR_ROCHA_LUZ = '#7B8F9F';
const COR_CONTORNO = '#1B2733';

/** Dado visual do tema (plano §B.3): a tabela §2.1 da direção de arte, sem desenho. */
export const TEMA_BOSQUE: DefTema = {
  id: 'bosque',
  cores: {
    ceu: [COR_CEU_TOPO, COR_CEU_HORIZONTE],
    montanhaDistante: COR_MONTANHA_DISTANTE_SOMBRA,
    montanhaMedia: COR_MONTANHA_MEDIA_SOMBRA,
    silhueta: COR_FLORESTA_BASE,
    neveLuz: COR_NEVE_LUZ_OBJ,
    neveSombra: '#BFD9EE',
    destaque: COR_CELEIRO_VERMELHO,
  },
  clima: 'neve-fofa',
  musica: 'vanerao-morro',
};

const SEMENTE_VISUAL_PARALLAX = 20261022;

/**
 * Desenha a camada de montanhas distantes com facetas 3D estilo Pixar:
 * Iluminação direcional vinda do alto à esquerda (luz à esquerda, sombra à direita, cume de neve).
 */
function desenharMontanhasDistantes(ctx: CanvasRenderingContext2D, rng: Rng, largura: number, altura: number): void {
  const baseY = altura * 0.32;
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
    { x: largura, y: baseY - 35 }, // mesmo y do x=0 para encaixe perfeito
  ];

  // Base geral preenchida até o fundo
  ctx.beginPath();
  ctx.moveTo(0, altura);
  ctx.lineTo(0, picos[0]!.y);
  for (let i = 1; i < picos.length; i += 1) {
    ctx.lineTo(picos[i]!.x, picos[i]!.y);
  }
  ctx.lineTo(largura, altura);
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
function desenharMontanhasMedias(ctx: CanvasRenderingContext2D, _rng: Rng, largura: number, altura: number): void {
  const baseY = altura * 0.42;

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
    { x: largura, y: baseY - 20 },
  ];

  // Base sombreada
  ctx.beginPath();
  ctx.moveTo(0, altura);
  ctx.lineTo(0, pontos[0]!.y);
  for (let i = 1; i < pontos.length; i += 1) {
    ctx.lineTo(pontos[i]!.x, pontos[i]!.y);
  }
  ctx.lineTo(largura, altura);
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
function desenharCamadaFloresta(ctx: CanvasRenderingContext2D, _rng: Rng, largura: number, altura: number): void {
  const baseY = altura * 0.52;

  // 1. Colina suave de chão com neve/bosque ao fundo
  ctx.beginPath();
  ctx.moveTo(0, altura);
  ctx.lineTo(0, baseY - 8);
  ctx.quadraticCurveTo(largura * 0.25, baseY - 26, largura * 0.5, baseY - 14);
  ctx.quadraticCurveTo(largura * 0.75, baseY, largura, baseY - 8);
  ctx.lineTo(largura, altura);
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

/** Desenha uma pedra de montanha com facetas 3D e neve fofa no topo */
function desenharPedra(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  // Corpo sombreado da rocha
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.4, w * 0.48, h * 0.45, 0, 0, Math.PI * 2);
  ctx.fillStyle = COR_ROCHA_SOMBRA;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.stroke();

  // Faceta iluminada à esquerda (luz solar do alto à esquerda)
  ctx.beginPath();
  ctx.ellipse(x - w * 0.15, y - h * 0.48, w * 0.28, h * 0.32, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = COR_ROCHA_LUZ;
  ctx.fill();

  // Capuz de neve acumulada na crista superior da pedra
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.75, w * 0.42, h * 0.2, 0, Math.PI, 0, false);
  ctx.quadraticCurveTo(x + w * 0.2, y - h * 0.65, x, y - h * 0.68);
  ctx.quadraticCurveTo(x - w * 0.2, y - h * 0.65, x - w * 0.42, y - h * 0.75);
  ctx.closePath();
  ctx.fillStyle = COR_NEVE_LUZ_OBJ;
  ctx.fill();
  ctx.strokeStyle = '#D5E6F5';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Desenha um tronco de araucária tombado com corte transversal e anéis de crescimento */
function desenharTronco(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const raioCorte = h * 0.48;
  const topoY = y - h * 0.5;

  // Corpo de casca da tora de madeira
  ctx.fillStyle = COR_MADEIRA_ESCURA;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, topoY - raioCorte, w, raioCorte * 2, 4);
  ctx.fill();
  ctx.strokeStyle = COR_CONTORNO;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Corte lateral iluminado na ponta esquerda com anéis de madeira
  ctx.beginPath();
  ctx.ellipse(x - w / 2 + 5, topoY, 5, raioCorte * 0.9, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#C49A6C';
  ctx.fill();
  ctx.stroke();
  // Miolo/anel de crescimento
  ctx.beginPath();
  ctx.ellipse(x - w / 2 + 5, topoY, 2.5, raioCorte * 0.45, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#8A5D3B';
  ctx.fill();

  // Faixa de neve fofa sobre a tora de madeira
  ctx.fillStyle = COR_NEVE_LUZ_OBJ;
  ctx.beginPath();
  ctx.roundRect(x - w / 2 + 4, topoY - raioCorte - 2, w - 8, 5, 2.5);
  ctx.fill();
}

/** Desenha o "galho" (`CamadaJogo.obstaculosAltos`, C4) -- REDESENHO 2026-10-24 (feedback do dono: "parecia algo
 *  pra pular, a regra é agachar; redesenhe como barra atravessada na altura da cabeça"). Antes: um graveto baixo
 *  nascendo do chão (lia como obstáculo baixo "pra pular"). Agora: uma TRAVESSA horizontal na altura da cabeça do
 *  personagem (`ALTURA_ALVO_M` 2,8 m -- 2 postes fincados na neve sustentam uma tora deitada, com capa de neve em
 *  cima e corte claro numa ponta (mesma linguagem de `desenharTronco`). Geometria pura (postes/barra escalam com
 *  `h`, NUNCA mexe na caixa de colisão real -- física só olha `x`/`largura`, `descida/motor.ts`); a altura VISUAL
 *  é deliberadamente MAIOR que `obj.altura` (1,3 m nominal) pra ficar no nível de cabeça -- ver
 *  `render/camada.ts: FATOR_ALTURA_VISUAL_GALHO`, que amplia o halo de perigo pra acompanhar. */
function desenharGalho(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const alturaBarraCentro = h * 1.7; // ~2,2 m -- altura de cabeça, "duck under"
  const espessura = Math.max(5, h * 0.36);
  const barY = y - alturaBarraCentro;
  const meioLargo = w * 0.95;
  const postW = Math.max(4, w * 0.22);
  const postInnerX = w * 0.6;

  ctx.save();
  ctx.lineJoin = 'round';

  // 2 postes de sustentação, da neve até a travessa.
  for (const sinal of [-1, 1] as const) {
    const px = x + sinal * postInnerX;
    const topoPoste = barY - espessura * 0.4;
    ctx.beginPath();
    ctx.roundRect(px - postW / 2, topoPoste, postW, y - topoPoste, postW * 0.4);
    ctx.fillStyle = COR_MADEIRA_ESCURA;
    ctx.fill();
    ctx.strokeStyle = COR_CONTORNO;
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }

  // Travessa horizontal -- É ELA que o jogador precisa agachar pra passar.
  ctx.save();
  ctx.translate(x, barY);
  ctx.beginPath();
  ctx.roundRect(-meioLargo, -espessura / 2, meioLargo * 2, espessura, espessura * 0.4);
  ctx.fillStyle = COR_MADEIRA_ESCURA;
  ctx.fill();
  ctx.lineWidth = 2.6;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.stroke();

  // Ponta cortada (miolo claro), mesma linguagem de `desenharTronco`.
  ctx.beginPath();
  ctx.ellipse(meioLargo - espessura * 0.4, 0, espessura * 0.34, espessura * 0.48, 0, 0, Math.PI * 2);
  ctx.fillStyle = COR_MADEIRA_CLARA;
  ctx.fill();
  ctx.strokeStyle = COR_CONTORNO;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Capa de neve acumulada em cima de toda a travessa.
  ctx.beginPath();
  ctx.moveTo(-meioLargo, -espessura / 2);
  ctx.quadraticCurveTo(-meioLargo * 0.45, -espessura * 1.55, 0, -espessura * 1.05);
  ctx.quadraticCurveTo(meioLargo * 0.45, -espessura * 1.55, meioLargo, -espessura / 2);
  ctx.closePath();
  ctx.fillStyle = COR_NEVE_LUZ_OBJ;
  ctx.fill();
  ctx.strokeStyle = COR_CONTORNO;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

/** Desenha um boneco de neve cômico de 3 esferas com cenoura e chapéu torto */
function desenharBonecoDeNeve(ctx: CanvasRenderingContext2D, x: number, y: number, _w: number, h: number): void {
  const baseR = h * 0.28;
  const meioR = h * 0.21;
  const cabecaR = h * 0.16;

  const baseCy = y - baseR;
  const meioCy = baseCy - baseR * 0.75 - meioR * 0.75;
  const cabecaCy = meioCy - meioR * 0.75 - cabecaR * 0.75;

  // 1. Bola inferior (base)
  ctx.beginPath();
  ctx.arc(x, baseCy, baseR, 0, Math.PI * 2);
  ctx.fillStyle = COR_NEVE_LUZ_OBJ;
  ctx.fill();
  ctx.strokeStyle = '#BDD5EA';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 2. Bola média
  ctx.beginPath();
  ctx.arc(x, meioCy, meioR, 0, Math.PI * 2);
  ctx.fillStyle = COR_NEVE_LUZ_OBJ;
  ctx.fill();
  ctx.stroke();
  // Botões de carvão no peito
  ctx.fillStyle = '#222B35';
  ctx.beginPath();
  ctx.arc(x, meioCy - 3, 2, 0, Math.PI * 2);
  ctx.arc(x, meioCy + 4, 2, 0, Math.PI * 2);
  ctx.fill();

  // 3. Cabeça
  ctx.beginPath();
  ctx.arc(x, cabecaCy, cabecaR, 0, Math.PI * 2);
  ctx.fillStyle = COR_NEVE_LUZ_OBJ;
  ctx.fill();
  ctx.stroke();

  // Olhos pretos de carvão
  ctx.fillStyle = '#222B35';
  ctx.beginPath();
  ctx.arc(x - 3, cabecaCy - 2, 1.8, 0, Math.PI * 2);
  ctx.arc(x + 3, cabecaCy - 2, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Nariz pontudo de cenoura laranja
  ctx.fillStyle = '#FF7B25';
  ctx.beginPath();
  ctx.moveTo(x, cabecaCy);
  ctx.lineTo(x + 10, cabecaCy + 2);
  ctx.lineTo(x, cabecaCy + 3);
  ctx.closePath();
  ctx.fill();

  // Chapéu de feltro torto no topo da cabeça
  ctx.save();
  ctx.translate(x, cabecaCy - cabecaR + 2);
  ctx.rotate(0.2);
  ctx.fillStyle = '#C0392B';
  ctx.fillRect(-8, -2, 16, 3);
  ctx.fillRect(-5, -11, 10, 9);
  ctx.restore();
}

/** Desenha um trilho de madeira de fazenda serrana para grind (objeto-decoração, 1 instância localizada) */
function desenharTrilhoObjeto(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const posteW = 6;
  const travessaH = 7;
  const topoY = y - h;

  // 2 Postes verticais cravados no chão da montanha
  ctx.fillStyle = COR_MADEIRA_ESCURA;
  ctx.fillRect(x - w / 2 + 4, topoY, posteW, h);
  ctx.fillRect(x + w / 2 - 4 - posteW, topoY, posteW, h);
  ctx.strokeStyle = COR_CONTORNO;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x - w / 2 + 4, topoY, posteW, h);
  ctx.strokeRect(x + w / 2 - 4 - posteW, topoY, posteW, h);

  // Barra/travessa horizontal de madeira polida onde o piloto faz o grind
  ctx.fillStyle = COR_MADEIRA_CLARA;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, topoY - 2, w, travessaH, 2);
  ctx.fill();
  ctx.strokeStyle = COR_CONTORNO;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Brilho de neve/metal polido no fio superior de grind
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillRect(x - w / 2 + 2, topoY - 2, w - 4, 2);
}

/** Desenha uma rampa esculpida na neve com bandeirinha indicativa de decolagem */
function desenharRampa(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  // Cunha de rampa com curva ascendente suave para lançamento
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x, y, x + w / 2, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  ctx.fillStyle = COR_NEVE_LUZ_OBJ;
  ctx.fill();
  ctx.strokeStyle = '#9EBFE3';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Linha de sombra suave na base traseira da rampa
  ctx.fillStyle = '#BFD9EE';
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - 4, y - h);
  ctx.lineTo(x + w / 2, y - h);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w / 2 - 4, y);
  ctx.closePath();
  ctx.fill();

  // Bandeirinha triangular vermelha na saída da rampa
  ctx.strokeStyle = COR_MADEIRA_ESCURA;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y - h);
  ctx.lineTo(x + w / 2, y - h - 14);
  ctx.stroke();
  ctx.fillStyle = '#E74C3C';
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y - h - 14);
  ctx.lineTo(x + w / 2 + 10, y - h - 10);
  ctx.lineTo(x + w / 2, y - h - 6);
  ctx.closePath();
  ctx.fill();
}

/** Desenha o pinhão dourado ou floco coletável com brilho radiante */
function desenharColetavel(ctx: CanvasRenderingContext2D, x: number, y: number, _w: number, h: number): void {
  const r = h * 0.45;
  const cy = y - h * 0.5;

  // Halo de brilho suave
  ctx.beginPath();
  ctx.arc(x, cy, r * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 235, 120, 0.28)';
  ctx.fill();

  // Pinhão dourado (gota esticada)
  ctx.beginPath();
  ctx.moveTo(x, cy - r * 1.1);
  ctx.quadraticCurveTo(x + r, cy, x, cy + r * 1.1);
  ctx.quadraticCurveTo(x - r, cy, x, cy - r * 1.1);
  ctx.closePath();
  ctx.fillStyle = '#F5B041';
  ctx.fill();
  ctx.strokeStyle = '#D68910';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Miolo brilhante interno
  ctx.beginPath();
  ctx.arc(x - 1, cy - 2, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF9DB';
  ctx.fill();
}

/** Desenha um objeto da pista com o acabamento artístico de animação 3D do bosque. */
function desenharObjetoBosque(ctx: CanvasRenderingContext2D, obj: ObjetoPista, xTela: number, yTela: number, escala: number): void {
  const larguraPx = Math.max(8, obj.largura * escala);
  const alturaPx = Math.max(8, obj.altura * escala);

  ctx.save();
  switch (obj.tipo) {
    case 'pedra':
      desenharPedra(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'tronco':
      desenharTronco(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'pinheiro':
      // Mesmo bug-classe do galho (memória `galho-fallback-cinza-tipoobjeto-sem-case-no-tema`): este `case`
      // faltava aqui -- caía no retângulo cinza genérico. O raster (`bosque-raster.ts`) já tem sprite próprio
      // (`obj.pinheiro`) e nunca passava por este fallback; só o vetor puro (seleção/raster ainda não carregado)
      // mostrava o bug. Reusa `desenharTronco` (mesma silhueta de tora tombada que o catálogo já representa).
      desenharTronco(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'boneco-de-neve':
      desenharBonecoDeNeve(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'trilho':
      desenharTrilhoObjeto(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'rampa':
      desenharRampa(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'floco':
      desenharColetavel(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'galho':
      desenharGalho(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    default:
      // Fallback genérico elegante com contorno escuro e neve no topo
      ctx.fillStyle = '#7A8F9F';
      ctx.fillRect(xTela - larguraPx / 2, yTela - alturaPx, larguraPx, alturaPx);
      ctx.strokeStyle = COR_CONTORNO;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(xTela - larguraPx / 2, yTela - alturaPx, larguraPx, alturaPx);
      ctx.fillStyle = COR_NEVE_LUZ_OBJ;
      ctx.fillRect(xTela - larguraPx / 2, yTela - alturaPx, larguraPx, 3);
      break;
  }
  ctx.restore();
}

/**
 * Desenha um segmento de grind (`pista.trilhos`, "cerca de fazenda" na pele do bosque — §0.5 da ficha de temas):
 * postes a cada ~4 m cravados do chão até a travessa, e a travessa (fio de grind) contínua por cima, seguindo o
 * relevo do terreno + a altura do trilho (a mesma conta de `alturaEfetivaEm`, `pista/consulta.ts`).
 */
function desenharTrilhoSegmento(ctx: CanvasRenderingContext2D, trilho: Trilho, pista: PistaGerada, camera: EstadoCamera): void {
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const topoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm) + trilho.altura, camera, PX_POR_METRO);
  const chaoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm), camera, PX_POR_METRO);

  const pontosTopo: { x: number; y: number }[] = [];
  for (let xm = trilho.x0; xm <= trilho.x1; xm += pista.dx) pontosTopo.push(topoY(xm));
  const ultimoXm = trilho.x1;
  if (pontosTopo.length === 0 || pontosTopo[pontosTopo.length - 1]!.x !== topoY(ultimoXm).x) pontosTopo.push(topoY(ultimoXm));
  if (pontosTopo.length < 2) return;

  const travessaH = Math.max(3, 7 * (escala / PX_POR_METRO));
  const posteW = Math.max(2, 6 * (escala / PX_POR_METRO));

  // 1. Postes verticais a cada ~4 m, do chão até a travessa
  ctx.fillStyle = COR_MADEIRA_ESCURA;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.lineWidth = 1.2;
  const ESPACO_POSTE_M = 4;
  for (let xm = trilho.x0; xm <= trilho.x1 + 0.001; xm += ESPACO_POSTE_M) {
    const xmClamp = Math.min(xm, trilho.x1);
    const pTopo = topoY(xmClamp);
    const pChao = chaoY(xmClamp);
    ctx.fillRect(pTopo.x - posteW / 2, pTopo.y, posteW, Math.max(0, pChao.y - pTopo.y));
    ctx.strokeRect(pTopo.x - posteW / 2, pTopo.y, posteW, Math.max(0, pChao.y - pTopo.y));
  }

  // 2. Travessa contínua (o fio de grind), seguindo o relevo
  ctx.beginPath();
  ctx.moveTo(pontosTopo[0]!.x, pontosTopo[0]!.y);
  for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, pontosTopo[i]!.y);
  for (let i = pontosTopo.length - 1; i >= 0; i -= 1) ctx.lineTo(pontosTopo[i]!.x, pontosTopo[i]!.y + travessaH);
  ctx.closePath();
  ctx.fillStyle = COR_MADEIRA_CLARA;
  ctx.fill();
  ctx.strokeStyle = COR_CONTORNO;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 3. Brilho de neve/metal polido no fio superior de grind (L3 da ficha de temas: contraste no grind)
  ctx.beginPath();
  ctx.moveTo(pontosTopo[0]!.x, pontosTopo[0]!.y);
  for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, pontosTopo[i]!.y);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function construirCamadasBosque(doc: Document | undefined, largura: number, altura: number): Parallax {
  const rng = criarRng(SEMENTE_VISUAL_PARALLAX);

  const criarTile = (
    desenho: (c: CanvasRenderingContext2D, r: Rng, largura: number, altura: number) => void,
    fatorParallax: number
  ): CamadaParallax | null => {
    if (!doc) return null;
    const tile = doc.createElement('canvas');
    tile.width = largura;
    tile.height = altura;
    const ctxTile = tile.getContext('2d');
    if (!ctxTile) throw new Error('Canvas 2D indisponível neste navegador');
    desenho(ctxTile, rng, largura, altura);
    return { fatorParallax, tile };
  };

  const camadas: CamadaParallax[] = [];
  if (doc) {
    const cDist = criarTile(desenharMontanhasDistantes, 0.04);
    if (cDist) camadas.push(cDist);
    const cMedia = criarTile(desenharMontanhasMedias, 0.1);
    if (cMedia) camadas.push(cMedia);
    const cFloresta = criarTile(desenharCamadaFloresta, 0.22);
    if (cFloresta) camadas.push(cFloresta);
  }

  return {
    desenhar(ctx, cameraXm, tempoTicks) {
      // 1. Céu em degradê límpido quente/frio (#4FA8F0 -> #BFE6FF) conforme §2.1
      const ceu = ctx.createLinearGradient(0, 0, 0, altura);
      ceu.addColorStop(0, COR_CEU_TOPO);
      ceu.addColorStop(1, COR_CEU_HORIZONTE);
      ctx.fillStyle = ceu;
      ctx.fillRect(0, 0, largura, altura);

      // 2. Luz solar suave no alto à esquerda (consistência com a iluminação 3D das folhas e cristas)
      const brilhoSol = ctx.createRadialGradient(largura * 0.18, altura * 0.12, 10, largura * 0.18, altura * 0.12, 220);
      brilhoSol.addColorStop(0, 'rgba(255, 252, 240, 0.35)');
      brilhoSol.addColorStop(0.5, 'rgba(255, 252, 240, 0.12)');
      brilhoSol.addColorStop(1, 'rgba(255, 252, 240, 0)');
      ctx.fillStyle = brilhoSol;
      ctx.fillRect(0, 0, largura, altura);

      // 3. Camadas de parallax pré-renderizadas
      for (const camada of camadas) {
        const deslocPx = (((cameraXm * camada.fatorParallax * 8) % largura) + largura) % largura;
        ctx.drawImage(camada.tile, -deslocPx, 0, largura, altura);
        ctx.drawImage(camada.tile, largura - deslocPx, 0, largura, altura);
      }

      // 4. Flocos de neve de fundo (profundidade atmosférica) — ver `render/particulas.ts`
      void tempoTicks;
    },
  };
}

export const pintorBosque: PintorTema = {
  construirCamadas: (doc, largura, altura) => construirCamadasBosque(doc, largura, altura),
  desenharObjeto: desenharObjetoBosque,
  desenharTrilho: desenharTrilhoSegmento,
};
