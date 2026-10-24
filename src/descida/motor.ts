/**
 * Motor puro da descida (plano §3.3, contratos C2/C3). Consome `ComandoDescida` (um por tick, via `processar`), devolve
 * `LeituraDescida` + `EventoDescida[]`. Escopo do M1a (plano §7): física, colisão, tombo, checkpoint e chegada. Manobras
 * pontuadas, combo e multiplicador são M2 (por isso `combo`/`pontos`/`coletados` aqui são placeholders estáveis, não
 * lógica ausente por descuido — ver `docs/handoff-vega-m1a.md`).
 *
 * `core/laco.ts` é a ÚNICA fonte de ticks por quadro: este módulo não lê relógio, não agenda nada, só conta o próprio
 * `tick` no estado a cada `processar()`. Determinístico: nada de `Math.random/Date/performance`, só `core/trig.ts` para
 * ângulo (nunca `Math.sin/cos/atan2/pow`). Hash do estado (`hashEstado`) é o que prova determinismo entre rodadas.
 *
 * Camada de jogo (plano `docs/plano-corrida-campeonato.md` §Arquitetura, C3): `opcoes.camada` (`CamadaJogo`) só é
 * lida quando presente — SEM `camada` (todo chamador de treino), nenhum destes 3 pontos muda 1 bit do resultado:
 *   1. kicker: pular com `piloto.x` dentro de uma zona de `camada.kickers` soma `impulsoMs` ao impulso do pulo
 *      (mesma fórmula de `bonusRampa`, só mais um termo).
 *   2. coleta: a cada tick, um círculo em volta do piloto contra `camada.itens` ainda não coletados (`EventoDescida`
 *      `'coleta'`, `LeituraDescida.coletados`).
 *   3. turbo de pouso (plano C-D7): só em `opcoes.modo === 'corrida'` — ao pousar bem (não "torto"), soma ao `p.v`
 *      (e ao teto de velocidade por alguns ticks, `estado.turboVel`, que decai e zera num tombo) uma fração dos
 *      pontos daquele voo. `hashEstado()` continua sem estes dois estados novos DE PROPÓSITO: o golden da Capi
 *      (`m3-congelamento-capi.test.ts`) roda sem `camada`/em modo `'treino'`, onde eles nunca saem de zero/vazio —
 *      incluí-los no hash mudaria a FORMA do valor hasheado (mais uma chave) e quebraria o golden sem nenhuma
 *      mudança de física real; a prova de determinismo do modo corrida é o `ResultadoCorrida` (`corrida/corrida.ts`).
 */
import type {
  EventoDescida,
  FaseDescida,
  Grab,
  Giro,
  IdPose,
  LeituraDescida,
  ModoDescida,
  ModoPiloto,
  OpcoesDescida,
  PistaGerada,
  PilotoLeitura,
  ComandoDescida,
} from '../core/contratos';
import { PASSO_S } from '../core/constantes';
import { ErroDeContrato } from '../core/erros';
import { hashDeValor } from '../core/hash';
import { cosseno, normalizarGraus, seno } from '../core/trig';
import { alturaEfetivaEm, alturaEm, bonecoDeNeveEm, inclinacaoGrausEm, obstaculoDuroEm, trilhoEm } from '../pista/consulta';
import { CONFIG_PADRAO, type ConfigDescida } from './constantes';
import {
  abrirJanela,
  adicionarManobra,
  comboInicial,
  deveFechar,
  fechar,
  leituraCombo,
  perder,
  tiqueJanela,
  type EstadoCombo,
  type ManobraFeita,
} from './combo';
import {
  AR_LIMIAR_TICKS,
  AR_PASSO_TICKS,
  AR_PONTOS_POR_PASSO,
  BONUS_ESTILO_PERFEITO,
  GRAB_BASE,
  GRAB_PASSO_TICKS,
  GRAB_PONTOS_POR_PASSO,
  MORTAL_PONTOS_POR_VOLTAS,
  MORTAL_VOLTAS_MAX,
  TETO_PONTOS,
  TRILHO_PASSO_TICKS,
  TRILHO_PONTOS_POR_PASSO,
} from '../data/manobras';

/** Turbo de pouso (plano C-D7, só em `modo === 'corrida'`): fração dos pontos do voo que vira velocidade extra. */
const TURBO_MS_POR_PONTO = 0.01;
/** Teto do bônus de velocidade acumulado (soma de pousos em sequência sem cair), m/s. */
const TURBO_TETO_EXTRA_MS = 12;
/** Decaimento do bônus por tick no chão/trilho (razão < 1, aplicado sempre, mesmo em 0): meia-vida ~69 ticks (~1,15 s). */
const TURBO_DECAIMENTO_POR_TICK = 0.99;

interface EstadoPiloto {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Velocidade escalar ao longo da tangente quando no chão/trilho (m/s, sempre >= 0: o piloto não anda pra trás). */
  v: number;
  modo: ModoPiloto;
  angulo: number;
  velAngular: number;
  anguloAcumulado: number;
  grab: Grab | null;
  agachado: boolean;
  ticksNoAr: number;
  ticksGirando: number;
  giroAnterior: Giro;
  trilhoAtual: { x0: number; x1: number; altura: number } | null;
}

interface EstadoDescida {
  tick: number;
  fase: FaseDescida;
  piloto: EstadoPiloto;
  distancia: number;
  proximoCheckpointIndex: number;
  ultimoCheckpointX: number;
  ticksTomboRestantes: number;
  tombosOcorridos: number;
  ticksLandCelebra: number;
  bonecosAtingidos: ReadonlySet<number>;
  ultimaQualidadePouso: 'perfeito' | 'bom' | 'torto' | null;
  // M2 — manobras, combo e pontuação
  pontos: number;
  combo: EstadoCombo;
  /** Ticks com grab segurado no voo atual (reset no pulo). */
  arTicksGrab: number;
  arGrab: Grab | null;
  /** Ticks deslizando no trilho atual (reset ao entrar no trilho). */
  trilhoTicks: number;
  // C3 — camada de jogo (plano corrida-campeonato §Arquitetura): zero/vazio quando `opcoes.camada` está ausente.
  /** Índices JÁ coletados de `opcoes.camada.itens` (nunca reaparecem, mesmo padrão de `bonecosAtingidos`). */
  itensColetados: ReadonlySet<number>;
  coletados: number;
  /** Bônus de velocidade do turbo de pouso (plano C-D7), só em `modo === 'corrida'`; decai a cada tick, zera num tombo. */
  turboVel: number;
}

export interface MotorDescida {
  /** Avança UM tick com o comando deste tick e devolve a leitura resultante (C3). */
  processar(cmd: ComandoDescida): LeituraDescida;
  /** Leitura atual, sem avançar (chamar antes do primeiro `processar()` devolve a fase `'contagem'`). */
  leitura(): LeituraDescida;
  /** Hash estável do estado interno completo (para provar determinismo e, no futuro, o `hashFinal` do replay C6). */
  hashEstado(): string;
  readonly config: ConfigDescida;
  /** Modo desta descida (plano corrida-campeonato, C0): `'treino'` sempre que `opcoes`/`opcoes.modo` for omitido. */
  readonly modo: ModoDescida;
}

/** Pontos de tempo de ar (plano §3.5: 10 a cada 0,1 s acima de 0,5 s). */
function pontosAr(ticksNoAr: number): number {
  if (ticksNoAr <= AR_LIMIAR_TICKS) return 0;
  return Math.floor((ticksNoAr - AR_LIMIAR_TICKS) / AR_PASSO_TICKS) * AR_PONTOS_POR_PASSO;
}
/** Pontos de grab (150 + 50 a cada 0,25 s segurando). */
function pontosGrab(ticksGrab: number): number {
  if (ticksGrab <= 0) return 0;
  return GRAB_BASE + Math.floor(ticksGrab / GRAB_PASSO_TICKS) * GRAB_PONTOS_POR_PASSO;
}
/** Pontos de trilho (20 a cada 0,1 s deslizando). */
function pontosTrilho(ticks: number): number {
  return Math.floor(ticks / TRILHO_PASSO_TICKS) * TRILHO_PONTOS_POR_PASSO;
}

function anguloEntreTangentes(a: number, b: number): number {
  const d = normalizarGraus(a - b);
  return d < 0 ? -d : d;
}

function poseDe(p: EstadoPiloto, fase: FaseDescida, ticksTomboRestantes: number, configTicksTombo: number, acabouDePousar: 'perfeito' | 'bom' | 'torto' | null): IdPose {
  if (fase === 'chegou') return 'celeb';
  if (fase === 'tombo') {
    const decorrido = configTicksTombo - ticksTomboRestantes;
    const terco = configTicksTombo / 3;
    return decorrido < terco ? 'fall0' : decorrido < terco * 2 ? 'fall1' : 'fall2';
  }
  if (p.modo === 'trilho') return 'rail';
  if (p.modo === 'ar') return p.ticksGirando > 0 ? 'flip0' : 'air';
  if (acabouDePousar !== null) return 'land';
  return p.agachado ? 'tuck0' : 'ride0';
}

function leituraDe(estado: EstadoDescida, eventos: readonly EventoDescida[]): LeituraDescida {
  const p = estado.piloto;
  const voltas = Math.floor((p.anguloAcumulado < 0 ? -p.anguloAcumulado : p.anguloAcumulado) / 360);
  const piloto: PilotoLeitura = {
    x: p.x,
    y: p.y,
    vx: p.vx,
    vy: p.vy,
    velocidade: Math.sqrt(p.vx * p.vx + p.vy * p.vy),
    angulo: p.angulo,
    anguloTerreno: p.angulo,
    modo: p.modo,
    pose: poseDe(p, estado.fase, estado.ticksTomboRestantes, CONFIG_PADRAO.ticksTombo, estado.ultimaQualidadePouso),
    grab: p.grab,
    voltas,
    ticksNoAr: p.ticksNoAr,
  };
  return {
    tick: estado.tick,
    fase: estado.fase,
    piloto,
    combo: leituraCombo(estado.combo),
    pontos: estado.pontos,
    distancia: estado.distancia,
    distanciaTotal: 0,
    coletados: estado.coletados,
    eventos,
  };
}

/**
 * Cria o motor para uma pista já gerada. `semente` é reservado (M2: canais de RNG de manobra), não usado no M1a.
 *
 * `opcoes` (plano corrida-campeonato, C0/C3): `camada` (coletáveis/kickers desta rodada, lida pelo motor desde C3 —
 * ver comentário no topo do arquivo) e `modo` (turbo de pouso só em `'corrida'`). Omitir `opcoes` (como todo
 * chamador de treino faz hoje) é, por construção, o comportamento de sempre: golden da Capi intacto.
 */
export function criarDescida(pista: PistaGerada, config: ConfigDescida = CONFIG_PADRAO, opcoes: OpcoesDescida = {}): MotorDescida {
  if (pista.alturas.length < 2) throw new ErroDeContrato('contrato-invalido', 'PistaGerada precisa de ao menos 2 amostras de altura');
  const modo: ModoDescida = opcoes.modo ?? 'treino';
  const camada = opcoes.camada;

  /** Impulso extra do kicker cujo `[x, x+largura]` cobre `x` (0 sem `camada`/sem kicker ali: ver comentário no topo). */
  function impulsoKickerEm(x: number): number {
    if (camada === undefined) return 0;
    for (const k of camada.kickers) if (x >= k.x && x <= k.x + k.largura) return k.impulsoMs;
    return 0;
  }

  const anguloInicial = inclinacaoGrausEm(pista, 0);

  let estado: EstadoDescida = {
    tick: -1,
    fase: 'contagem',
    piloto: {
      x: 0,
      y: pista.alturas[0] as number,
      vx: 0,
      vy: 0,
      v: 0,
      modo: 'chao',
      angulo: anguloInicial,
      velAngular: 0,
      anguloAcumulado: 0,
      grab: null,
      agachado: false,
      ticksNoAr: 0,
      ticksGirando: 0,
      giroAnterior: 0,
      trilhoAtual: null,
    },
    distancia: 0,
    proximoCheckpointIndex: pista.checkpoints.length > 0 && pista.checkpoints[0] === 0 ? 1 : 0,
    ultimoCheckpointX: 0,
    ticksTomboRestantes: 0,
    tombosOcorridos: 0,
    ticksLandCelebra: 0,
    bonecosAtingidos: new Set<number>(),
    ultimaQualidadePouso: null,
    pontos: 0,
    combo: comboInicial(),
    arTicksGrab: 0,
    arGrab: null,
    trilhoTicks: 0,
    itensColetados: new Set<number>(),
    coletados: 0,
    turboVel: 0,
  };

  function respawn(est: EstadoDescida): void {
    const x = est.ultimoCheckpointX;
    est.piloto.x = x;
    est.piloto.y = alturaEm(pista, x);
    est.piloto.angulo = inclinacaoGrausEm(pista, x);
    est.piloto.velAngular = 0;
    est.piloto.anguloAcumulado = 0;
    est.piloto.v = config.velocidadeRespawnMs;
    est.piloto.vx = est.piloto.v * cosseno(est.piloto.angulo);
    est.piloto.vy = est.piloto.v * seno(est.piloto.angulo);
    est.piloto.modo = 'chao';
    est.piloto.grab = null;
    est.piloto.ticksNoAr = 0;
    est.piloto.ticksGirando = 0;
    est.piloto.trilhoAtual = null;
    est.arTicksGrab = 0;
    est.arGrab = null;
    est.trilhoTicks = 0;
    est.turboVel = 0; // cair custa caro (plano C-D7): o tombo zera o bônus de velocidade do turbo de pouso.
    est.fase = 'descendo';
  }

  function atualizarGiro(p: EstadoPiloto, cmd: ComandoDescida): void {
    if (cmd.giro === 0) {
      p.ticksGirando = 0;
      p.velAngular *= config.amortecimentoGiro;
      p.giroAnterior = 0;
      return;
    }
    if (cmd.giro !== p.giroAnterior) p.ticksGirando = 0;
    p.ticksGirando++;
    p.giroAnterior = cmd.giro;
    if (p.ticksGirando <= config.atrasoGiroTicks) return;
    const alvo = cmd.giro * config.giroVelMaxGrausPorTick;
    if (p.velAngular < alvo) p.velAngular = Math.min(alvo, p.velAngular + config.giroAcelGrausPorTick2);
    else if (p.velAngular > alvo) p.velAngular = Math.max(alvo, p.velAngular - config.giroAcelGrausPorTick2);
  }

  /**
   * Commita as manobras do voo (ar, mortal, grab) no combo e emite os eventos. `perfeito` aplica o bônus de estilo.
   * Devolve a soma dos pontos DESTE voo (pré-combo, mesmos valores dos eventos de manobra) — só para o turbo de
   * pouso (C-D7) saber "quanto esse voo valeu"; não é o que fecha a pontuação (isso é `fecharCombo`).
   */
  function commitarVoo(eventos: EventoDescida[], perfeito: boolean): number {
    const p = estado.piloto;
    const bonus = perfeito ? 1 + BONUS_ESTILO_PERFEITO : 1;
    const feitas: ManobraFeita[] = [];
    const voltas = Math.floor((p.anguloAcumulado < 0 ? -p.anguloAcumulado : p.anguloAcumulado) / 360);
    if (voltas >= 1) {
      const base = MORTAL_PONTOS_POR_VOLTAS[voltas > MORTAL_VOLTAS_MAX ? MORTAL_VOLTAS_MAX : voltas] as number;
      feitas.push({ id: 'mortal', familia: 'mortal', pontos: Math.round(base * bonus) });
    }
    const ar = pontosAr(p.ticksNoAr);
    if (ar > 0) feitas.push({ id: 'ar', familia: 'ar', pontos: Math.round(ar * bonus) });
    const grab = pontosGrab(estado.arTicksGrab);
    if (grab > 0) feitas.push({ id: 'grab', familia: 'grab', pontos: Math.round(grab * bonus) });
    for (const m of feitas) eventos.push({ tipo: 'manobra', id: m.id, pontos: adicionarManobra(estado.combo, m) });
    estado.arTicksGrab = 0;
    estado.arGrab = null;
    return feitas.reduce((soma, m) => soma + m.pontos, 0);
  }

  /**
   * Turbo de pouso (plano C-D7): só em `modo === 'corrida'`. `pontosVoo` vem de `commitarVoo` (0 = voo sem
   * manobra = sem turbo, por construção: "manobrar tem que compensar", não qualquer pulo). Soma ao `p.v` AGORA
   * (sente-se na hora) e ao teto (`estado.turboVel`, decai no chão/trilho) para a velocidade não ser clampada de
   * volta no tick seguinte.
   */
  function aplicarTurboDePouso(pontosVoo: number): void {
    if (modo !== 'corrida' || pontosVoo <= 0) return;
    const ganho = Math.min(TURBO_TETO_EXTRA_MS - estado.turboVel, pontosVoo * TURBO_MS_POR_PONTO);
    if (ganho <= 0) return;
    estado.turboVel += ganho;
    const p = estado.piloto;
    p.v += ganho;
    p.vx = p.v * cosseno(p.angulo);
    p.vy = p.v * seno(p.angulo);
  }

  /** Commita a manobra de trilho (por tempo) no combo e emite o evento. */
  function commitarTrilho(eventos: EventoDescida[]): void {
    const pts = pontosTrilho(estado.trilhoTicks);
    estado.trilhoTicks = 0;
    if (pts > 0) eventos.push({ tipo: 'manobra', id: 'trilho', pontos: adicionarManobra(estado.combo, { id: 'trilho', familia: 'trilho', pontos: pts }) });
  }

  /** Fecha o combo (janela esgotou / torto / chegada): soma `soma * mult` à pontuação. */
  function fecharCombo(eventos: EventoDescida[]): void {
    if (!estado.combo.ativo) return;
    const r = fechar(estado.combo);
    estado.pontos += r.total;
    if (estado.pontos > TETO_PONTOS) estado.pontos = TETO_PONTOS;
    eventos.push({ tipo: 'combo-fechado', soma: r.soma, mult: r.mult, total: r.total });
  }

  /** Perde o combo (tombo): nada soma. */
  function perderCombo(eventos: EventoDescida[]): void {
    if (!estado.combo.ativo) return;
    eventos.push({ tipo: 'combo-perdido', soma: perder(estado.combo).soma });
  }

  function processarTick(cmd: ComandoDescida): readonly EventoDescida[] {
    const eventos: EventoDescida[] = [];
    const p = estado.piloto;
    estado.ultimaQualidadePouso = null;

    if (estado.fase === 'tombo') {
      estado.ticksTomboRestantes--;
      if (estado.ticksTomboRestantes <= 0) respawn(estado);
      return eventos;
    }
    if (estado.fase === 'chegou') return eventos;

    const modoInicial = p.modo;
    p.agachado = cmd.agachar;
    p.grab = p.modo === 'ar' ? cmd.grab : null;
    if (p.modo === 'trilho') estado.trilhoTicks++;
    if (p.modo === 'ar' && p.grab !== null) {
      estado.arTicksGrab++;
      estado.arGrab = p.grab;
    }

    if (p.modo === 'chao' || p.modo === 'trilho') {
      p.angulo = inclinacaoGrausEm(pista, p.x);
      p.velAngular = 0;
      p.ticksGirando = 0;
      p.giroAnterior = 0;
      p.anguloAcumulado = 0;

      if (cmd.pulo) {
        const foiTrilho = p.modo === 'trilho';
        const bonusRampa = p.angulo > 0 ? p.angulo * config.fatorRampaMsPorGrau : 0;
        const impulso = config.impulsoPuloMs + bonusRampa + impulsoKickerEm(p.x);
        const vxBase = p.v * cosseno(p.angulo);
        const vyBase = p.v * seno(p.angulo);
        p.vx = vxBase + impulso * -seno(p.angulo);
        p.vy = vyBase + impulso * cosseno(p.angulo);
        p.modo = 'ar';
        p.ticksNoAr = 0;
        p.trilhoAtual = null;
        estado.arTicksGrab = 0;
        estado.arGrab = null;
        if (foiTrilho) {
          eventos.push({ tipo: 'trilho', etapa: 'fim' });
          commitarTrilho(eventos);
        }
        eventos.push({ tipo: 'pulo', forca: impulso });
      } else {
        const atrito = p.agachado ? config.atritoAgachado : config.atrito;
        const aceleracao = -config.gravidadeMs2 * config.fatorEmbalo * seno(p.angulo) - atrito * p.v - config.arrasto * p.v * p.v;
        p.v = p.v + aceleracao * PASSO_S;
        if (p.v < config.velocidadeMinimaChaoMs) p.v = config.velocidadeMinimaChaoMs;
        // Turbo de pouso (C-D7): só em modo 'corrida' o teto sobe com `estado.turboVel` (ganho em cada pouso bom,
        // decaindo aqui a cada tick de chão/trilho); em 'treino' é SEMPRE `config.velocidadeMaxMs` (golden intacto).
        if (modo === 'corrida') estado.turboVel *= TURBO_DECAIMENTO_POR_TICK;
        const tetoVelocidade = modo === 'corrida' ? config.velocidadeMaxMs + estado.turboVel : config.velocidadeMaxMs;
        if (p.v > tetoVelocidade) p.v = tetoVelocidade;
        const novoX = p.x + p.v * cosseno(p.angulo) * PASSO_S;

        if (p.modo === 'trilho' && p.trilhoAtual !== null && novoX > p.trilhoAtual.x1) {
          p.modo = 'chao';
          p.trilhoAtual = null;
          eventos.push({ tipo: 'trilho', etapa: 'fim' });
          commitarTrilho(eventos);
          if (estado.combo.ativo) abrirJanela(estado.combo);
        }

        p.x = novoX;
        p.angulo = inclinacaoGrausEm(pista, p.x);
        p.y = alturaEfetivaEm(pista, p.x);
        p.vx = p.v * cosseno(p.angulo);
        p.vy = p.v * seno(p.angulo);

        if (p.modo === 'chao') {
          const bateu = obstaculoDuroEm(pista, p.x);
          if (bateu !== null) {
            estado.fase = 'tombo';
            estado.ticksTomboRestantes = config.ticksTombo;
            estado.tombosOcorridos++;
            perderCombo(eventos);
            eventos.push({ tipo: 'tombo', causa: 'obstaculo' });
          } else {
            const boneco = bonecoDeNeveEm(pista, p.x);
            if (boneco !== null && !estado.bonecosAtingidos.has(boneco.x)) {
              estado.bonecosAtingidos = new Set(estado.bonecosAtingidos).add(boneco.x);
              p.v *= config.fatorBonecoDeNeve;
              eventos.push({ tipo: 'boneco', x: boneco.x });
            }
          }
        }
      }
    } else {
      // modo === 'ar'
      atualizarGiro(p, cmd);
      p.angulo = normalizarGraus(p.angulo + p.velAngular);
      p.anguloAcumulado += p.velAngular;
      p.vy -= config.gravidadeMs2 * PASSO_S;
      p.x += p.vx * PASSO_S;
      p.y += p.vy * PASSO_S;
      p.ticksNoAr++;

      const trilhoAlvo = p.vy <= 0 ? trilhoEm(pista, p.x) : null;
      const alturaChao = trilhoAlvo !== null ? alturaEm(pista, p.x) + trilhoAlvo.altura : alturaEm(pista, p.x);
      if (p.y <= alturaChao) {
        const anguloTerreno = inclinacaoGrausEm(pista, p.x);
        const diff = anguloEntreTangentes(p.angulo, anguloTerreno);
        const vImpacto = Math.sqrt(p.vx * p.vx + p.vy * p.vy);

        if (trilhoAlvo !== null && diff <= config.limiarTortoGraus) {
          p.y = alturaChao;
          p.angulo = anguloTerreno;
          p.v = vImpacto;
          p.vx = p.v * cosseno(p.angulo);
          p.vy = p.v * seno(p.angulo);
          p.modo = 'trilho';
          p.trilhoAtual = trilhoAlvo;
          // commitarVoo lê o estado do voo (ticksNoAr) ANTES de zerar — senão o aéreo pontua 0.
          aplicarTurboDePouso(commitarVoo(eventos, false));
          p.ticksNoAr = 0;
          p.grab = null;
          estado.trilhoTicks = 0;
          eventos.push({ tipo: 'trilho', etapa: 'inicio' });
        } else if (diff > config.limiarTortoGraus) {
          estado.fase = 'tombo';
          estado.ticksTomboRestantes = config.ticksTombo;
          estado.tombosOcorridos++;
          perderCombo(eventos);
          eventos.push({ tipo: 'tombo', causa: 'angulo' });
        } else {
          const qualidade = diff <= config.limiarPerfeitoGraus ? 'perfeito' : diff <= config.limiarBomGraus ? 'bom' : 'torto';
          const fator = qualidade === 'perfeito' ? 1 : qualidade === 'bom' ? config.fatorPerdaBom : config.fatorPerdaTorto;
          p.y = alturaChao;
          p.angulo = anguloTerreno;
          p.v = vImpacto * fator;
          p.vx = p.v * cosseno(p.angulo);
          p.vy = p.v * seno(p.angulo);
          p.modo = 'chao';
          estado.ultimaQualidadePouso = qualidade;
          // commitarVoo lê p.ticksNoAr / estado.arTicksGrab do voo que ACABOU — tem que vir ANTES de zerar o ar.
          const pontosDoVoo = commitarVoo(eventos, qualidade === 'perfeito');
          if (qualidade !== 'torto') aplicarTurboDePouso(pontosDoVoo); // cair ("torto") nunca turbina.
          if (qualidade === 'torto') fecharCombo(eventos);
          else if (estado.combo.ativo) abrirJanela(estado.combo);
          p.ticksNoAr = 0;
          p.grab = null;
          eventos.push({ tipo: 'pouso', qualidade, queda: vImpacto < 0 ? -vImpacto : vImpacto });
        }
      }
    }

    // Coleta de itens da camada de jogo (C3): círculo (x, y) ao redor do piloto, contra os ainda não coletados.
    // Sem `camada` (todo chamador de treino), este laço nem roda — `coletados` fica 0, como sempre foi.
    if (camada !== undefined) {
      for (let i = 0; i < camada.itens.length; i++) {
        if (estado.itensColetados.has(i)) continue;
        const item = camada.itens[i] as (typeof camada.itens)[number];
        const dx = p.x - item.x;
        const dy = p.y - item.y;
        if (Math.sqrt(dx * dx + dy * dy) <= item.raio) {
          estado.itensColetados = new Set(estado.itensColetados).add(i);
          estado.coletados++;
          eventos.push({ tipo: 'coleta', item: item.tipo });
        }
      }
    }

    // Combo: num tick de chão "puro" (não pulou nem acabou de pousar), consome a janela de ligação e fecha quando ela esgota.
    if (estado.fase === 'descendo' && modoInicial === 'chao' && p.modo === 'chao' && !cmd.pulo) {
      tiqueJanela(estado.combo);
      if (deveFechar(estado.combo)) fecharCombo(eventos);
    }

    // Checkpoints (só avança: nunca retrocede o índice).
    while (estado.proximoCheckpointIndex < pista.checkpoints.length && p.x >= (pista.checkpoints[estado.proximoCheckpointIndex] as number)) {
      estado.ultimoCheckpointX = pista.checkpoints[estado.proximoCheckpointIndex] as number;
      eventos.push({ tipo: 'checkpoint', indice: estado.proximoCheckpointIndex });
      estado.proximoCheckpointIndex++;
    }

    estado.distancia = p.x;

    // Chegada.
    if (estado.fase === 'descendo' && p.x >= pista.chegadaX) {
      estado.fase = 'chegou';
      fecharCombo(eventos);
      eventos.push({ tipo: 'chegada', pontos: estado.pontos, ticks: estado.tick + 1 });
    }

    return eventos;
  }

  return {
    config,
    modo,
    processar(cmd: ComandoDescida): LeituraDescida {
      estado.tick++;
      if (estado.fase === 'contagem') estado.fase = 'descendo';
      const eventos = processarTick(cmd);
      return leituraDe(estado, eventos);
    },
    leitura(): LeituraDescida {
      return leituraDe(estado, []);
    },
    hashEstado(): string {
      const p = estado.piloto;
      return hashDeValor({
        tick: estado.tick,
        fase: estado.fase,
        x: p.x,
        y: p.y,
        vx: p.vx,
        vy: p.vy,
        v: p.v,
        modo: p.modo,
        angulo: p.angulo,
        velAngular: p.velAngular,
        anguloAcumulado: p.anguloAcumulado,
        grab: p.grab,
        agachado: p.agachado,
        ticksNoAr: p.ticksNoAr,
        distancia: estado.distancia,
        proximoCheckpointIndex: estado.proximoCheckpointIndex,
        ultimoCheckpointX: estado.ultimoCheckpointX,
        ticksTomboRestantes: estado.ticksTomboRestantes,
        tombosOcorridos: estado.tombosOcorridos,
        pontos: estado.pontos,
        comboAtivo: estado.combo.ativo,
        comboSoma: estado.combo.soma,
        comboJanela: estado.combo.janela,
        comboManobras: estado.combo.manobras,
        comboFamilias: estado.combo.familias,
        arTicksGrab: estado.arTicksGrab,
        trilhoTicks: estado.trilhoTicks,
      });
    },
  };
}
