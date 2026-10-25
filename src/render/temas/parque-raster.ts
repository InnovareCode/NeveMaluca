/**
 * Pintor RASTER "Pixar" do Pico do Picolé (piloto da virada de arte, `docs/piloto-cenario-pixar.md` SS6). Mesma
 * forma/física/contrato de `parque.ts` (vetorial) -- geometria do terreno, objetos, trilhos e ordem de desenho não
 * mudam; só a PELE troca por imagens pré-processadas (`public/assets/cenarios/pico-do-picole/*.webp`, geradas por
 * `arte-fonte/ferramentas-curadoria/cenario-pico-do-picole.py`).
 *
 * `construirCamadas` é SÍNCRONO (`PintorTema`, plano M3 SSB.3/SSB.6): os assets são carregados e DECODIFICADOS de
 * forma assíncrona por `precarregarAssetsParqueRaster` (chamado por `ui/cenas/selecao-pista.ts` ao abrir a tela,
 * fire-and-forget -- mesmo padrão de `assets/index.ts: carregarSpritePersonagem`). Enquanto o cache não estiver
 * pronto, OU se qualquer imagem falhar ao carregar, cada função deste pintor cai no `pintorParque` (vetorial) --
 * nunca mistura metade raster/metade vetorial dentro do MESMO método, e nunca trava o jogo (mesma filosofia de
 * `temas/catalogo.ts`: id desconhecido cai no Morro).
 */
import { ALTURA, LARGURA, PX_POR_METRO } from '../../core/constantes';
import type { ObjetoPista, PistaGerada, Trilho, TipoObjeto } from '../../core/contratos';
import { resolverUrlAsset } from '../../assets/index';
import { TEMA_PARQUE } from '../../data/temas';
import type { EstadoCamera } from '../mundo';
import { mundoParaTela, pxPorMetro } from '../mundo';
import { alturaDoTerreno } from '../terreno';
import type { Parallax } from '../parallax';
import type { PintorTema } from './tipos';
import { pintorParque } from './parque';

const PASTA = 'assets/cenarios/pico-do-picole/';

/** 1 px lógico = 2 px nos assets exportados (SS5 da ficha): mesma escala do buffer (`ESCALA_BUFFER`). */
const PX_NATIVO_POR_LOGICO = 2;
const PX_NATIVO_POR_METRO = PX_POR_METRO * PX_NATIVO_POR_LOGICO;

const COR_CONTORNO_ESCURO = '#1B2733';
const COR_CONTORNO_CLARO = '#FFE6EF';
const COR_FIO_SUPERFICIE = '#FFE6EF';

type ImagemObjeto = HTMLCanvasElement | HTMLImageElement;

interface AssetsParqueRaster {
  readonly fundo: HTMLImageElement;
  readonly medias: HTMLImageElement;
  readonly silhuetas: HTMLImageElement;
  readonly manta: HTMLImageElement;
  readonly texSorbet: HTMLImageElement;
  readonly sombra: HTMLCanvasElement;
  readonly obj: {
    readonly picoleCaido: ImagemObjeto;
    readonly bolaMenta: ImagemObjeto;
    readonly casquinhaTombada: ImagemObjeto;
    readonly picoleFincado: ImagemObjeto;
    readonly bonecoSorvete: ImagemObjeto;
    readonly gotaMenta: ImagemObjeto;
    readonly palito: ImagemObjeto;
  };
  /** Peças do trilho JÁ PEQUENAS (pré-recortadas e reduzidas do `palito`, uma vez no boot): o corpo do trilho
   * carimba o sprite uma vez por segmento de 0,5 m (`desenharTrilhoParqueRaster`), então partir de uma fonte
   * pequena (em vez da folha ~440x110 inteira) é mais barato por natureza -- menos pixel pra reamostrar a cada
   * `drawImage` rotacionado, ainda mais relevante em hardware mais fraco que o desktop onde isto foi medido. */
  readonly trilho: {
    readonly meio: HTMLCanvasElement;
    readonly tampaEsquerda: HTMLCanvasElement;
    readonly tampaDireita: HTMLCanvasElement;
  };
}

let cache: AssetsParqueRaster | null = null;
let promessaCarregamento: Promise<boolean> | null = null;

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Erro ao carregar asset de cenário: ${url}`));
  });
}

/** Contorno pré-cozido (A7, SS6): desenha o sprite 8x deslocado (raio 1 px lógico), pinta `source-in` na cor do
 * contorno, desenha o sprite por cima. Zero custo por quadro -- roda uma vez aqui, no carregamento. */
function cozinharContorno(doc: Document, img: HTMLImageElement, cor: string): HTMLCanvasElement {
  const raio = PX_NATIVO_POR_LOGICO; // 1 px lógico de raio
  const pad = Math.ceil(raio) + 1;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const tela = doc.createElement('canvas');
  tela.width = w + pad * 2;
  tela.height = h + pad * 2;
  const ctx = tela.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador');

  const offsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ] as const;
  for (const [dx, dy] of offsets) {
    ctx.drawImage(img, pad + dx * raio, pad + dy * raio, w, h);
  }
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, tela.width, tela.height);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(img, pad, pad, w, h);
  return tela;
}

/** Recorta `[sx,sy,sw,sh]` de `src` e reduz para `larguraFinal x alturaFinal` NUMA SÓ VEZ (boot): o desenho por
 * quadro parte dessa fonte já pequena, nunca da folha original inteira (ver comentário em `AssetsParqueRaster.trilho`). */
function recortarEReduzir(
  doc: Document,
  src: ImagemObjeto,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  larguraFinal: number,
  alturaFinal: number
): HTMLCanvasElement {
  const tela = doc.createElement('canvas');
  tela.width = Math.max(1, Math.round(larguraFinal));
  tela.height = Math.max(1, Math.round(alturaFinal));
  const ctx = tela.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador');
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, tela.width, tela.height);
  return tela;
}

/** Sombra de contato (A8, SS6): elipse radial rosada pré-desenhada, reaproveitada para qualquer objeto (`drawImage`
 * escalado pela largura dele no desenho por quadro). */
function cozinharSombra(doc: Document): HTMLCanvasElement {
  const tela = doc.createElement('canvas');
  tela.width = 240;
  tela.height = 80;
  const ctx = tela.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador');
  const grad = ctx.createRadialGradient(120, 40, 4, 120, 40, 118);
  grad.addColorStop(0, 'rgba(232, 69, 122, 0.32)');
  grad.addColorStop(1, 'rgba(232, 69, 122, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(120, 40, 118, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  return tela;
}

/**
 * Carrega e decodifica os assets do cenário raster do Pico do Picolé (SS6: "antes de montar o tema"). Chamada
 * fire-and-forget pela tela de seleção de pista; o pintor cai no `parque.ts` vetorial enquanto isso não resolver
 * (ou se qualquer imagem falhar -- `Promise.all` rejeita no primeiro erro, o `catch` deixa o cache `null`).
 */
export function precarregarAssetsParqueRaster(doc?: Document): Promise<boolean> {
  if (promessaCarregamento) return promessaCarregamento;
  const documento = doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!documento) return Promise.resolve(false);

  promessaCarregamento = (async () => {
    try {
      const nomes = [
        'fundo', 'medias', 'silhuetas', 'manta', 'tex-sorbet',
        'obj-picole-caido', 'obj-bola-menta', 'obj-casquinha-tombada',
        'obj-picole-fincado', 'obj-boneco-sorvete', 'obj-gota-menta', 'obj-palito',
      ] as const;
      const imgs = await Promise.all(nomes.map((n) => carregarImagem(resolverUrlAsset(`${PASTA}${n}.webp`))));
      const porNome = Object.fromEntries(nomes.map((n, i) => [n, imgs[i] as HTMLImageElement]));

      const palitoContornado = cozinharContorno(documento, porNome['obj-palito']!, COR_CONTORNO_ESCURO);
      const wP = palitoContornado.width;
      const hP = palitoContornado.height;
      const trilho = {
        meio: recortarEReduzir(documento, palitoContornado, wP * 0.15, 0, wP * 0.7, hP, 140, 28),
        tampaEsquerda: recortarEReduzir(documento, palitoContornado, 0, 0, wP * 0.15, hP, 28, 28),
        tampaDireita: recortarEReduzir(documento, palitoContornado, wP * 0.85, 0, wP * 0.15, hP, 28, 28),
      };

      cache = {
        fundo: porNome['fundo']!,
        medias: porNome['medias']!,
        silhuetas: porNome['silhuetas']!,
        manta: porNome['manta']!,
        texSorbet: porNome['tex-sorbet']!,
        sombra: cozinharSombra(documento),
        obj: {
          picoleCaido: cozinharContorno(documento, porNome['obj-picole-caido']!, COR_CONTORNO_ESCURO),
          bolaMenta: cozinharContorno(documento, porNome['obj-bola-menta']!, COR_CONTORNO_ESCURO),
          casquinhaTombada: cozinharContorno(documento, porNome['obj-casquinha-tombada']!, COR_CONTORNO_ESCURO),
          picoleFincado: cozinharContorno(documento, porNome['obj-picole-fincado']!, COR_CONTORNO_ESCURO),
          bonecoSorvete: cozinharContorno(documento, porNome['obj-boneco-sorvete']!, COR_CONTORNO_CLARO),
          gotaMenta: porNome['obj-gota-menta']!, // sem contorno (SS6)
          palito: palitoContornado,
        },
        trilho,
      };
      return true;
    } catch {
      cache = null; // qualquer asset falhando: fallback total pro vetorial (nunca trava o jogo)
      return false;
    }
  })();
  return promessaCarregamento;
}

/** Síncrono, sem esperar a promessa (polimento "corrida em campeonato": Pixar no gameplay): o raster já está
 * decodificado NESTE instante? Usado pela legenda "carregando cenário..." da contagem regressiva -- nunca pela
 * lógica de tick, que não espera por isto (ver `render/hud.ts: desenharLegendaCarregandoCenario`). */
export function assetsParqueRasterProntos(): boolean {
  return cache !== null;
}

/** Só para teste/limpeza entre cenários de e2e: força esquecer o cache carregado. */
export function _esquecerAssetsParqueRasterParaTeste(): void {
  cache = null;
  promessaCarregamento = null;
}

/** Só para medição (B.3, `ferramentas/medir/cenario-raster-picole.mjs`): tamanho real (px) de cada bitmap/canvas
 * decodificado no cache, pra somar a memória aproximada (largura×altura×4 bytes, RGBA) sem adivinhar. */
export function _dimensoesCacheParaTeste(): readonly { readonly nome: string; readonly w: number; readonly h: number }[] | null {
  if (!cache) return null;
  const a = cache;
  const tamanho = (nome: string, img: ImagemObjeto): { nome: string; w: number; h: number } => ({ nome, w: img.width, h: img.height });
  return [
    tamanho('fundo', a.fundo),
    tamanho('medias', a.medias),
    tamanho('silhuetas', a.silhuetas),
    tamanho('manta', a.manta),
    tamanho('texSorbet', a.texSorbet),
    tamanho('sombra', a.sombra),
    tamanho('obj.picoleCaido', a.obj.picoleCaido),
    tamanho('obj.bolaMenta', a.obj.bolaMenta),
    tamanho('obj.casquinhaTombada', a.obj.casquinhaTombada),
    tamanho('obj.picoleFincado', a.obj.picoleFincado),
    tamanho('obj.bonecoSorvete', a.obj.bonecoSorvete),
    tamanho('obj.gotaMenta', a.obj.gotaMenta),
    tamanho('obj.palito', a.obj.palito),
  ];
}

// --- Camadas de parallax (fundo + brilho do sol + médias + silhuetas) ---

function desenharTileHorizontal(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  larguraTile: number,
  alturaTile: number,
  fator: number,
  cameraXm: number
): void {
  const deslocPx = (((cameraXm * fator * 8) % larguraTile) + larguraTile) % larguraTile;
  ctx.drawImage(img, -deslocPx, 0, larguraTile, alturaTile);
  ctx.drawImage(img, larguraTile - deslocPx, 0, larguraTile, alturaTile);
}

function construirCamadasParqueRaster(doc: Document | undefined): Parallax {
  // Reconfere a cada quadro (antes decidia UMA vez na criação e a corrida inteira ficava vetorial se a arte chegasse
  // 1 s depois — ver bosque-raster.ts). O fallback vetorial é montado uma vez só, sob demanda: nada de recriar os
  // tiles offscreen 60x/s.
  let vetorial: Parallax | null = null;

  return {
    desenhar(ctx, cameraXm, tempoTicks) {
      const a = cache;
      if (!a) {
        vetorial ??= pintorParque.construirCamadas(doc, LARGURA, ALTURA, TEMA_PARQUE);
        vetorial.desenhar(ctx, cameraXm, tempoTicks);
        return;
      }

      // 1. fundo (céu + cúpulas), fator 0,04, tile 960x540 lógicos, opaco (cobre a tela inteira)
      desenharTileHorizontal(ctx, a.fundo, LARGURA, ALTURA, 0.04, cameraXm);

      // 1b. brilho do sol, DEPOIS do fundo (pra não ser coberto) -- mesmo gradiente do vetorial (§1.1)
      const brilhoSol = ctx.createRadialGradient(LARGURA * 0.24, ALTURA * 0.08, 10, LARGURA * 0.24, ALTURA * 0.08, 260);
      brilhoSol.addColorStop(0, 'rgba(255, 250, 235, 0.45)');
      brilhoSol.addColorStop(1, 'rgba(255, 250, 235, 0)');
      ctx.fillStyle = brilhoSol;
      ctx.fillRect(0, 0, LARGURA, ALTURA);

      // 2. médias, fator 0,10, tile 960x540 lógicos, com alfa
      desenharTileHorizontal(ctx, a.medias, LARGURA, ALTURA, 0.1, cameraXm);

      // 3. silhuetas, fator 0,22, tile 1260x540 lógicos (21:9, A4), com alfa
      desenharTileHorizontal(ctx, a.silhuetas, 1260, ALTURA, 0.22, cameraXm);

      void tempoTicks;
    },
  } satisfies Parallax;
}

// --- Objetos de jogo: sprite pré-contornado (A7) + sombra de contato (A8) ---

function desenharSpriteObjeto(ctx: CanvasRenderingContext2D, sprite: ImagemObjeto, xTela: number, yTela: number, alturaPx: number): void {
  const razao = sprite.width / sprite.height;
  const h = alturaPx;
  const w = h * razao;
  ctx.drawImage(sprite, xTela - w / 2, yTela - h, w, h);
}

function desenharSombraContato(ctx: CanvasRenderingContext2D, sombra: HTMLCanvasElement, xTela: number, yTela: number, larguraPx: number): void {
  const w = Math.max(16, larguraPx * 1.3);
  const h = w * (sombra.height / sombra.width);
  ctx.drawImage(sombra, xTela - w / 2, yTela - h * 0.55, w, h);
}

function desenharObjetoParqueRaster(ctx: CanvasRenderingContext2D, obj: ObjetoPista, xTela: number, yTela: number, escala: number): void {
  if (!cache) {
    pintorParque.desenharObjeto(ctx, obj, xTela, yTela, escala);
    return;
  }
  const a = cache;
  const alturaPx = Math.max(8, obj.altura * escala);

  const spritePorTipo: Partial<Record<TipoObjeto, ImagemObjeto>> = {
    pedra: obj.variante === 1 ? a.obj.bolaMenta : a.obj.picoleCaido,
    tronco: a.obj.casquinhaTombada,
    pinheiro: a.obj.picoleFincado,
    'boneco-de-neve': a.obj.bonecoSorvete,
    floco: a.obj.gotaMenta,
  };
  const sprite = spritePorTipo[obj.tipo];
  if (!sprite) {
    // rampa/bandeira/portico/placa/trilho-objeto: mesmo nível do precedente vetorial (fallback genérico, sem
    // pele raster própria -- ver memória `pintor-tema-nivel-de-pele-espelha-precedente`).
    pintorParque.desenharObjeto(ctx, obj, xTela, yTela, escala);
    return;
  }

  desenharSombraContato(ctx, a.sombra, xTela, yTela, Math.max(8, obj.largura * escala));
  desenharSpriteObjeto(ctx, sprite, xTela, yTela, alturaPx);
}

// --- Trilho de grind: sprite do palito esticado por segmento + contorno/fio por código (SS6) ---

function desenharTrilhoParqueRaster(ctx: CanvasRenderingContext2D, trilho: Trilho, pista: PistaGerada, camera: EstadoCamera): void {
  if (!cache) {
    pintorParque.desenharTrilho(ctx, trilho, pista, camera);
    return;
  }
  const a = cache;
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

  // Pés: o próprio palito, girado 90° e encurtado, a cada <= 4 m (igual ao vetorial, trocando fillRect por sprite).
  // Só perto da tela (MARGEM_TELA_PX): um trilho pode ser bem mais comprido que o visível, e `render/objetos.ts`
  // chama isto pra TODO `pista.trilhos` sem recorte -- sem essa guarda, o Pico do Picolé (12 trilhos, até 56
  // segmentos cada) carimbaria sprite por segmento 0,5 m do trilho INTEIRO todo quadro, não só da parte visível.
  const MARGEM_TELA_PX = 100;
  const naTela = (p: { x: number }): boolean => p.x >= -MARGEM_TELA_PX && p.x <= LARGURA + MARGEM_TELA_PX;
  const ESPACO_PE_M = 4;
  for (let xm = trilho.x0; xm <= trilho.x1 + 0.001; xm += ESPACO_PE_M) {
    const xmClamp = Math.min(xm, trilho.x1);
    const pTopo = topoY(xmClamp);
    if (!naTela(pTopo)) continue;
    const pChao = chaoY(xmClamp);
    const alturaPe = Math.max(0, pChao.y - pTopo.y);
    if (alturaPe < 1) continue;
    ctx.save();
    ctx.translate(pTopo.x, pTopo.y);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(a.trilho.meio, 0, -posteW / 2, alturaPe, posteW);
    ctx.restore();
  }

  // Contorno escuro embaixo (regra L3), traço largo por cima do caminho central -- por código, igual ao vetorial
  const centroY = (p: { x: number; y: number }) => p.y + espessura / 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = espessura + 3;
  ctx.strokeStyle = COR_CONTORNO_ESCURO;
  ctx.beginPath();
  ctx.moveTo(pontosTopo[0]!.x, centroY(pontosTopo[0]!));
  for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, centroY(pontosTopo[i]!));
  ctx.stroke();

  // Corpo: sprite do palito esticado por segmento, rotacionado pelo ângulo local (o veio corre ao longo, esticar
  // não deforma -- SS6). Usa `a.trilho.meio`, já pequeno (ver comentário em `AssetsParqueRaster.trilho`).
  for (let i = 1; i < pontosTopo.length; i += 1) {
    const p0 = pontosTopo[i - 1]!;
    const p1 = pontosTopo[i]!;
    if (!naTela(p0) && !naTela(p1)) continue;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const comprimento = Math.hypot(dx, dy);
    if (comprimento < 0.01) continue;
    const angulo = Math.atan2(dy, dx);
    ctx.save();
    ctx.translate((p0.x + p1.x) / 2, (p0.y + p1.y) / 2 + espessura / 2);
    ctx.rotate(angulo);
    ctx.drawImage(a.trilho.meio, -comprimento / 2 - 0.5, -espessura / 2, comprimento + 1, espessura);
    ctx.restore();
  }

  // Tampas arredondadas nas pontas (a "ponta que faz ler palito", A4/SS6)
  const tampa = (ponto: { x: number; y: number }, lado: 'esquerda' | 'direita'): void => {
    const sprite = lado === 'esquerda' ? a.trilho.tampaEsquerda : a.trilho.tampaDireita;
    const larguraDest = espessura * (sprite.width / sprite.height);
    ctx.save();
    ctx.translate(ponto.x, ponto.y + espessura / 2);
    const offsetX = lado === 'esquerda' ? -larguraDest : 0;
    ctx.drawImage(sprite, offsetX, -espessura / 2, larguraDest, espessura);
    ctx.restore();
  };
  tampa(pontosTopo[0]!, 'esquerda');
  tampa(pontosTopo[pontosTopo.length - 1]!, 'direita');

  // Fio claro no topo (regra L3, contraste >= 3:1) -- por código, por cima do sprite
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(pontosTopo[0]!.x, pontosTopo[0]!.y);
  for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, pontosTopo[i]!.y);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// --- Terreno: corpo (tex-sorbet) + manta cisalhada (SS6 4a/4b/4e; 4c/4d -- SUBIDA/QUEDA por inclinação -- ficam de
// fora deste piloto, mesmo nível do precedente vetorial: ver memória `pintor-tema-nivel-de-pele-espelha-precedente`) ---

function desenharTerrenoParqueRaster(
  ctx: CanvasRenderingContext2D,
  pista: PistaGerada,
  camera: EstadoCamera,
  superficie: readonly { x: number; y: number }[],
  espessuraMantaPx: number
): void {
  if (!cache) {
    pintorParque.desenharTerreno?.(ctx, pista, camera, superficie, espessuraMantaPx);
    return;
  }
  const a = cache;
  const primeiro = superficie[0]!;
  const ultimo = superficie[superficie.length - 1]!;
  const FUNDO_PX = 4000;
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);

  // 4a. Corpo do terreno: tex-sorbet em `createPattern`, ancorado no mundo (não escorrega com a câmera) -- SÓ fill,
  // nunca stroke neste caminho estendido (WebKit, ver memória `webkit-stroke-coordenadas-extremas`).
  const pattern = ctx.createPattern(a.texSorbet, 'repeat');
  if (pattern) {
    const deslocX = -(((camera.x * escala) % a.texSorbet.width) + a.texSorbet.width) % a.texSorbet.width;
    if (typeof DOMMatrix !== 'undefined') pattern.setTransform(new DOMMatrix().translate(deslocX, 0));
    ctx.beginPath();
    ctx.moveTo(primeiro.x, primeiro.y);
    for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
    ctx.lineTo(ultimo.x, ultimo.y + FUNDO_PX);
    ctx.lineTo(primeiro.x, primeiro.y + FUNDO_PX);
    ctx.closePath();
    ctx.fillStyle = pattern;
    ctx.fill();
  }

  // 4b. Manta de baunilha + napolitano: faixa `manta.webp` cisalhada por segmento, seguindo a superfície (SS6).
  const alturaDestino = 64 * (escala / PX_POR_METRO);
  const larguraNativaManta = a.manta.naturalWidth;
  for (let i = 1; i < superficie.length; i += 1) {
    const p0 = superficie[i - 1]!;
    const p1 = superficie[i]!;
    const w = p1.x - p0.x;
    if (w <= 0) continue;
    const s = (p1.y - p0.y) / w;
    const xm0 = camera.x + (p0.x - LARGURA / 2 - camera.tremidaX) / escala;
    const sxNativo = (((xm0 * PX_NATIVO_POR_METRO) % larguraNativaManta) + larguraNativaManta) % larguraNativaManta;
    const swNecessario = (w * PX_NATIVO_POR_METRO) / escala;
    const swNativo = Math.min(swNecessario, larguraNativaManta - sxNativo);
    ctx.save();
    ctx.translate(p0.x, p0.y);
    ctx.transform(1, s, 0, 1, 0, 0);
    ctx.drawImage(a.manta, sxNativo, 0, swNativo, a.manta.naturalHeight, 0, 0, w + 0.5, alturaDestino);
    ctx.restore();
  }

  // 4e. Fio claro da superfície (acabamento, mesma regra do corpo: caminho ISOLADO sem as arestas estendidas)
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COR_FIO_SUPERFICIE;
  ctx.stroke();
}

export const pintorParqueRaster: PintorTema = {
  construirCamadas: (doc) => construirCamadasParqueRaster(doc),
  desenharObjeto: desenharObjetoParqueRaster,
  desenharTrilho: desenharTrilhoParqueRaster,
  desenharTerreno: desenharTerrenoParqueRaster,
};
