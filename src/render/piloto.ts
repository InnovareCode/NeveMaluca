/**
 * Render do Piloto (plano §3.6, M1b):
 * Desenha o sprite real do personagem ancorado pelo ponto de contato (no chão) ou pivô (no ar),
 * com rotação suave e compensação geométrica. Fallback para cápsula caso o sprite ainda não esteja em cache.
 */
import type { QuadroCarregado, SpritePersonagem } from '../assets/index';
import { PX_POR_METRO } from '../core/constantes';
import type { IdPose, PilotoLeitura } from '../core/contratos';
import type { PrevisaoPouso } from './camera';
import { mundoParaTela, pxPorMetro, type EstadoCamera } from './mundo';
import type { FatorEstica } from './pose-visual';

export const COR_POR_MODO: Readonly<Record<PilotoLeitura['modo'], string>> = {
  chao: '#2a7de1',
  ar: '#ff9f43',
  trilho: '#2ecc71',
  tombo: '#e74c3c',
};

const RAIO_CORPO_M = 0.35;
const COMPRIMENTO_PRANCHA_M = 1.3;
/** Escala do sprite no mundo: destaque visual ao personagem no mobile sem perder a amplitude (feedback do dono,
 *  iPhone, 2026-10-24: "o personagem ainda está pequeno na tela e não valoriza o gráfico" -- meta explícita do dono
 *  é ~1/4 da altura da tela no chão; medido no navegador (skill medir-antes-de-afirmar), em cruzeiro típico (zoom
 *  de velocidade, não parado) o valor antigo de 2,05 só dava ~13% da altura lógica (540px) -- daí o salto grande,
 *  não um ajuste fino. Era 1,85 antes desta mesma rodada de "aumenta um pouco".
 *  Depois o dono jogou com 3,9 (~28% da tela) e achou GRANDE DEMAIS: "precisam ter o tamanho proporcional ao
 *  cenário para a câmera ficar com ângulos perfeitos". 2,8 dá ~20% da tela em cruzeiro, por volta da altura do
 *  boneco de neve e da vaca do Morro — meio-termo entre os dois pedidos dele. */
export const ALTURA_ALVO_M = 2.8;
/** Pose usada só pra MEDIR a altura de referência (nunca desenhada aqui) -- toda pose escala por ESTE número, não
 *  pelo próprio `d.altura` dela (feedback do dono: "o personagem muda de tamanho ao cair/levar batida"). Cada
 *  recorte de pose tem padding de enquadramento diferente (braços abertos, giro, queda) -- escalar cada uma pelo
 *  seu próprio pixel-altura faz o CORPO aparentar tamanhos diferentes entre poses mesmo sendo o msm personagem.
 *  Usando sempre a altura de `ride0` (a pose "de pé" do rig), o corpo fica do mesmo tamanho em qualquer pose; só o
 *  enquadramento ao redor varia, que é invisível (canvas transparente). */
const POSE_REFERENCIA_ESCALA: IdPose = 'ride0';

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
  poseOverride?: IdPose,
  /** Estica-e-amassa deste quadro (`render/pose-visual.ts: escalaVisual()`); sem ele, 1:1 (comportamento de sempre). */
  estica?: FatorEstica
): void {
  const centro = mundoParaTela(piloto.x, piloto.y, camera, PX_POR_METRO);
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const anguloCanvasRad = (-piloto.angulo * Math.PI) / 180;

  ctx.save();
  // Imunidade depois de voltar de um tombo (`descida/motor.ts: respawn`): pisca a cada 4 ticks, estilo kart, pra o
  // jogador entender que está protegido. O relógio é o próprio contador do motor (determinístico, sem tempo real).
  const invulneravel = piloto.invulneravelTicks ?? 0;
  if (invulneravel > 0) {
    // Multiplica (não substitui): o fantasma do Treino já chega aqui translúcido. `typeof` protege dublês de `Ctx`
    // de teste que não guardam `globalAlpha` como número.
    const base = typeof ctx.globalAlpha === 'number' ? ctx.globalAlpha : 1;
    ctx.globalAlpha = base * (Math.floor(invulneravel / 4) % 2 === 0 ? 0.35 : 0.95);
  }
  ctx.translate(centro.x, centro.y);
  ctx.rotate(anguloCanvasRad);
  // Só chama `ctx.scale` quando há de fato estica/amassa (1:1 é no-op): evita uma chamada de canvas a mais todo
  // quadro no caminho comum, e mocks de `Ctx` de teste que não implementam `scale` continuam funcionando.
  if (estica && (estica.sx !== 1 || estica.sy !== 1)) ctx.scale(estica.sx, estica.sy);

  const pose = poseOverride ?? piloto.pose;
  const quadro: QuadroCarregado | null = sprite ? sprite.obterQuadro(pose) : null;

  if (quadro) {
    const d = quadro.dados;
    // Altura de referência: SEMPRE a de `ride0`, nunca a da pose atual (ver comentário de `POSE_REFERENCIA_ESCALA`).
    const referencia = sprite?.obterQuadro(POSE_REFERENCIA_ESCALA)?.dados ?? d;
    const escalaSprite = (ALTURA_ALVO_M * escala) / referencia.altura;

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

/**
 * Marcador discreto do ponto de pouso previsto pela câmera de salto (`render/camera.ts: previsaoPouso()`):
 * uma sombra elíptica rente ao chão, igual espírito de uma sombra projetada -- nunca um ícone/alerta chamativo
 * (pedido do dono é "ver onde vai cair", não um aviso de perigo). `previsao.visibilidade` (0..1, mesmo fator de
 * easing do enquadramento) controla a opacidade: aparece/desaparece junto com o zoom-out, nunca de repente.
 * Desenhar ANTES do piloto (mesmo padrão de `turboPouso.desenhar` em `ui/cenas/corrida.ts`): é chão, fica atrás.
 */
export function desenharMarcadorPouso(ctx: CanvasRenderingContext2D, camera: EstadoCamera, previsao: PrevisaoPouso | null): void {
  if (!previsao || previsao.visibilidade <= 0.02) return;
  const pt = mundoParaTela(previsao.x, previsao.y, camera, PX_POR_METRO);
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
  const raioX = 0.6 * escala;
  const raioY = 0.2 * escala;

  ctx.save();
  ctx.globalAlpha = previsao.visibilidade * 0.5;
  ctx.beginPath();
  ctx.ellipse(pt.x, pt.y, raioX, raioY, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0a1e32';
  ctx.fill();
  ctx.lineWidth = Math.max(1, 0.05 * escala);
  ctx.strokeStyle = 'rgba(247, 251, 255, 0.7)';
  ctx.stroke();
  ctx.restore();
}
