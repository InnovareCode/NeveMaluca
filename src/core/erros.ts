/**
 * Erros e resultado de validação do núcleo. Sem DOM, sem relógio, sem aleatoriedade.
 *
 * Duas formas de falhar, de propósito:
 *  - `Resultado<T>`: dado EXTERNO (replay de arquivo, save, gesto). Quem recebe decide o que fazer; nunca lança.
 *  - `ErroDeContrato`: dado INTERNO inválido (tabela do jogo, constante, hash fixo divergente). Derruba o boot com
 *    mensagem clara, em vez de deixar um jogo meio quebrado (lição do InnoFighters: `exigir*Validos`).
 */

export type Resultado<T> =
  | { readonly ok: true; readonly valor: T }
  | { readonly ok: false; readonly erros: readonly string[] };

export function ok<T>(valor: T): Resultado<T> {
  return { ok: true, valor };
}

export function falha<T = never>(erros: readonly string[]): Resultado<T> {
  return { ok: false, erros };
}

/** Códigos estáveis (o teste e a tela de erro do boot podem tratá-los por programa, não por texto). */
export type CodigoDeErro =
  | 'constante-invalida'
  | 'trig-tabela-divergente'
  | 'hash-divergente'
  | 'hash-valor-invalido'
  | 'contrato-invalido'
  | 'laco-invalido';

export class ErroDeContrato extends Error {
  readonly codigo: CodigoDeErro;
  readonly detalhes: readonly string[];

  constructor(codigo: CodigoDeErro, mensagem: string, detalhes: readonly string[] = []) {
    super(detalhes.length > 0 ? `${mensagem}: ${detalhes.join('; ')}` : mensagem);
    this.name = 'ErroDeContrato';
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

/** Lança `ErroDeContrato` se o resultado for falha; devolve o valor se ok. Para dado interno que precisa estar certo. */
export function exigir<T>(r: Resultado<T>, codigo: CodigoDeErro, mensagem: string): T {
  if (r.ok) return r.valor;
  throw new ErroDeContrato(codigo, mensagem, r.erros);
}
