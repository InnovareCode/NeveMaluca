/**
 * Núcleo da corrida (plano `docs/plano-corrida-campeonato.md` §Arquitetura, C2a; `docs/plano-itens-corrida.md`
 * §Núcleo, I2): N motores de `descida/` INDEPENDENTES rodando a mesma `PistaGerada` em paralelo (plano C-D2: sem
 * colisão física, de propósito — a ÚNICA interação entre corredores é por item, sempre pelo orquestrador de
 * `corrida/itens.ts`) — um por `ParticipanteCorrida`. O jogador é alimentado pelo `ComandoCorrida` de fora
 * (`processar(cmd)`); cada rival decide o próprio `ComandoDescida` pela IA (`corrida/ia.ts`, ainda sem usar item —
 * isso é I3). `finalizar()` deixa os rivais que ainda não chegaram correrem em LOCKSTEP (própria IA, COM itens)
 * até o fim ou até um teto de segurança, e fecha o pódio na hora.
 *
 * Tick em 2 fases (plano itens-corrida §Determinismo): (1) cada corredor decide `descida`/`usarItem` lendo o
 * RETRATO do tick ANTERIOR; (2) `corrida/itens.ts` resolve caixas/projéteis/armadilhas/escudos sobre esse retrato
 * e produz os `EfeitoExterno[]` de cada um; (3) cada motor processa com os efeitos recebidos — nenhum lê outro, a
 * ORDEM de `opcoes.participantes` nunca muda o resultado (`hashEstado()`/`posicoesDe` também são ordenados por
 * `id`, nunca pela ordem de entrada).
 *
 * Puro e determinístico: mesma `semente` + mesma sequência de `cmd` (e os mesmos `participantes`, em QUALQUER
 * ordem) => sempre o mesmo `ResultadoCorrida`. Nenhum `Math.random`/relógio aqui (varredura de arquitetura trata
 * `corrida/` como `descida/`).
 */
import type {
  CamadaJogo,
  ComandoCorrida,
  ComandoDescida,
  DefPista,
  EfeitoExterno,
  EventoCorrida,
  Evolucao,
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
import { hashDeValor } from '../core/hash';
import { aplicarEvolucao, configDoPersonagem, criarDescida, type MotorDescida } from '../descida/index';
import { gerarCamadaJogo } from '../pista/index';
import { flocosDaCorrida } from '../data/evolucao';
import { FLOCOS_POR_ACERTO_ITEM } from '../data/itens';
import { PERFIS_IA, criarIA, type PerfilIA } from './ia';
import { criarOrquestradorItens, type DecisaoItemCorredor, type OrquestradorItens, type RetratoCorredorItens } from './itens';
import { criarAcumuladorResumo } from './resumo';

export interface OpcoesCorrida {
  readonly pista: PistaGerada;
  /**
   * `DefPista` da pista acima (plano §Arquitetura, C3): só para gerar a camada de jogo automaticamente
   * (`gerarCamadaJogo(pista, def)`) quando `camada` não é informado explicitamente. Nenhuma pista oficial roda
   * sem camada — quem quiser treino "cru" (sem coletáveis/kicker/turbo) usa `descida/motor.ts` direto, não `corrida/`.
   */
  readonly def?: DefPista;
  readonly camada?: CamadaJogo;
  readonly semente: number;
  readonly participantes: readonly ParticipanteCorrida[];
  /** Injetável só para teste (perfis falsos); produção usa `PERFIS_IA` (padrão). */
  readonly catalogoPerfis?: Readonly<Record<IdPersonagem, PerfilIA>>;
  /**
   * Evolução entre campeonatos (plano C-D3/C6, `descida/atributos.ts` → `aplicarEvolucao`): aplicada a CADA
   * corredor (jogador e rivais) pelo próprio `niveis[id]` — sem ela (como todo chamador de antes do C6 faz), todos
   * correm no nível 0 (idêntico à ficha pura, `configDoPersonagem`), comportamento de sempre.
   */
  readonly evolucao?: Evolucao;
}

export interface Corrida {
  /** Leitura atual, sem avançar (chamar antes do 1º `processar()` devolve a fase `'contagem'` do jogador). */
  leitura(): LeituraCorrida;
  /**
   * Avança UM tick em 2 fases (plano itens-corrida §Determinismo): (1) o jogador decide `cmd.descida`/
   * `cmd.usarItem`, cada rival decide o próprio `ComandoDescida` pela IA (ainda sem usar item — I3); (2) o
   * orquestrador de itens (`corrida/itens.ts`) resolve caixas/projéteis/armadilhas/escudos sobre o RETRATO do tick
   * ANTERIOR e produz os `EfeitoExterno[]` de cada corredor; (3) cada motor processa com os efeitos recebidos.
   */
  processar(cmd: ComandoCorrida): LeituraCorrida;
  /** Os rivais que faltam correm (própria IA, COM itens) em lockstep até o fim ou o teto de segurança; devolve o
   *  pódio na hora — sem lockstep, a interação entre os rivais que faltam divergiria do que seria "ao vivo". */
  finalizar(): ResultadoCorrida;
  /** Hash estável do estado de TODA a corrida (6 motores + o que só existe aqui: projéteis/slots/escudos/caixas
   *  pegas, ver `corrida/itens.ts`) — prova de determinismo com a ORDEM dos participantes permutada. */
  hashEstado(): string;
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

/** Desempate estável por `id` (nunca a ordem de `opcoes.participantes`) — plano itens-corrida §Determinismo: sem
 *  isto, um empate EXATO (mesmo tick de chegada, ou mesma distância em `finalizar()`) resolveria pela ordem de
 *  ENTRADA de `corredores`, e permutar `participantes` mudaria `ResultadoCorrida.ordem` sem nada ter divergido de
 *  verdade na física. */
function porId(a: Corredor, b: Corredor): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** 1º ao último lugar: quem já chegou primeiro (por ordem de chegada), depois quem está em andamento (por distância). */
function posicoesDe(corredores: readonly Corredor[]): readonly IdPersonagem[] {
  const chegaram = [...corredores.filter((c) => c.tickChegada !== null)].sort((a, b) => (a.tickChegada as number) - (b.tickChegada as number) || porId(a, b));
  const emAndamento = [...corredores.filter((c) => c.tickChegada === null)].sort((a, b) => b.leitura.distancia - a.leitura.distancia || porId(a, b));
  return [...chegaram, ...emAndamento].map((c) => c.id);
}

export function criarCorrida(opcoes: OpcoesCorrida): Corrida {
  const participanteJogador = opcoes.participantes.find((p) => p.piloto.tipo === 'jogador');
  if (participanteJogador === undefined) {
    throw new ErroDeContrato('contrato-invalido', 'criarCorrida: precisa de exatamente um participante com piloto.tipo === "jogador"');
  }
  const idJogador = participanteJogador.id; // alias fora do `if`: TS não propaga a narrow de `undefined` em closures.

  const camada = opcoes.camada ?? (opcoes.def !== undefined ? gerarCamadaJogo(opcoes.pista, opcoes.def) : undefined);
  const opcoesMotor: OpcoesDescida = { modo: 'corrida', ...(camada !== undefined ? { camada } : {}) };
  const niveisEvolucao = opcoes.evolucao?.niveis ?? {};
  const obstaculosAltos = camada?.obstaculosAltos ?? [];
  const resumoJogador = criarAcumuladorResumo();

  const corredores: Corredor[] = opcoes.participantes.map((p): Corredor => {
    // C6: evolução é CAMADA por cima da ficha (`aplicarEvolucao`) — nível 0 (sem `opcoes.evolucao`, como todo
    // chamador de antes do C6) devolve `config` intacto, por construção (ver `descida/atributos.ts`).
    const config = aplicarEvolucao(configDoPersonagem(p.config.id), p.config, niveisEvolucao);
    const motor = criarDescida(opcoes.pista, config, opcoesMotor);
    const ia = p.piloto.tipo === 'ia' ? criarIA(opcoes.pista, config, p.config, opcoes.semente, opcoes.catalogoPerfis ?? PERFIS_IA, obstaculosAltos) : null;
    return { id: p.id, ehJogador: p.piloto.tipo === 'jogador', piloto: p.piloto, motor, ia, leitura: motor.leitura(), tickChegada: null };
  });

  const chegadas: { id: IdPersonagem; tick: number }[] = [];

  // Itens (plano itens-corrida §Núcleo, I2): sem `camada` (treino "cru"/testes sem `def`/`camada`), `caixas` é `[]`
  // e o orquestrador nunca produz item nenhum — mesmo padrão de `OpcoesDescida.camada` ausente.
  const itensCorrida: OrquestradorItens = criarOrquestradorItens({
    semente: opcoes.semente,
    caixas: camada?.caixas ?? [],
    participantes: corredores.map((c) => c.id),
  });

  /** Processa UM corredor com o comando e os efeitos deste tick (sem efeito se ele já chegou). */
  function tiqueUm(c: Corredor, cmd: ComandoDescida, efeitos: readonly EfeitoExterno[]): void {
    if (c.tickChegada !== null) return;
    c.leitura = c.motor.processar(cmd, efeitos);
    if (c.ehJogador) resumoJogador.observar(c.leitura);
    if (c.leitura.fase === 'chegou') {
      c.tickChegada = c.leitura.tick;
      chegadas.push({ id: c.id, tick: c.leitura.tick });
    }
  }

  /** Fase 1 do tick (plano §Determinismo): retrato de cada corredor no fim do tick ANTERIOR — nunca o atual. */
  function retratosAtuais(): RetratoCorredorItens[] {
    return corredores.map((c) => ({ id: c.id, x: c.leitura.piloto.x, y: c.leitura.piloto.y, modo: c.leitura.piloto.modo, fase: c.leitura.fase }));
  }

  function leituraCorridaDe(tick: number, eventosCorrida: readonly EventoCorrida[] = []): LeituraCorrida {
    const jogadorCorredor = corredores.find((c) => c.ehJogador) as Corredor;
    const rivais: LeituraRivalCorrida[] = corredores
      .filter((c) => !c.ehJogador)
      .map((c): LeituraRivalCorrida => ({
        id: c.id,
        piloto: c.piloto,
        fase: c.leitura.fase,
        distancia: c.leitura.distancia,
        item: itensCorrida.itemDe(c.id),
        escudo: itensCorrida.escudoAtivo(c.id),
        atordoado: itensCorrida.atordoadoAtivo(c.id),
      }));
    return {
      tick,
      jogador: jogadorCorredor.leitura,
      rivais,
      posicoes: posicoesDe(corredores),
      chegadas: chegadas.slice(),
      itemJogador: itensCorrida.itemDe(idJogador),
      roleta: itensCorrida.roletaDe(idJogador),
      entidades: itensCorrida.entidadesVisiveis(idJogador),
      alvoNoJogador: itensCorrida.alvoDeNuvemAtiva(idJogador),
      eventosCorrida,
    };
  }

  function resultadoDe(): ResultadoCorrida {
    const ticks: Record<IdPersonagem, number> = {};
    for (const c of corredores) ticks[c.id] = c.tickChegada ?? c.leitura.tick;
    const itensJogador = itensCorrida.estatisticas(idJogador);
    const parcial: ResultadoCorrida = {
      pista: opcoes.pista.id,
      ordem: posicoesDe(corredores),
      ticks,
      resumoJogador: resumoJogador.fechar(),
      flocosGanhos: 0,
      itens: itensJogador,
    };
    return {
      ...parcial,
      // `data/evolucao.ts` (Cronos): pontos da descida + bônus de pódio, 0 se o jogador não concluiu, mais o bônus
      // de itens (plano I-D6: "acertar rival dá +5 flocos" — só pro jogador, único lado que `flocosGanhos` cobre).
      flocosGanhos: flocosDaCorrida(parcial, idJogador) + itensJogador.acertosDados * FLOCOS_POR_ACERTO_ITEM,
    };
  }

  let tick = -1;

  return {
    leitura(): LeituraCorrida {
      return leituraCorridaDe(tick);
    },
    processar(cmd: ComandoCorrida): LeituraCorrida {
      tick++;
      // Fase 1: retrato do tick anterior + decisão de `usarItem` de cada corredor (IA ainda não usa item — I3).
      const retratos = retratosAtuais();
      const posicoesAnteriores = posicoesDe(corredores);
      const decisoes: DecisaoItemCorredor[] = corredores.map((c) => ({ id: c.id, usarItem: c.ehJogador ? cmd.usarItem : false }));

      // Fase 2: o orquestrador resolve caixas/projéteis/armadilhas/escudos sobre esse retrato.
      const { efeitosPorId, eventos: eventosCorrida } = itensCorrida.processarTick(retratos, decisoes, posicoesAnteriores);

      // Fase 3: cada motor processa com os efeitos recebidos — nenhum lê outro, a ORDEM aqui nunca muda o resultado.
      for (const c of corredores) {
        const cmdDescida = c.ehJogador ? cmd.descida : (c.ia as (l: LeituraDescida) => ComandoDescida)(c.leitura);
        tiqueUm(c, cmdDescida, efeitosPorId[c.id] ?? []);
      }
      return leituraCorridaDe(tick, eventosCorrida);
    },
    finalizar(): ResultadoCorrida {
      // Lockstep (plano: "finalizar() roda os rivais até o fim COM itens") — os rivais que faltam avançam JUNTOS,
      // tick a tick, pelas mesmas 3 fases de `processar()`: sem isso, um rival terminando a corrida inteira antes
      // de outro nem começar faria toda interação entre eles (bola/poça/nuvem) acontecer fora de ordem.
      let seguranca = 0;
      while (corredores.some((c) => !c.ehJogador && c.tickChegada === null) && seguranca < TETO_FINALIZAR_TICKS) {
        const retratos = retratosAtuais();
        const posicoesAnteriores = posicoesDe(corredores);
        const decisoes: DecisaoItemCorredor[] = corredores.map((c) => ({ id: c.id, usarItem: false }));
        const { efeitosPorId } = itensCorrida.processarTick(retratos, decisoes, posicoesAnteriores);
        for (const c of corredores) {
          if (c.ehJogador) continue; // finalizar() não joga pelo jogador: ele só chega por conta própria.
          tiqueUm(c, (c.ia as (l: LeituraDescida) => ComandoDescida)(c.leitura), efeitosPorId[c.id] ?? []);
        }
        seguranca++;
      }
      return resultadoDe();
    },
    hashEstado(): string {
      // Ordenado por `id` (nunca a ordem de `opcoes.participantes`): o mesmo motivo de `corrida/itens.ts`
      // (`idsOrdenados`) — permutar a lista de participantes não pode mudar ESTE hash, só o conteúdo de cada um.
      const motoresPorId = [...corredores].sort(porId).map((c) => ({ id: c.id, hash: c.motor.hashEstado() }));
      return hashDeValor({ motores: motoresPorId, itens: itensCorrida.hashEstado() });
    },
  };
}
