/**
 * Som dos eventos "de física/progressão" da descida (game feel aprovado pelo dono em 2026-10-24): pulo, pouso (3
 * qualidades distintas), tombo, coleta de item da camada (floco/dourado), acerto SOFRIDO por um item e chegada.
 * 100% sintetizado (`sintese.ts`), mesmo padrão de `som-manobras.ts` (ver README desta pasta) — puramente reativo
 * a `EventoDescida`, nunca lê `descida/` nem decide nada de jogo.
 *
 * Separado de `som-manobras.ts` de propósito: aquele é "pontuação de truque" (ar/mortal/grab/trilho, combo); este
 * é física/progressão. Dois arquivos pequenos e focados em vez de 1 grande com um `switch` gigante.
 *
 * `'atingido'` (acerto SOFRIDO por um item, plano itens-corrida) mora AQUI, não em `som-itens.ts`: é o PRÓPRIO
 * motor do corredor que o emite (`descida/motor.ts`, ao aplicar o `EfeitoExterno` na física dele), já dentro da
 * `LeituraDescida` que esta camada já consome tick a tick — nunca precisa comparar `de`/`em` como `EventoCorrida`
 * exige. `som-itens.ts` cobre o que só existe no nível da CORRIDA (caixa/roleta/uso/acerto DADO/bloqueio/desvio) —
 * ver o cabeçalho de lá.
 *
 * Kicker (plano corrida-campeonato §Arquitetura): o motor não emite um evento próprio para isto — o impulso extra
 * já está embutido em `EventoDescida{tipo:'pulo'}.forca` (`impulsoKickerEm`, `descida/motor.ts`). Em vez de
 * duplicar essa lógica aqui (ou pedir um evento novo no contrato), o pulo normal já escala o whoosh com `forca`;
 * um pulo "turbinado" pelo kicker (`LIMIAR_IMPULSO_KICKER`, bem acima do pulo normal) ganha uma 2ª camada por
 * cima — o "som do kicker" emerge do mesmo evento, sem contrato novo.
 */
import type { EventoDescida, LeituraDescida, TipoItem } from '../core/contratos';
import type { Rng } from '../core/rng';
import type { AudioDestravavel } from './audio-destravavel';
import { criarBufferRuido, ruido, tom, type BufferDeAudio, type ContextoSintese, type NoDeAudio } from './sintese';

export interface OpcoesSomDescida {
  /** Volume dos efeitos (`cfg.som` do save), 0..1 — FUNÇÃO (mesmo padrão de `OpcoesSomManobras.obterVolumeSom`). */
  readonly obterVolumeSom: () => number;
}

export interface SomDescida {
  /** Toca o som de UM evento (os que esta camada não conhece são ignorados, de propósito). */
  aoEvento(evento: EventoDescida): void;
  /** Atalho: chama `aoEvento` para cada evento de `leitura.eventos` (um tick de `LeituraDescida`). */
  atualizar(leitura: Pick<LeituraDescida, 'eventos'>): void;
}

/**
 * Acima disto, um `'pulo'` só pode ser kicker (ver cabeçalho do arquivo): o impulso de pulo normal fica ~9-15
 * mesmo com o bônus de rampa máximo (`impulsoPuloMs=9` + `fatorRampaMsPorGrau=0.12` * ângulo, `descida/
 * constantes.ts`); o kicker soma +32 (`IMPULSO_KICKER_MS`, `pista/camada-jogo.ts`) — grande margem, nunca ambíguo.
 */
const LIMIAR_IMPULSO_KICKER = 25;

function contexto(audio: AudioDestravavel): ContextoSintese | null {
  const c = audio.ctx;
  if (!c || c.state === 'closed') return null;
  return c as unknown as ContextoSintese;
}

/** Cria o sistema de som de física/progressão da descida. `rng` (canal `audio`): `rngDoCanal(pista.semente, 'audio')`,
 *  o MESMO compartilhado com `som-manobras.ts`/`musica-adaptativa.ts`/`som-itens.ts` (mesmo padrão do canal `visual`). */
export function criarSomDescida(audio: AudioDestravavel, rng: Rng, opcoes: OpcoesSomDescida): SomDescida {
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

  /** Variação leve e determinística de tom, para repetir o mesmo evento não soar idêntico (mesma ideia de
   *  `som-manobras.ts`, faixa configurável porque pulo/pouso acontecem com MUITO mais frequência que manobras). */
  function variacao(faixa = 0.03): number {
    return 1 + rng.entre(-faixa, faixa);
  }

  function somPulo(forca: number, destino: NoDeAudio, ctx: ContextoSintese, vol: number): void {
    const f = Math.max(0, forca);
    const intensidade = Math.min(f, 40) / 40; // 0..1, satura em 40 (já bem acima de qualquer pulo normal)
    const f1 = 420 + intensidade * 400; // ~420..820 Hz: mais agudo quanto mais forte
    const duracao = 0.1 + intensidade * 0.12; // ~0.1..0.22s: mais longo quanto mais forte
    ruido(ctx, bufferRuido(ctx), destino, { tipo: 'highpass', f0: 300 * variacao(), f1, q: 0.8, duracao, volume: 0.16 * vol });
    if (f >= LIMIAR_IMPULSO_KICKER) {
      // camada extra do kicker (ver cabeçalho): sweep agudo por cima, sem evento novo no contrato.
      tom(ctx, destino, { forma: 'sawtooth', f0: 500 * variacao(), f1: 1400, duracao: 0.22, volume: 0.14 * vol, filtro: { tipo: 'lowpass', f: 2600 } });
    }
  }

  function somPouso(qualidade: 'perfeito' | 'bom' | 'torto', destino: NoDeAudio, ctx: ContextoSintese, vol: number): void {
    switch (qualidade) {
      case 'perfeito':
        tom(ctx, destino, { forma: 'sine', f0: 300 * variacao(), f1: 520, duracao: 0.12, volume: 0.2 * vol });
        tom(ctx, destino, { forma: 'triangle', f0: 780, duracao: 0.16, volume: 0.14 * vol, quando: 0.04 });
        break;
      case 'bom':
        tom(ctx, destino, { forma: 'sine', f0: 260 * variacao(), f1: 380, duracao: 0.12, volume: 0.18 * vol });
        break;
      case 'torto':
        ruido(ctx, bufferRuido(ctx), destino, { tipo: 'lowpass', f0: 700, f1: 150, duracao: 0.2, volume: 0.2 * vol });
        tom(ctx, destino, { forma: 'square', f0: 140 * variacao(), duracao: 0.16, volume: 0.1 * vol });
        break;
    }
  }

  function somTombo(destino: NoDeAudio, ctx: ContextoSintese, vol: number): void {
    ruido(ctx, bufferRuido(ctx), destino, { tipo: 'lowpass', f0: 500, f1: 90, duracao: 0.3, volume: 0.22 * vol });
    tom(ctx, destino, { forma: 'sawtooth', f0: 160 * variacao(), f1: 60, duracao: 0.26, volume: 0.14 * vol, filtro: { tipo: 'lowpass', f: 900 } });
  }

  function somColeta(item: string, destino: NoDeAudio, ctx: ContextoSintese, vol: number): void {
    if (item === 'dourado') {
      tom(ctx, destino, { forma: 'triangle', f0: 880 * variacao(), f1: 1320, duracao: 0.14, volume: 0.16 * vol });
      tom(ctx, destino, { forma: 'sine', f0: 1760, duracao: 0.12, volume: 0.1 * vol, quando: 0.05 });
    } else {
      // floco (ou qualquer id futuro que esta camada ainda não distinga): "ping" neutro e curtinho.
      tom(ctx, destino, { forma: 'sine', f0: 1000 * variacao(), duracao: 0.07, volume: 0.1 * vol, ataque: 0.001 });
    }
  }

  function somAtingido(item: TipoItem, destino: NoDeAudio, ctx: ContextoSintese, vol: number): void {
    // "ai": baque curto + queda de tom, igual pra qualquer item que acerte (bola/nuvem/poça) — o feedback visual
    // (`render/hud.ts` toast) já diz qual foi; o som só precisa confirmar "você foi pego".
    void item;
    ruido(ctx, bufferRuido(ctx), destino, { tipo: 'lowpass', f0: 600, f1: 200, duracao: 0.14, volume: 0.17 * vol });
    tom(ctx, destino, { forma: 'square', f0: 220 * variacao(), f1: 110, duracao: 0.14, volume: 0.12 * vol });
  }

  const NOTAS_CHEGADA = [523.3, 659.3, 784.0, 1046.5] as const;

  function somChegada(destino: NoDeAudio, ctx: ContextoSintese, vol: number): void {
    NOTAS_CHEGADA.forEach((f0, i) => {
      tom(ctx, destino, { forma: 'triangle', f0, duracao: 0.22, volume: 0.18 * vol, quando: i * 0.09, ataque: 0.004 });
    });
  }

  function aoEvento(evento: EventoDescida): void {
    const vol = volume();
    if (vol <= 0) return;
    const ctx = contexto(audio);
    if (!ctx) return;
    const destino = ctx.destination;
    if (evento.tipo === 'pulo') somPulo(evento.forca, destino, ctx, vol);
    else if (evento.tipo === 'pouso') somPouso(evento.qualidade, destino, ctx, vol);
    else if (evento.tipo === 'tombo') somTombo(destino, ctx, vol);
    else if (evento.tipo === 'coleta') somColeta(evento.item, destino, ctx, vol);
    else if (evento.tipo === 'atingido') somAtingido(evento.item, destino, ctx, vol);
    else if (evento.tipo === 'chegada') somChegada(destino, ctx, vol);
  }

  function atualizar(leitura: Pick<LeituraDescida, 'eventos'>): void {
    for (const evento of leitura.eventos) aoEvento(evento);
  }

  return { aoEvento, atualizar };
}
