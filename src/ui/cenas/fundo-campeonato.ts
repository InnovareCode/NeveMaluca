/**
 * Fundo Pixar raster compartilhado pelas 4 telas do campeonato completo (plano `docs/plano-corrida-campeonato.md`
 * §C5b/C8b: abertura, standings, oficina, final) -- "PIXAR sempre, nada de vetorial" sem gastar crédito novo de
 * Runway: reaproveita os cenários raster que a pista já tem (`render/temas/catalogo.ts`), mesma receita de
 * `ui/cenas/corrida.ts`/`descida.ts` -- cria o `Parallax` com o `PintorTema` do tema NA HORA (ele cai sozinho no
 * vetorial enquanto o raster não carregou) e dispara o preload fire-and-forget à parte. Évita repetir essa dança
 * de import em 4 arquivos diferentes (peça pequena e reutilizável, não um componente gigante).
 */
import { ALTURA_BUFFER, LARGURA_BUFFER, RS } from '../../platform/constantes';
import type { IdTema } from '../../core/contratos';
import { criarParallax, type Parallax } from '../../render/parallax';
import { pintorDoTema, precarregarAssetsDoTema, rasterProntoParaTema, temaDeRenderDoTema } from '../../render/temas/catalogo';
import { construirFundoFosco } from '../kit-premium';
import type { CamadaEstatica } from '../desenho';

/** Cria o fundo e já dispara o preload do tema (sem bloquear: a 1ª tela sai no vetorial se o raster não chegou). */
export function criarFundoCampeonato(tema: IdTema, doc?: Document): Parallax {
  void precarregarAssetsDoTema(tema, doc);
  return criarParallax(doc, pintorDoTema(tema), temaDeRenderDoTema(tema));
}

// ---------------------------------------------------------------------------------------------------------------
// Fundo B (`docs/direcao-ui-premium.md` §3.2): mesmo cenário raster da pista, reduzido e borrado, com véu -- pro
// pódio/classificação/oficina/final/resultado. Cacheado por tema (módulo inteiro, nunca por instância de cena):
// o resultado é sempre o MESMO canvas borrado pra um dado tema, não importa quantas vezes o jogador visite essas
// telas numa sessão longa -- cachear por cena duplicaria o trabalho (e o canvas) a cada "de novo"/revisita.
// ---------------------------------------------------------------------------------------------------------------

const framesPorTema = new Map<IdTema, HTMLCanvasElement>();
const fundosBPorTema = new Map<IdTema, CamadaEstatica>();

function obterFrameDoTema(tema: IdTema, doc: Document): HTMLCanvasElement | null {
  const existente = framesPorTema.get(tema);
  if (existente) return existente;
  // BUG real corrigido (2026-10-24, achado pelo Atlas: pódio/oficina/final nunca mostravam Fundo B): `
  // precarregarAssetsDoTema` só era chamado DEPOIS de `rasterProntoParaTema` já dar `true` -- ou seja, nunca
  // era chamado de verdade (ninguém disparava o carregamento, então o raster nunca ficava pronto, então o
  // `if` abaixo sempre voltava `null` pra sempre). O disparo tem que ser INCONDICIONAL a cada chamada (é
  // idempotente -- `precarregarAssetsDoTema` cacheia a própria promessa) ANTES de checar se já terminou.
  void precarregarAssetsDoTema(tema, doc);
  if (!rasterProntoParaTema(tema)) return null; // ainda carregando -- tenta de novo no próximo quadro

  const parallax = criarParallax(doc, pintorDoTema(tema), temaDeRenderDoTema(tema));
  const canvas = doc.createElement('canvas');
  canvas.width = LARGURA_BUFFER;
  canvas.height = ALTURA_BUFFER;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return null;
  ctx.setTransform(RS, 0, 0, RS, 0, 0);
  parallax.desenhar(ctx, 0, 0);
  framesPorTema.set(tema, canvas);
  return canvas;
}

/** Fundo B (§3.2): o cenário raster real da pista, reduzido 1/8 e borrado, com véu 0,28-0,42 -- `null` enquanto
 *  o raster daquele tema não carregou (quem chama cai no Fundo A ou num sólido, nunca trava). */
export function obterFundoBDoTema(tema: IdTema, doc: Document | undefined): CamadaEstatica | null {
  if (!doc) return null;
  const existente = fundosBPorTema.get(tema);
  if (existente) return existente;
  const frame = obterFrameDoTema(tema, doc);
  if (!frame) return null;
  const fundo = construirFundoFosco(doc, frame, { reducao: 8, veuTopo: 0.28, veuBase: 0.42, zoom: 1.02 });
  fundosBPorTema.set(tema, fundo);
  return fundo;
}

/** Só para teste/limpeza entre cenários de e2e. */
export function _esquecerFundosBParaTeste(): void {
  framesPorTema.clear();
  fundosBPorTema.clear();
}
