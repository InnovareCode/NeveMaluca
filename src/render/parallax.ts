/**
 * Camada genérica de parallax (céu + camadas pré-desenhadas + flocos de profundidade), parametrizada por
 * `PintorTema`/`DefTema` (plano M3 §B.3/§B.6). Até o M3, só existia o Morro do Pinhão com cores fixas aqui dentro;
 * esse desenho foi extraído para `render/temas/bosque.ts` SEM MUDAR NENHUM PIXEL (prova por comparação de pixels,
 * `tests/e2e/_tmp-pixel-check.spec.ts`). `criarParallax(doc)` sem tema continua desenhando o Morro — é o default,
 * para não quebrar quem já chama assim (cena de descida, testes de Fase 2).
 */
import { ALTURA, LARGURA } from '../core/constantes';
import type { DefTema } from '../core/contratos';
import { desenharFlocosProfundidadeFundo } from './particulas';
import { pintorBosque, TEMA_BOSQUE } from './temas/bosque';
import type { PintorTema } from './temas/tipos';

// Cores do Morro (tema `bosque`), re-exportadas para compat de import (testes de Fase 2 importam daqui).
export {
  COR_CELEIRO_DETALHE,
  COR_CELEIRO_VERMELHO,
  COR_CEU_HORIZONTE,
  COR_CEU_TOPO,
  COR_FLORESTA_BASE,
  COR_FOLHAGEM_PINHEIRO,
  COR_MONTANHA_DISTANTE_LUZ,
  COR_MONTANHA_DISTANTE_NEVE,
  COR_MONTANHA_DISTANTE_SOMBRA,
  COR_MONTANHA_MEDIA_LUZ,
  COR_MONTANHA_MEDIA_NEVE,
  COR_MONTANHA_MEDIA_SOMBRA,
  COR_NEVE_CAPUZ,
  COR_TRONCO_MADEIRA,
} from './temas/bosque';

export interface CamadaParallax {
  readonly fatorParallax: number;
  readonly tile: HTMLCanvasElement;
}

export interface Parallax {
  /** `cameraXm` = posição horizontal da câmera no mundo (metros); `tempoTicks` = ticks + alpha. */
  desenhar(ctx: CanvasRenderingContext2D, cameraXm: number, tempoTicks: number): void;
}

/**
 * `pintor`/`tema` por padrão são o Morro (compat: quem já chama `criarParallax(doc)` continua vendo exatamente o
 * mesmo cenário). Pistas novas do M3 passam o `PintorTema`/`DefTema` do tema delas.
 */
export function criarParallax(doc?: Document, pintor: PintorTema = pintorBosque, tema: DefTema = TEMA_BOSQUE): Parallax {
  const documento = doc ?? (typeof document !== 'undefined' ? document : undefined);
  const camadas = pintor.construirCamadas(documento, LARGURA, ALTURA, tema);

  return {
    desenhar(ctx, cameraXm, tempoTicks) {
      camadas.desenhar(ctx, cameraXm, tempoTicks);
      // Flocos de neve de fundo (profundidade atmosférica): genérico, não é pele de tema.
      desenharFlocosProfundidadeFundo(ctx, cameraXm, tempoTicks);
    },
  };
}
