/**
 * Catálogo de temas visuais (`DefTema`, `core/contratos.ts`, plano M3 §B.3): DADO (cores §2.1 da direção de arte +
 * clima + música), sem nenhum desenho. O desenho de cada tema é do `PintorTema` (Lyra, `render/temas/<tema>.ts`).
 *
 * `bosque` (Morro do Pinhão) já tinha um `DefTema` completo em `render/temas/bosque.ts` (`TEMA_BOSQUE`, criado no
 * refactor do Morro antes deste catálogo existir — ver a nota de "EXCEÇÃO DE DONO" em `core/contratos.ts`). Este
 * arquivo não importa de `render/` (`data/` só importa `core/`, regra de camada) então `TEMA_BOSQUE` aqui é uma
 * CÓPIA dos mesmos 7 campos, não a mesma referência; os valores têm que continuar iguais aos de `render/temas/
 * bosque.ts` (prova: `tests/unit/data-temas.test.ts`). Quando o Cronos assumir este arquivo de verdade, a correção
 * é religar `render/parallax.ts` para ler `TEMA_BOSQUE` de AQUI em vez de duplicar — fora do escopo desta tarefa
 * (não é pele visual, é só destravar `pico-do-picole`).
 *
 * `parque` (Pico do Picolé) é novo (M3 F3/F4): cores de `docs/direcao-arte-neve-maluca.md` §2.1 (linha "Pico do
 * Picolé"), clima `confeito` e música de `docs/temas-pistas-m3.md` §5.
 */
import type { DefTema, IdTema } from '../core/contratos';
import { ErroDeContrato } from '../core/erros';

const FORMATO_HEX = /^#[0-9A-Fa-f]{6}$/;
const CLIMAS_VALIDOS: ReadonlySet<DefTema['clima']> = new Set(['neve-fofa', 'confeito', 'neve-noturna', 'vapor', 'vento-aurora']);

/** Cópia dos 7 campos de `render/temas/bosque.ts` → `TEMA_BOSQUE` (direção de arte §2.1, linha "Morro do Pinhão"). */
export const TEMA_BOSQUE: DefTema = {
  id: 'bosque',
  cores: {
    ceu: ['#4FA8F0', '#BFE6FF'],
    montanhaDistante: '#A9C7E6',
    montanhaMedia: '#7FA3C9',
    silhueta: '#5C82A6',
    neveLuz: '#F7FBFF',
    neveSombra: '#BFD9EE',
    destaque: '#B83A2B',
  },
  clima: 'neve-fofa',
  musica: 'vanerao-morro',
};

/** Pico do Picolé (direção de arte §2.1, linha "Pico do Picolé"; clima e música de `docs/temas-pistas-m3.md` §5). */
export const TEMA_PARQUE: DefTema = {
  id: 'parque',
  cores: {
    ceu: ['#5BB8FF', '#D9F1FF'],
    montanhaDistante: '#F2C6D8',
    montanhaMedia: '#B9E8D6',
    silhueta: '#E9C27A',
    neveLuz: '#FFF4F8',
    neveSombra: '#F2D3E0',
    destaque: '#7FE0C4',
  },
  clima: 'confeito',
  musica: 'pop-picole',
};

export const TEMAS_DE_DADOS: readonly DefTema[] = [TEMA_BOSQUE, TEMA_PARQUE];

function problemasDeDefTema(def: DefTema): string[] {
  const p: string[] = [];
  if (!/^[a-z][a-z-]*$/.test(def.id)) p.push(`tema "${def.id}": id fora da forma esperada`);
  for (const [campo, valor] of Object.entries(def.cores)) {
    if (campo === 'ceu') continue;
    if (!FORMATO_HEX.test(valor as string)) p.push(`tema "${def.id}": cores.${campo} "${valor}" não é hex #RRGGBB`);
  }
  for (const v of def.cores.ceu) if (!FORMATO_HEX.test(v)) p.push(`tema "${def.id}": cores.ceu "${v}" não é hex #RRGGBB`);
  if (!CLIMAS_VALIDOS.has(def.clima)) p.push(`tema "${def.id}": clima "${def.clima}" fora da lista válida`);
  if (def.musica.length === 0) p.push(`tema "${def.id}": musica vazia`);
  return p;
}

/** Validação de FORMA (não desenha nada: isso é `PintorTema`, que cruzaria a camada). Pura: não lança. */
export function problemasDosTemasDeDados(defs: readonly DefTema[] = TEMAS_DE_DADOS): string[] {
  const p: string[] = [];
  const vistos = new Set<IdTema>();
  for (const def of defs) {
    if (vistos.has(def.id)) p.push(`tema "${def.id}": id repetido`);
    vistos.add(def.id);
    p.push(...problemasDeDefTema(def));
  }
  return p;
}

/** Lança `ErroDeContrato` se algum tema estiver errado (boot com tela de erro clara). */
export function exigirTemasDeDadosValidos(defs: readonly DefTema[] = TEMAS_DE_DADOS): void {
  const problemas = problemasDosTemasDeDados(defs);
  if (problemas.length > 0) throw new ErroDeContrato('contrato-invalido', 'DefTema de data/ inválido', problemas);
}

exigirTemasDeDadosValidos();
