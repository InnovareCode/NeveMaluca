/**
 * Som das manobras (M2, plano §3.8): um "ding" por manobra (ar/mortal/grab/trilho), a "escada" do combo (uma
 * sequência de notas subindo, uma por nível de `mult`, ver `EventoDescida` combo-fechado em `core/contratos.ts`)
 * e um som de perda no combo-perdido. 100% sintetizado (`sintese.ts`), sem arquivo de áudio (a CSP só libera
 * `self`/`blob:`, nunca haveria onde hospedar um `.mp3`).
 *
 * Puramente reativo a eventos: nunca lê `descida/` nem decide nada de jogo, só `aoEvento`/`atualizar` sobre o que
 * o motor já emitiu (mesmo padrão de `render/manobra.ts`, que faz o popup visual do mesmo evento). Quem liga isto
 * à cena (`ui/cenas/descida.ts`) é o Atlas; ver o README desta pasta para o contrato de instanciação.
 *
 * Variação sonora (leve destuning entre repetições da mesma manobra) usa `rng` do canal `audio`
 * (`rngDoCanal(semente, 'audio')`), NUNCA `Math.random` nem o RNG da lógica/replay.
 */
import type { EventoDescida, LeituraDescida } from '../core/contratos';
import type { Rng } from '../core/rng';
import type { AudioDestravavel } from './audio-destravavel';
import { criarBufferRuido, ruido, tom, type BufferDeAudio, type ContextoSintese, type NoDeAudio } from './sintese';

export interface OpcoesSomManobras {
  /**
   * Volume dos efeitos (`cfg.som` do save), 0..1. É uma FUNÇÃO (não um número) e é chamada a cada som: se o
   * jogador abrir as opções e mudar o volume no meio da corrida, o próximo som já sai no volume novo sem recriar
   * nada aqui.
   */
  readonly obterVolumeSom: () => number;
}

export interface SomManobras {
  /** Toca o som de UM evento (se for um dos que esta camada conhece; os demais são ignorados, de propósito). */
  aoEvento(evento: EventoDescida): void;
  /** Atalho: chama `aoEvento` para cada evento de `leitura.eventos` (um tick de `LeituraDescida`). */
  atualizar(leitura: Pick<LeituraDescida, 'eventos'>): void;
}

/** Escala (Sol maior) usada na "escada" do combo: nota `i` = o degrau `i+1` do multiplicador. */
const ESCADA_HZ = [392.0, 440.0, 493.9, 523.3, 587.3, 659.3, 698.5, 784.0, 880.0, 987.8] as const;

function contexto(audio: AudioDestravavel): ContextoSintese | null {
  const c = audio.ctx;
  if (!c || c.state === 'closed') return null;
  return c as unknown as ContextoSintese;
}

/** Cria o sistema de som das manobras. `rng` (canal `audio`): `rngDoCanal(pista.semente, 'audio')`. */
export function criarSomManobras(audio: AudioDestravavel, rng: Rng, opcoes: OpcoesSomManobras): SomManobras {
  let buffer: BufferDeAudio | null = null;
  let ctxDoBuffer: ContextoSintese | null = null;

  /** O buffer de ruído depende do `sampleRate` do contexto; só existe depois do 1º gesto (`AudioDestravavel.init`). */
  function bufferRuido(ctx: ContextoSintese): BufferDeAudio {
    if (!buffer || ctxDoBuffer !== ctx) {
      buffer = criarBufferRuido(ctx, rng);
      ctxDoBuffer = ctx;
    }
    return buffer;
  }

  function volume(): number {
    const v = opcoes.obterVolumeSom();
    return Number.isFinite(v) && v > 0 ? Math.min(v, 1) : 0;
  }

  /** Variação leve e determinística de tom (±3%), para repetir a mesma manobra não soar idêntico. */
  function variacao(): number {
    return 1 + rng.entre(-0.03, 0.03);
  }

  function somManobra(id: string, destino: NoDeAudio, ctx: ContextoSintese, vol: number): void {
    const v = variacao();
    switch (id) {
      case 'ar':
        tom(ctx, destino, { forma: 'sine', f0: 520 * v, f1: 900, duracao: 0.14, volume: 0.22 * vol });
        break;
      case 'mortal':
        tom(ctx, destino, { forma: 'square', f0: 300 * v, f1: 760, duracao: 0.16, volume: 0.2 * vol });
        tom(ctx, destino, { forma: 'sine', f0: 620 * v, f1: 1040, duracao: 0.12, volume: 0.12 * vol, quando: 0.03 });
        break;
      case 'grab':
        ruido(ctx, bufferRuido(ctx), destino, { tipo: 'bandpass', f0: 1500, f1: 2600, q: 1.4, duracao: 0.1, volume: 0.16 * vol });
        tom(ctx, destino, { forma: 'triangle', f0: 700 * v, duracao: 0.08, volume: 0.12 * vol });
        break;
      case 'trilho':
        ruido(ctx, bufferRuido(ctx), destino, { tipo: 'bandpass', f0: 900, f1: 1700, q: 2.2, duracao: 0.18, volume: 0.14 * vol });
        break;
      default:
        // manobra futura que esta camada ainda não conhece: um "ding" neutro em vez de ficar muda.
        tom(ctx, destino, { forma: 'sine', f0: 500 * v, duracao: 0.1, volume: 0.15 * vol });
    }
  }

  /** A "escada": um degrau (nota) por nível de `mult`, subindo, mais um acento de brilho no topo. */
  function somComboFechado(mult: number, destino: NoDeAudio, ctx: ContextoSintese, vol: number): void {
    const passos = Math.max(1, Math.min(Math.round(mult), ESCADA_HZ.length));
    for (let i = 0; i < passos; i += 1) {
      tom(ctx, destino, { forma: 'triangle', f0: ESCADA_HZ[i] as number, duracao: 0.1, volume: 0.17 * vol, quando: i * 0.05, ataque: 0.002 });
    }
    const topo = ESCADA_HZ[passos - 1] as number;
    tom(ctx, destino, { forma: 'sine', f0: topo * 1.5, duracao: 0.22, volume: 0.14 * vol, quando: passos * 0.05, ataque: 0.003 });
  }

  function somComboPerdido(destino: NoDeAudio, ctx: ContextoSintese, vol: number): void {
    tom(ctx, destino, { forma: 'sawtooth', f0: 380, f1: 130, duracao: 0.28, volume: 0.18 * vol, filtro: { tipo: 'lowpass', f: 1200 } });
    ruido(ctx, bufferRuido(ctx), destino, { tipo: 'lowpass', f0: 500, duracao: 0.12, volume: 0.12 * vol });
  }

  function aoEvento(evento: EventoDescida): void {
    const vol = volume();
    if (vol <= 0) return;
    const ctx = contexto(audio);
    if (!ctx) return;
    const destino = ctx.destination;
    if (evento.tipo === 'manobra') somManobra(evento.id, destino, ctx, vol);
    else if (evento.tipo === 'combo-fechado') somComboFechado(evento.mult, destino, ctx, vol);
    else if (evento.tipo === 'combo-perdido') somComboPerdido(destino, ctx, vol);
  }

  function atualizar(leitura: Pick<LeituraDescida, 'eventos'>): void {
    for (const evento of leitura.eventos) aoEvento(evento);
  }

  return { aoEvento, atualizar };
}
