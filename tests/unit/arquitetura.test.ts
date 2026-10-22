/**
 * TESTE DE VARREDURA DE CAMADAS E DE FUNÇÕES PROIBIDAS (plano §3.1 e §3.3; handoff do Vulcano, M0).
 *
 * Duas garantias:
 *  1. o código REAL de src/ não viola nenhuma regra;
 *  2. a varredura REPROVA quando a regra é violada (mutação: planta-se o defeito no texto e confere-se que a varredura
 *     o acusa). Sem a parte 2, um teste que nunca falha seria indistinguível de um teste que funciona.
 *
 * A tabela de camadas abaixo é uma SEGUNDA cópia, escrita à mão a partir do plano §3.1, de propósito: se alguém afrouxar
 * `PODE_IMPORTAR` em tests/support/varredura.ts, este teste acusa a diferença.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CAMADAS,
  PODE_IMPORTAR,
  REGRAS_DE_TEXTO,
  analisarArquivo,
  formatarViolacoes,
  lerFontesDoDisco,
  limparFonte,
  varrerFontes,
  type Camada,
} from '../support/varredura';

const RAIZ_SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

/** Plano §3.1, coluna "Importa de", copiada à mão. */
const PLANO: Readonly<Record<string, readonly string[]>> = {
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

const regras = (v: readonly { regra: string }[]): string[] => v.map((x) => x.regra);

describe('o código real de src/ respeita as camadas e não usa o que é proibido', () => {
  const fontes = lerFontesDoDisco(RAIZ_SRC);

  it('a varredura enxerga o src/ de verdade (não é um passe vazio)', () => {
    const arquivos = Object.keys(fontes);
    expect(arquivos.length).toBeGreaterThan(10);
    expect(arquivos).toContain('core/rng.ts');
    expect(arquivos).toContain('core/trig.ts');
    expect(arquivos).toContain('main.ts');
    for (const c of CAMADAS) expect(arquivos.some((a) => a.startsWith(`${c}/`)), `camada ${c} sem arquivo`).toBe(true);
  });

  it('nenhuma violação em src/', () => {
    const v = varrerFontes(fontes);
    expect(formatarViolacoes(v)).toBe('');
  });
});

describe('a tabela de camadas é a do plano §3.1', () => {
  it('as 11 camadas, cada uma com as dependências do plano', () => {
    expect([...CAMADAS].sort()).toEqual(Object.keys(PLANO).sort());
    for (const c of CAMADAS) expect([...PODE_IMPORTAR[c]].sort(), c).toEqual([...(PLANO[c] as string[])].sort());
  });

  it('o grafo permitido não tem ciclo (existe uma ordem de camadas de baixo para cima)', () => {
    const feitos = new Set<string>();
    const restantes = new Set<string>(CAMADAS);
    while (restantes.size > 0) {
      const pronta = [...restantes].find((c) => PODE_IMPORTAR[c as Camada].every((d) => feitos.has(d)));
      expect(pronta, `ciclo entre: ${[...restantes].join(', ')}`).toBeDefined();
      feitos.add(pronta as string);
      restantes.delete(pronta as string);
    }
  });
});

describe('importes entre camadas: matriz completa 11 x 11 (mutação)', () => {
  it('importar de cada camada, a partir de cada camada, reprova exatamente quando o plano proíbe', () => {
    let casos = 0;
    for (const de of CAMADAS) {
      for (const para of CAMADAS) {
        const v = analisarArquivo(`${de}/mutante.ts`, `import { x } from '../${para}/index';\nexport const y = x;\n`);
        const permitido = de === para || (PLANO[de] as string[]).includes(para);
        expect(regras(v), `${de} -> ${para}`).toEqual(permitido ? [] : ['camada']);
        casos++;
      }
    }
    expect(casos).toBe(121);
  });

  it('pega todas as formas de importe: type, export from, efeito, dinâmico literal, glob', () => {
    const formas = [
      `import type { X } from '../descida/index';`,
      `import { A,\n  B } from "../descida/motor";`,
      `export * from '../descida/index';`,
      `export { motor } from '../descida/motor';`,
      `export type { T } from '../descida/tipos';`,
      `import '../descida/efeito';`,
      `const m = await import('../descida/motor');`,
      `const g = import.meta.glob('../descida/*.ts');`,
      `const g = import.meta.glob(['./ok.ts', '../descida/*.ts'], { eager: true });`,
    ];
    for (const forma of formas) expect(regras(analisarArquivo('render/x.ts', forma)), forma).toContain('camada');
  });

  it('import dinâmico com argumento que não é texto literal reprova (não dá para conferir a camada)', () => {
    expect(regras(analisarArquivo('core/x.ts', 'const n = "a"; await import(n);'))).toContain('importe-dinamico');
    expect(regras(analisarArquivo('core/x.ts', 'await import(`../descida/${n}`);'))).toContain('importe-dinamico');
  });

  it('importe que sai de src/, pacote externo e pasta desconhecida reprovam', () => {
    expect(regras(analisarArquivo('ui/x.ts', `import { t } from '../../tests/support/varredura';`))).toEqual(['sai-de-src']);
    expect(regras(analisarArquivo('ui/x.ts', `import fs from 'node:fs';`))).toEqual(['pacote-externo']);
    expect(regras(analisarArquivo('ui/x.ts', `import { z } from 'zod';`))).toEqual(['pacote-externo']);
    expect(regras(analisarArquivo('ui/x.ts', `import u from '../lixo/util';`))).toEqual(['pasta-desconhecida']);
    expect(regras(analisarArquivo('lixo/x.ts', `export const a = 1;`))).toEqual(['pasta-desconhecida']);
  });

  it('importes dentro da mesma camada, de subpastas e do próprio arquivo raiz passam', () => {
    expect(analisarArquivo('ui/cenas/titulo.ts', `import { a } from '../contexto';\nimport { b } from './outra';\nimport { c } from '../../core/rng';`)).toEqual([]);
    expect(analisarArquivo('core/a.ts', `import { b } from './b';\nimport { c } from '../core/c';`)).toEqual([]);
  });

  it('arquivos soltos da raiz: main importa tudo; versao só ui/platform/main; css só main', () => {
    expect(analisarArquivo('main.ts', `${CAMADAS.map((c) => `import './${c}/index';`).join('\n')}\nimport './estilo.css';\nimport { V } from './versao';`)).toEqual([]);
    for (const c of CAMADAS) {
      const v = analisarArquivo(`${c}/x.ts`, `import { V } from '../versao';`);
      expect(regras(v), `${c} importando versao`).toEqual(['ui', 'platform'].includes(c) ? [] : ['camada']);
    }
    expect(regras(analisarArquivo('core/x.ts', `import '../main';`))).toEqual(['camada']);
    expect(regras(analisarArquivo('versao.ts', `import './core/rng';`))).toEqual(['camada']);
  });
});

describe('textos proibidos: cada regra reprova nas camadas em que vale e só nelas (mutação)', () => {
  /** Um exemplo mínimo de código que casa com cada regra. */
  const EXEMPLOS: Readonly<Record<string, string>> = {
    'Math.random': 'export const a = Math.random();',
    'Math fora da lista': 'export const a = Math.sin(1);',
    'operador **': 'export const a = 2 ** 8;',
    'Intl/toLocale': 'export const a = (1).toLocaleString();',
    'Date': 'export const a = Date.now();',
    'performance': 'export const a = performance.now();',
    'timer': 'export const a = setTimeout(() => 1, 0);',
    'crypto': 'export const a = crypto.getRandomValues(new Uint32Array(1));',
    'eval/Function': 'export const a = eval("1");',
    'ambiente global': 'export const a = window.innerWidth;',
  };

  it('há exemplo para toda regra, e nenhum exemplo sobrando', () => {
    expect(Object.keys(EXEMPLOS).sort()).toEqual(REGRAS_DE_TEXTO.map((r) => r.id).sort());
  });

  it('cada regra casa o seu exemplo em toda camada em que vale, e em nenhuma outra', () => {
    for (const regra of REGRAS_DE_TEXTO) {
      const codigo = EXEMPLOS[regra.id] as string;
      for (const camada of CAMADAS) {
        const acusadas = analisarArquivo(`${camada}/mutante.ts`, codigo).filter((v) => v.regra === 'texto-proibido' && v.detalhe.includes(`[${regra.id}]`));
        const vale = regra.camadas === 'todas' || regra.camadas.includes(camada);
        expect(acusadas.length > 0, `${regra.id} em ${camada}/`).toBe(vale);
      }
    }
  });

  it('o escopo é o do plano: determinismo em core/pista/descida; Math.random em todas; relógio também no audio', () => {
    const escopo = (id: string): string[] => {
      const r = REGRAS_DE_TEXTO.find((x) => x.id === id);
      return r === undefined ? [] : r.camadas === 'todas' ? [...CAMADAS] : [...r.camadas];
    };
    expect(escopo('Math.random').sort()).toEqual([...CAMADAS].sort());
    expect(escopo('Math fora da lista').sort()).toEqual(['core', 'descida', 'pista']);
    expect(escopo('operador **').sort()).toEqual(['core', 'descida', 'pista']);
    expect(escopo('Date').sort()).toEqual(['audio', 'core', 'descida', 'pista']);
    expect(escopo('performance').sort()).toEqual(['audio', 'core', 'descida', 'pista']);
  });

  it('as funções que o plano proíbe no motor reprovam uma a uma em descida/, pista/ e core/', () => {
    const proibidas = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh', 'pow', 'exp', 'expm1', 'log', 'log2', 'log10', 'log1p', 'cbrt', 'hypot'];
    for (const camada of ['descida', 'pista', 'core']) {
      for (const f of proibidas) {
        expect(regras(analisarArquivo(`${camada}/m.ts`, `export const v = Math.${f}(1, 2);`)), `${camada}: Math.${f}`).toContain('texto-proibido');
      }
    }
    // e o que é exato pelo padrão passa
    const permitidas = ['abs', 'ceil', 'floor', 'round', 'trunc', 'sign', 'min', 'max', 'sqrt', 'imul', 'fround', 'clz32'];
    for (const f of permitidas) expect(analisarArquivo('descida/m.ts', `export const v = Math.${f}(4, 2);`), `Math.${f}`).toEqual([]);
    expect(analisarArquivo('descida/m.ts', 'export const v = Math.PI + Math.SQRT2;')).toEqual([]);
  });

  it('formas disfarçadas também reprovam: Math atribuído, desestruturado, indexado, **=, new Date, template', () => {
    const disfarces = [
      'const m = Math; export const a = m.sin(1);',
      'const { sin } = Math; export const a = sin(1);',
      "export const a = Math['sin'](1);",
      'let x = 2; x **= 3; export { x };',
      'export const a = new Date();',
      'export const a = `${Math.cos(1)}`;',
      'export const a = Math  .  atan2(1, 2);',
      'export const a = Math\n  .pow(2, 3);',
    ];
    for (const d of disfarces) expect(regras(analisarArquivo('descida/m.ts', d)), d).toContain('texto-proibido');
  });

  it('comentário, string e regex que citam a função NÃO reprovam (sem falso positivo)', () => {
    const inocentes = [
      '// Math.sin e Math.random só em comentário\nexport const a = 1;',
      '/* Math.pow(2, 3) e Date.now() */ export const a = 1;',
      '/**\n * usa Math.atan2? não.\n */\nexport const a = 1;',
      "export const a = 'Math.sin(1)';",
      'export const a = "Date.now() ** 2";',
      'export const a = `texto com Math.cos e ${1 + 1} e performance`;',
      'export const a = /Math\\.sin\\(/.test("x");',
      "export const a = 10 / 2 / 5; // divisão, não regex 'Math.sin'",
      "export const r = (x: number) => x / 2; export const s = 'Date';",
    ];
    for (const i of inocentes) expect(analisarArquivo('descida/m.ts', i), i).toEqual([]);
  });

  it('plantar o defeito num arquivo REAL de cada camada pura faz a varredura reprovar (e remover, passar)', () => {
    const fontes = lerFontesDoDisco(RAIZ_SRC);
    expect(formatarViolacoes(varrerFontes(fontes))).toBe('');
    for (const alvo of ['core/rng.ts', 'core/trig.ts', 'core/hash.ts', 'core/laco.ts']) {
      const original = fontes[alvo] as string;
      for (const defeito of ['export const _x = Math.sin(1);', 'export const _x = Math.random();', 'export const _x = Date.now();', "import { x } from '../descida/index';"]) {
        const mutante = { ...fontes, [alvo]: `${original}\n${defeito}\n` };
        const v = varrerFontes(mutante);
        expect(v.length, `${alvo} + ${defeito}`).toBeGreaterThan(0);
        expect(v.every((x) => x.arquivo === alvo), `só ${alvo} deve ser acusado`).toBe(true);
      }
    }
    // crio uma camada nova com o defeito de importe: o plano proíbe core importar de qualquer outra
    const v = varrerFontes({ ...fontes, 'core/novo.ts': "import { r } from '../render/index';" });
    expect(regras(v)).toEqual(['camada']);
  });

  it('o número da linha acusada é o da linha do defeito', () => {
    const v = analisarArquivo('descida/m.ts', 'export const a = 1;\n\n// nada aqui\nexport const b = Math.sin(1);\n');
    expect(v).toHaveLength(1);
    expect(v[0]?.linha).toBe(4);
  });
});

describe('o limpador léxico preserva posições e quebras de linha', () => {
  it('mesmo tamanho e mesmas quebras, com e sem strings', () => {
    const t = "const a = 'x\\'y'; // c\n/* m\nn */ const b = `a${'}'}b`;\nconst r = /[/]'/g;\n";
    for (const manter of [true, false]) {
      const l = limparFonte(t, manter);
      expect(l.length).toBe(t.length);
      expect([...l].map((c) => c === '\n')).toEqual([...t].map((c) => c === '\n'));
    }
  });

  it('expressões de template são código; o texto do template não é', () => {
    const l = limparFonte('const a = `Math.sin ${Math.cos(1)} Date`;', false);
    expect(l).toContain('Math.cos');
    expect(l).not.toContain('Math.sin');
    expect(l).not.toContain('Date');
  });
});

describe('a varredura em disco (o mesmo caminho que o teste real usa) também reprova', () => {
  it('copia um mini src/ para uma pasta temporária, planta o defeito e confere', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'neve-varredura-'));
    try {
      mkdirSync(join(tmp, 'core'), { recursive: true });
      mkdirSync(join(tmp, 'descida'), { recursive: true });
      writeFileSync(join(tmp, 'core', 'a.ts'), 'export const a = 1;\n');
      writeFileSync(join(tmp, 'descida', 'm.ts'), "import { a } from '../core/a';\nexport const m = a + 1;\n");
      expect(formatarViolacoes(varrerFontes(lerFontesDoDisco(tmp)))).toBe('');

      writeFileSync(join(tmp, 'descida', 'm.ts'), "import { a } from '../core/a';\nexport const m = Math.exp(a);\n");
      const v = varrerFontes(lerFontesDoDisco(tmp));
      expect(v).toHaveLength(1);
      expect(v[0]).toMatchObject({ arquivo: 'descida/m.ts', linha: 2, regra: 'texto-proibido' });

      writeFileSync(join(tmp, 'core', 'a.ts'), "import { m } from '../descida/m';\nexport const a = 1;\n");
      writeFileSync(join(tmp, 'descida', 'm.ts'), 'export const m = 1;\n');
      expect(regras(varrerFontes(lerFontesDoDisco(tmp)))).toEqual(['camada']);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
