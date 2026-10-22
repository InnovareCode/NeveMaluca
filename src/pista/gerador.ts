/**
 * Gerador puro da pista (plano §3.4, contrato C5): `semente + DefPista -> PistaGerada`. Escolhe trechos do catálogo
 * (`catalogo.ts`) pela semente, casando a dificuldade alvo em cada ponto da descida com `DefPista.dificuldade`, costura
 * as curvas de altura por Hermite de tangente casada, amostra a cada `DX_PISTA_M` num `Float64Array`, posiciona objetos
 * e trilhos em coordenadas absolutas, deriva checkpoints e a chegada, e fecha com o hash (`core/hash.ts`).
 *
 * Determinístico: só `+ - * /`, `core/trig.ts` e `core/rng.ts` (nunca `Math.random`/`Math.sin`/`Math.pow`...). Mesma
 * semente + mesmo `DefPista` => mesma `PistaGerada`, byte a byte, em qualquer motor (teste de varredura garante).
 */
import { DX_PISTA_M } from '../core/constantes';
import type { DefPista, ObjetoPista, PistaGerada, Trilho } from '../core/contratos';
import { ErroDeContrato } from '../core/erros';
import { exigirHashIgual, hashDeValor } from '../core/hash';
import { criarRng, type Rng } from '../core/rng';
import { cosseno, seno } from '../core/trig';
import { CATALOGO_TRECHOS, TIPOS_PROIBIDOS_NA_ABERTURA, TIPOS_SEGUROS_PARA_CHECKPOINT, type DefTrecho } from './catalogo';

export const VERSAO_GERADOR = '1';

/** Quanto a proximidade de dificuldade pesa na escolha do próximo trecho (maior = mais rígido com o alvo). */
const RIGIDEZ_DIFICULDADE = 6;
const MAX_TRECHOS_POR_PISTA = 400;
/**
 * Nos últimos metros antes de `def.comprimentoM`, só trechos SEGUROS (`TIPOS_SEGUROS_PARA_CHECKPOINT`) entram na
 * escolha. Por quê: a seleção para assim que o comprimento acumulado alcança `def.comprimentoM`, então o ÚLTIMO
 * trecho pode ser cortado no meio — e um corte no meio de um `vao`/`degrau`/`rampa` deixaria a chegada num precipício
 * sem chão, sem jeito de pousar bem. Essa margem garante que a reta final (e a linha de chegada) sempre caem em
 * chão estável.
 */
const MARGEM_SEGURA_FINAL_M = 24;

function pesoPorDificuldade(dificuldadeTrecho: number, alvo: number): number {
  const diff = dificuldadeTrecho > alvo ? dificuldadeTrecho - alvo : alvo - dificuldadeTrecho;
  return 1 / (1 + diff * RIGIDEZ_DIFICULDADE);
}

/** Escolhe a sequência de trechos que cobre ao menos `def.comprimentoM`, respeitando pesos e vizinhança. */
function selecionarTrechos(def: DefPista, rng: Rng): DefTrecho[] {
  const elegiveis = [...CATALOGO_TRECHOS.values()].filter((t) => (def.trechos[t.id] ?? 0) > 0);
  if (elegiveis.length === 0) {
    throw new ErroDeContrato('contrato-invalido', `pista "${def.id}": nenhum trecho elegível (pesos todos zero/ausentes)`);
  }
  const elegiveisSeguros = elegiveis.filter((t) => TIPOS_SEGUROS_PARA_CHECKPOINT.has(t.id));
  const escolhidos: DefTrecho[] = [];
  let comprimento = 0;
  let anterior: DefTrecho | null = null;
  while (comprimento < def.comprimentoM && escolhidos.length < MAX_TRECHOS_POR_PISTA) {
    const frac = comprimento / def.comprimentoM > 1 ? 1 : comprimento / def.comprimentoM;
    const alvo = def.dificuldade[0] + (def.dificuldade[1] - def.dificuldade[0]) * frac;
    const naRetaFinal = comprimento >= def.comprimentoM - MARGEM_SEGURA_FINAL_M;
    const pool = naRetaFinal && elegiveisSeguros.length > 0 ? elegiveisSeguros : elegiveis;
    const candidatos = pool.filter(
      (t) => (anterior !== null || !TIPOS_PROIBIDOS_NA_ABERTURA.has(t.id)) && (anterior === null || !(t.proibidoApos ?? []).includes(anterior.id)),
    );
    const base = candidatos.length > 0 ? candidatos : pool;
    const pesos = base.map((t) => (def.trechos[t.id] ?? 0.0001) * pesoPorDificuldade(t.dificuldade, alvo));
    const somaPesos = pesos.reduce((a, b) => a + b, 0);
    let escolhido = base[0] as DefTrecho;
    if (somaPesos > 0) {
      let r = rng.proximo() * somaPesos;
      for (let i = 0; i < base.length; i++) {
        r -= pesos[i] as number;
        if (r <= 0) {
          escolhido = base[i] as DefTrecho;
          break;
        }
      }
    }
    escolhidos.push(escolhido);
    comprimento += escolhido.comprimentoM;
    anterior = escolhido;
  }
  return escolhidos;
}

interface PontoGlobal {
  readonly x: number;
  readonly y: number;
  /** Inclinação (tangente) em graus, convenção de `core/trig.ts`. */
  readonly anguloGraus: number;
}

interface TrechoPosicionado {
  readonly trecho: DefTrecho;
  readonly inicioX: number;
  /** Tangente (graus) de verdade na ABERTURA deste trecho, JÁ com a "tangente casada" do trecho anterior aplicada. */
  readonly anguloEntrada: number;
}

/** Converte os trechos escolhidos em pontos-chave GLOBAIS (x e y acumulados), casando a tangente nas junções. */
function montarPontosGlobais(escolhidos: readonly DefTrecho[]): { pontos: PontoGlobal[]; posicionados: TrechoPosicionado[] } {
  const pontos: PontoGlobal[] = [];
  const posicionados: TrechoPosicionado[] = [];
  let x0 = 0;
  let y0 = 0;
  let anguloCarregado: number | null = null;
  for (const trecho of escolhidos) {
    const anguloEntrada = anguloCarregado ?? (trecho.pontos[0] as { anguloGraus: number }).anguloGraus;
    posicionados.push({ trecho, inicioX: x0, anguloEntrada });
    for (let i = 0; i < trecho.pontos.length; i++) {
      const p = trecho.pontos[i] as { dx: number; dy: number; anguloGraus: number };
      const angulo = i === 0 && anguloCarregado !== null ? anguloCarregado : p.anguloGraus;
      pontos.push({ x: x0 + p.dx, y: y0 + p.dy, anguloGraus: angulo });
    }
    const ultimo = trecho.pontos[trecho.pontos.length - 1] as { dx: number; dy: number; anguloGraus: number };
    anguloCarregado = ultimo.anguloGraus;
    x0 += trecho.comprimentoM;
    y0 += ultimo.dy;
  }
  return { pontos, posicionados };
}

/** Declive (dy/dx) de uma tangente dada em graus: seno/cosseno do ângulo (nunca `Math.tan`, que não existe em `trig.ts`). */
function inclinacaoParaDeclive(anguloGraus: number): number {
  return seno(anguloGraus) / cosseno(anguloGraus);
}

/** Amostra o `Float64Array` de alturas por interpolação cúbica de Hermite (tangente casada) entre os pontos globais. */
function amostrarAlturas(pontos: readonly PontoGlobal[], comprimentoM: number, dx: number): Float64Array {
  const n = Math.round(comprimentoM / dx) + 1;
  const alturas = new Float64Array(n);
  let seg = 0;
  const ultimoIdx = pontos.length - 1;
  for (let i = 0; i < n; i++) {
    const x = i * dx;
    while (seg < ultimoIdx - 1 && x > (pontos[seg + 1] as PontoGlobal).x) seg++;
    const p0 = pontos[seg] as PontoGlobal;
    const p1 = pontos[Math.min(seg + 1, ultimoIdx)] as PontoGlobal;
    const largura = p1.x - p0.x;
    const t = largura > 0 ? (x - p0.x) / largura : 0;
    const m0 = inclinacaoParaDeclive(p0.anguloGraus);
    const m1 = inclinacaoParaDeclive(p1.anguloGraus);
    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    alturas[i] = h00 * p0.y + h10 * largura * m0 + h01 * p1.y + h11 * largura * m1;
  }
  return alturas;
}

function montarObjetosETrilhos(posicionados: readonly TrechoPosicionado[], comprimentoM: number): { objetos: ObjetoPista[]; trilhos: Trilho[] } {
  const objetos: ObjetoPista[] = [];
  const trilhos: Trilho[] = [];
  for (const { trecho, inicioX } of posicionados) {
    for (const o of trecho.objetos ?? []) {
      const x = inicioX + o.dx;
      if (x < comprimentoM) objetos.push({ tipo: o.tipo, x, largura: o.largura, altura: o.altura, variante: o.variante ?? 0 });
    }
    if (trecho.trilho) {
      const x0 = inicioX + trecho.trilho.dx0;
      if (x0 < comprimentoM) {
        const x1 = Math.min(inicioX + trecho.trilho.dx1, comprimentoM);
        if (x1 > x0) trilhos.push({ x0, x1, altura: trecho.trilho.altura });
      }
    }
  }
  return { objetos, trilhos };
}

/**
 * Ângulo de entrada (graus) acima do qual um checkpoint NÃO pode ficar ali: a tangente carrega de um `rampa`/`vao`/
 * `degrau` anterior (plano "tangente casada") e pode continuar subindo por um instante mesmo quando o trecho que
 * começa ali é, por natureza, um trecho "seguro" (ex.: uma `reta` logo depois de uma rampa, ainda subindo). Respawnar
 * num ponto assim deixa o piloto sem embalo suficiente para vencer a subida (plano §3.3 nunca previu ficar parado).
 */
const LIMIAR_ANGULO_CHECKPOINT_SEGURO_GRAUS = 10;

function montarCheckpoints(posicionados: readonly TrechoPosicionado[], comprimentoM: number): number[] {
  const checkpoints = [0];
  for (const { trecho, inicioX, anguloEntrada } of posicionados) {
    if (inicioX > 0 && inicioX < comprimentoM && TIPOS_SEGUROS_PARA_CHECKPOINT.has(trecho.id) && anguloEntrada <= LIMIAR_ANGULO_CHECKPOINT_SEGURO_GRAUS) {
      checkpoints.push(inicioX);
    }
  }
  return checkpoints;
}

/** Gera a pista. Pura: não confere `hashEsperado` (isso é `exigirPistaValida`); não lança por divergência de hash. */
export function gerarPista(def: DefPista): PistaGerada {
  const rng = criarRng(def.semente);
  const escolhidos = selecionarTrechos(def, rng);
  const { pontos, posicionados } = montarPontosGlobais(escolhidos);
  const alturas = amostrarAlturas(pontos, def.comprimentoM, DX_PISTA_M);
  const { objetos, trilhos } = montarObjetosETrilhos(posicionados, def.comprimentoM);
  const checkpoints = montarCheckpoints(posicionados, def.comprimentoM);
  const chegadaX = def.comprimentoM;
  // `dx: 0.5` literal (não `DX_PISTA_M`, tipado `number`): `PistaGerada.dx` é o literal `0.5` no contrato C5.
  // `validacao.ts` já derruba o boot se `DX_PISTA_M !== 0.5`, então os dois nunca divergem em runtime.
  const semHash = { id: def.id, semente: def.semente, versaoGerador: VERSAO_GERADOR, dx: 0.5 as const, alturas, objetos, trilhos, checkpoints, chegadaX };
  const hash = hashDeValor(semHash);
  return { ...semHash, hash };
}

/** Gera a pista e CONFERE o hash contra `def.hashEsperado`. Diverge => `ErroDeContrato('hash-divergente')` (boot). */
export function exigirPistaValida(def: DefPista): PistaGerada {
  const gerada = gerarPista(def);
  exigirHashIgual(`pista "${def.id}"`, def.hashEsperado, gerada.hash);
  return gerada;
}

/** Confere uma lista de pistas fixas (plano §3.9: `exigirPistasValidas`, chamado no boot pela camada que junta `data/` e `pista/`). */
export function exigirPistasValidas(defs: readonly DefPista[]): void {
  for (const def of defs) exigirPistaValida(def);
}
