/**
 * Laço de passo fixo (plano §3.2): acumulador com teto, sem relógio de parede no núcleo. O relógio ENTRA POR PARÂMETRO:
 * quem chama (main.ts, no `requestAnimationFrame`) passa o timestamp em milissegundos; o teste passa um relógio
 * sintético. Assim o mesmo código roda no navegador, no Node e na simulação sem `Date`, `performance` nem timers.
 *
 * Origem do padrão: laço do InnoFighters (src/main.ts), extraído e tornado puro/testável em 2026-10-22.
 *
 * Contrato:
 *  - cada tick executa `passo(tick)` UMA vez, com `tick` = 0, 1, 2, ... (contador próprio do laço, nunca repete nem pula);
 *  - o acumulador nunca passa de `maxAcumuladoMs` (padrão 100): depois de aba parada o jogo NÃO salta, descarta o
 *    excesso; no máximo `MAX_PASSOS_POR_QUADRO` (6) ticks por chamada;
 *  - relógio que anda para trás (ou valor não finito) não gera ticks: o quadro é ignorado (não finito) ou a referência
 *    é reposta (para trás), sem lançar no meio do jogo;
 *  - `alfa()` é a fração do próximo tick já decorrida (0 a 1), para o render interpolar se quiser.
 */
import { ACUMULADOR_MAX_MS, PASSO_MS } from './constantes';
import { ErroDeContrato } from './erros';

export interface OpcoesLaco {
  /** Duração de um tick, ms. Padrão 1000/60. */
  readonly passoMs?: number;
  /** Teto do acumulador, ms. Padrão 100. Precisa ser >= passoMs. */
  readonly maxAcumuladoMs?: number;
}

export interface LacoFixo {
  /**
   * Avança com o instante `agoraMs` (ms, relógio monotônico qualquer; só a diferença importa). Executa `passo` zero ou
   * mais vezes e devolve quantos ticks rodaram. A primeira chamada só marca a referência (devolve 0).
   */
  quadro(agoraMs: number, passo: (tick: number) => void): number;
  /** Fração do próximo tick já acumulada, de 0 (incluso) a 1 (excluso). */
  alfa(): number;
  /** Ticks executados desde a criação. */
  ticks(): number;
  /**
   * Zera o acumulador e marca nova referência (use ao retomar de pausa/aba escondida, para o tempo parado não contar).
   * Sem argumento, a próxima chamada de `quadro` volta a ser "a primeira".
   */
  reiniciar(agoraMs?: number): void;
}

/** Folga numérica (ms) para um quadro de exatos 16,666… ms não perder o tick por erro de arredondamento. */
const FOLGA_MS = 1e-6;

export function criarLaco(opcoes: OpcoesLaco = {}): LacoFixo {
  const passoMs = opcoes.passoMs ?? PASSO_MS;
  const maxMs = opcoes.maxAcumuladoMs ?? ACUMULADOR_MAX_MS;
  if (!Number.isFinite(passoMs) || passoMs <= 0) throw new ErroDeContrato('laco-invalido', 'passoMs precisa ser finito e > 0', [String(passoMs)]);
  if (!Number.isFinite(maxMs) || maxMs < passoMs) throw new ErroDeContrato('laco-invalido', 'maxAcumuladoMs precisa ser finito e >= passoMs', [String(maxMs)]);

  let referencia: number | null = null;
  let acumulado = 0;
  let total = 0;

  return {
    quadro(agoraMs, passo) {
      if (!Number.isFinite(agoraMs)) return 0;
      if (referencia === null) {
        referencia = agoraMs;
        return 0;
      }
      const delta = agoraMs - referencia;
      referencia = agoraMs;
      if (delta <= 0) return 0; // relógio parado ou para trás: nada a rodar, e a referência já foi reposta
      acumulado = Math.min(acumulado + delta, maxMs);
      let rodou = 0;
      while (acumulado + FOLGA_MS >= passoMs) {
        acumulado = Math.max(0, acumulado - passoMs);
        passo(total);
        total++;
        rodou++;
      }
      return rodou;
    },
    alfa: () => acumulado / passoMs, // sempre < 1: o laço consome todo tick inteiro antes de devolver
    ticks: () => total,
    reiniciar(agoraMs) {
      acumulado = 0;
      referencia = agoraMs !== undefined && Number.isFinite(agoraMs) ? agoraMs : null;
    },
  };
}
