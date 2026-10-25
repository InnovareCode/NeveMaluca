/**
 * Renderizador de Objetos da Pista (Fase 3, plano §2.2), parametrizado por `PintorTema` (plano M3 §B.3/§B.6): o
 * desenho de cada `ObjetoPista` saiu para `render/temas/bosque.ts` (Morro) SEM MUDAR PIXEL (prova por comparação de
 * pixels, `tests/e2e/_tmp-pixel-check.spec.ts`). `desenharObjetos(ctx, pista, camera)` sem pintor continua
 * desenhando com a pele do bosque — é o default, para não quebrar quem já chama assim.
 */
import { PX_POR_METRO } from '../core/constantes';
import type { PistaGerada, TipoObjeto } from '../core/contratos';
import { mundoParaTela, pxPorMetro, type EstadoCamera } from './mundo';
import { alturaDoTerreno } from './terreno';
import { pintorBosque } from './temas/bosque';
import type { PintorTema } from './temas/tipos';

/** Cor de alerta ÚNICA para todo perigo do jogo (mesma de `render/camada.ts: COR_AVISO`, o "!" de obstáculo e o
 *  feedback ruim do HUD) -- um vocabulário visual só de "cuidado", igual nos 5 temas, nunca uma cor nova por
 *  cenário (pedido do dono, iPhone, 2026-10-24: "obstáculos quase imperceptíveis"). */
export const COR_PERIGO = '#ff6b6b';

/** Tipos de `ObjetoPista` que tombam o piloto sem chance de agachar -- cópia COSMÉTICA de
 *  `pista/catalogo.ts: TIPOS_OBSTACULO_DURO` (`render/` não pode importar `pista/`, memória
 *  `render-nao-pode-importar-pista`). Hoje toda instância destes tipos É SEMPRE dura no catálogo real; se um dia
 *  existir pedra/tronco/pinheiro puramente decorativo (sem colisão), este duplicado precisa acompanhar. */
const TIPOS_PERIGO_DURO: ReadonlySet<TipoObjeto> = new Set(['pedra', 'tronco', 'pinheiro']);

/** Cor "quente" do contorno do halo (laranja vivo) -- distinta de `COR_PERIGO` (vermelho do miolo) de propósito:
 *  o pedido do dono foi "contorno quente e brilhante", não o mesmo vermelho chapado por toda parte. */
export const COR_CONTORNO_ALERTA = '#ffb347';

/** Halo pulsante por baixo do obstáculo (plano "legibilidade de obstáculos", pedido do dono iPhone,
 *  2026-10-24: "quase imperceptíveis", reforçado em 2026-10-24: "ainda não chama atenção, halo bem mais forte,
 *  contorno quente e brilhante que pulsa EM ESCALA, não só cor"): pedra/tronco/pinheiro/galho são DECORAÇÃO e
 *  OBSTÁCULO com a MESMA pele (raster E vetor) -- sem isto o jogador não distingue um do outro a tempo. Silhueta
 *  "cresce" sem mudar a caixa de colisão real (o halo é maior que o sprite, só o sprite decide onde bate). Só
 *  `ellipse`/`fill`/`stroke` -- nunca `createRadialGradient`: os mocks mínimos de
 *  `tests/unit/render-obstaculos-fase3.test.ts` não têm esse método (mesmo espírito de
 *  `mock-ctx-teste-sem-scale-guarda-condicional`). Exportado para `render/camada.ts`/`itens.ts` reusarem no galho
 *  e na poça, mesmo vocabulário visual. */
export function desenharAlertaObstaculo(ctx: CanvasRenderingContext2D, xTela: number, yTela: number, larguraPx: number, alturaPx: number, tick: number): void {
  const pulso = 0.5 + 0.5 * Math.sin(tick * 0.1);
  const cy = yTela - alturaPx * 0.5;
  // Pulsa em ESCALA (não só alfa) -- movimento chama mais atenção que cor parada numa tela pequena, mesma lição
  // de [[medir-antes-de-afirmar-hud-pequeno-precisa-ser-grande]].
  const escalaPulso = 0.88 + 0.22 * pulso;
  ctx.save();
  ctx.globalAlpha = 0.22 + 0.16 * pulso;
  ctx.fillStyle = COR_PERIGO;
  ctx.beginPath();
  ctx.ellipse(xTela, cy, larguraPx * 1.05 * escalaPulso, alturaPx * 0.98 * escalaPulso, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.32 + 0.22 * pulso;
  ctx.beginPath();
  ctx.ellipse(xTela, cy, larguraPx * 0.74 * escalaPulso, alturaPx * 0.68 * escalaPulso, 0, 0, Math.PI * 2);
  ctx.fill();
  // Contorno quente e brilhante por cima -- a "borda de perigo" que lê de longe, não só o miolo colorido.
  ctx.globalAlpha = 0.6 + 0.35 * pulso;
  ctx.lineWidth = Math.max(2.5, 3.6 * escalaPulso);
  ctx.strokeStyle = COR_CONTORNO_ALERTA;
  ctx.beginPath();
  ctx.ellipse(xTela, cy, larguraPx * 0.84 * escalaPulso, alturaPx * 0.76 * escalaPulso, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

/** Faixa de alerta no chão de neve, ANTES do obstáculo (lado de onde o jogador vem -- `xM` menor, já que ele
 *  sempre avança em +x): listras diagonais laranja/vermelho suaves, estilo Pixar (nunca placa de trânsito
 *  chapada). Bordas suaves por FALLOFF de alfa (`Math.sin`), não por `ctx.clip()` -- os mocks mínimos de
 *  `tests/unit/render-obstaculos-fase3.test.ts` não têm esse método. Chamar ANTES de `desenharAlertaObstaculo`
 *  (fica no chão, por baixo do halo/objeto). */
export function desenharFaixaAlerta(ctx: CanvasRenderingContext2D, xTela: number, yTela: number, larguraPx: number, tick: number): void {
  const pulso = 0.5 + 0.5 * Math.sin(tick * 0.06);
  const meiaAltura = Math.max(7, larguraPx * 0.42);
  const comprimento = larguraPx * 3.2;
  const passo = meiaAltura * 1.15;
  const n = Math.max(5, Math.round(comprimento / passo));
  ctx.save();
  for (let i = 0; i < n; i += 1) {
    const t = i / (n - 1);
    const falloff = Math.sin(t * Math.PI); // 0 nas pontas, 1 no meio -- banda com bordas suaves sem `clip()`
    if (falloff < 0.06) continue;
    const bx = xTela - comprimento + i * passo;
    ctx.globalAlpha = (0.14 + 0.08 * pulso) * falloff;
    ctx.fillStyle = i % 2 === 0 ? '#ff8a3d' : COR_PERIGO;
    ctx.beginPath();
    ctx.moveTo(bx, yTela - meiaAltura);
    ctx.lineTo(bx + passo, yTela - meiaAltura);
    ctx.lineTo(bx + passo - meiaAltura * 1.3, yTela + meiaAltura);
    ctx.lineTo(bx - meiaAltura * 1.3, yTela + meiaAltura);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Desenha todos os objetos visíveis da pista com a pele do tema (`pintor`, default: bosque/Morro). `tick`
 * (default 0, compat com quem ainda chama sem ele) só alimenta o pulso do halo de perigo acima.
 */
export function desenharObjetos(ctx: CanvasRenderingContext2D, pista: PistaGerada, camera: EstadoCamera, pintor: PintorTema = pintorBosque, tick = 0): void {
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);

  for (const obj of pista.objetos) {
    // Centro da caixa de colisão real (`pista/consulta.ts`: obstáculo ocupa `[obj.x, obj.x + obj.largura]`), não
    // `obj.x` sozinho — bug do Apolo: desenhar centrado em `obj.x` deixa o desenho meia-largura à esquerda da
    // colisão de verdade.
    const centroXm = obj.x + obj.largura / 2;
    const baseM = alturaDoTerreno(pista, centroXm);
    // Ponto na tela do ponto de apoio no chão (base do objeto)
    const baseTela = mundoParaTela(centroXm, baseM, camera, PX_POR_METRO);
    if (TIPOS_PERIGO_DURO.has(obj.tipo)) {
      const larguraPx = Math.max(8, obj.largura * escala);
      desenharFaixaAlerta(ctx, baseTela.x, baseTela.y, larguraPx, tick);
      desenharAlertaObstaculo(ctx, baseTela.x, baseTela.y, larguraPx, Math.max(8, obj.altura * escala), tick);
    }
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
