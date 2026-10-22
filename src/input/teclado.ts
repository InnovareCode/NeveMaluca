/**
 * Teclado -> `InputFrame` (C2), plano §3.7. Pulo/giro/agachar são SEGURADOS (o estado da tecla no tick); grab é
 * BORDA (só no tick em que a tecla desceu, igual ao toque). Pausa não faz parte de `InputFrame`/`ComandoDescida`:
 * é lateral, via callback (`aoPausar`), porque pausar é concerns da `ui/`, não um comando do motor.
 *
 * `alvo` é um subconjunto estrutural de `Window` (igual ao `AlvoFoco` de `platform/foco.ts`): permite testar com
 * um objeto falso em Node, sem DOM real.
 */
import type { Grab, InputFrame } from '../core/contratos';

export type AlvoTeclado = Pick<Window, 'addEventListener' | 'removeEventListener'>;

export interface OpcoesTeclado {
  readonly aoPausar?: (() => void) | undefined;
}

export interface EntradaTeclado {
  /** Um quadro por leitura; consome o `grab` pendente (borda). Chamar uma vez por tick. */
  quadro(): InputFrame;
  destruir(): void;
}

const TECLAS_PULO = new Set(['Space', 'ArrowUp']);
const TECLA_GIRO_TRAS = 'ArrowLeft';
const TECLA_GIRO_FRENTE = 'ArrowRight';
const TECLA_AGACHAR = 'ArrowDown';
const TECLAS_GRAB: Readonly<Record<string, Grab>> = { KeyZ: 'cima', KeyX: 'baixo', KeyC: 'frente', KeyV: 'tras' };
const TECLAS_PAUSA = new Set(['Escape', 'KeyP']);

const TECLAS_DO_JOGO = new Set<string>([...TECLAS_PULO, TECLA_GIRO_TRAS, TECLA_GIRO_FRENTE, TECLA_AGACHAR, ...Object.keys(TECLAS_GRAB)]);

export function criarEntradaTeclado(alvo: AlvoTeclado = window, opcoes: OpcoesTeclado = {}): EntradaTeclado {
  const pressionadas = new Set<string>();
  let grabPendente: Grab | null = null;

  const aoBaixo = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (TECLAS_PAUSA.has(e.code)) {
      opcoes.aoPausar?.();
      return;
    }
    if (!TECLAS_DO_JOGO.has(e.code)) return;
    e.preventDefault(); // Space/flechas não devem rolar a página (mesmo risco de borda do toque, plano R6)
    if (!pressionadas.has(e.code) && e.code in TECLAS_GRAB) grabPendente = TECLAS_GRAB[e.code] as Grab;
    pressionadas.add(e.code);
  };
  const aoCima = (ev: Event): void => {
    pressionadas.delete((ev as KeyboardEvent).code);
  };

  alvo.addEventListener('keydown', aoBaixo);
  alvo.addEventListener('keyup', aoCima);

  return {
    quadro(): InputFrame {
      const pular = Array.from(TECLAS_PULO).some((k) => pressionadas.has(k));
      const giro = pressionadas.has(TECLA_GIRO_FRENTE) ? 1 : pressionadas.has(TECLA_GIRO_TRAS) ? -1 : 0;
      const grab = grabPendente;
      grabPendente = null;
      return { pular, giro, grab, agachar: pressionadas.has(TECLA_AGACHAR) };
    },
    destruir() {
      alvo.removeEventListener('keydown', aoBaixo);
      alvo.removeEventListener('keyup', aoCima);
    },
  };
}
