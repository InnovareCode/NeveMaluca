import { describe, expect, it } from 'vitest';
import { criarAviso, DURACAO_AVISO_MS, type ElementoAviso } from '../../src/platform/aviso';
import { mostrarErro, textoDoErro } from '../../src/platform/erros';

/** Documento falso com só o que mostrarErro usa. */
function docComCaixa() {
  const caixa = { textContent: '', hidden: true };
  const doc = { getElementById: (id: string) => (id === 'err' ? caixa : null) } as unknown as Document;
  return { caixa, doc };
}

describe('erros na tela (#err)', () => {
  it('mostra a mensagem e tira o atributo hidden (nada de style=, que a CSP do build proíbe)', () => {
    const { caixa, doc } = docComCaixa();
    mostrarErro('quebrou', doc);
    expect(caixa).toEqual({ textContent: 'quebrou', hidden: false });
  });

  it('erros seguidos se acumulam, um por linha', () => {
    const { caixa, doc } = docComCaixa();
    mostrarErro('a', doc);
    mostrarErro('b', doc);
    expect(caixa.textContent).toBe('a\nb');
  });

  it('sem a caixa no HTML não faz nada (não lança)', () => {
    const doc = { getElementById: () => null } as unknown as Document;
    expect(() => mostrarErro('x', doc)).not.toThrow();
  });

  it('textoDoErro usa a pilha de um Error (formato do V8: já traz "Nome: mensagem") e o texto de qualquer outra coisa', () => {
    const e = new Error('boom');
    expect(e.stack).toContain('boom'); // premissa do V8, que roda o vitest
    expect(textoDoErro(e)).toBe(e.stack);
    expect(textoDoErro('texto')).toBe('texto');
    expect(textoDoErro(42)).toBe('42');
  });

  it('formato do WebKit (iPhone): a pilha não traz a mensagem, e o texto começa por "Nome: mensagem" com a pilha depois', () => {
    const e = new TypeError('x.y is not a function');
    e.stack = 'desenhar@http://192.168.0.5:5273/src/main.ts:61:18\n quadro@http://192.168.0.5:5273/src/platform/laco.ts:72:9\n global code@';
    const texto = textoDoErro(e);
    expect(texto.startsWith('TypeError: x.y is not a function' + '\n')).toBe(true);
    expect(texto).toContain('desenhar@http://192.168.0.5:5273/src/main.ts:61:18');
    expect(texto.split('\n')).toHaveLength(4);
  });

  it('pilha ausente: só "Nome: mensagem"; pilha que já contém a mensagem (V8) não duplica', () => {
    const sem = new RangeError('fora da faixa');
    delete (sem as { stack?: string }).stack;
    expect(textoDoErro(sem)).toBe('RangeError: fora da faixa');
    const com = new Error('boom');
    com.stack = 'Error: boom\n    at f (a.js:1:1)';
    expect(textoDoErro(com)).toBe('Error: boom\n    at f (a.js:1:1)');
  });
});

describe('aviso discreto', () => {
  function relogio() {
    const fila = new Map<number, { fn: () => void; ms: number }>();
    let n = 0;
    return {
      agendar: (fn: () => void, ms: number) => (fila.set(++n, { fn, ms }), n),
      cancelar: (id: unknown) => void fila.delete(id as number),
      pendentes: () => fila.size,
      disparar: () => {
        for (const [id, x] of [...fila]) {
          fila.delete(id);
          x.fn();
        }
      },
      prazos: () => [...fila.values()].map((x) => x.ms),
    };
  }
  const elemento = (): ElementoAviso => ({ textContent: '', hidden: true });

  it('mostra e some sozinho depois de 6 s', () => {
    const el = elemento();
    const r = relogio();
    const avisar = criarAviso(el, r);
    avisar('oi');
    expect(el).toEqual({ textContent: 'oi', hidden: false });
    expect(r.prazos()).toEqual([DURACAO_AVISO_MS]);
    r.disparar();
    expect(el).toEqual({ textContent: '', hidden: true });
  });

  it('repetir enquanto visível só renova o prazo (um único timer)', () => {
    const el = elemento();
    const r = relogio();
    const avisar = criarAviso(el, r);
    avisar('a');
    avisar('a');
    expect(r.pendentes()).toBe(1);
  });

  it('sem o elemento vira no-op', () => {
    expect(() => criarAviso(null)('x')).not.toThrow();
  });
});
