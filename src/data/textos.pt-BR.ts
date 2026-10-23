/**
 * Nomes cômicos das manobras e do fechamento de combo (M2, pilar 3 do plano: humor). Dono do texto: Apolo.
 * Texto pt-BR (D6), caixa alta (callout em Bangers, direção de arte §5.7), curto: cabe no popup do HUD
 * (teto `TETO_CARACTERES_CALLOUT`, validado no import).
 *
 * Tom (direção de arte §1.2): exagero carinhoso, gíria leve ("Bah!", "tchê"), o jogo ri COM o jogador. Nada de
 * palavrão, duplo sentido, piada com corpo, idade ou etnia. O HUD é preciso; quem brinca é o texto.
 *
 * Só nomeia o que o motor EMITE: famílias `ar`, `mortal`, `grab`, `trilho` (`FAMILIAS_MANOBRA`) e o evento
 * `combo-fechado`/`combo-perdido`. Os ids continuam os de `data/manobras.ts`; aqui não nasce manobra nova.
 *
 * Sem alocação: as funções só devolvem strings das tabelas abaixo (nada de concatenação), então podem ser
 * chamadas no laço de render sem gerar lixo. `semente` escolhe entre sinônimos de forma determinística
 * (passe `leitura.tick`, por exemplo), para o mesmo truque não repetir sempre a mesma piada.
 *
 * Camadas: `data/` só importa `core/` (e o próprio `data/`).
 */
import type { Grab } from '../core/contratos';
import { ErroDeContrato } from '../core/erros';
import { FAMILIAS_MANOBRA, MORTAL_VOLTAS_MAX, ticksDeSegundos, type IdManobraM2 } from './manobras';

/** Teto de caracteres de qualquer callout desta tabela (Bangers 30 px na tarja de 960 px lógicos). */
export const TETO_CARACTERES_CALLOUT = 22;

/** Lista não vazia de sinônimos: o primeiro é o "oficial"; os outros entram por `semente`. */
type Sinonimos = readonly [string, ...string[]];

/**
 * Contexto OPCIONAL de cada nome. Sem contexto, sai o nome base da família. Cada campo diz de onde vem:
 * o evento `manobra` do motor só traz `id` e `pontos`, então o resto o render lê da `LeituraDescida`
 * do ÚLTIMO tick no ar / no trilho (no tick do pouso o motor já zerou `ticksNoAr` e `grab`).
 */
export interface ContextoManobra {
  /** `mortal`: voltas completas do voo (`PilotoLeitura.voltas`). 1, 2, 3+ (3 é o teto de pontos, `MORTAL_VOLTAS_MAX`). */
  readonly voltas?: number;
  /** `ar`: ticks no ar do voo (`PilotoLeitura.ticksNoAr` no último tick com `modo === 'ar'`). */
  readonly ticksNoAr?: number;
  /** `grab`: qual grab foi segurado (`PilotoLeitura.grab` no último tick com grab ≠ null). */
  readonly grab?: Grab;
  /** `grab`: ticks segurando o grab no voo (o render conta os ticks com `piloto.grab !== null`). */
  readonly ticksSegurando?: number;
  /** `trilho`: ticks deslizando (do evento `trilho` início até o fim). */
  readonly ticksDeslizando?: number;
  /**
   * COMBINAÇÃO: todas as manobras do MESMO voo (os eventos `manobra` que chegam no mesmo tick do pouso; pode
   * incluir o próprio `id`). É o que transforma `mortal` + `grab` em "RODA DE CHIMARRÃO".
   */
  readonly junto?: readonly IdManobraM2[];
  /** Escolhe o sinônimo (`semente % n`). Inteiro ≥ 0; sem ela, sai sempre o primeiro. */
  readonly semente?: number;
}

// --- Faixas (derivadas dos dados do motor; números de AJUSTE, não de regra) ---

/** `ar`: abaixo disto é voo curto. (O motor só pontua `ar` acima de 0,5 s, `AR_LIMIAR_TICKS`.) */
const AR_MEDIO_TICKS = ticksDeSegundos(1);
/** `ar`: a partir disto é voo longo. */
const AR_LONGO_TICKS = ticksDeSegundos(1.75);
/** `grab`: segurar pelo menos isto troca o nome da direção pelo nome de "segurou muito". */
const GRAB_LONGO_TICKS = ticksDeSegundos(1);
/** `trilho`: faixas de deslize. */
const TRILHO_MEDIO_TICKS = ticksDeSegundos(1);
const TRILHO_LONGO_TICKS = ticksDeSegundos(2);

// --- Nomes base (sem contexto) ---

/** Nome base de cada família: o que aparece quando o render não passa contexto nenhum. */
export const NOME_BASE_MANOBRA: Readonly<Record<IdManobraM2, Sinonimos>> = {
  ar: ['VOO DE CAPIVARA', 'DECOLOU, TCHÊ!'],
  mortal: ['MORTAL MALUCO', 'CAMBALHOTA NA NEVE'],
  grab: ['AGARRA ESSA!', 'MÃO NA PRANCHA'],
  trilho: ['ESCORREGA, CAPIVARA!', 'CORRIMÃO DE SABÃO'],
};

// --- Ar: por tempo no ar (contexto `ticksNoAr`) ---

const NOME_AR = {
  curto: ['PULINHO DE PIPOCA', 'VOO DE GALINHA'],
  medio: ['PIPA SEM LINHA', 'DECOLOU, TCHÊ!'],
  longo: ['DEU TCHAU PRAS NUVENS', 'CARONA NO VENTO SUL'],
} as const satisfies Readonly<Record<string, Sinonimos>>;

// --- Mortal: por voltas completas (contexto `voltas`); índice = min(voltas, 3) ---

const NOME_MORTAL: readonly [Sinonimos, Sinonimos, Sinonimos] = [
  /* 1 volta  */ ['CAMBALHOTA DE QUINTAL', 'UMA VOLTINHA, BAH!'],
  /* 2 voltas */ ['PONCHO HELICÓPTERO', 'MORTAL DUPLO DE PONCHO'],
  /* 3+       */ ['LIQUIDIFICADOR NA NEVE', 'CENTRÍFUGA DO PAMPA'],
];

// --- Grab: pela direção (contexto `grab`) e por tempo segurado (contexto `ticksSegurando`) ---

/** Direção do grab = direção do gesto/tecla (`input/toque.ts`, `input/teclado.ts`). Reavaliar quando a folha B tiver as poses. */
const NOME_GRAB_DIRECAO: Readonly<Record<Grab, Sinonimos>> = {
  frente: ['PEGOU NO BICO', 'BICO NA MÃO'],
  tras: ['PUXOU O RABICHO', 'RABO DA PRANCHA'],
  cima: ['PRANCHA PRO CÉU', 'LEVANTA A TAMPA!'],
  baixo: ['ABRAÇO DE PRANCHA', 'AGACHADINHO NO AR'],
};

/** Segurou o grab por `GRAB_LONGO_TICKS` ou mais: ganha da direção. */
const NOME_GRAB_SEGURADO: Sinonimos = ['COLOU QUE NEM CHICLETE', 'GRUDOU NA PRANCHA!', 'NÃO LARGA, TCHÊ!'];

// --- Trilho: por tempo deslizando (contexto `ticksDeslizando`) ---

const NOME_TRILHO = {
  curto: ['BEIJINHO NO FERRO', 'RALOU NO CORRIMÃO'],
  medio: ['CORRIMÃO DA RODOVIÁRIA', 'SABÃO NO CORRIMÃO'],
  longo: ['EXPRESSO CHIMARRÃO', 'TREM DA SERRA GAÚCHA'],
} as const satisfies Readonly<Record<string, Sinonimos>>;

// --- Combinação no mesmo voo: mortal + grab (contexto `junto` + `voltas`) ---

/**
 * Mortal com grab no mesmo voo = a assinatura da capivara (ficha §3.2: "Roda de Chimarrão", encolhida sorvendo a
 * cuia enquanto gira). Índice = min(voltas, 3). Sem `voltas`, usa 1.
 */
const NOME_MORTAL_COM_GRAB: readonly [Sinonimos, Sinonimos, Sinonimos] = [
  /* 1 volta  */ ['RODA DE CHIMARRÃO', 'CUIA NO PARAFUSO'],
  /* 2 voltas */ ['CHIMARRÃO CENTRIFUGADO', 'RODA DUPLA DE CUIA'],
  /* 3+       */ ['CUIA NO LIQUIDIFICADOR', 'FURACÃO DE ERVA-MATE'],
];

// --- Combo: fechamento por faixa de multiplicador (contexto: `mult` do evento `combo-fechado`) ---

/**
 * Faixas do fechamento, da maior para a menor. `mult` = 1 + famílias distintas (teto 10, `MULT_TETO`); com as 4
 * famílias do M2 o máximo real é x5. Combo fechado tem pelo menos 1 manobra, então o mínimo real é x2.
 */
const FAIXAS_COMBO: readonly { readonly multMinimo: number; readonly textos: Sinonimos }[] = [
  { multMinimo: 5, textos: ['LENDA DA MONTANHA!', 'DESCEU RINDO!', 'A SERRA PAROU!'] },
  { multMinimo: 4, textos: ['COMBO DE RESPEITO!', 'A NEVE APLAUDE!'] },
  { multMinimo: 3, textos: ['BAH, QUE COMBO!', 'TRI LEGAL, TCHÊ!'] },
  { multMinimo: 0, textos: ['DEU PRO GASTO!', 'COMBO DE ESQUENTA'] },
];

/** Combo perdido no tombo (direção de arte §5.6: o selo racha com "ESTABACOU!"). */
export const TEXTOS_COMBO_PERDIDO: Sinonimos = ['ESTABACOU!', 'ESTABACOU COM ESTILO!'];

// --- API ---

function escolher(lista: Sinonimos, semente: number | undefined): string {
  if (semente === undefined || !(semente >= 0)) return lista[0];
  return lista[Math.floor(semente) % lista.length] ?? lista[0];
}

function indiceVoltas(voltas: number | undefined): 0 | 1 | 2 {
  if (voltas === undefined || voltas < 2) return 0;
  return voltas >= MORTAL_VOLTAS_MAX ? 2 : 1;
}

/**
 * Nome cômico de UMA manobra. Contexto usado por família:
 * - `ar`     → `ticksNoAr` (curto < 1 s ≤ médio < 1,75 s ≤ longo).
 * - `mortal` → `voltas` (1 / 2 / 3+); com `junto` contendo `grab`, vira a combinação mortal + grab.
 * - `grab`   → `ticksSegurando` (≥ 1 s = "segurado") e, senão, `grab` (direção); com `junto` contendo `mortal`,
 *              vira a combinação mortal + grab (usa `voltas`).
 * - `trilho` → `ticksDeslizando` (curto < 1 s ≤ médio < 2 s ≤ longo).
 * - todos    → `semente` escolhe o sinônimo.
 * Sem o campo da família, sai o nome base (`NOME_BASE_MANOBRA`).
 */
export function nomeDaManobra(id: IdManobraM2, ctx: ContextoManobra = {}): string {
  const s = ctx.semente;
  const comMortal = id === 'mortal' || (ctx.junto?.includes('mortal') ?? false);
  const comGrab = id === 'grab' || (ctx.junto?.includes('grab') ?? false);
  if ((id === 'mortal' || id === 'grab') && comMortal && comGrab) {
    return escolher(NOME_MORTAL_COM_GRAB[indiceVoltas(ctx.voltas)], s);
  }
  switch (id) {
    case 'ar': {
      const t = ctx.ticksNoAr;
      if (t === undefined) return escolher(NOME_BASE_MANOBRA.ar, s);
      return escolher(t >= AR_LONGO_TICKS ? NOME_AR.longo : t >= AR_MEDIO_TICKS ? NOME_AR.medio : NOME_AR.curto, s);
    }
    case 'mortal':
      if (ctx.voltas === undefined || ctx.voltas < 1) return escolher(NOME_BASE_MANOBRA.mortal, s);
      return escolher(NOME_MORTAL[indiceVoltas(ctx.voltas)], s);
    case 'grab':
      if (ctx.ticksSegurando !== undefined && ctx.ticksSegurando >= GRAB_LONGO_TICKS) return escolher(NOME_GRAB_SEGURADO, s);
      if (ctx.grab !== undefined) return escolher(NOME_GRAB_DIRECAO[ctx.grab], s);
      return escolher(NOME_BASE_MANOBRA.grab, s);
    case 'trilho': {
      const t = ctx.ticksDeslizando;
      if (t === undefined) return escolher(NOME_BASE_MANOBRA.trilho, s);
      return escolher(t >= TRILHO_LONGO_TICKS ? NOME_TRILHO.longo : t >= TRILHO_MEDIO_TICKS ? NOME_TRILHO.medio : NOME_TRILHO.curto, s);
    }
  }
}

/** Ordem de destaque quando um voo traz várias manobras e o HUD quer UM callout só. */
const PRIORIDADE_NO_VOO: readonly IdManobraM2[] = ['mortal', 'grab', 'trilho', 'ar'];

/**
 * Um callout só para todas as manobras do mesmo tick (o motor emite `mortal`, `ar` e `grab` juntos no pouso).
 * Escolhe a de maior destaque (mortal > grab > trilho > ar) e usa `ids` como `junto`. Para ZERO alocação no
 * laço de render, passe `ctx.junto === ids` (o mesmo array); senão copia o contexto uma vez.
 * Lista vazia devolve o nome base do `ar`. Os demais campos de `ctx` valem como em `nomeDaManobra`.
 */
export function nomeDoVoo(ids: readonly IdManobraM2[], ctx: ContextoManobra = {}): string {
  for (const id of PRIORIDADE_NO_VOO) {
    if (ids.includes(id)) return nomeDaManobra(id, ctx.junto === ids ? ctx : { ...ctx, junto: ids });
  }
  return escolher(NOME_BASE_MANOBRA.ar, ctx.semente);
}

/** Callout do `combo-fechado`, pela faixa do `mult` do evento. `semente` escolhe o sinônimo. */
export function nomeDoFechamentoDeCombo(mult: number, semente?: number): string {
  for (const faixa of FAIXAS_COMBO) if (mult >= faixa.multMinimo) return escolher(faixa.textos, semente);
  return escolher(FAIXAS_COMBO[FAIXAS_COMBO.length - 1]?.textos ?? ['COMBO!'], semente);
}

/** Callout do `combo-perdido`. */
export function nomeDoComboPerdido(semente?: number): string {
  return escolher(TEXTOS_COMBO_PERDIDO, semente);
}

// --- Validação no import (mesmo padrão de `regras-save.ts`: texto quebrado derruba o boot com erro claro) ---

function todosOsTextos(): readonly (readonly [string, string])[] {
  const t: [string, string][] = [];
  const por = (rotulo: string, lista: readonly string[]): void => {
    for (const x of lista) t.push([rotulo, x]);
  };
  for (const f of FAMILIAS_MANOBRA) por(`base.${f}`, NOME_BASE_MANOBRA[f]);
  for (const [k, v] of Object.entries(NOME_AR)) por(`ar.${k}`, v);
  NOME_MORTAL.forEach((v, i) => por(`mortal.${i + 1}`, v));
  for (const [k, v] of Object.entries(NOME_GRAB_DIRECAO)) por(`grab.${k}`, v);
  por('grab.segurado', NOME_GRAB_SEGURADO);
  for (const [k, v] of Object.entries(NOME_TRILHO)) por(`trilho.${k}`, v);
  NOME_MORTAL_COM_GRAB.forEach((v, i) => por(`mortal+grab.${i + 1}`, v));
  for (const f of FAIXAS_COMBO) por(`combo.x${f.multMinimo}`, f.textos);
  por('combo.perdido', TEXTOS_COMBO_PERDIDO);
  return t;
}

/** Problemas da tabela (vazia = ok). Exportada para o teste unitário. */
export function problemasDosTextos(): string[] {
  const p: string[] = [];
  for (const [rotulo, x] of todosOsTextos()) {
    if (x.trim().length === 0) p.push(`${rotulo}: texto vazio`);
    if (x.length > TETO_CARACTERES_CALLOUT) p.push(`${rotulo}: "${x}" passa de ${TETO_CARACTERES_CALLOUT} caracteres`);
    if (x !== x.toLocaleUpperCase('pt-BR')) p.push(`${rotulo}: "${x}" precisa estar em caixa alta`);
  }
  return p;
}

export function exigirTextosValidos(): void {
  const problemas = problemasDosTextos();
  if (problemas.length > 0) throw new ErroDeContrato('contrato-invalido', 'textos pt-BR inválidos', problemas);
}

exigirTextosValidos();
