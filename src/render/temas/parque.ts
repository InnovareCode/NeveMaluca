/**
 * Tema `parque` (Pico do Picolé, `pico-do-picole`): a montanha que virou sorvete — docs/temas-pistas-m3.md §1.
 * Mesmas regras do DNA do Morro (§0.1): luz do alto à esquerda, montanha média facetada, capuz em toda crista
 * (aqui é calda/cobertura), tudo pré-desenhado fora da tela no boot (`construirCamadas`), zero `Math.random` em
 * runtime — o granulado/decoração usa `hashDeterministico` (puro, função do índice) ou o `Rng` do canal `visual`.
 *
 * Camadas (fundo -> frente, §1.2): céu quente + sol -> cúpulas de sorvete distantes com calda de baunilha
 * escorrendo -> montanhas médias facetadas em menta com granulado na crista -> colina rosa com casquinhas
 * gigantes, picolés fincados, carrinho de sorvete, bandeirolas e o gag do boneco de neve comendo picolé.
 * Objetos de jogo e trilho (grind = "palito de picolé") seguem o mapa §0.5/§1.3.
 */
import { PX_POR_METRO } from '../../core/constantes';
import { criarRng, type Rng } from '../../core/rng';
import type { ObjetoPista, PistaGerada, Trilho } from '../../core/contratos';
import type { EstadoCamera } from '../mundo';
import { mundoParaTela, pxPorMetro } from '../mundo';
import { alturaDoTerreno, ESPESSURA_MANTA_NEVE_PX } from '../terreno';
import type { CamadaParallax, Parallax } from '../parallax';
import type { PintorTema } from './tipos';

// Paleta (docs/temas-pistas-m3.md §1.1):
const COR_CEU_TOPO = '#5BB8FF';
const COR_CEU_HORIZONTE = '#D9F1FF';

const COR_MONTANHA_DIST_SOMBRA = '#F2C6D8';
const COR_MONTANHA_DIST_LUZ = '#FBE0EA';
const COR_MONTANHA_DIST_CALDA = '#FFF4F8';

const COR_MONTANHA_MEDIA_SOMBRA = '#B9E8D6';
const COR_MONTANHA_MEDIA_LUZ = '#D4F4E7';
const COR_MONTANHA_MEDIA_COBERTURA = '#FFF4F8';

const COR_COLINA_SILHUETA = '#EFC3D3';
const COR_CASQUINHA = '#E9C27A';
const COR_CASQUINHA_GRADE = '#C9973F';

const COR_BOLA_MORANGO = '#FF9EC0';
const COR_BOLA_MENTA = '#7FE0C4';
const COR_BOLA_BAUNILHA = '#FFF1C9';
const COR_BOLA_CHOCOLATE = '#8A5236';

const COR_TERRENO_MANTA = '#FFF4F8';
const COR_TERRENO_CORPO = '#F2D3E0';
const COR_FAIXA_MORANGO = '#F4B3CB';
const COR_FAIXA_MENTA = '#A8E4CF';
const COR_BORDA_TERRENO = '#E7AFC4';
const COR_CONTORNO_SUPERFICIE = '#FFE6EF';

const COR_OBST_MORANGO_FORTE = '#E8457A';
const COR_OBST_MORANGO_LUZ = '#FF7FA8';
const COR_OBST_PALITO = '#E9C27A';

const COR_CONTORNO = '#1B2733'; // igual ao Morro (§1.1, regra L1)
const COR_CEREJA = '#C7301C';

const CORES_GRANULADO = ['#FF5C8A', '#FFD23F', '#5BB8FF', '#3DDC97', '#FF8A1F'] as const;

const SEMENTE_VISUAL_PARQUE = 20261023;

/** Hash puro (não é `Math.random`, regra 0.1-4): decoração determinística por índice/posição. */
function hashDeterministico(n: number): number {
  let h = (n ^ 0x5bd1e995) >>> 0;
  h = Math.imul(h, 2654435761) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

function corBolaPor(indice: number): string {
  const cores = [COR_BOLA_MORANGO, COR_BOLA_MENTA, COR_BOLA_BAUNILHA];
  return cores[hashDeterministico(indice) % cores.length] as string;
}

// --- Camada 1: cúpulas de sorvete distantes (§1.2.2) ---

function desenharCaldaBaunilha(ctx: CanvasRenderingContext2D, x: number, y: number, raio: number): void {
  // Faixa ondulada de calda de baunilha escorrendo no topo da cúpula
  ctx.beginPath();
  ctx.moveTo(x - raio, y + raio * 0.3);
  ctx.quadraticCurveTo(x - raio * 0.4, y - raio * 0.15, x, y + raio * 0.1);
  ctx.quadraticCurveTo(x + raio * 0.4, y - raio * 0.1, x + raio, y + raio * 0.25);
  ctx.quadraticCurveTo(x + raio * 0.4, y + raio * 0.55, x, y + raio * 0.4);
  ctx.quadraticCurveTo(x - raio * 0.4, y + raio * 0.55, x - raio, y + raio * 0.3);
  ctx.closePath();
  ctx.fillStyle = COR_MONTANHA_DIST_CALDA;
  ctx.fill();

  // 3 gotas descendo, nunca simétricas
  const deslocs = [-raio * 0.55, raio * 0.05, raio * 0.6];
  for (let i = 0; i < 3; i += 1) {
    const gx = x + deslocs[i]!;
    const comprimento = raio * (0.5 + i * 0.15);
    ctx.beginPath();
    ctx.ellipse(gx, y + raio * 0.4 + comprimento * 0.5, raio * 0.12, comprimento * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = COR_MONTANHA_DIST_CALDA;
    ctx.fill();
  }
}

function desenharCupulasDistantes(ctx: CanvasRenderingContext2D, rng: Rng, largura: number, altura: number): void {
  const baseY = altura * 0.32;
  // Mesmos 8 pontos de pico do Morro (§1.2.2: "os mesmos 8 pontos... mas cada pico vira cúpula").
  const picos: { x: number; y: number }[] = [
    { x: 0, y: baseY - 35 },
    { x: 120, y: baseY - 80 },
    { x: 250, y: baseY - 50 },
    { x: 390, y: baseY - 95 },
    { x: 530, y: baseY - 45 },
    { x: 670, y: baseY - 85 },
    { x: 810, y: baseY - 60 },
    { x: largura, y: baseY - 35 },
  ];

  // Corpo em sombra: domos arredondados (quadraticCurveTo em vez do triângulo do Morro)
  ctx.beginPath();
  ctx.moveTo(0, altura);
  ctx.lineTo(0, picos[0]!.y);
  for (let i = 1; i < picos.length; i += 1) {
    const p0 = picos[i - 1]!;
    const p1 = picos[i]!;
    const meioX = (p0.x + p1.x) / 2;
    const cumeY = Math.min(p0.y, p1.y) - 30;
    ctx.quadraticCurveTo(meioX, cumeY, p1.x, p1.y);
  }
  ctx.lineTo(largura, altura);
  ctx.closePath();
  ctx.fillStyle = COR_MONTANHA_DIST_SOMBRA;
  ctx.fill();

  // Luz na metade esquerda de cada cúpula + capuz de calda de baunilha no cume
  for (let i = 1; i < picos.length; i += 1) {
    const p0 = picos[i - 1]!;
    const p1 = picos[i]!;
    const meioX = (p0.x + p1.x) / 2;
    const cumeY = Math.min(p0.y, p1.y) - 30;

    ctx.beginPath();
    ctx.moveTo(p0.x, Math.max(p0.y, baseY - 10));
    ctx.quadraticCurveTo((p0.x + meioX) / 2, (p0.y + cumeY) / 2 - 8, meioX, cumeY);
    ctx.lineTo(meioX, baseY + 30);
    ctx.lineTo(p0.x, baseY + 30);
    ctx.closePath();
    ctx.fillStyle = COR_MONTANHA_DIST_LUZ;
    ctx.fill();

    desenharCaldaBaunilha(ctx, meioX, cumeY, 20 + rng.inteiro(8));
  }
}

// --- Camada 2: montanhas médias facetadas, cobertura de baunilha + granulado (§1.2.3) ---

function desenharGranuladoCrista(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const angulos = [-40, -10, 25, 60, -55, 15];
  for (let i = 0; i < angulos.length; i += 1) {
    const h = hashDeterministico(Math.round(x) * 31 + i);
    const dx = (h % 20) - 10;
    const dy = (Math.floor(h / 20) % 10) - 5;
    ctx.save();
    ctx.translate(x + dx, y + 6 + dy);
    ctx.rotate((angulos[i]! * Math.PI) / 180);
    ctx.fillStyle = CORES_GRANULADO[h % CORES_GRANULADO.length] as string;
    ctx.fillRect(-1, -2.5, 2, 5);
    ctx.restore();
  }
}

function desenharMontanhasMediasParque(ctx: CanvasRenderingContext2D, largura: number, altura: number): void {
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

  ctx.beginPath();
  ctx.moveTo(0, altura);
  ctx.lineTo(0, pontos[0]!.y);
  for (let i = 1; i < pontos.length; i += 1) ctx.lineTo(pontos[i]!.x, pontos[i]!.y);
  ctx.lineTo(largura, altura);
  ctx.closePath();
  ctx.fillStyle = COR_MONTANHA_MEDIA_SOMBRA;
  ctx.fill();

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

    const cume = p1.y < p0.y ? p1 : p0;
    // Cobertura de baunilha na crista (no lugar do capuz de neve do Morro)
    ctx.beginPath();
    ctx.moveTo(cume.x - 14, cume.y + 10);
    ctx.lineTo(cume.x, cume.y);
    ctx.lineTo(cume.x + 12, cume.y + 12);
    ctx.lineTo(cume.x, cume.y + 5);
    ctx.closePath();
    ctx.fillStyle = COR_MONTANHA_MEDIA_COBERTURA;
    ctx.fill();

    desenharGranuladoCrista(ctx, cume.x, cume.y);
  }
}

// --- Camada 3: silhuetas — colina + casquinhas gigantes + picolés fincados + carrinho + bandeirolas + gag (§1.2.4) ---

function desenharCasquinhaGigante(ctx: CanvasRenderingContext2D, x: number, baseY: number, altura: number): void {
  const largura = altura * 0.75;
  const topoConeY = baseY - altura * 0.35;

  // Cone (ponta na colina)
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x - largura / 2, topoConeY);
  ctx.lineTo(x + largura / 2, topoConeY);
  ctx.closePath();
  ctx.fillStyle = COR_CASQUINHA;
  ctx.fill();

  // Grade de waffle (recortada no cone)
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = COR_CASQUINHA_GRADE;
  ctx.lineWidth = 1;
  for (let gx = x - largura; gx <= x + largura; gx += 7) {
    ctx.beginPath();
    ctx.moveTo(gx, topoConeY);
    ctx.lineTo(gx + altura, baseY);
    ctx.stroke();
  }
  ctx.restore();

  // Gota de calda descendo pelo cone
  ctx.beginPath();
  ctx.ellipse(x + largura * 0.15, baseY - altura * 0.12, 3, 8, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#FF9EC0';
  ctx.fill();

  // Bola de sorvete em cima
  const r = altura * 0.32;
  const cy = topoConeY - r * 0.5;
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = COR_BOLA_MORANGO;
  ctx.fill();
  // Metade esquerda 1 tom mais clara (luz do alto à esquerda, DNA §0.1)
  ctx.beginPath();
  ctx.arc(x - r * 0.3, cy - r * 0.25, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fill();
}

function desenharCorpoPicoleVertical(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  largura: number,
  altura: number,
  corBola: string,
  comContorno: boolean
): void {
  const raio = Math.min(largura, altura) * 0.22;
  const topoY = baseY - altura;

  ctx.beginPath();
  ctx.roundRect(x - largura / 2, topoY, largura, altura, raio);
  ctx.fillStyle = corBola;
  ctx.fill();

  // "Mordida" côncava no canto superior direito (destination-out: revela o que já estava desenhado atrás)
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(x + largura / 2 - raio * 0.3, topoY + raio * 0.3, raio * 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (comContorno) {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = COR_CONTORNO;
    ctx.beginPath();
    ctx.roundRect(x - largura / 2, topoY, largura, altura, raio);
    ctx.stroke();
  }

  // Faixa de luz na borda esquerda
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(x - largura / 2 + 2, topoY + raio, Math.max(2, largura * 0.14), Math.max(0, altura - raio * 2));

  // Palito
  ctx.fillStyle = COR_OBST_PALITO;
  ctx.fillRect(x - largura * 0.09, baseY, largura * 0.18, altura * 0.18);
}

function desenharCarrinhoSorvete(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  const w = 34;
  const h = 20;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, baseY - h, w, h, 4);
  ctx.fillStyle = COR_BOLA_MENTA;
  ctx.fill();
  ctx.strokeStyle = COR_CONTORNO;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#4A2E1B';
  ctx.beginPath();
  ctx.arc(x - w / 2 + 6, baseY, 3.5, 0, Math.PI * 2);
  ctx.arc(x + w / 2 - 6, baseY, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Guarda-sol listrado (meio-disco com gomos)
  const topoY = baseY - h - 14;
  const gomos = 6;
  for (let i = 0; i < gomos; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x, topoY);
    ctx.arc(x, topoY, 20, Math.PI + (i * Math.PI) / gomos, Math.PI + ((i + 1) * Math.PI) / gomos);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? '#FF5C8A' : '#FFF4F8';
    ctx.fill();
  }
  ctx.fillStyle = '#4A2E1B';
  ctx.fillRect(x - 1, topoY - 2, 2, 16);
}

function desenharBandeirolas(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  const meioX = (x0 + x1) / 2;
  const flechaY = Math.min(y0, y1) - 18;

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(meioX, flechaY, x1, y1);
  ctx.strokeStyle = COR_CASQUINHA_GRADE;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const passos = 10;
  for (let i = 1; i < passos; i += 1) {
    const t = i / passos;
    const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * meioX + t * t * x1;
    const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * flechaY + t * t * y1;
    ctx.beginPath();
    ctx.moveTo(bx - 3, by);
    ctx.lineTo(bx + 3, by);
    ctx.lineTo(bx, by + 8);
    ctx.closePath();
    ctx.fillStyle = CORES_GRANULADO[i % CORES_GRANULADO.length] as string;
    ctx.fill();
  }
}

/** Gag recorrente das 4 pistas novas (§1.2.4): boneco de neve com "congelamento cerebral" comendo um picolé. */
function desenharBonecoGagPicole(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  const r = 16;
  ctx.beginPath();
  ctx.arc(x, baseY - r, r, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#D8E6F0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Olhos "><" apertados (congelamento cerebral)
  ctx.strokeStyle = '#222B35';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x - 7, baseY - r - 2);
  ctx.lineTo(x - 3, baseY - r);
  ctx.moveTo(x - 7, baseY - r + 2);
  ctx.lineTo(x - 3, baseY - r);
  ctx.moveTo(x + 3, baseY - r - 2);
  ctx.lineTo(x + 7, baseY - r);
  ctx.moveTo(x + 3, baseY - r + 2);
  ctx.lineTo(x + 7, baseY - r);
  ctx.stroke();

  // Braço-graveto segurando um picolé de morango encostado na "boca"
  ctx.strokeStyle = '#4A2E1B';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 6, baseY - r);
  ctx.lineTo(x + 16, baseY - r - 6);
  ctx.stroke();
  ctx.fillStyle = COR_OBST_MORANGO_FORTE;
  ctx.fillRect(x + 13, baseY - r - 16, 6, 12);
  ctx.fillStyle = COR_OBST_PALITO;
  ctx.fillRect(x + 15, baseY - r - 4, 2, 6);
}

function desenharCamadaSilhueta(ctx: CanvasRenderingContext2D, largura: number, altura: number): void {
  const baseY = altura * 0.52; // mesma conta do Morro (§1.2.4: "baseY 281" com altura 540)

  ctx.beginPath();
  ctx.moveTo(0, altura);
  ctx.lineTo(0, baseY - 8);
  ctx.quadraticCurveTo(largura * 0.25, baseY - 26, largura * 0.5, baseY - 14);
  ctx.quadraticCurveTo(largura * 0.75, baseY, largura, baseY - 8);
  ctx.lineTo(largura, altura);
  ctx.closePath();
  ctx.fillStyle = COR_COLINA_SILHUETA;
  ctx.fill();

  desenharCasquinhaGigante(ctx, 90, baseY - 4, 76);
  desenharCorpoPicoleVertical(ctx, 190, baseY - 6, 22, 40, corBolaPor(190), false);
  desenharCorpoPicoleVertical(ctx, 270, baseY - 4, 20, 36, corBolaPor(270), false);
  desenharCasquinhaGigante(ctx, 330, baseY - 2, 84);
  desenharBonecoGagPicole(ctx, 410, baseY - 2);
  desenharCorpoPicoleVertical(ctx, 470, baseY - 8, 22, 42, corBolaPor(470), false);
  desenharCarrinhoSorvete(ctx, 530, baseY);
  desenharCasquinhaGigante(ctx, 600, baseY - 4, 80);
  desenharCorpoPicoleVertical(ctx, 700, baseY - 2, 20, 38, corBolaPor(700), false);
  desenharBandeirolas(ctx, 600, baseY - 4 - 80 * 0.35 - 80 * 0.32, 840, baseY - 10 - 90 * 0.35 - 90 * 0.32);
  desenharCasquinhaGigante(ctx, 840, baseY - 10, 90);
  desenharCorpoPicoleVertical(ctx, 900, baseY - 6, 22, 40, corBolaPor(900), false);
}

function construirCamadasParque(doc: Document | undefined, largura: number, altura: number): Parallax {
  const rng = criarRng(SEMENTE_VISUAL_PARQUE);

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
    const cDist = criarTile(desenharCupulasDistantes, 0.04);
    if (cDist) camadas.push(cDist);
    const cMedia = criarTile((c, _r, l, a) => desenharMontanhasMediasParque(c, l, a), 0.1);
    if (cMedia) camadas.push(cMedia);
    const cSilhueta = criarTile((c, _r, l, a) => desenharCamadaSilhueta(c, l, a), 0.22);
    if (cSilhueta) camadas.push(cSilhueta);
  }

  return {
    desenhar(ctx, cameraXm, tempoTicks) {
      // Céu quente e saturado de meio-dia (§1.1/§1.2.1)
      const ceu = ctx.createLinearGradient(0, 0, 0, altura);
      ceu.addColorStop(0, COR_CEU_TOPO);
      ceu.addColorStop(1, COR_CEU_HORIZONTE);
      ctx.fillStyle = ceu;
      ctx.fillRect(0, 0, largura, altura);

      // Sol forte, ainda à esquerda (regra 0.1-1 / §1 "Hora e luz")
      const brilhoSol = ctx.createRadialGradient(largura * 0.24, altura * 0.08, 10, largura * 0.24, altura * 0.08, 260);
      brilhoSol.addColorStop(0, 'rgba(255, 250, 235, 0.45)');
      brilhoSol.addColorStop(1, 'rgba(255, 250, 235, 0)');
      ctx.fillStyle = brilhoSol;
      ctx.fillRect(0, 0, largura, altura);

      for (const camada of camadas) {
        const deslocPx = (((cameraXm * camada.fatorParallax * 8) % largura) + largura) % largura;
        ctx.drawImage(camada.tile, -deslocPx, 0, largura, altura);
        ctx.drawImage(camada.tile, largura - deslocPx, 0, largura, altura);
      }

      void tempoTicks;
    },
  };
}

// --- Objetos de jogo (§1.3) ---

function desenharPicoleCaido(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.save();
  ctx.translate(x, y - h * 0.3);
  ctx.rotate((-12 * Math.PI) / 180);

  const corpoW = w * 0.85;
  const corpoH = h * 0.6;
  const r = corpoH * 0.45;
  const corpoX = -corpoW * 0.15;

  ctx.beginPath();
  ctx.roundRect(corpoX, -corpoH / 2, corpoW, corpoH, r);
  ctx.fillStyle = COR_OBST_MORANGO_FORTE;
  ctx.fill();

  // Mordida côncava na ponta direita
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(corpoX + corpoW - r * 0.3, -corpoH / 2 + r * 0.3, r * 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.beginPath();
  ctx.roundRect(corpoX, -corpoH / 2, corpoW, corpoH, r);
  ctx.stroke();

  // Faixa de luz no terço de cima (§1.3)
  ctx.fillStyle = COR_OBST_MORANGO_LUZ;
  ctx.fillRect(corpoX + 2, -corpoH / 2 + 2, corpoW - 4, corpoH * 0.3);

  // Palito saindo da esquerda
  ctx.fillStyle = COR_OBST_PALITO;
  ctx.fillRect(corpoX - w * 0.3, -h * 0.06, w * 0.3, h * 0.12);
  ctx.restore();
}

function desenharBolaSorveteCaida(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const corBola = hashDeterministico(Math.round(x)) % 2 === 0 ? COR_BOLA_MENTA : COR_BOLA_CHOCOLATE;
  const rw = w * 0.55;
  const rh = h * 0.3;

  ctx.beginPath();
  ctx.ellipse(x, y - rh * 0.6, rw, rh, 0, 0, Math.PI * 2);
  ctx.fillStyle = corBola;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.stroke();

  ctx.fillStyle = corBola;
  for (let i = 0; i < 3; i += 1) {
    const gx = x + (i - 1) * rw * 0.5;
    ctx.beginPath();
    ctx.ellipse(gx, y - rh * 0.1 + i * 1.5, rw * 0.08, rh * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < 5; i += 1) {
    const h2 = hashDeterministico(Math.round(x) * 7 + i);
    const gx = x - rw * 0.7 + ((h2 % 100) / 100) * rw * 1.4;
    ctx.save();
    ctx.translate(gx, y - rh * 1.1);
    ctx.rotate(((h2 >> 3) % 90) * (Math.PI / 180));
    ctx.fillStyle = CORES_GRANULADO[h2 % CORES_GRANULADO.length] as string;
    ctx.fillRect(-1, -2, 2, 4);
    ctx.restore();
  }
}

function desenharCasquinhaTombada(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const comp = w;
  const alt = h * 0.7;

  ctx.save();
  ctx.translate(x, y - alt / 2);

  ctx.beginPath();
  ctx.moveTo(-comp / 2, -alt / 2);
  ctx.lineTo(-comp / 2, alt / 2);
  ctx.lineTo(comp / 2, 0);
  ctx.closePath();
  ctx.fillStyle = COR_CASQUINHA;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.stroke();

  ctx.save();
  ctx.clip();
  ctx.strokeStyle = COR_CASQUINHA_GRADE;
  ctx.lineWidth = 1;
  for (let gx = -comp / 2; gx <= comp / 2; gx += 6) {
    ctx.beginPath();
    ctx.moveTo(gx, -alt / 2);
    ctx.lineTo(gx + alt, alt / 2);
    ctx.stroke();
  }
  ctx.restore();

  // Boca do cone à esquerda com a bola de baunilha meio para fora
  ctx.beginPath();
  ctx.arc(-comp / 2, 0, alt * 0.45, 0, Math.PI * 2);
  ctx.fillStyle = COR_BOLA_BAUNILHA;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.stroke();
  ctx.restore();
}

function desenharBonecoDeSorvete(ctx: CanvasRenderingContext2D, x: number, y: number, _w: number, h: number): void {
  const contorno = '#FFE6EF'; // claro (§1.3: atravessável, nunca contorno escuro — regra L1)
  const baseR = h * 0.28;
  const meioR = h * 0.21;
  const cabecaR = h * 0.16;

  const baseCy = y - baseR;
  const meioCy = baseCy - baseR * 0.75 - meioR * 0.75;
  const cabecaCy = meioCy - meioR * 0.75 - cabecaR * 0.75;

  ctx.strokeStyle = contorno;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.arc(x, baseCy, baseR, 0, Math.PI * 2);
  ctx.fillStyle = COR_BOLA_BAUNILHA;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, meioCy, meioR, 0, Math.PI * 2);
  ctx.fillStyle = COR_BOLA_MORANGO;
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, cabecaCy, cabecaR, 0, Math.PI * 2);
  ctx.fillStyle = COR_BOLA_MENTA;
  ctx.fill();
  ctx.stroke();

  // Olhos de gota de chocolate
  ctx.fillStyle = COR_BOLA_CHOCOLATE;
  ctx.beginPath();
  ctx.arc(x - 3, cabecaCy - 2, 1.8, 0, Math.PI * 2);
  ctx.arc(x + 3, cabecaCy - 2, 1.8, 0, Math.PI * 2);
  ctx.fill();

  // Nariz de casquinha (triângulo)
  ctx.fillStyle = COR_CASQUINHA;
  ctx.beginPath();
  ctx.moveTo(x, cabecaCy);
  ctx.lineTo(x + 9, cabecaCy + 2);
  ctx.lineTo(x, cabecaCy + 3);
  ctx.closePath();
  ctx.fill();

  // Cereja no lugar do chapéu
  const cerejaCy = cabecaCy - cabecaR - 3;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(x, cerejaCy + 3);
  ctx.lineTo(x + 1.5, cabecaCy - cabecaR);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, cerejaCy, 4, 0, Math.PI * 2);
  ctx.fillStyle = COR_CEREJA;
  ctx.fill();
}

function desenharColetavelParque(ctx: CanvasRenderingContext2D, x: number, y: number, _w: number, h: number): void {
  const r = h * 0.45;
  const cy = y - h * 0.5;

  ctx.beginPath();
  ctx.arc(x, cy, r * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 158, 192, 0.3)';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x, cy - r * 1.1);
  ctx.quadraticCurveTo(x + r, cy, x, cy + r * 1.1);
  ctx.quadraticCurveTo(x - r, cy, x, cy - r * 1.1);
  ctx.closePath();
  ctx.fillStyle = COR_BOLA_MENTA;
  ctx.fill();
  ctx.strokeStyle = '#4FBE9C';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x - 1, cy - 2, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
}

function desenharObjetoParque(ctx: CanvasRenderingContext2D, obj: ObjetoPista, xTela: number, yTela: number, escala: number): void {
  const larguraPx = Math.max(8, obj.largura * escala);
  const alturaPx = Math.max(8, obj.altura * escala);

  ctx.save();
  switch (obj.tipo) {
    case 'pedra':
      if (obj.variante === 1) desenharBolaSorveteCaida(ctx, xTela, yTela, larguraPx, alturaPx);
      else desenharPicoleCaido(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'tronco':
      desenharCasquinhaTombada(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'pinheiro':
      // Picolé gigante fincado (§0.5): igual ao da silhueta, maior, com contorno e mordida.
      desenharCorpoPicoleVertical(ctx, xTela, yTela, larguraPx * 0.75, alturaPx, corBolaPor(Math.round(xTela)), true);
      break;
    case 'boneco-de-neve':
      desenharBonecoDeSorvete(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'floco':
      desenharColetavelParque(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    default:
      // Fallback genérico tingido na paleta do parque (trilho/rampa/bandeira/portico/placa como `ObjetoPista`: hoje
      // nenhum trecho do catálogo emite isso — ver memória `trilho-objeto-vs-pista-trilhos`).
      ctx.fillStyle = COR_BORDA_TERRENO;
      ctx.fillRect(xTela - larguraPx / 2, yTela - alturaPx, larguraPx, alturaPx);
      ctx.strokeStyle = COR_CONTORNO;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(xTela - larguraPx / 2, yTela - alturaPx, larguraPx, alturaPx);
      ctx.fillStyle = COR_TERRENO_MANTA;
      ctx.fillRect(xTela - larguraPx / 2, yTela - alturaPx, larguraPx, 3);
      break;
  }
  ctx.restore();
}

// --- Trilho de grind: "palito de picolé" (§0.5/§1.3, regra L3) ---

function desenharTrilhoPalito(ctx: CanvasRenderingContext2D, trilho: Trilho, pista: PistaGerada, camera: EstadoCamera): void {
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const topoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm) + trilho.altura, camera, PX_POR_METRO);
  const chaoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm), camera, PX_POR_METRO);

  const pontosTopo: { x: number; y: number }[] = [];
  for (let xm = trilho.x0; xm <= trilho.x1; xm += pista.dx) pontosTopo.push(topoY(xm));
  const ultimoXm = trilho.x1;
  if (pontosTopo.length === 0 || pontosTopo[pontosTopo.length - 1]!.x !== topoY(ultimoXm).x) pontosTopo.push(topoY(ultimoXm));
  if (pontosTopo.length < 2) return;

  const espessura = Math.max(4, 9 * (escala / PX_POR_METRO));
  const posteW = Math.max(2, 5 * (escala / PX_POR_METRO));

  // Pés: palitos verticais a cada <= 4 m, do chão até o corpo do palito (igual ao padrão do Morro, §0.5)
  ctx.fillStyle = COR_OBST_PALITO;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.lineWidth = 1.2;
  const ESPACO_PE_M = 4;
  for (let xm = trilho.x0; xm <= trilho.x1 + 0.001; xm += ESPACO_PE_M) {
    const xmClamp = Math.min(xm, trilho.x1);
    const pTopo = topoY(xmClamp);
    const pChao = chaoY(xmClamp);
    ctx.fillRect(pTopo.x - posteW / 2, pTopo.y, posteW, Math.max(0, pChao.y - pTopo.y));
    ctx.strokeRect(pTopo.x - posteW / 2, pTopo.y, posteW, Math.max(0, pChao.y - pTopo.y));
  }

  // Corpo do palito: traço largo com `lineCap`/`lineJoin` 'round' = ponta arredondada (a "ponta que faz ler palito")
  const centroY = (p: { x: number; y: number }) => p.y + espessura / 2;
  const tracarCentro = (): void => {
    ctx.beginPath();
    ctx.moveTo(pontosTopo[0]!.x, centroY(pontosTopo[0]!));
    for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, centroY(pontosTopo[i]!));
  };

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Contorno escuro embaixo (regra L3)
  ctx.lineWidth = espessura + 3;
  ctx.strokeStyle = COR_CONTORNO;
  tracarCentro();
  ctx.stroke();

  // Corpo `#E9C27A`
  ctx.lineWidth = espessura;
  ctx.strokeStyle = COR_OBST_PALITO;
  tracarCentro();
  ctx.stroke();

  // 2 veios de madeira ao longo
  ctx.lineWidth = 1;
  ctx.strokeStyle = COR_CASQUINHA_GRADE;
  for (const frac of [0.3, 0.7]) {
    ctx.beginPath();
    ctx.moveTo(pontosTopo[0]!.x, pontosTopo[0]!.y + espessura * frac);
    for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, pontosTopo[i]!.y + espessura * frac);
    ctx.stroke();
  }

  // Fio claro no topo, contraste >= 3:1 (regra L3)
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(pontosTopo[0]!.x, pontosTopo[0]!.y);
  for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, pontosTopo[i]!.y);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// --- Terreno: sorvete napolitano (§1.2.5) ---

function desenharFaixaParalela(
  ctx: CanvasRenderingContext2D,
  superficie: readonly { x: number; y: number }[],
  yTopo: number,
  yBase: number,
  cor: string
): void {
  ctx.beginPath();
  ctx.moveTo(superficie[0]!.x, superficie[0]!.y + yTopo);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y + yTopo);
  for (let i = superficie.length - 1; i >= 0; i -= 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y + yBase);
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
}

function desenharTerrenoParque(
  ctx: CanvasRenderingContext2D,
  pista: PistaGerada,
  _camera: EstadoCamera,
  superficie: readonly { x: number; y: number }[],
  espessuraMantaPx: number
): void {
  const primeiro = superficie[0]!;
  const ultimo = superficie[superficie.length - 1]!;
  const FUNDO_PX = 4000;

  // 1. Corpo do terreno (#F2D3E0), polígono estendido além da tela (só para FILL — nunca stroke neste caminho,
  // ver memória `webkit-stroke-coordenadas-extremas`: WebKit pinta uma faixa errada se traçar com pontos a 4000px).
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  ctx.lineTo(ultimo.x, ultimo.y + FUNDO_PX);
  ctx.lineTo(primeiro.x, primeiro.y + FUNDO_PX);
  ctx.closePath();
  ctx.fillStyle = COR_TERRENO_CORPO;
  ctx.fill();

  // 2. Manta de baunilha (#FFF4F8)
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  for (let i = superficie.length - 1; i >= 0; i -= 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y + espessuraMantaPx);
  ctx.closePath();
  ctx.fillStyle = COR_TERRENO_MANTA;
  ctx.fill();

  // 3. Sorvete napolitano: 2 faixas paralelas à superfície (§1.2.5), escaladas junto com a espessura da manta
  const fator = espessuraMantaPx / ESPESSURA_MANTA_NEVE_PX;
  desenharFaixaParalela(ctx, superficie, espessuraMantaPx + 10 * fator, espessuraMantaPx + 18 * fator, COR_FAIXA_MORANGO);
  desenharFaixaParalela(ctx, superficie, espessuraMantaPx + 30 * fator, espessuraMantaPx + 38 * fator, COR_FAIXA_MENTA);

  // 4. Granulado na manta: hash determinístico do índice (não `Math.random`), teto de 40 por quadro (§1.2.5)
  const passoM = Math.max(1, Math.round(3 / pista.dx));
  let desenhados = 0;
  for (let i = 0; i < superficie.length && desenhados < 40; i += passoM) {
    const h = hashDeterministico(i);
    if (h % 3 !== 0) continue;
    const p = superficie[i]!;
    ctx.save();
    ctx.translate(p.x, p.y + 4 + (h % 6));
    ctx.rotate(((h >> 4) % 90) * (Math.PI / 180));
    ctx.fillStyle = CORES_GRANULADO[h % CORES_GRANULADO.length] as string;
    ctx.fillRect(-1, -2, 2, 4);
    ctx.restore();
    desenhados += 1;
  }

  // 5. Borda entre a manta e o corpo
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y + espessuraMantaPx);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y + espessuraMantaPx);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COR_BORDA_TERRENO;
  ctx.stroke();

  // 6. Contorno da superfície: caminho ISOLADO, só com os pontos da superfície (mesma regra do item 1)
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = COR_CONTORNO_SUPERFICIE;
  ctx.stroke();
}

export const pintorParque: PintorTema = {
  construirCamadas: (doc, largura, altura) => construirCamadasParque(doc, largura, altura),
  desenharObjeto: desenharObjetoParque,
  desenharTrilho: desenharTrilhoPalito,
  desenharTerreno: desenharTerrenoParque,
};
