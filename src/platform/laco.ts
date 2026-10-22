/**
 * Laço do jogo: passo fixo com acumulador (plano §3.2) sobre `requestAnimationFrame`.
 *
 * FONTE ÚNICA DE TICKS POR QUADRO: `core/laco.ts` (`criarLaco().quadro(carimbo, passo)`). Este arquivo só acrescenta o que é da
 * plataforma: agenda o próprio `requestAnimationFrame`, pausa por motivo e parada no primeiro erro. A conta do acumulador, o
 * teto (`ACUMULADOR_MAX_MS`, no máximo 6 ticks por quadro) e a folga numérica são do core.
 *
 * Por quê (QA da Íris, pós-M0, 2026-10-22; medido com relógio sintético em `tests/unit/integracao-m0.test.ts`). A versão anterior
 * deste arquivo tinha conta própria (limitava o DELTA de cada quadro a 100 ms; o core limita o ACUMULADOR) e sem folga numérica:
 *  - 60 Hz exatos por 60 s: 3599 ticks em 3600 quadros, com quadros de 0 e de 2 ticks (o core: 3600, um por quadro);
 *  - 600 quadros fixos de 95 ms: 3419 ticks na platform contra 3300 no core;
 *  - jitter 95, 1, 95, 1 ms: divergência de 130 ticks entre os dois;
 *  - teto de 6 ticks por quadro: igual nos dois.
 * Decisão: o M1 e o replay contam ticks pelo core; ter duas contas era risco de divergência entre o jogo e o replay.
 * `tests/unit/integracao-m0.test.ts` ainda compara os dois e agora exige igualdade exata em 60 Hz.
 *
 * Tempo: só o carimbo que o `requestAnimationFrame` entrega (nada de `Date.now`/`performance.now` aqui). `atualizar()` roda 0, 1 ou
 * mais vezes por quadro conforme o tempo acumulado; `desenhar(alpha)` recebe a fração (0 a 1) do próximo tick já decorrida, para a
 * cena interpolar. O acumulador é limitado a ACUMULADOR_MAXIMO_MS: aba parada ou quadro lento não vira salto de simulação.
 *
 * Pausa por MOTIVO ('foco', 'oculta', 'retrato'...): o laço só anda sem nenhum motivo ativo. Pausado, não agenda quadros (poupa
 * bateria); ao retomar, o primeiro quadro não acumula o tempo parado.
 */
import { criarLaco as criarLacoFixo } from '../core/laco';
import { ACUMULADOR_MAXIMO_MS, PASSO_MS } from './constantes';

export interface OpcoesDoLaco {
  /** Um tick da simulação (passo fixo). */
  atualizar(): void;
  /** Um quadro de tela; `alpha` em [0, 1) = quanto do próximo tick já passou. */
  desenhar(alpha: number): void;
  readonly passoMs?: number;
  readonly acumuladorMaximoMs?: number;
  /** Injetáveis nos testes (padrão: requestAnimationFrame / cancelAnimationFrame). */
  readonly agendar?: (cb: (carimbo: number) => void) => number;
  readonly cancelar?: (id: number) => void;
  /** Exceção em `atualizar`/`desenhar`: o laço PARA (não repete o erro 60 vezes por segundo) e avisa aqui. Sem isto, relança. */
  readonly aoErro?: (erro: unknown) => void;
}

export interface Laco {
  /** Começa (ou continua, se foi pausado). Chamar de novo é inofensivo. */
  iniciar(): void;
  /** Para de vez (sem motivo de pausa). */
  parar(): void;
  /** Liga um motivo de pausa. Idempotente por motivo. */
  pausar(motivo: string): void;
  /** Desliga um motivo; o laço volta quando o último motivo sai. */
  retomar(motivo: string): void;
  readonly pausado: boolean;
  readonly motivosDePausa: readonly string[];
  readonly rodando: boolean;
  /** Ticks de simulação desde o início. */
  readonly ticks: number;
  /** Quadros de tela desenhados desde o início. */
  readonly quadros: number;
}

export function criarLaco(opcoes: OpcoesDoLaco): Laco {
  const passo = opcoes.passoMs ?? PASSO_MS;
  const maximo = opcoes.acumuladorMaximoMs ?? ACUMULADOR_MAXIMO_MS;
  const agendar = opcoes.agendar ?? ((cb: (carimbo: number) => void): number => requestAnimationFrame(cb));
  const cancelar = opcoes.cancelar ?? ((id: number): void => cancelAnimationFrame(id));

  // a conta de ticks por quadro (acumulador, teto, folga) é do core; aqui só se agenda, pausa e para no erro
  const fixo = criarLacoFixo({ passoMs: passo, maxAcumuladoMs: maximo });
  const motivos = new Set<string>();
  let iniciado = false;
  let id: number | null = null;
  let quadros = 0;

  const quadro = (carimbo: number): void => {
    id = null;
    try {
      fixo.quadro(carimbo, () => opcoes.atualizar());
      opcoes.desenhar(fixo.alfa());
      quadros += 1;
    } catch (e) {
      iniciado = false;
      fixo.reiniciar();
      if (!opcoes.aoErro) throw e;
      opcoes.aoErro(e);
      return;
    }
    continuar();
  };

  function continuar(): void {
    if (iniciado && motivos.size === 0 && id === null) id = agendar(quadro);
  }

  function suspender(): void {
    if (id !== null) cancelar(id);
    id = null;
    fixo.reiniciar(); // a volta não acumula o tempo parado: o próximo quadro só marca a referência
  }

  return {
    iniciar() {
      iniciado = true;
      continuar();
    },
    parar() {
      iniciado = false;
      suspender();
    },
    pausar(motivo) {
      motivos.add(motivo);
      suspender();
    },
    retomar(motivo) {
      motivos.delete(motivo);
      continuar();
    },
    get pausado() {
      return motivos.size > 0;
    },
    get motivosDePausa() {
      return [...motivos];
    },
    get rodando() {
      return iniciado && motivos.size === 0;
    },
    get ticks() {
      return fixo.ticks();
    },
    get quadros() {
      return quadros;
    },
  };
}
