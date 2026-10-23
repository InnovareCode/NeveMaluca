/**
 * Contrato do pintor de um tema (plano M3 §B.3/§B.6): o DESENHO fica atrás desta interface só, uma implementação
 * por tema em `render/temas/<tema>.ts`. `DefTema` (dado, `core/contratos.ts`) é o que entra; isto é o que sabe
 * desenhar esse dado. Hoje só `bosque.ts` existe (o Morro, refatorado sem mudar pixel nenhum); os 4 temas novos do
 * M3 (parque/vila/vulcao/cume, fichas em `docs/temas-pistas-m3.md`) implementam a mesma interface.
 */
import type { DefTema, ObjetoPista, PistaGerada, Trilho } from '../../core/contratos';
import type { EstadoCamera } from '../mundo';
import type { Parallax } from '../parallax';

export interface PintorTema {
  /** Pré-desenha as camadas de parallax (céu + montanhas + silhuetas) num tile offscreen, uma vez, no boot do tema. */
  construirCamadas(doc: Document | undefined, largura: number, altura: number, tema: DefTema): Parallax;
  /** Desenha um objeto da pista (`pista.objetos`) já posicionado na tela: `(xTela, yTela)` é a base/apoio no chão. */
  desenharObjeto(ctx: CanvasRenderingContext2D, objeto: ObjetoPista, xTela: number, yTela: number, escala: number): void;
  /** Desenha um segmento de grind (`pista.trilhos`), amostrando o terreno entre `trilho.x0` e `trilho.x1`. */
  desenharTrilho(ctx: CanvasRenderingContext2D, trilho: Trilho, pista: PistaGerada, camera: EstadoCamera): void;
}
