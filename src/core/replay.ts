/**
 * Replay C6: comandos em RLE + base64 e validação do `ReplayV1` vindo de fora (arquivo, save, no futuro a rede).
 *
 * Formato de `comandos`: a lista de bytes de comando (ver `comandos.ts`), um por tick, comprimida em pares
 * `[byte, repetições]` (repetições de 1 a 255; corrida mais longa é partida em vários pares), e o resultado em base64
 * padrão COM preenchimento `=`. Uma descida de 90 s quase toda sem toque fica em algumas dezenas de bytes.
 *
 * O decodificador é ESTRITO (replay é dado de fora): rejeita caractere fora do alfabeto, preenchimento errado, bits
 * sobrando no fim (um mesmo conteúdo tem uma única representação), byte de comando inválido, repetição 0 e qualquer
 * entrada que passe do teto de ticks ANTES de alocar (uma string pequena não vira milhões de comandos).
 */
import { TETO_PONTOS, TETO_TICKS_REPLAY, FORMA_ID } from './constantes';
import { comandoCompartilhado, byteDoComando } from './comandos';
import type { ComandoDescida, ReplayV1 } from './contratos';
import { falha, ok, type Resultado } from './erros';
import { FORMATO_HASH } from './hash';

// --- base64 (sem btoa/atob: o núcleo não depende de DOM) ---

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const INDICE_DO_CHAR: Readonly<Record<string, number>> = Object.fromEntries([...ALFABETO].map((c, i) => [c, i]));

export function base64Codificar(bytes: ArrayLike<number>): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] as number;
    const b = i + 1 < bytes.length ? (bytes[i + 1] as number) : 0;
    const c = i + 2 < bytes.length ? (bytes[i + 2] as number) : 0;
    const n = (a << 16) | (b << 8) | c;
    s += ALFABETO[(n >> 18) & 63] as string;
    s += ALFABETO[(n >> 12) & 63] as string;
    s += i + 1 < bytes.length ? (ALFABETO[(n >> 6) & 63] as string) : '=';
    s += i + 2 < bytes.length ? (ALFABETO[n & 63] as string) : '=';
  }
  return s;
}

/** Decodifica base64 canônico. `null` se mal formado. */
export function base64Decodificar(texto: string): Uint8Array | null {
  if (texto.length % 4 !== 0) return null;
  const preenchimento = texto.endsWith('==') ? 2 : texto.endsWith('=') ? 1 : 0;
  const corpo = texto.length - preenchimento;
  const saida = new Uint8Array((texto.length / 4) * 3 - preenchimento);
  let o = 0;
  for (let i = 0; i < texto.length; i += 4) {
    let n = 0;
    for (let j = 0; j < 4; j++) {
      const pos = i + j;
      if (pos >= corpo) {
        n <<= 6;
        continue;
      }
      const v = INDICE_DO_CHAR[texto[pos] as string];
      if (v === undefined) return null;
      n = (n << 6) | v;
    }
    const bytesDoGrupo = i + 4 > corpo ? 3 - preenchimento : 3;
    // bits não usados do último grupo têm de ser zero (representação única)
    if (bytesDoGrupo < 3 && (n & ((1 << (8 * (3 - bytesDoGrupo))) - 1)) !== 0) return null;
    saida[o++] = (n >> 16) & 255;
    if (bytesDoGrupo > 1) saida[o++] = (n >> 8) & 255;
    if (bytesDoGrupo > 2) saida[o++] = n & 255;
  }
  return saida;
}

// --- RLE dos comandos ---

const MAX_REPETICAO = 255;

/** Comprime a lista de comandos (um por tick) em RLE + base64. Comando mal formado lança (`TypeError`). */
export function codificarComandos(comandos: readonly Readonly<ComandoDescida>[]): string {
  const pares: number[] = [];
  let i = 0;
  while (i < comandos.length) {
    const b = byteDoComando(comandos[i] as ComandoDescida);
    let n = 1;
    while (i + n < comandos.length && n < MAX_REPETICAO && byteDoComando(comandos[i + n] as ComandoDescida) === b) n++;
    pares.push(b, n);
    i += n;
  }
  return base64Codificar(pares);
}

/** Maior texto base64 que um replay de `maxTicks` ticks pode ter (pior caso: todo tick diferente do vizinho). */
export function tamanhoMaximoDoTexto(maxTicks: number): number {
  return Math.ceil((maxTicks * 2) / 3) * 4;
}

/**
 * Descomprime. Falha (sem lançar) em texto mal formado ou com mais de `maxTicks` ticks. Os objetos devolvidos são
 * compartilhados e congelados (no máximo 60 distintos): não os modifique.
 */
export function decodificarComandos(texto: string, maxTicks: number = TETO_TICKS_REPLAY): Resultado<readonly Readonly<ComandoDescida>[]> {
  if (typeof texto !== 'string') return falha(['comandos: não é texto']);
  if (texto.length > tamanhoMaximoDoTexto(maxTicks)) return falha([`comandos: texto grande demais (${texto.length} caracteres)`]);
  const bytes = base64Decodificar(texto);
  if (bytes === null) return falha(['comandos: base64 inválido']);
  if (bytes.length % 2 !== 0) return falha(['comandos: faltou a contagem de repetições no último par']);
  const total: number[] = [];
  let ticks = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    const rep = bytes[i + 1] as number;
    if (rep === 0) return falha([`comandos: repetição 0 no par ${i / 2}`]);
    ticks += rep;
    if (ticks > maxTicks) return falha([`comandos: mais de ${maxTicks} ticks`]);
    total.push(bytes[i] as number, rep);
  }
  const saida: Readonly<ComandoDescida>[] = [];
  for (let i = 0; i < total.length; i += 2) {
    const c = comandoCompartilhado(total[i] as number);
    if (c === null) return falha([`comandos: byte de comando inválido (${total[i]}) no par ${i / 2}`]);
    for (let r = 0; r < (total[i + 1] as number); r++) saida.push(c);
  }
  return ok(saida);
}

// --- ReplayV1 ---

const SEMENTE_MAX = 0xffffffff;
const VERSAO_MOTOR_MAX = 32;

function inteiroEm(x: unknown, min: number, max: number): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
}

/**
 * Valida um `ReplayV1` de fora. Devolve uma CÓPIA só com os campos conhecidos (campo extra é descartado, não repassado).
 * Confere formato, limites e que os comandos decodificam; NÃO reexecuta o motor (isso é do `descida/`, que compara o
 * `hashFinal`). `resultado.ticks` não pode passar da quantidade de comandos gravados.
 */
export function validarReplayV1(x: unknown, maxTicks: number = TETO_TICKS_REPLAY): Resultado<ReplayV1> {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return falha(['replay: não é um objeto']);
  const o = x as Record<string, unknown>;
  const erros: string[] = [];
  if (o['v'] !== 1) erros.push('replay.v: só a versão 1 é conhecida');
  if (typeof o['pista'] !== 'string' || !FORMA_ID.test(o['pista'])) erros.push('replay.pista: id inválido');
  if (typeof o['hashPista'] !== 'string' || !FORMATO_HASH.test(o['hashPista'])) erros.push('replay.hashPista: precisa ter 16 dígitos hexadecimais minúsculos');
  if (!inteiroEm(o['semente'], 0, SEMENTE_MAX)) erros.push('replay.semente: precisa ser inteiro de 0 a 4294967295');
  if (typeof o['personagem'] !== 'string' || !FORMA_ID.test(o['personagem'])) erros.push('replay.personagem: id inválido');
  if (typeof o['versaoMotor'] !== 'string' || o['versaoMotor'].length < 1 || o['versaoMotor'].length > VERSAO_MOTOR_MAX) {
    erros.push(`replay.versaoMotor: texto de 1 a ${VERSAO_MOTOR_MAX} caracteres`);
  }

  let quantosComandos = -1;
  if (typeof o['comandos'] !== 'string') {
    erros.push('replay.comandos: precisa ser texto');
  } else {
    const d = decodificarComandos(o['comandos'], maxTicks);
    if (d.ok) quantosComandos = d.valor.length;
    else erros.push(...d.erros.map((e) => `replay.${e}`));
  }

  const r = o['resultado'];
  let resultado: ReplayV1['resultado'] | null = null;
  if (typeof r !== 'object' || r === null || Array.isArray(r)) {
    erros.push('replay.resultado: não é um objeto');
  } else {
    const ro = r as Record<string, unknown>;
    const sub: string[] = [];
    if (!inteiroEm(ro['pontos'], 0, TETO_PONTOS)) sub.push(`replay.resultado.pontos: inteiro de 0 a ${TETO_PONTOS}`);
    if (!inteiroEm(ro['ticks'], 0, maxTicks)) sub.push(`replay.resultado.ticks: inteiro de 0 a ${maxTicks}`);
    else if (quantosComandos >= 0 && ro['ticks'] > quantosComandos) sub.push('replay.resultado.ticks: maior que a quantidade de comandos gravados');
    if (typeof ro['hashFinal'] !== 'string' || !FORMATO_HASH.test(ro['hashFinal'])) sub.push('replay.resultado.hashFinal: precisa ter 16 dígitos hexadecimais minúsculos');
    if (sub.length > 0) erros.push(...sub);
    else resultado = { pontos: ro['pontos'] as number, ticks: ro['ticks'] as number, hashFinal: ro['hashFinal'] as string };
  }

  if (erros.length > 0 || resultado === null) return falha(erros);
  return ok({
    v: 1,
    pista: o['pista'] as string,
    hashPista: o['hashPista'] as string,
    semente: o['semente'] as number,
    personagem: o['personagem'] as string,
    versaoMotor: o['versaoMotor'] as string,
    comandos: o['comandos'] as string,
    resultado,
  });
}
