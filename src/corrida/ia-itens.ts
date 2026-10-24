/**
 * IA de itens da corrida (plano `docs/plano-itens-corrida.md` §Fases, I3): QUANDO um rival usa o item que já está
 * no slot, e quando ele pula pra desviar de uma Bola de Neve/Poça de Calda vindo na direção dele (Nuvem de Granizo
 * NUNCA entra aqui — plano I-D2, "casco azul", só o escudo defende). Determinístico e SEM ESTADO, mesma convenção
 * de `corrida/ia.ts` (giro no ar) e `corrida/itens.ts` (sorteio): nenhum `Rng` guardado entre ticks, só
 * `hashSorteio01(semente, id, tick)` (`data/itens.ts`, documentado ali como "reaproveitável por
 * `corrida/ia-itens.ts` passando o tick como chave").
 *
 * Catch-up (plano I-D1, "leve e simétrico") já vive INTEIRO nos pesos do sorteio (`data/itens.ts`,
 * `pesosDeSorteioPorPosicao`) — este módulo não dá NENHUMA vantagem extra por posição na hora de decidir usar: dar
 * mais chance de usar pra quem está atrás seria um rubber-band escondido, e o dono travou "mesma regra pro jogador
 * e pra IA, sem trapaça". O que varia aqui é só a PERSONALIDADE (`ousadia`, mesmo catálogo do manobreiro/cuidadoso,
 * `corrida/ia.ts`) e a dificuldade por PISTA (plano I-D9: "pistas 1-2 usa itens com menos agressividade").
 */
import type { IdPersonagem, PilotoLeitura, TipoItem } from '../core/contratos';
import { hashSorteio01 } from '../data/itens';

/** Mesmo catálogo de `corrida/ia.ts` (`PerfilIA.ousadia`) — sem importar daquele módulo pra não criar ciclo
 *  (`corrida/corrida.ts` já importa os dois; este arquivo fica independente de `ia.ts`). */
export type OusadiaIA = 0 | 1 | 2;

/**
 * Multiplicador de agressividade por `DefPista.ordem` (plano I-D9): pistas 1-2 usam item com metade da frequência
 * (dificuldade crescente); 3-5 usam cheio. `ordem` indefinido (treino/teste sem `def`) cai no cheio — mesmo padrão
 * de "omitido = comportamento de hoje" do resto do projeto.
 */
export function agressividadePorPistaOrdem(ordem: number | undefined): number {
  return ordem === 1 || ordem === 2 ? 0.5 : 1;
}

/**
 * Chance-base POR TICK de usar o item que já está no slot, por tipo (turbo/ima são buff puro do próprio corredor,
 * usa mais rápido; bola/poça/nuvem são ofensivos, mais contidos; escudo tem prioridade reativa própria — ver
 * `decidirUsoItemIA`, a chance aqui é só o "baseline" de não deixar o slot ocupado pra sempre, o que travaria
 * caixas novas: `corrida/itens.ts` não reamostra o slot ocupado).
 */
const CHANCE_BASE_POR_TICK: Readonly<Record<TipoItem, number>> = {
  turbo: 0.12,
  ima: 0.08,
  bola: 0.05,
  poca: 0.05,
  nuvem: 0.05,
  escudo: 0.04,
};

export interface ContextoUsoItemIA {
  readonly semente: number;
  readonly id: IdPersonagem;
  readonly tick: number;
  readonly ousadia: OusadiaIA;
  /** `agressividadePorPistaOrdem(def?.ordem)`, calculado 1x por corrida em `corrida/corrida.ts`. */
  readonly agressividadePista: number;
  /** Item no slot agora, ou `null` com o slot vazio (nunca decide usar nada). */
  readonly item: TipoItem | null;
  readonly escudoAtivo: boolean;
  /** Alvo de uma Nuvem de Granizo com aviso contando (`OrquestradorItens.alvoDeNuvemAtiva`). */
  readonly alvoDeNuvemAtiva: boolean;
  /** Existe algum rival `'descendo'` estritamente na frente — bola sem ninguém pra acertar é jogar fora. */
  readonly existeRivalNaFrente: boolean;
}

/**
 * Decide se `ctx.id` usa o item do slot NESTE tick. Determinístico: mesma `(semente, id, tick)` => mesma decisão,
 * em qualquer ordem de chamada (nenhum estado entre ticks).
 *  - sem item no slot: nunca.
 *  - Bolha de Gelo (escudo): prioridade REATIVA — usa na hora se for alvo de nuvem e ainda sem escudo ativo (plano
 *    I-D2: "só o escudo defende"); fora disso, só a chance-base (ignora `ousadia`/pista — defesa não é agressão).
 *  - Bola de Neve: só entra na chance-base se existir alguém na frente pra acertar.
 *  - demais itens: chance-base * personalidade (`ousadia`) * dificuldade da pista (I-D9).
 */
export function decidirUsoItemIA(ctx: ContextoUsoItemIA): boolean {
  if (ctx.item === null) return false;
  const sorteio = hashSorteio01(ctx.semente, ctx.id, ctx.tick);
  if (ctx.item === 'escudo') {
    if (ctx.alvoDeNuvemAtiva && !ctx.escudoAtivo) return true;
    return sorteio < CHANCE_BASE_POR_TICK.escudo;
  }
  if (ctx.item === 'bola' && !ctx.existeRivalNaFrente) return false;
  const multiplicadorOusadia = 0.6 + ctx.ousadia * 0.3; // 0 -> 0.6x, 1 -> 0.9x, 2 -> 1.2x (mesma escala de risco do C-D5).
  const chance = Math.min(0.95, CHANCE_BASE_POR_TICK[ctx.item] * multiplicadorOusadia * ctx.agressividadePista);
  return sorteio < chance;
}

// --- Desvio reativo (plano: "pular bola/poça"; nuvem NUNCA aqui, ver cabeçalho do arquivo) ---

/** Metros de folga pra começar a saltar: generosa de propósito (plano §Determinismo, fase 1 só vê o retrato do
 *  tick ANTERIOR — pular tarde demais deixaria o salto surtir efeito só depois da colisão já resolvida). */
const LIMIAR_DESVIO_BOLA_M = 4;
const LIMIAR_DESVIO_POCA_M = 5;

export interface AmeacasIA {
  /** x da Bola de Neve que mira ESTE corredor (`OrquestradorItens.ameacaBolaPara`), ou `null` sem nenhuma — só o
   *  ALVO de uma bola corre risco (plano: "rola e acerta o 1º rival à frente"), ninguém mais. */
  readonly bolaAlvoX: number | null;
  /** x de cada Poça de Calda visível (`OrquestradorItens.entidadesVisiveis`, tipo `'poca'`) — ela ameaça QUALQUER
   *  um que passe por cima, não só um alvo escolhido. */
  readonly pocasX: readonly number[];
}

/**
 * `true` se o corredor deve pular ESTE tick pra desviar (plano: "pular bola/poça"). Só no chão (no ar/trilho o
 * salto não ajuda, ou ele já está desviando de outra coisa); quem chama decide como aplicar (forçar `pulo:true`
 * por cima do comando normal da IA — nunca o contrário, nunca cancela um pulo que já ia acontecer).
 */
export function devePularPraDesviar(piloto: Pick<PilotoLeitura, 'x' | 'modo'>, ameacas: AmeacasIA): boolean {
  if (piloto.modo !== 'chao') return false;
  if (ameacas.bolaAlvoX !== null) {
    const gap = piloto.x - ameacas.bolaAlvoX; // a bola vem de TRÁS (parte de quem está atrás do alvo).
    if (gap >= 0 && gap <= LIMIAR_DESVIO_BOLA_M) return true;
  }
  for (const pocaX of ameacas.pocasX) {
    const gap = pocaX - piloto.x; // a poça fica parada; o corredor se aproxima PELA FRENTE.
    if (gap >= 0 && gap <= LIMIAR_DESVIO_POCA_M) return true;
  }
  return false;
}
