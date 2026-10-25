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
  /**
   * Multiplica só a componente da gravidade NO CHÃO (plano M3 §A.2): `aceleracao = -gravidadeMs2 * fatorEmbalo *
   * seno(angulo) - atrito*v - arrasto*v²`. Com 1 (padrão), `(-g * 1) * s` é EXATAMENTE `-g * s` em IEEE 754 — a Capi
   * (`CONFIG_PADRAO`) não muda nem um bit. É o campo de "aceleração" por personagem (M3 F1): o atrito de hoje é
   * imperceptível nessa escala (plano §0, achado 1), então aceleração ganha este campo próprio em vez de reusá-lo.
   */
  readonly fatorEmbalo: number;
}

export const CONFIG_PADRAO: ConfigDescida = {
  gravidadeMs2: 22,
  velocidadeMaxMs: 28,
  atrito: 0.02,
  atritoAgachado: 0.008,
  arrasto: 0.0015,
  // Calibragem "pulo mais forte" (dono, iPhone, 2026-10-24): 6 -> 9 m/s. Mais altura/tempo no ar no pulo comum (sem
  // kicker): hangtime em chão plano sobe de ~0,55 s (33 ticks) pra ~0,82 s (49 ticks) — ver diagnóstico no handoff.
  // Kickers (`IMPULSO_KICKER_MS=32`, `pista/camada-jogo.ts`) já davam ar de sobra; o alvo aqui é o pulo DO DIA A DIA.
  impulsoPuloMs: 9,
  fatorRampaMsPorGrau: 0.12,
  giroVelMaxGrausPorTick: 6,
  giroAcelGrausPorTick2: 2,
  // Calibragem "controle no ar mais gostoso": 8 -> 6 ticks (133ms -> 100ms) de atraso antes do giro responder. Ainda
  // filtra um toque rápido (pulo sem girar), só responde mais rápido a quem segura giro de propósito.
  atrasoGiroTicks: 6,
  amortecimentoGiro: 0.6,
  limiarPerfeitoGraus: 8,
  // Calibragem "travar menos" (dono, iPhone, 2026-10-24; medido em `ferramentas/diagnostico-travar-tmp.mjs`, achado
  // #1: pouso "torto" sozinho custava ~20s de 46s de corrida média, de LONGE a maior causa de "travar" — mais que
  // tombo literal e mais que item). 24 -> 32: mais pousos caem na faixa "bom" (perde só 10%, `fatorPerdaBom`) em vez
  // de "torto". `fatorPerdaTorto` abaixo também suavizado: quem ainda cai torto perde menos e recupera mais rápido.
  limiarBomGraus: 32,
  // 58 -> 62: um pouco mais de margem antes de um pouso feio virar tombo de verdade (queda completa).
  limiarTortoGraus: 62,
  fatorPerdaBom: 0.9,
  // 0.65 -> 0.8: perde 20% da velocidade num pouso torto (era 35%) — o achado #1 acima: a PUNIÇÃO em si, não só a
  // frequência, era o que fazia a recuperação demorar segundos (atrito/arrasto são fracos nessa escala; devolver a
  // velocidade perdida é lento por natureza — perder menos de cara é o jeito direto de travar menos tempo).
  fatorPerdaTorto: 0.8,
  ticksTombo: 90,
  velocidadeRespawnMs: 4,
  fatorBonecoDeNeve: 0.85,
  velocidadeMinimaChaoMs: 1.5,
  fatorEmbalo: 1,
};

/** Velocidade (m/s) abaixo da qual o piloto é considerado "parado" para fins de pose/HUD. */
export const VELOCIDADE_PARADO_MS = 0.3;

/**
 * Versão do motor da descida (contrato C6, `ReplayV1.versaoMotor`): identifica QUAL física gravou um replay. Mudar
 * uma constante de `CONFIG_PADRAO` ou a lógica de `motor.ts` de um jeito que muda o resultado de um replay já salvo
 * deve bumpar este texto — um fantasma gravado por uma versão antiga ainda decodifica (`ReplayV1` não trava nisso),
 * mas passa a rodar com a física NOVA: pode dessincronizar visualmente do que o jogador viu na hora (cosmético, sem
 * risco de segurança). Texto livre de 1 a 32 caracteres (ver `VERSAO_MOTOR_MAX` em `core/replay.ts`).
 *
 * Bump para '2' na F0 do M3 (física por personagem, plano §A.3): a partir daqui o motor lê `ConfigDescida` por
 * personagem, não só `CONFIG_PADRAO`. Replay `v1` só decodifica com a física de `v2` SEM dessincronizar quando é
 * da Capi (a física dela não mudou — `configDoPersonagem(capi) === CONFIG_PADRAO` campo a campo); de qualquer
 * outro personagem, `criarReprodutorFantasma` rejeita e a descida roda sem fantasma (`descida/replay.ts`).
 *
 * Bump para '3' na calibragem "pulo mais forte / travar menos" (dono, iPhone, 2026-10-24): `CONFIG_PADRAO` mudou de
 * verdade (pulo, janela de pouso) — isso muda a física de TODO personagem, inclusive a Capi (ela É `CONFIG_PADRAO`,
 * `descida/atributos.ts`). Diferente do bump '1'->'2', não há exceção de compatibilidade aqui: um replay `v2` (de
 * qualquer personagem) passa a rejeitar igual a um `v1` de não-Capi — a descida roda sem fantasma, continua sem ser
 * erro de boot (`descida/replay.ts`). Recordes/fantasmas antigos seguem o corte de versão que a `meta/` já tem
 * (`recordesAntigos`, por `versaoPista`); o dono já aprovou essa perda (não é regressão, é o preço de melhorar a
 * física).
 *
 * Bump para '4' na correção "preso no respawn perto de obstáculo" (dono/iPhone, 2026-10-25, Campeonato/Morro do
 * Pinhão/Vó Cidinha — ver comentário grande de `TICKS_INVULNERAVEL_RESPAWN` em `descida/motor.ts`): `respawn()`
 * passou a empurrar o ponto de volta pra depois de obstáculo próximo e abrir uma janela de imunidade. Só muda o
 * resultado de um replay quando um tombo acontece perto demais de um obstáculo (a maioria não muda nada); mesmo
 * padrão dos bumps anteriores: sem exceção de compatibilidade, replay `v3` roda sem fantasma.
 */
export const VERSAO_MOTOR = '4';
