/**
 * Pintor RASTER "Pixar" do Vulcão Pé-Gelado (`docs/rollout-cenarios-pixar.md` §6/§9), espelhando a técnica de
 * `vila-raster.ts` (mesma pista noturna anterior): mesma forma/física/contrato de `vulcao.ts` (vetorial) --
 * geometria do terreno, objetos e trilhos não mudam; só a PELE troca por imagens pré-processadas
 * (`public/assets/cenarios/vulcao-pe-gelado/*.webp`).
 *
 * `construirCamadas` é SÍNCRONO (`PintorTema`): os assets são carregados/decodificados por
 * `precarregarAssetsVulcaoRaster` (chamado por `ui/cenas/selecao-pista.ts` ao abrir a tela, fire-and-forget).
 * Enquanto o cache não estiver pronto, OU se qualquer imagem falhar, cada método cai no `pintorVulcao` (vetorial) --
 * nunca mistura metade raster/metade vetorial no mesmo método, e nunca trava o jogo.
 *
 * Diferença de escopo vs. a Vila (`pintor-raster-noturno-contorno-duplo-e-camada-fixa` na memória): o Vulcão tem
 * DUAS luzes (§6, "Hora e luz" -- lua fria em cima/esquerda + magma quente embaixo/direita), então o contorno
 * duplo pré-assado dos objetos "de basalto" (prisma/bomba/coluna/fumarola) tem TRÊS camadas, não duas: aro frio
 * `#BFD0EA` (cima/esquerda) + aro quente `#FF6A1F` (baixo/direita), os dois desenhados ANTES do escuro `#0B1630`
 * (8 direções, por cima, cobrindo o miolo de ambos os aros) + o sprite. O boneco (`obj-boneco-escalda-pes`) ganha
 * só o aro frio simples (mesmo nível da Vila/Morro/Picolé). Cristal (coletável), chaleira/termômetro/pórtico
 * (decor sem física) e baforada (adereço) NÃO ganham contorno (§9: "Decor, lua, adereços: sem contorno").
 * `tex-neve` (4º swatch da folha) não é carregado (mesmo caso de todos os cenários raster -- sobra do template).
 *
 * Feições SUBIDA/QUEDA (mesmo limiar de `docs/temas-pistas-m3.md` §0.4, reimplementado localmente -- `render/` não
 * pode importar de `pista/`, ver memória `render-nao-pode-importar-pista`): corpo troca para `tex-crosta` (SUBIDA,
 * crosta de gêiser) / `tex-basalto` (QUEDA, parede de colunas). Ao fechar uma faixa de SUBIDA, planta 1
 * `obj-baforada` na crista (vapor; §9 não descreve variante tingida para esta pista, diferente do cata-vento da
 * Vila -- não inventada aqui). As rachaduras de magma do corpo continuam desenhadas por código (ficha §3.2-5/§3.3,
 * mesma técnica de 3 traços -- halo alfa, traço laranja, miolo amarelo -- de `vulcao.ts`), por cima do padrão de
 * `tex-corpo`: não dá pra assar numa textura repetível sem o padrão ficar óbvio, e o código já garante que a
 * rachadura nunca encosta na manta (L2).
 *
 * Trilho ("ponte de basalto", §6.8): pilares = sprite `obj-prisma-basalto` (com o MESMO contorno triplo pré-assado
 * do objeto `pedra`) esticado verticalmente até a altura exata do trilho em cada ponto (a ficha pede explicitamente
 * "desenhado com altura explícita"), a cada <= 5 m (mesmo espaçamento de `desenharTrilhoPonteBasalto`). Deck =
 * `obj-ponte-basalto` LADRILHADO (nunca esticado -- "o meio repete laje a laje, senão as juntas deformam", mesma
 * regra do varal da Vila), com fio de geada e contorno escuro por código por cima (regra L3).
 */
import { ALTURA, LARGURA, PX_POR_METRO } from '../../core/constantes';
import type { ObjetoPista, PistaGerada, Trilho, TipoObjeto } from '../../core/contratos';
import { resolverUrlAsset } from '../../assets/index';
import { TEMA_VULCAO } from '../../data/temas';
import { atan2 } from '../../core/trig';
import type { EstadoCamera } from '../mundo';
import { mundoParaTela, pxPorMetro } from '../mundo';
import { alturaDoTerreno, ESPESSURA_MANTA_NEVE_PX } from '../terreno';
import type { Parallax } from '../parallax';
import type { PintorTema } from './tipos';
import { pintorVulcao } from './vulcao';

const PASTA = 'assets/cenarios/vulcao-pe-gelado/';

/** 1 px lógico = 2 px nos assets exportados (mesma escala dos demais cenários raster). */
const PX_NATIVO_POR_LOGICO = 2;
const PX_NATIVO_POR_METRO = PX_POR_METRO * PX_NATIVO_POR_LOGICO;

/** Contorno duplo/triplo noturno (`docs/rollout-cenarios-pixar.md` §9): raio em PIXELS NATIVOS (1 e 2 px lógicos). */
const RAIO_CONTORNO_ESCURO = PX_NATIVO_POR_LOGICO;
const RAIO_ARO_CLARO = PX_NATIVO_POR_LOGICO * 2;

const COR_CONTORNO_ESCURO_NOITE = '#0B1630';
const COR_ARO_FRIO = '#BFD0EA';
const COR_ARO_QUENTE = '#FF6A1F';
const COR_CONTORNO_CLARO_BONECO = '#EEF5FF';
const COR_FIO_SUPERFICIE = '#EEF5FF';
const COR_BORDA_TERRENO = '#6E8EBA';
const COR_PONTE_GEADA = '#DDEBFA';

const COR_RACHADURA_TRACO = '#FF6A1F';
const COR_RACHADURA_MIOLO = '#FFD23F';
const COR_RACHADURA_HALO = 'rgba(255, 106, 31, 0.3)';

/** Lua fria: posição (16%, 12%), raio 14, halo raio 60 (`docs/rollout-cenarios-pixar.md` §8/§9, igual a `vulcao.ts`). */
const LUA_X_FRAC = 0.16;
const LUA_Y_FRAC = 0.12;
const LUA_ALTURA_PX = 28; // raio 14 lógico * 2
const HALO_RAIO = 60;

/** Limiares da detecção de feição por inclinação (`docs/temas-pistas-m3.md` §0.4), mesmos dos demais raster. */
const LIMIAR_SUBIDA_GRAUS = 8;
const LIMIAR_QUEDA_GRAUS = -28;

type ImagemObjeto = HTMLCanvasElement | HTMLImageElement;

interface AssetsVulcaoRaster {
  readonly fundo: HTMLImageElement;
  readonly medias: HTMLImageElement;
  readonly silhuetas: HTMLImageElement;
  readonly manta: HTMLImageElement;
  readonly texCorpo: HTMLImageElement;
  readonly texCrosta: HTMLImageElement;
  readonly texBasalto: HTMLImageElement;
  readonly sombra: HTMLCanvasElement;
  readonly obj: {
    readonly prismaBasalto: ImagemObjeto;
    readonly bombaVulcanica: ImagemObjeto;
    readonly colunaTombada: ImagemObjeto;
    readonly fumarola: ImagemObjeto;
    readonly bonecoEscaldaPes: ImagemObjeto;
    readonly cristalGelo: ImagemObjeto;
    readonly ponteBasalto: ImagemObjeto;
    readonly chaleira: ImagemObjeto;
    readonly baforada: ImagemObjeto;
    readonly lua: ImagemObjeto;
    readonly termometro: ImagemObjeto;
    readonly porticoBasalto: ImagemObjeto;
  };
}

let cache: AssetsVulcaoRaster | null = null;
let promessaCarregamento: Promise<boolean> | null = null;

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Erro ao carregar asset de cenário: ${url}`));
  });
}

/** Contorno simples (claro), mesma técnica de `vila-raster.ts: cozinharContornoSimples` -- só o boneco usa isto. */
function cozinharContornoSimples(doc: Document, img: HTMLImageElement, cor: string): HTMLCanvasElement {
  const raio = PX_NATIVO_POR_LOGICO;
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
  for (const [dx, dy] of offsets) ctx.drawImage(img, pad + dx * raio, pad + dy * raio, w, h);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, tela.width, tela.height);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(img, pad, pad, w, h);
  return tela;
}

/** Contorno TRIPLO noturno (`docs/rollout-cenarios-pixar.md` §9, "Vulcão soma o aro quente"): aro frio
 * (cima/esquerda) + aro quente (baixo/direita), os dois desenhados primeiro -> escuro nas 8 direções por cima
 * (cobre o miolo de ambos) -> sprite original. Zero custo por quadro -- roda uma vez aqui, no carregamento. */
function cozinharContornoTriplo(doc: Document, img: HTMLImageElement, corFrio: string, corQuente: string, corEscuro: string): HTMLCanvasElement {
  const pad = RAIO_ARO_CLARO + 1;
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const criarCamada = (offsets: ReadonlyArray<readonly [number, number]>, raio: number, cor: string): HTMLCanvasElement => {
    const t = doc.createElement('canvas');
    t.width = w + pad * 2;
    t.height = h + pad * 2;
    const c = t.getContext('2d');
    if (!c) throw new Error('Canvas 2D indisponível neste navegador');
    for (const [dx, dy] of offsets) c.drawImage(img, pad + dx * raio, pad + dy * raio, w, h);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = cor;
    c.fillRect(0, 0, t.width, t.height);
    return t;
  };

  const camadaFrio = criarCamada([[-1, 0], [0, -1], [-1, -1]], RAIO_ARO_CLARO, corFrio);
  const camadaQuente = criarCamada([[1, 0], [0, 1], [1, 1]], RAIO_ARO_CLARO, corQuente);
  const camadaEscuro = criarCamada(
    [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
    RAIO_CONTORNO_ESCURO,
    corEscuro
  );

  const tela = doc.createElement('canvas');
  tela.width = w + pad * 2;
  tela.height = h + pad * 2;
  const ctx = tela.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador');
  ctx.drawImage(camadaFrio, 0, 0);
  ctx.drawImage(camadaQuente, 0, 0);
  ctx.drawImage(camadaEscuro, 0, 0);
  ctx.drawImage(img, pad, pad, w, h);
  return tela;
}

/** Sombra de contato, tom noturno frio (mesma de `vila-raster.ts: cozinharSombra` -- cross-tema, não muda por pista). */
function cozinharSombra(doc: Document): HTMLCanvasElement {
  const tela = doc.createElement('canvas');
  tela.width = 240;
  tela.height = 80;
  const ctx = tela.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador');
  const grad = ctx.createRadialGradient(120, 40, 4, 120, 40, 118);
  grad.addColorStop(0, 'rgba(11, 22, 48, 0.4)');
  grad.addColorStop(1, 'rgba(11, 22, 48, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(120, 40, 118, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  return tela;
}

/** Hash puro (regra 0.1-4): decoração determinística por índice, mesma fórmula de `vulcao.ts`. */
function hashDeterministico(n: number): number {
  let h = (n ^ 0x5bd1e995) >>> 0;
  h = Math.imul(h, 2654435761) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

/** Carrega/decodifica os assets raster do Vulcão. Fire-and-forget pela tela de seleção de pista; o pintor cai no
 * `vulcao.ts` vetorial enquanto isso não resolver (ou se qualquer imagem falhar). `tex-neve.webp` NÃO entra: mesmo
 * caso dos demais cenários raster -- sobra do template de geração da folha de texturas. */
export function precarregarAssetsVulcaoRaster(doc?: Document): Promise<boolean> {
  if (promessaCarregamento) return promessaCarregamento;
  const documento = doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!documento) return Promise.resolve(false);

  promessaCarregamento = (async () => {
    try {
      const nomes = [
        'fundo', 'medias', 'silhuetas', 'manta', 'tex-corpo', 'tex-crosta', 'tex-basalto',
        'obj-prisma-basalto', 'obj-bomba-vulcanica', 'obj-coluna-tombada', 'obj-fumarola',
        'obj-boneco-escalda-pes', 'obj-cristal-gelo', 'obj-ponte-basalto', 'obj-chaleira',
        'obj-baforada', 'obj-lua', 'obj-termometro', 'obj-portico-basalto',
      ] as const;
      const imgs = await Promise.all(nomes.map((n) => carregarImagem(resolverUrlAsset(`${PASTA}${n}.webp`))));
      const porNome = Object.fromEntries(nomes.map((n, i) => [n, imgs[i] as HTMLImageElement]));

      cache = {
        fundo: porNome['fundo']!,
        medias: porNome['medias']!,
        silhuetas: porNome['silhuetas']!,
        manta: porNome['manta']!,
        texCorpo: porNome['tex-corpo']!,
        texCrosta: porNome['tex-crosta']!,
        texBasalto: porNome['tex-basalto']!,
        sombra: cozinharSombra(documento),
        obj: {
          prismaBasalto: cozinharContornoTriplo(documento, porNome['obj-prisma-basalto']!, COR_ARO_FRIO, COR_ARO_QUENTE, COR_CONTORNO_ESCURO_NOITE),
          bombaVulcanica: cozinharContornoTriplo(documento, porNome['obj-bomba-vulcanica']!, COR_ARO_FRIO, COR_ARO_QUENTE, COR_CONTORNO_ESCURO_NOITE),
          colunaTombada: cozinharContornoTriplo(documento, porNome['obj-coluna-tombada']!, COR_ARO_FRIO, COR_ARO_QUENTE, COR_CONTORNO_ESCURO_NOITE),
          fumarola: cozinharContornoTriplo(documento, porNome['obj-fumarola']!, COR_ARO_FRIO, COR_ARO_QUENTE, COR_CONTORNO_ESCURO_NOITE),
          bonecoEscaldaPes: cozinharContornoSimples(documento, porNome['obj-boneco-escalda-pes']!, COR_CONTORNO_CLARO_BONECO),
          cristalGelo: porNome['obj-cristal-gelo']!, // coletável: sem contorno (mesmo nível de sempre)
          ponteBasalto: porNome['obj-ponte-basalto']!, // trilho ladrilhado: contorno por código, não pré-assado
          chaleira: porNome['obj-chaleira']!, // decor sem física: sem contorno (§9)
          baforada: porNome['obj-baforada']!, // adereço da SUBIDA: sem contorno (§9)
          lua: porNome['obj-lua']!,
          termometro: porNome['obj-termometro']!,
          porticoBasalto: porNome['obj-portico-basalto']!,
        },
      };
      return true;
    } catch {
      cache = null;
      return false;
    }
  })();
  return promessaCarregamento;
}

/** Síncrono, sem esperar a promessa (mesmo papel de `assetsParqueRasterProntos` em `parque-raster.ts`). */
export function assetsVulcaoRasterProntos(): boolean {
  return cache !== null;
}

/** Só para teste/limpeza entre cenários de e2e: força esquecer o cache carregado. */
export function _esquecerAssetsVulcaoRasterParaTeste(): void {
  cache = null;
  promessaCarregamento = null;
}

/** Só para medição (mesmo papel de `_dimensoesCacheVilaParaTeste` em `vila-raster.ts`). */
export function _dimensoesCacheVulcaoParaTeste(): readonly { readonly nome: string; readonly w: number; readonly h: number }[] | null {
  if (!cache) return null;
  const a = cache;
  const tamanho = (nome: string, img: ImagemObjeto): { nome: string; w: number; h: number } => ({ nome, w: img.width, h: img.height });
  return [
    tamanho('fundo', a.fundo),
    tamanho('medias', a.medias),
    tamanho('silhuetas', a.silhuetas),
    tamanho('manta', a.manta),
    tamanho('texCorpo', a.texCorpo),
    tamanho('texCrosta', a.texCrosta),
    tamanho('texBasalto', a.texBasalto),
    tamanho('sombra', a.sombra),
    tamanho('obj.prismaBasalto', a.obj.prismaBasalto),
    tamanho('obj.bombaVulcanica', a.obj.bombaVulcanica),
    tamanho('obj.colunaTombada', a.obj.colunaTombada),
    tamanho('obj.fumarola', a.obj.fumarola),
    tamanho('obj.bonecoEscaldaPes', a.obj.bonecoEscaldaPes),
    tamanho('obj.cristalGelo', a.obj.cristalGelo),
    tamanho('obj.ponteBasalto', a.obj.ponteBasalto),
    tamanho('obj.chaleira', a.obj.chaleira),
    tamanho('obj.baforada', a.obj.baforada),
    tamanho('obj.lua', a.obj.lua),
    tamanho('obj.termometro', a.obj.termometro),
    tamanho('obj.porticoBasalto', a.obj.porticoBasalto),
  ];
}

// --- Camadas de parallax (fundo + lua fixa com halo + médias + silhuetas) ---

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

function construirCamadasVulcaoRaster(doc: Document | undefined): Parallax {
  if (!cache) return pintorVulcao.construirCamadas(doc, LARGURA, ALTURA, TEMA_VULCAO);

  return {
    desenhar(ctx, cameraXm, tempoTicks) {
      const a = cache;
      if (!a) return;

      // 1. fundo (céu do crepúsculo + serra distante + cone do vulcão com cratera/lava, já embutidos na arte),
      // fator 0,04, opaco
      desenharTileHorizontal(ctx, a.fundo, LARGURA, ALTURA, 0.04, cameraXm);

      // 1b. FIXO (sem parallax, §9): lua + halo radial, sempre na mesma posição de tela.
      const luaX = LARGURA * LUA_X_FRAC;
      const luaY = ALTURA * LUA_Y_FRAC;
      const halo = ctx.createRadialGradient(luaX, luaY, 10, luaX, luaY, HALO_RAIO);
      halo.addColorStop(0, 'rgba(221, 235, 250, 0.18)');
      halo.addColorStop(1, 'rgba(221, 235, 250, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, LARGURA, ALTURA);

      const luaLargura = LUA_ALTURA_PX * (a.obj.lua.width / a.obj.lua.height);
      ctx.drawImage(a.obj.lua, luaX - luaLargura / 2, luaY - LUA_ALTURA_PX / 2, luaLargura, LUA_ALTURA_PX);

      // 2. montanhas médias (capuz de gelo + rachaduras de magma já embutidos na arte), fator 0,10, com alfa
      desenharTileHorizontal(ctx, a.medias, LARGURA, ALTURA, 0.1, cameraXm);

      // 3. silhuetas (colunas de basalto, gêiseres, estação da Professora, chaleira já embutidos na arte), fator
      // 0,22, tile 21:9, com alfa
      desenharTileHorizontal(ctx, a.silhuetas, 1260, ALTURA, 0.22, cameraXm);

      void tempoTicks;
    },
  } satisfies Parallax;
}

// --- Objetos de jogo: sprite pré-contornado (ou não, §9) + sombra de contato ---

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

function desenharObjetoVulcaoRaster(ctx: CanvasRenderingContext2D, obj: ObjetoPista, xTela: number, yTela: number, escala: number): void {
  if (!cache) {
    pintorVulcao.desenharObjeto(ctx, obj, xTela, yTela, escala);
    return;
  }
  const a = cache;
  const alturaPx = Math.max(8, obj.altura * escala);

  // `bandeira` sem física: `obj-chaleira` (§6.8, R2C4) -- mesma técnica de dupla função de sprite da Vila.
  if (obj.tipo === 'bandeira') {
    desenharSpriteObjeto(ctx, a.obj.chaleira, xTela, yTela, alturaPx);
    return;
  }

  const spritePorTipo: Partial<Record<TipoObjeto, ImagemObjeto>> = {
    pedra: obj.variante === 1 ? a.obj.bombaVulcanica : a.obj.prismaBasalto,
    tronco: a.obj.colunaTombada,
    pinheiro: a.obj.fumarola,
    'boneco-de-neve': a.obj.bonecoEscaldaPes,
    floco: a.obj.cristalGelo,
    placa: a.obj.termometro,
    portico: a.obj.porticoBasalto,
  };
  const sprite = spritePorTipo[obj.tipo];
  if (!sprite) {
    // rampa/trilho-objeto: mesmo nível do precedente vetorial (fallback genérico).
    pintorVulcao.desenharObjeto(ctx, obj, xTela, yTela, escala);
    return;
  }

  desenharSombraContato(ctx, a.sombra, xTela, yTela, Math.max(8, obj.largura * escala));
  desenharSpriteObjeto(ctx, sprite, xTela, yTela, alturaPx);
}

// --- Trilho de grind: "ponte de basalto" -- pilares (prisma, altura explícita) + deck LADRILHADO (nunca esticado) ---

function desenharTrilhoVulcaoRaster(ctx: CanvasRenderingContext2D, trilho: Trilho, pista: PistaGerada, camera: EstadoCamera): void {
  if (!cache) {
    pintorVulcao.desenharTrilho(ctx, trilho, pista, camera);
    return;
  }
  const a = cache;
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const fatorEscala = escala / PX_POR_METRO;
  const topoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm) + trilho.altura, camera, PX_POR_METRO);
  const chaoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm), camera, PX_POR_METRO);

  const pontosTopo: { x: number; y: number }[] = [];
  for (let xm = trilho.x0; xm <= trilho.x1; xm += pista.dx) pontosTopo.push(topoY(xm));
  const ultimoXm = trilho.x1;
  if (pontosTopo.length === 0 || pontosTopo[pontosTopo.length - 1]!.x !== topoY(ultimoXm).x) pontosTopo.push(topoY(ultimoXm));
  if (pontosTopo.length < 2) return;

  const espessura = Math.max(4, 7 * fatorEscala);
  const pilarW = Math.max(3, 7 * fatorEscala);

  const MARGEM_TELA_PX = 100;
  const naTela = (p: { x: number }): boolean => p.x >= -MARGEM_TELA_PX && p.x <= LARGURA + MARGEM_TELA_PX;

  // Pilares: `obj-prisma-basalto` (MESMO contorno triplo do objeto `pedra`) esticado verticalmente até a altura
  // exata entre o topo do trilho e o chão -- a ficha pede explicitamente "desenhado com altura explícita"
  // (§6.8, R1C1). Nas pontas e a cada <= 5 m (mesmo espaçamento do precedente vetorial).
  const ESPACO_PILAR_M = 5;
  for (let xm = trilho.x0; xm <= trilho.x1 + 0.001; xm += ESPACO_PILAR_M) {
    const xmClamp = Math.min(xm, trilho.x1);
    const pTopo = topoY(xmClamp);
    if (!naTela(pTopo)) continue;
    const pChao = chaoY(xmClamp);
    const alturaPilar = Math.max(0, pChao.y - pTopo.y);
    if (alturaPilar < 1) continue;
    ctx.drawImage(a.obj.prismaBasalto, pTopo.x - pilarW / 2, pTopo.y, pilarW, alturaPilar);
  }

  // Contorno escuro embaixo (regra L3), por código -- igual aos demais trilhos raster.
  const centroY = (p: { x: number; y: number }) => p.y + espessura / 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = espessura + 3;
  ctx.strokeStyle = COR_CONTORNO_ESCURO_NOITE;
  ctx.beginPath();
  ctx.moveTo(pontosTopo[0]!.x, centroY(pontosTopo[0]!));
  for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, centroY(pontosTopo[i]!));
  ctx.stroke();

  // Deck: `obj-ponte-basalto` LADRILHADO por segmento -- "o meio repete laje a laje, não estica, senão as juntas
  // deformam" (§6.8). Cada ladrilho tem largura fixa em px de mundo; o último ladrilho de cada segmento é
  // recortado (fração da fonte), nunca esticado -- mesma técnica do varal da Vila.
  const tileLarguraPx = Math.max(8, 44 * fatorEscala);
  const tileAlturaPx = espessura * 1.6;
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
    let avanco = -comprimento / 2;
    while (avanco < comprimento / 2 - 0.01) {
      const larguraDesenho = Math.min(tileLarguraPx, comprimento / 2 - avanco);
      const fracaoFonte = larguraDesenho / tileLarguraPx;
      ctx.drawImage(
        a.obj.ponteBasalto,
        0, 0, a.obj.ponteBasalto.width * fracaoFonte, a.obj.ponteBasalto.height,
        avanco, -tileAlturaPx / 2, larguraDesenho, tileAlturaPx
      );
      avanco += tileLarguraPx;
    }
    ctx.restore();
  }

  // Fio de geada no topo (contraste, regra L3), por código, por cima do sprite ladrilhado
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(pontosTopo[0]!.x, pontosTopo[0]!.y);
  for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, pontosTopo[i]!.y);
  ctx.strokeStyle = COR_PONTE_GEADA;
  ctx.lineWidth = 2;
  ctx.stroke();
}

// --- Terreno: corpo (tex-corpo, com SUBIDA=tex-crosta/QUEDA=tex-basalto) + manta cisalhada + rachaduras por código ---

/** Inclinação da tangente (graus) em `xm0` -- mesma fórmula de `inclinacaoGrausEm` (`pista/consulta.ts`),
 * reimplementada aqui porque `render/` não pode importar de `pista/` (ver memória `render-nao-pode-importar-pista`). */
function anguloGrausEmSegmento(pista: PistaGerada, xm0: number): number {
  const h = pista.dx;
  const y0 = alturaDoTerreno(pista, xm0);
  const y1 = alturaDoTerreno(pista, xm0 + h);
  return atan2(y1 - y0, h);
}

function classificarSegmento(pista: PistaGerada, xm0: number): 'subida' | 'queda' | 'corpo' {
  const ang = anguloGrausEmSegmento(pista, xm0);
  if (ang >= LIMIAR_SUBIDA_GRAUS) return 'subida';
  if (ang <= LIMIAR_QUEDA_GRAUS) return 'queda';
  return 'corpo';
}

function criarPatternAncorado(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  camera: EstadoCamera,
  escala: number
): CanvasPattern | null {
  const pattern = ctx.createPattern(img, 'repeat');
  if (!pattern) return null;
  const deslocX = -(((camera.x * escala) % img.width) + img.width) % img.width;
  if (typeof DOMMatrix !== 'undefined') pattern.setTransform(new DOMMatrix().translate(deslocX, 0));
  return pattern;
}

function preencherFaixa(
  ctx: CanvasRenderingContext2D,
  pontos: readonly { x: number; y: number }[],
  i0: number,
  i1: number,
  pattern: CanvasPattern,
  fundoPx: number
): void {
  const p0 = pontos[i0]!;
  const p1 = pontos[i1]!;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  for (let i = i0 + 1; i <= i1; i += 1) ctx.lineTo(pontos[i]!.x, pontos[i]!.y);
  ctx.lineTo(p1.x, p1.y + fundoPx);
  ctx.lineTo(p0.x, p0.y + fundoPx);
  ctx.closePath();
  ctx.fillStyle = pattern;
  ctx.fill();
}

/** Rachadura de magma no corpo: 3 traços (halo alfa largo, traço laranja, miolo amarelo), mesma técnica de
 * `vulcao.ts: desenharRachaduraCorpo` -- não dá pra assar numa textura repetível sem o padrão ficar óbvio, e o
 * código garante que nunca encosta na manta (L2). */
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

function desenharTerrenoVulcaoRaster(
  ctx: CanvasRenderingContext2D,
  pista: PistaGerada,
  camera: EstadoCamera,
  superficie: readonly { x: number; y: number }[],
  espessuraMantaPx: number
): void {
  if (!cache) {
    pintorVulcao.desenharTerreno?.(ctx, pista, camera, superficie, espessuraMantaPx);
    return;
  }
  const a = cache;
  const primeiro = superficie[0]!;
  const FUNDO_PX = 4000;
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const fatorEscala = escala / PX_POR_METRO;

  // 1. Corpo do terreno: tex-corpo em todo o trecho visível (só fill, nunca stroke no caminho estendido -- WebKit,
  // ver memória `webkit-stroke-coordenadas-extremas`).
  const patternCorpo = criarPatternAncorado(ctx, a.texCorpo, camera, escala);
  if (patternCorpo) preencherFaixa(ctx, superficie, 0, superficie.length - 1, patternCorpo, FUNDO_PX);

  // 1-bis. SUBIDA=tex-crosta (crosta de gêiser) / QUEDA=tex-basalto (parede de colunas), feição por inclinação
  // (mesma técnica da Vila/Morro). Ao fechar uma faixa de SUBIDA, planta 1 `obj-baforada` na crista (vapor).
  const xmDoPonto = (p: { x: number }): number => camera.x + (p.x - LARGURA / 2 - camera.tremidaX) / escala;
  const classeDoPonto = (i: number): 'subida' | 'queda' | 'corpo' => classificarSegmento(pista, xmDoPonto(superficie[i]!));
  let inicioFaixa = 0;
  let classeFaixa = classeDoPonto(0);
  const fecharFaixa = (fimIdx: number): void => {
    if (classeFaixa === 'corpo' || fimIdx <= inicioFaixa) return;
    const img = classeFaixa === 'subida' ? a.texCrosta : a.texBasalto;
    const pattern = criarPatternAncorado(ctx, img, camera, escala);
    if (pattern) preencherFaixa(ctx, superficie, inicioFaixa, fimIdx, pattern, FUNDO_PX);
    if (classeFaixa === 'subida') {
      const pCrista = superficie[fimIdx]!;
      desenharSpriteObjeto(ctx, a.obj.baforada, pCrista.x, pCrista.y, Math.max(14, 26 * fatorEscala));
    }
  };
  for (let i = 1; i < superficie.length; i += 1) {
    const classe = classeDoPonto(i);
    if (classe !== classeFaixa) {
      fecharFaixa(i);
      inicioFaixa = i;
      classeFaixa = classe;
    }
  }
  fecharFaixa(superficie.length - 1);

  // 2. Manta (gelo de geleira cisalhada já embutida na arte, ficha §6.6): faixa `manta.webp` cisalhada por
  // segmento, seguindo a superfície -- igual à Vila, independente da feição embaixo.
  const alturaDestino = 64 * fatorEscala;
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

  // 3. Rachaduras de magma no corpo, por código (não dá pra assar sem o padrão ficar óbvio): a cada 9 m, hash
  // decide, teto 8 por quadro -- mesma regra do precedente vetorial (`vulcao.ts` §3.2.5). Nunca encostam na manta
  // (L2): começam a `E + 12` px da superfície.
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

  // 5. Fio claro da superfície (acabamento, caminho ISOLADO sem as arestas estendidas)
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = COR_FIO_SUPERFICIE;
  ctx.stroke();
}

export const pintorVulcaoRaster: PintorTema = {
  construirCamadas: (doc) => construirCamadasVulcaoRaster(doc),
  desenharObjeto: desenharObjetoVulcaoRaster,
  desenharTrilho: desenharTrilhoVulcaoRaster,
  desenharTerreno: desenharTerrenoVulcaoRaster,
};
