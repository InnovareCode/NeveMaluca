/**
 * Primitivas de síntese sonora (osciladores/ruído com envelope), Web Audio puro. Base: `AudioSys` do InnoFighters
 * (`src/audio/audio-sys.ts`, métodos `tone`/`noise`), adaptado em 2026-10-23: aqui NÃO há estado de instância (sem
 * `this.sfx`/`this.music`) — cada chamada recebe o contexto e o nó de destino explicitamente, porque este módulo é
 * usado por mais de um sistema (manobras, e no futuro música adaptativa) que decidem seu próprio grafo de ganho.
 *
 * `ContextoSintese`/`NoDeAudio`/etc. são um subconjunto PRÓPRIO da Web Audio API (mesma técnica de
 * `ContextoDeAudio` em `audio-destravavel.ts`): só os métodos que usamos, para o teste rodar em Node com um objeto
 * falso em vez de precisar de um `AudioContext` de verdade (jsdom não implementa Web Audio). Um `AudioContext` real
 * satisfaz estas interfaces por estrutura (tem tudo isto e mais).
 *
 * Regras da camada (varredura em tests/unit/arquitetura.test.ts): sem `Math.random` (use o `Rng` do canal `audio`,
 * `rngDoCanal(semente, 'audio')`), sem `Date`/`performance`/timers.
 */
import type { Rng } from '../core/rng';

export interface ParametroDeAudio {
  value: number;
  setValueAtTime(valor: number, tempo: number): void;
  linearRampToValueAtTime(valor: number, tempo: number): void;
  exponentialRampToValueAtTime(valor: number, tempo: number): void;
}

export interface NoDeAudio {
  connect(destino: NoDeAudio): void;
}

export interface GanhoDeAudio extends NoDeAudio {
  readonly gain: ParametroDeAudio;
}

export interface OsciladorDeAudio extends NoDeAudio {
  type: string;
  readonly frequency: ParametroDeAudio;
  readonly detune: ParametroDeAudio;
  start(tempo: number): void;
  stop(tempo: number): void;
}

export interface FiltroDeAudio extends NoDeAudio {
  type: string;
  readonly frequency: ParametroDeAudio;
  readonly Q: ParametroDeAudio;
}

export interface BufferDeAudio {
  getChannelData(canal: number): Float32Array;
}

export interface FonteBufferDeAudio extends NoDeAudio {
  buffer: BufferDeAudio | null;
  start(tempo: number): void;
  stop(tempo: number): void;
}

/** Subconjunto de `AudioContext` que a síntese usa. */
export interface ContextoSintese {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: NoDeAudio;
  createOscillator(): OsciladorDeAudio;
  createGain(): GanhoDeAudio;
  createBiquadFilter(): FiltroDeAudio;
  createBuffer(canais: number, tamanho: number, taxaAmostragem: number): BufferDeAudio;
  createBufferSource(): FonteBufferDeAudio;
}

export type FormaOnda = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type TipoFiltro = 'lowpass' | 'highpass' | 'bandpass';

export interface DefFiltro {
  readonly tipo: TipoFiltro;
  readonly f: number;
  readonly q?: number;
}

export interface OpcoesTom {
  readonly forma?: FormaOnda;
  /** Frequência inicial, Hz. */
  readonly f0: number;
  /** Frequência final, Hz (rampa exponencial); omitido = tom plano. */
  readonly f1?: number;
  /** Duração do corpo do som, segundos (o envelope cai a zero neste instante). */
  readonly duracao: number;
  /** 0..1 (já com o volume do save multiplicado por quem chama). <= 0 não toca nada. */
  readonly volume: number;
  /** Subida do envelope, segundos. Padrão 0,004 (curto, sem estalo). */
  readonly ataque?: number;
  /** Atraso do início, segundos relativos a agora. Padrão 0 (já). */
  readonly quando?: number;
  readonly filtro?: DefFiltro;
  readonly detune?: number;
}

/** Tom sintetizado (oscilador + envelope linear/exponencial, filtro opcional). */
export function tom(ctx: ContextoSintese, destino: NoDeAudio, o: OpcoesTom): void {
  if (o.volume <= 0) return;
  const agora = ctx.currentTime + (o.quando ?? 0);
  const osc = ctx.createOscillator();
  osc.type = o.forma ?? 'sine';
  osc.frequency.setValueAtTime(o.f0, agora);
  if (o.f1 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(o.f1, 1), agora + o.duracao);
  if (o.detune !== undefined) osc.detune.value = o.detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, agora);
  g.gain.linearRampToValueAtTime(o.volume, agora + (o.ataque ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, agora + o.duracao);
  let no: NoDeAudio = osc;
  if (o.filtro) {
    const f = ctx.createBiquadFilter();
    f.type = o.filtro.tipo;
    f.frequency.value = o.filtro.f;
    f.Q.value = o.filtro.q ?? 1;
    osc.connect(f);
    no = f;
  }
  no.connect(g);
  g.connect(destino);
  osc.start(agora);
  osc.stop(agora + o.duracao + 0.05);
}

export interface OpcoesRuido {
  readonly tipo?: TipoFiltro;
  /** Frequência inicial do filtro, Hz. Padrão 1000. */
  readonly f0?: number;
  /** Frequência final (rampa exponencial); omitido = filtro fixo. */
  readonly f1?: number;
  readonly q?: number;
  readonly duracao: number;
  /** 0..1 (já com o volume do save multiplicado por quem chama). <= 0 não toca nada. */
  readonly volume: number;
  readonly ataque?: number;
  readonly quando?: number;
}

/** Ruído branco (do buffer pré-gerado por `criarBufferRuido`) passado por um filtro, com envelope. */
export function ruido(ctx: ContextoSintese, buffer: BufferDeAudio, destino: NoDeAudio, o: OpcoesRuido): void {
  if (o.volume <= 0) return;
  const agora = ctx.currentTime + (o.quando ?? 0);
  const fonte = ctx.createBufferSource();
  fonte.buffer = buffer;
  const filtro = ctx.createBiquadFilter();
  filtro.type = o.tipo ?? 'lowpass';
  filtro.Q.value = o.q ?? 1;
  filtro.frequency.setValueAtTime(o.f0 ?? 1000, agora);
  if (o.f1 !== undefined) filtro.frequency.exponentialRampToValueAtTime(Math.max(o.f1, 20), agora + o.duracao);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, agora);
  g.gain.linearRampToValueAtTime(o.volume, agora + (o.ataque ?? 0.003));
  g.gain.exponentialRampToValueAtTime(0.0001, agora + o.duracao);
  fonte.connect(filtro);
  filtro.connect(g);
  g.connect(destino);
  fonte.start(agora);
  fonte.stop(agora + o.duracao + 0.05);
}

/**
 * Buffer de ruído branco, gerado UMA vez por contexto (os chamadores guardam o resultado). Usa `rng` (canal
 * `audio`), nunca `Math.random` — a varredura de arquitetura proíbe `Math.random` em toda `src/`.
 */
export function criarBufferRuido(ctx: ContextoSintese, rng: Rng, segundos = 1.2): BufferDeAudio {
  const tamanho = Math.max(1, Math.round(ctx.sampleRate * segundos));
  const buffer = ctx.createBuffer(1, tamanho, ctx.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < tamanho; i += 1) dados[i] = rng.entre(-1, 1);
  return buffer;
}
