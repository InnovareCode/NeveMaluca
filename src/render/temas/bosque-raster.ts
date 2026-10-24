/**
 * Pintor RASTER "Pixar" do Morro do Pinhão (`docs/rollout-cenarios-pixar.md` §4), espelhando a técnica de
 * `parque-raster.ts` (piloto do Pico do Picolé): mesma forma/física/contrato de `bosque.ts` (vetorial) -- geometria
 * do terreno, objetos e trilhos não mudam; só a PELE troca por imagens pré-processadas
 * (`public/assets/cenarios/morro-do-pinhao/*.webp`).
 *
 * `construirCamadas` é SÍNCRONO (`PintorTema`): os assets são carregados/decodificados por
 * `precarregarAssetsBosqueRaster` (chamado por `ui/cenas/selecao-pista.ts` ao abrir a tela, fire-and-forget). Enquanto
 * o cache não estiver pronto, OU se qualquer imagem falhar, cada método cai no `pintorBosque` (vetorial) -- nunca
 * mistura metade raster/metade vetorial no mesmo método, e nunca trava o jogo.
 *
 * Diferença de escopo vs. o piloto do Picolé: o dono aprovou texturizar as feições SUBIDA/QUEDA do terreno aqui
 * (`docs/rollout-cenarios-pixar.md` linhas 145-149 -- "o pintor raster é novo, então pode ganhar rampa e queda com
 * textura"), então este pintor detecta a inclinação por segmento (mesma fórmula de `inclinacaoGrausEm`,
 * `docs/temas-pistas-m3.md` §0.4: SUBIDA >= +8°, QUEDA <= -28°) e troca a textura do CORPO nesses trechos --
 * `rampa`/`bandeira`/`portico`/`placa` (TipoObjeto) continuam no fallback genérico como no Picolé (nenhum desses
 * tipos é hoje colocado por `pista/catalogo.ts`; mapeamento pronto para quando entrarem, ver memória
 * `pintor-tema-nivel-de-pele-espelha-precedente`).
 */
import { ALTURA, LARGURA, PX_POR_METRO } from '../../core/constantes';
import type { ObjetoPista, PistaGerada, Trilho, TipoObjeto } from '../../core/contratos';
import { resolverUrlAsset } from '../../assets/index';
import { atan2 } from '../../core/trig';
import { TEMA_BOSQUE } from './bosque';
import type { EstadoCamera } from '../mundo';
import { mundoParaTela, pxPorMetro } from '../mundo';
import { alturaDoTerreno } from '../terreno';
import type { Parallax } from '../parallax';
import type { PintorTema } from './tipos';
import { pintorBosque } from './bosque';

const PASTA = 'assets/cenarios/morro-do-pinhao/';

/** 1 px lógico = 2 px nos assets exportados (mesma escala do piloto do Picolé). */
const PX_NATIVO_POR_LOGICO = 2;
const PX_NATIVO_POR_METRO = PX_POR_METRO * PX_NATIVO_POR_LOGICO;

const COR_CONTORNO_ESCURO = '#1B2733';
const COR_CONTORNO_CLARO = '#F7FBFF';
const COR_FIO_SUPERFICIE = '#E1EEF8';

/** Limiares da detecção de feição por inclinação (`docs/temas-pistas-m3.md` §0.4), aplicados por SEGMENTO visível
 * (não exige a continuidade de >=2 amostras do contrato do gerador -- aqui é só escolha de pele por quadro). */
const LIMIAR_SUBIDA_GRAUS = 8;
const LIMIAR_QUEDA_GRAUS = -28;

type ImagemObjeto = HTMLCanvasElement | HTMLImageElement;

interface AssetsBosqueRaster {
  readonly fundo: HTMLImageElement;
  readonly medias: HTMLImageElement;
  readonly silhuetas: HTMLImageElement;
  readonly manta: HTMLImageElement;
  readonly texCorpo: HTMLImageElement;
  readonly texSubida: HTMLImageElement;
  readonly texQueda: HTMLImageElement;
  readonly sombra: HTMLCanvasElement;
  readonly obj: {
    readonly pedraBaixa: ImagemObjeto;
    readonly pedraDupla: ImagemObjeto;
    readonly toraAraucaria: ImagemObjeto;
    readonly pinheiro: ImagemObjeto;
    readonly bonecoCartola: ImagemObjeto;
    readonly pinhao: ImagemObjeto;
    readonly porteira: ImagemObjeto;
    readonly placaSeta: ImagemObjeto;
    readonly bandeirinhaVermelha: ImagemObjeto;
    readonly bandeirinhaAmarela: ImagemObjeto;
    readonly mourao: ImagemObjeto;
  };
  /** Peças do trilho (fio de grind) já pequenas, recortadas de `obj-travessa` uma vez no boot -- mesma razão de
   * `AssetsParqueRaster.trilho` em `parque-raster.ts`. */
  readonly trilho: {
    readonly meio: HTMLCanvasElement;
    readonly tampaEsquerda: HTMLCanvasElement;
    readonly tampaDireita: HTMLCanvasElement;
  };
}

let cache: AssetsBosqueRaster | null = null;
let promessaCarregamento: Promise<boolean> | null = null;

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Erro ao carregar asset de cenário: ${url}`));
  });
}

/** Contorno pré-cozido (mesma técnica de `parque-raster.ts: cozinharContorno`). */
function cozinharContorno(doc: Document, img: HTMLImageElement, cor: string): HTMLCanvasElement {
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

/** Sombra de contato, tom frio (coerente com a manhã azulada do Morro -- a sombra pink do Picolé era do palete dele). */
function cozinharSombra(doc: Document): HTMLCanvasElement {
  const tela = doc.createElement('canvas');
  tela.width = 240;
  tela.height = 80;
  const ctx = tela.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador');
  const grad = ctx.createRadialGradient(120, 40, 4, 120, 40, 118);
  grad.addColorStop(0, 'rgba(127, 163, 201, 0.32)');
  grad.addColorStop(1, 'rgba(127, 163, 201, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(120, 40, 118, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  return tela;
}

/** Carrega/decodifica os assets raster do Morro do Pinhão. Fire-and-forget pela tela de seleção de pista; o pintor
 * cai no `bosque.ts` vetorial enquanto isso não resolver (ou se qualquer imagem falhar). */
export function precarregarAssetsBosqueRaster(doc?: Document): Promise<boolean> {
  if (promessaCarregamento) return promessaCarregamento;
  const documento = doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (!documento) return Promise.resolve(false);

  promessaCarregamento = (async () => {
    try {
      const nomes = [
        'fundo', 'medias', 'silhuetas', 'manta', 'tex-corpo', 'tex-subida', 'tex-queda',
        'obj-pedra-baixa', 'obj-pedra-dupla', 'obj-tora-araucaria', 'obj-pinheiro', 'obj-boneco-cartola',
        'obj-pinhao', 'obj-porteira', 'obj-placa-seta', 'obj-bandeirinha-vermelha', 'obj-bandeirinha-amarela',
        'obj-mourao', 'obj-travessa',
      ] as const;
      const imgs = await Promise.all(nomes.map((n) => carregarImagem(resolverUrlAsset(`${PASTA}${n}.webp`))));
      const porNome = Object.fromEntries(nomes.map((n, i) => [n, imgs[i] as HTMLImageElement]));

      const travessaContornada = cozinharContorno(documento, porNome['obj-travessa']!, COR_CONTORNO_ESCURO);
      const wT = travessaContornada.width;
      const hT = travessaContornada.height;
      const trilho = {
        meio: recortarEReduzir(documento, travessaContornada, wT * 0.15, 0, wT * 0.7, hT, 140, 28),
        tampaEsquerda: recortarEReduzir(documento, travessaContornada, 0, 0, wT * 0.15, hT, 28, 28),
        tampaDireita: recortarEReduzir(documento, travessaContornada, wT * 0.85, 0, wT * 0.15, hT, 28, 28),
      };

      cache = {
        fundo: porNome['fundo']!,
        medias: porNome['medias']!,
        silhuetas: porNome['silhuetas']!,
        manta: porNome['manta']!,
        texCorpo: porNome['tex-corpo']!,
        texSubida: porNome['tex-subida']!,
        texQueda: porNome['tex-queda']!,
        sombra: cozinharSombra(documento),
        obj: {
          pedraBaixa: cozinharContorno(documento, porNome['obj-pedra-baixa']!, COR_CONTORNO_ESCURO),
          pedraDupla: cozinharContorno(documento, porNome['obj-pedra-dupla']!, COR_CONTORNO_ESCURO),
          toraAraucaria: cozinharContorno(documento, porNome['obj-tora-araucaria']!, COR_CONTORNO_ESCURO),
          pinheiro: cozinharContorno(documento, porNome['obj-pinheiro']!, COR_CONTORNO_ESCURO),
          bonecoCartola: cozinharContorno(documento, porNome['obj-boneco-cartola']!, COR_CONTORNO_CLARO),
          pinhao: porNome['obj-pinhao']!, // coletável: sem contorno, igual à gota de menta do Picolé
          porteira: cozinharContorno(documento, porNome['obj-porteira']!, COR_CONTORNO_ESCURO),
          placaSeta: cozinharContorno(documento, porNome['obj-placa-seta']!, COR_CONTORNO_ESCURO),
          bandeirinhaVermelha: cozinharContorno(documento, porNome['obj-bandeirinha-vermelha']!, COR_CONTORNO_ESCURO),
          bandeirinhaAmarela: cozinharContorno(documento, porNome['obj-bandeirinha-amarela']!, COR_CONTORNO_ESCURO),
          mourao: cozinharContorno(documento, porNome['obj-mourao']!, COR_CONTORNO_ESCURO),
        },
        trilho,
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
export function _esquecerAssetsBosqueRasterParaTeste(): void {
  cache = null;
  promessaCarregamento = null;
}

/** Só para medição (mesmo papel de `_dimensoesCacheParaTeste` em `parque-raster.ts`). */
export function _dimensoesCacheBosqueParaTeste(): readonly { readonly nome: string; readonly w: number; readonly h: number }[] | null {
  if (!cache) return null;
  const a = cache;
  const tamanho = (nome: string, img: ImagemObjeto): { nome: string; w: number; h: number } => ({ nome, w: img.width, h: img.height });
  return [
    tamanho('fundo', a.fundo),
    tamanho('medias', a.medias),
    tamanho('silhuetas', a.silhuetas),
    tamanho('manta', a.manta),
    tamanho('texCorpo', a.texCorpo),
    tamanho('texSubida', a.texSubida),
    tamanho('texQueda', a.texQueda),
    tamanho('sombra', a.sombra),
    tamanho('obj.pedraBaixa', a.obj.pedraBaixa),
    tamanho('obj.pedraDupla', a.obj.pedraDupla),
    tamanho('obj.toraAraucaria', a.obj.toraAraucaria),
    tamanho('obj.pinheiro', a.obj.pinheiro),
    tamanho('obj.bonecoCartola', a.obj.bonecoCartola),
    tamanho('obj.pinhao', a.obj.pinhao),
    tamanho('obj.porteira', a.obj.porteira),
    tamanho('obj.placaSeta', a.obj.placaSeta),
    tamanho('obj.bandeirinhaVermelha', a.obj.bandeirinhaVermelha),
    tamanho('obj.bandeirinhaAmarela', a.obj.bandeirinhaAmarela),
    tamanho('obj.mourao', a.obj.mourao),
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

function construirCamadasBosqueRaster(doc: Document | undefined): Parallax {
  if (!cache) return pintorBosque.construirCamadas(doc, LARGURA, ALTURA, TEMA_BOSQUE);

  return {
    desenhar(ctx, cameraXm, tempoTicks) {
      const a = cache;
      if (!a) return;

      // 1. fundo (céu + serra distante), fator 0,04, tile 960x540 lógicos, opaco
      desenharTileHorizontal(ctx, a.fundo, LARGURA, ALTURA, 0.04, cameraXm);

      // 1b. brilho do sol de manhã, por cima do fundo -- mesmo cantinho (alto à esquerda) do vetorial §2.1/§2.2
      const brilhoSol = ctx.createRadialGradient(LARGURA * 0.18, ALTURA * 0.12, 10, LARGURA * 0.18, ALTURA * 0.12, 220);
      brilhoSol.addColorStop(0, 'rgba(255, 252, 240, 0.35)');
      brilhoSol.addColorStop(0.5, 'rgba(255, 252, 240, 0.12)');
      brilhoSol.addColorStop(1, 'rgba(255, 252, 240, 0)');
      ctx.fillStyle = brilhoSol;
      ctx.fillRect(0, 0, LARGURA, ALTURA);

      // 2. montanhas médias, fator 0,10, tile 960x540 lógicos, com alfa
      desenharTileHorizontal(ctx, a.medias, LARGURA, ALTURA, 0.1, cameraXm);

      // 3. silhuetas (araucárias, celeiro, vaca e boneco de cartola já embutidos na arte), fator 0,22, tile 1260x540
      // lógicos (21:9), com alfa -- vaca e boneco de cartola NÃO são desenhados por código: já são adereços
      // pintados dentro desta camada (ver §4.2 da ficha de rollout).
      desenharTileHorizontal(ctx, a.silhuetas, 1260, ALTURA, 0.22, cameraXm);

      void tempoTicks;
    },
  } satisfies Parallax;
}

// --- Objetos de jogo: sprite pré-contornado + sombra de contato ---

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

function desenharObjetoBosqueRaster(ctx: CanvasRenderingContext2D, obj: ObjetoPista, xTela: number, yTela: number, escala: number): void {
  if (!cache) {
    pintorBosque.desenharObjeto(ctx, obj, xTela, yTela, escala);
    return;
  }
  const a = cache;
  const alturaPx = Math.max(8, obj.altura * escala);

  // `bandeira` sem física: `obj-bandeirinha-vermelha`/`-amarela` em escala 0,8 (§4.8). `rampa`/`portico`/`placa`
  // nunca são colocados pelo gerador hoje (`pista/catalogo.ts`), mas ganham pele já pronta para quando entrarem.
  if (obj.tipo === 'bandeira') {
    const sprite = obj.variante === 1 ? a.obj.bandeirinhaAmarela : a.obj.bandeirinhaVermelha;
    desenharSpriteObjeto(ctx, sprite, xTela, yTela, alturaPx * 0.8);
    return;
  }

  const spritePorTipo: Partial<Record<TipoObjeto, ImagemObjeto>> = {
    pedra: obj.variante === 1 ? a.obj.pedraDupla : a.obj.pedraBaixa,
    tronco: a.obj.toraAraucaria,
    pinheiro: a.obj.pinheiro,
    'boneco-de-neve': a.obj.bonecoCartola,
    floco: a.obj.pinhao,
    portico: a.obj.porteira,
    placa: a.obj.placaSeta,
  };
  const sprite = spritePorTipo[obj.tipo];
  if (!sprite) {
    // rampa/trilho-objeto: mesmo nível do precedente vetorial (fallback genérico, ver memória
    // `pintor-tema-nivel-de-pele-espelha-precedente`).
    pintorBosque.desenharObjeto(ctx, obj, xTela, yTela, escala);
    return;
  }

  desenharSombraContato(ctx, a.sombra, xTela, yTela, Math.max(8, obj.largura * escala));
  desenharSpriteObjeto(ctx, sprite, xTela, yTela, alturaPx);
}

// --- Trilho de grind: travessa (fio) esticada por segmento + mourão (pés, sem girar) ---

function desenharTrilhoBosqueRaster(ctx: CanvasRenderingContext2D, trilho: Trilho, pista: PistaGerada, camera: EstadoCamera): void {
  if (!cache) {
    pintorBosque.desenharTrilho(ctx, trilho, pista, camera);
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

  const espessura = Math.max(3, 7 * (escala / PX_POR_METRO)); // mesma proporção de `bosque.ts: desenharTrilhoSegmento`
  const posteW = Math.max(2, 6 * (escala / PX_POR_METRO));

  const MARGEM_TELA_PX = 100;
  const naTela = (p: { x: number }): boolean => p.x >= -MARGEM_TELA_PX && p.x <= LARGURA + MARGEM_TELA_PX;

  // Mourões: o sprite inteiro, em pé, SEM GIRAR (§4.8 -- diferente do palito do Picolé, que girava 90°), a cada 4 m.
  const ESPACO_POSTE_M = 4;
  for (let xm = trilho.x0; xm <= trilho.x1 + 0.001; xm += ESPACO_POSTE_M) {
    const xmClamp = Math.min(xm, trilho.x1);
    const pTopo = topoY(xmClamp);
    if (!naTela(pTopo)) continue;
    const pChao = chaoY(xmClamp);
    const alturaPe = Math.max(0, pChao.y - pTopo.y);
    if (alturaPe < 1) continue;
    ctx.drawImage(a.obj.mourao, pTopo.x - posteW / 2, pTopo.y, posteW, alturaPe);
  }

  // Travessa (o fio de grind): sprite esticado por segmento, rotacionado pelo ângulo local -- mesma técnica do
  // `palito` do Picolé.
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

  // Fio claro no topo (contraste, mesma regra do Picolé), por código, por cima do sprite
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  ctx.moveTo(pontosTopo[0]!.x, pontosTopo[0]!.y);
  for (let i = 1; i < pontosTopo.length; i += 1) ctx.lineTo(pontosTopo[i]!.x, pontosTopo[i]!.y);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// --- Terreno: corpo (tex-corpo, com SUBIDA/QUEDA texturizadas) + manta cisalhada ---

/** Inclinação da tangente (graus) em `xm0`, pela diferença finita entre amostras vizinhas -- MESMA fórmula de
 * `inclinacaoGrausEm` (`pista/consulta.ts`), reimplementada aqui com `alturaDoTerreno`/`atan2` (ambos já
 * permitidos em `render/`) porque `render/` não pode importar de `pista/` (regra de camadas, `tests/unit/arquitetura.test.ts`). */
function anguloGrausEmSegmento(pista: PistaGerada, xm0: number): number {
  const h = pista.dx;
  const y0 = alturaDoTerreno(pista, xm0);
  const y1 = alturaDoTerreno(pista, xm0 + h);
  return atan2(y1 - y0, h);
}

/** Classifica um segmento do terreno pela inclinação (`docs/temas-pistas-m3.md` §0.4) -- aqui por segmento visível,
 * não exige a continuidade de 2 amostras do contrato do gerador: é só escolha de pele por quadro, não validação de pista. */
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

function desenharTerrenoBosqueRaster(
  ctx: CanvasRenderingContext2D,
  pista: PistaGerada,
  camera: EstadoCamera,
  superficie: readonly { x: number; y: number }[],
  espessuraMantaPx: number
): void {
  if (!cache) {
    pintorBosque.desenharTerreno?.(ctx, pista, camera, superficie, espessuraMantaPx);
    return;
  }
  const a = cache;
  const primeiro = superficie[0]!;
  const FUNDO_PX = 4000;
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);

  // 4a. Corpo do terreno: tex-corpo em todo o trecho visível (só fill, nunca stroke no caminho estendido -- WebKit,
  // ver memória `webkit-stroke-coordenadas-extremas`).
  const patternCorpo = criarPatternAncorado(ctx, a.texCorpo, camera, escala);
  if (patternCorpo) preencherFaixa(ctx, superficie, 0, superficie.length - 1, patternCorpo, FUNDO_PX);

  // 4a-bis. SUBIDA/QUEDA texturizadas (aprovado pelo dono): troca a textura do corpo só nos trechos cuja inclinação
  // cruza o limiar de §0.4, reconstruindo o `xm` de cada ponto da MESMA forma que a manta cisalhada abaixo (4b).
  const xmDoPonto = (p: { x: number }): number => camera.x + (p.x - LARGURA / 2 - camera.tremidaX) / escala;
  const classeDoPonto = (i: number): 'subida' | 'queda' | 'corpo' => classificarSegmento(pista, xmDoPonto(superficie[i]!));
  let inicioFaixa = 0;
  let classeFaixa = classeDoPonto(0);
  const fecharFaixa = (fimIdx: number): void => {
    if (classeFaixa === 'corpo' || fimIdx <= inicioFaixa) return;
    const img = classeFaixa === 'subida' ? a.texSubida : a.texQueda;
    const pattern = criarPatternAncorado(ctx, img, camera, escala);
    if (pattern) preencherFaixa(ctx, superficie, inicioFaixa, fimIdx, pattern, FUNDO_PX);
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

  // 4b. Manta de neve fofa: faixa `manta.webp` cisalhada por segmento, seguindo a superfície -- a zona de pouso
  // continua manta normal em toda parte (só o corpo embaixo muda nas feições, como no vetorial §4.1/§4.8).
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

  // 4e. Fio claro da superfície (acabamento, caminho ISOLADO sem as arestas estendidas)
  ctx.beginPath();
  ctx.moveTo(primeiro.x, primeiro.y);
  for (let i = 1; i < superficie.length; i += 1) ctx.lineTo(superficie[i]!.x, superficie[i]!.y);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COR_FIO_SUPERFICIE;
  ctx.stroke();
}

export const pintorBosqueRaster: PintorTema = {
  construirCamadas: (doc) => construirCamadasBosqueRaster(doc),
  desenharObjeto: desenharObjetoBosqueRaster,
  desenharTrilho: desenharTrilhoBosqueRaster,
  desenharTerreno: desenharTerrenoBosqueRaster,
};
