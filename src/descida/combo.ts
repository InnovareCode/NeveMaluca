/**
 * Máquina de combo do M2 (plano §3.5), PURA e determinística — sem relógio, sem RNG, só `+ - * /` e `Math` permitido.
 * O `descida/motor.ts` alimenta as manobras feitas no voo (commitadas num pouso bom), tica a janela de ligação no
 * chão, fecha quando a janela acaba e perde tudo no tombo. A `ComboLeitura` (C3) que vai pra tela sai de `leituraCombo`.
 *
 * Regra (plano §3.5): abre na 1ª manobra; continua enquanto o piloto pular de novo dentro de `JANELA_LIGACAO_TICKS`
 * depois de um pouso; `mult = 1 + famílias distintas` (teto `MULT_TETO`); repetir a MESMA família vale 50%, depois 25%;
 * fecha somando `soma * mult` à pontuação; perde tudo (nada soma) no tombo.
 */
import type { ComboLeitura, IdManobra } from '../core/contratos';
import {
  FATOR_REPETICAO,
  JANELA_LIGACAO_TICKS,
  MULT_TETO,
  TETO_PONTOS,
  type FamiliaManobra,
} from '../data/manobras';

/** Uma manobra concluída, pronta para entrar no combo. `pontos` já traz o bônus de estilo aplicado. */
export interface ManobraFeita {
  readonly id: IdManobra;
  readonly familia: FamiliaManobra;
  readonly pontos: number;
}

export interface EstadoCombo {
  ativo: boolean;
  manobras: IdManobra[];
  familias: FamiliaManobra[];
  /** Soma dos pontos-base (já com desconto de repetição), antes do multiplicador. */
  soma: number;
  /** Ticks restantes da janela de ligação (0 = fechada/sem janela aberta). */
  janela: number;
}

export function comboInicial(): EstadoCombo {
  return { ativo: false, manobras: [], familias: [], soma: 0, janela: 0 };
}

function familiasDistintas(c: EstadoCombo): number {
  const vistas: FamiliaManobra[] = [];
  for (const f of c.familias) if (!vistas.includes(f)) vistas.push(f);
  return vistas.length;
}

/** Multiplicador atual: 1 + famílias distintas, com teto. */
export function multiplicador(c: EstadoCombo): number {
  const m = 1 + familiasDistintas(c);
  return m > MULT_TETO ? MULT_TETO : m;
}

/** Adiciona uma manobra, aplicando o desconto de repetição da MESMA família. Devolve os pontos efetivos somados. */
export function adicionarManobra(c: EstadoCombo, m: ManobraFeita): number {
  let repeticoes = 0;
  for (const f of c.familias) if (f === m.familia) repeticoes++;
  const idx = repeticoes < FATOR_REPETICAO.length ? repeticoes : FATOR_REPETICAO.length - 1;
  const fator = FATOR_REPETICAO[idx] as number;
  const efetivo = Math.round(m.pontos * fator);
  c.manobras.push(m.id);
  c.familias.push(m.familia);
  c.soma += efetivo;
  c.ativo = true;
  return efetivo;
}

/** Abre a janela de ligação (chamado num pouso bom): o próximo pulo dentro dela continua o combo. */
export function abrirJanela(c: EstadoCombo): void {
  c.janela = JANELA_LIGACAO_TICKS;
}

/** Um tick no chão sem pular: consome a janela de ligação. */
export function tiqueJanela(c: EstadoCombo): void {
  if (c.janela > 0) c.janela--;
}

/** O combo fecha quando está ativo e a janela de ligação esgotou. */
export function deveFechar(c: EstadoCombo): boolean {
  return c.ativo && c.janela <= 0;
}

/** Fecha o combo: `total = soma * mult` (com teto de pontos). Devolve o resumo e ZERA o estado. */
export function fechar(c: EstadoCombo): { soma: number; mult: number; total: number } {
  const mult = multiplicador(c);
  const soma = c.soma;
  let total = soma * mult;
  if (total > TETO_PONTOS) total = TETO_PONTOS;
  zerar(c);
  return { soma, mult, total };
}

/** Perde o combo (tombo): nada vai para a pontuação. Devolve a soma perdida e ZERA. */
export function perder(c: EstadoCombo): { soma: number } {
  const soma = c.soma;
  zerar(c);
  return { soma };
}

function zerar(c: EstadoCombo): void {
  c.ativo = false;
  c.manobras = [];
  c.familias = [];
  c.soma = 0;
  c.janela = 0;
}

/** Projeção C3 (`LeituraDescida.combo`) do estado atual, com cópia dos arrays (o motor nunca entrega estado vivo). */
export function leituraCombo(c: EstadoCombo): ComboLeitura {
  return {
    ativo: c.ativo,
    manobras: c.manobras.slice(),
    soma: c.soma,
    mult: multiplicador(c),
    janela: c.janela,
  };
}
