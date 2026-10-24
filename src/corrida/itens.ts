/**
 * Orquestrador de itens da corrida (`docs/plano-itens-corrida.md` §Núcleo, I2): caixas reais na pista (1 espaço por
 * CORREDOR, I-D4/I-D5), sorteio sem estado (`data/itens.ts` → `sortearItem`), projétil (Bola de Neve), armadilha
 * (Poça de Calda), escudo (Bolha de Gelo) e o "casco azul" que mira o 1º colocado (Nuvem de Granizo). Produz, a
 * cada tick, os `EfeitoExterno[]` que `corrida/corrida.ts` repassa a CADA motor na Fase 3 — nunca lê o motor por
 * dentro, só o RETRATO (`x`/`modo`/`fase`) que `corrida.ts` tira da leitura do tick ANTERIOR.
 *
 * Determinismo (plano §Determinismo, requisito central): TODO loop interno que itera "os corredores" percorre uma
 * lista ordenada por `id` (`idsOrdenados`/`compararIds`), nunca a ordem de `OpcoesCorrida.participantes` — é o que
 * garante que permutar essa lista não muda o resultado (`corrida.ts` só repassa `participantes` na ordem que
 * recebeu; se este arquivo iterasse nela, duas corridas com os mesmos 6 em ordem diferente poderiam criar
 * entidades (bola/poça/nuvem) em ordem diferente e, em tese, divergir num empate exótico). Sorteio de item usa
 * `sortearItem(semente, id, índice-da-caixa, posição, total)` — sem RNG com estado guardado entre chamadas.
 *
 * O que fica FORA do hash (`hashEstado`, no fim do arquivo): janelas puramente informativas que já se refletem no
 * motor de quem as sofre (`atordoadoTicksRestantes` espelhado aqui é só para `LeituraRivalCorrida.atordoado`; a
 * roleta e o aviso da nuvem são cosmético/UI). O que ENTRA: `slots` (item carregado), `escudos` (ativo ou não),
 * `caixasPegas` (por corredor) e `entidades` (projéteis/armadilhas/avisos vivos) — os 4 pedaços de estado que só
 * EXISTEM aqui, não em nenhum motor (plano: "hashEstado() da Corrida: 6 motores + projéteis + slots + escudos +
 * caixas pegas").
 */
import type { CaixaCamada, ComandoCorrida, EfeitoExterno, EventoCorrida, FaseDescida, IdPersonagem, ModoPiloto, TipoItem } from '../core/contratos';
import { PASSO_S, TETO_TICKS_REPLAY, TICKS_POR_SEGUNDO } from '../core/constantes';
import { byteDoComando, comandoDoByte } from '../core/comandos';
import { falha, ok, type Resultado } from '../core/erros';
import { hashDeValor } from '../core/hash';
import { base64Codificar, base64Decodificar, tamanhoMaximoDoTexto } from '../core/replay';
import { TICKS_ATORDOADO_TROMBADA } from '../descida/motor';
import { efeitoExternoDoItem, PARAMETROS_ESCUDO_ITEM, sortearItem } from '../data/itens';

// --- Retrato de UM corredor no tick anterior (o único jeito deste arquivo "ver" a posição de alguém) ---

export interface RetratoCorredorItens {
  readonly id: IdPersonagem;
  readonly x: number;
  /** Só pra medir a distância até uma caixa (mesmo círculo 2D de `motor.ts` contra `camada.itens`) — bola/poça/
   *  nuvem não usam `y`: dodge delas é discreto (`modo === 'ar'`), não geometria. */
  readonly y: number;
  readonly modo: ModoPiloto;
  readonly fase: FaseDescida;
}

export interface DecisaoItemCorredor {
  readonly id: IdPersonagem;
  readonly usarItem: boolean;
}

export interface ResolucaoItensTick {
  readonly efeitosPorId: Readonly<Record<IdPersonagem, readonly EfeitoExterno[]>>;
  readonly eventos: readonly EventoCorrida[];
}

export interface EstatisticasItensCorredor {
  readonly acertosDados: number;
  readonly acertosSofridos: number;
}

export interface EntidadeVisivel {
  readonly id: string;
  readonly tipo: TipoItem | 'caixa';
  readonly x: number;
  readonly y: number;
}

export interface OrquestradorItens {
  /** Avança UM tick: resolve caixas/uso de item/projéteis/armadilhas/escudos a partir do RETRATO anterior. */
  processarTick(
    retratos: readonly RetratoCorredorItens[],
    decisoes: readonly DecisaoItemCorredor[],
    posicoesAnteriores: readonly IdPersonagem[],
  ): ResolucaoItensTick;
  /** Item no slot do corredor `id` agora, ou `null` com o slot vazio. */
  itemDe(id: IdPersonagem): TipoItem | null;
  escudoAtivo(id: IdPersonagem): boolean;
  /** Reflete `atordoadoTicksRestantes > 0` do MOTOR de `id` (ver `TICKS_ATORDOADO_TROMBADA`, importado do motor). */
  atordoadoAtivo(id: IdPersonagem): boolean;
  roletaDe(id: IdPersonagem): { readonly ticksRestantes: number; readonly resultado: TipoItem } | null;
  /** `id` é alvo de uma Nuvem de Granizo com aviso ainda contando (plano I-D2: "~2s de aviso"). */
  alvoDeNuvemAtiva(id: IdPersonagem): boolean;
  /** x da Bola de Neve viva que mira `id`, ou `null` sem nenhuma — só o ALVO dela corre risco (plano: "acerta o 1º
   *  rival à frente"). Usado pela IA de desvio (`corrida/ia-itens.ts`, I3) pra saber quando pular. */
  ameacaBolaPara(id: IdPersonagem): number | null;
  /** Projéteis/armadilhas vivos + caixas que `idPerspectiva` ainda NÃO pegou (plano: "a já pega aparece apagada"). */
  entidadesVisiveis(idPerspectiva: IdPersonagem): readonly EntidadeVisivel[];
  estatisticas(id: IdPersonagem): EstatisticasItensCorredor;
  /** Hash do estado que só existe aqui (slots/escudos/caixas pegas/entidades) — ver comentário no topo do arquivo. */
  hashEstado(): string;
}

export interface OpcoesOrquestradorItens {
  readonly semente: number;
  /** Caixas da `CamadaJogo` desta pista (`camada?.caixas ?? []` — sem camada, item nunca acontece, de propósito). */
  readonly caixas: readonly CaixaCamada[];
  readonly participantes: readonly IdPersonagem[];
}

// --- Parâmetros dos projéteis/armadilhas em si (posição/velocidade/raio — NUNCA o efeito que produzem, que é
//     `data/itens.ts`/`efeitoExternoDoItem`; ver cabeçalho de `data/itens.ts` sobre essa fronteira). ---

/** Bola de Neve: mais rápida que qualquer corredor (viaja relativo ao CHÃO, não ao alvo) — sem isso, nunca alcança
 *  quem está na frente acelerando. */
const VELOCIDADE_BOLA_MS = 22;
const RAIO_ACERTO_BOLA_M = 1.2;
/** Despawn de segurança (alvo girou de rota, chegou, ou a bola simplesmente nunca encontrou ninguém no raio). */
const TICKS_VIDA_MAX_BOLA = 6 * TICKS_POR_SEGUNDO;

/** Poça de Calda: armadilha de chão, mesmo raio de acerto de uma caixa pequena. Uso único (desaparece ao acertar). */
const RAIO_ARMADILHA_POCA_M = 1.4;

/** Nuvem de Granizo ("casco azul"): aviso antes do acerto (plano I-D2: "~2s de aviso"). */
const TICKS_AVISO_NUVEM = 2 * TICKS_POR_SEGUNDO;

/** Janela cosmética entre pegar a caixa e o item ficar pronto pra usar (roleta "girando" — plano I-D5). */
const TICKS_ROLETA_ITEM = Math.round(0.5 * TICKS_POR_SEGUNDO);

// --- Comparador estável de ids (NUNCA a ordem de `participantes` — ver cabeçalho do arquivo) ---

function compararIds(a: IdPersonagem, b: IdPersonagem): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// --- Entidades vivas (projétil/armadilha/aviso) ---

interface EntidadeBola {
  readonly tipo: 'bola';
  readonly id: string;
  readonly de: IdPersonagem;
  readonly alvo: IdPersonagem;
  x: number;
  ticks: number;
}

interface EntidadeArmadilha {
  readonly tipo: 'poca';
  readonly id: string;
  readonly de: IdPersonagem;
  readonly x: number;
  usada: boolean;
}

interface EntidadeAviso {
  readonly tipo: 'nuvem';
  readonly id: string;
  readonly de: IdPersonagem;
  readonly alvo: IdPersonagem;
  ticksRestantes: number;
}

type Entidade = EntidadeBola | EntidadeArmadilha | EntidadeAviso;

interface EstadoCorredorItens {
  item: TipoItem | null;
  escudoTicksRestantes: number;
  atordoadoTicksRestantes: number;
  roletaTicksRestantes: number;
  roletaResultado: TipoItem | null;
  readonly caixasPegas: Set<number>;
  acertosDados: number;
  acertosSofridos: number;
}

function estadoInicial(): EstadoCorredorItens {
  return {
    item: null,
    escudoTicksRestantes: 0,
    atordoadoTicksRestantes: 0,
    roletaTicksRestantes: 0,
    roletaResultado: null,
    caixasPegas: new Set<number>(),
    acertosDados: 0,
    acertosSofridos: 0,
  };
}

/** O corredor mais próximo NA FRENTE de `x` (plano: "acerta o 1º rival à frente"), ou `null` sem ninguém elegível.
 *  Elegível = ainda `'descendo'` e estritamente adiante; empate de `x` resolvido por `compararIds` (nunca pela
 *  ordem de iteração, pelo mesmo motivo do resto do arquivo). */
function rivalMaisProximoNaFrente(deId: IdPersonagem, deX: number, retratos: readonly RetratoCorredorItens[]): IdPersonagem | null {
  let melhor: RetratoCorredorItens | null = null;
  for (const r of retratos) {
    if (r.id === deId || r.fase !== 'descendo' || r.x <= deX) continue;
    if (melhor === null || r.x < melhor.x || (r.x === melhor.x && compararIds(r.id, melhor.id) < 0)) melhor = r;
  }
  return melhor === null ? null : melhor.id;
}

export function criarOrquestradorItens(opcoes: OpcoesOrquestradorItens): OrquestradorItens {
  const estados = new Map<IdPersonagem, EstadoCorredorItens>();
  for (const id of opcoes.participantes) estados.set(id, estadoInicial());
  const idsOrdenados = [...opcoes.participantes].sort(compararIds);
  const totalCorredores = opcoes.participantes.length;

  let entidades: Entidade[] = [];
  let proximoIdEntidade = 0;

  /** Resolve um acerto (projétil/armadilha/aviso) contra `em`: escudo absorve (consome + `'bloqueado'`), senão
   *  aplica o `EfeitoExterno` real de `item` (trombada p/ bola/nuvem, freada p/ poça — `efeitoExternoDoItem` já
   *  sabe a diferença) e conta estatística dos dois lados + `'acerto'`. */
  function resolverAcerto(de: IdPersonagem, em: IdPersonagem, item: TipoItem, empilhar: (id: IdPersonagem, ef: EfeitoExterno) => void, eventos: EventoCorrida[]): void {
    const alvo = estados.get(em);
    if (alvo === undefined) return;
    if (alvo.escudoTicksRestantes > 0) {
      alvo.escudoTicksRestantes = 0;
      eventos.push({ tipo: 'bloqueado', id: em, item });
      return;
    }
    const efeito = efeitoExternoDoItem(item);
    if (efeito !== undefined) {
      empilhar(em, efeito);
      if (efeito.tipo === 'trombada') alvo.atordoadoTicksRestantes = TICKS_ATORDOADO_TROMBADA;
    }
    alvo.acertosSofridos++;
    const atacante = estados.get(de);
    if (atacante !== undefined) atacante.acertosDados++;
    eventos.push({ tipo: 'acerto', de, em, item });
  }

  function processarTick(
    retratos: readonly RetratoCorredorItens[],
    decisoes: readonly DecisaoItemCorredor[],
    posicoesAnteriores: readonly IdPersonagem[],
  ): ResolucaoItensTick {
    const retratoPorId = new Map(retratos.map((r): [IdPersonagem, RetratoCorredorItens] => [r.id, r]));
    const usarItemPorId = new Map(decisoes.map((d): [IdPersonagem, boolean] => [d.id, d.usarItem]));
    const efeitosPorId = new Map<IdPersonagem, EfeitoExterno[]>();
    const eventos: EventoCorrida[] = [];
    const empilhar = (id: IdPersonagem, ef: EfeitoExterno): void => {
      const lista = efeitosPorId.get(id);
      if (lista === undefined) efeitosPorId.set(id, [ef]);
      else lista.push(ef);
    };

    // 0. Decaimento das janelas (escudo/atordoado-espelho/roleta) — ordem fixa por id, nunca a de `participantes`.
    for (const id of idsOrdenados) {
      const e = estados.get(id) as EstadoCorredorItens;
      if (e.escudoTicksRestantes > 0) e.escudoTicksRestantes--;
      if (e.atordoadoTicksRestantes > 0) e.atordoadoTicksRestantes--;
      if (e.roletaTicksRestantes > 0) {
        e.roletaTicksRestantes--;
        if (e.roletaTicksRestantes === 0) {
          e.item = e.roletaResultado;
          e.roletaResultado = null;
        }
      }
    }

    // 1. Caixas: cada corredor pega as que estão no alcance (plano I-D4/I-D5: 1x por corredor, slot único).
    for (const id of idsOrdenados) {
      const r = retratoPorId.get(id);
      if (r === undefined || r.fase !== 'descendo') continue;
      const e = estados.get(id) as EstadoCorredorItens;
      for (let i = 0; i < opcoes.caixas.length; i++) {
        if (e.caixasPegas.has(i)) continue;
        const caixa = opcoes.caixas[i] as CaixaCamada;
        const dx = r.x - caixa.x;
        const dy = r.y - caixa.y;
        if (Math.sqrt(dx * dx + dy * dy) > caixa.raio) continue;
        e.caixasPegas.add(i);
        if (e.item !== null || e.roletaTicksRestantes > 0) continue; // slot ocupado: caixa some, item não troca.
        const posicao = posicoesAnteriores.includes(id) ? posicoesAnteriores.indexOf(id) + 1 : totalCorredores;
        const item = sortearItem(opcoes.semente, id, i, posicao, totalCorredores);
        e.roletaResultado = item;
        e.roletaTicksRestantes = TICKS_ROLETA_ITEM;
        eventos.push({ tipo: 'item-pego', id, item });
      }
    }

    // 2. Uso de item (borda `usarItem`, plano: nunca entra no `ComandoDescida`).
    for (const id of idsOrdenados) {
      if (usarItemPorId.get(id) !== true) continue;
      const e = estados.get(id) as EstadoCorredorItens;
      const item = e.item;
      if (item === null) continue;
      const r = retratoPorId.get(id);
      e.item = null;
      eventos.push({ tipo: 'item-usado', id, item });
      switch (item) {
        case 'escudo':
          e.escudoTicksRestantes = PARAMETROS_ESCUDO_ITEM.ticks;
          break;
        case 'turbo':
        case 'ima': {
          const efeito = efeitoExternoDoItem(item);
          if (efeito !== undefined) empilhar(id, efeito);
          break;
        }
        case 'bola': {
          if (r === undefined) break;
          const alvo = rivalMaisProximoNaFrente(id, r.x, retratos);
          if (alvo !== null) entidades.push({ tipo: 'bola', id: `bola-${proximoIdEntidade++}`, de: id, alvo, x: r.x, ticks: 0 });
          break;
        }
        case 'poca': {
          if (r === undefined) break;
          entidades.push({ tipo: 'poca', id: `poca-${proximoIdEntidade++}`, de: id, x: r.x, usada: false });
          break;
        }
        case 'nuvem': {
          const alvo = posicoesAnteriores.find((pid) => pid !== id) ?? null; // líder, ou o 2º se o próprio já é o líder.
          if (alvo !== null) entidades.push({ tipo: 'nuvem', id: `nuvem-${proximoIdEntidade++}`, de: id, alvo, ticksRestantes: TICKS_AVISO_NUVEM });
          break;
        }
      }
    }

    // 3. Avança entidades vivas (ORDEM DE CRIAÇÃO — nunca a de `participantes`, ver passos 1/2 acima).
    const restantes: Entidade[] = [];
    for (const ent of entidades) {
      if (ent.tipo === 'bola') {
        ent.x += VELOCIDADE_BOLA_MS * PASSO_S;
        ent.ticks++;
        const alvoRetrato = retratoPorId.get(ent.alvo);
        let resolvida = ent.ticks > TICKS_VIDA_MAX_BOLA;
        if (!resolvida && alvoRetrato !== undefined && Math.abs(ent.x - alvoRetrato.x) <= RAIO_ACERTO_BOLA_M) {
          if (alvoRetrato.modo === 'ar') eventos.push({ tipo: 'desviou', id: ent.alvo, item: 'bola' });
          else resolverAcerto(ent.de, ent.alvo, 'bola', empilhar, eventos);
          resolvida = true;
        }
        if (!resolvida) restantes.push(ent);
      } else if (ent.tipo === 'poca') {
        for (const id of idsOrdenados) {
          if (ent.usada || id === ent.de) continue;
          const r = retratoPorId.get(id);
          if (r === undefined || r.modo === 'ar' || Math.abs(r.x - ent.x) > RAIO_ARMADILHA_POCA_M) continue;
          ent.usada = true;
          resolverAcerto(ent.de, id, 'poca', empilhar, eventos);
        }
        if (!ent.usada) restantes.push(ent);
      } else {
        ent.ticksRestantes--;
        if (ent.ticksRestantes > 0) restantes.push(ent);
        else resolverAcerto(ent.de, ent.alvo, 'nuvem', empilhar, eventos);
      }
    }
    entidades = restantes;

    const efeitosPorIdFinal: Record<IdPersonagem, readonly EfeitoExterno[]> = {};
    for (const [id, lista] of efeitosPorId) efeitosPorIdFinal[id] = lista;
    return { efeitosPorId: efeitosPorIdFinal, eventos };
  }

  return {
    processarTick,
    itemDe(id: IdPersonagem): TipoItem | null {
      return estados.get(id)?.item ?? null;
    },
    escudoAtivo(id: IdPersonagem): boolean {
      return (estados.get(id)?.escudoTicksRestantes ?? 0) > 0;
    },
    atordoadoAtivo(id: IdPersonagem): boolean {
      return (estados.get(id)?.atordoadoTicksRestantes ?? 0) > 0;
    },
    roletaDe(id: IdPersonagem) {
      const e = estados.get(id);
      if (e === undefined || e.roletaTicksRestantes <= 0 || e.roletaResultado === null) return null;
      return { ticksRestantes: e.roletaTicksRestantes, resultado: e.roletaResultado };
    },
    alvoDeNuvemAtiva(id: IdPersonagem): boolean {
      return entidades.some((ent) => ent.tipo === 'nuvem' && ent.alvo === id);
    },
    ameacaBolaPara(id: IdPersonagem): number | null {
      for (const ent of entidades) {
        if (ent.tipo === 'bola' && ent.alvo === id) return ent.x;
      }
      return null;
    },
    entidadesVisiveis(idPerspectiva: IdPersonagem): readonly EntidadeVisivel[] {
      const visiveis: EntidadeVisivel[] = [];
      for (const ent of entidades) {
        if (ent.tipo === 'nuvem') continue; // sem posição própria (mira um alvo móvel) — ver `alvoDeNuvemAtiva`.
        visiveis.push({ id: ent.id, tipo: ent.tipo, x: ent.x, y: 0 });
      }
      const pegas = estados.get(idPerspectiva)?.caixasPegas ?? new Set<number>();
      for (let i = 0; i < opcoes.caixas.length; i++) {
        if (pegas.has(i)) continue; // "a já pega aparece apagada" — plano I-D5.
        const caixa = opcoes.caixas[i] as CaixaCamada;
        visiveis.push({ id: `caixa-${i}`, tipo: 'caixa', x: caixa.x, y: caixa.y });
      }
      return visiveis;
    },
    estatisticas(id: IdPersonagem): EstatisticasItensCorredor {
      const e = estados.get(id);
      return { acertosDados: e?.acertosDados ?? 0, acertosSofridos: e?.acertosSofridos ?? 0 };
    },
    hashEstado(): string {
      return hashDeValor({
        slots: idsOrdenados.map((id) => estados.get(id)?.item ?? null),
        escudos: idsOrdenados.map((id) => (estados.get(id)?.escudoTicksRestantes ?? 0) > 0),
        caixasPegas: idsOrdenados.map((id) => [...(estados.get(id)?.caixasPegas ?? [])].sort((a, b) => a - b)),
        entidades: entidades.map((ent) =>
          ent.tipo === 'bola'
            ? { tipo: ent.tipo, de: ent.de, alvo: ent.alvo, x: ent.x }
            : ent.tipo === 'poca'
              ? { tipo: ent.tipo, de: ent.de, x: ent.x, usada: ent.usada }
              : { tipo: ent.tipo, de: ent.de, alvo: ent.alvo, ticksRestantes: ent.ticksRestantes },
        ),
      });
    },
  };
}

// --- Codec do `ComandoCorrida` (plano §Contratos: bit 7 = `usarItem`, SÓ aqui — `core/comandos.ts`/`core/replay.ts`
//     continuam exigindo esse bit em 0 pro `ComandoDescida` puro de V1/replays sem item, de propósito). ---

const BIT_USAR_ITEM = 128;
const MAX_REPETICAO_CORRIDA = 255;

/** `ComandoCorrida` para byte (8 bits: os 7 de `byteDoComando` + o bit de `usarItem`). Lança em comando mal formado. */
export function byteDoComandoCorrida(c: Readonly<ComandoCorrida>): number {
  return byteDoComando(c.descida) | (c.usarItem ? BIT_USAR_ITEM : 0);
}

/** Byte para `ComandoCorrida`, ou `null` se os 7 bits baixos não formarem um `ComandoDescida` válido. */
export function comandoCorridaDoByte(b: number): ComandoCorrida | null {
  if (!Number.isInteger(b) || b < 0 || b > 255) return null;
  const descida = comandoDoByte(b & 127);
  if (descida === null) return null;
  return { descida, usarItem: (b & BIT_USAR_ITEM) !== 0 };
}

/** Comprime a lista de `ComandoCorrida` (um por tick) em RLE + base64 — mesmo formato de `codificarComandos`
 *  (`core/replay.ts`), só que com o byte de 8 bits (usarItem incluso). */
export function codificarComandosCorrida(comandos: readonly Readonly<ComandoCorrida>[]): string {
  const pares: number[] = [];
  let i = 0;
  while (i < comandos.length) {
    const b = byteDoComandoCorrida(comandos[i] as ComandoCorrida);
    let n = 1;
    while (i + n < comandos.length && n < MAX_REPETICAO_CORRIDA && byteDoComandoCorrida(comandos[i + n] as ComandoCorrida) === b) n++;
    pares.push(b, n);
    i += n;
  }
  return base64Codificar(pares);
}

/** Descomprime. Falha (sem lançar) em texto mal formado ou com mais de `maxTicks` ticks — mesma postura estrita de
 *  `decodificarComandos` (dado vindo de fora, incluindo o replay gravado pela própria `ui/cenas/corrida.ts`). */
export function decodificarComandosCorrida(texto: string, maxTicks: number = TETO_TICKS_REPLAY): Resultado<readonly ComandoCorrida[]> {
  if (typeof texto !== 'string') return falha(['comandosItens: não é texto']);
  if (texto.length > tamanhoMaximoDoTexto(maxTicks)) return falha([`comandosItens: texto grande demais (${texto.length} caracteres)`]);
  const bytes = base64Decodificar(texto);
  if (bytes === null) return falha(['comandosItens: base64 inválido']);
  if (bytes.length % 2 !== 0) return falha(['comandosItens: faltou a contagem de repetições no último par']);
  const saida: ComandoCorrida[] = [];
  let ticks = 0;
  for (let i = 0; i < bytes.length; i += 2) {
    const byte = bytes[i] as number;
    const rep = bytes[i + 1] as number;
    if (rep === 0) return falha([`comandosItens: repetição 0 no par ${i / 2}`]);
    ticks += rep;
    if (ticks > maxTicks) return falha([`comandosItens: mais de ${maxTicks} ticks`]);
    const cmd = comandoCorridaDoByte(byte);
    if (cmd === null) return falha([`comandosItens: byte de comando inválido (${byte}) no par ${i / 2}`]);
    for (let r = 0; r < rep; r++) saida.push(cmd);
  }
  return ok(saida);
}
