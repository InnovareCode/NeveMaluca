/**
 * Pintor RASTER "Pixar" da Vila do Chocolate Quente (`docs/rollout-cenarios-pixar.md` §5/§9), espelhando a técnica
 * de `bosque-raster.ts` (Morro do Pinhão): mesma forma/física/contrato de `vila.ts` (vetorial) -- geometria do
 * terreno, objetos e trilhos não mudam; só a PELE troca por imagens pré-processadas
 * (`public/assets/cenarios/vila-chocolate/*.webp`).
 *
 * `construirCamadas` é SÍNCRONO (`PintorTema`): os assets são carregados/decodificados por
 * `precarregarAssetsVilaRaster` (chamado por `ui/cenas/selecao-pista.ts` ao abrir a tela, fire-and-forget). Enquanto
 * o cache não estiver pronto, OU se qualquer imagem falhar, cada método cai no `pintorVila` (vetorial) -- nunca
 * mistura metade raster/metade vetorial no mesmo método, e nunca trava o jogo.
 *
 * Diferença de escopo vs. o Morro: esta é a PRIMEIRA pista NOTURNA (`docs/rollout-cenarios-pixar.md` §9):
 * - "Camada 1b" fixa (sem parallax, sempre na mesma posição de tela): o brilho do poente (gradiente, como o sol do
 *   Morro) e a lua (`obj-lua`, sem halo -- a ficha só dá posição pra Vila, o halo com raio só é descrito para
 *   Vulcão/Cume).
 * - Contorno DUPLO pré-assado nos objetos "de obstáculo" (aro claro deslocado 2 px lógicos, depois escuro `#0B1630`
 *   a 1 px lógico nas 8 direções, depois o sprite): legibilidade à noite. Boneco ganha só o aro claro simples (mesmo
 *   nível do Morro/Picolé). Decor sem física (caneca/pórtico/lampião), coletável (marshmallow), adereço (cata-vento)
 *   e a lua NÃO ganham contorno (`§9`: "Decor, lua, adereços: sem contorno").
 * - `tex-neve` (4ª textura da folha) não é carregada: mesmo caso de `tex-neve.webp` do Morro (existe no disco, mas
 *   `bosque-raster.ts` também não usa -- ver `public/assets/cenarios/morro-do-pinhao/tex-neve.webp`), confirmando
 *   que a folha de texturas sempre tem 1 swatch de sobra do template de geração.
 * - Feições SUBIDA/QUEDA (mesmo limiar de `docs/temas-pistas-m3.md` §0.4, reimplementado localmente -- `render/` não
 *   pode importar de `pista/`, ver memória `render-nao-pode-importar-pista`): corpo troca para `tex-telha`
 *   (SUBIDA) / `tex-enxaimel` (QUEDA). Ao fechar uma faixa de SUBIDA, planta 1 `obj-cata-vento` na crista -- a cada
 *   2ª ocorrência na janela visível, usa a variante âmbar pré-tingida (`source-atop` no boot), aproximando "a 2ª
 *   rampa de um kicker-duplo" sem acessar dados de trecho-assinatura de `pista/catalogo.ts` (fora do alcance de
 *   `render/`).
 * - `placa` (caneca) e `portico` (pórtico enxaimel) ganham pele própria aqui -- vão alem do nível do precedente
 *   vetorial (`pintor-tema-nivel-de-pele-espelha-precedente`), por pedido explícito desta tarefa.
 * - Trilho ("varal de luzinhas"): o fio (`obj-varal`) é ladrilhado (repetido) ao longo do segmento, NUNCA esticado
 *   (esticar deformaria as lâmpadas penduradas) -- diferente do palito/travessa do Picolé/Morro, cujo veio aguenta
 *   esticar. Postes = `obj-lampiao`, a cada <= 6 m, mesma técnica de esticar verticalmente do `mourao` do Morro.
 * - Janelas acesas do corpo do terreno continuam desenhadas por código (hash determinístico + brilho em círculos de
 *   alfa empilhados, nunca gradiente por quadro) -- não dá pra assar numa textura repetível sem a repetição ficar
 *   óbvia.
 */
import { ALTURA, LARGURA, PX_POR_METRO } from '../../core/constantes';
import type { ObjetoPista, PistaGerada, Trilho, TipoObjeto } from '../../core/contratos';
import { resolverUrlAsset } from '../../assets/index';
import { TEMA_VILA } from '../../data/temas';
import { atan2 } from '../../core/trig';
import type { EstadoCamera } from '../mundo';
import { mundoParaTela, pxPorMetro } from '../mundo';
import { alturaDoTerreno } from '../terreno';
import type { Parallax } from '../parallax';
import type { PintorTema } from './tipos';
import { pintorVila } from './vila';

const PASTA = 'assets/cenarios/vila-chocolate/';

/** 1 px lógico = 2 px nos assets exportados (mesma escala dos demais cenários raster). */
const PX_NATIVO_POR_LOGICO = 2;
const PX_NATIVO_POR_METRO = PX_POR_METRO * PX_NATIVO_POR_LOGICO;

/** Contorno duplo noturno (`docs/rollout-cenarios-pixar.md` §9): raio em PIXELS NATIVOS (1 e 2 px lógicos). */
const RAIO_CONTORNO_ESCURO = PX_NATIVO_POR_LOGICO;
const RAIO_ARO_CLARO = PX_NATIVO_POR_LOGICO * 2;

const COR_CONTORNO_ESCURO_NOITE = '#0B1630';
const COR_ARO_CLARO = '#FFD9A0';
const COR_CONTORNO_CLARO_BONECO = '#F4F7FF';
const COR_FIO_SUPERFICIE = '#F4F7FF';
const COR_JANELA_ACESA = '#FFB84D';
const COR_TINTA_AMBAR = 'rgba(255, 184, 77, 0.55)';

/** Limiares da detecção de feição por inclinação (`docs/temas-pistas-m3.md` §0.4), mesmos do Morro raster. */
const LIMIAR_SUBIDA_GRAUS = 8;
const LIMIAR_QUEDA_GRAUS = -28;

type ImagemObjeto = HTMLCanvasElement | HTMLImageElement;

interface AssetsVilaRaster {
  readonly fundo: HTMLImageElement;
  readonly medias: HTMLImageElement;
  readonly silhuetas: HTMLImageElement;
  readonly manta: HTMLImageElement;
  readonly texCorpo: HTMLImageElement;
  readonly texTelha: HTMLImageElement;
  readonly texEnxaimel: HTMLImageElement;
  readonly sombra: HTMLCanvasElement;
  readonly obj: {
    readonly chamine: ImagemObjeto;
    readonly barril: ImagemObjeto;
    readonly treno: ImagemObjeto;
    readonly pinheiroLuzinhas: ImagemObjeto;
    readonly bonecoGorro: ImagemObjeto;
    readonly marshmallow: ImagemObjeto;
    readonly caneca: ImagemObjeto;
    readonly porticoEnxaimel: ImagemObjeto;
    readonly lampiao: ImagemObjeto;
    readonly cataVento: ImagemObjeto;
    readonly cataVentoAmbar: ImagemObjeto;
    readonly lua: ImagemObjeto;
    readonly varal: ImagemObjeto;
  };
}

let cache: AssetsVilaRaster | null = null;
let promessaCarregamento: Promise<boolean> | null = null;

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Erro ao carregar asset de cenário: ${url}`));
  });
}

/** Contorno simples (claro), mesma técnica de `bosque-raster.ts: cozinharContorno` -- só o boneco de neve usa isto
 * (mesmo nível do Morro/Picolé: a figura "atravessável" nunca ganha contorno escuro). */
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

/** Contorno DUPLO noturno (`docs/rollout-cenarios-pixar.md` §9): aro claro deslocado (mais externo, pintado
 * primeiro) -> escuro nas 8 direções a 1 px lógico (por cima, cobre o miolo do aro, deixa só a franja externa
 * visível) -> sprite original por cima de tudo. Zero custo por quadro -- roda uma vez aqui, no carregamento. */
function cozinharContornoDuplo(doc: Document, img: HTMLImageElement, corAro: string, corEscuro: string): HTMLCanvasElement {
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

  const camadaAro = criarCamada([[-1, 0], [0, -1], [-1, -1]], RAIO_ARO_CLARO, corAro);
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
  ctx.drawImage(camadaAro, 0, 0);
  ctx.drawImage(camadaEscuro, 0, 0);
  ctx.drawImage(img, pad, pad, w, h);
  return tela;
}

/** Variante âmbar pré-tingida (`source-atop`, §9): usada na 2ª ocorrência de SUBIDA na janela visível (aproxima "a
 * 2ª rampa de um kicker-duplo" sem acesso a dados de trecho-assinatura, fora do alcance de `render/`). */
function cozinharTintaAmbar(doc: Document, img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const tela = doc.createElement('canvas');
  tela.width = w;
  tela.height = h;
  const ctx = tela.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador');
  ctx.drawImage(img, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = COR_TINTA_AMBAR;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  return tela;
}

/** Sombra de contato, tom noturno frio (coerente com a colina roxa, nunca preta/cinza). */
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

/** Hash puro (regra 0.1-4 de `vila.ts`, reimplementado aqui -- decoração determinística por índice). */
function hashDeterministico(n: number): number {
  let h = (n ^ 0x5bd1e995) >>> 0;
  h = Math.imul(h, 2654435761) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

/** Brilho de lanterna/janela SEM gradiente por quadro (regra 0.1-5 de `vila.ts`, reimplementado aqui). */
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

/** Carrega/decodifica os assets raster da Vila. Fire-and-forget pela tela de seleção de pista; o pintor cai no
 * `vila.ts` vetorial enquanto isso não resolver (ou se qualquer imagem falhar). `tex-neve.webp` NÃO entra: mesmo
 * caso do `tex-neve.webp` do Morro (existe no disco, não é usado -- sobra do template de geração da folha). */
export function precarregarAssetsVilaRaster(doc?: Document): Promise<boolean> {
  if (promessaCarregamento) return promessaCarregamento;
  const documento = doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!documento) return Promise.resolve(false);

  promessaCarregamento = (async () => {
    try {
      const nomes = [
        'fundo', 'medias', 'silhuetas', 'manta', 'tex-corpo', 'tex-telha', 'tex-enxaimel',
        'obj-chamine', 'obj-barril', 'obj-treno', 'obj-pinheiro-luzinhas', 'obj-boneco-gorro',
        'obj-marshmallow', 'obj-caneca', 'obj-portico-enxaimel', 'obj-lampiao', 'obj-cata-vento',
        'obj-lua', 'obj-varal',
      ] as const;
      const imgs = await Promise.all(nomes.map((n) => carregarImagem(resolverUrlAsset(`${PASTA}${n}.webp`))));
      const porNome = Object.fromEntries(nomes.map((n, i) => [n, imgs[i] as HTMLImageElement]));

      cache = {
        fundo: porNome['fundo']!,
        medias: porNome['medias']!,
        silhuetas: porNome['silhuetas']!,
        manta: porNome['manta']!,
        texCorpo: porNome['tex-corpo']!,
        texTelha: porNome['tex-telha']!,
        texEnxaimel: porNome['tex-enxaimel']!,
        sombra: cozinharSombra(documento),
        obj: {
          chamine: cozinharContornoDuplo(documento, porNome['obj-chamine']!, COR_ARO_CLARO, COR_CONTORNO_ESCURO_NOITE),
          barril: cozinharContornoDuplo(documento, porNome['obj-barril']!, COR_ARO_CLARO, COR_CONTORNO_ESCURO_NOITE),
          treno: cozinharContornoDuplo(documento, porNome['obj-treno']!, COR_ARO_CLARO, COR_CONTORNO_ESCURO_NOITE),
          pinheiroLuzinhas: cozinharContornoDuplo(documento, porNome['obj-pinheiro-luzinhas']!, COR_ARO_CLARO, COR_CONTORNO_ESCURO_NOITE),
          bonecoGorro: cozinharContornoSimples(documento, porNome['obj-boneco-gorro']!, COR_CONTORNO_CLARO_BONECO),
          marshmallow: porNome['obj-marshmallow']!, // coletável: sem contorno (mesmo nível do Morro/Picolé)
          caneca: porNome['obj-caneca']!, // decor sem física: sem contorno (§9)
          porticoEnxaimel: porNome['obj-portico-enxaimel']!,
          lampiao: porNome['obj-lampiao']!,
          cataVento: porNome['obj-cata-vento']!,
          cataVentoAmbar: cozinharTintaAmbar(documento, porNome['obj-cata-vento']!),
          lua: porNome['obj-lua']!,
          varal: porNome['obj-varal']!,
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
export function assetsVilaRasterProntos(): boolean {
  return cache !== null;
}

/** Só para teste/limpeza entre cenários de e2e: força esquecer o cache carregado. */
export function _esquecerAssetsVilaRasterParaTeste(): void {
  cache = null;
  promessaCarregamento = null;
}

/** Só para medição (mesmo papel de `_dimensoesCacheBosqueParaTeste` em `bosque-raster.ts`). */
export function _dimensoesCacheVilaParaTeste(): readonly { readonly nome: string; readonly w: number; readonly h: number }[] | null {
  if (!cache) return null;
  const a = cache;
  const tamanho = (nome: string, img: ImagemObjeto): { nome: string; w: number; h: number } => ({ nome, w: img.width, h: img.height });
  return [
    tamanho('fundo', a.fundo),
    tamanho('medias', a.medias),
    tamanho('silhuetas', a.silhuetas),
    tamanho('manta', a.manta),
    tamanho('texCorpo', a.texCorpo),
    tamanho('texTelha', a.texTelha),
    tamanho('texEnxaimel', a.texEnxaimel),
    tamanho('sombra', a.sombra),
    tamanho('obj.chamine', a.obj.chamine),
    tamanho('obj.barril', a.obj.barril),
    tamanho('obj.treno', a.obj.treno),
    tamanho('obj.pinheiroLuzinhas', a.obj.pinheiroLuzinhas),
    tamanho('obj.bonecoGorro', a.obj.bonecoGorro),
    tamanho('obj.marshmallow', a.obj.marshmallow),
    tamanho('obj.caneca', a.obj.caneca),
    tamanho('obj.porticoEnxaimel', a.obj.porticoEnxaimel),
    tamanho('obj.lampiao', a.obj.lampiao),
    tamanho('obj.cataVento', a.obj.cataVento),
    tamanho('obj.cataVentoAmbar', a.obj.cataVentoAmbar),
    tamanho('obj.lua', a.obj.lua),
    tamanho('obj.varal', a.obj.varal),
  ];
}

// --- Camadas de parallax (fundo + poente/lua fixos + médias + silhuetas) ---

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

function construirCamadasVilaRaster(doc: Document | undefined): Parallax {
  // Fallback vetorial só enquanto o cache não assenta, reconferido a cada quadro (ver bosque-raster.ts).
  let vetorial: Parallax | null = null;

  return {
    desenhar(ctx, cameraXm, tempoTicks) {
      const a = cache;
      if (!a) {
        vetorial ??= pintorVila.construirCamadas(doc, LARGURA, ALTURA, TEMA_VILA);
        vetorial.desenhar(ctx, cameraXm, tempoTicks);
        return;
      }

      // 1. fundo (céu do entardecer + serra distante + estrelas, já embutidas na arte), fator 0,04, opaco
      desenharTileHorizontal(ctx, a.fundo, LARGURA, ALTURA, 0.04, cameraXm);

      // 1b. FIXO (sem parallax, §9): brilho do poente (mesmo radial de `vila.ts: desenharCeuVila`) + lua, sempre na
      // mesma posição de tela -- um astro não "repete" como as estrelas do tile de fundo.
      const brilhoPoente = ctx.createRadialGradient(LARGURA * 0.1, ALTURA * 0.58, 10, LARGURA * 0.1, ALTURA * 0.58, 300);
      brilhoPoente.addColorStop(0, 'rgba(255, 170, 90, 0.35)');
      brilhoPoente.addColorStop(1, 'rgba(255, 170, 90, 0)');
      ctx.fillStyle = brilhoPoente;
      ctx.fillRect(0, 0, LARGURA, ALTURA);

      const luaX = LARGURA * 0.16;
      const luaY = ALTURA * 0.13;
      const luaAltura = 34;
      const luaLargura = luaAltura * (a.obj.lua.width / a.obj.lua.height);
      ctx.drawImage(a.obj.lua, luaX - luaLargura / 2, luaY - luaAltura / 2, luaLargura, luaAltura);

      // 2. montanhas médias (janelinhas soltas já embutidas na arte), fator 0,10, com alfa
      desenharTileHorizontal(ctx, a.medias, LARGURA, ALTURA, 0.1, cameraXm);

      // 3. silhuetas (8 chalés + varais + praça + gags já embutidos na arte), fator 0,22, tile 21:9, com alfa
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

function desenharObjetoVilaRaster(ctx: CanvasRenderingContext2D, obj: ObjetoPista, xTela: number, yTela: number, escala: number): void {
  if (!cache) {
    pintorVila.desenharObjeto(ctx, obj, xTela, yTela, escala);
    return;
  }
  const a = cache;
  const alturaPx = Math.max(8, obj.altura * escala);

  // `bandeira` sem física: `obj-lampiao` em escala 0,8 (§5.8) -- mesmo lampião usado nos postes do trilho.
  if (obj.tipo === 'bandeira') {
    desenharSpriteObjeto(ctx, a.obj.lampiao, xTela, yTela, alturaPx * 0.8);
    return;
  }

  const spritePorTipo: Partial<Record<TipoObjeto, ImagemObjeto>> = {
    pedra: obj.variante === 1 ? a.obj.barril : a.obj.chamine,
    tronco: a.obj.treno,
    pinheiro: a.obj.pinheiroLuzinhas,
    'boneco-de-neve': a.obj.bonecoGorro,
    floco: a.obj.marshmallow,
    placa: a.obj.caneca,
    portico: a.obj.porticoEnxaimel,
  };
  const sprite = spritePorTipo[obj.tipo];
  if (!sprite) {
    // rampa/trilho-objeto: mesmo nível do precedente vetorial (fallback genérico).
    pintorVila.desenharObjeto(ctx, obj, xTela, yTela, escala);
    return;
  }

  desenharSombraContato(ctx, a.sombra, xTela, yTela, Math.max(8, obj.largura * escala));
  desenharSpriteObjeto(ctx, sprite, xTela, yTela, alturaPx);
}

// --- Trilho de grind: "varal de luzinhas" -- fio LADRILHADO (nunca esticado) + postes (lampião) ---

function desenharTrilhoVilaRaster(ctx: CanvasRenderingContext2D, trilho: Trilho, pista: PistaGerada, camera: EstadoCamera): void {
  if (!cache) {
    pintorVila.desenharTrilho(ctx, trilho, pista, camera);
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

  const espessura = Math.max(3, 6 * fatorEscala);
  const posteW = Math.max(2, 5 * fatorEscala);

  const MARGEM_TELA_PX = 100;
  const naTela = (p: { x: number }): boolean => p.x >= -MARGEM_TELA_PX && p.x <= LARGURA + MARGEM_TELA_PX;

  // Postes: o lampião inteiro, em pé, SEM GIRAR, a cada <= 6 m (ficha §5.8) -- mesma técnica de esticar
  // verticalmente do `mourao` do Morro.
  const ESPACO_POSTE_M = 6;
  for (let xm = trilho.x0; xm <= trilho.x1 + 0.001; xm += ESPACO_POSTE_M) {
    const xmClamp = Math.min(xm, trilho.x1);
    const pTopo = topoY(xmClamp);
    if (!naTela(pTopo)) continue;
    const pChao = chaoY(xmClamp);
    const alturaPe = Math.max(0, pChao.y - pTopo.y);
    if (alturaPe < 1) continue;
    ctx.drawImage(a.obj.lampiao, pTopo.x - posteW / 2, pTopo.y, posteW, alturaPe);
    desenharBrilhoLanterna(ctx, pTopo.x, pTopo.y, 8 * fatorEscala);
  }

  // Contorno escuro embaixo (regra L3), por código -- igual ao precedente vetorial/demais trilhos raster.
  const centroY = (p: { x: number; y: number }) => p.y + espessura / 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = espessura + 3;
  ctx.strokeStyle = COR_CONTORNO_ESCURO_NOITE;
  ctx.beginPath();
  ctx.moveTo(pontosTopo[0]!.x, centroY(pontosTopo[0]!));
  for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, centroY(pontosTopo[i]!));
  ctx.stroke();

  // Fio (corda + lâmpadas): sprite do `obj-varal` LADRILHADO por segmento -- o veio NÃO esticável (as lâmpadas
  // deformariam), diferente do palito/travessa do Picolé/Morro. Cada ladrilho tem largura fixa em px de mundo;
  // o último ladrilho de cada segmento é recortado (fração da fonte), nunca esticado.
  const tileLarguraPx = Math.max(8, 36 * fatorEscala);
  const tileAlturaPx = espessura * 2.2; // a corda + as lâmpadas penduradas embaixo precisam de mais altura que a espessura da corda
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
        a.obj.varal,
        0, 0, a.obj.varal.width * fracaoFonte, a.obj.varal.height,
        avanco, -tileAlturaPx / 2, larguraDesenho, tileAlturaPx
      );
      avanco += tileLarguraPx;
    }
    ctx.restore();
  }

  // Fio claro no topo (contraste, mesma regra dos demais trilhos), por código, por cima do sprite ladrilhado
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(pontosTopo[0]!.x, pontosTopo[0]!.y);
  for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, pontosTopo[i]!.y);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// --- Terreno: corpo (tex-corpo, com SUBIDA=tex-telha/QUEDA=tex-enxaimel) + manta cisalhada + janelas por código ---

/** Inclinação da tangente (graus) em `xm0` -- MESMA fórmula de `inclinacaoGrausEm` (`pista/consulta.ts`),
 * reimplementada aqui com `alturaDoTerreno`/`atan2` porque `render/` não pode importar de `pista/` (ver memória
 * `render-nao-pode-importar-pista`). */
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

function desenharTerrenoVilaRaster(
  ctx: CanvasRenderingContext2D,
  pista: PistaGerada,
  camera: EstadoCamera,
  superficie: readonly { x: number; y: number }[],
  espessuraMantaPx: number
): void {
  if (!cache) {
    pintorVila.desenharTerreno?.(ctx, pista, camera, superficie, espessuraMantaPx);
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

  // 1-bis. SUBIDA=tex-telha / QUEDA=tex-enxaimel (feição por inclinação, mesma técnica do Morro raster). Ao fechar
  // uma faixa de SUBIDA, planta 1 `obj-cata-vento` na crista -- a cada 2ª ocorrência na janela visível, a variante
  // âmbar pré-tingida (aproxima "a 2ª rampa de um kicker-duplo").
  const xmDoPonto = (p: { x: number }): number => camera.x + (p.x - LARGURA / 2 - camera.tremidaX) / escala;
  const classeDoPonto = (i: number): 'subida' | 'queda' | 'corpo' => classificarSegmento(pista, xmDoPonto(superficie[i]!));
  let inicioFaixa = 0;
  let classeFaixa = classeDoPonto(0);
  let subidasFechadas = 0;
  const fecharFaixa = (fimIdx: number): void => {
    if (classeFaixa === 'corpo' || fimIdx <= inicioFaixa) return;
    const img = classeFaixa === 'subida' ? a.texTelha : a.texEnxaimel;
    const pattern = criarPatternAncorado(ctx, img, camera, escala);
    if (pattern) preencherFaixa(ctx, superficie, inicioFaixa, fimIdx, pattern, FUNDO_PX);
    if (classeFaixa === 'subida') {
      subidasFechadas += 1;
      const pCrista = superficie[fimIdx]!;
      const sprite = subidasFechadas % 2 === 0 ? a.obj.cataVentoAmbar : a.obj.cataVento;
      desenharSpriteObjeto(ctx, sprite, pCrista.x, pCrista.y, Math.max(14, 28 * fatorEscala));
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

  // 2. Manta (neve + telha cisalhadas já embutidas na arte, ficha §5.6): faixa `manta.webp` cisalhada por
  // segmento, seguindo a superfície -- igual ao Morro, independente da feição embaixo (a zona de pouso continua
  // manta em toda parte).
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

  // 3. Janelas acesas no corpo, por código (não dá pra assar em textura repetível sem repetir óbvio): a cada 11 m,
  // hash decide (~30%), teto 6 por quadro -- mesma regra do precedente vetorial (`vila.ts` §2.2.5).
  const passoJanelaM = Math.max(1, Math.round(11 / pista.dx));
  let janelasDesenhadas = 0;
  for (let i = 0; i < superficie.length && janelasDesenhadas < 6; i += passoJanelaM) {
    const h = hashDeterministico(i * 13 + 5);
    if (h % 10 >= 7) continue;
    const p = superficie[i]!;
    const jy = p.y + espessuraMantaPx * 1.6;
    desenharBrilhoLanterna(ctx, p.x, jy, 10 * fatorEscala);
    ctx.fillStyle = COR_JANELA_ACESA;
    ctx.fillRect(p.x - 4 * fatorEscala, jy - 5 * fatorEscala, 8 * fatorEscala, 10 * fatorEscala);
    janelasDesenhadas += 1;
  }

  // 4. Fio claro da superfície (acabamento, caminho ISOLADO sem as arestas estendidas)
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COR_FIO_SUPERFICIE;
  ctx.stroke();
}

export const pintorVilaRaster: PintorTema = {
  construirCamadas: (doc) => construirCamadasVilaRaster(doc),
  desenharObjeto: desenharObjetoVilaRaster,
  desenharTrilho: desenharTrilhoVilaRaster,
  desenharTerreno: desenharTerrenoVilaRaster,
};
