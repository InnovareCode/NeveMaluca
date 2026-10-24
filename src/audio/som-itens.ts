/**
 * Som dos eventos de ITEM da CORRIDA (plano itens-corrida + game feel aprovado pelo dono em 2026-10-24): caixa
 * pega (+ roleta cosmética), uso de cada item (6 timbres, um por `TipoItem`), acerto DADO (o jogador acertou um
 * rival), escudo bloqueando e desvio. Reage a `EventoCorrida` (produzido por `corrida/itens.ts`, I2) — NUNCA a
 * `EventoDescida`: acerto SOFRIDO (`'atingido'`) mora em `som-descida.ts` (ver o cabeçalho de lá, motivo).
 *
 * Filtrado por `idJogador` de propósito: `LeituraCorrida.eventosCorrida` sai do orquestrador para os 6 corredores
 * (5 IAs + jogador) a cada tick — sem o filtro, qualquer caixa/uso/acerto de QUALQUER rival tocaria som; 5 IAs
 * trocando item o tempo todo encheria a mixagem de ruído sem relação com o que o jogador está fazendo. Só o que o
 * JOGADOR faz ou sofre (pega/usa/acerta/é bloqueado/desvia) toca — mesmo filtro de `render/hud.ts
 * criarSistemaFeedbackItens` (toast só aparece quando o evento "envolve o jogador").
 *
 * A roleta (`LeituraCorrida.roleta`, janela cosmética de ~0,5s antes do item "ficar pronto" — `TICKS_ROLETA_ITEM`,
 * `corrida/itens.ts`) não tem evento de "parou de girar": o resultado já vem decidido no PRÓPRIO `'item-pego'` (a
 * UI só finge sortear por ~0,5s). Por isso o som da roleta aqui é uma textura FIXA de ~0,4s tocada junto com o
 * grab — não precisa (e não pode: `audio/` só importa `core`/`data`) sincronizar com a constante de ticks real.
 */
import type { EventoCorrida, IdPersonagem, TipoItem } from '../core/contratos';
import type { Rng } from '../core/rng';
import type { AudioDestravavel } from './audio-destravavel';
import { criarBufferRuido, ruido, tom, type BufferDeAudio, type ContextoSintese, type NoDeAudio } from './sintese';

export interface OpcoesSomItens {
  /** Volume dos efeitos (`cfg.som` do save), 0..1 — FUNÇÃO (mesmo padrão de `OpcoesSomManobras.obterVolumeSom`). */
  readonly obterVolumeSom: () => number;
}

export interface SomItens {
  /** Toca o som de UM evento, só se envolver `idJogador` (os demais são ignorados, de propósito — ver cabeçalho). */
  aoEvento(evento: EventoCorrida): void;
  /** Atalho: chama `aoEvento` para cada evento de `leitura.eventosCorrida` (um tick de `LeituraCorrida`). */
  atualizar(eventos: readonly EventoCorrida[]): void;
}

function contexto(audio: AudioDestravavel): ContextoSintese | null {
  const c = audio.ctx;
  if (!c || c.state === 'closed') return null;
  return c as unknown as ContextoSintese;
}

/** Cria o sistema de som de itens da corrida. `idJogador`: quem esta instância representa (só os eventos DELE
 *  tocam som). `rng` (canal `audio`): o MESMO compartilhado com `som-manobras.ts`/`musica-adaptativa.ts`/
 *  `som-descida.ts` (mesmo padrão do canal `visual`). */
export function criarSomItens(audio: AudioDestravavel, rng: Rng, idJogador: IdPersonagem, opcoes: OpcoesSomItens): SomItens {
  let buffer: BufferDeAudio | null = null;
  let ctxDoBuffer: ContextoSintese | null = null;

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

  function variacao(faixa = 0.03): number {
    return 1 + rng.entre(-faixa, faixa);
  }

  function somItemPego(destino: NoDeAudio, ctx: ContextoSintese, vol: number): void {
    tom(ctx, destino, { forma: 'triangle', f0: 600 * variacao(), f1: 900, duracao: 0.1, volume: 0.16 * vol });
    // roleta (ver cabeçalho): textura de "giro" em banda subindo, cosmética, não sincronizada aos ticks reais.
    ruido(ctx, bufferRuido(ctx), destino, { tipo: 'bandpass', f0: 500, f1: 2400, q: 3, duracao: 0.4, volume: 0.08 * vol, quando: 0.08 });
  }

  function somItemUsado(item: TipoItem, destino: NoDeAudio, ctx: ContextoSintese, vol: number): void {
    switch (item) {
      case 'bola': // Bola de Neve: arremesso — whoosh descendo + corpo
        ruido(ctx, bufferRuido(ctx), destino, { tipo: 'bandpass', f0: 1200, f1: 400, q: 1.2, duracao: 0.14, volume: 0.17 * vol });
        break;
      case 'poca': // Poça de Calda: esguicho grave, sem brilho (fica plantada no chão)
        ruido(ctx, bufferRuido(ctx), destino, { tipo: 'lowpass', f0: 400, f1: 180, duracao: 0.18, volume: 0.16 * vol });
        break;
      case 'nuvem': // Nuvem de Granizo: a mais rara (mira o 1º lugar) — alerta grave subindo, mais "sério"
        tom(ctx, destino, { forma: 'sawtooth', f0: 180 * variacao(), f1: 260, duracao: 0.22, volume: 0.16 * vol, filtro: { tipo: 'lowpass', f: 900 } });
        break;
      case 'turbo': // Chocolate Quente: sweep ascendente (mesma sensação do turbo de pouso)
        tom(ctx, destino, { forma: 'sawtooth', f0: 220 * variacao(), f1: 880, duracao: 0.26, volume: 0.17 * vol, filtro: { tipo: 'lowpass', f: 2200 } });
        break;
      case 'escudo': // Bolha de Gelo: "bolha" cristalina, 2 camadas
        tom(ctx, destino, { forma: 'sine', f0: 700 * variacao(), f1: 1100, duracao: 0.18, volume: 0.13 * vol });
        tom(ctx, destino, { forma: 'sine', f0: 1400, duracao: 0.14, volume: 0.08 * vol, quando: 0.05 });
        break;
      case 'ima': // Ímã de Flocos: hum pulsante grave, 2 batidas
        tom(ctx, destino, { forma: 'triangle', f0: 220 * variacao(), duracao: 0.2, volume: 0.15 * vol });
        tom(ctx, destino, { forma: 'triangle', f0: 330, duracao: 0.16, volume: 0.1 * vol, quando: 0.08 });
        break;
    }
  }

  function somAcertoDado(destino: NoDeAudio, ctx: ContextoSintese, vol: number): void {
    tom(ctx, destino, { forma: 'square', f0: 500 * variacao(), f1: 200, duracao: 0.1, volume: 0.15 * vol });
    ruido(ctx, bufferRuido(ctx), destino, { tipo: 'bandpass', f0: 1400, f1: 500, duracao: 0.08, volume: 0.1 * vol });
  }

  function somBloqueado(destino: NoDeAudio, ctx: ContextoSintese, vol: number): void {
    tom(ctx, destino, { forma: 'sine', f0: 1200 * variacao(), f1: 1800, duracao: 0.1, volume: 0.14 * vol });
  }

  function somDesviou(destino: NoDeAudio, ctx: ContextoSintese, vol: number): void {
    ruido(ctx, bufferRuido(ctx), destino, { tipo: 'highpass', f0: 1800, f1: 2600, duracao: 0.08, volume: 0.07 * vol });
  }

  function aoEvento(evento: EventoCorrida): void {
    const vol = volume();
    if (vol <= 0) return;
    const ctx = contexto(audio);
    if (!ctx) return;
    const destino = ctx.destination;
    if (evento.tipo === 'item-pego' && evento.id === idJogador) somItemPego(destino, ctx, vol);
    else if (evento.tipo === 'item-usado' && evento.id === idJogador) somItemUsado(evento.item, destino, ctx, vol);
    else if (evento.tipo === 'acerto' && evento.de === idJogador) somAcertoDado(destino, ctx, vol);
    else if (evento.tipo === 'bloqueado' && evento.id === idJogador) somBloqueado(destino, ctx, vol);
    else if (evento.tipo === 'desviou' && evento.id === idJogador) somDesviou(destino, ctx, vol);
  }

  function atualizar(eventos: readonly EventoCorrida[]): void {
    for (const evento of eventos) aoEvento(evento);
  }

  return { aoEvento, atualizar };
}
