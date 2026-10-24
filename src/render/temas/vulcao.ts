/**
 * Tema `vulcao` (Vulcão Pé-Gelado, `vulcao-pe-gelado`): docs/temas-pistas-m3.md §3. Crepúsculo frio: a lua no alto
 * à esquerda ilumina o gelo (DNA §0.1-1), e o magma faz um SEGUNDO aro quente embaixo à direita de cada obstáculo
 * duro — o efeito "duas luzes" da ficha (§3, "Hora e luz"). Mesma filosofia de `parque.ts`/`vila.ts`: tudo
 * pré-desenhado fora da tela no boot (`construirCamadas`), zero `Math.random` em runtime (hash determinístico por
 * índice), sem `shadowBlur`/`filter`/gradiente por quadro fora do céu (regra 0.1-5) — o brilho do vulcão e da
 * lanterna são círculos de alfa empilhados ou gradiente desenhado no TILE (uma vez), nunca por quadro.
 *
 * Camadas (fundo -> frente, §3.2): céu com lua + halo + estrelas fracas -> perfil distante com o cone do vulcão
 * (cratera, rios de lava, pluma) -> montanhas médias facetadas com capuz de gelo e rachaduras de magma -> colina
 * com grupos de colunas de basalto, 2 gêiseres de fundo, a estação da Professora (termômetro gigante) e a chaleira
 * sobre a rachadura. Objetos de jogo e trilho (grind = "ponte de basalto") seguem o mapa §0.5/§3.3. Igual ao
 * Picolé/Vila (memória `pintor-tema-nivel-de-pele-espelha-precedente`): NÃO implementa feição SUBIDA/QUEDA (a
 * crosta de gêiser e a parede de basalto da ficha ficam para quando essa pele entrar no pintor-base) nem pele
 * própria para `rampa`/`bandeira`/`portico`/`placa` — mesmo fallback genérico tingido na paleta do tema.
 */
import { PX_POR_METRO } from '../../core/constantes';
import { criarRng, type Rng } from '../../core/rng';
import type { ObjetoPista, PistaGerada, Trilho } from '../../core/contratos';
import type { EstadoCamera } from '../mundo';
import { mundoParaTela, pxPorMetro } from '../mundo';
import { alturaDoTerreno, ESPESSURA_MANTA_NEVE_PX } from '../terreno';
import type { CamadaParallax, Parallax } from '../parallax';
import type { PintorTema } from './tipos';

// Paleta (docs/temas-pistas-m3.md §3.1):
const COR_CEU_TOPO = '#1F2A55';
const COR_CEU_HORIZONTE = '#7A5A8A';
const COR_LUA = '#DDEBFA';
const COR_ESTRELA = '#EEF5FF';

const COR_MONTANHA_DIST_SOMBRA = '#3A3F66';
const COR_MONTANHA_DIST_LUZ = '#50578A';
const COR_MONTANHA_DIST_NEVE = '#BCCBE8';
const COR_CRATERA = '#FF6A1F';
const COR_CRATERA_BORDA = '#FFB23F';
const COR_PLUMA = 'rgba(140, 134, 168, 0.5)';

const COR_MONTANHA_MEDIA_SOMBRA = '#2B2E45';
const COR_MONTANHA_MEDIA_LUZ = '#3E4366';
const COR_MONTANHA_MEDIA_GELO = '#A9BCE0';

const COR_COLINA_SILHUETA = '#2A2638';
const COR_BASALTO_SILHUETA = '#1E1C26';
const COR_TOPO_PRISMA = '#3A3646';
const COR_GEISER_CROSTA = '#D8C9A3';
const COR_GEISER_SOMBRA = '#A8946E';
const COR_VAPOR = 'rgba(207, 200, 227, 0.4)';

const COR_TERRENO_MANTA = '#DDEBFA';
const COR_TERRENO_CORPO = '#7FA0C8';
const COR_BORDA_TERRENO = '#6E8EBA';
const COR_CONTORNO_SUPERFICIE = '#EEF5FF';

const COR_RACHADURA_TRACO = '#FF6A1F';
const COR_RACHADURA_MIOLO = '#FFD23F';
const COR_RACHADURA_HALO = 'rgba(255, 106, 31, 0.3)';

const COR_BASALTO_FACE_LUZ = '#4A4658';
const COR_BASALTO_FRENTE = '#2E2A38';
const COR_BASALTO_TOPO = '#5C5870';

const COR_PONTE_LAJE = '#6A6680';
const COR_PONTE_LUZ = '#8A86A0';
const COR_PONTE_JUNTA = '#2E2A38';
const COR_PONTE_GEADA = '#DDEBFA';
const COR_PONTE_PILAR = '#3A3646';

const COR_TERMOMETRO_TUBO = '#F7FBFF';
const COR_TERMOMETRO_BULBO = '#C7301C';
const COR_TERMOMETRO_FRIO = '#9FE3FF';
const COR_CHALEIRA = '#B8C4DA';
const COR_BACIA = '#B8C4DA';
const COR_TOALHA = '#FF5C8A';

const COR_CONTORNO_ESCURO = '#0B1630'; // contorno duplo, parte escura (L1 em tema escuro)
const COR_ARO_FRIO = '#BFD0EA'; // aro da lua: topo/esquerda
const COR_ARO_QUENTE = '#FF6A1F'; // aro do magma: baixo/direita (as "duas luzes" da ficha §3)
const COR_CONTORNO_CLARO = '#EEF5FF'; // atravessável (boneco), nunca escuro

const SEMENTE_VISUAL_VULCAO = 20261026;

/** Hash puro (regra 0.1-4): decoração determinística por índice, não `Math.random`. */
function hashDeterministico(n: number): number {
  let h = (n ^ 0x5bd1e995) >>> 0;
  h = Math.imul(h, 2654435761) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

/** Brilho do magma/lanterna SEM gradiente por quadro (regra 0.1-5): 3 círculos de alfa empilhados. */
function desenharBrilhoMagma(ctx: CanvasRenderingContext2D, x: number, y: number, raio: number): void {
  ctx.beginPath();
  ctx.arc(x, y, raio, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 106, 31, 0.12)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, raio * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 106, 31, 0.28)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, raio * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = COR_CRATERA_BORDA;
  ctx.fill();
}

function desenharVapor(ctx: CanvasRenderingContext2D, x: number, topoY: number, n = 3): void {
  ctx.fillStyle = COR_VAPOR;
  for (let i = 0; i < n; i += 1) {
    const r = 3 + i * 1.7;
    ctx.beginPath();
    ctx.arc(x + i * 2.5, topoY - i * 7, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Céu vivo: degradê + lua com halo + estrelas fracas (§3.2.1) ---

function desenharCeuVulcao(ctx: CanvasRenderingContext2D, largura: number, altura: number): void {
  const ceu = ctx.createLinearGradient(0, 0, 0, altura);
  ceu.addColorStop(0, COR_CEU_TOPO);
  ceu.addColorStop(1, COR_CEU_HORIZONTE);
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, largura, altura);

  // Lua fria em (16%, 12%), raio 14, com halo raio 60 (§3.1)
  const lx = largura * 0.16;
  const ly = altura * 0.12;
  const halo = ctx.createRadialGradient(lx, ly, 10, lx, ly, 60);
  halo.addColorStop(0, 'rgba(221, 235, 250, 0.18)');
  halo.addColorStop(1, 'rgba(221, 235, 250, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, largura, altura);

  ctx.beginPath();
  ctx.arc(lx, ly, 14, 0, Math.PI * 2);
  ctx.fillStyle = COR_LUA;
  ctx.fill();

  // 12 estrelas fracas, só no terço de cima (§3.2.1)
  for (let i = 0; i < 12; i += 1) {
    const h = hashDeterministico(i * 7919 + 31);
    const x = ((h % 1000) / 1000) * largura;
    const y = ((Math.floor(h / 1000) % 1000) / 1000) * (altura * 0.33);
    ctx.beginPath();
    ctx.arc(x, y, 1 + ((h >> 5) % 6) / 10, 0, Math.PI * 2);
    ctx.fillStyle = COR_ESTRELA;
    ctx.globalAlpha = 0.6;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// --- Camada 1: distantes com o vulcão — cone, cratera, rios de lava, pluma (§3.2.2) ---

function desenharConeVulcao(ctx: CanvasRenderingContext2D, rng: Rng, cx: number, baseY: number): void {
  const baseW = 220;
  const topoW = 60;
  const alturaCone = 120;
  const topoY = baseY - alturaCone;

  // Brilho atrás da cratera, NO TILE (gradiente aqui é construção offscreen, não por quadro — regra 0.1-5)
  const brilho = ctx.createRadialGradient(cx, topoY + 6, 10, cx, topoY + 6, 140);
  brilho.addColorStop(0, 'rgba(255, 106, 31, 0.35)');
  brilho.addColorStop(1, 'rgba(255, 106, 31, 0)');
  ctx.fillStyle = brilho;
  ctx.fillRect(cx - 160, topoY - 100, 320, 220);

  // Corpo do cone (trapézio), sombra
  ctx.beginPath();
  ctx.moveTo(cx - baseW / 2, baseY);
  ctx.lineTo(cx - topoW / 2, topoY);
  ctx.lineTo(cx + topoW / 2, topoY);
  ctx.lineTo(cx + baseW / 2, baseY);
  ctx.closePath();
  ctx.fillStyle = COR_MONTANHA_DIST_SOMBRA;
  ctx.fill();

  // Faceta de luz na metade esquerda (DNA §0.1-1)
  ctx.beginPath();
  ctx.moveTo(cx - baseW / 2, baseY);
  ctx.lineTo(cx - topoW / 2, topoY);
  ctx.lineTo(cx, topoY);
  ctx.lineTo(cx, baseY);
  ctx.closePath();
  ctx.fillStyle = COR_MONTANHA_DIST_LUZ;
  ctx.fill();

  // 3 rios de lava descendo pela encosta (zigue-zague, traço forte + alfa por baixo, regra 0.1-5)
  const riosX = [cx - topoW * 0.3, cx + topoW * 0.1, cx + topoW * 0.35];
  for (let i = 0; i < riosX.length; i += 1) {
    const xTopo = riosX[i]!;
    const h = hashDeterministico(i * 97 + 3);
    const pontos: { x: number; y: number }[] = [{ x: xTopo, y: topoY + 6 }];
    const passos = 4;
    for (let p = 1; p <= passos; p += 1) {
      const t = p / passos;
      const desvio = ((h >> (p * 2)) % 9) - 4;
      pontos.push({ x: xTopo + (cx - xTopo) * t * 0.3 + desvio, y: topoY + 6 + t * (baseY - topoY - 6) });
    }
    ctx.beginPath();
    ctx.moveTo(pontos[0]!.x, pontos[0]!.y);
    for (let p = 1; p < pontos.length; p += 1) ctx.lineTo(pontos[p]!.x, pontos[p]!.y);
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255, 106, 31, 0.3)';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COR_CRATERA;
    ctx.stroke();
  }

  // Cratera: elipse com borda (nunca chão de pouso, L2)
  ctx.beginPath();
  ctx.ellipse(cx, topoY + 2, 25, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = COR_CRATERA;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COR_CRATERA_BORDA;
  ctx.stroke();

  // Pluma de vapor: 5 círculos crescentes, derivando para a direita, alfa 0,5
  ctx.fillStyle = COR_PLUMA;
  for (let i = 0; i < 5; i += 1) {
    const r = 4 + i * 2.2;
    ctx.beginPath();
    ctx.arc(cx + i * 4, topoY - 6 - i * 10, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Neve nos ombros do cone, nunca na cratera (L2)
  ctx.fillStyle = COR_MONTANHA_DIST_NEVE;
  ctx.beginPath();
  ctx.moveTo(cx - topoW / 2, topoY);
  ctx.lineTo(cx - topoW / 2 - 14, topoY + 16);
  ctx.lineTo(cx - topoW / 2 + 4, topoY + 10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + topoW / 2, topoY);
  ctx.lineTo(cx + topoW / 2 + 14, topoY + 16);
  ctx.lineTo(cx + topoW / 2 - 4, topoY + 10);
  ctx.closePath();
  ctx.fill();

  void rng;
}

function desenharDistantesVulcao(ctx: CanvasRenderingContext2D, rng: Rng, largura: number, altura: number): void {
  const baseY = altura * 0.32;
  const FATOR_ALTURA = 0.5; // "perfil baixo e largo" (§3.2.2), mais baixo que o Morro/Vila
  const picos: { x: number; y: number }[] = [
    { x: 0, y: baseY - 35 * FATOR_ALTURA },
    { x: 150, y: baseY - 60 * FATOR_ALTURA },
    { x: 300, y: baseY - 40 * FATOR_ALTURA },
    { x: largura * 0.5, y: baseY - 30 * FATOR_ALTURA },
    { x: 700, y: baseY - 45 * FATOR_ALTURA },
    { x: 860, y: baseY - 30 * FATOR_ALTURA },
    { x: largura, y: baseY - 35 * FATOR_ALTURA },
  ];

  ctx.beginPath();
  ctx.moveTo(0, altura);
  ctx.lineTo(0, picos[0]!.y);
  for (let i = 1; i < picos.length; i += 1) {
    const p0 = picos[i - 1]!;
    const p1 = picos[i]!;
    const meioX = (p0.x + p1.x) / 2;
    const cumeY = Math.min(p0.y, p1.y) - 12;
    ctx.quadraticCurveTo(meioX, cumeY, p1.x, p1.y);
  }
  ctx.lineTo(largura, altura);
  ctx.closePath();
  ctx.fillStyle = COR_MONTANHA_DIST_SOMBRA;
  ctx.fill();

  // O cone fica entre x 420 e 640 (§3.2.2), no meio do perfil baixo
  desenharConeVulcao(ctx, rng, (420 + 640) / 2, baseY + 6);
}

// --- Camada 2: montanhas médias facetadas, capuz de gelo + 4 rachaduras de magma (§3.2.3) ---

function desenharRachaduraCrista(ctx: CanvasRenderingContext2D, x: number, y: number, comprimento: number): void {
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COR_RACHADURA_TRACO;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 4, y + comprimento * 0.4);
  ctx.lineTo(x - 2, y + comprimento * 0.7);
  ctx.lineTo(x + 3, y + comprimento);
  ctx.stroke();
}

function desenharMontanhasMediasVulcao(ctx: CanvasRenderingContext2D, largura: number, altura: number): void {
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

  const cumes: { x: number; y: number }[] = [];
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
    cumes.push(cume);
    ctx.beginPath();
    ctx.moveTo(cume.x - 14, cume.y + 10);
    ctx.lineTo(cume.x, cume.y);
    ctx.lineTo(cume.x + 12, cume.y + 12);
    ctx.lineTo(cume.x, cume.y + 5);
    ctx.closePath();
    ctx.fillStyle = COR_MONTANHA_MEDIA_GELO;
    ctx.fill();
  }

  // 4 rachaduras de magma descendo de cristas (§3.2.3)
  const indicesComRachadura = [0, 2, 4, 6].filter((i) => i < cumes.length);
  for (const i of indicesComRachadura) {
    const c = cumes[i]!;
    desenharRachaduraCrista(ctx, c.x, c.y + 6, 26);
  }
}

// --- Camada 3: silhueta — colina + colunas de basalto + gêiseres + estação + chaleira (§3.2.4) ---

function desenharGrupoBasalto(ctx: CanvasRenderingContext2D, x: number, baseY: number, indice: number): void {
  const n = 4 + (hashDeterministico(indice * 13) % 3); // 4 a 6 colunas
  let cx = x - (n * 12) / 2;
  for (let i = 0; i < n; i += 1) {
    const h = hashDeterministico(indice * 31 + i);
    const w = 10 + (h % 5);
    const altura = 24 + (h % 30);
    const topoY = baseY - altura;

    ctx.fillStyle = COR_BASALTO_SILHUETA;
    ctx.fillRect(cx, topoY, w, altura);

    // Topo plano (a "tampa" do prisma)
    ctx.fillStyle = COR_TOPO_PRISMA;
    ctx.fillRect(cx - 1, topoY - 3, w + 2, 3);

    // Neve em metade dos topos
    if (h % 2 === 0) {
      ctx.fillStyle = COR_TERRENO_MANTA;
      ctx.fillRect(cx - 1, topoY - 5, w + 2, 2);
    }

    cx += w + 2;
  }
}

function desenharGeiserFundo(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  ctx.beginPath();
  ctx.ellipse(x, baseY - 4, 16, 6, 0, Math.PI, 0, true);
  ctx.fillStyle = COR_GEISER_SOMBRA;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - 3, baseY - 5, 12, 5, 0, Math.PI, 0, true);
  ctx.fillStyle = COR_GEISER_CROSTA;
  ctx.fill();

  desenharVapor(ctx, x, baseY - 12, 6);
}

function desenharTermometroGigante(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  const w = 8;
  const h = 60;
  const topoY = baseY - h;

  ctx.beginPath();
  ctx.roundRect(x - w / 2, topoY, w, h - 10, 3);
  ctx.fillStyle = COR_TERMOMETRO_TUBO;
  ctx.fill();

  // Coluna interna: metade de baixo vermelha, metade de cima gelo (quente e frio ao mesmo tempo, §3.2.4)
  ctx.fillStyle = COR_TERMOMETRO_FRIO;
  ctx.fillRect(x - 1.5, topoY + 3, 3, (h - 10) * 0.5);
  ctx.fillStyle = COR_TERMOMETRO_BULBO;
  ctx.fillRect(x - 1.5, topoY + 3 + (h - 10) * 0.5, 3, (h - 10) * 0.5 - 3);

  // Bulbo
  ctx.beginPath();
  ctx.arc(x, baseY - 6, 7, 0, Math.PI * 2);
  ctx.fillStyle = COR_TERMOMETRO_BULBO;
  ctx.fill();
}

function desenharEstacaoProfessora(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  const w = 26;
  const h = 20;
  ctx.fillStyle = COR_BASALTO_SILHUETA;
  ctx.fillRect(x - w / 2, baseY - h, w, h);
  ctx.fillStyle = COR_TOPO_PRISMA;
  ctx.fillRect(x - w / 2 - 2, baseY - h - 3, w + 4, 4);

  // Antena
  ctx.strokeStyle = COR_TERMOMETRO_TUBO;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, baseY - h - 3);
  ctx.lineTo(x, baseY - h - 16);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, baseY - h - 18, 1.6, 0, Math.PI * 2);
  ctx.arc(x, baseY - h - 22, 1.2, 0, Math.PI * 2);
  ctx.fillStyle = COR_TERMOMETRO_TUBO;
  ctx.fill();

  // Anemômetro: cruz com 3 conchinhas
  const ax = x + w / 2 + 10;
  ctx.strokeStyle = COR_TERMOMETRO_TUBO;
  ctx.beginPath();
  ctx.moveTo(ax, baseY);
  ctx.lineTo(ax, baseY - 20);
  ctx.stroke();
  for (let i = 0; i < 3; i += 1) {
    const ang = (i * 120 * Math.PI) / 180;
    ctx.beginPath();
    ctx.arc(ax + Math.cos(ang) * 6, baseY - 20 + Math.sin(ang) * 6, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = COR_TERMOMETRO_TUBO;
    ctx.fill();
  }

  desenharTermometroGigante(ctx, x - w / 2 - 14, baseY);
}

function desenharChaleiraGag(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  const w = 20;
  const h = 12;
  ctx.beginPath();
  ctx.ellipse(x, baseY - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = COR_CHALEIRA;
  ctx.fill();

  // Bico
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - 2, baseY - h * 0.7);
  ctx.lineTo(x + w / 2 + 6, baseY - h * 0.9);
  ctx.lineTo(x + w / 2 - 2, baseY - h * 0.4);
  ctx.closePath();
  ctx.fill();

  // Alça
  ctx.strokeStyle = COR_CHALEIRA;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x - w * 0.1, baseY - h - 2, 5, Math.PI * 0.9, Math.PI * 2.1);
  ctx.stroke();

  desenharVapor(ctx, x, baseY - h - 6, 1);

  // Apoiada sobre rachadura de magma
  desenharRachaduraCrista(ctx, x - 6, baseY, 10);
  desenharBrilhoMagma(ctx, x, baseY + 2, 10);
}

function desenharCamadaSilhuetaVulcao(ctx: CanvasRenderingContext2D, largura: number, altura: number): void {
  const baseY = altura * 0.52; // mesma conta do Morro (§0.3)

  ctx.beginPath();
  ctx.moveTo(0, altura);
  ctx.lineTo(0, baseY - 8);
  ctx.quadraticCurveTo(largura * 0.25, baseY - 20, largura * 0.5, baseY - 10);
  ctx.quadraticCurveTo(largura * 0.75, baseY, largura, baseY - 8);
  ctx.lineTo(largura, altura);
  ctx.closePath();
  ctx.fillStyle = COR_COLINA_SILHUETA;
  ctx.fill();

  // 5 grupos de colunas de basalto (§3.2.4)
  const gruposX = [70, 250, 520, 760, 900];
  for (let i = 0; i < gruposX.length; i += 1) desenharGrupoBasalto(ctx, gruposX[i]!, baseY - 2, i);

  // 2 gêiseres de fundo
  desenharGeiserFundo(ctx, 170, baseY - 2);
  desenharGeiserFundo(ctx, 640, baseY - 2);

  // Estação da Professora (com o termômetro gigante) + chaleira sobre a rachadura
  desenharEstacaoProfessora(ctx, 380, baseY - 2);
  desenharChaleiraGag(ctx, 820, baseY - 2);
}

function construirCamadasVulcao(doc: Document | undefined, largura: number, altura: number): Parallax {
  const rng = criarRng(SEMENTE_VISUAL_VULCAO);

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
    const cDist = criarTile(desenharDistantesVulcao, 0.04);
    if (cDist) camadas.push(cDist);
    const cMedia = criarTile((c, _r, l, a) => desenharMontanhasMediasVulcao(c, l, a), 0.1);
    if (cMedia) camadas.push(cMedia);
    const cSilhueta = criarTile((c, _r, l, a) => desenharCamadaSilhuetaVulcao(c, l, a), 0.22);
    if (cSilhueta) camadas.push(cSilhueta);
  }

  return {
    desenhar(ctx, cameraXm, tempoTicks) {
      desenharCeuVulcao(ctx, largura, altura);

      for (const camada of camadas) {
        const deslocPx = (((cameraXm * camada.fatorParallax * 8) % largura) + largura) % largura;
        ctx.drawImage(camada.tile, -deslocPx, 0, largura, altura);
        ctx.drawImage(camada.tile, largura - deslocPx, 0, largura, altura);
      }

      void tempoTicks;
    },
  };
}

// --- Objetos de jogo (§3.3): contorno DUPLO + aro frio (cima/esquerda) + aro quente (baixo/direita) ---

/** O fundo escuro do contorno duplo (L1), por cima do qual cada peça desenha a aro frio e a aro quente. */
function desenharFundoContornoDuplo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = COR_CONTORNO_ESCURO;
  ctx.fillRect(x - w / 2 - 1.5, y - h - 1.5, w + 3, h + 3);
}

/** Aro frio (lua, cima/esquerda) + aro quente (magma, baixo/direita): as "duas luzes" da ficha §3. */
function desenharArosDuplos(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const topoY = y - h;
  ctx.lineWidth = 1;
  ctx.strokeStyle = COR_ARO_FRIO;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - h * 0.15);
  ctx.lineTo(x - w / 2, topoY);
  ctx.lineTo(x + w / 2, topoY);
  ctx.stroke();

  ctx.strokeStyle = COR_ARO_QUENTE;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, topoY + h * 0.15);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x - w / 2, y);
  ctx.stroke();
}

function desenharPrismaBasalto(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const topoY = y - h;
  const faceEsquerdaW = w * 0.38;

  desenharFundoContornoDuplo(ctx, x, y, w, h);

  ctx.fillStyle = COR_BASALTO_FACE_LUZ;
  ctx.fillRect(x - w / 2, topoY, faceEsquerdaW, h);
  ctx.fillStyle = COR_BASALTO_FRENTE;
  ctx.fillRect(x - w / 2 + faceEsquerdaW, topoY, w - faceEsquerdaW, h);

  // Topo: losango achatado com neve na metade esquerda
  const topoAltura = h * 0.14;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, topoY);
  ctx.lineTo(x, topoY - topoAltura);
  ctx.lineTo(x + w / 2, topoY);
  ctx.lineTo(x, topoY + topoAltura * 0.5);
  ctx.closePath();
  ctx.fillStyle = COR_BASALTO_TOPO;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x - w / 2, topoY);
  ctx.lineTo(x, topoY - topoAltura);
  ctx.lineTo(x, topoY + topoAltura * 0.5);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = COR_TERRENO_MANTA;
  ctx.fillRect(x - w / 2, topoY - topoAltura, w / 2, topoAltura * 1.5);
  ctx.restore();

  // 1 rachadura fina de magma na frente
  ctx.lineWidth = 1;
  ctx.strokeStyle = COR_RACHADURA_TRACO;
  ctx.beginPath();
  ctx.moveTo(x + faceEsquerdaW + (w - faceEsquerdaW) * 0.3, topoY + h * 0.2);
  ctx.lineTo(x + faceEsquerdaW + (w - faceEsquerdaW) * 0.15, topoY + h * 0.5);
  ctx.lineTo(x + faceEsquerdaW + (w - faceEsquerdaW) * 0.4, topoY + h * 0.85);
  ctx.stroke();

  desenharArosDuplos(ctx, x, y, w, h);
}

function desenharBombaVulcanica(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const topoY = y - h;
  const cy = topoY + h / 2;

  desenharFundoContornoDuplo(ctx, x, y, w, h);

  // Elipse irregular: 8 vértices perturbados por hash
  ctx.beginPath();
  for (let i = 0; i <= 8; i += 1) {
    const ang = (i / 8) * Math.PI * 2;
    const hh = hashDeterministico(Math.round(x) * 11 + i);
    const r = 1 + ((hh % 10) - 5) / 40;
    const px = x + Math.cos(ang) * (w / 2) * r;
    const py = cy + Math.sin(ang) * (h / 2) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.quadraticCurveTo(x + Math.cos(ang - 0.3) * (w / 2), cy + Math.sin(ang - 0.3) * (h / 2), px, py);
  }
  ctx.closePath();
  ctx.fillStyle = COR_BASALTO_FRENTE;
  ctx.fill();

  // 3 rachaduras brilhando
  ctx.lineWidth = 1;
  ctx.strokeStyle = COR_RACHADURA_TRACO;
  for (const frac of [0.3, 0.55, 0.75]) {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.25, topoY + h * frac);
    ctx.lineTo(x + w * 0.15, topoY + h * (frac + 0.05));
    ctx.stroke();
  }

  // Capuz de neve derretendo, com 2 gotas
  ctx.fillStyle = COR_TERRENO_MANTA;
  ctx.beginPath();
  ctx.ellipse(x, topoY + h * 0.14, w * 0.4, h * 0.12, 0, Math.PI, 0, true);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - w * 0.2, topoY + h * 0.26, 2, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.1, topoY + h * 0.3, 2, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  desenharArosDuplos(ctx, x, y, w, h);
}

function desenharColunaBasaltoTombada(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const corpoH = h * 0.55;
  const topoY = y - corpoH;
  const hexW = h * 0.5;

  desenharFundoContornoDuplo(ctx, x, y - corpoH / 2 + corpoH / 2, w, corpoH);

  // Corpo comprido
  ctx.fillStyle = COR_BASALTO_FRENTE;
  ctx.fillRect(x - w / 2 + hexW * 0.3, topoY, w - hexW * 0.3, corpoH);

  // Hexágono na ponta esquerda (a "seção", em luz)
  const hx = x - w / 2 + hexW * 0.3;
  const hy = topoY + corpoH / 2;
  ctx.beginPath();
  ctx.moveTo(hx, hy - corpoH / 2);
  ctx.lineTo(hx + hexW * 0.3, hy - corpoH * 0.3);
  ctx.lineTo(hx + hexW * 0.3, hy + corpoH * 0.3);
  ctx.lineTo(hx, hy + corpoH / 2);
  ctx.lineTo(hx - hexW * 0.3, hy + corpoH * 0.3);
  ctx.lineTo(hx - hexW * 0.3, hy - corpoH * 0.3);
  ctx.closePath();
  ctx.fillStyle = COR_BASALTO_FACE_LUZ;
  ctx.fill();

  // Juntas transversais a cada ~0,5 m (aproximação visual: faixas a cada 10 px)
  ctx.strokeStyle = COR_BASALTO_SILHUETA;
  ctx.lineWidth = 1;
  for (let jx = hx + hexW * 0.3; jx < x + w / 2; jx += 10) {
    ctx.beginPath();
    ctx.moveTo(jx, topoY);
    ctx.lineTo(jx, topoY + corpoH);
    ctx.stroke();
  }

  desenharArosDuplos(ctx, x, y, w, corpoH);
}

function desenharFumarolaBasalto(ctx: CanvasRenderingContext2D, x: number, y: number, _w: number, h: number): void {
  const larguraCol = h * 0.22;
  const xs = [x - larguraCol * 1.1, x, x + larguraCol * 1.1];
  const alturas = [h * 0.8, h, h * 0.7];

  for (let i = 0; i < xs.length; i += 1) {
    const colX = xs[i]!;
    const colH = alturas[i]!;
    const topoY = y - colH;

    desenharFundoContornoDuplo(ctx, colX, y, larguraCol, colH);
    ctx.fillStyle = i === 1 ? COR_BASALTO_FACE_LUZ : COR_BASALTO_FRENTE;
    ctx.fillRect(colX - larguraCol / 2, topoY, larguraCol, colH);
    ctx.fillStyle = COR_TOPO_PRISMA;
    ctx.fillRect(colX - larguraCol / 2 - 1, topoY - 3, larguraCol + 2, 3);
    desenharArosDuplos(ctx, colX, y, larguraCol, colH);

    if (i === 1) desenharVapor(ctx, colX, topoY - 3, 3);
  }
}

function desenharBonecoEscaldaPes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const baciaW = Math.max(w, 26);
  const baciaH = h * 0.3;
  const baciaY = y - baciaH;

  // Bacia de alumínio (trapézio) com faixa de luz
  ctx.beginPath();
  ctx.moveTo(x - baciaW / 2, y);
  ctx.lineTo(x - baciaW * 0.35, baciaY);
  ctx.lineTo(x + baciaW * 0.35, baciaY);
  ctx.lineTo(x + baciaW / 2, y);
  ctx.closePath();
  ctx.fillStyle = COR_BACIA;
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillRect(x - baciaW * 0.3, baciaY, baciaW * 0.12, baciaH * 0.6);

  desenharVapor(ctx, x - baciaW * 0.2, baciaY - 2, 2);
  desenharVapor(ctx, x + baciaW * 0.2, baciaY - 4, 2);

  // Boneco sentado: só 2 esferas (atravessável, contorno claro — L1)
  const r1 = h * 0.26;
  const r2 = h * 0.18;
  const cy1 = baciaY - r1 * 0.3;
  const cy2 = cy1 - r1 * 0.65 - r2 * 0.65;

  ctx.strokeStyle = COR_CONTORNO_CLARO;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, cy1, r1, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, cy2, r2, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.stroke();

  // Toalha rosa enrolada na cabeça
  ctx.fillStyle = COR_TOALHA;
  ctx.beginPath();
  ctx.ellipse(x, cy2 - r2 * 0.75, r2 * 0.95, r2 * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  // Olhos fechados de satisfação (2 arcos)
  ctx.strokeStyle = '#2E2238';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(x - 3, cy2, 2, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.arc(x + 3, cy2, 2, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

function desenharCristalFlocoVulcao(ctx: CanvasRenderingContext2D, x: number, y: number, h: number): void {
  const r = h * 0.4;
  const cy = y - h * 0.5;

  // Brilho quente por baixo do cristal de gelo: a dualidade da pista no próprio coletável
  desenharBrilhoMagma(ctx, x, cy + r * 0.3, r * 1.4);

  ctx.beginPath();
  ctx.moveTo(x, cy - r);
  ctx.lineTo(x + r * 0.6, cy - r * 0.2);
  ctx.lineTo(x, cy + r);
  ctx.lineTo(x - r * 0.6, cy - r * 0.2);
  ctx.closePath();
  ctx.fillStyle = COR_TERRENO_MANTA;
  ctx.fill();
  ctx.strokeStyle = COR_MONTANHA_MEDIA_GELO;
  ctx.lineWidth = 1.3;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.arc(x - 1, cy - 2, r * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

/** "Galho" (`CamadaJogo.obstaculosAltos`, C4) na pele do Vulcão: uma lasca de basalto fincada na neve, com uma
 *  rachadura em brasa -- antes caía no fallback genérico (retângulo cinza liso). Mesma silhueta de `bosque.ts:
 *  desenharGalho`, trocando madeira por `COR_BASALTO_SILHUETA` + fenda em `COR_CRATERA_BORDA` + gelo no topo. */
function desenharGalhoVulcao(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
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
  ctx.fillStyle = COR_BASALTO_SILHUETA;
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
  ctx.fillStyle = COR_CRATERA_BORDA;
  ctx.fill();
  ctx.strokeStyle = COR_CONTORNO_ESCURO;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(x + meioW * 0.2, topoY + h * 0.03, w * 0.26, h * 0.09, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = COR_TERRENO_MANTA;
  ctx.fill();
  ctx.strokeStyle = COR_CONTORNO_ESCURO;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function desenharObjetoVulcao(ctx: CanvasRenderingContext2D, obj: ObjetoPista, xTela: number, yTela: number, escala: number): void {
  const larguraPx = Math.max(8, obj.largura * escala);
  const alturaPx = Math.max(8, obj.altura * escala);

  ctx.save();
  switch (obj.tipo) {
    case 'pedra':
      if (obj.variante === 1) desenharBombaVulcanica(ctx, xTela, yTela, larguraPx, alturaPx);
      else desenharPrismaBasalto(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'tronco':
      desenharColunaBasaltoTombada(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'pinheiro':
      desenharFumarolaBasalto(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'boneco-de-neve':
      desenharBonecoEscaldaPes(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'floco':
      desenharCristalFlocoVulcao(ctx, xTela, yTela, alturaPx);
      break;
    case 'galho':
      desenharGalhoVulcao(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    default:
      // Fallback genérico tingido na paleta do Vulcão (`rampa`/`bandeira`/`portico`/`placa`: mesmo nível do
      // Picolé/Vila — ver memória `pintor-tema-nivel-de-pele-espelha-precedente`, nenhum dos 3 temas novos deu
      // pele própria a estes tipos ainda).
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

// --- Trilho de grind: "ponte de basalto" (§0.5/§3.3, regra L3) ---

function desenharTrilhoPonteBasalto(ctx: CanvasRenderingContext2D, trilho: Trilho, pista: PistaGerada, camera: EstadoCamera): void {
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const topoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm) + trilho.altura, camera, PX_POR_METRO);
  const chaoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm), camera, PX_POR_METRO);

  const pontosTopo: { x: number; y: number }[] = [];
  for (let xm = trilho.x0; xm <= trilho.x1; xm += pista.dx) pontosTopo.push(topoY(xm));
  const ultimoXm = trilho.x1;
  if (pontosTopo.length === 0 || pontosTopo[pontosTopo.length - 1]!.x !== topoY(ultimoXm).x) pontosTopo.push(topoY(ultimoXm));
  if (pontosTopo.length < 2) return;

  const espessura = Math.max(4, 7 * (escala / PX_POR_METRO));
  const pilarW = Math.max(2, 5 * (escala / PX_POR_METRO));

  // Pilares nas pontas e a cada <= 5 m (§3.3)
  ctx.fillStyle = COR_PONTE_PILAR;
  ctx.strokeStyle = COR_CONTORNO_ESCURO;
  ctx.lineWidth = 1.2;
  const ESPACO_PILAR_M = 5;
  for (let xm = trilho.x0; xm <= trilho.x1 + 0.001; xm += ESPACO_PILAR_M) {
    const xmClamp = Math.min(xm, trilho.x1);
    const pTopo = topoY(xmClamp);
    const pChao = chaoY(xmClamp);
    ctx.fillRect(pTopo.x - pilarW / 2, pTopo.y, pilarW, Math.max(0, pChao.y - pTopo.y));
    ctx.strokeRect(pTopo.x - pilarW / 2, pTopo.y, pilarW, Math.max(0, pChao.y - pTopo.y));
  }

  // Lajes: traço largo com contorno escuro embaixo (L3), juntas a cada ~1,5 m
  const tracarCentro = (): void => {
    ctx.beginPath();
    ctx.moveTo(pontosTopo[0]!.x, pontosTopo[0]!.y + espessura / 2);
    for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, pontosTopo[i]!.y + espessura / 2);
  };

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.lineWidth = espessura + 3;
  ctx.strokeStyle = COR_CONTORNO_ESCURO;
  tracarCentro();
  ctx.stroke();

  ctx.lineWidth = espessura;
  ctx.strokeStyle = COR_PONTE_LAJE;
  tracarCentro();
  ctx.stroke();

  // Faixa de luz no terço de cima
  ctx.lineWidth = espessura * 0.35;
  ctx.strokeStyle = COR_PONTE_LUZ;
  ctx.beginPath();
  ctx.moveTo(pontosTopo[0]!.x, pontosTopo[0]!.y + espessura * 0.2);
  for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, pontosTopo[i]!.y + espessura * 0.2);
  ctx.stroke();

  // Juntas verticais a cada ~1,5 m
  const ESPACO_JUNTA_M = 1.5;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = COR_PONTE_JUNTA;
  ctx.lineWidth = 2;
  for (let xm = trilho.x0; xm <= trilho.x1 + 0.001; xm += ESPACO_JUNTA_M) {
    const xmClamp = Math.min(xm, trilho.x1);
    const p = topoY(xmClamp);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, p.y + espessura);
    ctx.stroke();
  }

  // Fio de geada no topo, contraste >= 3:1 (regra L3; 12,10 contra a colina, §0.6)
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(pontosTopo[0]!.x, pontosTopo[0]!.y);
  for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, pontosTopo[i]!.y);
  ctx.strokeStyle = COR_PONTE_GEADA;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// --- Terreno: gelo com rachaduras de magma (§3.2.5) ---

function desenharRachaduraCorpo(ctx: CanvasRenderingContext2D, x: number, yTopo: number, comprimento: number, hash: number): void {
  const forma = hash % 3;
  const pontos: { x: number; y: number }[] =
    forma === 0
      ? [{ x, y: yTopo }, { x: x + 4, y: yTopo + comprimento * 0.4 }, { x: x - 2, y: yTopo + comprimento * 0.7 }, { x: x + 3, y: yTopo + comprimento }]
      : forma === 1
        ? [{ x, y: yTopo }, { x: x - 5, y: yTopo + comprimento * 0.5 }, { x: x + 2, y: yTopo + comprimento }]
        : [{ x, y: yTopo }, { x: x + 3, y: yTopo + comprimento * 0.3 }, { x: x + 5, y: yTopo + comprimento * 0.65 }, { x: x - 1, y: yTopo + comprimento }];

  const tracar = (): void => {
    ctx.beginPath();
    ctx.moveTo(pontos[0]!.x, pontos[0]!.y);
    for (let i = 1; i < pontos.length; i += 1) ctx.lineTo(pontos[i]!.x, pontos[i]!.y);
  };

  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  ctx.strokeStyle = COR_RACHADURA_HALO;
  tracar();
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = COR_RACHADURA_TRACO;
  tracar();
  ctx.stroke();

  ctx.lineWidth = 1;
  ctx.strokeStyle = COR_RACHADURA_MIOLO;
  tracar();
  ctx.stroke();
}

function desenharTerrenoVulcao(
  ctx: CanvasRenderingContext2D,
  pista: PistaGerada,
  _camera: EstadoCamera,
  superficie: readonly { x: number; y: number }[],
  espessuraMantaPx: number
): void {
  const primeiro = superficie[0]!;
  const ultimo = superficie[superficie.length - 1]!;
  const FUNDO_PX = 4000;

  // 1. Corpo do terreno (#7FA0C8), polígono estendido além da tela — só FILL (regra `webkit-stroke-coordenadas-extremas`)
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  ctx.lineTo(ultimo.x, ultimo.y + FUNDO_PX);
  ctx.lineTo(primeiro.x, primeiro.y + FUNDO_PX);
  ctx.closePath();
  ctx.fillStyle = COR_TERRENO_CORPO;
  ctx.fill();

  // 2. Manta de gelo-neve (#DDEBFA)
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  for (let i = superficie.length - 1; i >= 0; i -= 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y + espessuraMantaPx);
  ctx.closePath();
  ctx.fillStyle = COR_TERRENO_MANTA;
  ctx.fill();

  // 3. Rachaduras de magma no corpo: a cada 9 m, hash decide se aparece; teto 8 por quadro (§3.2.5).
  // Nunca encostam na manta (L2: o chão de pouso é gelo) — começam a `E + 12` px da superfície.
  const fator = espessuraMantaPx / ESPESSURA_MANTA_NEVE_PX;
  const passoM = Math.max(1, Math.round(9 / pista.dx));
  let desenhadas = 0;
  for (let i = 0; i < superficie.length && desenhadas < 8; i += passoM) {
    const h = hashDeterministico(i * 17 + 9);
    if (h % 3 !== 0) continue;
    const p = superficie[i]!;
    const comprimento = (20 + (h % 21)) * fator;
    desenharRachaduraCorpo(ctx, p.x, p.y + espessuraMantaPx + 12 * fator, comprimento, h);
    desenhadas += 1;
  }

  // 4. Borda entre a manta e o corpo
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y + espessuraMantaPx);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y + espessuraMantaPx);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COR_BORDA_TERRENO;
  ctx.stroke();

  // 5. Contorno da superfície: caminho ISOLADO, só com os pontos da superfície (mesma regra do item 1)
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = COR_CONTORNO_SUPERFICIE;
  ctx.stroke();
}

export const pintorVulcao: PintorTema = {
  construirCamadas: (doc, largura, altura) => construirCamadasVulcao(doc, largura, altura),
  desenharObjeto: desenharObjetoVulcao,
  desenharTrilho: desenharTrilhoPonteBasalto,
  desenharTerreno: desenharTerrenoVulcao,
};
