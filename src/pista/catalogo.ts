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

/**
 * Trechos cujo início é seguro para virar checkpoint (chão estável, sem risco de respawn no meio do ar/queda).
 * `palito-longo` entra pelo mesmo motivo que `trilho`: chão plano reto, sem lançamento nem queda. `varal` e
 * `chamine` (Vila) entram pela mesma razão: chão plano, sem lançamento nem queda. `basalto` (Vulcão) idem: chão
 * quase plano com obstáculos duros, sem lançamento nem queda — mesmo caso de `pedras`/`chamine`. `teleferico` e
 * `reta-avalanche` (Cume) idem: chão plano reto (trilho alto e longo / reta longa), sem lançamento nem queda.
 */
export const TIPOS_SEGUROS_PARA_CHECKPOINT: ReadonlySet<IdTrecho> = new Set([
  'reta',
  'ondulado',
  'trilho',
  'pedras',
  'boneco',
  'palito-longo',
  'varal',
  'chamine',
  'basalto',
  'teleferico',
  'reta-avalanche',
]);

/**
 * Trechos que nunca podem ABRIR a pista. `rampa`/`vao`/`degrau` têm a forma desenhada para encadear com o que vem
 * ANTES (um `vao` sobe porque antes dele veio o lançamento de uma `rampa`; um `degrau` parte de uma velocidade que
 * só existe depois de uma descida). Sem trecho anterior, o próprio formato do trecho fica fisicamente sem sentido
 * (ex.: subida no meio do ar sem embalo nenhum) e pode até deixar o piloto sem força líquida pra se mover.
 *
 * Trechos-assinatura do Picolé (M3 §B.2) que herdam a MESMA restrição, pela mesma razão: `kicker-duplo` e
 * `vao-calda` são formas de lançamento/vão (precisam de embalo de ANTES); `carrinhos` é uma série de degraus baixos
 * (mesmo caso de `degrau`). `palito-longo` fica de fora (é chão plano com trilho longo, como `trilho` já é hoje).
 *
 * Trechos-assinatura da Vila do Chocolate Quente (M3 §B.2) na mesma família: `telhados` é lançamento (beiral) +
 * queda (parede) encadeados, como `vao`; `escadaria` é uma série de quedas curtas, como `degrau`/`carrinhos`.
 * `varal` e `chamine` ficam de fora (chão plano, como `trilho`/`pedras`).
 *
 * Trechos-assinatura do Vulcão Pé-Gelado (M3 §B.2, ficha `docs/temas-pistas-m3.md` §3) na mesma família: `geiser`
 * é um lançamento curto e íngreme, mesma família de `rampa`; `ponte-basalto` e `cratera` são vãos (lançamento +
 * queda), mesma família de `vao`/`vao-calda`/`telhados` — precisam do embalo de ANTES. `basalto` fica de fora
 * (chão quase plano com obstáculos, como `pedras`/`chamine`).
 *
 * Trechos-assinatura do Cume da Ventania (M3 §B.2, ficha `docs/temas-pistas-m3.md` §4, última pista) na mesma
 * família: `fenda-corda` é um vão com trilho por cima (mesma família de `vao`/`ponte-basalto` — precisa do embalo
 * de ANTES); `cornija` é o "degrau grande" (mesma família de `degrau`/`escadaria`, queda maior). `teleferico`
 * (trilho alto e longo, chão plano) e `reta-avalanche` (reta longa, chão plano) ficam de fora, mesmo caso de
 * `trilho`/`reta`.
 */
export const TIPOS_PROIBIDOS_NA_ABERTURA: ReadonlySet<IdTrecho> = new Set([
  'rampa',
  'vao',
  'degrau',
  'kicker-duplo',
  'vao-calda',
  'carrinhos',
  'telhados',
  'escadaria',
  'geiser',
  'ponte-basalto',
  'cratera',
  'fenda-corda',
  'cornija',
]);

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

  // --- Trechos-assinatura do Pico do Picolé (M3 F3, plano §B.2/§B.3). SÓ GEOMETRIA (forma do terreno): a pele
  // (casquinha, calda, palito, carrinho) é desenhada pelo `PintorTema` da Lyra a partir da inclinação (plano
  // §0.4 de `docs/temas-pistas-m3.md`) e dos tipos de objeto já existentes — nenhum `TipoObjeto` novo, nenhuma
  // mudança no algoritmo do gerador. Regra do F0: entram SÓ NO FIM deste array, e nenhum trecho de cima foi tocado.
  {
    id: 'kicker-duplo',
    comprimentoM: 37,
    dificuldade: 0.5,
    velMinEntradaMs: 6,
    proibidoApos: ['vao-calda', 'carrinhos'],
    pontos: [
      // Dois lançamentos em sequência (duas "casquinhas"), cada um com a MESMA forma de `rampa` (sobe e lança a
      // 22°), ligados por uma queda-e-recupera curta (mesmo desenho de `vao`, encurtado: sobe um pouco com a
      // tangente do 1º lançamento, vira e desce, flat para o 2º lançamento).
      { dx: 0, dy: 0, anguloGraus: -14 },
      { dx: 9, dy: -2.2, anguloGraus: -14 },
      { dx: 14, dy: -1, anguloGraus: 22 }, // 1º lançamento
      { dx: 17, dy: 0.1, anguloGraus: 0 },
      { dx: 19, dy: 0.1, anguloGraus: -32 },
      { dx: 23, dy: -2.9, anguloGraus: -14 },
      { dx: 32, dy: -5.1, anguloGraus: -14 },
      { dx: 37, dy: -3.9, anguloGraus: 22 }, // 2º lançamento
    ],
  },
  {
    id: 'palito-longo',
    comprimentoM: 32,
    dificuldade: 0.3,
    velMinEntradaMs: 3,
    pontos: [
      // Chão plano e reto, como `trilho`, só mais longo (mesma inclinação média): o trilho de palitos emendados.
      { dx: 0, dy: 0, anguloGraus: -8 },
      { dx: 32, dy: -4.5, anguloGraus: -8 },
    ],
    trilho: { dx0: 2, dx1: 30, altura: 0.4 },
  },
  {
    id: 'vao-calda',
    comprimentoM: 18,
    dificuldade: 0.65,
    velMinEntradaMs: 7,
    proibidoApos: ['vao-calda', 'carrinhos'],
    pontos: [
      // Mesma família de forma do `vao` (sobe com a tangente de um lançamento anterior, vira no alto e desce numa
      // queda), só um pouco mais largo. A pele de calda de chocolate congelada entra pela QUEDA detectada na
      // inclinação (plano §0.4), não por um tipo de objeto novo.
      { dx: 0, dy: 0, anguloGraus: -14 },
      { dx: 3, dy: 1.2, anguloGraus: 0 },
      { dx: 6, dy: 1.2, anguloGraus: -30 },
      { dx: 10, dy: -3.4, anguloGraus: -30 },
      { dx: 12, dy: -5, anguloGraus: 0 },
      { dx: 18, dy: -5, anguloGraus: -12 },
    ],
  },
  {
    id: 'carrinhos',
    comprimentoM: 22,
    dificuldade: 0.5,
    velMinEntradaMs: 4,
    proibidoApos: ['vao-calda', 'carrinhos'],
    pontos: [
      // Degraus baixos em série (dois, mais suaves que o `degrau` sozinho): cada queda vira um carrinho de
      // sorvete de decoração atrás da borda (decor sem física, plano §0.5), não um objeto físico novo.
      { dx: 0, dy: 0, anguloGraus: -10 },
      { dx: 5, dy: -0.6, anguloGraus: -10 },
      { dx: 7, dy: -2, anguloGraus: -30 },
      { dx: 11, dy: -2.6, anguloGraus: -10 },
      { dx: 16, dy: -3.2, anguloGraus: -10 },
      { dx: 18, dy: -4.4, anguloGraus: -30 },
      { dx: 22, dy: -5, anguloGraus: -12 },
    ],
  },

  // --- Trechos-assinatura da Vila do Chocolate Quente (M3 F3, plano §B.2/§B.3, ficha `docs/temas-pistas-m3.md`
  // §2). SÓ GEOMETRIA: a pele (telha colonial, enxaimel, varal de luzinhas, chaminé) é do `PintorTema` da Lyra,
  // a partir da mesma inclinação detectada (§0.4) e dos tipos de objeto já existentes (`pedra` -> chaminé/barril,
  // trilho -> varal). Nenhum `TipoObjeto` novo, nenhuma mudança no algoritmo do gerador. Regra do F0: entram SÓ
  // NO FIM deste array, e nenhum trecho de cima (nem os do Picolé) foi tocado.
  {
    id: 'telhados',
    comprimentoM: 28,
    dificuldade: 0.68,
    velMinEntradaMs: 7,
    proibidoApos: ['telhados', 'escadaria'],
    pontos: [
      // Mesma família de forma do `vao`/`vao-calda` (lançamento vindo de uma subida, vira no alto, desce numa
      // queda), com um trecho final mais longo e quase plano para representar o "telhado" de aterrissagem — a
      // sequência beiral (subida) -> parede (queda) -> telhado da ficha.
      { dx: 0, dy: 0, anguloGraus: -14 },
      { dx: 9, dy: -2.2, anguloGraus: -14 },
      { dx: 14, dy: -1, anguloGraus: 22 }, // beiral (subida, lançamento)
      { dx: 17, dy: 0.2, anguloGraus: 0 },
      { dx: 19, dy: 0.2, anguloGraus: -32 }, // parede (queda)
      { dx: 23, dy: -3.2, anguloGraus: -32 },
      { dx: 28, dy: -5.6, anguloGraus: -10 }, // telhado (pouso quase plano)
    ],
  },
  {
    id: 'escadaria',
    comprimentoM: 26,
    dificuldade: 0.58,
    velMinEntradaMs: 5,
    proibidoApos: ['telhados', 'escadaria'],
    pontos: [
      // Três quedas curtas em série (mais suaves que um `degrau` sozinho, mesma família de `carrinhos`): cada
      // queda vira uma paredinha enxaimel com a janela acendendo em degraus (pele, sem física nova).
      { dx: 0, dy: 0, anguloGraus: -10 },
      { dx: 4, dy: -0.5, anguloGraus: -10 },
      { dx: 6, dy: -1.7, anguloGraus: -32 },
      { dx: 9, dy: -2.2, anguloGraus: -10 },
      { dx: 13, dy: -2.8, anguloGraus: -10 },
      { dx: 15, dy: -4.0, anguloGraus: -32 },
      { dx: 18, dy: -4.6, anguloGraus: -10 },
      { dx: 22, dy: -5.2, anguloGraus: -10 },
      { dx: 24, dy: -6.4, anguloGraus: -32 },
      { dx: 26, dy: -7.0, anguloGraus: -12 },
    ],
  },
  {
    id: 'varal',
    comprimentoM: 34,
    dificuldade: 0.32,
    velMinEntradaMs: 3,
    pontos: [
      // Chão plano e reto, como `trilho`/`palito-longo` (a ficha exige reta: "curva de varal enganaria o pulo"),
      // só mais longo: o varal de luzinhas com 3 postes ou mais.
      { dx: 0, dy: 0, anguloGraus: -8 },
      { dx: 34, dy: -4.8, anguloGraus: -8 },
    ],
    trilho: { dx0: 2, dx1: 32, altura: 0.4 },
  },
  {
    id: 'chamine',
    comprimentoM: 18,
    dificuldade: 0.35,
    velMinEntradaMs: 0,
    pontos: [
      // Chão quase plano, como `pedras`, com UM obstáculo só (a chaminé no meio do telhado) em vez de três.
      { dx: 0, dy: 0, anguloGraus: -11 },
      { dx: 18, dy: -3.9, anguloGraus: -11 },
    ],
    objetos: [{ tipo: 'pedra', dx: 9, largura: 1.4, altura: 1.0, variante: 0 }],
  },

  // --- Trechos-assinatura do Vulcão Pé-Gelado (M3 F3, plano §B.2/§B.3, ficha `docs/temas-pistas-m3.md` §3).
  // SÓ GEOMETRIA: a pele (crosta de gêiser, ponte de basalto, prisma de basalto, parede de basalto com rachadura
  // de magma) é do `PintorTema` da Lyra, pela mesma detecção de inclinação (§0.4) e pelos tipos de objeto já
  // existentes (`pedra` -> prisma/bomba vulcânica, trilho -> ponte de basalto). Nenhum `TipoObjeto` novo, nenhuma
  // mudança no algoritmo do gerador. Regra do F0: entram SÓ NO FIM deste array, e nenhum trecho de cima (Morro,
  // Picolé, Vila) foi tocado.
  {
    id: 'geiser',
    comprimentoM: 10,
    dificuldade: 0.55,
    velMinEntradaMs: 6,
    pontos: [
      // Mesma família de forma da `rampa` (sobe e lança), só mais curta e mais íngreme ("crosta de gêiser"): o
      // ângulo final de lançamento é maior (30° em vez de 22°).
      { dx: 0, dy: 0, anguloGraus: -14 },
      { dx: 5, dy: -1.0, anguloGraus: -14 },
      { dx: 10, dy: 0.4, anguloGraus: 30 },
    ],
  },
  {
    id: 'ponte-basalto',
    comprimentoM: 18,
    dificuldade: 0.72,
    velMinEntradaMs: 7,
    proibidoApos: ['ponte-basalto', 'cratera'],
    pontos: [
      // Mesma família de forma do `vao` (sobe com a tangente de um lançamento anterior, vira no alto e desce numa
      // queda): o "vão com trilho por cima" da ficha é esta mesma cova, com um trilho (a ponte de lajes) atravessando
      // por cima dela — o jogador escolhe grindar a ponte ou cair na cova e pousar embaixo.
      { dx: 0, dy: 0, anguloGraus: -14 },
      { dx: 3, dy: 1.3, anguloGraus: 0 },
      { dx: 6, dy: 1.3, anguloGraus: -32 },
      { dx: 10, dy: -3.6, anguloGraus: -32 },
      { dx: 13, dy: -5.4, anguloGraus: 0 },
      { dx: 18, dy: -5.4, anguloGraus: -12 },
    ],
    trilho: { dx0: 4, dx1: 12, altura: 0.5 },
  },
  {
    id: 'basalto',
    comprimentoM: 24,
    dificuldade: 0.5,
    velMinEntradaMs: 0,
    pontos: [
      // Chão quase plano, como `pedras`/`chamine`, com 3 obstáculos em sequência e alturas diferentes (os prismas
      // de basalto da ficha, "2 a 3 prismas em sequência, alturas diferentes").
      { dx: 0, dy: 0, anguloGraus: -12 },
      { dx: 24, dy: -5.2, anguloGraus: -12 },
    ],
    objetos: [
      { tipo: 'pedra', dx: 6, largura: 1.3, altura: 0.9, variante: 0 },
      { tipo: 'pedra', dx: 13, largura: 1.1, altura: 1.3, variante: 1 },
      { tipo: 'pedra', dx: 19, largura: 1.4, altura: 0.7, variante: 0 },
    ],
  },
  {
    id: 'cratera',
    comprimentoM: 26,
    dificuldade: 0.78,
    velMinEntradaMs: 8,
    proibidoApos: ['ponte-basalto', 'cratera'],
    pontos: [
      // Mesma família do `vao-calda`/`telhados` (lançamento + queda + pouso quase plano), só mais larga e funda: o
      // "vão largo" da ficha, com a maior parede de basalto e o maior brilho de magma da pista.
      { dx: 0, dy: 0, anguloGraus: -14 },
      { dx: 4, dy: 1.5, anguloGraus: 0 },
      { dx: 8, dy: 1.5, anguloGraus: -30 },
      { dx: 14, dy: -4.4, anguloGraus: -30 },
      { dx: 17, dy: -6.5, anguloGraus: 0 },
      { dx: 26, dy: -6.5, anguloGraus: -12 },
    ],
  },

  // --- Trechos-assinatura do Cume da Ventania (M3 F3, plano §B.2/§B.3, ficha `docs/temas-pistas-m3.md` §4,
  // última pista). SÓ GEOMETRIA: a pele (corda, cabo de teleférico, cornija enrolada com fenda de gelo, avalanche
  // cômica) é do `PintorTema` da Lyra, a partir da ALTURA do `trilho` (< 1 m = corda, >= 1 m = cabo de teleférico,
  // ficha §4.3) e da inclinação já detectada (§0.4). Nenhum `TipoObjeto` novo, nenhuma mudança no algoritmo do
  // gerador. Regra do F0: entram SÓ NO FIM deste array, e nenhum trecho de cima (Morro, Picolé, Vila, Vulcão) foi
  // tocado. `pedras`/`boneco`/`rampa` originais ficam nos pesos desta pista (reskinados: pedra -> rocha/bloco de
  // gelo, tronco -> laje de cornija caída, boneco -> boneco de cachecol ao vento, rampa -> cornija enrolada
  // genérica), mesmo padrão de reúso do Vulcão; `vao`/`degrau`/`trilho` originais ficam de fora (trocados pelos
  // irmãos temáticos `fenda-corda`/`cornija`/`teleferico`, que juntos cobrem as duas faixas de altura do trilho).
  {
    id: 'fenda-corda',
    comprimentoM: 20,
    dificuldade: 0.75,
    velMinEntradaMs: 8,
    proibidoApos: ['fenda-corda', 'cornija'],
    pontos: [
      // Mesma família de forma do `vao`/`ponte-basalto` (sobe com a tangente de um lançamento anterior, vira no
      // alto e desce numa queda): a fenda de gelo da ficha, com a ponte de corda atravessando por cima — o jogador
      // escolhe grindar a corda ou cair e pousar no fundo da fenda.
      { dx: 0, dy: 0, anguloGraus: -14 },
      { dx: 3, dy: 1.4, anguloGraus: 0 },
      { dx: 7, dy: 1.4, anguloGraus: -32 },
      { dx: 12, dy: -4.2, anguloGraus: -32 },
      { dx: 15, dy: -6.2, anguloGraus: 0 },
      { dx: 20, dy: -6.2, anguloGraus: -12 },
    ],
    // Altura < 1 m => pele "corda" (ficha §4.3), não "cabo de teleférico".
    trilho: { dx0: 5, dx1: 13, altura: 0.5 },
  },
  {
    id: 'teleferico',
    comprimentoM: 36,
    dificuldade: 0.35,
    velMinEntradaMs: 3,
    pontos: [
      // Chão plano e reto, como `trilho`/`varal`/`palito-longo`, só mais longo: o cabo de teleférico entre as duas
      // torres de treliça, sem postes no meio (o vazio embaixo é a graça da ficha).
      { dx: 0, dy: 0, anguloGraus: -8 },
      { dx: 36, dy: -5.0, anguloGraus: -8 },
    ],
    // Altura >= 1 m => pele "cabo de teleférico" (ficha §4.3), não "corda".
    trilho: { dx0: 2, dx1: 34, altura: 1.3 },
  },
  {
    id: 'cornija',
    comprimentoM: 16,
    dificuldade: 0.85,
    velMinEntradaMs: 8,
    proibidoApos: ['fenda-corda', 'cornija'],
    pontos: [
      // Mesma família de forma do `degrau`/`escadaria`, só maior e mais íngreme: o "degrau grande" da ficha, com a
      // onda de neve na borda de cima (SUBIDA -> cornija enrolada) e a fenda de gelo na queda de baixo.
      { dx: 0, dy: 0, anguloGraus: -10 },
      { dx: 7, dy: -1.0, anguloGraus: -10 },
      { dx: 10, dy: -6.0, anguloGraus: -48 },
      { dx: 16, dy: -7.6, anguloGraus: -12 },
    ],
  },
  {
    id: 'reta-avalanche',
    comprimentoM: 40,
    dificuldade: 0.25,
    velMinEntradaMs: 0,
    pontos: [
      // Chão plano e reto, como `reta`/`ondulado`, só a mais longa do catálogo: a reta final da ficha, onde a
      // avalanche cômica entra por trás (mecânica visual da F6, M3-D3; aqui é só a geometria da reta).
      { dx: 0, dy: 0, anguloGraus: -9 },
      { dx: 40, dy: -6.0, anguloGraus: -9 },
    ],
  },
];

/**
 * Catálogo oficial: 8 trechos base (plano §3.4) + trechos-assinatura por pista do M3 (§B.2), acrescentados ao FIM
 * nesta mesma lista, nesta ordem, para nunca mudar a sequência de RNG das pistas já publicadas (regra do F0 —
 * `CATALOGO_TRECHOS` só cresce, nunca reordena nem edita um trecho existente). Mapa por id para o gerador
 * consultar por peso de `DefPista.trechos`.
 */
export const CATALOGO_TRECHOS: ReadonlyMap<IdTrecho, DefTrecho> = new Map(TRECHOS.map((t) => [t.id, t]));

export type { ObjetoPista, Trilho };
