/**
 * Tipos do salvamento C4 `neve-maluca-v1` (plano §4). So tipos: nenhum codigo de execucao, entao qualquer camada
 * pode importar este arquivo sem criar ciclo.
 *
 * Origem: adaptado de InnoFighters `src/meta/tipos.ts` (C4 v2), mesma tecnica: o catalogo de ids e DADO injetavel
 * (`RegrasSave`), nao constante embutida, para o teste usar ids falsos e para um id de build futuro sobreviver.
 *
 * Os ids sao `string` de proposito: o save de um build mais novo pode conter ids que este build nao conhece, e eles
 * precisam atravessar a leitura e a regravacao sem perda (ver `prog.desconhecidos`). Quando `data/` existir, o tipo
 * literal dos ids conhecidos mora la; aqui o storage so sabe "id com forma valida".
 */

export type IdPersonagem = string;
export type IdPista = string;
export type IdObjetivo = string;

/** Preferencia de controle por toque (D10): gestos (padrao) ou botoes na tela. */
export type ModoControles = 'gestos' | 'botoes';

export interface ConfigSave {
  /** Volume dos efeitos, 0..1. */
  som: number;
  /** Volume da musica, 0..1. */
  musica: number;
  movimentoReduzido: boolean;
  controles: ModoControles;
  maoEsquerda: boolean;
}

export interface ProgressoSave {
  /** ALEM dos iniciais (que sao implicitos e nunca gravados). Lista explicita, sem repeticao. */
  desbloqueados: IdPersonagem[];
  /** Pistas liberadas ALEM das iniciais. */
  pistas: IdPista[];
  /** Moeda do jogo (flocos de neve). Inteiro 0..TETO_FLOCOS. */
  flocos: number;
  /** Objetivos de pista ja cumpridos. */
  objetivos: IdObjetivo[];
  /**
   * Ids de personagem/pista/objetivo que ESTE build nao conhece (ex.: build mais novo, depois de um rollback).
   * Opacos: nunca entram na UI, so sao regravados. Se o id passar a existir, o saneamento o promove a sua lista.
   * Sempre presente (lista vazia quando nao ha), como no contrato C4.
   */
  desconhecidos: string[];
}

export interface Recorde {
  pontos: number;
  /** Duracao da corrida em ticks do motor. */
  ticks: number;
  personagem: IdPersonagem;
  /** Versao do gerador da pista no momento da corrida. Diferente da atual => vai para `recordesAntigos`. */
  versaoPista: string;
  /** Instante UTC em ISO 8601 (`AAAA-MM-DDTHH:MM:SS[.mmm]Z`); quem grava passa o valor, o storage nao le relogio. */
  quando: string;
}

/**
 * Replay C6 guardado como fantasma. O formato e do `core/`; aqui e opaco (JSON simples, com tamanho limitado)
 * e a validacao de verdade entra pelo gancho `RegrasSave.validarReplay`.
 */
export type ReplayOpaco = Record<string, unknown>;

export interface DiarioSave {
  /** Dia do desafio, `AAAA-MM-DD` (data UTC valida no calendario). */
  data: string;
  melhor: number;
}

export interface SaveV1 {
  v: 1;
  cfg: ConfigSave;
  prog: ProgressoSave;
  /** Ate 5 por pista, melhor primeiro. So recordes da versao atual da pista (quando a versao e conhecida). */
  recordes: Record<IdPista, Recorde[]>;
  /**
   * ADITIVO ao contrato do plano (sem bump: ausente = vazio). "Recordes antigos": os que tinham outra `versaoPista`.
   * Nao competem, mas tambem nao somem. Ate 5 por pista.
   */
  recordesAntigos?: Record<IdPista, Recorde[]>;
  fantasmas?: Record<IdPista, ReplayOpaco>;
  diario?: DiarioSave;
  /**
   * Campos de raiz que este build nao conhece (o mesmo `v`, gravados por um build com campo aditivo): preservados
   * com limites (ver `MAX_EXTRAS_*` em storage.ts). Ausente quando nao ha.
   */
  extras?: Record<string, unknown>;
}

/**
 * Catalogo e regras como DADO injetavel. Sem padrao embutido de proposito: um catalogo vazio mandaria todo id real
 * para `desconhecidos` em silencio. Quem monta o jogo (data/) entrega as regras; o teste entrega ids falsos.
 */
export interface RegrasSave {
  /** Todos os personagens existentes. Ids fora daqui e fora de `iniciais` viram desconhecidos (se tiverem a forma de id) ou lixo. */
  readonly personagens: readonly IdPersonagem[];
  /** Liberados de fabrica. Implicitos: nunca entram em `prog.desbloqueados`. */
  readonly iniciais: readonly IdPersonagem[];
  readonly pistas: readonly IdPista[];
  /** Pistas liberadas de fabrica. Implicitas: nunca entram em `prog.pistas`. */
  readonly pistasIniciais: readonly IdPista[];
  readonly objetivos: readonly IdObjetivo[];
  /**
   * Versao ATUAL de cada pista (`PistaGerada.versaoGerador`). Pista sem entrada aqui nao tem recorde julgado
   * (todos ficam como validos). Com entrada, recorde de outra versao vai para `recordesAntigos`.
   */
  readonly versaoPista?: Readonly<Record<IdPista, string>>;
  /** Validacao do replay C6 (feita pelo `core/`). Sem o gancho, vale so o limite de tamanho/forma JSON. */
  readonly validarReplay?: (replay: unknown) => boolean;
}

/** Estado da leitura, para a UI decidir se mostra o aviso "Progresso nao salvo neste aparelho". */
export type EstadoCarga =
  /** Nada no disco: comecou do zero. */
  | 'novo'
  /** Save atual lido e saneado. */
  | 'ok'
  /** Veio de uma chave de formato anterior (gancho de migracao); a chave antiga ficou intacta. */
  | 'migrado'
  /** O disco tinha lixo ilegivel: copiado para `neve-maluca-v1-quebrada` e comecou do zero. */
  | 'recuperado'
  /** `v` maior que o deste build: lido em memoria, NUNCA sobrescrito. */
  | 'futuro'
  /** O armazenamento nao existe ou lancou erro na leitura (modo privado, cookies bloqueados). */
  | 'indisponivel';

export interface ResultadoCarga {
  dados: SaveV1;
  estado: EstadoCarga;
  /** `true` em `futuro` e `indisponivel`: mostrar "Progresso nao salvo neste aparelho". */
  avisar: boolean;
}

export type ResultadoGravacao =
  /** Foi para o disco. */
  | 'gravado'
  /** Ficou so em memoria (armazenamento resiliente em modo degradado): vale nesta sessao, nao sobrevive ao recarregar. */
  | 'so-memoria'
  /** O disco tem um save de build mais novo; nada foi escrito por cima. */
  | 'recusado-futuro'
  /** O armazenamento recusou (cota cheia, modo privado, ausente). Nada quebrou; o jogo segue. */
  | 'falhou';

/** Subconjunto de `Storage` que usamos; permite testar em Node com um Map e trocar por memoria. */
export interface ArmazenamentoLike {
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
  /** Presente nos armazenamentos resilientes: `false` quando algo so existe em memoria. */
  readonly persistente?: boolean;
}

/**
 * Gancho de migracao: le o bruto de uma chave de formato ANTERIOR e devolve o bruto no formato atual (o saneamento
 * roda depois). Nunca apaga nem altera a chave antiga (rollback de build precisa encontra-la intacta).
 */
export interface Migracao {
  /** Numero do formato de origem (ordem de tentativa: o maior primeiro). */
  readonly de: number;
  readonly chave: string;
  readonly migrar: (bruto: unknown) => unknown;
}
