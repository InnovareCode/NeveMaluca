/**
 * Sobreposição de pose VISUAL por cima da pose do motor (plano "corrida em campeonato" §C1): takeoff no instante
 * do pulo, wobble num pouso torto, e pose de grab por direção -- tudo de RENDER, o motor nunca sabe disso. Lê só
 * o que `descida/motor.ts` já expõe (`PilotoLeitura.grab`, `EventoDescida` de `pulo`/`pouso`), sem contrato novo.
 *
 * Por quê fora do motor: `poseDe` (`descida/motor.ts`) é determinístico e entra no replay por tabela de pose; a
 * ANIMAÇÃO de leitura (quantos quadros o takeoff/wobble/grab ficam visíveis) é gosto de câmera, não física —
 * cabe em `render/`, igual à câmera com mola e à tremida de `camera.ts`.
 */
import type { EventoDescida, Grab, IdPose, PilotoLeitura } from '../core/contratos';

const TICKS_TAKEOFF = 6; // ~100 ms a 60 Hz: pose de impulso logo ao decolar
const TICKS_WOBBLE = 10; // ~167 ms: pose de desequilíbrio num pouso torto
const TICKS_GRAB = 14; // ~230 ms: tempo de leitura de um grab (no motor é uma borda de 1 tick só)

const POSE_POR_GRAB: Readonly<Record<Grab, IdPose>> = {
  cima: 'grabUp',
  baixo: 'grabDown',
  frente: 'grabFront',
  tras: 'grabBack',
};

export interface RastreadorPoseVisual {
  /** Chamar 1x por tick do motor (mesma cadência de `atualizar()`), com a leitura mais recente. */
  atualizar(piloto: PilotoLeitura, eventos: readonly EventoDescida[]): void;
  /** Pose a desenhar NESTE quadro: a do motor (`poseMotor`), ajustada por takeoff/wobble/grab quando for o caso. */
  poseVisual(poseMotor: IdPose): IdPose;
}

/** Um rastreador por personagem desenhado (jogador hoje; fantasma/rivais do C2b usam outra instância cada). */
export function criarRastreadorPoseVisual(): RastreadorPoseVisual {
  let ticksTakeoff = 0;
  let ticksWobble = 0;
  let grabAtual: Grab | null = null;
  let ticksGrab = 0;

  return {
    atualizar(piloto, eventos) {
      for (const ev of eventos) {
        if (ev.tipo === 'pulo') ticksTakeoff = TICKS_TAKEOFF;
        else if (ev.tipo === 'pouso' && ev.qualidade === 'torto') ticksWobble = TICKS_WOBBLE;
      }
      if (piloto.grab !== null) {
        grabAtual = piloto.grab;
        ticksGrab = TICKS_GRAB;
      } else if (ticksGrab > 0) {
        ticksGrab -= 1;
        if (ticksGrab === 0) grabAtual = null;
      }
      if (ticksTakeoff > 0) ticksTakeoff -= 1;
      if (ticksWobble > 0) ticksWobble -= 1;
    },
    poseVisual(poseMotor) {
      if (ticksWobble > 0 && poseMotor === 'land') return 'wobble';
      if (ticksTakeoff > 0 && (poseMotor === 'air' || poseMotor === 'flip0')) return 'takeoff';
      if (grabAtual !== null && poseMotor === 'air') return POSE_POR_GRAB[grabAtual];
      return poseMotor;
    },
  };
}
