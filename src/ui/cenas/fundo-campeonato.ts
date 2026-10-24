/**
 * Fundo Pixar raster compartilhado pelas 4 telas do campeonato completo (plano `docs/plano-corrida-campeonato.md`
 * §C5b/C8b: abertura, standings, oficina, final) -- "PIXAR sempre, nada de vetorial" sem gastar crédito novo de
 * Runway: reaproveita os cenários raster que a pista já tem (`render/temas/catalogo.ts`), mesma receita de
 * `ui/cenas/corrida.ts`/`descida.ts` -- cria o `Parallax` com o `PintorTema` do tema NA HORA (ele cai sozinho no
 * vetorial enquanto o raster não carregou) e dispara o preload fire-and-forget à parte. Évita repetir essa dança
 * de import em 4 arquivos diferentes (peça pequena e reutilizável, não um componente gigante).
 */
import type { IdTema } from '../../core/contratos';
import { criarParallax, type Parallax } from '../../render/parallax';
import { pintorDoTema, precarregarAssetsDoTema, temaDeRenderDoTema } from '../../render/temas/catalogo';

/** Cria o fundo e já dispara o preload do tema (sem bloquear: a 1ª tela sai no vetorial se o raster não chegou). */
export function criarFundoCampeonato(tema: IdTema, doc?: Document): Parallax {
  void precarregarAssetsDoTema(tema, doc);
  return criarParallax(doc, pintorDoTema(tema), temaDeRenderDoTema(tema));
}
