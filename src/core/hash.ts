/**
 * Hash estável de dados e de pistas (plano §3.4: `hashEsperado`). FNV-1a de 64 bits, com os bytes alimentados em ordem
 * e formato fixos, para dar o MESMO resultado em qualquer navegador/Node/máquina.
 *
 * Para que serve: travar a saída do gerador de pista (qualquer mudança nele muda o hash e o teste falha), conferir
 * dados no boot e fechar o `hashFinal` do replay. NÃO é criptográfico (FNV não resiste a quem quer forçar colisão):
 * serve para detectar mudança acidental, não para autenticar. Um ranking online verificável reexecuta o replay no
 * servidor; o hash só precisa dizer "a corrida refeita é a mesma".
 *
 * Por que 64 bits em 32+32: o JS não tem inteiro de 64 bits barato. A multiplicação pelo primo FNV (2^40 + 0x1b3) é
 * feita em duas metades de 32 bits com aritmética exata de double (produtos < 2^53); o teste confere contra um
 * oráculo em BigInt e contra os vetores publicados do FNV-1a 64.
 *
 * Formato dos números: f64 em little-endian explícito (DataView), -0 vira +0 e NaN vira um padrão único, para o hash
 * não depender de como o motor guarda um NaN nem de um zero com sinal que não muda nada no jogo.
 */
import { ErroDeContrato } from './erros';

/** 16 dígitos hexadecimais minúsculos. */
export const FORMATO_HASH = /^[0-9a-f]{16}$/;

const BASE_HI = 0xcbf29ce4;
const BASE_LO = 0x84222325;
/** Parte baixa do primo FNV-64 = 2^40 + 0x1b3 (435). */
const PRIMO_BAIXO = 0x1b3;
const DOIS_32 = 4294967296;

const bufF64 = new DataView(new ArrayBuffer(8));

export class Hasher {
  private hi = BASE_HI;
  private lo = BASE_LO;

  /** Um byte (0 a 255). Fora disso lança: seria bug de quem chama, e hash silenciosamente errado é o pior caso. */
  byte(b: number): this {
    if (!Number.isInteger(b) || b < 0 || b > 255) throw new RangeError(`byte fora de 0..255: ${String(b)}`);
    const lo = (this.lo ^ b) >>> 0;
    const hi = this.hi;
    // (hi:lo) * (2^40 + 435) mod 2^64
    const p = lo * PRIMO_BAIXO; // < 2^41, exato
    const novoLo = p % DOIS_32;
    const carry = (p - novoLo) / DOIS_32;
    const deslocado = ((lo & 0xffffff) << 8) >>> 0; // (lo * 2^40) mod 2^64, só a metade alta
    this.hi = (hi * PRIMO_BAIXO + carry + deslocado) % DOIS_32;
    this.lo = novoLo;
    return this;
  }

  bytes(lista: ArrayLike<number>): this {
    for (let i = 0; i < lista.length; i++) this.byte(lista[i] as number);
    return this;
  }

  booleano(v: boolean): this {
    return this.byte(v ? 1 : 0);
  }

  /** uint32, little-endian. */
  u32(n: number): this {
    if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) throw new RangeError(`u32 fora de 0..2^32-1: ${String(n)}`);
    return this.byte(n & 255)
      .byte((n >>> 8) & 255)
      .byte((n >>> 16) & 255)
      .byte((n >>> 24) & 255);
  }

  /** int32 (como uint32 do mesmo padrão de bits), little-endian. */
  i32(n: number): this {
    if (!Number.isInteger(n) || n < -2147483648 || n > 2147483647) throw new RangeError(`i32 fora do intervalo: ${String(n)}`);
    return this.u32(n >>> 0);
  }

  /** double IEEE 754, little-endian. -0 vira +0; qualquer NaN vira o mesmo padrão. */
  f64(n: number): this {
    if (Number.isNaN(n)) {
      bufF64.setUint32(0, 0x00000000, true);
      bufF64.setUint32(4, 0x7ff80000, true);
    } else {
      bufF64.setFloat64(0, n === 0 ? 0 : n, true);
    }
    for (let i = 0; i < 8; i++) this.byte(bufF64.getUint8(i));
    return this;
  }

  /** Texto em UTF-8. Substituto isolado vira U+FFFD (como o TextEncoder), então o resultado não depende do motor. */
  texto(s: string): this {
    for (let i = 0; i < s.length; i++) {
      let cp = s.charCodeAt(i);
      if (cp >= 0xd800 && cp <= 0xdbff && i + 1 < s.length) {
        const baixo = s.charCodeAt(i + 1);
        if (baixo >= 0xdc00 && baixo <= 0xdfff) {
          cp = 0x10000 + ((cp - 0xd800) << 10) + (baixo - 0xdc00);
          i++;
        }
      }
      if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
      if (cp < 0x80) {
        this.byte(cp);
      } else if (cp < 0x800) {
        this.byte(0xc0 | (cp >> 6)).byte(0x80 | (cp & 63));
      } else if (cp < 0x10000) {
        this.byte(0xe0 | (cp >> 12))
          .byte(0x80 | ((cp >> 6) & 63))
          .byte(0x80 | (cp & 63));
      } else {
        this.byte(0xf0 | (cp >> 18))
          .byte(0x80 | ((cp >> 12) & 63))
          .byte(0x80 | ((cp >> 6) & 63))
          .byte(0x80 | (cp & 63));
      }
    }
    return this;
  }

  f64s(lista: ArrayLike<number>): this {
    for (let i = 0; i < lista.length; i++) this.f64(lista[i] as number);
    return this;
  }

  i32s(lista: ArrayLike<number>): this {
    for (let i = 0; i < lista.length; i++) this.i32(lista[i] as number);
    return this;
  }

  /** 16 dígitos hexadecimais minúsculos. Não consome o estado: pode continuar alimentando depois. */
  hex(): string {
    return this.hi.toString(16).padStart(8, '0') + this.lo.toString(16).padStart(8, '0');
  }
}

export function criarHasher(): Hasher {
  return new Hasher();
}

export function hashDeTexto(s: string): string {
  return new Hasher().texto(s).hex();
}

export function hashDeBytes(b: ArrayLike<number>): string {
  return new Hasher().bytes(b).hex();
}

export function hashDeFloat64s(v: ArrayLike<number>): string {
  return new Hasher().f64s(v).hex();
}

// --- Hash de valor estruturado (dados do jogo: DefPista, tabelas) ---

const PROFUNDIDADE_MAX = 64;

const ETIQUETA = {
  nulo: 0,
  falso: 1,
  verdadeiro: 2,
  numero: 3,
  texto: 4,
  lista: 5,
  objeto: 6,
  f64s: 7,
  i32s: 8,
  bytes: 9,
} as const;

function alimentar(h: Hasher, v: unknown, caminho: string, profundidade: number): void {
  if (profundidade > PROFUNDIDADE_MAX) {
    throw new ErroDeContrato('hash-valor-invalido', 'valor fundo demais (ciclo?)', [caminho]);
  }
  if (v === null) {
    h.byte(ETIQUETA.nulo);
  } else if (v === false) {
    h.byte(ETIQUETA.falso);
  } else if (v === true) {
    h.byte(ETIQUETA.verdadeiro);
  } else if (typeof v === 'number') {
    h.byte(ETIQUETA.numero).f64(v);
  } else if (typeof v === 'string') {
    h.byte(ETIQUETA.texto).u32(v.length).texto(v);
  } else if (v instanceof Float64Array) {
    h.byte(ETIQUETA.f64s).u32(v.length).f64s(v);
  } else if (v instanceof Int32Array) {
    h.byte(ETIQUETA.i32s).u32(v.length).i32s(v);
  } else if (v instanceof Uint8Array) {
    h.byte(ETIQUETA.bytes).u32(v.length).bytes(v);
  } else if (Array.isArray(v)) {
    h.byte(ETIQUETA.lista).u32(v.length);
    for (let i = 0; i < v.length; i++) alimentar(h, v[i], `${caminho}[${i}]`, profundidade + 1);
  } else if (typeof v === 'object') {
    const proto: unknown = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) {
      throw new ErroDeContrato('hash-valor-invalido', 'só objetos simples entram no hash', [caminho]);
    }
    const chaves = Object.keys(v).sort(); // ordem de código UTF-16: igual em qualquer motor
    h.byte(ETIQUETA.objeto).u32(chaves.length);
    for (const k of chaves) {
      h.u32(k.length).texto(k);
      alimentar(h, (v as Record<string, unknown>)[k], `${caminho}.${k}`, profundidade + 1);
    }
  } else {
    throw new ErroDeContrato('hash-valor-invalido', `tipo sem hash estável (${typeof v})`, [caminho]);
  }
}

/**
 * Hash estável de um valor estruturado: null, booleano, número (f64), texto, lista, objeto simples (chaves em ordem),
 * Float64Array, Int32Array e Uint8Array. `undefined`, função, símbolo, bigint, Map/Set e instância de classe LANÇAM
 * (hash silencioso de algo que não se pode comparar depois é pior que erro).
 */
export function hashDeValor(v: unknown): string {
  const h = new Hasher();
  alimentar(h, v, '$', 0);
  return h.hex();
}

/** Confere um hash fixo (por exemplo `DefPista.hashEsperado`). Diverge => `ErroDeContrato('hash-divergente')`. */
export function exigirHashIgual(rotulo: string, esperado: string, obtido: string): void {
  if (!FORMATO_HASH.test(esperado)) {
    throw new ErroDeContrato('hash-divergente', `${rotulo}: hash esperado mal formado`, [`esperado="${esperado}"`]);
  }
  if (esperado !== obtido) {
    throw new ErroDeContrato('hash-divergente', `${rotulo}: hash diverge`, [`esperado=${esperado}`, `obtido=${obtido}`]);
  }
}
