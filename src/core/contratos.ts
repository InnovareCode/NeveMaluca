/**
 * Contratos entre camadas (plano §4: C2, C3, C5, C6). Tipos e as tabelas de valores permitidos, sem lógica.
 * O C4 (armazenamento `neve-maluca-v1`) é do Cronos e mora em `storage.ts`. O C1 (manifesto de atlas) é de `assets/`.
 * Dono deste arquivo: Vega. Lyra e Cronos apenas leem (mudança de contrato passa pelo Atlas).
 *
 * Origem do padrão: InnoFighters `src/core/contratos.ts` (C2 InputFrame, C3 leitura do motor), adaptado em 2026-10-22.
 *
 * Ids: por ora `string` com nome próprio (o dado vem de `data/`, que ainda não existe). Quando o Cronos fixar os
 * catálogos, cada um vira uma união literal AQUI, numa linha, e o compilador mostra todo uso que precisa de ajuste.
 * A forma válida de qualquer id está em `FORMA_ID` (constantes.ts).
 */

export type IdPersonagem = string;
export type IdPista = string;
export type IdTema = string;
export type IdTrecho = string;
export type IdMusica = string;
export type IdObjetivo = string;
export type IdManobra = string;
export type IdItem = string;
export type IdPose = string;

// --- C2: entrada ---

export const GRABS = ['cima', 'baixo', 'frente', 'tras'] as const;
export type Grab = (typeof GRABS)[number];

/** Giro segurado: -1 mortal para trás, 0 sem giro, +1 mortal para frente. */
export type Giro = -1 | 0 | 1;

/**
 * Quadro de entrada BRUTO de um dispositivo (teclado, controle ou toque), já normalizado por `input/`, um por tick.
 * Aqui `pular` é o estado SEGURADO; a borda (`ComandoDescida.pulo`) é derivada por `derivarComando`.
 * `grab` já chega como evento (o gesto ou a tecla DESTE tick).
 */
export interface InputFrame {
  readonly pular: boolean;
  readonly giro: Giro;
  readonly grab: Grab | null;
  readonly agachar: boolean;
}

/** C2: um comando por tick. É a ÚNICA coisa que o motor da descida lê da entrada (e a única coisa gravada no replay). */
export interface ComandoDescida {
  /** Borda de descida: verdadeiro só no tick do aperto. */
  readonly pulo: boolean;
  /** Segurado: -1 mortal para trás, +1 para frente. */
  readonly giro: Giro;
  /** Borda: o gesto ou a tecla deste tick. */
  readonly grab: Grab | null;
  /** Segurado. */
  readonly agachar: boolean;
}

// --- C3: leitura do motor ---

export const FASES_DESCIDA = ['contagem', 'descendo', 'tombo', 'chegou'] as const;
export type FaseDescida = (typeof FASES_DESCIDA)[number];

export const MODOS_PILOTO = ['chao', 'ar', 'trilho', 'tombo'] as const;
export type ModoPiloto = (typeof MODOS_PILOTO)[number];

export const QUALIDADES_POUSO = ['perfeito', 'bom', 'torto'] as const;
export type QualidadePouso = (typeof QUALIDADES_POUSO)[number];

export const CAUSAS_TOMBO = ['angulo', 'obstaculo', 'trilho'] as const;
export type CausaTombo = (typeof CAUSAS_TOMBO)[number];

export interface PilotoLeitura {
  /** Posição em metros (x ao longo da pista, y para cima). */
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  /** Módulo da velocidade, m/s. */
  readonly velocidade: number;
  /** Ângulo do corpo e da tangente do terreno, em GRAUS (convenção de `core/trig.ts`: 0 = +x, anti-horário). */
  readonly angulo: number;
  readonly anguloTerreno: number;
  readonly modo: ModoPiloto;
  readonly pose: IdPose;
  readonly grab: Grab | null;
  readonly voltas: number;
  readonly ticksNoAr: number;
}

export interface ComboLeitura {
  readonly ativo: boolean;
  readonly manobras: readonly IdManobra[];
  readonly soma: number;
  readonly mult: number;
  readonly janela: number;
}

/** O motor nunca toca som nem cria partícula: emite eventos. `eventos` é esvaziado no começo de cada tick. */
export type EventoDescida =
  | { readonly tipo: 'pulo'; readonly forca: number }
  | { readonly tipo: 'pouso'; readonly qualidade: QualidadePouso; readonly queda: number }
  | { readonly tipo: 'tombo'; readonly causa: CausaTombo }
  | { readonly tipo: 'manobra'; readonly id: IdManobra; readonly pontos: number }
  | { readonly tipo: 'combo-fechado'; readonly soma: number; readonly mult: number; readonly total: number }
  | { readonly tipo: 'combo-perdido'; readonly soma: number }
  | { readonly tipo: 'trilho'; readonly etapa: 'inicio' | 'fim' }
  | { readonly tipo: 'coleta'; readonly item: IdItem }
  | { readonly tipo: 'boneco'; readonly x: number }
  | { readonly tipo: 'checkpoint'; readonly indice: number }
  | { readonly tipo: 'chegada'; readonly pontos: number; readonly ticks: number };

export type TipoEventoDescida = EventoDescida['tipo'];

export interface LeituraDescida {
  readonly tick: number;
  readonly fase: FaseDescida;
  readonly piloto: PilotoLeitura;
  readonly combo: ComboLeitura;
  readonly pontos: number;
  readonly distancia: number;
  readonly distanciaTotal: number;
  readonly coletados: number;
  readonly eventos: readonly EventoDescida[];
}

// --- M3: personagem (atributos, elenco) ---

/** As 5 pistas do atributo (plano M3 §4): soma sempre 500, inteiros 90..110. `aceleracao` não reusa `atrito` (não
 *  cabe no termo linear: ver achado 1 do plano M3 §0) — ganha campo próprio no motor, `ConfigDescida.fatorEmbalo`. */
export const ATRIBUTOS = ['velocidade', 'aceleracao', 'giro', 'equilibrio', 'pulo'] as const;
export type Atributo = (typeof ATRIBUTOS)[number];

/** Requisito para um personagem (ou pista, C5) aparecer liberado no save (plano M3 §B.5). */
export type RequisitoDesbloqueio =
  | { readonly tipo: 'inicial' }
  | { readonly tipo: 'concluir'; readonly pista: IdPista }
  | { readonly tipo: 'objetivos'; readonly total: number };

/** Ficha de personagem (plano M3 §A.3). `configDoPersonagem` (`descida/atributos.ts`) converte `atributos` num
 *  `ConfigDescida` RELATIVO à Capi (`PERSONAGEM_REFERENCIA`): por isso este contrato não carrega física nenhuma. */
export interface DefPersonagem {
  /** Um dos ids JÁ gravados em `REGRAS_SAVE.personagens` (`data/regras-save.ts`) — não renomear com save gravado. */
  readonly id: IdPersonagem;
  readonly nome: string;
  readonly bordao: string;
  /** Nome de manobra/pose do personagem (ex.: "Cauda-Vela"). É só nome e pose: NUNCA concede bônus de pontos. */
  readonly nomeAssinatura: string;
  /** Inteiros 90..110, soma 500 (validado em `data/personagens.ts`, fora deste contrato). */
  readonly atributos: Readonly<Record<Atributo, number>>;
  readonly casa: IdPista;
  readonly desbloqueio: RequisitoDesbloqueio;
}

// --- C5: pista ---

/** Tipos de objeto da pista (lista da folha de objetos do plano §6.5). O gerador (M1) pode estendê-la. */
export const TIPOS_OBJETO = [
  'pinheiro',
  'pedra',
  'tronco',
  'rampa',
  'trilho',
  'boneco-de-neve',
  'bandeira',
  'portico',
  'floco',
  'placa',
] as const;
export type TipoObjeto = (typeof TIPOS_OBJETO)[number];

/** Objeto colocado na pista. `x` e `largura` em metros; a altura do chão vem de `PistaGerada.alturas`. */
export interface ObjetoPista {
  readonly tipo: TipoObjeto;
  readonly x: number;
  readonly largura: number;
  readonly altura: number;
  /** Variante visual (índice no catálogo do render), 0 se só houver uma. */
  readonly variante: number;
}

/** Trilho (segmento onde o piloto desliza). `x0 < x1`, em metros. */
export interface Trilho {
  readonly x0: number;
  readonly x1: number;
  /** Altura do trilho acima do chão, em metros. */
  readonly altura: number;
}

export interface DefPista {
  readonly id: IdPista;
  readonly nome: string;
  readonly tema: IdTema;
  /** Semente fixa da pista (uint32). */
  readonly semente: number;
  readonly comprimentoM: number;
  /** Faixa de dificuldade, de 0 a 1: [início, fim]. */
  readonly dificuldade: readonly [inicio: number, fim: number];
  /** Pesos dos trechos permitidos. */
  readonly trechos: Readonly<Partial<Record<IdTrecho, number>>>;
  readonly musica: IdMusica;
  readonly objetivos: readonly IdObjetivo[];
  /** Hash fixo da pista gerada (16 hex, ver `hash.ts`). Mudou o gerador = mudou este hash = teste falha. */
  readonly hashEsperado: string;
  /** Ordem no mapa/seleção de pista (1..5, plano M3 §B.3). Campo de PROGRESSÃO: o gerador o ignora, não entra no hash. */
  readonly ordem: number;
  /** Campo de PROGRESSÃO (plano M3 §B.3): o gerador o ignora, não entra no hash. */
  readonly desbloqueio: RequisitoDesbloqueio;
}

export interface PistaGerada {
  readonly id: IdPista;
  readonly semente: number;
  readonly versaoGerador: string;
  /** Espaçamento das amostras de altura, metros (`DX_PISTA_M`). */
  readonly dx: 0.5;
  readonly alturas: Float64Array;
  readonly objetos: readonly ObjetoPista[];
  readonly trilhos: readonly Trilho[];
  readonly checkpoints: readonly number[];
  readonly chegadaX: number;
  readonly hash: string;
}

// --- M3: temas visuais (plano §B.3) ---
// Dado visual de um tema: a tabela de cores da direção de arte (§2.1) + clima (partículas) + música. O resto da
// "pele" (silhuetas, objetos, feições) fica como constante do pintor em `render/temas/<tema>.ts` (Lyra) — não entra
// aqui. EXCEÇÃO DE DONO (Atlas, M3-F4): este tipo nasceu por instrução do Atlas porque `render/` precisava dele
// antes do catálogo `data/temas.ts` do Cronos existir; quando ele chegar, confirmar que bate com esta forma.
export interface DefTema {
  readonly id: IdTema;
  readonly cores: {
    readonly ceu: readonly [topo: string, horizonte: string];
    readonly montanhaDistante: string;
    readonly montanhaMedia: string;
    readonly silhueta: string;
    readonly neveLuz: string;
    readonly neveSombra: string;
    readonly destaque: string;
  };
  readonly clima: 'neve-fofa' | 'confeito' | 'neve-noturna' | 'vapor' | 'vento-aurora';
  readonly musica: IdMusica;
}

// --- M3: objetivos ---

/**
 * Nomes dos campos numéricos de `ResumoDescida` (plano M3 §B.4, `descida/resumo.ts`, ainda não escrito na F0).
 * Vive aqui (e não como `Exclude<keyof ResumoDescida, 'concluiu'>`) porque `core/` não pode importar de `descida/`
 * (plano §3.1, sem ciclo entre camadas). Quando `descida/resumo.ts` nascer na F5, `ResumoDescida` precisa ter
 * exatamente estes campos numéricos — e só eles — para as duas listas não divergirem.
 */
export const CAMPOS_RESUMO_DESCIDA = [
  'pontos',
  'ticks',
  'tombos',
  'maiorVoltasNumSalto',
  'maiorTicksNoAr',
  'maiorGrindTicks',
  'pousosPerfeitos',
  'maiorMult',
  'maiorComboManobras',
  'bonecos',
] as const;
export type CampoResumoDescida = (typeof CAMPOS_RESUMO_DESCIDA)[number];

/** Condição de objetivo (plano M3 §B.4), avaliada sobre um `ResumoDescida` (redutor puro, ainda sem F5). */
export type CondicaoObjetivo =
  | { readonly tipo: 'concluir' }
  | { readonly tipo: 'minimo'; readonly campo: CampoResumoDescida; readonly valor: number }
  | { readonly tipo: 'maximo'; readonly campo: CampoResumoDescida; readonly valor: number }
  | { readonly tipo: 'todos'; readonly condicoes: readonly CondicaoObjetivo[] };

/** 3 por pista (plano §1), id `<pista>-o1..o3` (já reservados em `REGRAS_SAVE.objetivos`). */
export interface DefObjetivo {
  readonly id: IdObjetivo;
  readonly pista: IdPista;
  readonly texto: string;
  readonly condicao: CondicaoObjetivo;
}

// --- C6: replay ---

export interface ResultadoReplay {
  readonly pontos: number;
  readonly ticks: number;
  /** Hash do estado final do motor (16 hex). O servidor de um ranking futuro reexecuta e só aceita se bater. */
  readonly hashFinal: string;
}

export interface ReplayV1 {
  readonly v: 1;
  readonly pista: IdPista;
  readonly hashPista: string;
  readonly semente: number;
  readonly personagem: IdPersonagem;
  readonly versaoMotor: string;
  /** Comandos em RLE + base64. Formato em `replay.ts` (`codificarComandos`/`decodificarComandos`). */
  readonly comandos: string;
  readonly resultado: ResultadoReplay;
}
