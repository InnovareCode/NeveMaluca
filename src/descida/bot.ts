/**
 * Bot "cuidadoso" (plano §3.4: harness de pista). Reflexo puro sobre `LeituraDescida` + `PistaGerada`: olha um pouco
 * à frente, pula diante de rampa/obstáculo, e nivela o corpo no ar (giro contra o próprio ângulo) para pousar dentro
 * da janela. Nunca segura grab; agacha SÓ diante de um obstáculo alto (`obstaculosAltos`, plano corrida-campeonato
 * C4 — opcional, `[]` por padrão: harness/testes que não passam camada continuam IDÊNTICOS a antes do C4).
 * Determinístico: sem RNG, mesma leitura => mesmo comando.
 */
import type { ComandoDescida, Giro, Grab, LeituraDescida, ObjetoPista, PistaGerada } from '../core/contratos';
import { PASSO_S } from '../core/constantes';
import { MORTAL_VOLTAS_MAX } from '../data/manobras';
import { inclinacaoGrausEm, obstaculoDuroNaFaixa } from '../pista/consulta';
import type { ConfigDescida } from './constantes';

/** Primeiro obstáculo alto (`CamadaJogo.obstaculosAltos`) cujo retângulo cruza `[x0, x1]`, ou `null`. Mesmo padrão
 *  de `obstaculoDuroNaFaixa` (`pista/consulta.ts`), só que sobre a lista da CAMADA (não da `PistaGerada`). */
function obstaculoAltoNaFaixa(obstaculos: readonly ObjetoPista[], x0: number, x1: number): boolean {
  for (const o of obstaculos) if (o.x <= x1 && o.x + o.largura >= x0) return true;
  return false;
}

export interface OpcoesBotCuidadoso {
  /** Quantos metros adiante o bot olha para decidir se pula. */
  readonly antecipacaoM?: number;
  /** Inclinação (graus) a partir da qual uma subida adiante é tratada como rampa/kicker a saltar. */
  readonly limiarRampaGraus?: number;
  /** Ângulo do corpo (graus) acima do qual o bot gira no ar para nivelar antes do pouso. */
  readonly limiarNivelarGraus?: number;
  /**
   * Velocidade mínima (m/s) para o bot pular só porque viu uma subida adiante (não vale para obstáculo: esse pulo é
   * sempre obrigatório). Pular quase parado ganha pouca altura/distância e costuma pousar mal, numa subida, com
   * ainda menos velocidade — risco de ficar "preso" (sem força líquida pra sair do lugar). Esperar um pouco de
   * embalo antes de arriscar o salto de rampa evita essa armadilha.
   */
  readonly velocidadeMinParaPularDeRampaMs?: number;
}

const PADRAO: Required<OpcoesBotCuidadoso> = { antecipacaoM: 4, limiarRampaGraus: 8, limiarNivelarGraus: 6, velocidadeMinParaPularDeRampaMs: 3 };

/**
 * Cria a função de decisão do bot para UMA pista. Chamar a cada tick com a `LeituraDescida` mais recente.
 * `obstaculosAltos` (C4): default `[]` — sem ele, o bot nunca agacha (comportamento de antes do C4, intacto).
 */
export function criarBotCuidadoso(
  pista: PistaGerada,
  opcoes: OpcoesBotCuidadoso = {},
  obstaculosAltos: readonly ObjetoPista[] = [],
): (leitura: LeituraDescida) => ComandoDescida {
  const cfg = { ...PADRAO, ...opcoes };
  // Nivelar é uma decisão TOMADA UMA VEZ por voo, não recalculada a cada tick: girar segurado tem `atrasoGiroTicks`
  // de delay (plano §3.3, "um toque rápido é só um pulo") ANTES de a velocidade angular começar a mudar de verdade.
  // Reavaliar o sinal do giro a cada tick faz o bot alternar de direção enquanto a velocidade angular antiga ainda
  // está "a caminho" de zerar, e o corpo passa a girar mais ainda na direção ERRADA durante esse atraso — oscilação
  // que pode crescer sem parar numa queda longa. Decidir uma vez (e desistir ao cruzar o zero) corrige sem oscilar.
  let giroDecidido: Giro = 0;
  let anguloAoDecidir = 0;
  let noArAnterior = false;
  return (leitura: LeituraDescida): ComandoDescida => {
    const { piloto } = leitura;
    let pulo = false;
    let agachar = false;
    if (piloto.modo === 'chao' || piloto.modo === 'trilho') {
      const inclinacaoAdiante = inclinacaoGrausEm(pista, piloto.x + cfg.antecipacaoM);
      const obstaculoAdiante = obstaculoDuroNaFaixa(pista, piloto.x, piloto.x + cfg.antecipacaoM);
      const rampaAdiante = inclinacaoAdiante > cfg.limiarRampaGraus && piloto.velocidade >= cfg.velocidadeMinParaPularDeRampaMs;
      pulo = rampaAdiante || obstaculoAdiante;
      // Obstáculo alto SÓ passa agachado (C4): agacha desde que vê (mesma janela `antecipacaoM`) até passar por
      // ele — cautela do cuidadoso, não o reflexo de última hora do "por um fio" (esse bônus é pra quem arrisca).
      agachar = obstaculoAltoNaFaixa(obstaculosAltos, piloto.x, piloto.x + cfg.antecipacaoM);
    }

    const noAr = piloto.modo === 'ar';
    if (!noAr) giroDecidido = 0;
    else if (!noArAnterior) {
      // Acabou de decolar nesta leitura: decide a direção UMA vez, se valer a pena corrigir.
      giroDecidido = piloto.angulo > cfg.limiarNivelarGraus ? -1 : piloto.angulo < -cfg.limiarNivelarGraus ? 1 : 0;
      anguloAoDecidir = piloto.angulo;
    } else if (giroDecidido !== 0) {
      // Já cruzou o nível (zero) ou passou para o lado oposto de onde começou: para de corrigir (evita ultrapassar).
      const cruzouOuNivelou = anguloAoDecidir >= 0 ? piloto.angulo <= 0 : piloto.angulo >= 0;
      if (cruzouOuNivelou) giroDecidido = 0;
    }
    noArAnterior = noAr;

    return { pulo, giro: giroDecidido, grab: null, agachar };
  };
}

/**
 * Bot "manobreiro" (plano M3 §A.4): mede o TETO PRÁTICO de pontos de cada personagem, não só se a pista é vencível.
 * Ao contrário do cuidadoso (nunca gira de propósito, nunca segura grab), o manobreiro LÊ a própria `ConfigDescida`
 * a cada decolagem e planeja o voo: estima o tempo no ar pela balística simétrica (sobe e desce na mesma altura —
 * aproximação; a pista real nem sempre devolve na mesma altura, por isso sobra margem de segurança), decide quantas
 * voltas completas (1 a `MORTAL_VOLTAS_MAX`) cabem com a velocidade/aceleração de giro DELE e larga o giro a tempo
 * de "convergir" antes do pouso estimado — e segura grab o voo inteiro (não compete com o giro: são campos
 * independentes de `ComandoDescida`, contrato C2). Determinístico: a decisão usa só a física do personagem e a
 * leitura do motor, nunca RNG/relógio (proibido em `descida/`, ver `tests/support/varredura.ts`); por isso também
 * nenhuma conta aqui usa `Math.log`/`Math.pow` (banidos na mesma varredura) — a convergência do amortecimento é um
 * laço, não uma fórmula fechada.
 *
 * Por que uma volta completa não estraga o pouso: a física do giro é simétrica para `+1`/`-1` (mesmo ganho, mesma
 * aceleração), então o corpo volta para o MESMO ângulo relativo que tinha ao decolar depois de qualquer múltiplo de
 * 360° — pousar depois de N voltas certas é tão seguro quanto não girar nada (a estratégia do cuidadoso), a menos do
 * "overshoot" do amortecimento ao soltar o giro, pequeno e previsível (série geométrica, `overshootAoSoltar`) frente
 * à janela de pouso (`limiarBomGraus`/`limiarTortoGraus`, que também variam por personagem via equilíbrio).
 */
export interface OpcoesBotManobreiro {
  /** Quantos metros adiante o bot olha para decidir se pula. */
  readonly antecipacaoM?: number;
  /** Inclinação (graus) a partir da qual uma subida adiante é tratada como rampa/kicker a saltar. */
  readonly limiarRampaGraus?: number;
  /** Velocidade mínima (m/s) para pular (de rampa ou "de estilo"; obstáculo sempre pula). */
  readonly velocidadeMinParaPularDeRampaMs?: number;
  /** Ângulo do corpo (graus) acima do qual o bot nivela no ar quando NÃO está tentando voltas (plano B, sem giro). */
  readonly limiarNivelarGraus?: number;
  /**
   * Nível de risco (plano §A.4: "2 ou 3 níveis de ousadia, e conta o melhor deles"). `0` só pula quando precisa
   * (obstáculo/rampa, igual ao cuidadoso); `1` e `2` também pulam do chão plano de vez em quando (a cada N ticks sem
   * pular) só para gerar mais ar/grab/giro — mais ousadia, mais pulos, mais chance de pousar mal em algum deles.
   */
  readonly ousadia?: 0 | 1 | 2;
}

const PADRAO_MANOBREIRO: Required<OpcoesBotManobreiro> = {
  antecipacaoM: 4,
  limiarRampaGraus: 8,
  velocidadeMinParaPularDeRampaMs: 3,
  limiarNivelarGraus: 6,
  ousadia: 0,
};

/** Ticks no chão sem pular até o bot forçar um pulo "de estilo" (só para pontuar), por nível de ousadia. */
const INTERVALO_PULO_VOLUNTARIO_TICKS: Readonly<Record<0 | 1 | 2, number>> = { 0: Number.POSITIVE_INFINITY, 1: 90, 2: 45 };

/** Grab escolhido pelo manobreiro: qualquer um dos 4 pontua igual (`GRAB_BASE`/passo não distingue qual, §3.5). */
const GRAB_DO_MANOBREIRO: Grab = 'cima';

/**
 * Tempo de ar (ticks) estimado pela balística simétrica: sobe e desce de volta à MESMA altura de decolagem. É só
 * uma aproximação para PLANEJAR o voo (a pista raramente devolve exatamente na mesma altura) — quem decide o pouso
 * de verdade é sempre o motor, nunca esta estimativa.
 */
export function estimarTicksNoAr(config: ConfigDescida, vyDecolagem: number): number {
  if (vyDecolagem <= 0) return 0;
  return Math.round((2 * vyDecolagem) / (config.gravidadeMs2 * PASSO_S));
}

/** Quantos graus o giro ainda soma (série geométrica do amortecimento, razão < 1) depois de o bot soltar o comando,
 *  a partir de `velAngular` graus/tick — fecha a conta de "até onde o corpo continua girando por inércia". */
function overshootAoSoltar(velAngular: number, amortecimentoGiro: number): number {
  if (amortecimentoGiro <= 0 || amortecimentoGiro >= 1) return 0;
  return velAngular / (1 - amortecimentoGiro);
}

/**
 * Ticks até o amortecimento reduzir a velocidade angular máxima a 1% dela: a margem de segurança reservada antes
 * do pouso estimado. Um LAÇO, de propósito — `Math.log` fecharia a conta direto, mas é banido em `descida/`
 * (determinismo entre motores, `tests/support/varredura.ts`); o teto de 200 ticks (3,3 s) é só para nunca rodar
 * para sempre se algum `ConfigDescida` absurdo tiver `amortecimentoGiro` muito perto de 1.
 */
function ticksDeMargemParaConvergir(config: ConfigDescida): number {
  if (config.amortecimentoGiro <= 0 || config.amortecimentoGiro >= 1) return 0;
  const limiar = config.giroVelMaxGrausPorTick * 0.01;
  let vel = config.giroVelMaxGrausPorTick;
  let ticks = 0;
  while (vel > limiar && ticks < 200) {
    vel *= config.amortecimentoGiro;
    ticks++;
  }
  return ticks;
}

export interface PlanoDeVoo {
  /** Voltas completas que o plano tenta (`0` = não vale a pena girar; só nivelar, como o cuidadoso). */
  readonly voltas: 0 | 1 | 2 | 3;
  /** Tick de `PilotoLeitura.ticksNoAr` (inclusive) em que o bot solta o giro. Irrelevante se `voltas` for `0`. */
  readonly ticksAteSoltar: number;
}

/**
 * Planeja o voo com a MESMA conta de `atualizarGiro` do motor (`descida/motor.ts`), replicada aqui fora dele só
 * para PREVER — nunca para decidir o ângulo real, que é sempre o motor quem resolve. Procura a MAIOR quantidade de
 * voltas completas (até `MORTAL_VOLTAS_MAX`: mais que isso não pontua mais, §3.5) que cabe no tempo de ar estimado,
 * já reservando `ticksDeMargemParaConvergir` como sobra de segurança no fim.
 */
export function planejarVoo(config: ConfigDescida, ticksArEstimados: number): PlanoDeVoo {
  const tetoTicks = ticksArEstimados - ticksDeMargemParaConvergir(config);
  if (tetoTicks <= 0) return { voltas: 0, ticksAteSoltar: 0 };

  const alvosGraus: number[] = [];
  for (let v = MORTAL_VOLTAS_MAX; v >= 1; v--) alvosGraus.push(v * 360);
  const tickDoAlvo = new Map<number, number>();

  let velAngular = 0;
  let graus = 0;
  for (let ticksNoAr = 1; ticksNoAr <= tetoTicks; ticksNoAr++) {
    if (ticksNoAr > config.atrasoGiroTicks) velAngular = Math.min(config.giroVelMaxGrausPorTick, velAngular + config.giroAcelGrausPorTick2);
    graus += velAngular;
    const comOvershoot = graus + overshootAoSoltar(velAngular, config.amortecimentoGiro);
    for (const alvo of alvosGraus) if (!tickDoAlvo.has(alvo) && comOvershoot >= alvo) tickDoAlvo.set(alvo, ticksNoAr);
  }
  for (const alvo of alvosGraus) {
    const tick = tickDoAlvo.get(alvo);
    if (tick !== undefined) return { voltas: (alvo / 360) as 1 | 2 | 3, ticksAteSoltar: tick };
  }
  return { voltas: 0, ticksAteSoltar: 0 };
}

/**
 * Cria a função de decisão do bot manobreiro para UMA pista e a `ConfigDescida` de UM personagem (plano §A.4: "o
 * bot manobreiro precisa conhecer a própria física; sem isso, o que se mede é o bot, e não o personagem").
 * `obstaculosAltos` (C4): default `[]`, mesma regra do cuidadoso.
 */
export function criarBotManobreiro(
  pista: PistaGerada,
  config: ConfigDescida,
  opcoes: OpcoesBotManobreiro = {},
  obstaculosAltos: readonly ObjetoPista[] = [],
): (leitura: LeituraDescida) => ComandoDescida {
  const cfg = { ...PADRAO_MANOBREIRO, ...opcoes };
  const intervaloVoluntario = INTERVALO_PULO_VOLUNTARIO_TICKS[cfg.ousadia];

  // Mesma cautela do cuidadoso: decisão de giro tomada UMA vez por voo (decolagem), não recalculada a cada tick.
  let giroDecidido: Giro = 0;
  let anguloAoDecidir = 0;
  let plano: PlanoDeVoo = { voltas: 0, ticksAteSoltar: 0 };
  let noArAnterior = false;
  let ticksNoChaoSemPular = 0;

  return (leitura: LeituraDescida): ComandoDescida => {
    const { piloto } = leitura;
    let pulo = false;
    let agachar = false;

    if (piloto.modo === 'chao' || piloto.modo === 'trilho') {
      ticksNoChaoSemPular++;
      const inclinacaoAdiante = inclinacaoGrausEm(pista, piloto.x + cfg.antecipacaoM);
      const obstaculoAdiante = obstaculoDuroNaFaixa(pista, piloto.x, piloto.x + cfg.antecipacaoM);
      const temVelocidadeParaPular = piloto.velocidade >= cfg.velocidadeMinParaPularDeRampaMs;
      const rampaAdiante = inclinacaoAdiante > cfg.limiarRampaGraus && temVelocidadeParaPular;
      const estiloVoluntario = ticksNoChaoSemPular >= intervaloVoluntario && temVelocidadeParaPular;
      pulo = rampaAdiante || obstaculoAdiante || estiloVoluntario;
      if (pulo) ticksNoChaoSemPular = 0;
      // Obstáculo alto SÓ passa agachado (C4): o manobreiro agacha (não pula por cima) — ousado no ar, não aqui.
      agachar = obstaculoAltoNaFaixa(obstaculosAltos, piloto.x, piloto.x + cfg.antecipacaoM);
    }

    const noAr = piloto.modo === 'ar';
    if (!noAr) {
      giroDecidido = 0;
    } else if (!noArAnterior) {
      // Decolagem detectada NESTA leitura (`ticksNoAr === 0`, `vy` já é a velocidade de decolagem): planeja o voo.
      plano = planejarVoo(config, estimarTicksNoAr(config, piloto.vy));
      if (plano.voltas > 0) {
        giroDecidido = 1; // sentido é arbitrário (física simétrica): sempre pra frente, por determinismo.
      } else {
        giroDecidido = piloto.angulo > cfg.limiarNivelarGraus ? -1 : piloto.angulo < -cfg.limiarNivelarGraus ? 1 : 0;
        anguloAoDecidir = piloto.angulo;
      }
    } else if (plano.voltas > 0) {
      if (piloto.ticksNoAr >= plano.ticksAteSoltar) giroDecidido = 0;
    } else if (giroDecidido !== 0) {
      const cruzouOuNivelou = anguloAoDecidir >= 0 ? piloto.angulo <= 0 : piloto.angulo >= 0;
      if (cruzouOuNivelou) giroDecidido = 0;
    }
    noArAnterior = noAr;

    return { pulo, giro: giroDecidido, grab: noAr ? GRAB_DO_MANOBREIRO : null, agachar };
  };
}
