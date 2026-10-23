/**
 * Música adaptativa (M2, plano §3.8): a trilha da descida é 100% sintetizada (mesma base de `sintese.ts` que
 * `som-manobras.ts` já usa) e reage ao ESTADO do piloto — velocidade e multiplicador de combo — em vez de tocar um
 * loop fixo. Quanto mais rápido e mais alto o combo, mais camadas entram (baixo -> harmonia -> quinta -> brilho +
 * percussão) e mais curto fica o passo (andamento sobe); zera o combo e cai a velocidade, a trilha volta ao
 * repouso (só o pulso de baixo).
 *
 * Mesmas regras de `som-manobras.ts` (ver README desta pasta): SEM `setTimeout`/`setInterval`/`Date`/`performance`
 * (a varredura de `tests/unit/arquitetura.test.ts` bane timer e relógio em `audio/`) — o "sequenciador" é só um
 * contador de TICKS. A cena chama `atualizar(leitura)` a cada tick de física (60 Hz, `core/constantes.ts`); esta
 * camada decide a cada chamada se já passaram ticks suficientes para o próximo passo e, se sim, toca AGORA
 * (`tom`/`ruido`, offset `quando: 0`) — nunca agenda nada à frente no relógio do `AudioContext`. Não há nó
 * persistente (osciladores de verdade só existem entre `start()`/`stop()` de uma nota curta, como em
 * `som-manobras.ts`): parar de chamar `atualizar` já é suficiente para a trilha silenciar, sem precisar desligar
 * nenhum grafo.
 *
 * O mapeamento estado -> intensidade/nível (`intensidadeDeEstado`/`nivelDeIntensidade`) é função PURA, testável
 * sem Web Audio nenhum (nem `AudioDestravavel`).
 */
import type { FaseDescida, LeituraDescida } from '../core/contratos';
import type { Rng } from '../core/rng';
import { MULT_TETO } from '../data/manobras';
import type { AudioDestravavel } from './audio-destravavel';
import { criarBufferRuido, ruido, tom, type BufferDeAudio, type ContextoSintese, type NoDeAudio } from './sintese';

/**
 * Velocidade (m/s) acima da qual a parcela de "velocidade" da intensidade já está no máximo. Mesma ordem de
 * grandeza de `VELOCIDADE_MAX_REF_MS` (`render/camera.ts`), repetida aqui porque `audio/` só importa `core`/`data`
 * (não pode importar `render/`) — ver tabela de camadas em `tests/unit/arquitetura.test.ts`.
 */
const VELOCIDADE_REF_MS = 40;

export const NIVEIS_MUSICA = ['repouso', 'leve', 'media', 'alta'] as const;
export type NivelMusica = (typeof NIVEIS_MUSICA)[number];

/** Limiares de `intensidadeDeEstado` (0..1) que definem cada nível. */
const LIMIAR_LEVE = 0.25;
const LIMIAR_MEDIA = 0.5;
const LIMIAR_ALTA = 0.75;

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/**
 * Intensidade (0..1) a partir do estado do piloto: combina velocidade (módulo, m/s) e multiplicador de combo
 * (1..`MULT_TETO`). O combo pesa um pouco mais que a velocidade — um combo alto numa aterrissagem lenta já deve
 * encher a trilha, não só velocidade pura numa descida reta sem manobra nenhuma.
 */
export function intensidadeDeEstado(velocidadeMs: number, multCombo: number): number {
  const porVelocidade = clamp01(velocidadeMs / VELOCIDADE_REF_MS);
  const porCombo = clamp01((multCombo - 1) / (MULT_TETO - 1));
  return clamp01(0.45 * porVelocidade + 0.55 * porCombo);
}

/** Nível discreto (quantas camadas tocam) a partir da intensidade contínua. */
export function nivelDeIntensidade(intensidade: number): NivelMusica {
  if (intensidade >= LIMIAR_ALTA) return 'alta';
  if (intensidade >= LIMIAR_MEDIA) return 'media';
  if (intensidade >= LIMIAR_LEVE) return 'leve';
  return 'repouso';
}

/** Ticks (a 60 Hz) entre um passo e o próximo, por nível: o andamento sobe com a intensidade. */
const TICKS_POR_PASSO: Readonly<Record<NivelMusica, number>> = {
  repouso: 30, // ~2 passos/s
  leve: 24, // ~2,5 passos/s
  media: 18, // ~3,3 passos/s
  alta: 12, // ~5 passos/s
};

/** Quanto a intensidade "ouvida" se aproxima do alvo por tick (média móvel simples) — evita flapping de camada. */
const TAXA_SUAVIZACAO = 0.05;

const RAIZ_HZ = 110; // A2: grave, não disputa com o som das manobras (que vive acima de 300 Hz)
const RATIO_TERCA = 1.2; // terça menor (6/5)
const RATIO_QUINTA = 1.5; // quinta justa (3/2)
const RATIO_OITAVA = 2;

const FASES_COM_MUSICA = new Set<FaseDescida>(['contagem', 'descendo', 'tombo']);

export interface OpcoesMusicaAdaptativa {
  /**
   * Volume da música (`cfg.musica` do save), 0..1. É uma FUNÇÃO (mesmo padrão de `OpcoesSomManobras.obterVolumeSom`):
   * chamada a cada passo, então o toggle das Opções já vale no passo seguinte sem recriar nada aqui.
   */
  readonly obterVolumeMusica: () => number;
}

export interface EstadoMusicaAdaptativa {
  readonly intensidade: number;
  readonly nivel: NivelMusica;
}

export interface MusicaAdaptativa {
  /**
   * Um tick de `LeituraDescida` (fase + piloto + combo): atualiza a intensidade suavizada e, quando chegou a hora
   * do próximo passo, toca as camadas do nível atual. Fora de `contagem`/`descendo`/`tombo` (ou com `cfg.musica`
   * em 0, ou antes do 1º gesto) não toca nada — chamar sempre é seguro.
   */
  atualizar(leitura: Pick<LeituraDescida, 'fase' | 'piloto' | 'combo'>): void;
  /** Nível/intensidade da ÚLTIMA chamada de `atualizar` (não dispara som; só para teste/depuração). */
  estadoAtual(): EstadoMusicaAdaptativa;
}

function contexto(audio: AudioDestravavel): ContextoSintese | null {
  const c = audio.ctx;
  if (!c || c.state === 'closed') return null;
  return c as unknown as ContextoSintese;
}

function indiceNivel(nivel: NivelMusica): number {
  return NIVEIS_MUSICA.indexOf(nivel);
}

/** Cria a trilha adaptativa. `rng` é o canal `audio` (`rngDoCanal(pista.semente, 'audio')`), o MESMO passado a
 * `criarSomManobras` — mesmo padrão do canal `visual` (`rngVisual` compartilhado por câmera e partículas): um
 * gerador por canal, consumido em ordem fixa por quem a cena chama a cada tick. */
export function criarMusicaAdaptativa(audio: AudioDestravavel, rng: Rng, opcoes: OpcoesMusicaAdaptativa): MusicaAdaptativa {
  let buffer: BufferDeAudio | null = null;
  let ctxDoBuffer: ContextoSintese | null = null;
  let intensidadeSuave = 0;
  let nivelAtual: NivelMusica = 'repouso';
  let ticksNoPasso = 0;
  let passo = 0;

  function bufferRuido(ctx: ContextoSintese): BufferDeAudio {
    if (!buffer || ctxDoBuffer !== ctx) {
      buffer = criarBufferRuido(ctx, rng);
      ctxDoBuffer = ctx;
    }
    return buffer;
  }

  function volume(): number {
    const v = opcoes.obterVolumeMusica();
    return Number.isFinite(v) && v > 0 ? Math.min(v, 1) : 0;
  }

  /** Variação leve e determinística de tom (±2%, menor que a das manobras: aqui é fundo, não destaque). */
  function variacao(): number {
    return 1 + rng.entre(-0.02, 0.02);
  }

  function tocarPasso(nivel: NivelMusica, ctx: ContextoSintese, destino: NoDeAudio, vol: number): void {
    const duracaoPasso = TICKS_POR_PASSO[nivel] / 60;
    const acento = passo % 4 === 0; // acento a cada 4 passos (1 "compasso")

    // camada 1 (sempre): pulso de baixo na raiz. É o que toca no repouso, para a trilha nunca ficar muda de vez.
    tom(ctx, destino, {
      forma: 'triangle',
      f0: RAIZ_HZ * variacao(),
      duracao: duracaoPasso * 0.85,
      volume: (acento ? 0.22 : 0.16) * vol,
      filtro: { tipo: 'lowpass', f: 280 + indiceNivel(nivel) * 260 },
    });

    // camada 2 (leve+): harmonia na terça, nos passos pares — entra com o 1º degrau de intensidade.
    if (nivel !== 'repouso' && passo % 2 === 0) {
      tom(ctx, destino, { forma: 'sine', f0: RAIZ_HZ * RATIO_TERCA * variacao(), duracao: duracaoPasso * 0.7, volume: 0.14 * vol });
    }

    // camada 3 (média+): quinta em todo passo — enche a harmonia.
    if (nivel === 'media' || nivel === 'alta') {
      tom(ctx, destino, { forma: 'sine', f0: RAIZ_HZ * RATIO_QUINTA * variacao(), duracao: duracaoPasso * 0.6, volume: 0.12 * vol });
    }

    // camada 4 (alta): brilho na oitava + percussão de ruído — o teto da intensidade (combo alto/velocidade alta).
    if (nivel === 'alta') {
      tom(ctx, destino, { forma: 'triangle', f0: RAIZ_HZ * RATIO_OITAVA * variacao(), duracao: duracaoPasso * 0.4, volume: 0.1 * vol, ataque: 0.001 });
      ruido(ctx, bufferRuido(ctx), destino, { tipo: 'bandpass', f0: 4000, f1: 6000, q: 2, duracao: duracaoPasso * 0.2, volume: 0.07 * vol });
    }

    passo = (passo + 1) % 4;
  }

  function atualizar(leitura: Pick<LeituraDescida, 'fase' | 'piloto' | 'combo'>): void {
    const alvo = intensidadeDeEstado(leitura.piloto.velocidade, leitura.combo.mult);
    intensidadeSuave += (alvo - intensidadeSuave) * TAXA_SUAVIZACAO;
    nivelAtual = nivelDeIntensidade(intensidadeSuave);

    if (!FASES_COM_MUSICA.has(leitura.fase)) {
      ticksNoPasso = 0;
      passo = 0;
      return;
    }

    const vol = volume();
    if (vol <= 0) return;
    const ctx = contexto(audio);
    if (!ctx) return;

    ticksNoPasso += 1;
    if (ticksNoPasso < TICKS_POR_PASSO[nivelAtual]) return;
    ticksNoPasso = 0;
    tocarPasso(nivelAtual, ctx, ctx.destination, vol);
  }

  function estadoAtual(): EstadoMusicaAdaptativa {
    return { intensidade: intensidadeSuave, nivel: nivelAtual };
  }

  return { atualizar, estadoAtual };
}
