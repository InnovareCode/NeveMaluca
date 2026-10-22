/**
 * Catálogo de trechos feitos à mão (plano §3.4): o gerador escolhe entre eles por semente, não desenha ruído puro.
 * `DefTrecho` é tipo INTERNO de `pista/` (o contrato C5 só define `DefPista`/`PistaGerada`; o plano descreve `DefTrecho`
 * em prosa, sem campos fixos). Cada trecho é uma lista de pontos-chave (`PontoChave`): posição relativa ao início do
 * trecho (`dx`, `dy`, metros) e a inclinação da tangente NAQUELE ponto (`anguloGraus`, convenção de `core/trig.ts`:
 * 0 = +x, anti-horário). O primeiro ponto de todo trecho é sempre `dx: 0, dy: 0`; o gerador (`gerador.ts`) SUBSTITUI o
 * ângulo desse primeiro ponto pelo ângulo final do trecho anterior — é isso que garante a "tangente casada" entre
 * trechos (o valor aqui é só o ângulo natural do trecho quando ele abre a pista).
 */
import type { IdTrecho, ObjetoPista, TipoObjeto, Trilho } from '../core/contratos';

export interface PontoChave {
  readonly dx: number;
  readonly dy: number;
  readonly anguloGraus: number;
}

/** Objeto do catálogo, relativo ao início do trecho (o gerador soma a posição absoluta do trecho). */
export interface ObjetoDoTrecho {
  readonly tipo: TipoObjeto;
  readonly dx: number;
  readonly largura: number;
  readonly altura: number;
  readonly variante?: number;
}

/** Trilho do catálogo, relativo ao início do trecho. */
export interface TrilhoDoTrecho {
  readonly dx0: number;
  readonly dx1: number;
  readonly altura: number;
}

export interface DefTrecho {
  readonly id: IdTrecho;
  readonly comprimentoM: number;
  /** >= 2 pontos, `dx` crescente, o primeiro em `dx: 0`. */
  readonly pontos: readonly PontoChave[];
  readonly objetos?: readonly ObjetoDoTrecho[];
  readonly trilho?: TrilhoDoTrecho;
  /** 0 a 1: usado para casar o trecho com a faixa de dificuldade da pista naquele ponto da descida. */
  readonly dificuldade: number;
  /** Velocidade mínima (m/s) para o trecho ser "vencível" (plano §3.4); o gerador não impõe isso no M1a, é metadado. */
  readonly velMinEntradaMs: number;
  /** Regra de vizinhança: este trecho não pode vir logo depois de nenhum destes ids (ex.: dois vãos seguidos). */
  readonly proibidoApos?: readonly IdTrecho[];
}

/** Tipos de objeto que são obstáculo DURO no chão (plano §3.3: "encostar no chão = tombo"). */
export const TIPOS_OBSTACULO_DURO: ReadonlySet<TipoObjeto> = new Set(['pedra', 'tronco', 'pinheiro']);
/** Tipo que é "atravessável, vira piada" (plano §3.3): perde um pouco de velocidade, nunca tombo. */
export const TIPO_BONECO_DE_NEVE: TipoObjeto = 'boneco-de-neve';

/** Trechos cujo início é seguro para virar checkpoint (chão estável, sem risco de respawn no meio do ar/queda). */
export const TIPOS_SEGUROS_PARA_CHECKPOINT: ReadonlySet<IdTrecho> = new Set(['reta', 'ondulado', 'trilho', 'pedras', 'boneco']);

/**
 * Trechos que nunca podem ABRIR a pista. `rampa`/`vao`/`degrau` têm a forma desenhada para encadear com o que vem
 * ANTES (um `vao` sobe porque antes dele veio o lançamento de uma `rampa`; um `degrau` parte de uma velocidade que
 * só existe depois de uma descida). Sem trecho anterior, o próprio formato do trecho fica fisicamente sem sentido
 * (ex.: subida no meio do ar sem embalo nenhum) e pode até deixar o piloto sem força líquida pra se mover.
 */
export const TIPOS_PROIBIDOS_NA_ABERTURA: ReadonlySet<IdTrecho> = new Set(['rampa', 'vao', 'degrau']);

const TRECHOS: readonly DefTrecho[] = [
  {
    id: 'reta',
    comprimentoM: 24,
    dificuldade: 0.05,
    velMinEntradaMs: 0,
    pontos: [
      { dx: 0, dy: 0, anguloGraus: -12 },
      { dx: 24, dy: -6, anguloGraus: -12 },
    ],
  },
  {
    id: 'ondulado',
    comprimentoM: 28,
    dificuldade: 0.2,
    velMinEntradaMs: 0,
    pontos: [
      { dx: 0, dy: 0, anguloGraus: -10 },
      { dx: 7, dy: -2, anguloGraus: 2 },
      { dx: 14, dy: -2.5, anguloGraus: -18 },
      { dx: 21, dy: -5, anguloGraus: 4 },
      { dx: 28, dy: -6, anguloGraus: -10 },
    ],
  },
  {
    id: 'rampa',
    comprimentoM: 14,
    dificuldade: 0.4,
    velMinEntradaMs: 4,
    pontos: [
      { dx: 0, dy: 0, anguloGraus: -14 },
      { dx: 9, dy: -2.2, anguloGraus: -14 },
      { dx: 14, dy: -1, anguloGraus: 22 },
    ],
  },
  {
    id: 'vao',
    comprimentoM: 16,
    dificuldade: 0.7,
    velMinEntradaMs: 7,
    proibidoApos: ['vao', 'degrau'],
    pontos: [
      // O ângulo aqui só valeria se o `vao` abrisse a pista (sem trecho anterior pra casar a tangente): por isso é
      // descida suave (-14°), não o ângulo de lançamento de uma rampa. Com um trecho anterior, o gerador SUBSTITUI
      // este valor pela tangente final dele (plano §3.4: "tangente casada"); normalmente é uma `rampa` (ang. final 22°).
      { dx: 0, dy: 0, anguloGraus: -14 },
      { dx: 3, dy: 1.1, anguloGraus: 0 },
      { dx: 5, dy: 1.1, anguloGraus: -32 },
      { dx: 9, dy: -3, anguloGraus: -32 },
      { dx: 11, dy: -4.6, anguloGraus: 0 },
      { dx: 16, dy: -4.6, anguloGraus: -12 },
    ],
  },
  {
    id: 'trilho',
    comprimentoM: 18,
    dificuldade: 0.3,
    velMinEntradaMs: 3,
    pontos: [
      { dx: 0, dy: 0, anguloGraus: -8 },
      { dx: 18, dy: -2.5, anguloGraus: -8 },
    ],
    trilho: { dx0: 2, dx1: 16, altura: 0.4 },
  },
  {
    id: 'pedras',
    comprimentoM: 20,
    dificuldade: 0.35,
    velMinEntradaMs: 0,
    pontos: [
      { dx: 0, dy: 0, anguloGraus: -12 },
      { dx: 20, dy: -4.3, anguloGraus: -12 },
    ],
    objetos: [
      { tipo: 'pedra', dx: 6, largura: 1.2, altura: 0.8, variante: 0 },
      { tipo: 'tronco', dx: 12, largura: 2, altura: 0.6, variante: 0 },
      { tipo: 'pedra', dx: 17, largura: 1, altura: 0.9, variante: 1 },
    ],
  },
  {
    id: 'degrau',
    comprimentoM: 10,
    dificuldade: 0.55,
    velMinEntradaMs: 5,
    proibidoApos: ['vao', 'degrau'],
    pontos: [
      { dx: 0, dy: 0, anguloGraus: -10 },
      { dx: 5, dy: -0.8, anguloGraus: -10 },
      { dx: 7, dy: -3.2, anguloGraus: -40 },
      { dx: 10, dy: -4, anguloGraus: -12 },
    ],
  },
  {
    id: 'boneco',
    comprimentoM: 16,
    dificuldade: 0.15,
    velMinEntradaMs: 0,
    pontos: [
      { dx: 0, dy: 0, anguloGraus: -9 },
      { dx: 16, dy: -2.6, anguloGraus: -9 },
    ],
    objetos: [{ tipo: 'boneco-de-neve', dx: 9, largura: 1.4, altura: 1.6, variante: 0 }],
  },
];

/** Catálogo oficial (8 trechos, plano §3.4). Mapa por id para o gerador consultar por peso de `DefPista.trechos`. */
export const CATALOGO_TRECHOS: ReadonlyMap<IdTrecho, DefTrecho> = new Map(TRECHOS.map((t) => [t.id, t]));

export type { ObjetoPista, Trilho };
