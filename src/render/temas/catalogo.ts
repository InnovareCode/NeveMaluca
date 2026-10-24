/**
 * Mapa `IdTema -> PintorTema` (M3 F3/F4): o único lugar que decide QUAL pele desenhar uma pista, pelo
 * `DefPista.tema` (`data/pistas.ts`). Tema desconhecido cai no Morro — mesma filosofia de "nunca é motivo para
 * travar o jogo" já usada para id de pista desconhecido (`ui/cenas/descida.ts`).
 */
import type { DefTema, IdTema } from '../../core/contratos';
import { TEMA_CUME, TEMA_PARQUE, TEMA_VILA, TEMA_VULCAO } from '../../data/temas';
import { pintorBosqueRaster } from './bosque-raster';
import { TEMA_BOSQUE } from './bosque';
import { pintorParqueRaster } from './parque-raster';
// Re-exportado daqui (mesmo módulo que `pintorDoTema` resolve): quem dispara o pré-carregamento (`selecao-pista.ts`)
// e quem decide o pintor (`descida.ts`) devem enxergar o MESMO cache de módulo. Um `import()` dinâmico por um
// caminho diferente (ex. absoluto `/src/render/temas/parque-raster.ts` direto, em vez de relativo por aqui) faz o
// Vite dev server instanciar o módulo DUAS vezes com caches `cache`/`promessaCarregamento` separados -- medido
// num script de prova à parte; nunca acontece em produção (ambos os pontos reais importam por caminho relativo).
export { precarregarAssetsParqueRaster, _esquecerAssetsParqueRasterParaTeste, _dimensoesCacheParaTeste } from './parque-raster';
export { precarregarAssetsBosqueRaster, _esquecerAssetsBosqueRasterParaTeste, _dimensoesCacheBosqueParaTeste } from './bosque-raster';
export { precarregarAssetsVilaRaster, _esquecerAssetsVilaRasterParaTeste, _dimensoesCacheVilaParaTeste } from './vila-raster';
export { precarregarAssetsVulcaoRaster, _esquecerAssetsVulcaoRasterParaTeste, _dimensoesCacheVulcaoParaTeste } from './vulcao-raster';
export { precarregarAssetsCumeRaster, _esquecerAssetsCumeRasterParaTeste, _dimensoesCacheCumeParaTeste } from './cume-raster';
import { pintorVilaRaster } from './vila-raster';
import { pintorVulcaoRaster } from './vulcao-raster';
import { pintorCumeRaster } from './cume-raster';
import type { PintorTema } from './tipos';

// `bosque`, `parque`, `vila`, `vulcao` e `cume` usam o pintor raster "Pixar" (docs/rollout-cenarios-pixar.md): cada
// um cai sozinho na versão vetorial se os assets ainda não carregaram ou falharem (ver `bosque-raster.ts`/
// `parque-raster.ts`/`vila-raster.ts`/`vulcao-raster.ts`/`cume-raster.ts`) -- por isso o mapa aponta direto pra
// eles, sem precisar de um 2º caminho aqui.
const PINTORES_POR_TEMA: Readonly<Record<string, PintorTema>> = {
  bosque: pintorBosqueRaster,
  parque: pintorParqueRaster,
  vila: pintorVilaRaster,
  vulcao: pintorVulcaoRaster,
  cume: pintorCumeRaster,
};

const DEFS_POR_TEMA: Readonly<Record<string, DefTema>> = {
  bosque: TEMA_BOSQUE,
  parque: TEMA_PARQUE,
  vila: TEMA_VILA,
  vulcao: TEMA_VULCAO,
  cume: TEMA_CUME,
};

/** `PintorTema` do tema da pista; id desconhecido cai no pintor do Morro. */
export function pintorDoTema(idTema: IdTema): PintorTema {
  return PINTORES_POR_TEMA[idTema] ?? pintorBosqueRaster;
}

/** `DefTema` (dado visual) do tema da pista; id desconhecido cai no Morro. */
export function temaDeRenderDoTema(idTema: IdTema): DefTema {
  return DEFS_POR_TEMA[idTema] ?? TEMA_BOSQUE;
}
