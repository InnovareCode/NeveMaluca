/**
 * Render do Piloto (plano §3.6, M1b):
 * Desenha o sprite real do personagem ancorado pelo ponto de contato (no chão) ou pivô (no ar),
 * com rotação suave e compensação geométrica. Fallback para cápsula caso o sprite ainda não esteja em cache.
 */
import type { QuadroCarregado, SpritePersonagem } from '../assets/index';
import { PX_POR_METRO } from '../core/constantes';
import type { IdPose, PilotoLeitura } from '../core/contratos';
import { mundoParaTela, pxPorMetro, type EstadoCamera } from './mundo';

export const COR_POR_MODO: Readonly<Record<PilotoLeitura['modo'], string>> = {
  chao: '#2a7de1',
  ar: '#ff9f43',
  trilho: '#2ecc71',
  tombo: '#e74c3c',
};

const RAIO_CORPO_M = 0.35;
const COMPRIMENTO_PRANCHA_M = 1.3;

function desenharCapsulaFallback(ctx: CanvasRenderingContext2D, modo: PilotoLeitura['modo'], escala: number): void {
  ctx.strokeStyle = '#1b2733';
  ctx.lineWidth = Math.max(2, 0.08 * escala);
  ctx.beginPath();
  ctx.moveTo(-(COMPRIMENTO_PRANCHA_M / 2) * escala, 0.32 * escala);
  ctx.lineTo((COMPRIMENTO_PRANCHA_M / 2) * escala, 0.32 * escala);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, -0.08 * escala, RAIO_CORPO_M * escala * 0.8, RAIO_CORPO_M * escala * 1.25, 0, 0, Math.PI * 2);
  ctx.fillStyle = COR_POR_MODO[modo];
  ctx.fill();
  ctx.lineWidth = Math.max(1, 0.03 * escala);
  ctx.strokeStyle = '#1b2733';
  ctx.stroke();
}

export function desenharPiloto(
  ctx: CanvasRenderingContext2D,
  piloto: PilotoLeitura,
  camera: EstadoCamera,
  sprite?: SpritePersonagem | null,
  /**
   * Pose a desenhar, se diferente de `piloto.pose` (plano "corrida em campeonato" §C1): takeoff/wobble/grab são
   * ajuste de RENDER (`render/pose-visual.ts`), o motor nunca sabe disso. Sem este parâmetro, usa `piloto.pose`
   * (mesmo comportamento de sempre — quem chama sem ele não muda nada).
   */
  poseOverride?: IdPose
): void {
  const centro = mundoParaTela(piloto.x, piloto.y, camera, PX_POR_METRO);
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const anguloCanvasRad = (-piloto.angulo * Math.PI) / 180;

  ctx.save();
  ctx.translate(centro.x, centro.y);
  ctx.rotate(anguloCanvasRad);

  const pose = poseOverride ?? piloto.pose;
  const quadro: QuadroCarregado | null = sprite ? sprite.obterQuadro(pose) : null;

  if (quadro) {
    const d = quadro.dados;
    // Escala do sprite no mundo: 1.85m no canvas dá destaque visual ao personagem no mobile sem perder a amplitude
    const ALTURA_ALVO_M = 1.85;
    const escalaSprite = (ALTURA_ALVO_M * escala) / d.altura;

    // Ponto de ancoragem: no chão usa o contato exato da base da prancha; no ar usa o pivô de rotação
    // Compensação sutil de 1.5px para apoiar perfeitamente sobre o contorno de 2px da neve
    const [ancoraX, ancoraY] = piloto.modo === 'chao' && d.contato ? [d.contato[0], d.contato[1] - 1.5] : d.pivo;

    const dx = -ancoraX * escalaSprite;
    const dy = -ancoraY * escalaSprite;
    const dw = d.largura * escalaSprite;
    const dh = d.altura * escalaSprite;

    ctx.drawImage(quadro.imagem, dx, dy, dw, dh);
  } else {
    desenharCapsulaFallback(ctx, piloto.modo, escala);
  }

  ctx.restore();
}
