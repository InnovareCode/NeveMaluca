/**
 * Itens/poderes da corrida (`docs/plano-itens-corrida.md`, aprovado pelo dono em 2026-10-24): parâmetros de efeito
 * calibráveis por item, a tabela de sorteio por faixa de posição (catch-up leve, I-D1) e o sorteio em si — SEM
 * ESTADO, puro em função de `(semente, id, chave)` (plano §Determinismo: "sorteio sem estado... sem fila
 * compartilhada -> quem pegou primeiro não muda o que os outros tiram").
 *
 * `data/` só importa `core/` (plano §3.1): os TIPOS (`TipoItem`, `EfeitoExterno`, `IdPersonagem`) vêm de
 * `core/contratos.ts` (Vega, I0). A física de verdade (motor/orquestrador) é de `descida/` e `corrida/` — este
 * arquivo não tem laço de tick, só números e as duas funções puras que `corrida/itens.ts` (I2) e
 * `corrida/ia-itens.ts` (I3) vão consumir.
 *
 * O QUE NÃO ESTÁ AQUI, de propósito:
 *  - Bola de Neve e Nuvem de Granizo usam `EfeitoExterno{tipo:'trombada'}`, que não carrega `fator`/`ticks` no
 *    contrato (`core/contratos.ts`) — o motor (`descida/motor.ts`, Vega I1) já fixa
 *    `FATOR_VELOCIDADE_TROMBADA = 0.3` e `TICKS_ATORDOADO_TROMBADA = 40`. Duplicar esses números aqui criaria 2
 *    fontes de verdade para o mesmo efeito; por isso os dois itens abaixo só aparecem na tabela de sorteio.
 *  - A física do projétil/armadilha em si (posição, colisão com rivais) é de `corrida/itens.ts` (I2, Vega) — aqui
 *    só os PARÂMETROS que alimentam o `EfeitoExterno` que o orquestrador produz.
 */
import type { EfeitoExterno, IdPersonagem, TipoItem } from '../core/contratos';
import { TIPOS_ITEM } from '../core/contratos';
import { TICKS_POR_SEGUNDO } from '../core/constantes';
import { ErroDeContrato } from '../core/erros';
import { criarHasher } from '../core/hash';
import { criarRng } from '../core/rng';

// --- Parâmetros de efeito por item (chute inicial — plano diz "calibração inicial, I6 ajusta no campeonato real") ---

export interface ParametrosFreadaItem {
  /** Fração de `config.velocidadeMaxMs` que vira o teto enquanto a janela estiver ativa (plano: "freia forte"). */
  readonly fator: number;
  readonly ticks: number;
}

export interface ParametrosTurboItem {
  /** m/s somado à velocidade e ao teto (`aplicarTurbo`, `descida/motor.ts`) — o nome "ms" vem do contrato
   *  (`EfeitoExterno{tipo:'turbo'}`, Vega I0); não é milissegundos. Mesmo teto do turbo de pouso
   *  (`TURBO_TETO_EXTRA_MS = 12`, `descida/motor.ts`): aqui uso o teto cheio, "1 calibragem só" (plano C-D7). */
  readonly ms: number;
  /** Informativo (UI/som, plano: "o decaimento físico é sempre o mesmo do turbo de pouso") — não controla a física. */
  readonly ticks: number;
}

export interface ParametrosEscudoItem {
  /** Janela em que a Bolha de Gelo absorve 1 acerto. Estado (`escudo?: boolean`), não `EfeitoExterno`: quem conta
   *  os ticks é o orquestrador (`corrida/itens.ts`, I2) — aqui só a duração calibrável. */
  readonly ticks: number;
}

export interface ParametrosImaItem {
  /** Bem maior que o raio normal de coleta de floco (1.1-1.6 m, `pista/camada-jogo.ts`): é pra sentir o puxão. */
  readonly raioM: number;
  readonly ticks: number;
}

/** Poça de Calda: ~1.5 s a 45% do teto de velocidade (mais leve que a trombada — sem travar controle/combo). */
export const PARAMETROS_POCA_FREADA: ParametrosFreadaItem = { fator: 0.45, ticks: Math.round(1.5 * TICKS_POR_SEGUNDO) };

/** Chocolate Quente: estoura o teto do turbo de pouso de uma vez; ~2 s de janela informativa (plano: "impulso ~2s"). */
export const PARAMETROS_TURBO_ITEM: ParametrosTurboItem = { ms: 12, ticks: 2 * TICKS_POR_SEGUNDO };

/** Bolha de Gelo: ~8 s absorvendo o próximo acerto (plano). */
export const PARAMETROS_ESCUDO_ITEM: ParametrosEscudoItem = { ticks: 8 * TICKS_POR_SEGUNDO };

/** Ímã de Flocos: raio de 6 m por ~6 s (plano: "puxa coletáveis próximos ~6s"). */
export const PARAMETROS_IMA_ITEM: ParametrosImaItem = { raioM: 6, ticks: 6 * TICKS_POR_SEGUNDO };

/**
 * O `EfeitoExterno` que o item produz ao acertar/ser usado (plano §Contratos) — pronto pro orquestrador
 * (`corrida/itens.ts`, I2) empilhar em `efeitos` sem reimplementar o mapeamento item -> efeito. `undefined` para
 * `'escudo'`: ele nunca é um `EfeitoExterno` (BLOQUEIA um; decisão do orquestrador, plano §Contratos).
 */
export function efeitoExternoDoItem(item: TipoItem): EfeitoExterno | undefined {
  switch (item) {
    case 'bola':
    case 'nuvem':
      return { tipo: 'trombada', item };
    case 'poca':
      return { tipo: 'freada', item, fator: PARAMETROS_POCA_FREADA.fator, ticks: PARAMETROS_POCA_FREADA.ticks };
    case 'turbo':
      return { tipo: 'turbo', item, ms: PARAMETROS_TURBO_ITEM.ms, ticks: PARAMETROS_TURBO_ITEM.ticks };
    case 'ima':
      return { tipo: 'ima', item, raioM: PARAMETROS_IMA_ITEM.raioM, ticks: PARAMETROS_IMA_ITEM.ticks };
    case 'escudo':
      return undefined;
  }
}

// --- Sorteio por faixa de posição (plano I-D1: catch-up LEVE e simétrico — mesma regra pro jogador e pra IA) ---

export type TabelaPesosItem = Readonly<Record<TipoItem, number>>;

/** Corredores por corrida (plano corrida-campeonato: "corrida dos 6"; mesmo valor de `BONUS_PODIO_FLOCOS`, `data/evolucao.ts`). */
export const CORREDORES_POR_CORRIDA = 6;

/** Pesos padrão (posições que não são as 2 últimas). Nuvem de Granizo é a mais rara de propósito (I-D2: "casco azul"). */
export const PESOS_ITEM_PADRAO: TabelaPesosItem = { bola: 25, poca: 20, nuvem: 5, turbo: 20, escudo: 15, ima: 15 };

/**
 * Pesos dos 2 últimos lugares (plano I-D1): só o turbo sobe (20 -> 30); os outros descem um pouco pra manter a
 * soma em 100 — "leve", não uma rampa de potes-liga-tudo. Nuvem continua igualmente rara (ela mira o 1º lugar, não
 * favorece quem está atrás por construção).
 */
export const PESOS_ITEM_ULTIMOS: TabelaPesosItem = { bola: 22, poca: 17, nuvem: 5, turbo: 30, escudo: 13, ima: 13 };

/** Tabela de pesos pra `posicao` (1 = líder) numa corrida de `totalCorredores` corredores: os 2 últimos puxam o catch-up. */
export function pesosDeSorteioPorPosicao(posicao: number, totalCorredores: number = CORREDORES_POR_CORRIDA): TabelaPesosItem {
  return posicao > totalCorredores - 2 ? PESOS_ITEM_ULTIMOS : PESOS_ITEM_PADRAO;
}

function escolherPorPeso(valor01: number, pesos: TabelaPesosItem): TipoItem {
  const total = TIPOS_ITEM.reduce((soma, tipo) => soma + pesos[tipo], 0);
  let alvo = valor01 * total;
  for (const tipo of TIPOS_ITEM) {
    const peso = pesos[tipo];
    if (alvo < peso) return tipo;
    alvo -= peso;
  }
  return TIPOS_ITEM[TIPOS_ITEM.length - 1] as TipoItem; // guarda de arredondamento de float; nunca alcançado em teoria
}

/**
 * Semente derivada de `(semente, id, chave)` via FNV-1a (`core/hash.ts`) — mistura os 3 componentes sem colisão
 * óbvia, sem precisar de nenhum gerador compartilhado entre chamadas (isso é o "sem estado" do plano).
 */
function semeadorSorteio(semente: number, id: IdPersonagem, chave: number): number {
  const hex = criarHasher().i32(semente | 0).texto(id).i32(chave | 0).hex();
  return Number.parseInt(hex.slice(0, 8), 16) | 0;
}

/**
 * Float uniforme em [0, 1), determinístico e sem estado: mesma `(semente, id, chave)` -> mesmo valor, sempre, em
 * qualquer ordem de chamada (plano §Determinismo). Usa a MESMA mulberry32 do resto do jogo (`core/rng.ts`) só pra
 * tirar 1 valor de uma semente derivada por hash — nunca guarda o `Rng` entre chamadas.
 *
 * Reaproveitável por `corrida/ia-itens.ts` (I3, plano: "decisão da IA = hash(semente, id, tick)") passando o tick
 * como `chave`, exatamente como `sortearItem` abaixo passa o índice da caixa.
 */
export function hashSorteio01(semente: number, id: IdPersonagem, chave: number): number {
  return criarRng(semeadorSorteio(semente, id, chave)).proximo();
}

/**
 * Item sorteado para o corredor `id` ao pegar a caixa `indiceCaixa` (índice em `CamadaJogo.caixas`), dada a
 * `posicao` dele na corrida AGORA (1 = líder; plano I-D1 — catch-up pela posição no momento da caixa, não no fim).
 * Determinístico: o mesmo corredor pegando a mesma caixa com a mesma semente sempre tira o mesmo item, mas caixas
 * diferentes (ou corredores diferentes) são independentes — "quem pegou primeiro não muda o que os outros tiram".
 */
export function sortearItem(
  semente: number,
  id: IdPersonagem,
  indiceCaixa: number,
  posicao: number,
  totalCorredores: number = CORREDORES_POR_CORRIDA,
): TipoItem {
  const pesos = pesosDeSorteioPorPosicao(posicao, totalCorredores);
  return escolherPorPeso(hashSorteio01(semente, id, indiceCaixa), pesos);
}

// --- Economia (plano I-D6) ---

/**
 * Flocos ganhos por acertar um rival (`EventoCorrida{tipo:'acerto'}`) — sempre, de ambos os lados (plano: "item é
 * de graça... acertar rival dá +5 flocos"). Item NUNCA custa flocos (sem pay-to-win): isto é a única ponte entre
 * itens e a economia de `data/evolucao.ts`.
 *
 * Gancho pra objetivos (plano: "pode entrar em objetivos, ex. 'acerte 3 bolas'"): precisa de um campo novo em
 * `ResumoDescida`/`CAMPOS_RESUMO_DESCIDA` (`core/contratos.ts`, ex. contagem de acertos por item) que ainda não
 * existe — isso é do dono daquele contrato (Vega), não deste arquivo. Ver PENDÊNCIAS do handoff.
 */
export const FLOCOS_POR_ACERTO_ITEM = 5;

// --- Validação (mesmo padrão de `data/evolucao.ts`/`data/objetivos.ts`: lança no boot, nunca silencioso) ---

function problemasDaTabelaDePesos(rotulo: string, pesos: TabelaPesosItem): string[] {
  const p: string[] = [];
  for (const tipo of TIPOS_ITEM) {
    const peso = pesos[tipo];
    if (!Number.isInteger(peso) || peso < 0) p.push(`${rotulo}.${tipo} = ${peso}, precisa ser inteiro >= 0`);
  }
  const total = TIPOS_ITEM.reduce((soma, tipo) => soma + pesos[tipo], 0);
  if (total <= 0) p.push(`${rotulo}: soma dos pesos precisa ser > 0, é ${total}`);
  const outros = TIPOS_ITEM.filter((t) => t !== 'nuvem').map((t) => pesos[t]);
  if (outros.length > 0 && pesos.nuvem >= Math.min(...outros)) {
    p.push(`${rotulo}.nuvem (${pesos.nuvem}) precisa ser o peso mais raro (plano I-D2: casco azul é raro)`);
  }
  return p;
}

function problemasDosItens(): string[] {
  const p: string[] = [
    ...problemasDaTabelaDePesos('PESOS_ITEM_PADRAO', PESOS_ITEM_PADRAO),
    ...problemasDaTabelaDePesos('PESOS_ITEM_ULTIMOS', PESOS_ITEM_ULTIMOS),
  ];
  if (PESOS_ITEM_ULTIMOS.turbo <= PESOS_ITEM_PADRAO.turbo) {
    p.push('PESOS_ITEM_ULTIMOS.turbo precisa ser maior que PESOS_ITEM_PADRAO.turbo (plano I-D1: catch-up nos 2 últimos)');
  }
  if (!(PARAMETROS_POCA_FREADA.fator > 0 && PARAMETROS_POCA_FREADA.fator <= 1)) p.push(`PARAMETROS_POCA_FREADA.fator = ${PARAMETROS_POCA_FREADA.fator}, precisa estar em (0, 1]`);
  if (!Number.isInteger(PARAMETROS_POCA_FREADA.ticks) || PARAMETROS_POCA_FREADA.ticks <= 0) p.push('PARAMETROS_POCA_FREADA.ticks precisa ser inteiro > 0');
  if (!(PARAMETROS_TURBO_ITEM.ms > 0)) p.push('PARAMETROS_TURBO_ITEM.ms precisa ser > 0');
  if (!Number.isInteger(PARAMETROS_TURBO_ITEM.ticks) || PARAMETROS_TURBO_ITEM.ticks <= 0) p.push('PARAMETROS_TURBO_ITEM.ticks precisa ser inteiro > 0');
  if (!Number.isInteger(PARAMETROS_ESCUDO_ITEM.ticks) || PARAMETROS_ESCUDO_ITEM.ticks <= 0) p.push('PARAMETROS_ESCUDO_ITEM.ticks precisa ser inteiro > 0');
  if (!(PARAMETROS_IMA_ITEM.raioM > 0)) p.push('PARAMETROS_IMA_ITEM.raioM precisa ser > 0');
  if (!Number.isInteger(PARAMETROS_IMA_ITEM.ticks) || PARAMETROS_IMA_ITEM.ticks <= 0) p.push('PARAMETROS_IMA_ITEM.ticks precisa ser inteiro > 0');
  if (!Number.isInteger(FLOCOS_POR_ACERTO_ITEM) || FLOCOS_POR_ACERTO_ITEM <= 0) p.push('FLOCOS_POR_ACERTO_ITEM precisa ser inteiro > 0');
  if (!Number.isInteger(CORREDORES_POR_CORRIDA) || CORREDORES_POR_CORRIDA < 2) p.push('CORREDORES_POR_CORRIDA precisa ser inteiro >= 2');
  return p;
}

/** Lança `ErroDeContrato` se algum parâmetro/tabela de itens estiver mal formado (boot com tela de erro clara). */
export function exigirItensValidos(): void {
  const problemas = problemasDosItens();
  if (problemas.length > 0) throw new ErroDeContrato('contrato-invalido', 'parâmetros de itens (data/itens.ts) inválidos', problemas);
}

exigirItensValidos();
