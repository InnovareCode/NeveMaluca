/**
 * Comando por tick (C2): valores neutros, derivação da borda do pulo, validação de dado externo e o BYTE de um
 * comando (a representação usada pelo replay C6).
 *
 * Byte do comando (um por tick, 7 bits usados):
 *   bit 0      pulo
 *   bits 1-2   giro:  0 = 0, 1 = +1, 2 = -1 (3 é inválido)
 *   bits 3-5   grab:  0 = nenhum, 1 = cima, 2 = baixo, 3 = frente, 4 = tras (5 a 7 inválidos)
 *   bit 6      agachar
 *   bit 7      sempre 0 (reservado)
 * Este layout faz parte do formato do replay: mudá-lo exige `ReplayV1` novo (`v: 2`).
 */
import type { ComandoDescida, Giro, Grab, InputFrame } from './contratos';
import { GRABS } from './contratos';
import { falha, ok, type Resultado } from './erros';

export const COMANDO_NEUTRO: Readonly<ComandoDescida> = Object.freeze({ pulo: false, giro: 0, grab: null, agachar: false });

export const INPUT_NEUTRO: Readonly<InputFrame> = Object.freeze({ pular: false, giro: 0, grab: null, agachar: false });

/**
 * Deriva o comando do tick a partir do quadro anterior e do atual: `pulo` só no tick em que `pular` passou de solto
 * para segurado (primeiro quadro: `anterior = null` conta como solto). Manter pressionado não repete o pulo.
 */
export function derivarComando(anterior: Readonly<InputFrame> | null, atual: Readonly<InputFrame>): ComandoDescida {
  return {
    pulo: atual.pular && !(anterior?.pular ?? false),
    giro: atual.giro,
    grab: atual.grab,
    agachar: atual.agachar,
  };
}

const CODIGO_DO_GIRO: Readonly<Record<string, number>> = { '0': 0, '1': 1, '-1': 2 };
const GIRO_DO_CODIGO: readonly Giro[] = [0, 1, -1];

/** Comando para byte. Lança em comando mal formado (quem grava replay tem de gravar dado válido). */
export function byteDoComando(c: Readonly<ComandoDescida>): number {
  const g = CODIGO_DO_GIRO[String(c.giro)];
  const gr = c.grab === null ? 0 : GRABS.indexOf(c.grab) + 1; // grab desconhecido => indexOf -1 => 0, barrado abaixo
  if (typeof c.pulo !== 'boolean' || typeof c.agachar !== 'boolean' || g === undefined || (c.grab !== null && gr === 0)) {
    throw new TypeError(`comando inválido: ${JSON.stringify(c)}`);
  }
  return (c.pulo ? 1 : 0) | (g << 1) | (gr << 3) | (c.agachar ? 64 : 0);
}

/** Byte para comando, ou `null` se o byte não é um comando válido (bit reservado, giro 3 ou grab 5 a 7). */
export function comandoDoByte(b: number): ComandoDescida | null {
  if (!Number.isInteger(b) || b < 0 || b > 127) return null;
  const giro = GIRO_DO_CODIGO[(b >> 1) & 3];
  const codigoGrab = (b >> 3) & 7;
  if (giro === undefined || codigoGrab > GRABS.length) return null;
  return { pulo: (b & 1) === 1, giro, grab: codigoGrab === 0 ? null : (GRABS[codigoGrab - 1] as Grab), agachar: (b & 64) !== 0 };
}

/** Os 128 bytes possíveis, já como comandos congelados e COMPARTILHADOS (o decodificador reaproveita os mesmos objetos). */
const TABELA_DE_COMANDOS: readonly (Readonly<ComandoDescida> | null)[] = Array.from({ length: 128 }, (_, b) => {
  const c = comandoDoByte(b);
  return c === null ? null : Object.freeze(c);
});

/** Versão compartilhada e congelada do comando de um byte válido (para o decodificador de replay). */
export function comandoCompartilhado(b: number): Readonly<ComandoDescida> | null {
  return TABELA_DE_COMANDOS[b] ?? null;
}

/** Valida um comando vindo de fora (replay JSON, teste, harness). Devolve uma cópia limpa, só com os 4 campos. */
export function validarComandoDescida(x: unknown): Resultado<ComandoDescida> {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return falha(['comando: não é um objeto']);
  const o = x as Record<string, unknown>;
  const erros: string[] = [];
  if (typeof o['pulo'] !== 'boolean') erros.push('comando.pulo: precisa ser booleano');
  if (typeof o['agachar'] !== 'boolean') erros.push('comando.agachar: precisa ser booleano');
  if (o['giro'] !== -1 && o['giro'] !== 0 && o['giro'] !== 1) erros.push('comando.giro: precisa ser -1, 0 ou 1');
  const grab = o['grab'];
  if (grab !== null && !(typeof grab === 'string' && (GRABS as readonly string[]).includes(grab))) {
    erros.push(`comando.grab: precisa ser null ou um de ${GRABS.join(', ')}`);
  }
  if (erros.length > 0) return falha(erros);
  // `o['giro'] === 0 ? 0` troca um possível -0 pelo zero comum (-0 === 0, mas Object.is os distingue)
  return ok({ pulo: o['pulo'] as boolean, giro: o['giro'] === 0 ? 0 : (o['giro'] as Giro), grab: grab as Grab | null, agachar: o['agachar'] as boolean });
}

/** Valida um quadro de entrada bruto (mesma regra do comando). */
export function validarInputFrame(x: unknown): Resultado<InputFrame> {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return falha(['input: não é um objeto']);
  const o = x as Record<string, unknown>;
  const r = validarComandoDescida({ pulo: o['pular'], giro: o['giro'], grab: o['grab'], agachar: o['agachar'] });
  if (!r.ok) return falha(r.erros.map((e) => e.replace('comando.pulo', 'input.pular').replace('comando.', 'input.')));
  return ok({ pular: r.valor.pulo, giro: r.valor.giro, grab: r.valor.grab, agachar: r.valor.agachar });
}
