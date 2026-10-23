/**
 * Tema `cume` (Cume da Ventania, `cume-da-ventania`): docs/temas-pistas-m3.md §4, a ÚLTIMA pista. Madrugada com
 * AURORA, acima de um MAR DE NUVENS, minuano soprando (tudo inclinado pelo vento). Mesma filosofia de
 * `parque.ts`/`vila.ts`/`vulcao.ts`: tudo pré-desenhado fora da tela no boot (`construirCamadas`), zero
 * `Math.random` em runtime (hash determinístico por índice), sem `shadowBlur`/`filter`/gradiente por quadro fora
 * do céu (regra 0.1-5).
 *
 * Camadas (fundo -> frente, §4.2): céu com aurora + lua + estrelas -> distantes agudas e baixas (o jogador está
 * ACIMA delas) -> mar de nuvens cobrindo a base das distantes -> médias serrilhadas com cornijas penduradas ->
 * silhueta (colina + teleférico PARADO + refúgio + pinheiros tortos + biruta + gag do boneco agarrado ao poste).
 * Objetos de jogo e trilho (grind: corda < 1 m / cabo de teleférico >= 1 m, §4.3) seguem o mapa §0.5. Igual ao
 * Picolé/Vila/Vulcão (memória `pintor-tema-nivel-de-pele-espelha-precedente`): NÃO implementa feição SUBIDA/QUEDA
 * (a cornija enrolada e a fenda de gelo da ficha ficam para quando essa pele entrar no pintor-base) nem pele
 * própria para `rampa`/`bandeira`/`portico`/`placa` — mesmo fallback genérico tingido na paleta do tema. A
 * avalanche cômica (`reta-avalanche`) é mecânica visual da F6 (M3-D3) — aqui só a geometria plana do trecho.
 */
import { PX_POR_METRO } from '../../core/constantes';
import type { ObjetoPista, PistaGerada, Trilho } from '../../core/contratos';
import type { EstadoCamera } from '../mundo';
import { mundoParaTela, pxPorMetro } from '../mundo';
import { alturaDoTerreno, ESPESSURA_MANTA_NEVE_PX } from '../terreno';
import type { CamadaParallax, Parallax } from '../parallax';
import type { PintorTema } from './tipos';

// Paleta (docs/temas-pistas-m3.md §4.1):
const COR_CEU_TOPO = '#0C1230';
const COR_CEU_HORIZONTE = '#2C3E7A';
const COR_ESTRELA = '#E8F1FF';
const COR_LUA = '#E8F1FF';
const AURORA_MENTA_RGB = '92, 242, 194'; // #5CF2C2
const AURORA_ROXO_RGB = '138, 108, 255'; // #8A6CFF

const COR_MONTANHA_DIST_SOMBRA = '#3B4C86';
const COR_MONTANHA_DIST_LUZ = '#5468A6';
const COR_MONTANHA_DIST_NEVE = '#C9D8F5';

const COR_NUVEM_CORPO = '#5D6FA8';
const COR_NUVEM_TOPO = '#7F8FC4';
const COR_NUVEM_LUZ = '#A3B2DE';

const COR_MONTANHA_MEDIA_SOMBRA = '#27325E';
const COR_MONTANHA_MEDIA_LUZ = '#3A4A82';
const COR_MONTANHA_MEDIA_NEVE = '#B7C7EC';

const COR_COLINA_SILHUETA = '#1A2040';
const COR_REFUGIO_PAREDE = '#4A2E1B';
const COR_REFUGIO_JANELA = '#FFD23F';
const COR_FUMACA = 'rgba(232, 241, 255, 0.4)';

const COR_TELEFERICO_CABO = '#B8C4DA';
const COR_TELEFERICO_TORRE = '#3B4C86';
const COR_TELEFERICO_GONDOLA = '#C7301C';
const COR_TELEFERICO_JANELA = '#FFD23F';

const COR_BIRUTA_A = '#FF8A1F';
const COR_BIRUTA_B = '#F7FBFF';
const COR_BIRUTA_MASTRO = '#B8C4DA';

const COR_TERRENO_MANTA = '#E8F1FF';
const COR_TERRENO_CORPO = '#5D6FA8';
const COR_ESTILHACO_SOMBRA = '#8FA3D8';
const COR_ESTILHACO_LUZ = '#B7C7EC';
const COR_BORDA_TERRENO = '#4E5F98';
const COR_CONTORNO_SUPERFICIE = '#F4F8FF';
const COR_SASTRUGI = '#BFD0EE';

const COR_ROCHA_GELO_LUZ = '#B7D3FF';
const COR_ROCHA_GELO_MIOLO = '#7E9BD8';
const COR_ROCHA_GELO_SOMBRA = '#4E6BB0';
const COR_ROCHA_GELO_NEVE = '#E8F1FF';

const COR_BLOCO_GELO_FACE = '#9FE3FF';
const COR_BLOCO_GELO_FACE_ESCURA = '#5FB8E6';
const COR_BLOCO_GELO_REFLEXO = '#F7FBFF';

const COR_LAJE_CORNIJA = '#BFD0EE';

const COR_CORDA_FIBRA = '#C9A46A';
const COR_CORDA_TRANCA = '#8A6A3A';
const COR_CORDA_POSTE = '#4A2E1B';

const COR_CONTORNO_ESCURO = '#0B1630'; // contorno duplo, parte escura (L1)
const COR_ARO_LUA = '#E8F1FF'; // aro único (a lua é a única luz fria desta pista, §4)
const COR_CONTORNO_CLARO = '#F4F8FF'; // atravessável (boneco), nunca escuro

const COR_CACHECOL = '#C7301C';
const COR_CHAPEU = '#2E2238';
const COR_TRONCO = '#4A2E1B';
const COR_PINHEIRO_SOMBRA = '#1F3B5C';
const COR_PINHEIRO_LUZ = '#3A4A82';

/** Hash puro (regra 0.1-4): decoração determinística por índice, não `Math.random`. */
function hashDeterministico(n: number): number {
  let h = (n ^ 0x5bd1e995) >>> 0;
  h = Math.imul(h, 2654435761) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

/** O fundo escuro do contorno duplo (L1), por cima do qual cada peça desenha o aro de lua. */
function desenharFundoContornoDuplo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = COR_CONTORNO_ESCURO;
  ctx.fillRect(x - w / 2 - 1.5, y - h - 1.5, w + 3, h + 3);
}

/** Aro de lua: topo + esquerda (única luz fria desta pista, §4 "Hora e luz"). */
function desenharAroLua(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const topoY = y - h;
  ctx.lineWidth = 1;
  ctx.strokeStyle = COR_ARO_LUA;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x - w / 2, topoY);
  ctx.lineTo(x + w / 2, topoY);
  ctx.stroke();
}

function desenharFumacaDeitada(ctx: CanvasRenderingContext2D, x: number, y: number, n = 4): void {
  ctx.fillStyle = COR_FUMACA;
  for (let i = 0; i < n; i += 1) {
    const r = 3 + i * 1.6;
    ctx.beginPath();
    ctx.arc(x + i * 7, y - i * 1.5, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function desenharTorreTreliça(ctx: CanvasRenderingContext2D, x: number, baseY: number, altura: number, largura: number): void {
  const topoY = baseY - altura;
  ctx.beginPath();
  ctx.moveTo(x - largura / 2, baseY);
  ctx.lineTo(x - largura * 0.18, topoY);
  ctx.lineTo(x + largura * 0.18, topoY);
  ctx.lineTo(x + largura / 2, baseY);
  ctx.closePath();
  ctx.fillStyle = COR_TELEFERICO_TORRE;
  ctx.fill();

  ctx.strokeStyle = COR_TELEFERICO_CABO;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - largura * 0.42, baseY - altura * 0.08);
  ctx.lineTo(x + largura * 0.15, topoY + altura * 0.4);
  ctx.moveTo(x + largura * 0.42, baseY - altura * 0.08);
  ctx.lineTo(x - largura * 0.15, topoY + altura * 0.4);
  ctx.stroke();

  // Topo nevado
  ctx.fillStyle = COR_TERRENO_MANTA;
  ctx.fillRect(x - largura * 0.18 - 1, topoY - 2, largura * 0.36 + 2, 2);
}

// --- Céu vivo: degradê + aurora + lua com halo + estrelas (§4.2.1) ---

function desenharFaixaAurora(ctx: CanvasRenderingContext2D, largura: number, baseY: number, altura: number, corRgb: string, alfaBase: number): void {
  const grad = ctx.createLinearGradient(0, baseY - altura, 0, baseY);
  grad.addColorStop(0, `rgba(${corRgb}, 0)`);
  grad.addColorStop(1, `rgba(${corRgb}, ${alfaBase})`);
  ctx.beginPath();
  ctx.moveTo(0, baseY);
  ctx.quadraticCurveTo(largura * 0.25, baseY - altura * 0.6, largura * 0.5, baseY - altura * 0.2);
  ctx.quadraticCurveTo(largura * 0.75, baseY - altura * 0.7, largura, baseY - altura * 0.1);
  ctx.lineTo(largura, baseY - altura);
  ctx.quadraticCurveTo(largura * 0.75, baseY - altura * 1.5, largura * 0.5, baseY - altura * 1.1);
  ctx.quadraticCurveTo(largura * 0.25, baseY - altura * 1.5, 0, baseY - altura);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
}

function desenharCeuCume(ctx: CanvasRenderingContext2D, largura: number, altura: number): void {
  const ceu = ctx.createLinearGradient(0, 0, 0, altura);
  ceu.addColorStop(0, COR_CEU_TOPO);
  ceu.addColorStop(1, COR_CEU_HORIZONTE);
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, largura, altura);

  // A aurora não sobe acima de 25% da altura (regra de curadoria §4.3: não briga com o HUD)
  const limiteSuperior = altura * 0.25;
  desenharFaixaAurora(ctx, largura, altura * 0.42, Math.min(altura * 0.2, altura * 0.42 - limiteSuperior), AURORA_MENTA_RGB, 0.55);
  desenharFaixaAurora(ctx, largura, altura * 0.3, Math.min(altura * 0.14, altura * 0.3 - limiteSuperior), AURORA_ROXO_RGB, 0.3);

  // Lua fria em (14%, 11%), raio 18, halo raio 70 (§4.1)
  const lx = largura * 0.14;
  const ly = altura * 0.11;
  const halo = ctx.createRadialGradient(lx, ly, 12, lx, ly, 70);
  halo.addColorStop(0, 'rgba(232, 241, 255, 0.15)');
  halo.addColorStop(1, 'rgba(232, 241, 255, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, largura, altura);

  ctx.beginPath();
  ctx.arc(lx, ly, 18, 0, Math.PI * 2);
  ctx.fillStyle = COR_LUA;
  ctx.fill();

  // 40 estrelas, só no terço de cima (§4.2.1)
  for (let i = 0; i < 40; i += 1) {
    const h = hashDeterministico(i * 7919 + 61);
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

// --- Camada 1: distantes agudas e baixas — "estamos acima delas" (§4.2.2) ---

function desenharDistantesCume(ctx: CanvasRenderingContext2D, largura: number, altura: number): void {
  const baseY = altura * 0.4; // mais baixo que o Vulcão (0,32): o jogador está acima da cordilheira
  const picos: { x: number; y: number }[] = [
    { x: 0, y: baseY - 20 },
    { x: 110, y: baseY - 52 },
    { x: 220, y: baseY - 18 },
    { x: 340, y: baseY - 46 },
    { x: largura * 0.5, y: baseY - 14 },
    { x: 620, y: baseY - 40 },
    { x: 760, y: baseY - 16 },
    { x: 880, y: baseY - 36 },
    { x: largura, y: baseY - 18 },
  ];

  // Picos AGUDOS (linhas retas, não curvas) — mais afiados que o perfil arredondado do Vulcão/Morro
  ctx.beginPath();
  ctx.moveTo(0, altura);
  ctx.lineTo(0, picos[0]!.y);
  for (let i = 1; i < picos.length; i += 1) ctx.lineTo(picos[i]!.x, picos[i]!.y);
  ctx.lineTo(largura, altura);
  ctx.closePath();
  ctx.fillStyle = COR_MONTANHA_DIST_SOMBRA;
  ctx.fill();

  // Faceta esquerda em luz + capuz de neve longo em cada pico
  for (let i = 1; i < picos.length - 1; i += 1) {
    const p0 = picos[i - 1]!;
    const p1 = picos[i]!;
    const p2 = picos[i + 1]!;
    if (p1.y >= p0.y || p1.y >= p2.y) continue; // só nos cumes de verdade

    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p1.x, baseY);
    ctx.lineTo(p0.x, baseY);
    ctx.closePath();
    ctx.fillStyle = COR_MONTANHA_DIST_LUZ;
    ctx.fill();

    const largPico = Math.min(p1.x - p0.x, p2.x - p1.x);
    ctx.beginPath();
    ctx.moveTo(p1.x - largPico * 0.5, p1.y + largPico * 0.3);
    ctx.lineTo(p1.x, p1.y);
    ctx.lineTo(p1.x + largPico * 0.6, p1.y + largPico * 0.35);
    ctx.lineTo(p1.x, p1.y + largPico * 0.12);
    ctx.closePath();
    ctx.fillStyle = COR_MONTANHA_DIST_NEVE;
    ctx.fill();
  }
}

// --- Camada 1b: mar de nuvens, cobrindo a base das distantes (§4.2.3) ---

function desenharMarDeNuvens(ctx: CanvasRenderingContext2D, largura: number, altura: number): void {
  // Mais alto que as médias (baseY 0,48, picos até baseY-70): fica ACIMA da crista na maior parte da largura, com
  // só os picos mais altos furando a faixa — "mar de nuvens com picos emergindo", não escondido atrás da crista.
  const baseY = altura * 0.335;
  const raios = [20, 28, 24, 36, 22, 30, 26, 34, 24];
  let x = -10;
  for (let i = 0; i < raios.length && x < largura + 10; i += 1) {
    const r = raios[i]!;
    ctx.beginPath();
    ctx.arc(x, baseY, r, Math.PI, 0, false);
    ctx.fillStyle = COR_NUVEM_CORPO;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, baseY, r, Math.PI * 1.3, Math.PI * 1.85, false);
    ctx.fillStyle = COR_NUVEM_TOPO;
    ctx.fill();
    // meia-lua de luz na borda superior esquerda
    ctx.beginPath();
    ctx.arc(x - r * 0.3, baseY - r * 0.3, r * 0.4, Math.PI * 1.1, Math.PI * 1.7, false);
    ctx.strokeStyle = COR_NUVEM_LUZ;
    ctx.lineWidth = 2;
    ctx.stroke();
    x += r * 1.3;
  }
  // Base sólida para fechar o "mar" até o fundo da faixa
  ctx.fillStyle = COR_NUVEM_CORPO;
  ctx.fillRect(0, baseY, largura, altura * 0.08);
}

// --- Camada 2: médias serrilhadas com cornijas penduradas (§4.2.4) ---

function desenharCornijaPendurada(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 4);
  ctx.quadraticCurveTo(x, y - 6, x + 10, y);
  ctx.quadraticCurveTo(x + 14, y + 10, x + 4, y + 9);
  ctx.closePath();
  ctx.fillStyle = COR_MONTANHA_MEDIA_NEVE;
  ctx.fill();
}

function desenharMontanhasMediasCume(ctx: CanvasRenderingContext2D, largura: number, altura: number): void {
  const baseY = altura * 0.48;
  const n = 16; // dobro de pontos do Morro (crista serrilhada)
  const pontos: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i += 1) {
    const h = hashDeterministico(i * 53 + 5);
    const x = (largura * i) / n;
    const desvio = 15 + (h % 55); // deslocamentos maiores que o Morro
    const y = baseY - (i % 2 === 0 ? desvio : desvio * 0.25);
    pontos.push({ x, y });
  }

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
      ctx.lineTo(p1.x, baseY + 40);
      ctx.lineTo(p0.x, baseY + 40);
      ctx.closePath();
      ctx.fillStyle = COR_MONTANHA_MEDIA_LUZ;
      ctx.fill();
      cumes.push(p1);
    }
  }

  // 3 cristas com cornija pendurada (a onda que volta para baixo de si mesma, lado do vento)
  const indicesComCornija = [1, 4, 7].filter((i) => i < cumes.length);
  for (const i of indicesComCornija) {
    const c = cumes[i]!;
    desenharCornijaPendurada(ctx, c.x, c.y);
  }
}

// --- Camada 3: silhueta — colina + teleférico parado + refúgio + pinheiros tortos + biruta + gag (§4.2.5) ---

function desenharPinheiroTortoSilhueta(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  const niveis = 3;
  for (let i = 0; i < niveis; i += 1) {
    const t = i / (niveis - 1);
    const nivelW = 26 * (1 - t * 0.45);
    const nivelY = baseY - 6 - t * 26;
    const deslocX = i * 3; // andares deslocados para a direita (o vento)
    ctx.beginPath();
    ctx.moveTo(x - nivelW / 2 + deslocX, nivelY);
    ctx.lineTo(x + deslocX + 4, nivelY - 13);
    ctx.lineTo(x + nivelW / 2 + deslocX, nivelY);
    ctx.closePath();
    ctx.fillStyle = COR_COLINA_SILHUETA;
    ctx.fill();
  }
}

function desenharBirutaSilhueta(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  ctx.strokeStyle = COR_BIRUTA_MASTRO;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, baseY - 40);
  ctx.stroke();

  // Cone esticado na horizontal para a direita (vento forte)
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? COR_BIRUTA_A : COR_BIRUTA_B;
    ctx.fillRect(x + i * 7, baseY - 44 + i * 0.6, 7, 6 - i * 0.6);
  }
}

function desenharRefugio(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  const w = 60;
  const h = 26;
  ctx.fillStyle = COR_REFUGIO_PAREDE;
  ctx.fillRect(x - w / 2, baseY - h, w, h);

  // Telhado nevado com cornija
  ctx.beginPath();
  ctx.moveTo(x - w / 2 - 6, baseY - h);
  ctx.lineTo(x, baseY - h - 16);
  ctx.lineTo(x + w / 2 + 6, baseY - h);
  ctx.lineTo(x + w / 2 + 2, baseY - h + 3);
  ctx.lineTo(x, baseY - h - 11);
  ctx.lineTo(x - w / 2 - 2, baseY - h + 3);
  ctx.closePath();
  ctx.fillStyle = COR_TERRENO_MANTA;
  ctx.fill();

  // Janela acesa
  ctx.fillStyle = COR_REFUGIO_JANELA;
  ctx.fillRect(x - 6, baseY - h * 0.6, 12, 12);

  // Chaminé com fumaça deitada pelo vento
  ctx.fillStyle = COR_COLINA_SILHUETA;
  ctx.fillRect(x + w / 2 - 10, baseY - h - 22, 7, 14);
  desenharFumacaDeitada(ctx, x + w / 2 - 3, baseY - h - 24, 4);
}

function desenharGagPosteCume(ctx: CanvasRenderingContext2D, x: number, baseY: number): void {
  // Poste
  ctx.strokeStyle = COR_COLINA_SILHUETA;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, baseY - 34);
  ctx.stroke();

  // Boneco agarrado, corpo inclinado na direção do vento
  ctx.save();
  ctx.translate(x, baseY - 30);
  ctx.rotate((12 * Math.PI) / 180);
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = COR_CONTORNO_CLARO;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, -6, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -20, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Cachecol esticado reto na horizontal
  ctx.fillStyle = COR_CACHECOL;
  ctx.fillRect(x + 2, baseY - 22, 26, 4);

  // Chapéu já voando, a ~30 px
  ctx.fillStyle = COR_CHAPEU;
  ctx.fillRect(x + 26, baseY - 38, 10, 4);
  ctx.fillRect(x + 28, baseY - 42, 6, 4);
}

function desenharCamadaSilhuetaCume(ctx: CanvasRenderingContext2D, largura: number, altura: number): void {
  const baseY = altura * 0.52;

  // Colina irregular: polígono de 12 pontos (não curva, §4.2.5)
  const n = 12;
  ctx.beginPath();
  ctx.moveTo(0, altura);
  ctx.lineTo(0, baseY - 8);
  for (let i = 1; i <= n; i += 1) {
    const h = hashDeterministico(i * 71 + 13);
    const x = (largura * i) / n;
    const y = baseY - 8 - (h % 16);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(largura, altura);
  ctx.closePath();
  ctx.fillStyle = COR_COLINA_SILHUETA;
  ctx.fill();

  // Teleférico parado: 2 torres + cabo em catenária + gôndola parada, inclinada 8° pelo vento
  const xTorreA = 140;
  const xTorreB = 700;
  const alturaTorre = 54;
  desenharTorreTreliça(ctx, xTorreA, baseY - 2, alturaTorre, 16);
  desenharTorreTreliça(ctx, xTorreB, baseY - 2, alturaTorre, 16);

  const topoCaboA = baseY - 2 - alturaTorre;
  const topoCaboB = baseY - 2 - alturaTorre;
  ctx.strokeStyle = COR_TELEFERICO_CABO;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(xTorreA, topoCaboA);
  ctx.quadraticCurveTo((xTorreA + xTorreB) / 2, topoCaboA + 30, xTorreB, topoCaboB);
  ctx.stroke();

  const xGondola = (xTorreA + xTorreB) / 2;
  const yGondola = topoCaboA + 30;
  ctx.save();
  ctx.translate(xGondola, yGondola);
  ctx.rotate((8 * Math.PI) / 180);
  ctx.fillStyle = COR_TELEFERICO_GONDOLA;
  ctx.fillRect(-9, 0, 18, 14);
  ctx.fillStyle = COR_TELEFERICO_JANELA;
  ctx.fillRect(-5, 3, 10, 6);
  ctx.strokeStyle = COR_TELEFERICO_CABO;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(0, 0);
  ctx.stroke();
  ctx.restore();

  // Refúgio
  desenharRefugio(ctx, 420, baseY - 2);

  // Pinheiros tortos
  for (const x of [260, 300, 560, 860]) desenharPinheiroTortoSilhueta(ctx, x, baseY - 2);

  // Biruta esticada na horizontal
  desenharBirutaSilhueta(ctx, 620, baseY - 2);

  // Gag de fundo: boneco agarrado ao poste
  desenharGagPosteCume(ctx, 790, baseY - 2);
}

function construirCamadasCume(doc: Document | undefined, largura: number, altura: number): Parallax {
  const criarTile = (
    desenho: (c: CanvasRenderingContext2D, l: number, a: number) => void,
    fatorParallax: number
  ): CamadaParallax | null => {
    if (!doc) return null;
    const tile = doc.createElement('canvas');
    tile.width = largura;
    tile.height = altura;
    const ctxTile = tile.getContext('2d');
    if (!ctxTile) throw new Error('Canvas 2D indisponível neste navegador');
    desenho(ctxTile, largura, altura);
    return { fatorParallax, tile };
  };

  const camadas: CamadaParallax[] = [];
  if (doc) {
    const cDist = criarTile(desenharDistantesCume, 0.04);
    if (cDist) camadas.push(cDist);
    const cNuvens = criarTile(desenharMarDeNuvens, 0.06);
    if (cNuvens) camadas.push(cNuvens);
    const cMedia = criarTile(desenharMontanhasMediasCume, 0.1);
    if (cMedia) camadas.push(cMedia);
    const cSilhueta = criarTile(desenharCamadaSilhuetaCume, 0.22);
    if (cSilhueta) camadas.push(cSilhueta);
  }

  return {
    desenhar(ctx, cameraXm, tempoTicks) {
      desenharCeuCume(ctx, largura, altura);

      for (const camada of camadas) {
        const deslocPx = (((cameraXm * camada.fatorParallax * 8) % largura) + largura) % largura;
        ctx.drawImage(camada.tile, -deslocPx, 0, largura, altura);
        ctx.drawImage(camada.tile, largura - deslocPx, 0, largura, altura);
      }

      void tempoTicks;
    },
  };
}

// --- Objetos de jogo (§4.3): contorno DUPLO (escuro + aro de lua, única luz fria da pista) ---

function desenharRochaDeGelo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const topoY = y - h;
  desenharFundoContornoDuplo(ctx, x, y, w, h);

  // Hexágono de 6 vértices (tabela fixa)
  const pts = [
    { x: x - w / 2, y },
    { x: x - w * 0.3, y: topoY + h * 0.2 },
    { x: x - w * 0.1, y: topoY },
    { x: x + w * 0.35, y: topoY + h * 0.15 },
    { x: x + w / 2, y },
    { x: x + w * 0.1, y: y - h * 0.08 },
  ];
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.closePath();
  ctx.fillStyle = COR_ROCHA_GELO_MIOLO;
  ctx.fill();

  ctx.save();
  ctx.clip();
  ctx.fillStyle = COR_ROCHA_GELO_LUZ;
  ctx.fillRect(x - w / 2, topoY, w * 0.38, h);
  ctx.fillStyle = COR_ROCHA_GELO_SOMBRA;
  ctx.fillRect(x + w * 0.12, topoY, w * 0.38, h);
  ctx.restore();

  // Capuz de neve deslocado para a esquerda (o vento empurrou, §4.3)
  ctx.beginPath();
  ctx.ellipse(x - w * 0.15, topoY + h * 0.08, w * 0.3, h * 0.12, 0, Math.PI, 0, true);
  ctx.fillStyle = COR_ROCHA_GELO_NEVE;
  ctx.fill();

  desenharAroLua(ctx, x, y, w, h);
}

function desenharBlocoDeGelo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const topoY = y - h;
  const faceW = w * 0.68;
  const lateralW = w - faceW;

  desenharFundoContornoDuplo(ctx, x, y, w, h);

  ctx.fillStyle = COR_BLOCO_GELO_FACE;
  ctx.fillRect(x - w / 2, topoY, faceW, h);
  ctx.fillStyle = COR_BLOCO_GELO_FACE_ESCURA;
  ctx.fillRect(x - w / 2 + faceW, topoY, lateralW, h);

  // Topo em 3/4, mais claro
  ctx.beginPath();
  ctx.moveTo(x - w / 2, topoY);
  ctx.lineTo(x - w / 2 + lateralW * 0.8, topoY - lateralW * 0.7);
  ctx.lineTo(x + w / 2, topoY - lateralW * 0.7);
  ctx.lineTo(x - w / 2 + faceW, topoY);
  ctx.closePath();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = COR_BLOCO_GELO_REFLEXO;
  ctx.fill();
  ctx.globalAlpha = 1;

  // 2 traços de reflexo em diagonal na frente
  ctx.strokeStyle = COR_BLOCO_GELO_REFLEXO;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + faceW * 0.22, topoY + h * 0.2);
  ctx.lineTo(x - w / 2 + faceW * 0.38, topoY + h * 0.6);
  ctx.moveTo(x - w / 2 + faceW * 0.55, topoY + h * 0.15);
  ctx.lineTo(x - w / 2 + faceW * 0.7, topoY + h * 0.5);
  ctx.stroke();

  desenharAroLua(ctx, x, y, w, h);
}

function desenharLajeCornijaCaida(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const topoY = y - h;
  desenharFundoContornoDuplo(ctx, x, y, w, h);

  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x - w / 2 - h * 0.35, topoY + h * 0.35, x - w / 2 + h * 0.25, topoY);
  ctx.lineTo(x + w / 2, topoY);
  ctx.lineTo(x + w / 2, y);
  ctx.closePath();
  ctx.fillStyle = COR_LAJE_CORNIJA;
  ctx.fill();

  // Faixa de luz no topo
  ctx.fillStyle = COR_TERRENO_MANTA;
  ctx.fillRect(x - w / 2 + h * 0.2, topoY, w / 2, 2);

  desenharAroLua(ctx, x, y, w, h);
}

function desenharPinheiroTortoObjeto(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  desenharFundoContornoDuplo(ctx, x, y, w, h);

  const niveis = 3;
  for (let i = 0; i < niveis; i += 1) {
    const t = i / (niveis - 1);
    const nivelW = w * (1 - t * 0.5);
    const nivelY = y - h * (0.15 + t * 0.6);
    const deslocX = i * 3; // andares deslocados para a direita (vento)
    ctx.beginPath();
    ctx.moveTo(x - nivelW / 2 + deslocX, nivelY);
    ctx.lineTo(x + deslocX + nivelW * 0.1, nivelY - h * 0.28);
    ctx.lineTo(x + nivelW / 2 + deslocX, nivelY);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? COR_PINHEIRO_SOMBRA : COR_PINHEIRO_LUZ;
    ctx.fill();
  }

  ctx.fillStyle = COR_TRONCO;
  ctx.fillRect(x - 2, y - h * 0.12, 4, h * 0.12);

  desenharAroLua(ctx, x, y, w, h);
}

function desenharBonecoCachecolVento(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  void w; // boneco é esférico: a largura do obstáculo não entra na geometria, só a altura (mesmo padrão do Vulcão)
  const r1 = h * 0.32;
  const r2 = h * 0.22;
  const dx = Math.sin((10 * Math.PI) / 180);
  const cx1 = x + dx * r1 * 0.4;
  const cy1 = y - r1;
  const cx2 = cx1 + dx * (r1 + r2) * 0.5;
  const cy2 = cy1 - r1 * 0.7 - r2 * 0.7;

  ctx.strokeStyle = COR_CONTORNO_CLARO;
  ctx.lineWidth = 1.5;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx1, cy1, r1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx2, cy2, r2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cachecol comprido esticado para a direita, com franja
  ctx.fillStyle = COR_CACHECOL;
  ctx.fillRect(cx2 - r2 * 0.2, cy2 + r2 * 0.3, r2 * 2.6, r2 * 0.5);
  for (let i = 0; i < 3; i += 1) {
    ctx.beginPath();
    ctx.moveTo(cx2 + r2 * 2.4, cy2 + r2 * 0.3 + i * (r2 * 0.18));
    ctx.lineTo(cx2 + r2 * 2.9, cy2 + r2 * 0.3 + i * (r2 * 0.18) + r2 * 0.1);
    ctx.lineTo(cx2 + r2 * 2.4, cy2 + r2 * 0.3 + (i + 1) * (r2 * 0.18));
    ctx.closePath();
    ctx.fill();
  }

  // Chapéu firme na cabeça (ele o segura com a mão-graveto)
  ctx.fillStyle = COR_CHAPEU;
  ctx.fillRect(cx2 - r2 * 0.65, cy2 - r2 * 1.25, r2 * 1.3, r2 * 0.4);
  ctx.fillRect(cx2 - r2 * 0.9, cy2 - r2 * 0.9, r2 * 1.8, r2 * 0.22);
  ctx.strokeStyle = COR_TRONCO;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx2 + r2 * 0.7, cy2 - r2 * 0.2);
  ctx.lineTo(cx2 + r2 * 1.1, cy2 - r2 * 1.1);
  ctx.stroke();
}

function desenharObjetoCume(ctx: CanvasRenderingContext2D, obj: ObjetoPista, xTela: number, yTela: number, escala: number): void {
  const larguraPx = Math.max(8, obj.largura * escala);
  const alturaPx = Math.max(8, obj.altura * escala);

  ctx.save();
  switch (obj.tipo) {
    case 'pedra':
      if (obj.variante === 1) desenharBlocoDeGelo(ctx, xTela, yTela, larguraPx, alturaPx);
      else desenharRochaDeGelo(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'tronco':
      desenharLajeCornijaCaida(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'pinheiro':
      desenharPinheiroTortoObjeto(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'boneco-de-neve':
      desenharBonecoCachecolVento(ctx, xTela, yTela, larguraPx, alturaPx);
      break;
    case 'floco': {
      // Cristal de gelo simples com brilho frio (coerente com a paleta da pista)
      const r = alturaPx * 0.4;
      const cy = yTela - alturaPx * 0.5;
      ctx.beginPath();
      ctx.moveTo(xTela, cy - r);
      ctx.lineTo(xTela + r * 0.6, cy - r * 0.2);
      ctx.lineTo(xTela, cy + r);
      ctx.lineTo(xTela - r * 0.6, cy - r * 0.2);
      ctx.closePath();
      ctx.fillStyle = COR_TERRENO_MANTA;
      ctx.fill();
      ctx.strokeStyle = COR_MONTANHA_MEDIA_NEVE;
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(xTela - 1, cy - 2, r * 0.25, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      // Fallback genérico tingido na paleta do Cume (`rampa`/`bandeira`/`portico`/`placa`: mesmo nível do
      // Picolé/Vila/Vulcão — ver memória `pintor-tema-nivel-de-pele-espelha-precedente`).
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

// --- Trilho de grind (§0.5/§4.3, regra L3): corda (< 1 m) ou cabo de teleférico (>= 1 m) ---

function desenharCorda(ctx: CanvasRenderingContext2D, trilho: Trilho, pista: PistaGerada, camera: EstadoCamera): void {
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const topoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm) + trilho.altura, camera, PX_POR_METRO);
  const chaoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm), camera, PX_POR_METRO);

  const p0 = topoY(trilho.x0);
  const p1 = topoY(trilho.x1);
  if (p0.x === p1.x && p0.y === p1.y) return;

  const posteW = Math.max(2, 4 * (escala / PX_POR_METRO));
  // Postes de madeira nas pontas e a cada <= 5 m, com amarração em X
  ctx.fillStyle = COR_CORDA_POSTE;
  ctx.strokeStyle = COR_CONTORNO_ESCURO;
  ctx.lineWidth = 1;
  const ESPACO_POSTE_M = 5;
  for (let xm = trilho.x0; xm <= trilho.x1 + 0.001; xm += ESPACO_POSTE_M) {
    const xmClamp = Math.min(xm, trilho.x1);
    const pTopo = topoY(xmClamp);
    const pChao = chaoY(xmClamp);
    const alturaPoste = Math.max(0, pChao.y - pTopo.y);
    ctx.fillRect(pTopo.x - posteW / 2, pTopo.y, posteW, alturaPoste);
    ctx.beginPath();
    ctx.moveTo(pTopo.x - posteW / 2, pTopo.y);
    ctx.lineTo(pTopo.x + posteW / 2, pTopo.y + alturaPoste * 0.4);
    ctx.moveTo(pTopo.x + posteW / 2, pTopo.y);
    ctx.lineTo(pTopo.x - posteW / 2, pTopo.y + alturaPoste * 0.4);
    ctx.stroke();
  }

  // Corda reta (no máximo 2 px de flecha: barriga maior engana o pouso, §4.3)
  const flecha = 2;
  const meioX = (p0.x + p1.x) / 2;
  const meioY = (p0.y + p1.y) / 2 + flecha;

  const tracarCorda = (): void => {
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.quadraticCurveTo(meioX, meioY, p1.x, p1.y);
  };

  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, 3 * (escala / PX_POR_METRO));
  ctx.strokeStyle = COR_CORDA_FIBRA;
  tracarCorda();
  ctx.stroke();

  // Trança: traços curtos a 45° a cada 4 px
  ctx.strokeStyle = COR_CORDA_TRANCA;
  ctx.lineWidth = 1;
  const comprimento = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  const passos = Math.max(1, Math.floor(comprimento / 4));
  for (let i = 0; i <= passos; i += 1) {
    const t = i / passos;
    const px = p0.x + (p1.x - p0.x) * t;
    const py = p0.y + (p1.y - p0.y) * t + flecha * Math.sin(Math.PI * t);
    ctx.beginPath();
    ctx.moveTo(px - 1.5, py - 1.5);
    ctx.lineTo(px + 1.5, py + 1.5);
    ctx.stroke();
  }

  // Fio claro no topo, alfa 0,6
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = '#F7FBFF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y - 1.5);
  ctx.quadraticCurveTo(meioX, meioY - 1.5, p1.x, p1.y - 1.5);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function desenharCaboTeleferico(ctx: CanvasRenderingContext2D, trilho: Trilho, pista: PistaGerada, camera: EstadoCamera): void {
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const topoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm) + trilho.altura, camera, PX_POR_METRO);

  const p0 = topoY(trilho.x0);
  const p1 = topoY(trilho.x1);
  if (p0.x === p1.x && p0.y === p1.y) return;

  const alturaTorre = Math.max(20, 36 * (escala / PX_POR_METRO));
  desenharTorreTreliça(ctx, p0.x, p0.y + alturaTorre, alturaTorre, Math.max(10, 14 * (escala / PX_POR_METRO)));
  desenharTorreTreliça(ctx, p1.x, p1.y + alturaTorre, alturaTorre, Math.max(10, 14 * (escala / PX_POR_METRO)));

  // Cabo de aço com fio claro em cima; SEM postes no meio (o vazio embaixo é a graça, §4.3)
  const meioX = (p0.x + p1.x) / 2;
  const flecha = Math.max(4, 8 * (escala / PX_POR_METRO));
  const meioY = (p0.y + p1.y) / 2 + flecha;

  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, 3 * (escala / PX_POR_METRO));
  ctx.strokeStyle = COR_TELEFERICO_CABO;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.quadraticCurveTo(meioX, meioY, p1.x, p1.y);
  ctx.stroke();

  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = '#F7FBFF';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y - 1.5);
  ctx.quadraticCurveTo(meioX, meioY - 1.5, p1.x, p1.y - 1.5);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function desenharTrilhoCume(ctx: CanvasRenderingContext2D, trilho: Trilho, pista: PistaGerada, camera: EstadoCamera): void {
  // Altura < 1 m => pele "corda"; altura >= 1 m => pele "cabo de teleférico" (ficha §4.3)
  if (trilho.altura < 1) desenharCorda(ctx, trilho, pista, camera);
  else desenharCaboTeleferico(ctx, trilho, pista, camera);
}

// --- Terreno: gelo com estilhaços facetados e sastrugi (§4.2.6) ---

function desenharEstilhacoGelo(ctx: CanvasRenderingContext2D, x: number, yTopo: number, tamanho: number): void {
  ctx.beginPath();
  ctx.moveTo(x, yTopo);
  ctx.lineTo(x + tamanho * 0.4, yTopo + tamanho * 0.6);
  ctx.lineTo(x, yTopo + tamanho);
  ctx.closePath();
  ctx.fillStyle = COR_ESTILHACO_LUZ;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x, yTopo);
  ctx.lineTo(x - tamanho * 0.4, yTopo + tamanho * 0.6);
  ctx.lineTo(x, yTopo + tamanho);
  ctx.closePath();
  ctx.fillStyle = COR_ESTILHACO_SOMBRA;
  ctx.fill();
}

function desenharTerrenoCume(
  ctx: CanvasRenderingContext2D,
  pista: PistaGerada,
  _camera: EstadoCamera,
  superficie: readonly { x: number; y: number }[],
  espessuraMantaPx: number
): void {
  const primeiro = superficie[0]!;
  const ultimo = superficie[superficie.length - 1]!;
  const FUNDO_PX = 4000;

  // 1. Corpo do terreno, polígono estendido além da tela — só FILL (regra `webkit-stroke-coordenadas-extremas`)
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  ctx.lineTo(ultimo.x, ultimo.y + FUNDO_PX);
  ctx.lineTo(primeiro.x, primeiro.y + FUNDO_PX);
  ctx.closePath();
  ctx.fillStyle = COR_TERRENO_CORPO;
  ctx.fill();

  // 2. Manta de gelo-neve
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  for (let i = superficie.length - 1; i >= 0; i -= 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y + espessuraMantaPx);
  ctx.closePath();
  ctx.fillStyle = COR_TERRENO_MANTA;
  ctx.fill();

  const fator = espessuraMantaPx / ESPESSURA_MANTA_NEVE_PX;

  // 3. Estilhaços de gelo no corpo: a cada 7 m, hash decide; teto 10 por quadro (§4.2.6). Nunca encostam na manta.
  const passoM = Math.max(1, Math.round(7 / pista.dx));
  let desenhadas = 0;
  for (let i = 0; i < superficie.length && desenhadas < 10; i += passoM) {
    const h = hashDeterministico(i * 19 + 7);
    if (h % 3 !== 0) continue;
    const p = superficie[i]!;
    const tamanho = (14 + (h % 13)) * fator;
    desenharEstilhacoGelo(ctx, p.x, p.y + espessuraMantaPx + 10 * fator, tamanho);
    desenhadas += 1;
  }

  // 4. Sastrugi na manta: 1 traço curto inclinado a cada 2 m (a neve esculpida pelo vento)
  const passoSastrugiM = Math.max(1, Math.round(2 / pista.dx));
  ctx.strokeStyle = COR_SASTRUGI;
  ctx.lineWidth = 1;
  for (let i = 0; i < superficie.length; i += passoSastrugiM) {
    const p = superficie[i]!;
    const h = hashDeterministico(i * 29 + 3);
    const yMeio = p.y + espessuraMantaPx * (0.3 + (h % 4) * 0.1);
    ctx.beginPath();
    ctx.moveTo(p.x - 3, yMeio);
    ctx.lineTo(p.x + 3, yMeio - 2);
    ctx.stroke();
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

export const pintorCume: PintorTema = {
  construirCamadas: (doc, largura, altura) => construirCamadasCume(doc, largura, altura),
  desenharObjeto: desenharObjetoCume,
  desenharTrilho: desenharTrilhoCume,
  desenharTerreno: desenharTerrenoCume,
};
