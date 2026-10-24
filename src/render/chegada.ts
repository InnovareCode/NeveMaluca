/**
 * Pórtico + faixa "CHEGADA" em `pista.chegadaX` (plano "corrida em campeonato" §C1): puramente de RENDER, NUNCA
 * em `PistaGerada.objetos` -- entrar lá mudaria o hash da pista (`core/contratos.ts`, trava de `gerador.test.ts`)
 * e invalidaria recordes/replays sem necessidade. Em vez disso, monta um `ObjetoPista` SINTÉTICO (tipo `portico`,
 * que já existe no catálogo) só para reusar `PintorTema.desenharObjeto` -- a pele de cada tema (enxaimel na Vila,
 * basalto no Vulcão, gelo no Cume, fallback genérico no Morro/Parque) sai de graça, sem arte nova.
 */
import { PX_POR_METRO } from '../core/constantes';
import type { ObjetoPista, PistaGerada } from '../core/contratos';
import { mundoParaTela, pxPorMetro, type EstadoCamera } from './mundo';
import { alturaDoTerreno } from './terreno';
import { pintorBosque } from './temas/bosque';
import type { PintorTema } from './temas/tipos';

const LARGURA_PORTICO_M = 6;
const ALTURA_PORTICO_M = 4.2;

const COR_FAIXA_CLARA = '#f4f9ff';
const COR_FAIXA_ESCURA = '#e74c3c';
const COR_CONTORNO = '#0b1a33';

/** Nunca sai deste arquivo, nunca entra em `pista.objetos`: só para reusar `pintor.desenharObjeto`. */
function objetoPorticoChegada(pista: PistaGerada): ObjetoPista {
  return { tipo: 'portico', x: pista.chegadaX - LARGURA_PORTICO_M / 2, largura: LARGURA_PORTICO_M, altura: ALTURA_PORTICO_M, variante: 0 };
}

/** Pórtico + faixa quadriculada "CHEGADA" na travessa, sempre em `pista.chegadaX` (default: pele do Morro). */
export function desenharChegada(ctx: CanvasRenderingContext2D, pista: PistaGerada, camera: EstadoCamera, pintor: PintorTema = pintorBosque): void {
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const baseM = alturaDoTerreno(pista, pista.chegadaX);
  const baseTela = mundoParaTela(pista.chegadaX, baseM, camera, PX_POR_METRO);

  pintor.desenharObjeto(ctx, objetoPorticoChegada(pista), baseTela.x, baseTela.y, escala);

  // Faixa quadriculada na travessa do pórtico: estilo consistente em qualquer tema (não depende da pele).
  const larguraFaixaPx = LARGURA_PORTICO_M * escala;
  const alturaFaixaPx = Math.max(10, ALTURA_PORTICO_M * escala * 0.18);
  const yFaixa = baseTela.y - ALTURA_PORTICO_M * escala * 0.92;
  const xFaixa = baseTela.x - larguraFaixaPx / 2;

  ctx.save();
  const quadros = 10;
  const wQuadro = larguraFaixaPx / quadros;
  for (let i = 0; i < quadros; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? COR_FAIXA_CLARA : COR_FAIXA_ESCURA;
    ctx.fillRect(xFaixa + i * wQuadro, yFaixa, wQuadro, alturaFaixaPx);
  }
  ctx.lineWidth = 2;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.strokeRect(xFaixa, yFaixa, larguraFaixaPx, alturaFaixaPx);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.font = `800 ${Math.max(12, Math.round(alturaFaixaPx * 0.72))}px "Barlow Condensed", sans-serif`;
  ctx.lineWidth = 4;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.strokeText('CHEGADA', baseTela.x, yFaixa + alturaFaixaPx / 2 + 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('CHEGADA', baseTela.x, yFaixa + alturaFaixaPx / 2 + 1);
  ctx.restore();
}
