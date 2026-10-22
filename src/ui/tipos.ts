import type { Ctx } from '../platform/canvas';

/**
 * Uma cena do jogo (boot, título, descida, resultado...). O laço chama `atualizar()` a cada tick de passo fixo e `desenhar()` a cada
 * quadro de tela. A cena desenha em coordenadas LÓGICAS 960x540 (`usarEspacoLogico` já aplicado por quem desenha o quadro).
 */
export interface Cena {
  readonly id: string;
  /** Um tick (1/60 s). Sem relógio de parede aqui: a cena conta ticks. */
  atualizar(): void;
  /** Um quadro; `alpha` em [0, 1) = fração do próximo tick já decorrida (para interpolar). */
  desenhar(ctx: Ctx, alpha: number): void;
  /** Liberação opcional de ouvintes de eventos da cena ao desmontar. */
  destruir?(): void;
}
