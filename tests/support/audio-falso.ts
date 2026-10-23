/**
 * `AudioContext` falso para testar `src/audio/sintese.ts` e `src/audio/som-manobras.ts` em Node (sem Web Audio de
 * verdade). Implementa só o subconjunto de `ContextoSintese`/`ContextoDeAudio` que o código usa, e REGISTRA cada
 * oscilador/ruído iniciado (forma/frequências) para os testes afirmarem sobre o grafo sem precisar ouvir nada.
 *
 * Técnica: cada nó guarda seus próprios campos (tipo/frequência) em objetos simples; o nó que liga ao destino
 * (`connect`) guarda a REFERÊNCIA do destino, e é no `start()` da fonte (oscilador/buffer) que lemos o estado do
 * que está rio abaixo (filtro, se houver) — na hora exata em que o som "soa", exatamente como o `som-manobras.ts`
 * só decide o que tocar de forma síncrona (sem timers, por isso não há relógio para avançar aqui).
 */
import type { ContextoDeAudio } from '../../src/audio/audio-destravavel';
import type { BufferDeAudio, ContextoSintese, NoDeAudio, TipoFiltro } from '../../src/audio/sintese';

export interface ChamadaOscilador {
  forma: string;
  f0: number | null;
  f1: number | null;
  iniciado: boolean;
}

export interface ChamadaRuido {
  tipo: TipoFiltro;
  f0: number | null;
  f1: number | null;
  iniciado: boolean;
}

export interface ChamadaFiltro {
  tipo: TipoFiltro;
  f0: number | null;
  f1: number | null;
  q: number;
}

interface NoComRegistroFiltro extends NoDeAudio {
  _registroFiltro?: ChamadaFiltro;
}

function parametroFalso(aoMudar?: (valor: number) => void) {
  let valor = 0;
  const marcar = (v: number): void => {
    valor = v;
    aoMudar?.(v);
  };
  return {
    get value(): number {
      return valor;
    },
    set value(v: number) {
      marcar(v);
    },
    setValueAtTime(v: number): void {
      marcar(v);
    },
    linearRampToValueAtTime(v: number): void {
      marcar(v);
    },
    exponentialRampToValueAtTime(v: number): void {
      marcar(v);
    },
  };
}

export interface ContextoSinteseFalso {
  readonly ctx: ContextoSintese & ContextoDeAudio;
  /** Um registro por oscilador que chegou a `start()`, na ordem. */
  readonly osciladores: ChamadaOscilador[];
  /** Um registro por fonte de ruído que chegou a `start()` (lido do filtro ligado a ela), na ordem. */
  readonly ruidos: ChamadaRuido[];
  /** Um registro por filtro criado (inclusive os de `ruido()`), na ordem. */
  readonly filtros: ChamadaFiltro[];
  /** Quantos `createBuffer` foram chamados (prova que o buffer de ruído é reaproveitado, não recriado a cada som). */
  readonly buffersCriados: number;
}

export function criarContextoSinteseFalso(sampleRate = 48000): ContextoSinteseFalso {
  const osciladores: ChamadaOscilador[] = [];
  const ruidos: ChamadaRuido[] = [];
  const filtros: ChamadaFiltro[] = [];
  const estado = { buffersCriados: 0 };

  const destinoFinal: NoDeAudio = { connect: () => {} };

  function criarOscilador() {
    const registro: ChamadaOscilador = { forma: 'sine', f0: null, f1: null, iniciado: false };
    const frequency = parametroFalso((v) => {
      if (registro.f0 === null) registro.f0 = v;
      else registro.f1 = v;
    });
    const detune = parametroFalso();
    const osc = {
      type: 'sine',
      frequency,
      detune,
      connect: () => {},
      start() {
        registro.forma = osc.type;
        registro.iniciado = true;
        osciladores.push(registro);
      },
      stop() {},
    };
    return osc;
  }

  function criarGanho() {
    return { gain: parametroFalso(), connect: () => {} };
  }

  function criarFiltro(): NoComRegistroFiltro {
    const registro: ChamadaFiltro = { tipo: 'lowpass', f0: null, f1: null, q: 1 };
    filtros.push(registro);
    const frequency = parametroFalso((v) => {
      if (registro.f0 === null) registro.f0 = v;
      else registro.f1 = v;
    });
    const Q = parametroFalso((v) => {
      registro.q = v;
    });
    const filtro: NoComRegistroFiltro = {
      get type(): string {
        return registro.tipo;
      },
      set type(v: string) {
        registro.tipo = v as TipoFiltro;
      },
      frequency,
      Q,
      connect: () => {},
      _registroFiltro: registro,
    } as unknown as NoComRegistroFiltro;
    return filtro;
  }

  function criarFonteBuffer() {
    const registro: ChamadaRuido = { tipo: 'lowpass', f0: null, f1: null, iniciado: false };
    let destino: NoComRegistroFiltro | null = null;
    let buffer: BufferDeAudio | null = null;
    return {
      get buffer(): BufferDeAudio | null {
        return buffer;
      },
      set buffer(b: BufferDeAudio | null) {
        buffer = b;
      },
      connect(d: NoDeAudio) {
        destino = d as NoComRegistroFiltro;
      },
      start() {
        const alvo = destino?._registroFiltro;
        registro.tipo = alvo?.tipo ?? 'lowpass';
        registro.f0 = alvo?.f0 ?? null;
        registro.f1 = alvo?.f1 ?? null;
        registro.iniciado = true;
        ruidos.push(registro);
      },
      stop() {},
    };
  }

  const ctx = {
    state: 'running',
    currentTime: 0,
    sampleRate,
    destination: destinoFinal,
    resume: () => Promise.resolve(),
    createOscillator: criarOscilador,
    createGain: criarGanho,
    createBiquadFilter: criarFiltro,
    createBuffer(canais: number, tamanho: number) {
      estado.buffersCriados += 1;
      const canaisDados: Float32Array[] = Array.from({ length: canais }, () => new Float32Array(tamanho));
      return {
        getChannelData(canal: number): Float32Array {
          return canaisDados[canal] as Float32Array;
        },
      };
    },
    createBufferSource: criarFonteBuffer,
  } as unknown as ContextoSintese & ContextoDeAudio;

  return {
    ctx,
    osciladores,
    ruidos,
    filtros,
    get buffersCriados(): number {
      return estado.buffersCriados;
    },
  };
}
