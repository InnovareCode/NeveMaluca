/**
 * Som da contagem "3-2-1-JÁ" (plano corrida-campeonato §C1/C2b, compartilhada por `ui/cenas/descida.ts` e
 * `ui/cenas/corrida.ts` — ver `ui/cenas/contagem.ts`): um beep por número, subindo, e um chime mais brilhante no
 * "JÁ!". A contagem em si é ticks PRÓPRIOS da CENA, nunca do motor (plano: nenhum tick de contagem entra no
 * replay) — por isso esta camada não reage a `EventoDescida`/`EventoCorrida` nenhum: `atualizar(ticksContagem)`
 * é chamada 1x por tick da cena, com o MESMO contador (pós-incremento) que decide o texto em
 * `ui/cenas/contagem.ts` (`textoDaContagem`).
 *
 * `TICKS_POR_NUMERO_CONTAGEM`/`TICKS_JA_CONTAGEM` são uma 2ª cópia, DE PROPÓSITO, dos valores de
 * `ui/cenas/contagem.ts` (`TICKS_POR_NUMERO`/`TICKS_JA`): `audio/` só importa `core`/`data`, nunca `ui/` (tabela
 * de camadas, `tests/unit/arquitetura.test.ts`) — mesmo padrão de `VELOCIDADE_REF_MS` em `musica-adaptativa.ts`.
 * Se a duração da contagem mudar lá, repete aqui.
 */
import type { AudioDestravavel } from './audio-destravavel';
import { tom, type ContextoSintese, type NoDeAudio } from './sintese';

const TICKS_POR_NUMERO_CONTAGEM = 50;
const TICKS_JA_CONTAGEM = 30;
const TOTAL_TICKS_CONTAGEM = TICKS_POR_NUMERO_CONTAGEM * 3 + TICKS_JA_CONTAGEM;

export interface OpcoesSomContagem {
  /** Volume dos efeitos (`cfg.som` do save), 0..1 — FUNÇÃO (mesmo padrão de `OpcoesSomManobras.obterVolumeSom`). */
  readonly obterVolumeSom: () => number;
}

export interface SomContagem {
  /** `ticksContagem`: o MESMO contador (pós-incremento) de `ui/cenas/descida.ts`/`corrida.ts`. Chamar sempre é
   *  seguro — fora da janela 1..`TOTAL_TICKS_CONTAGEM` (ou num degrau repetido) não toca nada. */
  atualizar(ticksContagem: number): void;
}

function contexto(audio: AudioDestravavel): ContextoSintese | null {
  const c = audio.ctx;
  if (!c || c.state === 'closed') return null;
  return c as unknown as ContextoSintese;
}

/**
 * Degrau 0/1/2 = "3"/"2"/"1", 3 = "JÁ!" — MESMOS limiares de `textoDaContagem` (`t < TICKS_POR_NUMERO` etc.),
 * sem deslocamento: `textoDaContagem` é chamada com `ticksContagem + alpha` (`alpha` em [0,1)), então o texto que
 * aparece assim que ESTE `ticksContagem` acaba de ser incrementado já é `textoDaContagem(ticksContagem)` (alpha=0)
 * — é exatamente o instante em que o número muda. `null` fora da janela (nunca acontece vindo da cena, que só
 * chama com `ticksContagem` >= 1 e para de chamar ao concluir; a guarda aqui é só defensiva). */
function degrauDe(ticksContagem: number): 0 | 1 | 2 | 3 | null {
  if (ticksContagem < 1 || ticksContagem > TOTAL_TICKS_CONTAGEM) return null;
  if (ticksContagem < TICKS_POR_NUMERO_CONTAGEM) return 0;
  if (ticksContagem < TICKS_POR_NUMERO_CONTAGEM * 2) return 1;
  if (ticksContagem < TICKS_POR_NUMERO_CONTAGEM * 3) return 2;
  return 3;
}

const FREQS_CONTAGEM = [440, 523.3, 659.3, 880] as const; // "3" "2" "1" sobem; "JÁ!" mais alto e brilhante

/** Cria o sistema de som da contagem. Sem `rng`: são só 4 beeps fixos, sem repetição (cada um toca 1x por corrida) —
 *  nenhum motivo pra variação cosmética aqui (diferente de `som-manobras.ts`, que repete o mesmo som várias vezes). */
export function criarSomContagem(audio: AudioDestravavel, opcoes: OpcoesSomContagem): SomContagem {
  let ultimoDegrau: 0 | 1 | 2 | 3 | null = null;

  function volume(): number {
    const v = opcoes.obterVolumeSom();
    return Number.isFinite(v) && v > 0 ? Math.min(v, 1) : 0;
  }

  function beep(destino: NoDeAudio, ctx: ContextoSintese, vol: number, f0: number, brilho: boolean): void {
    tom(ctx, destino, { forma: brilho ? 'triangle' : 'sine', f0, duracao: brilho ? 0.22 : 0.1, volume: (brilho ? 0.22 : 0.17) * vol, ataque: 0.002 });
    if (brilho) tom(ctx, destino, { forma: 'sine', f0: f0 * 2, duracao: 0.18, volume: 0.1 * vol, quando: 0.02 });
  }

  function atualizar(ticksContagem: number): void {
    const degrau = degrauDe(ticksContagem);
    if (degrau === ultimoDegrau) return;
    ultimoDegrau = degrau;
    if (degrau === null) return;
    const vol = volume();
    if (vol <= 0) return;
    const ctx = contexto(audio);
    if (!ctx) return;
    beep(ctx.destination, ctx, vol, FREQS_CONTAGEM[degrau] as number, degrau === 3);
  }

  return { atualizar };
}
