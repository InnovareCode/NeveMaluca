/**
 * Núcleo da corrida (plano `docs/plano-corrida-campeonato.md` §Arquitetura, C2a): N motores de `descida/`
 * INDEPENDENTES rodando a mesma `PistaGerada` em paralelo (plano C-D2: sem colisão, de propósito — mantém
 * determinismo e IA simples) — um por `ParticipanteCorrida`. O jogador é alimentado pelo `ComandoDescida` de fora
 * (`processar(cmdJogador)`); cada rival, pela própria IA (`corrida/ia.ts`). `finalizar()` deixa os rivais que ainda
 * não chegaram correrem (com a própria IA) até o fim ou até um teto de segurança, e fecha o pódio na hora — não
 * precisa esperar o relógio real da UI terminar de desenhar quem já não importa mais para o jogador.
 *
 * Puro e determinístico: mesma `semente` + mesma sequência de `cmdJogador` (e os mesmos `participantes`) => sempre
 * o mesmo `ResultadoCorrida`. Nenhum `Math.random`/relógio aqui (varredura de arquitetura trata `corrida/` como
 * `descida/`).
 */
import type {
  CamadaJogo,
  ComandoDescida,
  IdPersonagem,
  LeituraCorrida,
  LeituraDescida,
  LeituraRivalCorrida,
  OpcoesDescida,
  ParticipanteCorrida,
  PistaGerada,
  ResultadoCorrida,
} from '../core/contratos';
import { TETO_TICKS_REPLAY } from '../core/constantes';
import { ErroDeContrato } from '../core/erros';
import { configDoPersonagem, criarDescida, type MotorDescida } from '../descida/index';
import { PERFIS_IA, criarIA, type PerfilIA } from './ia';
import { criarAcumuladorResumo } from './resumo';

export interface OpcoesCorrida {
  readonly pista: PistaGerada;
  readonly camada?: CamadaJogo;
  readonly semente: number;
  readonly participantes: readonly ParticipanteCorrida[];
  /** Injetável só para teste (perfis falsos); produção usa `PERFIS_IA` (padrão). */
  readonly catalogoPerfis?: Readonly<Record<IdPersonagem, PerfilIA>>;
}

export interface Corrida {
  /** Leitura atual, sem avançar (chamar antes do 1º `processar()` devolve a fase `'contagem'` do jogador). */
  leitura(): LeituraCorrida;
  /** Avança UM tick: o jogador recebe `cmdJogador`; cada rival decide o próprio comando pela IA. */
  processar(cmdJogador: ComandoDescida): LeituraCorrida;
  /** Os rivais que faltam correm (própria IA) até o fim ou o teto de segurança; devolve o pódio na hora. */
  finalizar(): ResultadoCorrida;
}

interface Corredor {
  readonly id: IdPersonagem;
  readonly ehJogador: boolean;
  readonly piloto: ParticipanteCorrida['piloto'];
  readonly motor: MotorDescida;
  readonly ia: ((leitura: LeituraDescida) => ComandoDescida) | null;
  leitura: LeituraDescida;
  tickChegada: number | null;
}

/** Teto de ticks que um rival ainda corre dentro de `finalizar()` (mesmo teto do replay: ~5 min, generoso). */
const TETO_FINALIZAR_TICKS = TETO_TICKS_REPLAY;

/** 1º ao último lugar: quem já chegou primeiro (por ordem de chegada), depois quem está em andamento (por distância). */
function posicoesDe(corredores: readonly Corredor[]): readonly IdPersonagem[] {
  const chegaram = [...corredores.filter((c) => c.tickChegada !== null)].sort((a, b) => (a.tickChegada as number) - (b.tickChegada as number));
  const emAndamento = [...corredores.filter((c) => c.tickChegada === null)].sort((a, b) => b.leitura.distancia - a.leitura.distancia);
  return [...chegaram, ...emAndamento].map((c) => c.id);
}

export function criarCorrida(opcoes: OpcoesCorrida): Corrida {
  const jogador = opcoes.participantes.find((p) => p.piloto.tipo === 'jogador');
  if (jogador === undefined) {
    throw new ErroDeContrato('contrato-invalido', 'criarCorrida: precisa de exatamente um participante com piloto.tipo === "jogador"');
  }

  const opcoesMotor: OpcoesDescida = { modo: 'corrida', ...(opcoes.camada !== undefined ? { camada: opcoes.camada } : {}) };
  const resumoJogador = criarAcumuladorResumo();

  const corredores: Corredor[] = opcoes.participantes.map((p): Corredor => {
    const config = configDoPersonagem(p.config.id);
    const motor = criarDescida(opcoes.pista, config, opcoesMotor);
    const ia = p.piloto.tipo === 'ia' ? criarIA(opcoes.pista, config, p.config, opcoes.semente, opcoes.catalogoPerfis ?? PERFIS_IA) : null;
    return { id: p.id, ehJogador: p.piloto.tipo === 'jogador', piloto: p.piloto, motor, ia, leitura: motor.leitura(), tickChegada: null };
  });

  const chegadas: { id: IdPersonagem; tick: number }[] = [];

  /** Processa UM corredor com o comando `cmd` (sem efeito se ele já chegou). */
  function tiqueUm(c: Corredor, cmd: ComandoDescida): void {
    if (c.tickChegada !== null) return;
    c.leitura = c.motor.processar(cmd);
    if (c.ehJogador) resumoJogador.observar(c.leitura);
    if (c.leitura.fase === 'chegou') {
      c.tickChegada = c.leitura.tick;
      chegadas.push({ id: c.id, tick: c.leitura.tick });
    }
  }

  function leituraCorridaDe(tick: number): LeituraCorrida {
    const jogadorCorredor = corredores.find((c) => c.ehJogador) as Corredor;
    const rivais: LeituraRivalCorrida[] = corredores
      .filter((c) => !c.ehJogador)
      .map((c): LeituraRivalCorrida => ({ id: c.id, piloto: c.piloto, fase: c.leitura.fase, distancia: c.leitura.distancia }));
    return { tick, jogador: jogadorCorredor.leitura, rivais, posicoes: posicoesDe(corredores), chegadas: chegadas.slice() };
  }

  function resultadoDe(): ResultadoCorrida {
    const ticks: Record<IdPersonagem, number> = {};
    for (const c of corredores) ticks[c.id] = c.tickChegada ?? c.leitura.tick;
    return {
      pista: opcoes.pista.id,
      ordem: posicoesDe(corredores),
      ticks,
      resumoJogador: resumoJogador.fechar(),
      // C6 (Cronos, `aplicarEvolucao`/economia): conversão de pontos/manobras/pódio em flocos ainda não existe.
      flocosGanhos: 0,
    };
  }

  let tick = -1;

  return {
    leitura(): LeituraCorrida {
      return leituraCorridaDe(tick);
    },
    processar(cmdJogador: ComandoDescida): LeituraCorrida {
      tick++;
      for (const c of corredores) {
        const cmd = c.ehJogador ? cmdJogador : (c.ia as (l: LeituraDescida) => ComandoDescida)(c.leitura);
        tiqueUm(c, cmd);
      }
      return leituraCorridaDe(tick);
    },
    finalizar(): ResultadoCorrida {
      for (const c of corredores) {
        if (c.ehJogador) continue; // finalizar() não joga pelo jogador: ele só chega por conta própria.
        let seguranca = 0;
        while (c.tickChegada === null && seguranca < TETO_FINALIZAR_TICKS) {
          tiqueUm(c, (c.ia as (l: LeituraDescida) => ComandoDescida)(c.leitura));
          seguranca++;
        }
      }
      return resultadoDe();
    },
  };
}
