/**
 * Trilha musical REAL (pedido do dono, 2026-10-24: "quer musicas reais" — `public/assets/musica/<id>.mp3`,
 * licença/origem em `docs/creditos-musica.md`). Convive com `musica-adaptativa.ts` (sintetizada): esta aqui toca
 * a faixa de verdade da pista/menu; a sintetizada passa a ser só o FALLBACK de quando o arquivo falha (ver
 * `estaTocando()` — quem chama decide não rodar as duas juntas, olhando esse sinal).
 *
 * `criarTrilhaMusical(audio, opcoes)`:
 *   - `tocar(id)`: troca para a faixa `id` (arquivo `public/assets/musica/<id>.mp3`) com crossfade curto entre
 *     faixas (`CROSSFADE_TROCA_S`). Idempotente (chamar de novo com o id já tocando não reinicia nada). Carrega
 *     sob demanda (cache por id, nunca as 6 de uma vez — ver `precarregar`); se o arquivo falhar, não toca nada
 *     por aqui (fica em silêncio dessa trilha; quem chama mantém a sintetizada rodando, olhando `estaTocando()`).
 *   - `precarregar(id)`: só esquenta o cache (mesma promessa de `tocar`), sem decidir tocar nada — útil na tela
 *     de seleção/abertura, pra quando a corrida começar o arquivo já estar decodificado.
 *   - `atualizar()`: chamar a cada quadro — sincroniza o ganho mestre com `obterVolumeMusica()` (Opções/mudo
 *     valem no quadro seguinte, mesmo padrão de `obterVolumeSom` em `som-manobras.ts`) e com `ducar()`.
 *   - `ducar(ativo)`: abaixa o ganho mestre (fanfarra/pódio por cima sem embolar — MESMO fator pra qualquer
 *     faixa, pedido do dono: as 6 músicas + menu foram normalizadas pro mesmo nível, -18 LUFS, então nenhum ganho
 *     por faixa aqui).
 *   - `parar()`: silencia com fade curto (ex.: saindo pra uma tela sem trilha).
 *
 * Laço de uma faixa SEM cortar seco: como não controlamos o ponto de loop exato de um mp3 externo, cada volta usa
 * DUAS "vozes" (mesmo buffer, defasadas): a voz N só agenda a voz N+2 quando a voz N termina (`onended`) — nesse
 * momento a voz N+1 já está tocando há um tempo (ela foi agendada `CROSSFADE_LOOP_S` segundos ANTES do fim de N,
 * junto com N, lá no início da cadeia) e ainda falta muito pro fim dela, então sempre há folga pra agendar a
 * seguinte ANTES que ela precise tocar. Tudo por `ctx.currentTime` (relógio do próprio `AudioContext`), nunca
 * `setTimeout`/`Date`/`performance` (banidos em `audio/`, varredura de `tests/unit/arquitetura.test.ts`) —
 * `onended` é só um retorno de evento, dispara sozinho quando a voz REALMENTE termina, sem a gente precisar
 * reinventar relógio nenhum pra isso.
 */
import type { AudioDestravavel } from './audio-destravavel';
import type { BufferDeAudio, ContextoSintese, FonteBufferDeAudio, GanhoDeAudio, NoDeAudio } from './sintese';

/** Crossfade ao TROCAR de faixa (menu -> pista, pista -> pista, pódio -> menu). */
const CROSSFADE_TROCA_S = 1.1;
/** Crossfade na VOLTA do loop de uma mesma faixa — curto, só pra não cortar seco (pedido do dono). */
const CROSSFADE_LOOP_S = 1.6;
/** Fator do ganho mestre durante `ducar(true)` (fanfarra/pódio por cima sem embolar). IGUAL pra qualquer faixa —
 *  as 6 músicas + menu foram normalizadas pro mesmo nível (-18 LUFS, `docs/creditos-musica.md`), então nada aqui
 *  compensa faixa a faixa. */
const FATOR_DUCK = 0.35;
/** Rampa do ganho mestre ao mudar volume/mudo/duck — curta, evita clique, mas não precisa ser instantânea. */
const RAMPA_GANHO_S = 0.12;

export interface OpcoesTrilhaMusical {
  /** Volume da música (`cfg.musica` do save), 0..1; 0 ou mudo = silêncio. Função (não número): chamada a cada
   *  `atualizar()`, então o controle das Opções já vale no quadro seguinte sem recriar nada aqui. */
  readonly obterVolumeMusica: () => number;
}

export interface TrilhaMusical {
  /** Troca para a faixa `id` (crossfade curto). Idempotente se `id` já é a atual (tocando ou carregando). */
  tocar(id: string): void;
  /** Só esquenta o cache de `id`, sem tocar nada (chamar na seleção/abertura, antes do `tocar` de verdade). */
  precarregar(id: string): void;
  /** Chamar a cada quadro: sincroniza o ganho mestre com volume/mudo/duck. Segura, mesmo sem faixa nenhuma. */
  atualizar(): void;
  /** `true` = abaixa o ganho mestre (fanfarra/pódio); `false` = restaura. Chamadas repetidas com o mesmo valor
   *  não acumulam (é um estado, não um incremento). */
  ducar(ativo: boolean): void;
  /** Silencia a faixa atual com fade curto (`CROSSFADE_TROCA_S`) e esquece qual estava tocando. */
  parar(): void;
  /** Id da faixa REALMENTE tocando agora (já carregada e audível), ou `null` (nenhuma, carregando, ou falhou —
   *  quem chama usa isto pra decidir se mantém a música sintetizada como fallback). */
  estaTocando(): string | null;
}

/** Buffer decodificado: `BufferDeAudio` (mesmo subconjunto de `sintese.ts`) + `duration`, que só um `AudioBuffer`
 *  de verdade tem (precisamos saber onde a volta do loop cai). */
export interface BufferMusica extends BufferDeAudio {
  readonly duration: number;
}

/** `AudioBufferSourceNode` de verdade expõe `onended` (dispara quando a reprodução chega ao `stop()` agendado);
 *  o subconjunto de `sintese.ts` não precisava disso (notas curtas nunca encadeiam). */
export interface FonteMusica extends FonteBufferDeAudio {
  onended: (() => void) | null;
}

/** Subconjunto de `AudioContext` que a trilha usa: tudo de `ContextoSintese` + decodificar um arquivo baixado. */
export interface ContextoMusica extends Omit<ContextoSintese, 'createBufferSource'> {
  createBufferSource(): FonteMusica;
  decodeAudioData(dados: ArrayBuffer): Promise<BufferMusica>;
}

/** Busca um arquivo e devolve os bytes crus. Parâmetro (não `fetch` global direto) só pra o teste conseguir trocar
 *  por um falso em Node — o jogo de verdade nunca passa nada aqui (usa o padrão, `fetch` do navegador). */
export type Buscador = (url: string) => Promise<{ readonly ok: boolean; readonly status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

function buscadorPadrao(url: string): ReturnType<Buscador> {
  return fetch(url);
}

/** Resolve `id` -> URL do arquivo, respeitando a base do Vite (dev/GitHub Pages) — mesma conta de
 *  `assets/index.ts#resolverUrlAsset`, duplicada aqui porque `audio/` só importa `core`/`data` (não `assets/`). */
function resolverUrlMusica(id: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const semBarraDupla = base.endsWith('/') ? base : `${base}/`;
  return `${semBarraDupla}assets/musica/${id}.mp3`;
}

function contexto(audio: AudioDestravavel): ContextoMusica | null {
  const c = audio.ctx;
  if (!c || c.state === 'closed') return null;
  return c as unknown as ContextoMusica;
}

interface Voz {
  readonly fonte: FonteMusica;
  readonly largadaEm: number;
}

interface Sessao {
  readonly id: string;
  cancelada: boolean;
  readonly ganhoFaixa: GanhoDeAudio;
}

export function criarTrilhaMusical(audio: AudioDestravavel, opcoes: OpcoesTrilhaMusical, buscar: Buscador = buscadorPadrao): TrilhaMusical {
  const cache = new Map<string, Promise<BufferMusica | null>>();
  let ganhoMestre: GanhoDeAudio | null = null;
  let ctxDoGanhoMestre: ContextoMusica | null = null;
  let idDesejado: string | null = null;
  let idIniciado: string | null = null;
  let sessaoAtual: Sessao | null = null;
  let duckAtivo = false;

  function ganhoMestreDe(ctx: ContextoMusica): GanhoDeAudio {
    if (!ganhoMestre || ctxDoGanhoMestre !== ctx) {
      ganhoMestre = ctx.createGain();
      ganhoMestre.gain.value = 0;
      ganhoMestre.connect(ctx.destination);
      ctxDoGanhoMestre = ctx;
    }
    return ganhoMestre;
  }

  function carregar(ctx: ContextoMusica, id: string): Promise<BufferMusica | null> {
    const existente = cache.get(id);
    if (existente) return existente;
    const promessa = (async (): Promise<BufferMusica | null> => {
      try {
        const res = await buscar(resolverUrlMusica(id));
        if (!res.ok) return null;
        const bytes = await res.arrayBuffer();
        return await ctx.decodeAudioData(bytes);
      } catch {
        return null;
      }
    })();
    cache.set(id, promessa);
    return promessa;
  }

  /** Agenda UMA voz do loop (fade-in no começo, fade-out nos últimos `crossfade` segundos) e devolve a referência
   *  (pra quem chamou saber `largadaEm` e encadear a próxima). */
  function agendarVoz(ctx: ContextoMusica, destino: NoDeAudio, buffer: BufferMusica, largadaEm: number, crossfade: number): Voz {
    const fonte = ctx.createBufferSource();
    fonte.buffer = buffer;
    const ganhoVoz = ctx.createGain();
    fonte.connect(ganhoVoz);
    ganhoVoz.connect(destino);
    const fimDesta = largadaEm + buffer.duration;
    ganhoVoz.gain.setValueAtTime(0, largadaEm);
    ganhoVoz.gain.linearRampToValueAtTime(1, largadaEm + crossfade);
    ganhoVoz.gain.setValueAtTime(1, fimDesta - crossfade);
    ganhoVoz.gain.linearRampToValueAtTime(0, fimDesta);
    fonte.start(largadaEm);
    fonte.stop(fimDesta + 0.05);
    return { fonte, largadaEm };
  }

  /** A cadeia: agenda as duas primeiras vozes (defasadas por `duracao - crossfade`) e encadeia a 3ª em diante
   *  pelo `onended` da voz UMA posição atrás (sempre há folga: ver cabeçalho do arquivo). */
  function encadearLoop(sessao: Sessao, ctx: ContextoMusica, destino: NoDeAudio, buffer: BufferMusica, largadaInicial: number): void {
    const crossfade = Math.min(CROSSFADE_LOOP_S, buffer.duration / 2);
    function proxima(vozUmaAtras: Voz): void {
      vozUmaAtras.fonte.onended = () => {
        if (sessao.cancelada) return;
        const nova = agendarVoz(ctx, destino, buffer, vozUmaAtras.largadaEm + buffer.duration - crossfade, crossfade);
        proxima(nova);
      };
    }
    const vozA = agendarVoz(ctx, destino, buffer, largadaInicial, crossfade);
    const vozB = agendarVoz(ctx, destino, buffer, largadaInicial + buffer.duration - crossfade, crossfade);
    proxima(vozB);
    void vozA; // só precisa tocar; quem encadeia o resto é vozB em diante.
  }

  /** Dá o próximo passo para `idDesejado` chegar a tocar: corta se o contexto ainda não existe (1º gesto não
   *  aconteceu) ou se já foi iniciado — `atualizar()` chama isto A CADA QUADRO, então uma `tocar(id)` pedida
   *  ANTES do destrave do iOS não fica perdida: no quadro em que o contexto nasce, o mesmo pedido pega carona. */
  function tentarIniciar(): void {
    if (idDesejado === null || idDesejado === idIniciado) return;
    const ctx = contexto(audio);
    if (!ctx) return;
    const id = idDesejado;
    idIniciado = id;
    const ganho = ganhoMestreDe(ctx);

    const sessaoAnterior = sessaoAtual;
    if (sessaoAnterior) {
      sessaoAnterior.cancelada = true;
      const agora = ctx.currentTime;
      sessaoAnterior.ganhoFaixa.gain.setValueAtTime(sessaoAnterior.ganhoFaixa.gain.value, agora);
      sessaoAnterior.ganhoFaixa.gain.linearRampToValueAtTime(0, agora + CROSSFADE_TROCA_S);
    }

    void carregar(ctx, id).then((buffer) => {
      if (idDesejado !== id || !buffer) return; // pedido ficou velho, ou o arquivo falhou (fica em silêncio: fallback sintetizado assume).
      const ganhoFaixa = ctx.createGain();
      ganhoFaixa.gain.value = 0;
      ganhoFaixa.connect(ganho);
      const sessao: Sessao = { id, cancelada: false, ganhoFaixa };
      sessaoAtual = sessao;
      const agora = ctx.currentTime;
      ganhoFaixa.gain.setValueAtTime(0, agora);
      ganhoFaixa.gain.linearRampToValueAtTime(1, agora + CROSSFADE_TROCA_S);
      encadearLoop(sessao, ctx, ganhoFaixa, buffer, agora);
    });
  }

  function tocar(id: string): void {
    if (idDesejado === id) return; // já é o desejado (tocando, carregando, ou esperando o 1º gesto) — nada a fazer.
    idDesejado = id;
    tentarIniciar();
  }

  function precarregar(id: string): void {
    const ctx = contexto(audio);
    if (!ctx) return;
    void carregar(ctx, id);
  }

  function atualizar(): void {
    tentarIniciar();
    const ctx = contexto(audio);
    if (!ctx || !ganhoMestre) return;
    const v = opcoes.obterVolumeMusica();
    const base = Number.isFinite(v) && v > 0 ? Math.min(v, 1) : 0;
    const alvo = duckAtivo ? base * FATOR_DUCK : base;
    const agora = ctx.currentTime;
    ganhoMestre.gain.setValueAtTime(ganhoMestre.gain.value, agora);
    ganhoMestre.gain.linearRampToValueAtTime(alvo, agora + RAMPA_GANHO_S);
  }

  function ducar(ativo: boolean): void {
    duckAtivo = ativo;
  }

  function parar(): void {
    idDesejado = null;
    idIniciado = null;
    const ctx = contexto(audio);
    const sessao = sessaoAtual;
    sessaoAtual = null;
    if (!ctx || !sessao) return;
    sessao.cancelada = true;
    const agora = ctx.currentTime;
    sessao.ganhoFaixa.gain.setValueAtTime(sessao.ganhoFaixa.gain.value, agora);
    sessao.ganhoFaixa.gain.linearRampToValueAtTime(0, agora + CROSSFADE_TROCA_S);
  }

  function estaTocando(): string | null {
    return sessaoAtual && !sessaoAtual.cancelada ? sessaoAtual.id : null;
  }

  return { tocar, precarregar, atualizar, ducar, parar, estaTocando };
}
