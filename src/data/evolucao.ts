/**
 * Economia de evolução entre campeonatos (`docs/plano-corrida-campeonato.md` §Arquitetura/C-D3/C-D4, C5a): custo em
 * flocos de cada nível, e a conversão do resultado de uma corrida em flocos ganhos (`ResultadoCorrida.flocosGanhos`,
 * hoje fixo em `0` em `corrida/corrida.ts` — Vega conecta `flocosDaCorrida` lá quando fizer sentido, C6).
 *
 * Camada por cima da ficha (plano C-D3): "atributo efetivo = ficha + nível×passo (~+3/nível, até 5)". É UM nível
 * por personagem, não um por atributo: `Evolucao.niveis` (`core/contratos.ts`) já fixa isso como
 * `Partial<Record<IdPersonagem, number>>`, um único inteiro — `ATRIBUTOS_EVOLUCAO` é só para a UI (oficina, C5b/C6)
 * listar o que aquele nível melhora. `aplicarEvolucao` (C6, Vega, `descida/atributos.ts`) é quem de fato soma o
 * passo na ficha — NUNCA aqui: este arquivo não tem física, só números e a carteira.
 *
 * `data/` só importa `core/` (plano §3.1): os TIPOS do save (`Evolucao`, `ResultadoCorrida`) vêm de lá.
 */
import type { Evolucao, IdPersonagem, ResultadoCorrida } from '../core/contratos';
import { ErroDeContrato } from '../core/erros';

/** Os 3 atributos que a evolução melhora (plano C-D4: "Velocidade, Equilíbrio, Força (pulo+embalo). Giro fora"). */
export const ATRIBUTOS_EVOLUCAO = ['velocidade', 'equilibrio', 'forca'] as const;
export type AtributoEvolucao = (typeof ATRIBUTOS_EVOLUCAO)[number];

/** Nível máximo por personagem (plano C-D3: "até 5 níveis"). Mesmo valor de `meta/storage.ts` → `TETO_NIVEL_EVOLUCAO`. */
export const NIVEL_MAXIMO_EVOLUCAO = 5;
/** Ganho por nível em cada um dos 3 atributos (plano C-D3: "~+3/nível"). Aplicar é `aplicarEvolucao` (C6, Vega). */
export const PASSO_ATRIBUTO_POR_NIVEL = 3;

/** Custo em flocos do nível N (índice 0 = nível 1); crescente, para o nível 5 custar bem mais que o 1. Calibração inicial (plano C7 ajusta no campeonato real). */
const CUSTO_POR_NIVEL: readonly number[] = [10, 20, 35, 55, 80];

/** Custo em flocos para ir do nível `nivel - 1` ATÉ `nivel` (1..`NIVEL_MAXIMO_EVOLUCAO`). Fora da faixa: `undefined`. */
export function custoDoNivel(nivel: number): number | undefined {
  return Number.isInteger(nivel) && nivel >= 1 && nivel <= NIVEL_MAXIMO_EVOLUCAO ? CUSTO_POR_NIVEL[nivel - 1] : undefined;
}

/**
 * Soma dos custos para ir de `nivelAtual` até `nivelAlvo` (ambos 0..`NIVEL_MAXIMO_EVOLUCAO`). `0` se
 * `nivelAlvo <= nivelAtual`. `undefined` se algum dos dois estiver fora da faixa.
 */
export function custoAcumulado(nivelAtual: number, nivelAlvo: number): number | undefined {
  if (!Number.isInteger(nivelAtual) || nivelAtual < 0 || nivelAtual > NIVEL_MAXIMO_EVOLUCAO) return undefined;
  if (!Number.isInteger(nivelAlvo) || nivelAlvo < 0 || nivelAlvo > NIVEL_MAXIMO_EVOLUCAO) return undefined;
  let soma = 0;
  for (let n = nivelAtual + 1; n <= nivelAlvo; n++) soma += custoDoNivel(n) as number;
  return soma;
}

export interface ResultadoCompra {
  readonly evolucao: Evolucao;
  readonly comprou: boolean;
}

/**
 * Sobe UM nível o personagem, se houver flocos (carteira ÚNICA, plano C-D4) e espaço (nível < `NIVEL_MAXIMO_EVOLUCAO`).
 * Pura: nunca lança, nunca muta `evolucao`. Sem flocos, ou já no teto: devolve `comprou: false` com `evolucao` intacta.
 */
export function comprarNivel(evolucao: Evolucao, personagem: IdPersonagem): ResultadoCompra {
  const nivelAtual = evolucao.niveis[personagem] ?? 0;
  const custo = custoDoNivel(nivelAtual + 1);
  if (custo === undefined || evolucao.flocos < custo) return { evolucao, comprou: false };
  return {
    evolucao: { flocos: evolucao.flocos - custo, niveis: { ...evolucao.niveis, [personagem]: nivelAtual + 1 } },
    comprou: true,
  };
}

/** 1 floco a cada N pontos da descida (`ResumoDescida.pontos`, que já inclui os pontos de manobra — o contrato não os separa). Calibração inicial (plano C7 ajusta). */
export const FLOCOS_POR_PONTOS = 200;
/**
 * Bônus de flocos pelo pódio da pista (1º..6º); fora da faixa = 0. Tabela PRÓPRIA (não a `pontosDaPosicao` de
 * `meta/campeonato.ts`): `data/` não importa `meta/` (não cruza camada, plano §3.1).
 */
const BONUS_PODIO_FLOCOS: readonly number[] = [8, 6, 4, 2, 1, 0];

/**
 * Flocos ganhos numa pista da corrida (plano §Arquitetura: "pontos de manobra convertidos... e o pódio" — os
 * coletáveis e os 3 objetivos/pista entram por outro canal, ainda não implementado, C3/C6). Quem liga isto a
 * `ResultadoCorrida.flocosGanhos` é `corrida/corrida.ts` (Vega — hoje fixo em `0`, comentário lá aponta pra aqui).
 * Não concluiu a descida (`resumoJogador.concluiu === false`) = 0, mesmo tendo pontuado antes de cair.
 */
export function flocosDaCorrida(resultado: ResultadoCorrida, jogador: IdPersonagem): number {
  const resumo = resultado.resumoJogador;
  if (!resumo.concluiu) return 0;
  const posicao = resultado.ordem.indexOf(jogador) + 1;
  const bonus = posicao >= 1 && posicao <= BONUS_PODIO_FLOCOS.length ? (BONUS_PODIO_FLOCOS[posicao - 1] as number) : 0;
  return Math.floor(resumo.pontos / FLOCOS_POR_PONTOS) + bonus;
}

function problemasDaEconomiaDeEvolucao(): string[] {
  const p: string[] = [];
  if (CUSTO_POR_NIVEL.length !== NIVEL_MAXIMO_EVOLUCAO) {
    p.push(`CUSTO_POR_NIVEL: precisa ter ${NIVEL_MAXIMO_EVOLUCAO} entradas, tem ${CUSTO_POR_NIVEL.length}`);
  }
  for (let i = 0; i < CUSTO_POR_NIVEL.length; i++) {
    const custo = CUSTO_POR_NIVEL[i] as number;
    if (!Number.isInteger(custo) || custo <= 0) p.push(`CUSTO_POR_NIVEL[${i}] (nível ${i + 1}) = ${custo}, precisa ser inteiro > 0`);
    if (i > 0 && custo <= (CUSTO_POR_NIVEL[i - 1] as number)) p.push(`CUSTO_POR_NIVEL[${i}] (nível ${i + 1}) não é maior que o nível anterior`);
  }
  if (BONUS_PODIO_FLOCOS.length !== 6) p.push(`BONUS_PODIO_FLOCOS: precisa ter 6 entradas (1 por corredor), tem ${BONUS_PODIO_FLOCOS.length}`);
  return p;
}

/** Lança `ErroDeContrato` se a tabela de custos/bônus estiver mal formada (boot com tela de erro clara). */
export function exigirEconomiaDeEvolucaoValida(): void {
  const problemas = problemasDaEconomiaDeEvolucao();
  if (problemas.length > 0) throw new ErroDeContrato('contrato-invalido', 'economia de evolução (data/evolucao.ts) inválida', problemas);
}

exigirEconomiaDeEvolucaoValida();
