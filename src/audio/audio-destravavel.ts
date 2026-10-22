/**
 * `AudioDestravavel` mínimo do Neve Maluca (M0): só o que o destrave do iPhone precisa — `ctx`, `init`, `resume`. Sem sons ainda
 * (vento, pulo, pouso, tombo e vozes entram no M1/M2 por cima desta classe).
 *
 * Origem: adaptado do `AudioSys` do InnoFighters (src/audio/audio-sys.ts: `contextoDoNavegador`, `init`, `resume`) e do contrato
 * `AudioDestravavel` de src/platform/audio-desbloqueio.ts (cópia já em `src/platform/audio-desbloqueio.ts` deste projeto), em 2026-10-22.
 * Mudanças em relação à origem: (1) sem grafo de ganho, ruído nem RNG (nada soa ainda); (2) o `resume()` engole a rejeição da promessa
 * (o `main.ts` mostra `unhandledrejection` na caixa de erro, e um `resume()` recusado fora de gesto não é erro do jogo).
 *
 * Por que o `AudioContext` só nasce no gesto (`init`): o iOS/WebKit cria o contexto `suspended` e só o liga se `resume()` vier dentro de
 * `touchend`/`click`/`pointerup`/`mouseup`/tecla. Criar antes não ajuda e gasta o contexto à toa. Quem chama `init`/`resume` é o
 * `desbloquearAudio(window, audio)` da `platform/` (ligado no `main.ts`); esta camada não toca no DOM.
 *
 * Regras da camada (varredura em tests/unit/arquitetura.test.ts): sem `Math.random`, `Date`, `performance`, timers.
 */

/** O mínimo de um `AudioContext` que usamos; permite testar em Node com um objeto falso. */
export interface ContextoDeAudio {
  readonly state: string;
  resume(): Promise<void>;
}

export type FabricaDeContexto = () => ContextoDeAudio | null;

/** Cria o contexto do navegador (`AudioContext`, ou `webkitAudioContext` no Safari antigo). `null` = o aparelho não tem Web Audio. */
export function contextoDoNavegador(): ContextoDeAudio | null {
  const w = globalThis as unknown as { AudioContext?: new () => ContextoDeAudio; webkitAudioContext?: new () => ContextoDeAudio };
  const Construtor = w.AudioContext ?? w.webkitAudioContext;
  return Construtor ? new Construtor() : null;
}

export class AudioDestravavel {
  /** `null` até o primeiro gesto (`init`), e também quando o aparelho não tem Web Audio. */
  ctx: ContextoDeAudio | null = null;

  constructor(private readonly criarContexto: FabricaDeContexto = contextoDoNavegador) {}

  /** Chamar DEPOIS de um gesto do usuário (política de autoplay). Idempotente: o contexto é criado uma vez só. */
  init(): void {
    if (this.ctx) return;
    this.ctx = this.criarContexto();
  }

  /**
   * Religa o contexto suspenso. `interrupted` é o estado do iOS depois de uma ligação ou de voltar do segundo plano (não está no
   * tipo do DOM). Contexto `running` ou `closed` não é tocado.
   */
  resume(): void {
    const c = this.ctx;
    if (!c) return;
    if (c.state === 'suspended' || c.state === 'interrupted') c.resume().catch(() => {});
  }
}
