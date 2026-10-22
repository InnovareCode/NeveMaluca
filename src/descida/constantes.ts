/**
 * Constantes de física do motor da descida (plano §3.3). Números de PARTIDA (o próprio plano os chama assim):
 * afinar no M1a com o harness e, depois, no aparelho com o dono. `ConfigDescida` é DADO injetável (não embutido),
 * para o M3 trocar por atributos por personagem (`DefPersonagem`, orçamento fixo, plano §4) sem mudar o motor.
 */

export interface ConfigDescida {
  /** Gravidade no ar, m/s². */
  readonly gravidadeMs2: number;
  /** Teto de velocidade no chão, m/s. */
  readonly velocidadeMaxMs: number;
  /** Atrito linear no chão (de pé), por segundo. */
  readonly atrito: number;
  /** Atrito linear no chão, agachado (menor: plano §3.3 "agachar reduz o arrasto"). */
  readonly atritoAgachado: number;
  /** Arrasto quadrático no chão, por segundo. */
  readonly arrasto: number;
  /** Impulso do pulo na direção da normal do terreno, m/s. */
  readonly impulsoPuloMs: number;
  /** Bônus de impulso por grau de inclinação ascendente no pulo (rampa/kicker), m/s por grau. */
  readonly fatorRampaMsPorGrau: number;
  /** Velocidade angular máxima do giro segurado, graus por tick. */
  readonly giroVelMaxGrausPorTick: number;
  /** Aceleração angular do giro até o teto, graus por tick². */
  readonly giroAcelGrausPorTick2: number;
  /** Ticks segurando giro antes dele começar a girar de verdade (plano §3.3: "um toque rápido é só um pulo"). */
  readonly atrasoGiroTicks: number;
  /** Fator de amortecimento da velocidade angular por tick quando o giro é solto (sem giro ativo). */
  readonly amortecimentoGiro: number;
  /** Diferença de ângulo (graus) entre corpo e terreno no pouso até a qual é "perfeito". */
  readonly limiarPerfeitoGraus: number;
  /** Até aqui, "bom". */
  readonly limiarBomGraus: number;
  /** Até aqui, "torto" (plano §3.3 chama de `janelaBoa`); acima disso é tombo por ângulo. */
  readonly limiarTortoGraus: number;
  /** Fração da velocidade mantida num pouso "bom". */
  readonly fatorPerdaBom: number;
  /** Fração da velocidade mantida num pouso "torto". */
  readonly fatorPerdaTorto: number;
  /** Ticks da animação de tombo (plano §3.3: "90 ticks"). */
  readonly ticksTombo: number;
  /** Velocidade (m/s) ao renascer no último checkpoint depois de um tombo. */
  readonly velocidadeRespawnMs: number;
  /** Fração da velocidade mantida ao atravessar um boneco de neve (plano §3.3: "perde um pouco de velocidade"). */
  readonly fatorBonecoDeNeve: number;
  /**
   * Velocidade mínima (m/s) no chão. Rede de segurança: não há "freio" no jogo (agachar ACELERA, reduzindo o
   * arrasto), então a única forma de a velocidade cair a zero é um trecho achatado/subida vencer a gravidade — e,
   * nesse ponto exato, a força líquida também é zero e o piloto ficaria parado PARA SEMPRE (clamp em 0 do §3.3 não
   * deixa andar de ré). Esse piso garante que a descida sempre termina (plano §1: "nunca pune demais").
   */
  readonly velocidadeMinimaChaoMs: number;
}

export const CONFIG_PADRAO: ConfigDescida = {
  gravidadeMs2: 22,
  velocidadeMaxMs: 28,
  atrito: 0.02,
  atritoAgachado: 0.008,
  arrasto: 0.0015,
  impulsoPuloMs: 6,
  fatorRampaMsPorGrau: 0.12,
  giroVelMaxGrausPorTick: 6,
  giroAcelGrausPorTick2: 2,
  atrasoGiroTicks: 8,
  amortecimentoGiro: 0.6,
  limiarPerfeitoGraus: 8,
  limiarBomGraus: 24,
  limiarTortoGraus: 58,
  fatorPerdaBom: 0.9,
  fatorPerdaTorto: 0.65,
  ticksTombo: 90,
  velocidadeRespawnMs: 4,
  fatorBonecoDeNeve: 0.85,
  velocidadeMinimaChaoMs: 1.5,
};

/** Velocidade (m/s) abaixo da qual o piloto é considerado "parado" para fins de pose/HUD. */
export const VELOCIDADE_PARADO_MS = 0.3;
