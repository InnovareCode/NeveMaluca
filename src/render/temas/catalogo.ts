/**
 * Mapa `IdTema -> PintorTema` (M3 F3/F4): o único lugar que decide QUAL pele desenhar uma pista, pelo
 * `DefPista.tema` (`data/pistas.ts`). Tema desconhecido cai no Morro — mesma filosofia de "nunca é motivo para
 * travar o jogo" já usada para id de pista desconhecido (`ui/cenas/descida.ts`).
 */
import type { DefTema, IdTema } from '../../core/contratos';
import { TEMA_CUME, TEMA_PARQUE, TEMA_VILA, TEMA_VULCAO } from '../../data/temas';
import { pintorBosqueRaster } from './bosque-raster';
import { TEMA_BOSQUE } from './bosque';
// Importado (não só re-exportado) daqui: quem dispara o pré-carregamento (`selecao-pista.ts`, `descida.ts`/
// `corrida.ts` desde o polimento "Pixar no gameplay") e quem decide o pintor (`pintorDoTema` abaixo) devem
// enxergar o MESMO cache de módulo. Um `import()` dinâmico por um caminho diferente (ex. absoluto
// `/src/render/temas/parque-raster.ts` direto, em vez de relativo por aqui) faz o Vite dev server instanciar o
// módulo DUAS vezes com caches `cache`/`promessaCarregamento` separados -- medido num script de prova à parte;
// nunca acontece em produção (todos os pontos reais importam por caminho relativo).
import {
  _dimensoesCacheParaTeste,
  _esquecerAssetsParqueRasterParaTeste,
  assetsParqueRasterProntos,
  pintorParqueRaster,
  precarregarAssetsParqueRaster,
} from './parque-raster';
import {
  _dimensoesCacheBosqueParaTeste,
  _esquecerAssetsBosqueRasterParaTeste,
  assetsBosqueRasterProntos,
  precarregarAssetsBosqueRaster,
} from './bosque-raster';
import {
  _dimensoesCacheVilaParaTeste,
  _esquecerAssetsVilaRasterParaTeste,
  assetsVilaRasterProntos,
  pintorVilaRaster,
  precarregarAssetsVilaRaster,
} from './vila-raster';
import {
  _dimensoesCacheVulcaoParaTeste,
  _esquecerAssetsVulcaoRasterParaTeste,
  assetsVulcaoRasterProntos,
  pintorVulcaoRaster,
  precarregarAssetsVulcaoRaster,
} from './vulcao-raster';
import {
  _dimensoesCacheCumeParaTeste,
  _esquecerAssetsCumeRasterParaTeste,
  assetsCumeRasterProntos,
  pintorCumeRaster,
  precarregarAssetsCumeRaster,
} from './cume-raster';
import type { PintorTema } from './tipos';

export {
  precarregarAssetsParqueRaster,
  _esquecerAssetsParqueRasterParaTeste,
  _dimensoesCacheParaTeste,
  precarregarAssetsBosqueRaster,
  _esquecerAssetsBosqueRasterParaTeste,
  _dimensoesCacheBosqueParaTeste,
  precarregarAssetsVilaRaster,
  _esquecerAssetsVilaRasterParaTeste,
  _dimensoesCacheVilaParaTeste,
  precarregarAssetsVulcaoRaster,
  _esquecerAssetsVulcaoRasterParaTeste,
  _dimensoesCacheVulcaoParaTeste,
  precarregarAssetsCumeRaster,
  _esquecerAssetsCumeRasterParaTeste,
  _dimensoesCacheCumeParaTeste,
};

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

const PRECARREGAR_POR_TEMA: Readonly<Record<string, (doc?: Document) => Promise<boolean>>> = {
  bosque: precarregarAssetsBosqueRaster,
  parque: precarregarAssetsParqueRaster,
  vila: precarregarAssetsVilaRaster,
  vulcao: precarregarAssetsVulcaoRaster,
  cume: precarregarAssetsCumeRaster,
};

const RASTER_PRONTO_POR_TEMA: Readonly<Record<string, () => boolean>> = {
  bosque: assetsBosqueRasterProntos,
  parque: assetsParqueRasterProntos,
  vila: assetsVilaRasterProntos,
  vulcao: assetsVulcaoRasterProntos,
  cume: assetsCumeRasterProntos,
};

/**
 * Dispara (fire-and-forget) o preload do tema de UMA pista -- mesmo papel dos 5 `void precarregarAssetsXRaster(...)`
 * de `ui/cenas/selecao-pista.ts`, só que de UM tema por vez. Existe porque TREINO/CAMPEONATO direto do menu
 * pulam a tela de seleção de pista e, até o polimento "Pixar no gameplay", nunca chamavam preload nenhum --
 * `ui/cenas/descida.ts`/`corrida.ts` chamam isto para a pista ATIVA ao montar. Tema desconhecido cai no preload
 * do Morro, mesma filosofia de `pintorDoTema`.
 */
export function precarregarAssetsDoTema(idTema: IdTema, doc?: Document): Promise<boolean> {
  const fn = PRECARREGAR_POR_TEMA[idTema] ?? precarregarAssetsBosqueRaster;
  return fn(doc);
}

/**
 * Síncrono, sem esperar a promessa: o raster deste tema já está decodificado AGORA? Usado só pela legenda
 * "carregando cenário..." que a contagem regressiva mostra enquanto isto for falso (`render/hud.ts:
 * desenharLegendaCarregandoCenario`) -- nunca pela lógica de tick, que não trava por isto (a contagem sempre
 * conta os mesmos ticks de sempre; ver comentário em `ui/cenas/descida.ts`).
 */
export function rasterProntoParaTema(idTema: IdTema): boolean {
  const fn = RASTER_PRONTO_POR_TEMA[idTema] ?? assetsBosqueRasterProntos;
  return fn();
}
