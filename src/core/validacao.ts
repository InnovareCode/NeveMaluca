/**
 * Validação do núcleo no boot, por funções puras (mesma ideia dos `exigir*Validos` do InnoFighters): confere que as
 * constantes são coerentes entre si e que as peças com resultado fixo (RNG, hash, trig, replay) ainda dão o resultado
 * conhecido. Custa microssegundos. Falhou = `ErroDeContrato` com a lista do que está errado, e o boot mostra o erro
 * em vez de abrir um jogo que ia divergir em silêncio.
 *
 * `core/index.ts` chama `exigirCoreValido()` no import; `trig.ts` ainda confere o hash das suas tabelas por conta própria.
 */
import { decodificarComandos, codificarComandos } from './replay';
import {
  ACUMULADOR_MAX_MS,
  ALTURA_BUFFER,
  ALTURA_LOGICA,
  DX_PISTA_M,
  ESCALA_BUFFER,
  LARGURA_BUFFER,
  LARGURA_LOGICA,
  MAX_PASSOS_POR_QUADRO,
  PASSO_MS,
  TICKS_POR_SEGUNDO,
  TETO_TICKS_REPLAY,
} from './constantes';
import { COMANDO_NEUTRO } from './comandos';
import { ErroDeContrato } from './erros';
import { hashDeTexto } from './hash';
import { criarRng } from './rng';
import { atan2, cosseno, exigirTabelasTrigValidas, seno } from './trig';

/** Lista o que está errado nas constantes (vazia = tudo certo). Pura: não lança. */
export function problemasDasConstantes(): string[] {
  const p: string[] = [];
  const inteiroPositivo = (n: number): boolean => Number.isInteger(n) && n > 0;
  if (!inteiroPositivo(LARGURA_LOGICA) || !inteiroPositivo(ALTURA_LOGICA)) p.push('resolução lógica precisa ser de inteiros positivos');
  if (LARGURA_LOGICA * 9 !== ALTURA_LOGICA * 16) p.push(`resolução lógica ${LARGURA_LOGICA}x${ALTURA_LOGICA} não é 16:9`);
  if (!inteiroPositivo(ESCALA_BUFFER)) p.push('ESCALA_BUFFER precisa ser inteiro positivo');
  if (LARGURA_BUFFER !== LARGURA_LOGICA * ESCALA_BUFFER || ALTURA_BUFFER !== ALTURA_LOGICA * ESCALA_BUFFER) p.push('buffer diferente de lógico x escala');
  if (!inteiroPositivo(TICKS_POR_SEGUNDO)) p.push('TICKS_POR_SEGUNDO precisa ser inteiro positivo');
  if (PASSO_MS * TICKS_POR_SEGUNDO < 999.999999 || PASSO_MS * TICKS_POR_SEGUNDO > 1000.000001) p.push('PASSO_MS não fecha 1000 ms por segundo');
  if (ACUMULADOR_MAX_MS < PASSO_MS) p.push('ACUMULADOR_MAX_MS menor que um passo');
  if (MAX_PASSOS_POR_QUADRO < 1 || MAX_PASSOS_POR_QUADRO > 10) p.push(`MAX_PASSOS_POR_QUADRO fora do razoável: ${MAX_PASSOS_POR_QUADRO}`);
  if (DX_PISTA_M !== 0.5) p.push('DX_PISTA_M precisa ser 0,5 (contrato C5: dx: 0.5)');
  if (TETO_TICKS_REPLAY < 90 * TICKS_POR_SEGUNDO) p.push('TETO_TICKS_REPLAY menor que uma descida de 90 s');
  return p;
}

/** Lista o que está errado nas peças com resultado fixo (vazia = tudo certo). Pura: não lança. */
export function problemasDasPecas(): string[] {
  const p: string[] = [];
  const r = criarRng(1);
  if (r.proximo() !== 0.6270739405881613) p.push('RNG: primeiro valor da semente 1 mudou');
  if (hashDeTexto('') !== 'cbf29ce484222325') p.push('hash: FNV-1a 64 de "" mudou');
  if (hashDeTexto('foobar') !== '85944171f73967e8') p.push('hash: FNV-1a 64 de "foobar" mudou');
  if (seno(0) !== 0 || seno(90) !== 1 || seno(270) !== -1 || cosseno(0) !== 1 || cosseno(180) !== -1) p.push('trig: valores exatos (0, 90, 180, 270) mudaram');
  if (atan2(0, 1) !== 0 || atan2(1, 0) !== 90 || atan2(0, -1) !== 180 || atan2(-1, 0) !== -90 || atan2(1, 1) !== 45) p.push('trig: atan2 nos eixos mudou');
  const amostra = [COMANDO_NEUTRO, COMANDO_NEUTRO, { pulo: true, giro: 1 as const, grab: 'frente' as const, agachar: true }];
  const volta = decodificarComandos(codificarComandos(amostra));
  if (!volta.ok || volta.valor.length !== 3 || volta.valor[2]?.grab !== 'frente') p.push('replay: ida e volta dos comandos falhou');
  return p;
}

export function exigirCoreValido(): void {
  exigirTabelasTrigValidas();
  const erros = [...problemasDasConstantes(), ...problemasDasPecas()];
  if (erros.length > 0) throw new ErroDeContrato('constante-invalida', 'o núcleo (core/) não passou na validação do boot', erros);
}
