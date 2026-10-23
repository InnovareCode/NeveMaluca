/**
 * Renderizador de Objetos da Pista (Fase 3, plano §2.2), parametrizado por `PintorTema` (plano M3 §B.3/§B.6): o
 * desenho de cada `ObjetoPista` saiu para `render/temas/bosque.ts` (Morro) SEM MUDAR PIXEL (prova por comparação de
 * pixels, `tests/e2e/_tmp-pixel-check.spec.ts`). `desenharObjetos(ctx, pista, camera)` sem pintor continua
 * desenhando com a pele do bosque — é o default, para não quebrar quem já chama assim.
 */
import { PX_POR_METRO } from '../core/constantes';
import type { PistaGerada } from '../core/contratos';
import { mundoParaTela, pxPorMetro, type EstadoCamera } from './mundo';
import { alturaDoTerreno } from './terreno';
import { pintorBosque } from './temas/bosque';
import type { PintorTema } from './temas/tipos';

/**
 * Desenha todos os objetos visíveis da pista com a pele do tema (`pintor`, default: bosque/Morro).
 */
export function desenharObjetos(ctx: CanvasRenderingContext2D, pista: PistaGerada, camera: EstadoCamera, pintor: PintorTema = pintorBosque): void {
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);

  for (const obj of pista.objetos) {
    // Centro da caixa de colisão real (`pista/consulta.ts`: obstáculo ocupa `[obj.x, obj.x + obj.largura]`), não
    // `obj.x` sozinho — bug do Apolo: desenhar centrado em `obj.x` deixa o desenho meia-largura à esquerda da
    // colisão de verdade.
    const centroXm = obj.x + obj.largura / 2;
    const baseM = alturaDoTerreno(pista, centroXm);
    // Ponto na tela do ponto de apoio no chão (base do objeto)
    const baseTela = mundoParaTela(centroXm, baseM, camera, PX_POR_METRO);
    pintor.desenharObjeto(ctx, obj, baseTela.x, baseTela.y, escala);
  }
}

/**
 * Desenha os segmentos de grind (`pista.trilhos`): BUG do Apolo (docs/temas-pistas-m3.md §6) — `pista.trilhos`
 * nunca era desenhado, o piloto deslizava 0,4 m acima da neve sem nada embaixo. Chamar depois do terreno e antes
 * (ou junto) dos objetos.
 */
export function desenharTrilhos(ctx: CanvasRenderingContext2D, pista: PistaGerada, camera: EstadoCamera, pintor: PintorTema = pintorBosque): void {
  for (const trilho of pista.trilhos) {
    pintor.desenharTrilho(ctx, trilho, pista, camera);
  }
}
