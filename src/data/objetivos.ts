/**
 * Catálogo de objetivos (`DefObjetivo`, `core/contratos.ts`, plano M3 §B.4): 3 por pista, id `<pista>-o1..o3` (já
 * reservados em `regras-save.ts` → `OBJETIVOS_PROVISORIOS`). `o1` é acessível (iniciante), `o2` é a técnica do
 * tema, `o3` é desafio — escada de dificuldade do plano.
 *
 * Avaliado sobre `ResumoDescida` (redutor puro de `descida/resumo.ts`, ainda não escrito — F5). Este arquivo só
 * guarda o DADO; `CondicaoObjetivo.campo` já é validado contra `CAMPOS_RESUMO_DESCIDA` (`core/contratos.ts`), então
 * quando `resumo.ts` nascer as duas listas não podem divergir.
 *
 * As 5 pistas (plano corrida-campeonato §Dívida técnica): Morro do Pinhão ganha seus 3 objetivos nesta tarefa (C5a,
 * antes ficavam sem catálogo); o `CUME_O2` ("Combo ×6") foi corrigido aqui porque era IMPOSSÍVEL — `mult = 1 +
 * famílias distintas` (`descida/combo.ts`) e só há 4 famílias (`FAMILIAS_MANOBRA`, `data/manobras.ts`), teto real
 * ×5 (o `MULT_TETO = 10` de `data/manobras.ts` nunca é alcançado). A escada do Cume continua subindo, mas por
 * CONTAGEM de manobras no combo (`maiorComboManobras`, que aceita repetir família com desconto — esse sim cresce
 * além de 5), não por família distinta.
 */
import { CAMPOS_RESUMO_DESCIDA } from '../core/contratos';
import type { CondicaoObjetivo, DefObjetivo } from '../core/contratos';
import { FORMA_ID, TICKS_POR_SEGUNDO } from '../core/constantes';
import { ErroDeContrato } from '../core/erros';
import { REGRAS_SAVE } from './regras-save';

// plano M3 §B.4, Morro do Pinhão (pista 1, tutorial): "grind de 2 s na cerca de madeira" -> 2 s em ticks.
const TICKS_2S = 2 * TICKS_POR_SEGUNDO;
// plano M3 §B.4: "grind de 3 s num palito" -> 3 s em ticks (60 Hz, `core/constantes.ts`).
const TICKS_3S = 3 * TICKS_POR_SEGUNDO;
// Vila do Chocolate Quente (pista 3, um degrau acima do Picolé): "grind de 4 s num varal" -> 4 s em ticks.
const TICKS_4S = 4 * TICKS_POR_SEGUNDO;
// Vulcão Pé-Gelado (pista 4, um degrau acima da Vila): "grind de 5 s na ponte de basalto" -> 5 s em ticks.
const TICKS_5S = 5 * TICKS_POR_SEGUNDO;
// Cume da Ventania (pista 5, a última, um degrau acima do Vulcão): "grind de 6 s na corda" -> 6 s em ticks.
const TICKS_6S = 6 * TICKS_POR_SEGUNDO;

export const MORRO_O1: DefObjetivo = {
  id: 'morro-do-pinhao-o1',
  pista: 'morro-do-pinhao',
  texto: 'Grind de 2 s na cerca de madeira',
  condicao: { tipo: 'minimo', campo: 'maiorGrindTicks', valor: TICKS_2S },
};

export const MORRO_O2: DefObjetivo = {
  id: 'morro-do-pinhao-o2',
  pista: 'morro-do-pinhao',
  texto: 'Combo ×2',
  condicao: { tipo: 'minimo', campo: 'maiorMult', valor: 2 },
};

export const MORRO_O3: DefObjetivo = {
  id: 'morro-do-pinhao-o3',
  pista: 'morro-do-pinhao',
  texto: '12.000 pontos numa descida',
  condicao: { tipo: 'minimo', campo: 'pontos', valor: 12_000 },
};

export const PICOLE_O1: DefObjetivo = {
  id: 'pico-do-picole-o1',
  pista: 'pico-do-picole',
  texto: 'Grind de 3 s num palito',
  condicao: { tipo: 'minimo', campo: 'maiorGrindTicks', valor: TICKS_3S },
};

export const PICOLE_O2: DefObjetivo = {
  id: 'pico-do-picole-o2',
  pista: 'pico-do-picole',
  texto: 'Combo ×3',
  condicao: { tipo: 'minimo', campo: 'maiorMult', valor: 3 },
};

export const PICOLE_O3: DefObjetivo = {
  id: 'pico-do-picole-o3',
  pista: 'pico-do-picole',
  texto: '15.000 pontos numa descida',
  condicao: { tipo: 'minimo', campo: 'pontos', valor: 15_000 },
};

export const VILA_O1: DefObjetivo = {
  id: 'vila-chocolate-o1',
  pista: 'vila-chocolate',
  texto: 'Grind de 4 s num varal',
  condicao: { tipo: 'minimo', campo: 'maiorGrindTicks', valor: TICKS_4S },
};

export const VILA_O2: DefObjetivo = {
  id: 'vila-chocolate-o2',
  pista: 'vila-chocolate',
  texto: 'Combo ×4',
  condicao: { tipo: 'minimo', campo: 'maiorMult', valor: 4 },
};

export const VILA_O3: DefObjetivo = {
  id: 'vila-chocolate-o3',
  pista: 'vila-chocolate',
  texto: '18.000 pontos numa descida',
  condicao: { tipo: 'minimo', campo: 'pontos', valor: 18_000 },
};

export const VULCAO_O1: DefObjetivo = {
  id: 'vulcao-pe-gelado-o1',
  pista: 'vulcao-pe-gelado',
  texto: 'Grind de 5 s na ponte de basalto',
  condicao: { tipo: 'minimo', campo: 'maiorGrindTicks', valor: TICKS_5S },
};

export const VULCAO_O2: DefObjetivo = {
  id: 'vulcao-pe-gelado-o2',
  pista: 'vulcao-pe-gelado',
  texto: 'Combo ×5',
  condicao: { tipo: 'minimo', campo: 'maiorMult', valor: 5 },
};

export const VULCAO_O3: DefObjetivo = {
  id: 'vulcao-pe-gelado-o3',
  pista: 'vulcao-pe-gelado',
  texto: '21.000 pontos numa descida',
  condicao: { tipo: 'minimo', campo: 'pontos', valor: 21_000 },
};

export const CUME_O1: DefObjetivo = {
  id: 'cume-da-ventania-o1',
  pista: 'cume-da-ventania',
  texto: 'Grind de 6 s na corda',
  condicao: { tipo: 'minimo', campo: 'maiorGrindTicks', valor: TICKS_6S },
};

export const CUME_O2: DefObjetivo = {
  id: 'cume-da-ventania-o2',
  pista: 'cume-da-ventania',
  // "Combo ×6" era impossível (mult trava em ×5: só 4 famílias de manobra). Escada por CONTAGEM de manobras em vez
  // de família distinta — essa sim passa de 5 (repetir família custa menos, mas ainda soma ao combo).
  texto: 'Combo de 6 manobras',
  condicao: { tipo: 'minimo', campo: 'maiorComboManobras', valor: 6 },
};

export const CUME_O3: DefObjetivo = {
  id: 'cume-da-ventania-o3',
  pista: 'cume-da-ventania',
  texto: '24.000 pontos numa descida',
  condicao: { tipo: 'minimo', campo: 'pontos', valor: 24_000 },
};

export const OBJETIVOS_DE_DADOS: readonly DefObjetivo[] = [
  MORRO_O1,
  MORRO_O2,
  MORRO_O3,
  PICOLE_O1,
  PICOLE_O2,
  PICOLE_O3,
  VILA_O1,
  VILA_O2,
  VILA_O3,
  VULCAO_O1,
  VULCAO_O2,
  VULCAO_O3,
  CUME_O1,
  CUME_O2,
  CUME_O3,
];

const CAMPOS_VALIDOS: ReadonlySet<string> = new Set(CAMPOS_RESUMO_DESCIDA);

function problemasDeCondicao(idObjetivo: string, c: CondicaoObjetivo): string[] {
  const p: string[] = [];
  if (c.tipo === 'minimo' || c.tipo === 'maximo') {
    if (!CAMPOS_VALIDOS.has(c.campo)) p.push(`objetivo "${idObjetivo}": condição.campo "${c.campo}" fora de CAMPOS_RESUMO_DESCIDA`);
    if (!(c.valor >= 0)) p.push(`objetivo "${idObjetivo}": condição.valor ${c.valor} inválido (precisa ser >= 0)`);
  } else if (c.tipo === 'todos') {
    if (c.condicoes.length === 0) p.push(`objetivo "${idObjetivo}": condição "todos" sem nenhuma condição`);
    for (const filha of c.condicoes) p.push(...problemasDeCondicao(idObjetivo, filha));
  }
  return p;
}

function problemasDeDefObjetivo(def: DefObjetivo, idsDePistas: readonly string[]): string[] {
  const p: string[] = [];
  if (!FORMA_ID.test(def.id)) p.push(`objetivo "${def.id}": id fora da forma de id`);
  if (!idsDePistas.includes(def.pista)) p.push(`objetivo "${def.id}": pista "${def.pista}" não existe em REGRAS_SAVE.pistas`);
  if (!def.id.startsWith(`${def.pista}-o`)) p.push(`objetivo "${def.id}": id não segue o padrão "<pista>-o1..o3"`);
  if (def.texto.length === 0) p.push(`objetivo "${def.id}": texto vazio`);
  p.push(...problemasDeCondicao(def.id, def.condicao));
  return p;
}

/** Validação de FORMA (não avalia descida nenhuma: isso é `descida/resumo.ts`, F5). Pura: não lança. */
export function problemasDosObjetivosDeDados(
  defs: readonly DefObjetivo[] = OBJETIVOS_DE_DADOS,
  regras: { readonly pistas: readonly string[]; readonly objetivos: readonly string[] } = REGRAS_SAVE,
): string[] {
  const p: string[] = [];
  const vistos = new Set<string>();
  for (const def of defs) {
    if (vistos.has(def.id)) p.push(`objetivo "${def.id}": id repetido`);
    vistos.add(def.id);
    if (!regras.objetivos.includes(def.id)) p.push(`objetivo "${def.id}": não está em REGRAS_SAVE.objetivos`);
    p.push(...problemasDeDefObjetivo(def, regras.pistas));
  }
  return p;
}

/** Lança `ErroDeContrato` se algum objetivo estiver errado (boot com tela de erro clara). */
export function exigirObjetivosDeDadosValidos(
  defs: readonly DefObjetivo[] = OBJETIVOS_DE_DADOS,
  regras: { readonly pistas: readonly string[]; readonly objetivos: readonly string[] } = REGRAS_SAVE,
): void {
  const problemas = problemasDosObjetivosDeDados(defs, regras);
  if (problemas.length > 0) throw new ErroDeContrato('contrato-invalido', 'DefObjetivo de data/ inválido', problemas);
}

exigirObjetivosDeDadosValidos();
