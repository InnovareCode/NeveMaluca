/**
 * Comandos (C2), replay RLE + base64 (C6) e validação de dado externo. Inclui ida e volta por propriedade, fuzz do
 * decodificador (nunca lança, nunca passa do teto) e as armadilhas de base64 não canônico.
 */
import { describe, expect, it } from 'vitest';
import {
  COMANDO_NEUTRO,
  INPUT_NEUTRO,
  byteDoComando,
  comandoDoByte,
  derivarComando,
  validarComandoDescida,
  validarInputFrame,
} from '../../src/core/comandos';
import { TETO_TICKS_REPLAY } from '../../src/core/constantes';
import { GRABS, type ComandoDescida, type Giro, type Grab, type InputFrame, type ReplayV1 } from '../../src/core/contratos';
import {
  base64Codificar,
  base64Decodificar,
  codificarComandos,
  decodificarComandos,
  tamanhoMaximoDoTexto,
  validarReplayV1,
} from '../../src/core/replay';
import { criarRng, type Rng } from '../../src/core/rng';

const cmd = (pulo = false, giro: Giro = 0, grab: Grab | null = null, agachar = false): ComandoDescida => ({ pulo, giro, grab, agachar });

/** Comando aleatório, com viés para repetir o anterior (como numa corrida real: poucas mudanças). */
function sequenciaAleatoria(rng: Rng, n: number, repetir = 0.8): ComandoDescida[] {
  const saida: ComandoDescida[] = [];
  let atual = cmd();
  for (let i = 0; i < n; i++) {
    if (i === 0 || rng.proximo() > repetir) {
      atual = cmd(rng.proximo() < 0.3, rng.escolher<Giro>([-1, 0, 1]), rng.proximo() < 0.3 ? rng.escolher<Grab>([...GRABS]) : null, rng.proximo() < 0.4);
    }
    saida.push(atual);
  }
  return saida;
}

function exigirOk<T>(r: { ok: true; valor: T } | { ok: false; erros: readonly string[] }): T {
  if (!r.ok) throw new Error(`esperava ok, veio falha: ${r.erros.join('; ')}`);
  return r.valor;
}

describe('byte do comando', () => {
  it('as 2 x 2 x 3 x 5 = 60 combinações têm bytes distintos e voltam iguais (bijeção)', () => {
    const bytes = new Set<number>();
    for (const pulo of [false, true]) {
      for (const agachar of [false, true]) {
        for (const giro of [-1, 0, 1] as const) {
          for (const grab of [null, ...GRABS] as const) {
            const c = cmd(pulo, giro, grab, agachar);
            const b = byteDoComando(c);
            expect(b).toBeGreaterThanOrEqual(0);
            expect(b).toBeLessThan(128);
            expect(comandoDoByte(b)).toEqual(c);
            bytes.add(b);
          }
        }
      }
    }
    expect(bytes.size).toBe(60);
  });

  it('o layout documentado: pulo=bit0, giro=bits1-2 (0,+1,-1), grab=bits3-5, agachar=bit6', () => {
    expect(byteDoComando(COMANDO_NEUTRO)).toBe(0);
    expect(byteDoComando(cmd(true))).toBe(1);
    expect(byteDoComando(cmd(false, 1))).toBe(2);
    expect(byteDoComando(cmd(false, -1))).toBe(4);
    expect(byteDoComando(cmd(false, 0, 'cima'))).toBe(8);
    expect(byteDoComando(cmd(false, 0, 'tras'))).toBe(32);
    expect(byteDoComando(cmd(false, 0, null, true))).toBe(64);
    expect(byteDoComando(cmd(true, -1, 'tras', true))).toBe(1 | 4 | 32 | 64);
  });

  it('bytes inválidos dão null: bit reservado, giro 3, grab 5 a 7, fora de 0..127, não inteiro', () => {
    const invalidos = [128, 255, 256, -1, 1.5, NaN, 6, 7, 40, 48, 56, 0b0000110];
    for (const b of invalidos) expect(comandoDoByte(b), String(b)).toBeNull();
    // exatamente 60 dos valores possíveis são válidos
    let validos = 0;
    for (let b = -5; b < 300; b++) if (comandoDoByte(b) !== null) validos++;
    expect(validos).toBe(60);
  });

  it('byteDoComando lança em comando mal formado', () => {
    const ruins = [
      { pulo: 1, giro: 0, grab: null, agachar: false },
      { pulo: false, giro: 2, grab: null, agachar: false },
      { pulo: false, giro: 0, grab: 'esquerda', agachar: false },
      { pulo: false, giro: NaN, grab: null, agachar: false },
      { pulo: false, giro: 0, grab: null, agachar: 'sim' },
    ];
    for (const r of ruins) expect(() => byteDoComando(r as unknown as ComandoDescida), JSON.stringify(r)).toThrow(TypeError);
  });
});

describe('derivarComando: a borda do pulo', () => {
  const solto: InputFrame = { ...INPUT_NEUTRO };
  const segurado: InputFrame = { ...INPUT_NEUTRO, pular: true };

  it('pulo só no tick em que o botão passa de solto para segurado', () => {
    const quadros = [solto, segurado, segurado, segurado, solto, segurado];
    const pulos: boolean[] = [];
    let anterior: InputFrame | null = null;
    for (const q of quadros) {
      pulos.push(derivarComando(anterior, q).pulo);
      anterior = q;
    }
    expect(pulos).toEqual([false, true, false, false, false, true]);
  });

  it('primeiro quadro (anterior = null) já segurando conta como aperto; os outros campos passam direto', () => {
    expect(derivarComando(null, segurado).pulo).toBe(true);
    const c = derivarComando(solto, { pular: false, giro: -1, grab: 'frente', agachar: true });
    expect(c).toEqual({ pulo: false, giro: -1, grab: 'frente', agachar: true });
  });

  it('os neutros são imutáveis (congelados)', () => {
    expect(Object.isFrozen(COMANDO_NEUTRO)).toBe(true);
    expect(Object.isFrozen(INPUT_NEUTRO)).toBe(true);
  });
});

describe('validarComandoDescida / validarInputFrame (dado de fora)', () => {
  it('aceita e devolve cópia limpa só com os 4 campos (campo extra some; -0 vira 0)', () => {
    const r = exigirOk(validarComandoDescida({ pulo: true, giro: -0, grab: 'cima', agachar: false, extra: 'lixo', __proto__: { x: 1 } }));
    expect(r).toEqual({ pulo: true, giro: 0, grab: 'cima', agachar: false });
    expect(Object.is(r.giro, 0)).toBe(true);
    expect(Object.keys(r).sort()).toEqual(['agachar', 'giro', 'grab', 'pulo']);
  });

  it('rejeita tipo errado em cada campo, ausência de campo e valores que não são objeto', () => {
    const ok = { pulo: false, giro: 0, grab: null, agachar: false };
    const ruins: unknown[] = [
      null, undefined, 3, 'x', [], [true],
      { ...ok, pulo: 0 }, { ...ok, pulo: undefined }, { ...ok, giro: 2 }, { ...ok, giro: '1' }, { ...ok, giro: 0.5 }, { ...ok, giro: NaN },
      { ...ok, grab: 'baixo ' }, { ...ok, grab: 1 }, { ...ok, grab: undefined }, { ...ok, agachar: 'false' },
      { giro: 0, grab: null, agachar: false }, {},
    ];
    for (const r of ruins) expect(validarComandoDescida(r).ok, JSON.stringify(r)).toBe(false);
  });

  it('o erro diz qual campo está errado', () => {
    const r = validarComandoDescida({ pulo: 'sim', giro: 9, grab: 'x', agachar: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.erros.join('|')).toMatch(/pulo.*giro.*agachar.*grab|pulo.*agachar.*giro.*grab/s);
      expect(r.erros).toHaveLength(4);
    }
  });

  it('validarInputFrame usa os nomes do InputFrame (pular, não pulo) nas mensagens', () => {
    expect(exigirOk(validarInputFrame({ pular: true, giro: 1, grab: null, agachar: false }))).toEqual({ pular: true, giro: 1, grab: null, agachar: false });
    const r = validarInputFrame({ pular: 'x', giro: 0, grab: null, agachar: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[0]).toMatch(/input\.pular/);
    expect(validarInputFrame(null).ok).toBe(false);
  });
});

describe('base64', () => {
  it('vetores do RFC 4648', () => {
    const t = (s: string): string => base64Codificar([...s].map((c) => c.charCodeAt(0)));
    expect([t(''), t('f'), t('fo'), t('foo'), t('foob'), t('fooba'), t('foobar')]).toEqual(['', 'Zg==', 'Zm8=', 'Zm9v', 'Zm9vYg==', 'Zm9vYmE=', 'Zm9vYmFy']);
  });

  it('propriedade: ida e volta de bytes aleatórios (tamanhos 0 a 100) e igualdade com o btoa do Node', () => {
    const rng = criarRng(4);
    for (let i = 0; i < 500; i++) {
      const bytes = Uint8Array.from({ length: rng.inteiro(101) }, () => rng.inteiro(256));
      const texto = base64Codificar(bytes);
      expect(texto).toBe(Buffer.from(bytes).toString('base64'));
      expect(base64Decodificar(texto)).toEqual(bytes);
    }
  });

  it('rejeita o que não é canônico: tamanho errado, caractere fora do alfabeto, = no meio, bits sobrando, url-safe', () => {
    const ruins = ['Zg=', 'Zg', 'Zm9', 'Zm9v=', '=m9v', 'Z=9v', 'Zg=a', 'Zh==', 'Zm9=', 'Zm 9v', 'Zm9v\n', 'Zm-v', 'Zm_v', '====', 'A==='];
    for (const r of ruins) expect(base64Decodificar(r), JSON.stringify(r)).toBeNull();
    // a mesma coisa com os bits sobrando zerados é aceita
    expect(base64Decodificar('Zg==')).toEqual(Uint8Array.of(102));
  });
});

describe('RLE dos comandos: ida e volta', () => {
  it('lista vazia, um tick e a corrida inteira sem toque', () => {
    expect(codificarComandos([])).toBe('');
    expect(exigirOk(decodificarComandos(''))).toEqual([]);
    expect(exigirOk(decodificarComandos(codificarComandos([cmd(true)])))).toEqual([cmd(true)]);
    const parada = Array.from({ length: 5400 }, () => COMANDO_NEUTRO);
    const texto = codificarComandos(parada);
    expect(exigirOk(decodificarComandos(texto))).toHaveLength(5400);
    expect(texto.length).toBeLessThan(100); // 90 s sem tocar em nada: dezenas de caracteres, não milhares
  });

  it('corridas acima de 255 ticks iguais são partidas em vários pares e voltam inteiras', () => {
    for (const n of [254, 255, 256, 257, 510, 511, 1000]) {
      const seq = Array.from({ length: n }, () => cmd(false, 1));
      const volta = exigirOk(decodificarComandos(codificarComandos(seq)));
      expect(volta, `n=${n}`).toHaveLength(n);
      expect(volta.every((c) => c.giro === 1)).toBe(true);
    }
  });

  it('o formato é o documentado (pares [byte, repetições], base64): 3 neutros + pulo => AwA... conferido byte a byte', () => {
    const texto = codificarComandos([COMANDO_NEUTRO, COMANDO_NEUTRO, COMANDO_NEUTRO, cmd(true)]);
    expect([...Buffer.from(texto, 'base64')]).toEqual([0, 3, 1, 1]);
  });

  it('propriedade: 400 corridas aleatórias (0 a 2000 ticks, mais ou menos repetitivas) voltam idênticas', () => {
    const rng = criarRng(2026);
    for (let i = 0; i < 400; i++) {
      const seq = sequenciaAleatoria(rng, rng.inteiro(2001), rng.entre(0, 0.99));
      const texto = codificarComandos(seq);
      const volta = exigirOk(decodificarComandos(texto));
      expect(volta, `corrida ${i}`).toEqual(seq);
      expect(codificarComandos(volta), `recodificar ${i}`).toBe(texto); // representação única
    }
  });

  it('o pior caso (todo tick diferente do vizinho) cabe no tamanho máximo declarado', () => {
    const n = TETO_TICKS_REPLAY;
    const seq = Array.from({ length: n }, (_, i) => cmd(i % 2 === 0));
    const texto = codificarComandos(seq);
    expect(texto.length).toBeLessThanOrEqual(tamanhoMaximoDoTexto(n));
    expect(exigirOk(decodificarComandos(texto))).toHaveLength(n);
  });

  it('o decodificador devolve objetos compartilhados e congelados (no máximo 60 distintos)', () => {
    const volta = exigirOk(decodificarComandos(codificarComandos(sequenciaAleatoria(criarRng(1), 3000, 0.5))));
    expect(new Set(volta).size).toBeLessThanOrEqual(60);
    expect(volta.every((c) => Object.isFrozen(c))).toBe(true);
  });

  it('codificar lança em comando mal formado', () => {
    expect(() => codificarComandos([{ pulo: true, giro: 3, grab: null, agachar: false } as unknown as ComandoDescida])).toThrow(TypeError);
  });
});

describe('decodificador estrito (dado de fora)', () => {
  const b64 = (bytes: number[]): string => Buffer.from(bytes).toString('base64');

  it('rejeita: repetição 0, par incompleto, byte de comando inválido, base64 inválido', () => {
    expect(decodificarComandos(b64([0, 0])).ok).toBe(false);
    expect(decodificarComandos(b64([0, 3, 1])).ok).toBe(false);
    expect(decodificarComandos(b64([128, 1])).ok).toBe(false);
    expect(decodificarComandos(b64([7, 1])).ok).toBe(false); // giro 3
    expect(decodificarComandos('isso não é base64!').ok).toBe(false);
    expect(decodificarComandos(123 as unknown as string).ok).toBe(false);
  });

  it('respeita o teto de ticks ANTES de alocar: 2 bytes pedindo 255 ticks x muitas vezes não vira memória', () => {
    const muitos = b64(Array.from({ length: 2 * 5000 }, (_, i) => (i % 2 === 0 ? 0 : 255)));
    expect(decodificarComandos(muitos).ok).toBe(false); // 5000 x 255 ticks
    expect(decodificarComandos(muitos, 5000 * 255).ok).toBe(true);
    const r = decodificarComandos(b64([0, 255, 0, 255]), 509);
    expect(r.ok).toBe(false);
    expect(decodificarComandos(b64([0, 255, 0, 255]), 510).ok).toBe(true);
  });

  it('texto gigante é recusado pelo tamanho, sem decodificar', () => {
    const r = decodificarComandos('A'.repeat(tamanhoMaximoDoTexto(TETO_TICKS_REPLAY) + 4));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros[0]).toMatch(/grande demais/);
  });

  it('fuzz: 20 mil textos aleatórios (base64 válido ou lixo) NUNCA lançam, e quando ok respeitam o teto', () => {
    const rng = criarRng(666);
    const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=-_ \n';
    let oks = 0;
    for (let i = 0; i < 20000; i++) {
      let texto: string;
      if (i % 2 === 0) {
        texto = Array.from({ length: rng.inteiro(60) }, () => alfabeto[rng.inteiro(alfabeto.length)]).join('');
      } else {
        texto = Buffer.from(Uint8Array.from({ length: rng.inteiro(40) }, () => (rng.proximo() < 0.5 ? rng.inteiro(130) : rng.inteiro(256)))).toString('base64');
      }
      const r = decodificarComandos(texto, 3000);
      if (r.ok) {
        oks++;
        if (r.valor.length > 3000) throw new Error('passou do teto');
      }
    }
    expect(oks).toBeGreaterThan(0);
  });
});

describe('validarReplayV1', () => {
  const comandos = codificarComandos(sequenciaAleatoria(criarRng(3), 600));
  const bom: ReplayV1 = {
    v: 1,
    pista: 'bosque-1',
    hashPista: '0123456789abcdef',
    semente: 4000000000,
    personagem: 'kaka',
    versaoMotor: 'm1.0',
    comandos,
    resultado: { pontos: 12345, ticks: 600, hashFinal: 'fedcba9876543210' },
  };

  it('aceita um replay bom e devolve cópia só com os campos conhecidos', () => {
    const r = exigirOk(validarReplayV1({ ...bom, extra: 'lixo', resultado: { ...bom.resultado, extra: 1 } }));
    expect(r).toEqual(bom);
    expect(Object.keys(r).sort()).toEqual(Object.keys(bom).sort());
  });

  it('sobrevive a JSON (ida e volta por texto) e à serialização do save', () => {
    expect(exigirOk(validarReplayV1(JSON.parse(JSON.stringify(bom))))).toEqual(bom);
  });

  it('rejeita cada campo ruim, com mensagem que cita o campo', () => {
    const mutacoes: [string, (o: Record<string, unknown>) => void][] = [
      ['replay.v', (o) => { o['v'] = 2; }],
      ['replay.pista', (o) => { o['pista'] = 'Bosque 1'; }],
      ['replay.pista', (o) => { o['pista'] = ''; }],
      ['replay.hashPista', (o) => { o['hashPista'] = '0123456789ABCDEF'; }],
      ['replay.hashPista', (o) => { o['hashPista'] = 'abc'; }],
      ['replay.semente', (o) => { o['semente'] = -1; }],
      ['replay.semente', (o) => { o['semente'] = 2 ** 32; }],
      ['replay.semente', (o) => { o['semente'] = 1.5; }],
      ['replay.personagem', (o) => { o['personagem'] = '../x'; }],
      ['replay.versaoMotor', (o) => { o['versaoMotor'] = ''; }],
      ['replay.versaoMotor', (o) => { o['versaoMotor'] = 'x'.repeat(33); }],
      ['replay.comandos', (o) => { o['comandos'] = 7; }],
      ['replay.comandos', (o) => { o['comandos'] = '!!!!'; }],
      ['replay.resultado', (o) => { o['resultado'] = null; }],
      ['replay.resultado.pontos', (o) => { o['resultado'] = { ...bom.resultado, pontos: -1 }; }],
      ['replay.resultado.pontos', (o) => { o['resultado'] = { ...bom.resultado, pontos: 1e9 }; }],
      ['replay.resultado.pontos', (o) => { o['resultado'] = { ...bom.resultado, pontos: 1.5 }; }],
      ['replay.resultado.ticks', (o) => { o['resultado'] = { ...bom.resultado, ticks: TETO_TICKS_REPLAY + 1 }; }],
      ['replay.resultado.ticks', (o) => { o['resultado'] = { ...bom.resultado, ticks: 601 }; }], // mais ticks que comandos
      ['replay.resultado.hashFinal', (o) => { o['resultado'] = { ...bom.resultado, hashFinal: 'xyz' }; }],
    ];
    for (const [campo, mutar] of mutacoes) {
      const o: Record<string, unknown> = { ...bom };
      mutar(o);
      const r = validarReplayV1(o);
      expect(r.ok, campo).toBe(false);
      if (!r.ok) expect(r.erros.some((e) => e.startsWith(campo)), `${campo} => ${r.erros.join(' | ')}`).toBe(true);
    }
  });

  it('rejeita o que não é objeto e campo ausente', () => {
    for (const x of [null, undefined, 1, 'x', [], [bom]]) expect(validarReplayV1(x).ok).toBe(false);
    for (const campo of Object.keys(bom)) {
      const o: Record<string, unknown> = { ...bom };
      delete o[campo];
      expect(validarReplayV1(o).ok, `sem ${campo}`).toBe(false);
    }
  });

  it('acumula todos os erros de uma vez (a tela de erro mostra tudo, não um por tentativa)', () => {
    const r = validarReplayV1({ ...bom, v: 9, pista: '!', semente: -3 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erros.length).toBeGreaterThanOrEqual(3);
  });

  it('o teto de ticks é parâmetro (replay curto de teste pode exigir menos)', () => {
    expect(validarReplayV1(bom, 599).ok).toBe(false);
    expect(validarReplayV1(bom, 600).ok).toBe(true);
  });
});
