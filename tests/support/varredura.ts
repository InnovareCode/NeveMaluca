/**
 * Varredura de arquitetura: quem pode importar quem (plano §3.1) e quais textos são proibidos em cada camada
 * (determinismo, plano §3.3). Funções PURAS sobre um mapa `caminho -> texto`, para o teste poder também plantar um
 * defeito no texto (mutação) e provar que a varredura reprova. `lerFontesDoDisco` só lê; não mexe em nada.
 *
 * Como funciona: um analisador léxico mínimo tira comentários e (para os textos proibidos) o conteúdo de strings, sem
 * mudar posições nem quebras de linha. Assim `// Math.sin` num comentário ou `'Date'` numa string não reprovam, e
 * `${Math.sin(x)}` dentro de template reprova (é código).
 *
 * Limite honesto: é uma varredura de TEXTO, não de tipos. `const m = Math; m['si' + 'n'](1)` é pego (qualquer uso de
 * `Math` fora da lista permitida reprova), mas `globalThis['Ma' + 'th']` escaparia (por isso `globalThis` é proibido nas
 * camadas puras). Quem quer burlar a regra consegue; a regra existe para o descuido, e o hash de pista/replay pega o resto.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const CAMADAS = ['core', 'data', 'pista', 'descida', 'meta', 'render', 'audio', 'input', 'assets', 'ui', 'platform'] as const;
export type Camada = (typeof CAMADAS)[number];

/** Tabela do plano §3.1, coluna "Importa de". `ui` importa de todas. Uma camada sempre pode importar de si mesma. */
export const PODE_IMPORTAR: Readonly<Record<Camada, readonly Camada[]>> = {
  core: [],
  data: ['core'],
  pista: ['core', 'data'],
  descida: ['core', 'data', 'pista'],
  meta: ['core', 'data'],
  render: ['core', 'data', 'assets'],
  audio: ['core', 'data'],
  input: ['core'],
  assets: ['core', 'data'],
  ui: ['core', 'data', 'pista', 'descida', 'meta', 'render', 'audio', 'input', 'assets', 'platform'],
  platform: ['core'],
};

/**
 * Arquivos soltos em `src/` e quem pode importá-los. `main.ts` monta tudo: importa de todas as camadas e de todo
 * arquivo da raiz. Arquivo novo na raiz, até ser registrado aqui, só o `main` importa.
 */
export const RAIZ_IMPORTAVEL_POR: Readonly<Record<string, readonly (Camada | 'main')[]>> = {
  'versao': ['ui', 'platform', 'main'],
  'estilo.css': ['main'],
};

export type RegraViolada = 'camada' | 'pacote-externo' | 'sai-de-src' | 'pasta-desconhecida' | 'importe-dinamico' | 'texto-proibido';

export interface Violacao {
  readonly arquivo: string;
  readonly linha: number;
  readonly regra: RegraViolada;
  readonly detalhe: string;
}

export type Fonte = Readonly<Record<string, string>>;

// --- Analisador léxico mínimo ---

const PALAVRAS_ANTES_DE_REGEX = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);

/**
 * Devolve o texto com os comentários trocados por espaços e, se `manterStrings` for falso, o miolo das strings,
 * dos templates (só a parte de texto) e das expressões regulares também. Mesmo tamanho, mesmas quebras de linha.
 */
export function limparFonte(texto: string, manterStrings: boolean): string {
  const n = texto.length;
  const saida = texto.split('');
  const branquear = (a: number, b: number): void => {
    for (let k = a; k < b; k++) {
      const c = saida[k];
      if (c !== '\n' && c !== '\r') saida[k] = ' ';
    }
  };
  let anteriorChar = '';
  let anteriorPalavra = '';

  const lerTemplate = (inicio: number): number => {
    // `inicio` aponta para o caractere depois da crase de abertura; devolve o índice depois da crase de fechamento
    let i = inicio;
    let blocoTexto = i;
    while (i < n) {
      const c = texto[i] as string;
      if (c === '\\') {
        i += 2;
      } else if (c === '`') {
        if (!manterStrings) branquear(blocoTexto, i);
        return i + 1;
      } else if (c === '$' && texto[i + 1] === '{') {
        if (!manterStrings) branquear(blocoTexto, i);
        i = lerCodigo(i + 2, true);
        blocoTexto = i;
      } else {
        i++;
      }
    }
    if (!manterStrings) branquear(blocoTexto, n);
    return n;
  };

  const lerCodigo = (inicio: number, ateChave: boolean): number => {
    let i = inicio;
    let profundidade = 0;
    while (i < n) {
      const c = texto[i] as string;
      const prox = texto[i + 1];
      if (c === '/' && prox === '/') {
        const fim = texto.indexOf('\n', i);
        const f = fim === -1 ? n : fim;
        branquear(i, f);
        i = f;
      } else if (c === '/' && prox === '*') {
        const fim = texto.indexOf('*/', i + 2);
        const f = fim === -1 ? n : fim + 2;
        branquear(i, f);
        i = f;
      } else if (c === '"' || c === "'") {
        let j = i + 1;
        while (j < n && texto[j] !== c && texto[j] !== '\n') j += texto[j] === '\\' ? 2 : 1;
        if (!manterStrings) branquear(i + 1, Math.min(j, n));
        i = Math.min(j + 1, n);
        anteriorChar = c;
        anteriorPalavra = '';
      } else if (c === '`') {
        i = lerTemplate(i + 1);
        anteriorChar = '`';
        anteriorPalavra = '';
      } else if (c === '/' && regexPermitida(anteriorChar, anteriorPalavra)) {
        let j = i + 1;
        let emClasse = false;
        while (j < n && texto[j] !== '\n') {
          const d = texto[j] as string;
          if (d === '\\') j++;
          else if (d === '[') emClasse = true;
          else if (d === ']') emClasse = false;
          else if (d === '/' && !emClasse) break;
          j++;
        }
        if (!manterStrings) branquear(i + 1, Math.min(j, n));
        i = Math.min(j + 1, n);
        while (i < n && /[a-z]/i.test(texto[i] as string)) i++; // flags
        anteriorChar = '/';
        anteriorPalavra = '';
      } else {
        if (c === '{') profundidade++;
        if (c === '}') {
          if (ateChave && profundidade === 0) return i + 1;
          profundidade--;
        }
        if (/\s/.test(c)) {
          i++;
          continue;
        }
        if (/[A-Za-z0-9_$]/.test(c)) {
          let j = i;
          while (j < n && /[A-Za-z0-9_$]/.test(texto[j] as string)) j++;
          anteriorPalavra = texto.slice(i, j);
          anteriorChar = 'a';
          i = j;
          continue;
        }
        anteriorChar = c;
        anteriorPalavra = '';
        i++;
      }
    }
    return n;
  };

  lerCodigo(0, false);
  return saida.join('');
}

function regexPermitida(anteriorChar: string, anteriorPalavra: string): boolean {
  if (anteriorChar === 'a') return PALAVRAS_ANTES_DE_REGEX.has(anteriorPalavra);
  return !(anteriorChar === ')' || anteriorChar === ']' || anteriorChar === '"' || anteriorChar === "'" || anteriorChar === '`' || anteriorChar === '/');
}

function linhaDe(texto: string, indice: number): number {
  let linha = 1;
  for (let i = 0; i < indice; i++) if (texto.charCodeAt(i) === 10) linha++;
  return linha;
}

// --- Importes ---

interface Importe {
  readonly especificador: string;
  readonly indice: number;
}

const RE_IMPORTE_COM_FROM = /\b(?:import|export)\s+(?:type\s+)?[^'"`;]*?\bfrom\s*(['"])([^'"\n]*)\1/g;
const RE_IMPORTE_EFEITO = /\bimport\s*(['"])([^'"\n]*)\1/g;
const RE_IMPORTE_DINAMICO = /\bimport\s*\(\s*([^)]*)\)/g;
const RE_GLOB = /\bimport\s*\.\s*meta\s*\.\s*glob(?:Eager)?\s*\(\s*([^)]*)\)/g;
const RE_STRING = /(['"])([^'"\n]*)\1/g;

function extrairImportes(comStrings: string): { importes: Importe[]; dinamicosNaoLiterais: number[] } {
  const importes: Importe[] = [];
  const dinamicosNaoLiterais: number[] = [];
  for (const m of comStrings.matchAll(RE_IMPORTE_COM_FROM)) importes.push({ especificador: m[2] as string, indice: m.index ?? 0 });
  for (const m of comStrings.matchAll(RE_IMPORTE_EFEITO)) importes.push({ especificador: m[2] as string, indice: m.index ?? 0 });
  for (const m of comStrings.matchAll(RE_IMPORTE_DINAMICO)) {
    const arg = (m[1] as string).trim();
    const literal = /^(['"])([^'"\n]*)\1(?:\s*,[\s\S]*)?$/.exec(arg);
    if (literal) importes.push({ especificador: literal[2] as string, indice: m.index ?? 0 });
    else dinamicosNaoLiterais.push(m.index ?? 0);
  }
  for (const m of comStrings.matchAll(RE_GLOB)) {
    for (const s of (m[1] as string).matchAll(RE_STRING)) importes.push({ especificador: s[2] as string, indice: m.index ?? 0 });
  }
  return { importes, dinamicosNaoLiterais };
}

/** Normaliza `a/b/../c` => `a/c`. Segmentos que sobem além da raiz ficam como `..` no começo. */
function normalizar(segmentos: readonly string[]): string[] {
  const saida: string[] = [];
  for (const s of segmentos) {
    if (s === '' || s === '.') continue;
    if (s === '..') {
      if (saida.length > 0 && saida[saida.length - 1] !== '..') saida.pop();
      else saida.push('..');
    } else {
      saida.push(s);
    }
  }
  return saida;
}

type Origem = { readonly tipo: 'camada'; readonly camada: Camada } | { readonly tipo: 'raiz'; readonly nome: string } | { readonly tipo: 'desconhecida'; readonly pasta: string };

function origemDe(caminho: string): Origem {
  const segs = caminho.split('/');
  const primeiro = segs[0] as string;
  if (segs.length === 1) return { tipo: 'raiz', nome: primeiro.replace(/\.(ts|tsx|js|mjs)$/, '') };
  if ((CAMADAS as readonly string[]).includes(primeiro)) return { tipo: 'camada', camada: primeiro as Camada };
  return { tipo: 'desconhecida', pasta: primeiro };
}

function nomeDaOrigem(o: Origem): string {
  return o.tipo === 'camada' ? o.camada : o.tipo === 'raiz' ? o.nome : o.pasta;
}

// --- Textos proibidos ---

interface RegraDeTexto {
  readonly id: string;
  readonly padrao: RegExp;
  readonly porque: string;
  /** Camadas em que vale; `todas` = qualquer arquivo de src/. */
  readonly camadas: readonly Camada[] | 'todas';
}

const NUCLEO_DETERMINISTICO: readonly Camada[] = ['core', 'pista', 'descida'];
const SEM_RELOGIO: readonly Camada[] = ['core', 'pista', 'descida', 'audio'];

/** Math.* permitido no núcleo determinístico: tudo que é exato pelo padrão (inclui `sqrt`, correto em IEEE 754). */
const MATH_PERMITIDO = 'abs|ceil|floor|round|trunc|sign|min|max|sqrt|imul|fround|clz32|PI|SQRT2';

export const REGRAS_DE_TEXTO: readonly RegraDeTexto[] = [
  { id: 'Math.random', padrao: /\bMath\s*\.\s*random\b/g, porque: 'use criarRng(semente) de core/rng (rngVisual para efeitos)', camadas: 'todas' },
  {
    id: 'Math fora da lista',
    padrao: new RegExp(`\\bMath\\b(?!\\s*\\.\\s*(?:${MATH_PERMITIDO}|random)\\b)`, 'g'),
    porque: 'sin/cos/atan2/pow/exp/log/hypot... podem diferir entre motores; use core/trig (seno, cosseno, atan2) e multiplicações',
    camadas: NUCLEO_DETERMINISTICO,
  },
  { id: 'operador **', padrao: /\*\*/g, porque: 'é Math.pow; escreva a multiplicação', camadas: NUCLEO_DETERMINISTICO },
  { id: 'Intl/toLocale', padrao: /\b(?:Intl|toLocale\w*|localeCompare)\b/g, porque: 'depende de idioma e motor do aparelho', camadas: NUCLEO_DETERMINISTICO },
  { id: 'Date', padrao: /\bDate\b/g, porque: 'relógio de parede; o tempo entra por parâmetro', camadas: SEM_RELOGIO },
  { id: 'performance', padrao: /\bperformance\b/g, porque: 'relógio; o tempo entra por parâmetro', camadas: SEM_RELOGIO },
  {
    id: 'timer',
    padrao: /\b(?:setTimeout|setInterval|setImmediate|requestAnimationFrame|cancelAnimationFrame|queueMicrotask)\b/g,
    porque: 'agendamento depende de relógio; quem chama o núcleo é que agenda',
    camadas: SEM_RELOGIO,
  },
  { id: 'crypto', padrao: /\bcrypto\b/g, porque: 'entropia não determinística; a fonte entra por parâmetro (sementeAleatoria)', camadas: NUCLEO_DETERMINISTICO },
  { id: 'eval/Function', padrao: /\beval\s*\(|\bnew\s+Function\b/g, porque: 'código dinâmico', camadas: NUCLEO_DETERMINISTICO },
  {
    id: 'ambiente global',
    padrao: /\b(?:globalThis|window|document|navigator|localStorage|sessionStorage|process|require)\b/g,
    porque: 'o núcleo não toca o ambiente (DOM, Node, armazenamento); receba o que precisa por parâmetro',
    camadas: NUCLEO_DETERMINISTICO,
  },
];

// --- Varredura ---

/** Analisa UM arquivo. `caminho` é relativo a `src/`, com `/` (ex.: `core/rng.ts`). */
export function analisarArquivo(caminho: string, texto: string): Violacao[] {
  const v: Violacao[] = [];
  const origem = origemDe(caminho);
  const nomeOrigem = nomeDaOrigem(origem);
  const semComentarios = limparFonte(texto, true);
  const semStrings = limparFonte(texto, false);

  if (origem.tipo === 'desconhecida') {
    v.push({ arquivo: caminho, linha: 1, regra: 'pasta-desconhecida', detalhe: `src/${origem.pasta}/ não é uma camada do plano §3.1; registre-a em CAMADAS/PODE_IMPORTAR com o dono do plano` });
  }

  const { importes, dinamicosNaoLiterais } = extrairImportes(semComentarios);
  for (const i of dinamicosNaoLiterais) {
    v.push({ arquivo: caminho, linha: linhaDe(texto, i), regra: 'importe-dinamico', detalhe: 'import() com argumento que não é texto literal: a varredura não consegue conferir a camada' });
  }
  for (const imp of importes) {
    const linha = linhaDe(texto, imp.indice);
    const espec = imp.especificador.replace(/[?#].*$/, '');
    if (!espec.startsWith('.')) {
      v.push({ arquivo: caminho, linha, regra: 'pacote-externo', detalhe: `import de "${imp.especificador}": dependência de runtime nova precisa de decisão (nenhuma é permitida hoje)` });
      continue;
    }
    const dir = caminho.split('/').slice(0, -1);
    const alvo = normalizar([...dir, ...espec.split('/')]);
    if (alvo[0] === '..') {
      v.push({ arquivo: caminho, linha, regra: 'sai-de-src', detalhe: `import de "${imp.especificador}" sai de src/` });
      continue;
    }
    const destino = origemDe(alvo.join('/'));
    if (destino.tipo === 'desconhecida') {
      v.push({ arquivo: caminho, linha, regra: 'pasta-desconhecida', detalhe: `import de "${imp.especificador}" aponta para src/${destino.pasta}/, que não é camada` });
      continue;
    }
    if (nomeDaOrigem(destino) === nomeOrigem && destino.tipo === origem.tipo) continue; // mesma camada (ou o próprio arquivo raiz)
    if (destino.tipo === 'camada') {
      const permitido: readonly string[] = origem.tipo === 'camada' ? PODE_IMPORTAR[origem.camada] : origem.tipo === 'raiz' && origem.nome === 'main' ? CAMADAS : [];
      if (!permitido.includes(destino.camada)) {
        v.push({ arquivo: caminho, linha, regra: 'camada', detalhe: `${nomeOrigem}/ não pode importar de ${destino.camada}/ ("${imp.especificador}"); permitido: ${permitido.join(', ') || 'nada'}` });
      }
    } else {
      // arquivo solto da raiz (versao.ts, estilo.css, main.ts)
      const nomeArquivo = espec.endsWith('.css') ? (alvo[alvo.length - 1] as string) : destino.nome;
      const quem = RAIZ_IMPORTAVEL_POR[nomeArquivo] ?? ['main'];
      const eu = origem.tipo === 'camada' ? origem.camada : origem.tipo === 'raiz' ? origem.nome : '';
      const ehMain = origem.tipo === 'raiz' && origem.nome === 'main';
      if (!(ehMain && nomeArquivo !== 'main') && !(quem as readonly string[]).includes(eu)) {
        v.push({ arquivo: caminho, linha, regra: 'camada', detalhe: `${nomeOrigem} não pode importar o arquivo da raiz "${nomeArquivo}" ("${imp.especificador}"); permitido: ${quem.join(', ')}` });
      }
    }
  }

  for (const regra of REGRAS_DE_TEXTO) {
    if (regra.camadas !== 'todas' && !(origem.tipo === 'camada' && regra.camadas.includes(origem.camada))) continue;
    for (const m of semStrings.matchAll(regra.padrao)) {
      v.push({ arquivo: caminho, linha: linhaDe(texto, m.index ?? 0), regra: 'texto-proibido', detalhe: `"${m[0]}" [${regra.id}]: ${regra.porque}` });
    }
  }
  return v;
}

export function varrerFontes(fontes: Fonte): Violacao[] {
  const v: Violacao[] = [];
  for (const caminho of Object.keys(fontes).sort()) v.push(...analisarArquivo(caminho, fontes[caminho] as string));
  return v;
}

export function formatarViolacoes(v: readonly Violacao[]): string {
  return v.map((x) => `${x.arquivo}:${x.linha} [${x.regra}] ${x.detalhe}`).join('\n');
}

const EXTENSOES = /\.(?:ts|tsx|js|mjs|cts|mts)$/;

/** Lê todos os arquivos de código de `raizSrc` (recursivo). Chaves relativas a `raizSrc`, com `/`. */
export function lerFontesDoDisco(raizSrc: string): Fonte {
  if (!existsSync(raizSrc)) throw new Error(`pasta não existe: ${raizSrc}`);
  const saida: Record<string, string> = {};
  const andar = (dir: string): void => {
    for (const nome of readdirSync(dir).sort()) {
      const cheio = join(dir, nome);
      if (statSync(cheio).isDirectory()) andar(cheio);
      else if (EXTENSOES.test(nome)) saida[relative(raizSrc, cheio).split(sep).join('/')] = readFileSync(cheio, 'utf8');
    }
  };
  andar(raizSrc);
  return saida;
}
