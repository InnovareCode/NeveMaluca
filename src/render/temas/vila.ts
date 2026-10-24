/**
 * Tema `vila` (Vila do Chocolate Quente, `vila-chocolate`): docs/temas-pistas-m3.md §2. Fim de tarde virando noite,
 * poente baixo à esquerda, lua crescente no alto à esquerda (DNA §0.1-1: quem ilumina continua vindo do alto
 * esquerdo, aqui é a lua). Arquitetura enxaimel (parede clara + vigas escuras), humor de vó: tudo quentinho.
 * Mesma filosofia do `parque.ts` (Picolé): tudo pré-desenhado fora da tela no boot (`construirCamadas`), zero
 * `Math.random` em runtime (hash determinístico por índice), sem `shadowBlur`/`filter`/gradiente fora do céu
 * (regra 0.1-5): o brilho de lanterna é 2-3 círculos de alfa empilhados, nunca `createRadialGradient` por quadro.
 *
 * Camadas (fundo -> frente, §2.2): céu quente->frio com poente, estrelas e lua crescente (desenhado ao vivo, como
 * o sol do parque) -> morros distantes arredondados, mais baixos que o Morro -> montanhas médias facetadas com
 * janelinhas acesas -> colina roxa com 8 chalés de telhado íngreme, 2 varais de luzinhas, a praça (caneca +
 * lampião) e os gags (gato na chaminé, boneco no sótão). Objetos de jogo e trilho (grind = "varal de luzinhas")
 * seguem o mapa §0.5/§2.3. `rampa`/`bandeira`/`portico`/`placa` caem no fallback genérico tingido na paleta da
 * Vila — mesmo nível de implementação do Picolé (`parque.ts` também não deu pele própria a esses tipos).
 */
import { PX_POR_METRO } from '../../core/constantes';
import { criarRng, type Rng } from '../../core/rng';
import type { ObjetoPista, PistaGerada, Trilho } from '../../core/contratos';
import type { EstadoCamera } from '../mundo';
import { mundoParaTela, pxPorMetro } from '../mundo';
import { alturaDoTerreno, ESPESSURA_MANTA_NEVE_PX } from '../terreno';
import type { CamadaParallax, Parallax } from '../parallax';
import type { PintorTema } from './tipos';

// Paleta (docs/temas-pistas-m3.md §2.1):
const COR_CEU_TOPO = '#2A2257';
const COR_CEU_HORIZONTE = '#E88A5A';
const COR_ESTRELA = '#FFF3D6';
const COR_LUA = '#FFF3D6';

const COR_MONTANHA_DIST_SOMBRA = '#5B4A8A';
const COR_MONTANHA_DIST_LUZ = '#7564A3';
const COR_MONTANHA_DIST_NEVE = '#C8C1E6';

const COR_MONTANHA_MEDIA_SOMBRA = '#3F3570';
const COR_MONTANHA_MEDIA_LUZ = '#554A8A';
const COR_MONTANHA_MEDIA_NEVE = '#A9A3D6';

const COR_COLINA_SILHUETA = '#3A2E5C';
const COR_CHALE_CORPO = '#2A1F3D';
const COR_NEVE_TELHADO = '#C9CBEB';
const COR_JANELA_ACESA = '#FFB84D';
const COR_JANELA_APAGADA = '#1C1530';
const COR_CRUZETA_JANELA = '#120D20';
const COR_FUMACA = 'rgba(143, 134, 184, 0.45)';

const COR_CORDA_VARAL = '#E9D9B8';
const COR_POSTE_VARAL = '#2A1F3D';

const COR_CANECA = '#F2E3C2';
const COR_CHOCOLATE = '#6B3A2A';
const COR_MARSHMALLOW = '#FFFFFF';
const COR_GATO = '#FF8A1F';
const COR_OLHO_GATO = '#FFE08A';

const COR_TERRENO_MANTA = '#EAF0FF';
const COR_TERRENO_CORPO = '#8F9BD1';
const COR_TELHA = '#8A3B2E';
const COR_TELHA_SOMBRA = '#5E2620';
const COR_BORDA_TERRENO = '#7C88C2';
const COR_CONTORNO_SUPERFICIE = '#F4F7FF';

const COR_ENXAIMEL_VIGA = '#4A2E1B';

const COR_CHAMINE_TIJOLO = '#9C4A3A';
const COR_CHAMINE_JUNTA = '#6E2F24';
const COR_BARRIL_MADEIRA = '#7A4D2E';
const COR_BARRIL_ARO = '#3A3F4A';
const COR_TRENO_VERMELHO = '#C7301C';
const COR_TRENO_ESQUI = '#4A2E1B';

const COR_CONTORNO_ESCURO = '#0B1630'; // contorno duplo, parte escura (L1 em tema noturno)
const COR_ARO_LANTERNA = '#FFD9A0'; // contorno duplo, aro claro (topo/esquerda)
const COR_CONTORNO_CLARO = '#F4F7FF'; // atravessável (boneco), nunca escuro

const COR_GORRO_CIDINHA = '#E85D8A';

const CORES_LUZINHA = ['#FFB84D', '#FF5C8A', '#9FE3FF', '#3DDC97'] as const;

const SEMENTE_VISUAL_VILA = 20261024;

/** Hash puro (regra 0.1-4): decoração determinística por índice, não `Math.random`. */
function hashDeterministico(n: number): number {
  let h = (n ^ 0x5bd1e995) >>> 0;
  h = Math.imul(h, 2654435761) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

function corLuzinhaPor(indice: number): string {
  return CORES_LUZINHA[hashDeterministico(indice) % CORES_LUZINHA.length] as string;
}

/** Brilho de lanterna/lâmpada SEM gradiente por quadro (regra 0.1-5): 3 círculos de alfa empilhados. */
function desenharBrilhoLanterna(ctx: CanvasRenderingContext2D, x: number, y: number, raio: number): void {
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 184, 77, 0.12)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, raio * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 184, 77, 0.28)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, raio * 0.25, 0, Math.PI * 2);
  ctx.fillStyle = COR_JANELA_ACESA;
  ctx.fill();
}

// --- Céu vivo: degradê + brilho do poente + estrelas + lua crescente (§2.2.1) ---

function desenharCeuVila(ctx: CanvasRenderingContext2D, largura: number, altura: number): void {
  const ceu = ctx.createLinearGradient(0, 0, 0, altura);
  ceu.addColorStop(0, COR_CEU_TOPO);
  ceu.addColorStop(1, COR_CEU_HORIZONTE);
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, largura, altura);

  // Brilho do poente: radial em (10%, 58%), raio 300 (§2.1)
  const brilho = ctx.createRadialGradient(largura * 0.1, altura * 0.58, 10, largura * 0.1, altura * 0.58, 300);
  brilho.addColorStop(0, 'rgba(255, 170, 90, 0.35)');
  brilho.addColorStop(1, 'rgba(255, 170, 90, 0)');
  ctx.fillStyle = brilho;
  ctx.fillRect(0, 0, largura, altura);

  // 24 estrelas, só nos 35% de cima, raio 1 a 1,6 (determinístico por índice)
  for (let i = 0; i < 24; i += 1) {
    const h = hashDeterministico(i * 7919 + 11);
    const x = (h % 1000) / 1000 * largura;
    const y = ((Math.floor(h / 1000) % 1000) / 1000) * (altura * 0.35);
    const r = 1 + ((h >> 5) % 7) / 10;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = COR_ESTRELA;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Lua crescente em (16%, 13%), raio 16: 2 arcos de winding oposto, sem recortar com a cor do céu (nonzero fill)
  const lx = largura * 0.16;
  const ly = altura * 0.13;
  ctx.beginPath();
  ctx.arc(lx, ly, 16, 0, Math.PI * 2, false);
  ctx.arc(lx + 7, ly, 16, 0, Math.PI * 2, true);
  ctx.fillStyle = COR_LUA;
  ctx.fill();
}

// --- Camada 1: morros distantes, arredondados e mais baixos que o Morro (§2.2.2) ---

function desenharMontanhasDistantesVila(ctx: CanvasRenderingContext2D, rng: Rng, largura: number, altura: number): void {
  const baseY = altura * 0.32;
  const FATOR_ALTURA = 0.6; // "picos a 60% da altura dos do Morro" (§2.2.2)
  const picos: { x: number; y: number }[] = [
    { x: 0, y: baseY - 35 * FATOR_ALTURA },
    { x: 120, y: baseY - 80 * FATOR_ALTURA },
    { x: 250, y: baseY - 50 * FATOR_ALTURA },
    { x: 390, y: baseY - 95 * FATOR_ALTURA },
    { x: 530, y: baseY - 45 * FATOR_ALTURA },
    { x: 670, y: baseY - 85 * FATOR_ALTURA },
    { x: 810, y: baseY - 60 * FATOR_ALTURA },
    { x: largura, y: baseY - 35 * FATOR_ALTURA },
  ];

  ctx.beginPath();
  ctx.moveTo(0, altura);
  ctx.lineTo(0, picos[0]!.y);
  for (let i = 1; i < picos.length; i += 1) {
    const p0 = picos[i - 1]!;
    const p1 = picos[i]!;
    const meioX = (p0.x + p1.x) / 2;
    const cumeY = Math.min(p0.y, p1.y) - 18;
    ctx.quadraticCurveTo(meioX, cumeY, p1.x, p1.y);
  }
  ctx.lineTo(largura, altura);
  ctx.closePath();
  ctx.fillStyle = COR_MONTANHA_DIST_SOMBRA;
  ctx.fill();

  for (let i = 1; i < picos.length; i += 1) {
    const p0 = picos[i - 1]!;
    const p1 = picos[i]!;
    const meioX = (p0.x + p1.x) / 2;
    const cumeY = Math.min(p0.y, p1.y) - 18;

    // Faceta de luz na metade esquerda (DNA §0.1-1)
    ctx.beginPath();
    ctx.moveTo(p0.x, Math.max(p0.y, baseY - 6));
    ctx.quadraticCurveTo((p0.x + meioX) / 2, (p0.y + cumeY) / 2 - 5, meioX, cumeY);
    ctx.lineTo(meioX, baseY + 20);
    ctx.lineTo(p0.x, baseY + 20);
    ctx.closePath();
    ctx.fillStyle = COR_MONTANHA_DIST_LUZ;
    ctx.fill();

    // Capuz de neve lavanda no cume
    const raioNeve = 10 + rng.inteiro(5);
    ctx.beginPath();
    ctx.moveTo(meioX - raioNeve, cumeY + raioNeve * 0.6);
    ctx.lineTo(meioX, cumeY);
    ctx.lineTo(meioX + raioNeve * 0.85, cumeY + raioNeve * 0.8);
    ctx.lineTo(meioX, cumeY + raioNeve * 0.35);
    ctx.closePath();
    ctx.fillStyle = COR_MONTANHA_DIST_NEVE;
    ctx.fill();
  }
}

// --- Camada 2: montanhas médias facetadas, janelinhas acesas soltas (§2.2.3) ---

function desenharMontanhasMediasVila(ctx: CanvasRenderingContext2D, largura: number, altura: number): void {
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
    ctx.beginPath();
    ctx.moveTo(cume.x - 14, cume.y + 10);
    ctx.lineTo(cume.x, cume.y);
    ctx.lineTo(cume.x + 12, cume.y + 12);
    ctx.lineTo(cume.x, cume.y + 5);
    ctx.closePath();
    ctx.fillStyle = COR_MONTANHA_MEDIA_NEVE;
    ctx.fill();
  }

  // 5 janelinhas acesas soltas nas encostas (§2.2.3: "as casas longe, lidas só pela luz")
  const janelas: { x: number; y: number }[] = [
    { x: 55, y: baseY + 10 },
    { x: 220, y: baseY + 18 },
    { x: 450, y: baseY + 8 },
    { x: 690, y: baseY + 20 },
    { x: 900, y: baseY + 12 },
  ];
  ctx.fillStyle = COR_JANELA_ACESA;
  for (const j of janelas) ctx.fillRect(j.x - 1.5, j.y - 1.5, 3, 3);
}

// --- Camada 3: silhueta — colina + 8 chalés + 2 varais + praça + gags (§2.2.4) ---

function desenharFumaca(ctx: CanvasRenderingContext2D, x: number, topoY: number): void {
  ctx.fillStyle = COR_FUMACA;
  for (let i = 0; i < 3; i += 1) {
    const r = 3 + i * 1.6;
    ctx.beginPath();
    ctx.arc(x + i * 3, topoY - i * 7, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function desenharJanelaChale(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, aceso: boolean): void {
  ctx.fillStyle = aceso ? COR_JANELA_ACESA : COR_JANELA_APAGADA;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.strokeStyle = COR_CRUZETA_JANELA;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x, y + h / 2);
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x + w / 2, y);
  ctx.stroke();
}

function desenharChale(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  largura: number,
  indice: number,
  comGato: boolean,
  comBonecoSotao: boolean
): number {
  const alturaParede = largura * 0.9;
  const alturaTelhado = largura * 0.7; // "íngreme" (§2.2.4: altura = 0,7 × largura)
  const topoParedeY = baseY - alturaParede;
  const apiceY = topoParedeY - alturaTelhado;

  // Corpo
  ctx.fillStyle = COR_CHALE_CORPO;
  ctx.fillRect(x - largura / 2, topoParedeY, largura, alturaParede);

  // Telhado de duas águas
  ctx.beginPath();
  ctx.moveTo(x - largura * 0.58, topoParedeY);
  ctx.lineTo(x, apiceY);
  ctx.lineTo(x + largura * 0.58, topoParedeY);
  ctx.closePath();
  ctx.fillStyle = COR_CHALE_CORPO;
  ctx.fill();

  // Capuz de neve grosso no telhado
  ctx.beginPath();
  ctx.moveTo(x - largura * 0.58, topoParedeY);
  ctx.lineTo(x, apiceY);
  ctx.lineTo(x + largura * 0.58, topoParedeY);
  ctx.lineTo(x + largura * 0.4, topoParedeY + 3);
  ctx.lineTo(x, apiceY + 10);
  ctx.lineTo(x - largura * 0.4, topoParedeY + 3);
  ctx.closePath();
  ctx.fillStyle = COR_NEVE_TELHADO;
  ctx.fill();

  // Chaminé numa água do telhado
  const chamineX = x + largura * 0.26;
  const chamineTopoY = apiceY + alturaTelhado * 0.38 - 10;
  ctx.fillStyle = COR_CHALE_CORPO;
  ctx.fillRect(chamineX - 3, chamineTopoY, 6, 14);
  desenharFumaca(ctx, chamineX, chamineTopoY);
  if (comGato) {
    ctx.fillStyle = COR_GATO;
    ctx.beginPath();
    ctx.ellipse(chamineX, chamineTopoY - 2, 4, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Rabo em S
    ctx.strokeStyle = COR_GATO;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(chamineX + 4, chamineTopoY - 2);
    ctx.quadraticCurveTo(chamineX + 8, chamineTopoY - 5, chamineX + 5, chamineTopoY - 8);
    ctx.stroke();
    ctx.fillStyle = COR_OLHO_GATO;
    ctx.beginPath();
    ctx.arc(chamineX - 2, chamineTopoY - 3, 0.7, 0, Math.PI * 2);
    ctx.arc(chamineX - 2, chamineTopoY - 1.5, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2 a 3 janelas por chalé (~60% acesas, tabela fixa via hash)
  const nJanelas = 2 + (hashDeterministico(indice * 31) % 2);
  for (let j = 0; j < nJanelas; j += 1) {
    const jx = x - largura * 0.26 + j * largura * 0.26;
    const jy = topoParedeY + alturaParede * 0.45;
    const aceso = hashDeterministico(indice * 17 + j) % 10 < 6;
    desenharJanelaChale(ctx, jx, jy, 6, 7, aceso);
  }

  if (comBonecoSotao) {
    // Boneco de neve recorrente: só cabeça e gorro, na janela do sótão
    const sx = x;
    const sy = apiceY + alturaTelhado * 0.6;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COR_CHALE_CORPO;
    ctx.beginPath();
    ctx.moveTo(sx - 4.5, sy - 2);
    ctx.quadraticCurveTo(sx, sy - 9, sx + 4.5, sy - 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COR_JANELA_ACESA;
    ctx.fillRect(sx + 3.5, sy, 2.5, 1.2); // nariz de cenoura pra fora
  }

  return apiceY;
}

function desenharVaralEntre(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number): void {
  const meioX = (x0 + x1) / 2;
  const flechaY = Math.min(y0, y1) - 14;

  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.quadraticCurveTo(meioX, flechaY, x1, y1);
  ctx.strokeStyle = COR_CORDA_VARAL;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const passos = 9;
  for (let i = 1; i < passos; i += 1) {
    const t = i / passos;
    const bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * meioX + t * t * x1;
    const by = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * flechaY + t * t * y1;
    ctx.beginPath();
    ctx.arc(bx, by + 2, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = corLuzinhaPor(i);
    ctx.fill();
  }
}

function desenharCanecaGigante(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  const w = 26;
  const h = 30;
  ctx.beginPath();
  ctx.roundRect(x - w / 2, baseY - h, w, h, 4);
  ctx.fillStyle = COR_CANECA;
  ctx.fill();

  // Alça em arco
  ctx.strokeStyle = COR_CANECA;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(x + w / 2 + 4, baseY - h / 2, 7, Math.PI * 0.7, Math.PI * 1.4);
  ctx.stroke();

  // Chocolate na boca + 2 marshmallows
  ctx.fillStyle = COR_CHOCOLATE;
  ctx.beginPath();
  ctx.ellipse(x, baseY - h, w / 2 - 2, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COR_MARSHMALLOW;
  ctx.beginPath();
  ctx.arc(x - 4, baseY - h - 1, 2.6, 0, Math.PI * 2);
  ctx.arc(x + 5, baseY - h - 2, 2.2, 0, Math.PI * 2);
  ctx.fill();

  // Vapor (3 cachos)
  desenharFumaca(ctx, x, baseY - h - 4);
}

function desenharLampiao(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  ctx.fillStyle = COR_CHALE_CORPO;
  ctx.fillRect(x - 1.5, baseY - 26, 3, 26);
  desenharBrilhoLanterna(ctx, x, baseY - 28, 14);
}

function desenharCamadaSilhuetaVila(ctx: CanvasRenderingContext2D, largura: number, altura: number): void {
  const baseY = altura * 0.52; // mesma conta do Morro (§0.3)

  ctx.beginPath();
  ctx.moveTo(0, altura);
  ctx.lineTo(0, baseY - 8);
  ctx.quadraticCurveTo(largura * 0.25, baseY - 22, largura * 0.5, baseY - 12);
  ctx.quadraticCurveTo(largura * 0.75, baseY, largura, baseY - 8);
  ctx.lineTo(largura, altura);
  ctx.closePath();
  ctx.fillStyle = COR_COLINA_SILHUETA;
  ctx.fill();

  // 8 chalés, larguras variadas (§2.2.4)
  const xs = [60, 160, 250, 380, 470, 610, 730, 880];
  const larguras = [34, 40, 46, 52, 38, 44, 48, 36];
  const apices: number[] = [];
  for (let i = 0; i < xs.length; i += 1) {
    const comGato = i === 6; // chalé x=730
    const comBoneco = i === 3; // chalé x=380
    const apiceY = desenharChale(ctx, xs[i]!, baseY - 2, larguras[i]!, i, comGato, comBoneco);
    apices.push(apiceY);
  }

  // Varais de luzinhas entre as cumeeiras (160->250) e (610->730): índices 1-2 e 5-6
  desenharVaralEntre(ctx, xs[1]!, apices[1]!, xs[2]!, apices[2]!);
  desenharVaralEntre(ctx, xs[5]!, apices[5]!, xs[6]!, apices[6]!);

  // Praça em x=540
  desenharCanecaGigante(ctx, 540, baseY - 2);
  desenharLampiao(ctx, 575, baseY - 2);
}

function construirCamadasVila(doc: Document | undefined, largura: number, altura: number): Parallax {
  const rng = criarRng(SEMENTE_VISUAL_VILA);

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
    const cDist = criarTile(desenharMontanhasDistantesVila, 0.04);
    if (cDist) camadas.push(cDist);
    const cMedia = criarTile((c, _r, l, a) => desenharMontanhasMediasVila(c, l, a), 0.1);
    if (cMedia) camadas.push(cMedia);
    const cSilhueta = criarTile((c, _r, l, a) => desenharCamadaSilhuetaVila(c, l, a), 0.22);
    if (cSilhueta) camadas.push(cSilhueta);
  }

  return {
    desenhar(ctx, cameraXm, tempoTicks) {
      desenharCeuVila(ctx, largura, altura);

      for (const camada of camadas) {
        const deslocPx = (((cameraXm * camada.fatorParallax * 8) % largura) + largura) % largura;
        ctx.drawImage(camada.tile, -deslocPx, 0, largura, altura);
        ctx.drawImage(camada.tile, largura - deslocPx, 0, largura, altura);
      }

      void tempoTicks;
    },
  };
}

// --- Objetos de jogo (§2.3) ---

function desenharChamine(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const topoY = y - h;
  const coroaW = w * 1.15;

  // Contorno duplo escuro embaixo (L1)
  ctx.fillStyle = COR_CONTORNO_ESCURO;
  ctx.fillRect(x - w / 2 - 1.5, topoY - 1.5, w + 3, h + 3);

  ctx.fillStyle = COR_CHAMINE_TIJOLO;
  ctx.fillRect(x - w / 2, topoY, w, h);

  // 3 fileiras de junta, horizontais + verticais desencontradas
  ctx.strokeStyle = COR_CHAMINE_JUNTA;
  ctx.lineWidth = 1;
  for (let f = 1; f <= 3; f += 1) {
    const fy = topoY + (h / 4) * f;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, fy);
    ctx.lineTo(x + w / 2, fy);
    ctx.stroke();
    const offset = f % 2 === 0 ? w * 0.25 : 0;
    ctx.beginPath();
    ctx.moveTo(x - w / 4 + offset, fy - h / 4);
    ctx.lineTo(x - w / 4 + offset, fy);
    ctx.moveTo(x + w / 4 - offset, fy - h / 4);
    ctx.lineTo(x + w / 4 - offset, fy);
    ctx.stroke();
  }

  // Coroa mais larga no topo com capuz de neve
  ctx.fillStyle = COR_CHAMINE_TIJOLO;
  ctx.fillRect(x - coroaW / 2, topoY - 4, coroaW, 5);
  ctx.fillStyle = COR_TERRENO_MANTA;
  ctx.fillRect(x - coroaW / 2, topoY - 6, coroaW, 3);

  // Aro de lanterna em cima/esquerda (contorno duplo, L1/§0.6)
  ctx.strokeStyle = COR_ARO_LANTERNA;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, topoY + h * 0.6);
  ctx.lineTo(x - w / 2, topoY - 6);
  ctx.lineTo(x + coroaW / 2, topoY - 6);
  ctx.stroke();

  // 2 cachos de fumaça parados, SEM contorno (não fazem parte do obstáculo)
  desenharFumaca(ctx, x, topoY - 7);
}

function desenharBarril(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const topoY = y - h;

  ctx.fillStyle = COR_CONTORNO_ESCURO;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 1.5, topoY - 1.5);
  ctx.quadraticCurveTo(x - w * 0.68, y / 2 + topoY / 2, x - w / 2 - 1.5, y + 1.5);
  ctx.lineTo(x + w / 2 + 1.5, y + 1.5);
  ctx.quadraticCurveTo(x + w * 0.68, y / 2 + topoY / 2, x + w / 2 + 1.5, topoY - 1.5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COR_BARRIL_MADEIRA;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, topoY);
  ctx.quadraticCurveTo(x - w * 0.62, (y + topoY) / 2, x - w / 2, y);
  ctx.lineTo(x + w / 2, y);
  ctx.quadraticCurveTo(x + w * 0.62, (y + topoY) / 2, x + w / 2, topoY);
  ctx.closePath();
  ctx.fill();

  // 3 aros
  ctx.strokeStyle = COR_BARRIL_ARO;
  ctx.lineWidth = 2;
  for (const frac of [0.2, 0.5, 0.8]) {
    const fy = topoY + h * frac;
    const bulge = w * 0.08 * Math.sin(frac * Math.PI);
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - bulge, fy);
    ctx.lineTo(x + w / 2 + bulge, fy);
    ctx.stroke();
  }

  // Tampa de neve
  ctx.fillStyle = COR_TERRENO_MANTA;
  ctx.beginPath();
  ctx.ellipse(x, topoY + 1, w * 0.42, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = COR_ARO_LANTERNA;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h * 0.3);
  ctx.quadraticCurveTo(x - w * 0.6, (y + topoY) / 2, x - w / 2, topoY + 2);
  ctx.stroke();
}

function desenharTrenoEstacionado(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const assentoH = h * 0.55;
  const assentoY = y - h * 0.4;

  ctx.fillStyle = COR_CONTORNO_ESCURO;
  ctx.fillRect(x - w / 2 - 1.5, assentoY - assentoH - 1.5, w + 3, assentoH + 3);

  // Assento em "L"
  ctx.fillStyle = COR_TRENO_VERMELHO;
  ctx.fillRect(x - w / 2, assentoY - assentoH, w, assentoH);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(x - w / 2 + 2, assentoY - assentoH + 2, w * 0.18, assentoH - 4);

  // Almofada de neve no assento
  ctx.fillStyle = COR_TERRENO_MANTA;
  ctx.fillRect(x - w / 2, assentoY - assentoH, w, 3);

  // Esqui embaixo, virando para cima na frente
  ctx.strokeStyle = COR_TRENO_ESQUI;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x + w * 0.3, y);
  ctx.quadraticCurveTo(x + w / 2, y, x + w / 2, y - h * 0.22);
  ctx.stroke();

  ctx.strokeStyle = COR_ARO_LANTERNA;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, assentoY - 2);
  ctx.lineTo(x - w / 2, assentoY - assentoH + 2);
  ctx.lineTo(x + w / 2, assentoY - assentoH + 2);
  ctx.stroke();
}

function desenharPinheiroComLuzinhas(ctx: CanvasRenderingContext2D, x: number, baseY: number, alturaPx: number, comContorno: boolean): void {
  const larguraPx = alturaPx * 0.55;
  ctx.fillStyle = COR_ENXAIMEL_VIGA;
  ctx.fillRect(x - 2, baseY - alturaPx * 0.2, 4, alturaPx * 0.2);

  const andares = 3;
  for (let a = 0; a < andares; a += 1) {
    const fracY = a / andares;
    const yAndar = baseY - alturaPx * 0.2 - fracY * (alturaPx * 0.7);
    const hAndar = alturaPx * 0.4 * (1 - fracY * 0.25);
    const wAndar = larguraPx * (1 - fracY * 0.3);

    ctx.beginPath();
    ctx.moveTo(x - wAndar / 2, yAndar);
    ctx.lineTo(x, yAndar - hAndar);
    ctx.lineTo(x + wAndar / 2, yAndar);
    ctx.closePath();
    ctx.fillStyle = COR_COLINA_SILHUETA;
    ctx.fill();
    if (comContorno) {
      ctx.strokeStyle = COR_CONTORNO_ESCURO;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Zigue-zague de luzinhas, 1 ponto a cada 6px, ciclo de 4 cores (sem estrela na ponta, L5)
    const passo = 6;
    let i = 0;
    for (let lx = -wAndar / 2; lx <= wAndar / 2; lx += passo) {
      const t = (lx + wAndar / 2) / wAndar;
      const ly = yAndar - t * hAndar * (t < 0.5 ? t * 2 : (1 - t) * 2);
      ctx.beginPath();
      ctx.arc(x + lx, ly - hAndar * 0.15, 1.3, 0, Math.PI * 2);
      ctx.fillStyle = corLuzinhaPor(a * 10 + i);
      ctx.fill();
      i += 1;
    }
  }
}

function desenharBonecoGorroCaneca(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  const baseR = h * 0.28;
  const meioR = h * 0.21;
  const cabecaR = h * 0.16;

  const baseCy = y - baseR;
  const meioCy = baseCy - baseR * 0.75 - meioR * 0.75;
  const cabecaCy = meioCy - meioR * 0.75 - cabecaR * 0.75;

  ctx.strokeStyle = COR_CONTORNO_CLARO;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.arc(x, baseCy, baseR, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, meioCy, meioR, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, cabecaCy, cabecaR, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.stroke();

  // Olhos
  ctx.fillStyle = '#2E2238';
  ctx.beginPath();
  ctx.arc(x - 3, cabecaCy - 1, 1.5, 0, Math.PI * 2);
  ctx.arc(x + 3, cabecaCy - 1, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Nariz de cenoura
  ctx.fillStyle = COR_JANELA_ACESA;
  ctx.beginPath();
  ctx.moveTo(x, cabecaCy);
  ctx.lineTo(x + 8, cabecaCy + 2);
  ctx.lineTo(x, cabecaCy + 3);
  ctx.closePath();
  ctx.fill();

  // Gorro de pompom rosa-goiaba (homenagem à Cidinha), no lugar do chapéu
  const gorroTopoY = cabecaCy - cabecaR - 6;
  ctx.fillStyle = COR_GORRO_CIDINHA;
  ctx.beginPath();
  ctx.moveTo(x - cabecaR * 0.9, cabecaCy - cabecaR * 0.3);
  ctx.quadraticCurveTo(x, gorroTopoY, x + cabecaR * 0.9, cabecaCy - cabecaR * 0.3);
  ctx.lineTo(x + cabecaR * 0.7, cabecaCy + cabecaR * 0.1);
  ctx.lineTo(x - cabecaR * 0.7, cabecaCy + cabecaR * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, gorroTopoY - 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Caneca na mão-graveto com 1 cacho de vapor
  ctx.strokeStyle = COR_ENXAIMEL_VIGA;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - meioR * 0.9, meioCy);
  ctx.lineTo(x - meioR * 1.7, meioCy - 6);
  ctx.stroke();
  ctx.fillStyle = COR_CANECA;
  ctx.fillRect(x - meioR * 1.9, meioCy - 10, 6, 7);
  desenharFumaca(ctx, x - meioR * 1.7, meioCy - 11);
}

function desenharColetavelVila(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  const r = h * 0.4;
  const cy = y - h * 0.5;

  // Marshmallow flutuante com brilho de lanterna atrás (tema aconchegante, distinto do confeito do Picolé)
  desenharBrilhoLanterna(ctx, x, cy, r * 1.8);

  ctx.beginPath();
  ctx.roundRect(x - r * 0.75, cy - r * 0.6, r * 1.5, r * 1.2, r * 0.3);
  ctx.fillStyle = COR_MARSHMALLOW;
  ctx.fill();
  ctx.strokeStyle = '#E3DCF0';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 184, 77, 0.5)';
  ctx.beginPath();
  ctx.arc(x - 1, cy - 1, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** "Galho" (`CamadaJogo.obstaculosAltos`, C4) na pele da Vila: viga de enxaimel quebrada fincada na neve --
 *  antes caía no fallback genérico (retângulo cinza liso). Mesma silhueta de `bosque.ts: desenharGalho`, madeira
 *  escura de viga (`COR_ENXAIMEL_VIGA`) + galho claro de barril (`COR_BARRIL_MADEIRA`) + neve de marshmallow. */
function desenharGalhoVila(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const topoY = y - h;
  const meioW = w * 0.16;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - meioW, y);
  ctx.lineTo(x - meioW * 0.5, topoY + h * 0.12);
  ctx.lineTo(x + meioW * 0.9, topoY);
  ctx.lineTo(x + meioW * 1.1, topoY + h * 0.18);
  ctx.lineTo(x + meioW * 0.3, y);
  ctx.closePath();
  ctx.fillStyle = COR_ENXAIMEL_VIGA;
  ctx.fill();
  ctx.strokeStyle = COR_CONTORNO_ESCURO;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.42);
  ctx.lineTo(x + w * 0.46, y - h * 0.62);
  ctx.lineTo(x + w * 0.4, y - h * 0.52);
  ctx.lineTo(x + meioW * 0.4, y - h * 0.36);
  ctx.closePath();
  ctx.fillStyle = COR_BARRIL_MADEIRA;
  ctx.fill();
  ctx.strokeStyle = COR_CONTORNO_ESCURO;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(x + meioW * 0.2, topoY + h * 0.03, w * 0.26, h * 0.09, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = COR_MARSHMALLOW;
  ctx.fill();
  ctx.strokeStyle = COR_CONTORNO_ESCURO;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function desenharObjetoVila(ctx: CanvasRenderingContext2D, obj: ObjetoPista, xTela: number, yTela: number, escala: number): void {
  const larguraPx = Math.max(8, obj.largura * escala);
  const alturaPx = Math.max(8, obj.altura * escala);

  ctx.save();
  switch (obj.tipo) {
    case 'pedra':
      if (obj.variante === 1) desenharBarril(ctx, xTela, yTela, larguraPx, alturaPx);
      else desenharChamine(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'tronco':
      desenharTrenoEstacionado(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'pinheiro':
      desenharPinheiroComLuzinhas(ctx, xTela, yTela, alturaPx, true);
      break;
    case 'boneco-de-neve':
      desenharBonecoGorroCaneca(ctx, xTela, yTela, alturaPx);
      break;
    case 'floco':
      desenharColetavelVila(ctx, xTela, yTela, alturaPx);
      break;
    case 'galho':
      desenharGalhoVila(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    default:
      // Fallback genérico tingido na paleta da Vila (`rampa`/`bandeira`/`portico`/`placa`: mesmo nível do
      // Picolé — ver memória `pintor-tema-wire-por-defpista-tema`, nenhum dos dois temas novos deu pele própria
      // a estes tipos ainda).
      ctx.fillStyle = COR_BORDA_TERRENO;
      ctx.fillRect(xTela - larguraPx / 2, yTela - alturaPx, larguraPx, alturaPx);
      ctx.strokeStyle = COR_CONTORNO_ESCURO;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(xTela - larguraPx / 2, yTela - alturaPx, larguraPx, alturaPx);
      ctx.fillStyle = COR_TERRENO_MANTA;
      ctx.fillRect(xTela - larguraPx / 2, yTela - alturaPx, larguraPx, 3);
      break;
  }
  ctx.restore();
}

// --- Trilho de grind: "varal de luzinhas" (§0.5/§2.3, regra L3) ---

function desenharTrilhoVaral(ctx: CanvasRenderingContext2D, trilho: Trilho, pista: PistaGerada, camera: EstadoCamera): void {
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const topoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm) + trilho.altura, camera, PX_POR_METRO);
  const chaoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm), camera, PX_POR_METRO);

  const pontosTopo: { x: number; y: number }[] = [];
  for (let xm = trilho.x0; xm <= trilho.x1; xm += pista.dx) pontosTopo.push(topoY(xm));
  const ultimoXm = trilho.x1;
  if (pontosTopo.length === 0 || pontosTopo[pontosTopo.length - 1]!.x !== topoY(ultimoXm).x) pontosTopo.push(topoY(ultimoXm));
  if (pontosTopo.length < 2) return;

  const posteW = Math.max(2, 4 * (escala / PX_POR_METRO));

  // Postes coloniais a cada <= 6 m, cada um com lanterna + brilho (sem gradiente por quadro, regra 0.1-5)
  ctx.fillStyle = COR_POSTE_VARAL;
  ctx.strokeStyle = COR_CONTORNO_ESCURO;
  ctx.lineWidth = 1.2;
  const ESPACO_POSTE_M = 6;
  for (let xm = trilho.x0; xm <= trilho.x1 + 0.001; xm += ESPACO_POSTE_M) {
    const xmClamp = Math.min(xm, trilho.x1);
    const pTopo = topoY(xmClamp);
    const pChao = chaoY(xmClamp);
    ctx.fillRect(pTopo.x - posteW / 2, pTopo.y, posteW, Math.max(0, pChao.y - pTopo.y));
    ctx.strokeRect(pTopo.x - posteW / 2, pTopo.y, posteW, Math.max(0, pChao.y - pTopo.y));
    desenharBrilhoLanterna(ctx, pTopo.x, pTopo.y - 2, 10);
  }

  // Corda: a superfície de grind (reta, clara) — contorno escuro embaixo (L3)
  const tracarCentro = (): void => {
    ctx.beginPath();
    ctx.moveTo(pontosTopo[0]!.x, pontosTopo[0]!.y);
    for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, pontosTopo[i]!.y);
  };

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.lineWidth = 6;
  ctx.strokeStyle = COR_CONTORNO_ESCURO;
  tracarCentro();
  ctx.stroke();

  ctx.lineWidth = 3;
  ctx.strokeStyle = COR_CORDA_VARAL;
  tracarCentro();
  ctx.stroke();

  // Lâmpadas penduradas EMBAIXO da corda (nunca em cima, §2.3), a cada 9 px, ciclo de 4 cores
  let i = 0;
  for (let xm = trilho.x0; xm <= trilho.x1; xm += pista.dx) {
    const p = topoY(xm);
    const passoPx = 9;
    if (Math.round(p.x) % passoPx < pista.dx * escala) {
      ctx.beginPath();
      ctx.arc(p.x, p.y + 2, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = corLuzinhaPor(i);
      ctx.fill();
      i += 1;
    }
  }
}

// --- Terreno: "telhado sem fim" (§2.2.5) ---

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

function desenharTerrenoVila(
  ctx: CanvasRenderingContext2D,
  pista: PistaGerada,
  _camera: EstadoCamera,
  superficie: readonly { x: number; y: number }[],
  espessuraMantaPx: number
): void {
  const primeiro = superficie[0]!;
  const ultimo = superficie[superficie.length - 1]!;
  const FUNDO_PX = 4000;

  // 1. Corpo do terreno (#8F9BD1), polígono estendido além da tela — só FILL (regra `webkit-stroke-coordenadas-extremas`)
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  ctx.lineTo(ultimo.x, ultimo.y + FUNDO_PX);
  ctx.lineTo(primeiro.x, primeiro.y + FUNDO_PX);
  ctx.closePath();
  ctx.fillStyle = COR_TERRENO_CORPO;
  ctx.fill();

  // 2. Manta (#EAF0FF)
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  for (let i = superficie.length - 1; i >= 0; i -= 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y + espessuraMantaPx);
  ctx.closePath();
  ctx.fillStyle = COR_TERRENO_MANTA;
  ctx.fill();

  // 3. Faixa de telha colonial logo abaixo da manta ("os telhados viraram pista", §2.2.5)
  const fator = espessuraMantaPx / ESPESSURA_MANTA_NEVE_PX;
  desenharFaixaParalela(ctx, superficie, espessuraMantaPx, espessuraMantaPx + 9 * fator, COR_TELHA);

  // Escamas: marcas de sombra na base da telha, cap 50/quadro (mesmo espírito do granulado do Picolé, §1.2.5)
  const passoM = Math.max(1, Math.round(1.2 / pista.dx));
  let desenhadas = 0;
  ctx.fillStyle = COR_TELHA_SOMBRA;
  for (let i = 0; i < superficie.length && desenhadas < 50; i += passoM) {
    const p = superficie[i]!;
    ctx.beginPath();
    ctx.arc(p.x, p.y + espessuraMantaPx + 9 * fator, 3 * fator, 0, Math.PI, false);
    ctx.fill();
    desenhadas += 1;
  }

  // 4. Janelas no corpo: a cada 11 m, hash decide se aparece; teto 6 por quadro (§2.2.5)
  const passoJanelaM = Math.max(1, Math.round(11 / pista.dx));
  let janelasDesenhadas = 0;
  for (let i = 0; i < superficie.length && janelasDesenhadas < 6; i += passoJanelaM) {
    const h = hashDeterministico(i * 13 + 5);
    if (h % 10 >= 7) continue; // hash decide (~70% de chance nos marcos de 11 m)
    const p = superficie[i]!;
    const jy = p.y + espessuraMantaPx + 9 * fator + 24 * fator;
    desenharBrilhoLanterna(ctx, p.x, jy, 10 * fator);
    ctx.fillStyle = COR_JANELA_ACESA;
    ctx.fillRect(p.x - 4 * fator, jy - 5 * fator, 8 * fator, 10 * fator);
    janelasDesenhadas += 1;
  }

  // 5. Borda entre a telha e o corpo
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y + espessuraMantaPx + 9 * fator);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y + espessuraMantaPx + 9 * fator);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COR_BORDA_TERRENO;
  ctx.stroke();

  // 6. Contorno da superfície: caminho ISOLADO, só pontos da superfície (mesma regra do item 1)
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = COR_CONTORNO_SUPERFICIE;
  ctx.stroke();
}

export const pintorVila: PintorTema = {
  construirCamadas: (doc, largura, altura) => construirCamadasVila(doc, largura, altura),
  desenharObjeto: desenharObjetoVila,
  desenharTrilho: desenharTrilhoVaral,
  desenharTerreno: desenharTerrenoVila,
};
