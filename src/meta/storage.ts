/**
 * Salvamento C4 `neve-maluca-v1` (plano §4): leitura, gravacao e saneamento. Camada `meta/`: codigo PURO, sem DOM,
 * sem relogio, sem aleatorio. O `Storage` entra por parametro (`ArmazenamentoLike`), entao tudo roda em Node com um
 * Map; nada aqui toca `window` exceto `obterArmazenamentoDoNavegador`, que recebe o alvo por parametro.
 *
 * ORIGEM: tecnica adaptada de InnoFighters `src/core/storage.ts` e `src/meta/progresso.ts` (E2/Z6, achados do Orion):
 *  - estado do disco distinguido em ausente/ok/futura/corrompida (um `undefined` unico apagava a v2 em v:3 ou JSON ruim);
 *  - `v > atual` e lida em memoria e NUNCA sobrescrita; JSON ilegivel e copiado para `...-quebrada` antes de ser substituido;
 *  - ids fora do catalogo, com forma de id, vao para `prog.desconhecidos` (teto) e sao promovidos quando passam a existir;
 *  - toda leitura e gravacao passa pelo saneamento, campo a campo, com limites; dado salvo nunca e confiavel.
 * Diferencas: catalogo injetavel sem padrao embutido; recordes por pista (top 5, versaoPista); `recordesAntigos`;
 * campos de raiz desconhecidos preservados (`extras`); armazenamento resiliente com memoria; gancho de migracao.
 *
 * Politica de formato (plano §4): MUDANCA DE FORMATO = CHAVE NOVA (`neve-maluca-v2`), deixando a v1 intacta para um
 * rollback de build ainda conseguir le-la. Este build e o inaugural (v1): `MIGRACOES` esta vazia.
 */
import type {
  ArmazenamentoLike,
  ConfigSave,
  DiarioSave,
  EstadoCampeonato,
  EstadoCarga,
  Evolucao,
  IdPersonagem,
  IdPista,
  Migracao,
  ModoControles,
  PistaConcluidaCampeonato,
  ProgressoSave,
  Recorde,
  RegrasSave,
  ReplayOpaco,
  ResultadoCarga,
  ResultadoGravacao,
  SaveV1,
} from './tipos';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

export const CHAVE_SAVE = 'neve-maluca-v1';
export const CHAVE_SAVE_QUEBRADA = 'neve-maluca-v1-quebrada';
/** Formato (`v`) que ESTE build le e grava. */
export const VERSAO_SAVE = 1;

/** Tetos (plano §4). Acima do teto nao e valor jogavel, e dado adulterado: o campo cai no padrao (ou o registro e descartado). */
export const TETO_PONTOS = 99_999_999;
export const TETO_FLOCOS = 999_999;
/** ~4,6 h a 60 ticks/s; muito alem de qualquer corrida real. */
export const TETO_TICKS = 1_000_000;
export const MAX_RECORDES_POR_PISTA = 5;
export const MAX_DESCONHECIDOS = 32;
/** Pistas de build futuro cujos recordes sobrevivem (alem das conhecidas). */
export const MAX_PISTAS_DESCONHECIDAS = 32;
/** Ids com forma de id (kebab-case curto). Id fora do catalogo e fora desta forma e lixo e e descartado. */
export const FORMA_ID = /^[a-z][a-z0-9-]{1,23}$/;
/** Limite de itens LIDOS de qualquer lista/mapa bruto (um arquivo adulterado com 1e6 itens nao custa 1e6 voltas). */
export const MAX_ITENS_BRUTOS = 1024;
/** `versaoPista`: caracteres de versao (`1`, `2.0`, `v3-a`). */
export const FORMA_VERSAO_PISTA = /^[A-Za-z0-9._-]{1,32}$/;
export const MAX_FANTASMAS = 8;
export const MAX_CHARS_REPLAY = 98_304;
export const MAX_EXTRAS_CHAVES = 16;
export const MAX_EXTRAS_CHARS_POR_CAMPO = 2_048;
export const MAX_EXTRAS_CHARS_TOTAL = 8_192;
/** Nível máximo de evolução por personagem (plano C-D3: "até 5 níveis"; mesmo teto de `data/evolucao.ts`). */
export const TETO_NIVEL_EVOLUCAO = 5;
/** Máximo de corredores de uma corrida do campeonato (plano: jogador + 5 rivais, C-D1/C-D2). */
export const MAX_CORREDORES_CAMPEONATO = 6;
/** Teto do texto lido do disco; acima disso o conteudo e tratado como adulterado. */
export const MAX_TEXTO_SAVE = 1_500_000;

export const CONTROLES_VALIDOS: readonly ModoControles[] = ['gestos', 'botoes'];

export const CONFIG_PADRAO: Readonly<ConfigSave> = Object.freeze({
  som: 0.8,
  musica: 0.6,
  movimentoReduzido: false,
  controles: 'gestos',
  maoEsquerda: false,
});

/** Chaves de raiz do contrato; qualquer outra e candidata a `extras`. */
const CHAVES_CONHECIDAS: ReadonlySet<string> = new Set([
  'v',
  'cfg',
  'prog',
  'recordes',
  'recordesAntigos',
  'fantasmas',
  'diario',
  'personagemAtivo',
  'pistaAtiva',
  'campeonato',
  'trofeus',
  'evolucao',
  'extras',
]);
const FORMA_CHAVE_EXTRA = /^[a-z][A-Za-z0-9]{0,31}$/;

/** Gancho de migracao. Vazio: este e o formato inaugural. Um build v2 acrescenta `{ de: 1, chave: CHAVE_SAVE, migrar }`. */
export const MIGRACOES: readonly Migracao[] = [];

// ---------------------------------------------------------------------------
// Validacao por funcoes puras
// ---------------------------------------------------------------------------

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Inteiro em [min, teto]: fracao perde a fracao; negativo, NaN, Infinity, texto ou acima do teto -> undefined. */
function inteiroLimitado(v: unknown, min: number, teto: number): number | undefined {
  if (!ehNumero(v) || v < 0) return undefined;
  const n = Math.floor(v);
  return n >= min && n <= teto ? n : undefined;
}

/** So as strings, ate `MAX_ITENS_BRUTOS` itens lidos. */
function strings(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const saida: string[] = [];
  for (const x of (v as unknown[]).slice(0, MAX_ITENS_BRUTOS)) if (typeof x === 'string') saida.push(x);
  return saida;
}

/** Clone JSON com limite de tamanho; remove chaves `__proto__`. `undefined` = nao e JSON, ciclico, ou grande demais. */
function clonarJson(v: unknown, maxChars: number): { valor: unknown } | undefined {
  let texto: string | undefined;
  try {
    texto = JSON.stringify(v);
  } catch {
    return undefined;
  }
  if (texto === undefined || texto.length > maxChars) return undefined;
  try {
    return { valor: JSON.parse(texto, (k, x: unknown) => (k === '__proto__' ? undefined : x)) as unknown };
  } catch {
    return undefined;
  }
}

function diasNoMes(ano: number, mes: number): number {
  if (mes === 2) return (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0 ? 29 : 28;
  return mes === 4 || mes === 6 || mes === 9 || mes === 11 ? 30 : 31;
}

function dataValida(ano: number, mes: number, dia: number): boolean {
  return ano >= 2000 && ano <= 2999 && mes >= 1 && mes <= 12 && dia >= 1 && dia <= diasNoMes(ano, mes);
}

/** `AAAA-MM-DD`, dia que existe no calendario, ano 2000..2999. Sem `Date`. */
export function ehDataUtc(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m !== null && dataValida(Number(m[1]), Number(m[2]), Number(m[3]));
}

/** `AAAA-MM-DDTHH:MM:SS[.m[m[m]]]Z`, data valida, hora 0..23, minuto/segundo 0..59. Sem `Date`. */
export function ehInstanteUtc(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?Z$/.exec(v);
  if (m === null) return false;
  return dataValida(Number(m[1]), Number(m[2]), Number(m[3])) && Number(m[4]) <= 23 && Number(m[5]) <= 59 && Number(m[6]) <= 59;
}

/** Volume: numero finito -> preso em 0..1; texto, NaN, Infinity -> undefined (cai no padrao). */
function volume(v: unknown): number | undefined {
  return ehNumero(v) ? Math.max(0, Math.min(1, v)) : undefined;
}

export function sanearCfg(bruto: unknown): ConfigSave {
  const o = ehObjeto(bruto) ? bruto : {};
  const controles = o['controles'];
  return {
    som: volume(o['som']) ?? CONFIG_PADRAO.som,
    musica: volume(o['musica']) ?? CONFIG_PADRAO.musica,
    movimentoReduzido: typeof o['movimentoReduzido'] === 'boolean' ? o['movimentoReduzido'] : CONFIG_PADRAO.movimentoReduzido,
    controles:
      typeof controles === 'string' && (CONTROLES_VALIDOS as readonly string[]).includes(controles)
        ? (controles as ModoControles)
        : CONFIG_PADRAO.controles,
    maoEsquerda: typeof o['maoEsquerda'] === 'boolean' ? o['maoEsquerda'] : CONFIG_PADRAO.maoEsquerda,
  };
}

interface Categoria {
  readonly conhecidos: ReadonlySet<string>;
  readonly iniciais: ReadonlySet<string>;
  readonly saida: string[];
}

function categoria(conhecidos: readonly string[], iniciais: readonly string[]): Categoria {
  return { conhecidos: new Set([...conhecidos, ...iniciais]), iniciais: new Set(iniciais), saida: [] };
}

/**
 * Saneia `prog`. Duplicados removidos; iniciais nunca guardados; cada lista aceita so ids do SEU catalogo (id de outro
 * catalogo na lista errada e lixo). Id fora de todos os catalogos, com `FORMA_ID`, vai para `desconhecidos` (teto
 * `MAX_DESCONHECIDOS`; os que ja estavam la tem prioridade). Id em `desconhecidos` que passou a existir e promovido.
 */
export function sanearProg(bruto: unknown, regras: RegrasSave): ProgressoSave {
  const o = ehObjeto(bruto) ? bruto : {};
  const pers = categoria(regras.personagens, regras.iniciais);
  const pist = categoria(regras.pistas, regras.pistasIniciais);
  const obj = categoria(regras.objetivos, []);
  const todas = [pers, pist, obj];
  const conhecidoEmAlgum = (id: string): boolean => todas.some((c) => c.conhecidos.has(id));
  const aceitar = (c: Categoria, id: string): void => {
    if (!c.iniciais.has(id) && !c.saida.includes(id)) c.saida.push(id);
  };

  const novosDesconhecidos: string[] = [];
  const campos: ReadonlyArray<readonly [string, Categoria]> = [
    ['desbloqueados', pers],
    ['pistas', pist],
    ['objetivos', obj],
  ];
  for (const [campo, cat] of campos) {
    for (const id of strings(o[campo])) {
      if (cat.conhecidos.has(id)) aceitar(cat, id);
      else if (!conhecidoEmAlgum(id) && FORMA_ID.test(id)) novosDesconhecidos.push(id);
    }
  }

  const antigosDesconhecidos: string[] = [];
  for (const id of strings(o['desconhecidos'])) {
    let promovido = false;
    for (const cat of todas) {
      if (cat.conhecidos.has(id)) {
        aceitar(cat, id);
        promovido = true;
      }
    }
    if (!promovido && FORMA_ID.test(id)) antigosDesconhecidos.push(id);
  }

  const desconhecidos = [...new Set([...antigosDesconhecidos, ...novosDesconhecidos])].slice(0, MAX_DESCONHECIDOS);
  return {
    desbloqueados: pers.saida,
    pistas: pist.saida,
    flocos: inteiroLimitado(o['flocos'], 0, TETO_FLOCOS) ?? 0,
    objetivos: obj.saida,
    desconhecidos,
  };
}

/** Recorde valido ou `undefined` (registro adulterado e descartado inteiro, nao remendado). */
export function sanearRecorde(bruto: unknown, regras: RegrasSave): Recorde | undefined {
  if (!ehObjeto(bruto)) return undefined;
  const pontos = inteiroLimitado(bruto['pontos'], 0, TETO_PONTOS);
  const ticks = inteiroLimitado(bruto['ticks'], 1, TETO_TICKS);
  const personagem = bruto['personagem'];
  const versaoPista = bruto['versaoPista'];
  const quando = bruto['quando'];
  if (pontos === undefined || ticks === undefined) return undefined;
  if (typeof personagem !== 'string' || !(regras.personagens.includes(personagem) || regras.iniciais.includes(personagem) || FORMA_ID.test(personagem))) {
    return undefined;
  }
  if (typeof versaoPista !== 'string' || !FORMA_VERSAO_PISTA.test(versaoPista)) return undefined;
  if (!ehInstanteUtc(quando)) return undefined;
  return { pontos, ticks, personagem, versaoPista, quando };
}

/** Melhor primeiro: mais pontos; empate -> menos ticks; empate -> mais antigo (ISO ordena como texto). Total e deterministico. */
function compararRecordes(a: Recorde, b: Recorde): number {
  if (a.pontos !== b.pontos) return b.pontos - a.pontos;
  if (a.ticks !== b.ticks) return a.ticks - b.ticks;
  if (a.quando !== b.quando) return a.quando < b.quando ? -1 : 1;
  if (a.personagem !== b.personagem) return a.personagem < b.personagem ? -1 : 1;
  return a.versaoPista < b.versaoPista ? -1 : a.versaoPista > b.versaoPista ? 1 : 0;
}

const chaveRecorde = (r: Recorde): string => `${r.pontos}|${r.ticks}|${r.personagem}|${r.versaoPista}|${r.quando}`;

/** Ordena, tira repetidos exatos e corta no teto. Nao muta a entrada. */
function melhores(lista: readonly Recorde[]): Recorde[] {
  const vistos = new Set<string>();
  const unicos: Recorde[] = [];
  for (const r of [...lista].sort(compararRecordes)) {
    const k = chaveRecorde(r);
    if (!vistos.has(k)) {
      vistos.add(k);
      unicos.push(r);
    }
  }
  return unicos.slice(0, MAX_RECORDES_POR_PISTA);
}

/** Mapa `pista -> recordes` bruto: ids de pista com forma valida; desconhecidas limitadas; itens invalidos descartados. */
function lerMapaRecordes(bruto: unknown, regras: RegrasSave): Map<IdPista, Recorde[]> {
  const mapa = new Map<IdPista, Recorde[]>();
  if (!ehObjeto(bruto)) return mapa;
  const conhecidas = new Set<string>([...regras.pistas, ...regras.pistasIniciais]);
  let desconhecidas = 0;
  for (const [pista, lista] of Object.entries(bruto).slice(0, MAX_ITENS_BRUTOS)) {
    if (!conhecidas.has(pista)) {
      if (!FORMA_ID.test(pista) || desconhecidas >= MAX_PISTAS_DESCONHECIDAS) continue;
      desconhecidas++;
    }
    if (!Array.isArray(lista)) continue;
    const validos: Recorde[] = [];
    for (const item of (lista as unknown[]).slice(0, MAX_ITENS_BRUTOS)) {
      const r = sanearRecorde(item, regras);
      if (r !== undefined) validos.push(r);
    }
    mapa.set(pista, validos);
  }
  return mapa;
}

function mapaParaObjeto(mapa: ReadonlyMap<IdPista, Recorde[]>): Record<IdPista, Recorde[]> {
  const saida: Record<IdPista, Recorde[]> = {};
  for (const [pista, lista] of mapa) if (lista.length > 0) saida[pista] = lista;
  return saida;
}

/**
 * Recordes por pista. Com `regras.versaoPista[pista]` conhecida, recorde de outra versao sai de `recordes` e vai para
 * `recordesAntigos` (mesmo teto, nao compete, nao some). Pista sem versao conhecida: nada e julgado.
 */
export function sanearRecordes(
  brutoAtuais: unknown,
  brutoAntigos: unknown,
  regras: RegrasSave,
): { recordes: Record<IdPista, Recorde[]>; recordesAntigos: Record<IdPista, Recorde[]> } {
  const lidosAtuais = lerMapaRecordes(brutoAtuais, regras);
  const lidosAntigos = lerMapaRecordes(brutoAntigos, regras);
  const versoes = regras.versaoPista;
  const atuais = new Map<IdPista, Recorde[]>();
  const antigos = new Map<IdPista, Recorde[]>();

  for (const [pista, lista] of lidosAtuais) {
    const versaoAtual = versoes !== undefined && Object.hasOwn(versoes, pista) ? versoes[pista] : undefined;
    const vigentes = versaoAtual === undefined ? lista : lista.filter((r) => r.versaoPista === versaoAtual);
    const velhos = versaoAtual === undefined ? [] : lista.filter((r) => r.versaoPista !== versaoAtual);
    atuais.set(pista, melhores(vigentes));
    if (velhos.length > 0) antigos.set(pista, velhos);
  }
  for (const [pista, lista] of lidosAntigos) antigos.set(pista, [...(antigos.get(pista) ?? []), ...lista]);
  for (const [pista, lista] of antigos) antigos.set(pista, melhores(lista));

  return { recordes: mapaParaObjeto(atuais), recordesAntigos: mapaParaObjeto(antigos) };
}

export function sanearDiario(bruto: unknown): DiarioSave | undefined {
  if (!ehObjeto(bruto) || !ehDataUtc(bruto['data'])) return undefined;
  const melhor = inteiroLimitado(bruto['melhor'], 0, TETO_PONTOS);
  return melhor === undefined ? undefined : { data: bruto['data'], melhor };
}

/**
 * Personagem ativo (escolha de personagem, UI): so e aceito se for um id do CATALOGO INTEIRO (`regras.personagens`),
 * de proposito sem checar `prog.desbloqueados` — o gating de desbloqueio ainda nao existe (M3-futuro), e todo id do
 * catalogo e selecionavel desde ja. Ausente, lixo, ou id fora do catalogo -> `undefined` (quem le decide o padrao;
 * ver comentario em `meta/tipos.ts`), nunca um valor inventado aqui.
 */
export function sanearPersonagemAtivo(bruto: unknown, regras: RegrasSave): IdPersonagem | undefined {
  return typeof bruto === 'string' && regras.personagens.includes(bruto) ? bruto : undefined;
}

/**
 * Pista ativa (seleção de pista, UI): mesma regra de `sanearPersonagemAtivo`, validada contra o CATÁLOGO INTEIRO
 * (`regras.pistas`), de propósito sem checar `prog.pistas` — o gating de desbloqueio ainda não existe (M3-futuro).
 * Ausente, lixo, ou id fora do catálogo -> `undefined` (quem lê decide o padrão).
 */
export function sanearPistaAtiva(bruto: unknown, regras: RegrasSave): IdPista | undefined {
  return typeof bruto === 'string' && regras.pistas.includes(bruto) ? bruto : undefined;
}

/**
 * Uma pista do campeonato já concluída (plano C5a): só a posição do JOGADOR (1..`MAX_CORREDORES_CAMPEONATO`) e os
 * ticks dela, não o pódio completo — `meta/campeonato.ts` deriva pontos a partir do `ResultadoCorrida.ordem` da
 * CORRIDA em si (dado rico, em memória), não deste registro resumido do save. Registro inválido é descartado por
 * inteiro (não remendado), igual a `sanearRecorde`.
 */
function sanearPistaConcluida(bruto: unknown, regras: RegrasSave): PistaConcluidaCampeonato | undefined {
  if (!ehObjeto(bruto)) return undefined;
  const existe = regras.pistas.includes(bruto['pista'] as string) || regras.pistasIniciais.includes(bruto['pista'] as string);
  if (typeof bruto['pista'] !== 'string' || !existe) return undefined;
  const ordem = inteiroLimitado(bruto['ordem'], 1, MAX_CORREDORES_CAMPEONATO);
  const ticks = inteiroLimitado(bruto['ticks'], 1, TETO_TICKS);
  if (ordem === undefined || ticks === undefined) return undefined;
  return { pista: bruto['pista'], ordem, ticks };
}

/** Até uma pista por pista do catálogo (duplicata é lixo: mantém a 1ª válida), capado no tamanho do catálogo. */
function sanearPistasConcluidas(bruto: unknown, regras: RegrasSave): PistaConcluidaCampeonato[] {
  if (!Array.isArray(bruto)) return [];
  const vistas = new Set<IdPista>();
  const saida: PistaConcluidaCampeonato[] = [];
  for (const item of (bruto as unknown[]).slice(0, MAX_ITENS_BRUTOS)) {
    if (saida.length >= regras.pistas.length) break;
    const limpo = sanearPistaConcluida(item, regras);
    if (limpo === undefined || vistas.has(limpo.pista)) continue;
    vistas.add(limpo.pista);
    saida.push(limpo);
  }
  return saida;
}

/**
 * Campeonato em andamento (plano C5a). `semente`/`personagem` precisam ser válidos (sem eles não há como repetir
 * as 5 pistas: o registro inteiro é descartado, como `sanearRecorde`). `etapa` NUNCA vem do bruto: é sempre
 * `pistasConcluidas.length` depois do saneamento — mesmo "nunca confiar num total guardado" de `classificacao`
 * (`meta/campeonato.ts`), aplicado aqui à contagem de etapas.
 */
export function sanearCampeonato(bruto: unknown, regras: RegrasSave): EstadoCampeonato | undefined {
  if (!ehObjeto(bruto)) return undefined;
  const semente = inteiroLimitado(bruto['semente'], 0, 0xffffffff);
  const personagem = bruto['personagem'];
  if (semente === undefined || typeof personagem !== 'string' || !regras.personagens.includes(personagem)) return undefined;
  const pistasConcluidas = sanearPistasConcluidas(bruto['pistasConcluidas'], regras);
  const etapa = Math.min(5, pistasConcluidas.length) as EstadoCampeonato['etapa'];
  return { semente, personagem, etapa, pistasConcluidas };
}

/** Só ids de `regras.personagens`, sem repetição, na ordem do catálogo (determinístico). `undefined` se nenhum. */
export function sanearTrofeus(bruto: unknown, regras: RegrasSave): readonly IdPersonagem[] | undefined {
  const lidos = new Set(strings(bruto));
  const saida = regras.personagens.filter((id) => lidos.has(id));
  return saida.length > 0 ? saida : undefined;
}

/** Só ids de `regras.personagens`; nível inteiro 1..`TETO_NIVEL_EVOLUCAO` (nível 0 é implícito: não é gravado). */
function sanearNiveisEvolucao(bruto: unknown, regras: RegrasSave): Partial<Record<IdPersonagem, number>> {
  const o = ehObjeto(bruto) ? bruto : {};
  const saida: Record<IdPersonagem, number> = {};
  for (const [id, valor] of Object.entries(o).slice(0, MAX_ITENS_BRUTOS)) {
    if (!regras.personagens.includes(id)) continue;
    const nivel = inteiroLimitado(valor, 0, TETO_NIVEL_EVOLUCAO);
    if (nivel !== undefined && nivel > 0) saida[id] = nivel;
  }
  return saida;
}

/** Evolução entre campeonatos (plano C-D3/C-D4): carteira de flocos (mesmo teto de `prog.flocos`) + nível por personagem. */
export function sanearEvolucao(bruto: unknown, regras: RegrasSave): Evolucao | undefined {
  if (!ehObjeto(bruto)) return undefined;
  return {
    flocos: inteiroLimitado(bruto['flocos'], 0, TETO_FLOCOS) ?? 0,
    niveis: sanearNiveisEvolucao(bruto['niveis'], regras),
  };
}

/** Fantasmas: ate `MAX_FANTASMAS` no total (conhecidas primeiro, na ordem do catalogo), JSON simples e pequeno. */
export function sanearFantasmas(bruto: unknown, regras: RegrasSave): Record<IdPista, ReplayOpaco> | undefined {
  if (!ehObjeto(bruto)) return undefined;
  const entradas = Object.entries(bruto).slice(0, MAX_ITENS_BRUTOS);
  const conhecidas = new Set<string>([...regras.pistas, ...regras.pistasIniciais]);
  const ordem = [
    ...[...conhecidas].filter((p) => Object.hasOwn(bruto, p)),
    ...entradas.map(([p]) => p).filter((p) => !conhecidas.has(p) && FORMA_ID.test(p)),
  ];
  const saida: Record<IdPista, ReplayOpaco> = {};
  let total = 0;
  for (const pista of ordem) {
    if (total >= MAX_FANTASMAS) break;
    const clone = clonarJson(bruto[pista], MAX_CHARS_REPLAY);
    if (clone === undefined || !ehObjeto(clone.valor)) continue;
    if (conhecidas.has(pista) && regras.validarReplay !== undefined && !validarSemLancar(regras.validarReplay, clone.valor)) continue;
    saida[pista] = clone.valor;
    total++;
  }
  return total > 0 ? saida : undefined;
}

function validarSemLancar(validar: (v: unknown) => boolean, valor: unknown): boolean {
  try {
    return validar(valor) === true;
  } catch {
    return false;
  }
}

/** Campos de raiz desconhecidos, com limites de quantidade e tamanho. */
export function sanearExtras(bruto: Record<string, unknown>): Record<string, unknown> | undefined {
  const saida: Record<string, unknown> = {};
  let chaves = 0;
  let chars = 0;
  for (const [chave, valor] of Object.entries(bruto).slice(0, MAX_ITENS_BRUTOS)) {
    if (CHAVES_CONHECIDAS.has(chave) || !FORMA_CHAVE_EXTRA.test(chave)) continue;
    if (chaves >= MAX_EXTRAS_CHAVES) break;
    const clone = clonarJson(valor, MAX_EXTRAS_CHARS_POR_CAMPO);
    if (clone === undefined) continue;
    const tamanho = JSON.stringify(clone.valor).length;
    if (chars + tamanho > MAX_EXTRAS_CHARS_TOTAL) continue;
    saida[chave] = clone.valor;
    chaves++;
    chars += tamanho;
  }
  return chaves > 0 ? saida : undefined;
}

/** Save de quem nunca jogou. Objeto novo a cada chamada. */
export function saveVazio(): SaveV1 {
  return {
    v: 1,
    cfg: { ...CONFIG_PADRAO },
    prog: { desbloqueados: [], pistas: [], flocos: 0, objetivos: [], desconhecidos: [] },
    recordes: {},
  };
}

/**
 * Saneamento completo: aceita QUALQUER coisa e devolve um `SaveV1` valido (nunca lanca, nunca muta a entrada).
 * Idempotente: `sanearSave(sanearSave(x)) == sanearSave(x)`. Ignora o `v` de entrada (a decisao sobre versao e de
 * quem le o disco) e sempre devolve `v: 1`.
 */
export function sanearSave(bruto: unknown, regras: RegrasSave): SaveV1 {
  const o = ehObjeto(bruto) ? bruto : {};
  const { recordes, recordesAntigos } = sanearRecordes(o['recordes'], o['recordesAntigos'], regras);
  const fantasmas = sanearFantasmas(o['fantasmas'], regras);
  const diario = sanearDiario(o['diario']);
  const personagemAtivo = sanearPersonagemAtivo(o['personagemAtivo'], regras);
  const pistaAtiva = sanearPistaAtiva(o['pistaAtiva'], regras);
  const campeonato = sanearCampeonato(o['campeonato'], regras);
  const trofeus = sanearTrofeus(o['trofeus'], regras);
  const evolucao = sanearEvolucao(o['evolucao'], regras);
  // No disco os campos desconhecidos moram na RAIZ (um build mais novo os le onde os escreveu); em memoria, em `extras`.
  // Aceita as duas formas, para o saneamento ser idempotente sobre o proprio resultado.
  const extras = sanearExtras({ ...(ehObjeto(o['extras']) ? o['extras'] : {}), ...o });
  return {
    v: 1,
    cfg: sanearCfg(o['cfg']),
    prog: sanearProg(o['prog'], regras),
    recordes,
    ...(Object.keys(recordesAntigos).length > 0 ? { recordesAntigos } : {}),
    ...(fantasmas !== undefined ? { fantasmas } : {}),
    ...(diario !== undefined ? { diario } : {}),
    ...(personagemAtivo !== undefined ? { personagemAtivo } : {}),
    ...(pistaAtiva !== undefined ? { pistaAtiva } : {}),
    ...(campeonato !== undefined ? { campeonato } : {}),
    ...(trofeus !== undefined ? { trofeus } : {}),
    ...(evolucao !== undefined ? { evolucao } : {}),
    ...(extras !== undefined ? { extras } : {}),
  };
}

/** Forma gravada em disco: `extras` volta para a raiz (o mesmo lugar de onde foi lido). Funcao pura. */
export function paraDisco(save: SaveV1): Record<string, unknown> {
  const { extras, ...resto } = save;
  return { ...resto, ...(extras ?? {}) };
}

/**
 * Registra um recorde (funcao pura): devolve o novo save e a posicao (0 = melhor) ou `null` se nao entrou no top 5, se
 * o recorde e invalido ou se a pista nao existe no catalogo. Recorde de versao de pista diferente da atual vai direto
 * para os antigos (posicao `null`).
 */
export function inserirRecorde(
  save: SaveV1,
  pista: IdPista,
  recorde: Recorde,
  regras: RegrasSave,
): { save: SaveV1; posicao: number | null } {
  const limpo = sanearRecorde(recorde, regras);
  const existe = regras.pistas.includes(pista) || regras.pistasIniciais.includes(pista);
  if (limpo === undefined || !existe) return { save: sanearSave(save, regras), posicao: null };
  const proximo = sanearSave(
    { ...save, recordes: { ...save.recordes, [pista]: [...(save.recordes[pista] ?? []), limpo] } },
    regras,
  );
  const chave = chaveRecorde(limpo);
  const indice = (proximo.recordes[pista] ?? []).findIndex((r) => chaveRecorde(r) === chave);
  return { save: proximo, posicao: indice >= 0 ? indice : null };
}

/**
 * Registra o fantasma (replay C6) de uma pista: UM por pista, sempre substituindo o que havia (quem chama decide
 * QUANDO — tipicamente só quando `inserirRecorde` devolve posição 0, o novo #1). Função pura: devolve um save novo,
 * já saneado (`sanearSave` → `sanearFantasmas`), que recusa o replay se `regras.validarReplay` reprovar ou se a pista
 * não existir no catálogo — nesses casos o save volta só saneado, sem o fantasma novo.
 */
export function inserirFantasma(save: SaveV1, pista: IdPista, replay: ReplayOpaco, regras: RegrasSave): SaveV1 {
  const existe = regras.pistas.includes(pista) || regras.pistasIniciais.includes(pista);
  if (!existe) return sanearSave(save, regras);
  return sanearSave({ ...save, fantasmas: { ...save.fantasmas, [pista]: replay } }, regras);
}

// ---------------------------------------------------------------------------
// Disco: inspecao, leitura, gravacao
// ---------------------------------------------------------------------------

/**
 *  - `ausente`: nao existe;
 *  - `ilegivel`: o armazenamento lancou erro ao ler (indisponivel);
 *  - `ok`: formato `v === 1`;
 *  - `futura`: `v` numerico > 1 (build mais novo): nao entendemos e nao podemos sobrescrever;
 *  - `corrompida`: JSON invalido, grande demais, ou forma que nao e save (null, [], texto, v ausente/0/negativo...); `texto` e o cru.
 */
type EstadoDisco =
  | { estado: 'ausente' }
  | { estado: 'ilegivel' }
  | { estado: 'ok'; objeto: Record<string, unknown> }
  | { estado: 'futura'; objeto: Record<string, unknown> }
  | { estado: 'corrompida'; texto: string };

function inspecionar(armazenamento: ArmazenamentoLike): EstadoDisco {
  let texto: string | null;
  try {
    texto = armazenamento.getItem(CHAVE_SAVE);
  } catch {
    return { estado: 'ilegivel' };
  }
  if (texto === null || texto === undefined) return { estado: 'ausente' };
  if (typeof texto !== 'string' || texto.length > MAX_TEXTO_SAVE) return { estado: 'corrompida', texto: String(texto).slice(0, MAX_TEXTO_SAVE) };
  let o: unknown;
  try {
    o = JSON.parse(texto);
  } catch {
    return { estado: 'corrompida', texto };
  }
  if (!ehObjeto(o)) return { estado: 'corrompida', texto };
  const versao = o['v'];
  if (versao === VERSAO_SAVE) return { estado: 'ok', objeto: o };
  if (typeof versao === 'number' && versao > VERSAO_SAVE) return { estado: 'futura', objeto: o };
  return { estado: 'corrompida', texto };
}

/**
 * Guarda o cru ilegivel em `neve-maluca-v1-quebrada` antes de o save ser substituido. Best-effort (cota cheia nao pode
 * derrubar o carregamento) e NAO sobrescreve uma copia que ja exista: a primeira evidencia vale, e o disco nao cresce a cada carga.
 */
function guardarCopiaQuebrada(armazenamento: ArmazenamentoLike, texto: string): boolean {
  try {
    if (armazenamento.getItem(CHAVE_SAVE_QUEBRADA) !== null) return false;
    armazenamento.setItem(CHAVE_SAVE_QUEBRADA, texto);
    return true;
  } catch {
    return false;
  }
}

function lerBruto(armazenamento: ArmazenamentoLike, chave: string): { valor: unknown } | undefined {
  try {
    const texto = armazenamento.getItem(chave);
    if (typeof texto !== 'string' || texto.length > MAX_TEXTO_SAVE) return undefined;
    return { valor: JSON.parse(texto) as unknown };
  } catch {
    return undefined;
  }
}

/** Tenta as chaves de formato anterior, da mais nova para a mais velha. Nunca escreve nem apaga nada. */
function tentarMigrar(armazenamento: ArmazenamentoLike, migracoes: readonly Migracao[]): Record<string, unknown> | undefined {
  for (const m of [...migracoes].sort((a, b) => b.de - a.de)) {
    const bruto = lerBruto(armazenamento, m.chave);
    if (bruto === undefined) continue;
    try {
      const novo = m.migrar(bruto.valor);
      if (ehObjeto(novo)) return novo;
    } catch {
      /* migracao quebrada: tenta a proxima chave */
    }
  }
  return undefined;
}

/**
 * Grava `neve-maluca-v1`. Nunca lanca. O que decide:
 *  - o disco tem `v > 1` -> `recusado-futuro` (nada escrito por cima);
 *  - o disco tem lixo ilegivel -> o cru vai para `neve-maluca-v1-quebrada` antes de ser substituido;
 *  - o `dados` e saneado antes de gravar, para o disco nunca guardar lixo (ids novos de catalogo viram `desconhecidos`);
 *  - o armazenamento recusou (cota, modo privado, ausente) -> `falhou`; um armazenamento resiliente que caiu para a
 *    memoria -> `so-memoria`.
 */
export function salvarSave(
  armazenamento: ArmazenamentoLike | null | undefined,
  dados: SaveV1,
  regras: RegrasSave,
): ResultadoGravacao {
  if (armazenamento === null || armazenamento === undefined) return 'falhou';
  const disco = inspecionar(armazenamento);
  if (disco.estado === 'futura') return 'recusado-futuro';
  if (disco.estado === 'corrompida') guardarCopiaQuebrada(armazenamento, disco.texto);
  try {
    armazenamento.setItem(CHAVE_SAVE, JSON.stringify(paraDisco(sanearSave(dados, regras))));
  } catch {
    return 'falhou';
  }
  return armazenamento.persistente === false ? 'so-memoria' : 'gravado';
}

/**
 * Carrega o save. Nunca lanca. Ver `EstadoCarga`. A leitura nao escreve nada, exceto:
 *  - a copia `...-quebrada` quando o disco esta ilegivel;
 *  - a gravacao do resultado de uma migracao (a chave ANTIGA fica intacta, para rollback de build).
 * `v > 1` e lido em memoria (saneamento tolerante) e `salvarSave` recusara gravar por cima.
 */
export function carregarSave(
  armazenamento: ArmazenamentoLike | null | undefined,
  regras: RegrasSave,
  migracoes: readonly Migracao[] = MIGRACOES,
): ResultadoCarga {
  if (armazenamento === null || armazenamento === undefined) {
    return { dados: saveVazio(), estado: 'indisponivel', avisar: true };
  }
  const disco = inspecionar(armazenamento);
  const pronto = (dados: SaveV1, estado: EstadoCarga, avisar = false): ResultadoCarga => ({ dados, estado, avisar });

  if (disco.estado === 'ilegivel') return pronto(saveVazio(), 'indisponivel', true);
  if (disco.estado === 'ok') return pronto(sanearSave(disco.objeto, regras), 'ok');
  if (disco.estado === 'futura') return pronto(sanearSave(disco.objeto, regras), 'futuro', true);

  if (disco.estado === 'corrompida') guardarCopiaQuebrada(armazenamento, disco.texto);
  const anterior = tentarMigrar(armazenamento, migracoes);
  if (anterior !== undefined) {
    const migrado = sanearSave(anterior, regras);
    salvarSave(armazenamento, migrado, regras);
    return pronto(migrado, 'migrado');
  }
  return pronto(saveVazio(), disco.estado === 'corrompida' ? 'recuperado' : 'novo');
}

// ---------------------------------------------------------------------------
// Armazenamento resiliente (modo privado, cota cheia, acesso bloqueado)
// ---------------------------------------------------------------------------

/**
 * Le `localStorage` do alvo (padrao `globalThis`) sem lancar: em navegadores com cookies bloqueados o PROPRIO acesso
 * a `localStorage` lanca `SecurityError`. `undefined` = indisponivel.
 */
export function obterArmazenamentoDoNavegador(alvo: object = globalThis): ArmazenamentoLike | undefined {
  try {
    const s = (alvo as { localStorage?: ArmazenamentoLike | null }).localStorage;
    return s ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Envolve um armazenamento que pode estar ausente ou falhar. Nada lanca: se o disco recusa uma gravacao (cota, modo
 * privado) o valor fica em MEMORIA e vale ate fechar a aba; a leitura enxerga a memoria primeiro. `persistente`
 * diz se algo so existe em memoria (a UI avisa "Progresso nao salvo neste aparelho").
 */
export class ArmazenamentoResiliente implements ArmazenamentoLike {
  private readonly memoria = new Map<string, string>();
  private readonly disco: ArmazenamentoLike | undefined;

  constructor(obter: () => ArmazenamentoLike | null | undefined = () => obterArmazenamentoDoNavegador()) {
    let d: ArmazenamentoLike | null | undefined;
    try {
      d = obter();
    } catch {
      d = undefined;
    }
    this.disco = d ?? undefined;
  }

  get persistente(): boolean {
    return this.disco !== undefined && this.memoria.size === 0;
  }

  getItem(chave: string): string | null {
    const local = this.memoria.get(chave);
    if (local !== undefined) return local;
    if (this.disco === undefined) return null;
    try {
      return this.disco.getItem(chave);
    } catch {
      return null;
    }
  }

  setItem(chave: string, valor: string): void {
    if (this.disco !== undefined) {
      try {
        this.disco.setItem(chave, valor);
        this.memoria.delete(chave);
        return;
      } catch {
        /* cota cheia ou modo privado: cai para a memoria */
      }
    }
    this.memoria.set(chave, valor);
  }

  removeItem(chave: string): void {
    this.memoria.delete(chave);
    if (this.disco === undefined) return;
    try {
      this.disco.removeItem(chave);
    } catch {
      /* sem armazenamento: ignora */
    }
  }
}
