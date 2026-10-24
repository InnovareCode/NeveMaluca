/**
 * Pintor RASTER "Pixar" do Cume da Ventania (`docs/rollout-cenarios-pixar.md` §7/§9), última pista, espelhando a
 * técnica de `vila-raster.ts`/`vulcao-raster.ts`: mesma forma/física/contrato de `cume.ts` (vetorial) -- geometria
 * do terreno, objetos e trilhos não mudam; só a PELE troca por imagens pré-processadas
 * (`public/assets/cenarios/cume-da-ventania/*.webp`).
 *
 * `construirCamadas` é SÍNCRONO (`PintorTema`): os assets são carregados/decodificados por
 * `precarregarAssetsCumeRaster` (chamado por `ui/cenas/selecao-pista.ts` ao abrir a tela, fire-and-forget).
 * Enquanto o cache não estiver pronto, OU se qualquer imagem falhar, cada método cai no `pintorCume` (vetorial) --
 * nunca mistura metade raster/metade vetorial no mesmo método, e nunca trava o jogo.
 *
 * Diferença de escopo vs. a Vila/o Vulcão: o Cume tem UMA luz só (lua, §7 "Hora e luz"), então o contorno duplo
 * pré-assado dos objetos "de gelo/madeira" (rocha-gelo/bloco-gelo/laje-cornija/pinheiro-torto) tem só DUAS camadas
 * (aro de lua `#E8F1FF` + escuro `#0B1630`), igual à Vila -- não precisa do 3º aro quente do Vulcão. O boneco
 * (`obj-boneco-cachecol`) ganha só o aro claro simples. Cristal (coletável), biruta/placa (decor sem física) NÃO
 * ganham contorno (§9: "Decor, lua, adereços: sem contorno"). `tex-neve` (4º swatch) não é carregado (mesmo caso
 * de todos os cenários raster).
 *
 * O mar de nuvens e a aurora JÁ estão embutidos no `fundo.webp` (nota do rollout §7: "a ficha tem 4 camadas de
 * fundo; o método tem 3 imagens" -- juntar o mar de nuvens ao céu custa 0,02 de parallax que ninguém vê). A
 * pulsação opcional da aurora (§9) NÃO foi implementada: a ficha marca como "testar se incomoda, desligar se sim"
 * -- nem o precedente vetorial (`cume.ts`) implementa, e arriscar um `globalAlpha` oscilante sem pedido forte não
 * compensa (mesma filosofia de não inventar escopo da memória `pintor-tema-nivel-de-pele-espelha-precedente`).
 *
 * Feições SUBIDA/QUEDA (mesmo limiar de `docs/temas-pistas-m3.md` §0.4, reimplementado localmente -- `render/` não
 * pode importar de `pista/`): corpo troca para `tex-cornija` (SUBIDA) / `tex-fenda` (QUEDA). Ao fechar uma faixa
 * de SUBIDA, planta 1 `obj-biruta` na crista (mesma técnica do cata-vento da Vila/baforada do Vulcão). Estilhaços
 * de gelo e sastrugi do corpo continuam por código (ficha §4.2-6/§4.3, mesma técnica de `cume.ts`), por cima do
 * padrão de `tex-corpo`.
 *
 * Trilho (§0.5/§4.3, regra L3): altura < 1 m => pele "corda" (`obj-corda` LADRILHADO, nunca esticado -- "o meio
 * repete, senão a trança deforma" -- + `obj-poste-corda` esticado verticalmente a cada <= 5 m); altura >= 1 m =>
 * pele "cabo de teleférico" (`obj-torre-trelica` nas duas pontas + CABO DE AÇO POR CÓDIGO, 3 px `#B8C4DA` + fio
 * `#F7FBFF`, como na ficha -- "sem postes no meio, o vazio embaixo é a graça"). Pórtico de gelo (`portico`) =
 * montado por código: 2 x `obj-bloco-gelo` (pilares) + `obj-laje-cornija` (verga) por cima -- não coube célula na
 * folha de objetos (§7.8), mesmo nível de "pele própria além do precedente" que a Vila deu a placa/pórtico.
 */
import { ALTURA, LARGURA, PX_POR_METRO } from '../../core/constantes';
import type { ObjetoPista, PistaGerada, Trilho, TipoObjeto } from '../../core/contratos';
import { resolverUrlAsset } from '../../assets/index';
import { TEMA_CUME } from '../../data/temas';
import { atan2 } from '../../core/trig';
import type { EstadoCamera } from '../mundo';
import { mundoParaTela, pxPorMetro } from '../mundo';
import { alturaDoTerreno, ESPESSURA_MANTA_NEVE_PX } from '../terreno';
import type { Parallax } from '../parallax';
import type { PintorTema } from './tipos';
import { pintorCume } from './cume';

const PASTA = 'assets/cenarios/cume-da-ventania/';

/** 1 px lógico = 2 px nos assets exportados (mesma escala dos demais cenários raster). */
const PX_NATIVO_POR_LOGICO = 2;
const PX_NATIVO_POR_METRO = PX_POR_METRO * PX_NATIVO_POR_LOGICO;

/** Contorno duplo noturno (`docs/rollout-cenarios-pixar.md` §9): raio em PIXELS NATIVOS (1 e 2 px lógicos). */
const RAIO_CONTORNO_ESCURO = PX_NATIVO_POR_LOGICO;
const RAIO_ARO_CLARO = PX_NATIVO_POR_LOGICO * 2;

const COR_CONTORNO_ESCURO_NOITE = '#0B1630';
const COR_ARO_LUA = '#E8F1FF';
const COR_CONTORNO_CLARO_BONECO = '#F4F8FF';
const COR_FIO_SUPERFICIE = '#F4F8FF';
const COR_BORDA_TERRENO = '#4E5F98';
const COR_SASTRUGI = '#BFD0EE';
const COR_ESTILHACO_LUZ = '#B7C7EC';
const COR_ESTILHACO_SOMBRA = '#8FA3D8';
const COR_CABO_ACO = '#B8C4DA';
const COR_FIO_CLARO_CABO = '#F7FBFF';

/** Lua fria: posição (14%, 11%), raio 18, halo raio 70 (`docs/rollout-cenarios-pixar.md` §8/§9, igual a `cume.ts`). */
const LUA_X_FRAC = 0.14;
const LUA_Y_FRAC = 0.11;
const LUA_ALTURA_PX = 36; // raio 18 lógico * 2
const HALO_RAIO = 70;

/** Limiares da detecção de feição por inclinação (`docs/temas-pistas-m3.md` §0.4), mesmos dos demais raster. */
const LIMIAR_SUBIDA_GRAUS = 8;
const LIMIAR_QUEDA_GRAUS = -28;

type ImagemObjeto = HTMLCanvasElement | HTMLImageElement;

interface AssetsCumeRaster {
  readonly fundo: HTMLImageElement;
  readonly medias: HTMLImageElement;
  readonly silhuetas: HTMLImageElement;
  readonly manta: HTMLImageElement;
  readonly texCorpo: HTMLImageElement;
  readonly texCornija: HTMLImageElement;
  readonly texFenda: HTMLImageElement;
  readonly sombra: HTMLCanvasElement;
  readonly obj: {
    readonly rochaGelo: ImagemObjeto;
    readonly blocoGelo: ImagemObjeto;
    readonly lajeCornija: ImagemObjeto;
    readonly pinheiroTorto: ImagemObjeto;
    readonly bonecoCachecol: ImagemObjeto;
    readonly cristalFloco: ImagemObjeto;
    readonly corda: ImagemObjeto;
    readonly posteCorda: ImagemObjeto;
    readonly torreTrelica: ImagemObjeto;
    readonly biruta: ImagemObjeto;
    readonly lua: ImagemObjeto;
    readonly placaVento: ImagemObjeto;
  };
}

let cache: AssetsCumeRaster | null = null;
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

/** Contorno DUPLO noturno (`docs/rollout-cenarios-pixar.md` §9): aro de lua (cima/esquerda, única luz fria desta
 * pista) -> escuro nas 8 direções a 1 px lógico (por cima, cobre o miolo do aro) -> sprite original. Zero custo
 * por quadro -- roda uma vez aqui, no carregamento. Mesma função de `vila-raster.ts: cozinharContornoDuplo`. */
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

/** Hash puro (regra 0.1-4): decoração determinística por índice, mesma fórmula de `cume.ts`. */
function hashDeterministico(n: number): number {
  let h = (n ^ 0x5bd1e995) >>> 0;
  h = Math.imul(h, 2654435761) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

/** Carrega/decodifica os assets raster do Cume. Fire-and-forget pela tela de seleção de pista; o pintor cai no
 * `cume.ts` vetorial enquanto isso não resolver (ou se qualquer imagem falhar). `tex-neve.webp` NÃO entra: mesmo
 * caso dos demais cenários raster -- sobra do template de geração da folha de texturas. */
export function precarregarAssetsCumeRaster(doc?: Document): Promise<boolean> {
  if (promessaCarregamento) return promessaCarregamento;
  const documento = doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!documento) return Promise.resolve(false);

  promessaCarregamento = (async () => {
    try {
      const nomes = [
        'fundo', 'medias', 'silhuetas', 'manta', 'tex-corpo', 'tex-cornija', 'tex-fenda',
        'obj-rocha-gelo', 'obj-bloco-gelo', 'obj-laje-cornija', 'obj-pinheiro-torto',
        'obj-boneco-cachecol', 'obj-cristal-floco', 'obj-corda', 'obj-poste-corda',
        'obj-torre-trelica', 'obj-biruta', 'obj-lua', 'obj-placa-vento',
      ] as const;
      const imgs = await Promise.all(nomes.map((n) => carregarImagem(resolverUrlAsset(`${PASTA}${n}.webp`))));
      const porNome = Object.fromEntries(nomes.map((n, i) => [n, imgs[i] as HTMLImageElement]));

      cache = {
        fundo: porNome['fundo']!,
        medias: porNome['medias']!,
        silhuetas: porNome['silhuetas']!,
        manta: porNome['manta']!,
        texCorpo: porNome['tex-corpo']!,
        texCornija: porNome['tex-cornija']!,
        texFenda: porNome['tex-fenda']!,
        sombra: cozinharSombra(documento),
        obj: {
          rochaGelo: cozinharContornoDuplo(documento, porNome['obj-rocha-gelo']!, COR_ARO_LUA, COR_CONTORNO_ESCURO_NOITE),
          blocoGelo: cozinharContornoDuplo(documento, porNome['obj-bloco-gelo']!, COR_ARO_LUA, COR_CONTORNO_ESCURO_NOITE),
          lajeCornija: cozinharContornoDuplo(documento, porNome['obj-laje-cornija']!, COR_ARO_LUA, COR_CONTORNO_ESCURO_NOITE),
          pinheiroTorto: cozinharContornoDuplo(documento, porNome['obj-pinheiro-torto']!, COR_ARO_LUA, COR_CONTORNO_ESCURO_NOITE),
          bonecoCachecol: cozinharContornoSimples(documento, porNome['obj-boneco-cachecol']!, COR_CONTORNO_CLARO_BONECO),
          cristalFloco: porNome['obj-cristal-floco']!, // coletável: sem contorno (mesmo nível de sempre)
          corda: porNome['obj-corda']!, // trilho ladrilhado: contorno por código, não pré-assado
          posteCorda: porNome['obj-poste-corda']!,
          torreTrelica: porNome['obj-torre-trelica']!,
          biruta: porNome['obj-biruta']!, // adereço da SUBIDA + bandeira: sem contorno (§9)
          lua: porNome['obj-lua']!,
          placaVento: porNome['obj-placa-vento']!, // decor sem física: sem contorno (§9)
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

/** Só para teste/limpeza entre cenários de e2e: força esquecer o cache carregado. */
export function _esquecerAssetsCumeRasterParaTeste(): void {
  cache = null;
  promessaCarregamento = null;
}

/** Só para medição (mesmo papel de `_dimensoesCacheVilaParaTeste` em `vila-raster.ts`). */
export function _dimensoesCacheCumeParaTeste(): readonly { readonly nome: string; readonly w: number; readonly h: number }[] | null {
  if (!cache) return null;
  const a = cache;
  const tamanho = (nome: string, img: ImagemObjeto): { nome: string; w: number; h: number } => ({ nome, w: img.width, h: img.height });
  return [
    tamanho('fundo', a.fundo),
    tamanho('medias', a.medias),
    tamanho('silhuetas', a.silhuetas),
    tamanho('manta', a.manta),
    tamanho('texCorpo', a.texCorpo),
    tamanho('texCornija', a.texCornija),
    tamanho('texFenda', a.texFenda),
    tamanho('sombra', a.sombra),
    tamanho('obj.rochaGelo', a.obj.rochaGelo),
    tamanho('obj.blocoGelo', a.obj.blocoGelo),
    tamanho('obj.lajeCornija', a.obj.lajeCornija),
    tamanho('obj.pinheiroTorto', a.obj.pinheiroTorto),
    tamanho('obj.bonecoCachecol', a.obj.bonecoCachecol),
    tamanho('obj.cristalFloco', a.obj.cristalFloco),
    tamanho('obj.corda', a.obj.corda),
    tamanho('obj.posteCorda', a.obj.posteCorda),
    tamanho('obj.torreTrelica', a.obj.torreTrelica),
    tamanho('obj.biruta', a.obj.biruta),
    tamanho('obj.lua', a.obj.lua),
    tamanho('obj.placaVento', a.obj.placaVento),
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

function construirCamadasCumeRaster(doc: Document | undefined): Parallax {
  if (!cache) return pintorCume.construirCamadas(doc, LARGURA, ALTURA, TEMA_CUME);

  return {
    desenhar(ctx, cameraXm, tempoTicks) {
      const a = cache;
      if (!a) return;

      // 1. fundo (céu com aurora + serra abaixo + mar de nuvens, já embutidos na arte -- §7: a ficha tem 4 camadas
      // de fundo, o método tem 3 imagens; juntar o mar de nuvens ao céu custa 0,02 de parallax que ninguém vê),
      // fator 0,04, opaco
      desenharTileHorizontal(ctx, a.fundo, LARGURA, ALTURA, 0.04, cameraXm);

      // 1b. FIXO (sem parallax, §9): lua + halo radial, sempre na mesma posição de tela.
      const luaX = LARGURA * LUA_X_FRAC;
      const luaY = ALTURA * LUA_Y_FRAC;
      const halo = ctx.createRadialGradient(luaX, luaY, 12, luaX, luaY, HALO_RAIO);
      halo.addColorStop(0, 'rgba(232, 241, 255, 0.15)');
      halo.addColorStop(1, 'rgba(232, 241, 255, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, LARGURA, ALTURA);

      const luaLargura = LUA_ALTURA_PX * (a.obj.lua.width / a.obj.lua.height);
      ctx.drawImage(a.obj.lua, luaX - luaLargura / 2, luaY - LUA_ALTURA_PX / 2, luaLargura, LUA_ALTURA_PX);

      // 2. montanhas médias (cornijas penduradas já embutidas na arte), fator 0,10, com alfa
      desenharTileHorizontal(ctx, a.medias, LARGURA, ALTURA, 0.1, cameraXm);

      // 3. silhuetas (teleférico parado, refúgio, pinheiros tortos, biruta, gag do boneco já embutidos na arte),
      // fator 0,22, tile 21:9, com alfa
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

/** Pórtico de gelo (`portico`, §7.8): não coube célula na folha de objetos -- montado por código com os sprites
 * que já existem, 2 x `obj-bloco-gelo` (pilares) + `obj-laje-cornija` (verga) por cima. */
function desenharPorticoGelo(ctx: CanvasRenderingContext2D, a: AssetsCumeRaster, xTela: number, yTela: number, larguraPx: number, alturaPx: number): void {
  const alturaPilar = alturaPx * 0.82;
  const larguraPilar = Math.max(6, larguraPx * 0.22);
  const xEsq = xTela - larguraPx / 2 + larguraPilar / 2;
  const xDir = xTela + larguraPx / 2 - larguraPilar / 2;
  const razaoPilar = a.obj.blocoGelo.width / a.obj.blocoGelo.height;
  ctx.drawImage(a.obj.blocoGelo, xEsq - (alturaPilar * razaoPilar) / 2, yTela - alturaPilar, alturaPilar * razaoPilar, alturaPilar);
  ctx.drawImage(a.obj.blocoGelo, xDir - (alturaPilar * razaoPilar) / 2, yTela - alturaPilar, alturaPilar * razaoPilar, alturaPilar);

  const vergaH = Math.max(6, alturaPx * 0.22);
  ctx.drawImage(a.obj.lajeCornija, xTela - larguraPx / 2, yTela - alturaPilar - vergaH * 0.8, larguraPx, vergaH);
}

function desenharObjetoCumeRaster(ctx: CanvasRenderingContext2D, obj: ObjetoPista, xTela: number, yTela: number, escala: number): void {
  if (!cache) {
    pintorCume.desenharObjeto(ctx, obj, xTela, yTela, escala);
    return;
  }
  const a = cache;
  const larguraPx = Math.max(8, obj.largura * escala);
  const alturaPx = Math.max(8, obj.altura * escala);

  // `bandeira` sem física: `obj-biruta` (§7.8, R3C2, mesmo sprite da SUBIDA) -- mesma técnica de dupla função de
  // sprite da Vila/Vulcão.
  if (obj.tipo === 'bandeira') {
    desenharSpriteObjeto(ctx, a.obj.biruta, xTela, yTela, alturaPx);
    return;
  }
  // `portico` montado por código (não coube célula na folha): ver `desenharPorticoGelo`.
  if (obj.tipo === 'portico') {
    desenharPorticoGelo(ctx, a, xTela, yTela, larguraPx, alturaPx);
    return;
  }

  const spritePorTipo: Partial<Record<TipoObjeto, ImagemObjeto>> = {
    pedra: obj.variante === 1 ? a.obj.blocoGelo : a.obj.rochaGelo,
    tronco: a.obj.lajeCornija,
    pinheiro: a.obj.pinheiroTorto,
    'boneco-de-neve': a.obj.bonecoCachecol,
    floco: a.obj.cristalFloco,
    placa: a.obj.placaVento,
  };
  const sprite = spritePorTipo[obj.tipo];
  if (!sprite) {
    // rampa/trilho-objeto: mesmo nível do precedente vetorial (fallback genérico).
    pintorCume.desenharObjeto(ctx, obj, xTela, yTela, escala);
    return;
  }

  desenharSombraContato(ctx, a.sombra, xTela, yTela, larguraPx);
  desenharSpriteObjeto(ctx, sprite, xTela, yTela, alturaPx);
}

// --- Trilho de grind (§0.5/§4.3, L3): corda (< 1 m, ladrilhada) OU cabo de teleférico (>= 1 m, cabo por código) ---

function desenharCordaRaster(ctx: CanvasRenderingContext2D, a: AssetsCumeRaster, trilho: Trilho, pista: PistaGerada, camera: EstadoCamera): void {
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const fatorEscala = escala / PX_POR_METRO;
  const topoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm) + trilho.altura, camera, PX_POR_METRO);
  const chaoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm), camera, PX_POR_METRO);

  const pontosTopo: { x: number; y: number }[] = [];
  for (let xm = trilho.x0; xm <= trilho.x1; xm += pista.dx) pontosTopo.push(topoY(xm));
  const ultimoXm = trilho.x1;
  if (pontosTopo.length === 0 || pontosTopo[pontosTopo.length - 1]!.x !== topoY(ultimoXm).x) pontosTopo.push(topoY(ultimoXm));
  if (pontosTopo.length < 2) return;

  const espessura = Math.max(3, 5 * fatorEscala);
  const posteW = Math.max(2, 5 * fatorEscala);

  const MARGEM_TELA_PX = 100;
  const naTela = (p: { x: number }): boolean => p.x >= -MARGEM_TELA_PX && p.x <= LARGURA + MARGEM_TELA_PX;

  // Postes: `obj-poste-corda` esticado verticalmente do topo até o chão, nas pontas e a cada <= 5 m (ficha §4.3,
  // mesmo espaçamento do precedente vetorial).
  const ESPACO_POSTE_M = 5;
  for (let xm = trilho.x0; xm <= trilho.x1 + 0.001; xm += ESPACO_POSTE_M) {
    const xmClamp = Math.min(xm, trilho.x1);
    const pTopo = topoY(xmClamp);
    if (!naTela(pTopo)) continue;
    const pChao = chaoY(xmClamp);
    const alturaPe = Math.max(0, pChao.y - pTopo.y);
    if (alturaPe < 1) continue;
    ctx.drawImage(a.obj.posteCorda, pTopo.x - posteW / 2, pTopo.y, posteW, alturaPe);
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

  // Corda: `obj-corda` LADRILHADA por segmento -- "o meio repete, não estica, senão a trança deforma" (§7.8),
  // mesma técnica do varal da Vila/da ponte do Vulcão.
  const tileLarguraPx = Math.max(8, 30 * fatorEscala);
  const tileAlturaPx = espessura * 1.8;
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
        a.obj.corda,
        0, 0, a.obj.corda.width * fracaoFonte, a.obj.corda.height,
        avanco, -tileAlturaPx / 2, larguraDesenho, tileAlturaPx
      );
      avanco += tileLarguraPx;
    }
    ctx.restore();
  }

  // Fio claro no topo (contraste, mesma regra dos demais trilhos), por código, por cima do sprite ladrilhado
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.moveTo(pontosTopo[0]!.x, pontosTopo[0]!.y);
  for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, pontosTopo[i]!.y);
  ctx.strokeStyle = COR_FIO_CLARO_CABO;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

/** Cabo de teleférico (altura >= 1 m): torres (`obj-torre-trelica`) nas duas pontas + cabo de aço POR CÓDIGO (3 px
 * `#B8C4DA` + fio claro `#F7FBFF`, ficha §4.3/§7.8) -- "sem postes no meio, o vazio embaixo é a graça", mesma
 * geometria de `cume.ts: desenharCaboTeleferico`. */
function desenharCaboRaster(ctx: CanvasRenderingContext2D, a: AssetsCumeRaster, trilho: Trilho, pista: PistaGerada, camera: EstadoCamera): void {
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const fatorEscala = escala / PX_POR_METRO;
  const topoY = (xm: number) => mundoParaTela(xm, alturaDoTerreno(pista, xm) + trilho.altura, camera, PX_POR_METRO);

  const p0 = topoY(trilho.x0);
  const p1 = topoY(trilho.x1);
  if (p0.x === p1.x && p0.y === p1.y) return;

  const alturaTorre = Math.max(20, 36 * fatorEscala);
  const razaoTorre = a.obj.torreTrelica.width / a.obj.torreTrelica.height;
  ctx.drawImage(a.obj.torreTrelica, p0.x - (alturaTorre * razaoTorre) / 2, p0.y, alturaTorre * razaoTorre, alturaTorre);
  ctx.drawImage(a.obj.torreTrelica, p1.x - (alturaTorre * razaoTorre) / 2, p1.y, alturaTorre * razaoTorre, alturaTorre);

  const meioX = (p0.x + p1.x) / 2;
  const flecha = Math.max(4, 8 * fatorEscala);
  const meioY = (p0.y + p1.y) / 2 + flecha;

  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, 3 * fatorEscala);
  ctx.strokeStyle = COR_CABO_ACO;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.quadraticCurveTo(meioX, meioY, p1.x, p1.y);
  ctx.stroke();

  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = COR_FIO_CLARO_CABO;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y - 1.5);
  ctx.quadraticCurveTo(meioX, meioY - 1.5, p1.x, p1.y - 1.5);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function desenharTrilhoCumeRaster(ctx: CanvasRenderingContext2D, trilho: Trilho, pista: PistaGerada, camera: EstadoCamera): void {
  if (!cache) {
    pintorCume.desenharTrilho(ctx, trilho, pista, camera);
    return;
  }
  // Altura < 1 m => pele "corda"; altura >= 1 m => pele "cabo de teleférico" (ficha §4.3), mesma regra do vetorial.
  if (trilho.altura < 1) desenharCordaRaster(ctx, cache, trilho, pista, camera);
  else desenharCaboRaster(ctx, cache, trilho, pista, camera);
}

// --- Terreno: corpo (tex-corpo, com SUBIDA=tex-cornija/QUEDA=tex-fenda) + manta cisalhada + código ---

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

/** Estilhaço de gelo no corpo: mesma técnica de `cume.ts: desenharEstilhacoGelo` -- não dá pra assar numa textura
 * repetível sem o padrão ficar óbvio. */
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

function desenharTerrenoCumeRaster(
  ctx: CanvasRenderingContext2D,
  pista: PistaGerada,
  camera: EstadoCamera,
  superficie: readonly { x: number; y: number }[],
  espessuraMantaPx: number
): void {
  if (!cache) {
    pintorCume.desenharTerreno?.(ctx, pista, camera, superficie, espessuraMantaPx);
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

  // 1-bis. SUBIDA=tex-cornija / QUEDA=tex-fenda, feição por inclinação (mesma técnica da Vila/Vulcão/Morro). Ao
  // fechar uma faixa de SUBIDA, planta 1 `obj-biruta` na crista.
  const xmDoPonto = (p: { x: number }): number => camera.x + (p.x - LARGURA / 2 - camera.tremidaX) / escala;
  const classeDoPonto = (i: number): 'subida' | 'queda' | 'corpo' => classificarSegmento(pista, xmDoPonto(superficie[i]!));
  let inicioFaixa = 0;
  let classeFaixa = classeDoPonto(0);
  const fecharFaixa = (fimIdx: number): void => {
    if (classeFaixa === 'corpo' || fimIdx <= inicioFaixa) return;
    const img = classeFaixa === 'subida' ? a.texCornija : a.texFenda;
    const pattern = criarPatternAncorado(ctx, img, camera, escala);
    if (pattern) preencherFaixa(ctx, superficie, inicioFaixa, fimIdx, pattern, FUNDO_PX);
    if (classeFaixa === 'subida') {
      const pCrista = superficie[fimIdx]!;
      desenharSpriteObjeto(ctx, a.obj.biruta, pCrista.x, pCrista.y, Math.max(14, 26 * fatorEscala));
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

  // 2. Manta (neve de vento + gelo cisalhadas já embutidas na arte, ficha §7.6): faixa `manta.webp` cisalhada por
  // segmento, seguindo a superfície -- igual aos demais raster.
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

  const fator = espessuraMantaPx / ESPESSURA_MANTA_NEVE_PX;

  // 3. Estilhaços de gelo no corpo, por código (não dá pra assar sem o padrão ficar óbvio): a cada 7 m, hash
  // decide, teto 10 por quadro -- mesma regra do precedente vetorial (`cume.ts` §4.2.6).
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

  // 4. Sastrugi na manta: 1 traço curto inclinado a cada 2 m (a neve esculpida pelo vento), mesma regra vetorial.
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

  // 6. Fio claro da superfície (acabamento, caminho ISOLADO sem as arestas estendidas)
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = COR_FIO_SUPERFICIE;
  ctx.stroke();
}

export const pintorCumeRaster: PintorTema = {
  construirCamadas: (doc) => construirCamadasCumeRaster(doc),
  desenharObjeto: desenharObjetoCumeRaster,
  desenharTrilho: desenharTrilhoCumeRaster,
  desenharTerreno: desenharTerrenoCumeRaster,
};
