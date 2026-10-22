/**
 * Motor puro da descida (plano §3.3, contratos C2/C3). Consome `ComandoDescida` (um por tick, via `processar`), devolve
 * `LeituraDescida` + `EventoDescida[]`. Escopo do M1a (plano §7): física, colisão, tombo, checkpoint e chegada. Manobras
 * pontuadas, combo e multiplicador são M2 (por isso `combo`/`pontos`/`coletados` aqui são placeholders estáveis, não
 * lógica ausente por descuido — ver `docs/handoff-vega-m1a.md`).
 *
 * `core/laco.ts` é a ÚNICA fonte de ticks por quadro: este módulo não lê relógio, não agenda nada, só conta o próprio
 * `tick` no estado a cada `processar()`. Determinístico: nada de `Math.random/Date/performance`, só `core/trig.ts` para
 * ângulo (nunca `Math.sin/cos/atan2/pow`). Hash do estado (`hashEstado`) é o que prova determinismo entre rodadas.
 */
import type {
  ComboLeitura,
  EventoDescida,
  FaseDescida,
  Grab,
  Giro,
  IdPose,
  LeituraDescida,
  ModoPiloto,
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
}

export interface MotorDescida {
  /** Avança UM tick com o comando deste tick e devolve a leitura resultante (C3). */
  processar(cmd: ComandoDescida): LeituraDescida;
  /** Leitura atual, sem avançar (chamar antes do primeiro `processar()` devolve a fase `'contagem'`). */
  leitura(): LeituraDescida;
  /** Hash estável do estado interno completo (para provar determinismo e, no futuro, o `hashFinal` do replay C6). */
  hashEstado(): string;
  readonly config: ConfigDescida;
}

const COMBO_VAZIO: ComboLeitura = Object.freeze({ ativo: false, manobras: Object.freeze([]), soma: 0, mult: 1, janela: 0 });

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
    combo: COMBO_VAZIO,
    pontos: 0,
    distancia: estado.distancia,
    distanciaTotal: 0,
    coletados: 0,
    eventos,
  };
}

/** Cria o motor para uma pista já gerada. `semente` é reservado (M2: canais de RNG de manobra), não usado no M1a. */
export function criarDescida(pista: PistaGerada, config: ConfigDescida = CONFIG_PADRAO): MotorDescida {
  if (pista.alturas.length < 2) throw new ErroDeContrato('contrato-invalido', 'PistaGerada precisa de ao menos 2 amostras de altura');

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

    p.agachado = cmd.agachar;
    p.grab = p.modo === 'ar' ? cmd.grab : null;

    if (p.modo === 'chao' || p.modo === 'trilho') {
      p.angulo = inclinacaoGrausEm(pista, p.x);
      p.velAngular = 0;
      p.ticksGirando = 0;
      p.giroAnterior = 0;
      p.anguloAcumulado = 0;

      if (cmd.pulo) {
        const foiTrilho = p.modo === 'trilho';
        const bonusRampa = p.angulo > 0 ? p.angulo * config.fatorRampaMsPorGrau : 0;
        const impulso = config.impulsoPuloMs + bonusRampa;
        const vxBase = p.v * cosseno(p.angulo);
        const vyBase = p.v * seno(p.angulo);
        p.vx = vxBase + impulso * -seno(p.angulo);
        p.vy = vyBase + impulso * cosseno(p.angulo);
        p.modo = 'ar';
        p.ticksNoAr = 0;
        p.trilhoAtual = null;
        if (foiTrilho) eventos.push({ tipo: 'trilho', etapa: 'fim' });
        eventos.push({ tipo: 'pulo', forca: impulso });
      } else {
        const atrito = p.agachado ? config.atritoAgachado : config.atrito;
        const aceleracao = -config.gravidadeMs2 * seno(p.angulo) - atrito * p.v - config.arrasto * p.v * p.v;
        p.v = p.v + aceleracao * PASSO_S;
        if (p.v < config.velocidadeMinimaChaoMs) p.v = config.velocidadeMinimaChaoMs;
        if (p.v > config.velocidadeMaxMs) p.v = config.velocidadeMaxMs;
        const novoX = p.x + p.v * cosseno(p.angulo) * PASSO_S;

        if (p.modo === 'trilho' && p.trilhoAtual !== null && novoX > p.trilhoAtual.x1) {
          p.modo = 'chao';
          p.trilhoAtual = null;
          eventos.push({ tipo: 'trilho', etapa: 'fim' });
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
          p.ticksNoAr = 0;
          p.grab = null;
          eventos.push({ tipo: 'trilho', etapa: 'inicio' });
        } else if (diff > config.limiarTortoGraus) {
          estado.fase = 'tombo';
          estado.ticksTomboRestantes = config.ticksTombo;
          estado.tombosOcorridos++;
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
          p.ticksNoAr = 0;
          p.grab = null;
          estado.ultimaQualidadePouso = qualidade;
          eventos.push({ tipo: 'pouso', qualidade, queda: vImpacto < 0 ? -vImpacto : vImpacto });
        }
      }
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
      eventos.push({ tipo: 'chegada', pontos: 0, ticks: estado.tick + 1 });
    }

    return eventos;
  }

  return {
    config,
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
      });
    },
  };
}
