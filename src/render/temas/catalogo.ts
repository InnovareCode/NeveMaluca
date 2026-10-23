/**
 * Mapa `IdTema -> PintorTema` (M3 F3/F4): o único lugar que decide QUAL pele desenhar uma pista, pelo
 * `DefPista.tema` (`data/pistas.ts`). Tema desconhecido cai no Morro — mesma filosofia de "nunca é motivo para
 * travar o jogo" já usada para id de pista desconhecido (`ui/cenas/descida.ts`).
 */
import type { DefTema, IdTema } from '../../core/contratos';
import { TEMA_PARQUE, TEMA_VILA, TEMA_VULCAO } from '../../data/temas';
import { pintorBosque, TEMA_BOSQUE } from './bosque';
import { pintorParque } from './parque';
import { pintorVila } from './vila';
import { pintorVulcao } from './vulcao';
import type { PintorTema } from './tipos';

const PINTORES_POR_TEMA: Readonly<Record<string, PintorTema>> = {
  bosque: pintorBosque,
  parque: pintorParque,
  vila: pintorVila,
  vulcao: pintorVulcao,
};

const DEFS_POR_TEMA: Readonly<Record<string, DefTema>> = {
  bosque: TEMA_BOSQUE,
  parque: TEMA_PARQUE,
  vila: TEMA_VILA,
  vulcao: TEMA_VULCAO,
};

/** `PintorTema` do tema da pista; id desconhecido cai no pintor do Morro. */
export function pintorDoTema(idTema: IdTema): PintorTema {
  return PINTORES_POR_TEMA[idTema] ?? pintorBosque;
}

/** `DefTema` (dado visual) do tema da pista; id desconhecido cai no Morro. */
export function temaDeRenderDoTema(idTema: IdTema): DefTema {
  return DEFS_POR_TEMA[idTema] ?? TEMA_BOSQUE;
}
