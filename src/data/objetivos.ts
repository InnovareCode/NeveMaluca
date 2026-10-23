/**
 * Catálogo de objetivos (`DefObjetivo`, `core/contratos.ts`, plano M3 §B.4): 3 por pista, id `<pista>-o1..o3` (já
 * reservados em `regras-save.ts` → `OBJETIVOS_PROVISORIOS`). `o1` é acessível (iniciante), `o2` é a técnica do
 * tema, `o3` é desafio — escada de dificuldade do plano.
 *
 * Avaliado sobre `ResumoDescida` (redutor puro de `descida/resumo.ts`, ainda não escrito — F5). Este arquivo só
 * guarda o DADO; `CondicaoObjetivo.campo` já é validado contra `CAMPOS_RESUMO_DESCIDA` (`core/contratos.ts`), então
 * quando `resumo.ts` nascer as duas listas não podem divergir.
 *
 * Pico do Picolé e Vila do Chocolate Quente (M3 F3) estão aqui por ora: o Morro do Pinhão não tem `DefObjetivo`
 * ainda (seus 3 ids em `data/pistas.ts` ficam sem catálogo, como já estava antes desta tarefa — fora de escopo).
 */
import { CAMPOS_RESUMO_DESCIDA } from '../core/contratos';
import type { CondicaoObjetivo, DefObjetivo } from '../core/contratos';
import { FORMA_ID, TICKS_POR_SEGUNDO } from '../core/constantes';
import { ErroDeContrato } from '../core/erros';
import { REGRAS_SAVE } from './regras-save';

// plano M3 §B.4: "grind de 3 s num palito" -> 3 s em ticks (60 Hz, `core/constantes.ts`).
const TICKS_3S = 3 * TICKS_POR_SEGUNDO;
// Vila do Chocolate Quente (pista 3, um degrau acima do Picolé): "grind de 4 s num varal" -> 4 s em ticks.
const TICKS_4S = 4 * TICKS_POR_SEGUNDO;

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

export const OBJETIVOS_DE_DADOS: readonly DefObjetivo[] = [PICOLE_O1, PICOLE_O2, PICOLE_O3, VILA_O1, VILA_O2, VILA_O3];

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
