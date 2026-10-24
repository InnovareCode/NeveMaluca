/**
 * Campeonato (`docs/plano-corrida-campeonato.md` §Arquitetura, C5a): pontuação, classificação, situação e
 * desempate. Puro, sem I/O — `meta/storage.ts` só guarda o `EstadoCampeonato` (save); este arquivo decide o que
 * ele SIGNIFICA.
 *
 * `classificacao` nunca lê um total guardado: soma `pontosDaPosicao` a partir do `ordem` (ranking completo, do 1º
 * ao último) de CADA `ResultadoCorrida` recebido (plano C-D1: "a classificação é sempre derivada daqui"). Um total
 * persistido seria mais um lugar para o save mentir; o `ordem` de cada corrida já é a fonte da verdade.
 *
 * PENDÊNCIA (para o Atlas/dono decidir): `EstadoCampeonato.pistasConcluidas` (`core/contratos.ts`, o que o save
 * guarda) só tem a posição do JOGADOR por pista (`PistaConcluidaCampeonato.ordem: number`) — não o `ordem`
 * completo dos 6. `classificacao`/`situacao` aqui operam sobre `ResultadoCorrida[]` (o dado rico da corrida, em
 * memória durante a sessão). Fechar o app NO MEIO de um campeonato e reabrir não dá, hoje, para recalcular os
 * pontos dos 5 adversários a partir só do save — falta decidir se vale a pena persistir o `ResultadoCorrida`
 * inteiro de cada pista concluída, ou se "situacao() exata" é só-nesta-sessão por desenho.
 */
import type { EstadoCampeonato, IdPersonagem, PistaConcluidaCampeonato, ResultadoCorrida } from '../core/contratos';

/** 10/8/6/4/2/1 (plano C-D1), posição 1 = 1º lugar. */
const TABELA_PONTOS: readonly number[] = [10, 8, 6, 4, 2, 1];

/** Pontos de uma posição de chegada (1 = 1º). Fora de 1..6, ou não inteiro: 0. */
export function pontosDaPosicao(posicao: number): number {
  return Number.isInteger(posicao) && posicao >= 1 && posicao <= TABELA_PONTOS.length ? (TABELA_PONTOS[posicao - 1] as number) : 0;
}

export interface ClassificacaoItem {
  readonly id: IdPersonagem;
  readonly pontos: number;
  readonly vitorias: number;
  /** Posição na ÚLTIMA pista de `resultados` (critério de desempate, plano C-D1). */
  readonly ultimaPosicao: number;
}

/** Mais pontos primeiro; empatado em pontos, mais vitórias; ainda empatado, melhor (menor) `ultimaPosicao` (plano C-D1). */
export function desempate(a: ClassificacaoItem, b: ClassificacaoItem): number {
  if (a.pontos !== b.pontos) return b.pontos - a.pontos;
  if (a.vitorias !== b.vitorias) return b.vitorias - a.vitorias;
  return a.ultimaPosicao - b.ultimaPosicao;
}

/**
 * Classificação do campeonato até aqui, derivada do `ordem` de cada `ResultadoCorrida` (nunca um total guardado).
 * `resultados` na ordem em que as pistas foram corridas — a última da lista é "a última pista" do desempate.
 */
export function classificacao(resultados: readonly ResultadoCorrida[]): readonly ClassificacaoItem[] {
  const pontos = new Map<IdPersonagem, number>();
  const vitorias = new Map<IdPersonagem, number>();
  const ultimaPosicao = new Map<IdPersonagem, number>();
  for (const resultado of resultados) {
    resultado.ordem.forEach((id, indice) => {
      const posicao = indice + 1;
      pontos.set(id, (pontos.get(id) ?? 0) + pontosDaPosicao(posicao));
      if (posicao === 1) vitorias.set(id, (vitorias.get(id) ?? 0) + 1);
      ultimaPosicao.set(id, posicao);
    });
  }
  const itens = [...pontos.keys()].map(
    (id): ClassificacaoItem => ({
      id,
      pontos: pontos.get(id) ?? 0,
      vitorias: vitorias.get(id) ?? 0,
      ultimaPosicao: ultimaPosicao.get(id) ?? 0,
    }),
  );
  return itens.sort(desempate);
}

export const SITUACOES_CAMPEONATO = ['andamento', 'vencido', 'perdido'] as const;
export type SituacaoCampeonato = (typeof SITUACOES_CAMPEONATO)[number];

/**
 * `'andamento'` enquanto faltar pista (`resultados.length < totalPistas`); ao final, `'vencido'` só se o total do
 * jogador for MAIOR que o de CADA um dos adversários (plano C-D1: "vence quem tiver total > cada um dos 5" —
 * empate em pontos não é vitória), senão `'perdido'`.
 */
export function situacao(resultados: readonly ResultadoCorrida[], jogador: IdPersonagem, totalPistas = 5): SituacaoCampeonato {
  if (resultados.length < totalPistas) return 'andamento';
  const tabela = classificacao(resultados);
  const pontosJogador = tabela.find((c) => c.id === jogador)?.pontos ?? 0;
  const venceuTodos = tabela.every((c) => c.id === jogador || c.pontos < pontosJogador);
  return venceuTodos ? 'vencido' : 'perdido';
}

/** Novo campeonato, etapa 0 (nenhuma pista corrida ainda). Pura. */
export function iniciarCampeonato(semente: number, personagem: IdPersonagem): EstadoCampeonato {
  return { semente, personagem, etapa: 0, pistasConcluidas: [] };
}

/**
 * Registra o resultado de UMA pista no `EstadoCampeonato` (avança a etapa). Só grava a posição do JOGADOR
 * (`PistaConcluidaCampeonato` — ver a pendência no topo do arquivo sobre o que isso implica entre sessões). Pura:
 * devolve um estado novo, nunca muta `estado`.
 */
export function registrarResultado(estado: EstadoCampeonato, resultado: ResultadoCorrida, jogador: IdPersonagem): EstadoCampeonato {
  const posicao = resultado.ordem.indexOf(jogador) + 1;
  const pista: PistaConcluidaCampeonato = { pista: resultado.pista, ordem: posicao, ticks: resultado.ticks[jogador] ?? 0 };
  const pistasConcluidas = [...estado.pistasConcluidas, pista];
  const etapa = Math.min(5, pistasConcluidas.length) as EstadoCampeonato['etapa'];
  return { ...estado, pistasConcluidas, etapa };
}
