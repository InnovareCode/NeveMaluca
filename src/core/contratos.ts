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
  | { readonly tipo: 'chegada'; readonly pontos: number; readonly ticks: number }
  // C4 (obstáculo alto + agachar, plano corrida-campeonato §Reaproveita): aviso ~1,5s antes (render mostra "!"),
  // e o bônus de passar agachado rente a um deles (ver `descida/motor.ts`, topo do arquivo).
  | { readonly tipo: 'aviso-obstaculo'; readonly x: number }
  | { readonly tipo: 'obstaculo-rente'; readonly pontos: number }
  // Itens (plano itens-corrida §I1): corredor foi atingido por um `EfeitoExterno` negativo (trombada/freada) vindo
  // do orquestrador. SEPARADO de `'tombo'` de propósito — a trava anti-travamento da IA (`corrida/ia.ts`, I3) conta
  // quedas por `'tombo'`; um acerto de item NUNCA reseta pro checkpoint (plano I-D7), então nunca pode contar como
  // queda. Só os efeitos que você SOFRE emitem este evento (turbo/ima são buffs que você mesmo ativa — sem evento).
  | { readonly tipo: 'atingido'; readonly item: TipoItem };

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
  /** Obstáculo ALTO da camada de jogo (plano corrida-campeonato, C4): galho pendurado atravessando o caminho. Só
   *  `CamadaJogo.obstaculosAltos` usa este tipo (nunca `PistaGerada.objetos`, que é do gerador M1a/M1). Render sem
   *  sprite dedicado ainda cai no genérico (`Partial<Record<TipoObjeto,...>>`, nunca quebra por tipo desconhecido). */
  'galho',
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

/**
 * Resumo final de UMA descida (plano M3 §B.4; plano corrida-campeonato §Contratos, `ResultadoCorrida.resumoJogador`).
 * Vive aqui (não em `descida/`) pela mesma razão de `CAMPOS_RESUMO_DESCIDA`: `CondicaoObjetivo` (abaixo) e
 * `ResultadoCorrida` (fim do arquivo) precisam do tipo sem cruzar camada (`core/` não importa `descida/`).
 * `descida/resumo.ts` (redutor puro, ainda não escrito — M3 F5) e `corrida/` (C2a) produzem valores desta forma a
 * partir de uma `LeituraDescida`/`EventoDescida[]`; a forma em si já está fixada aqui, com os mesmos campos de
 * `CAMPOS_RESUMO_DESCIDA` e só eles (mais `concluiu`, que não é um dos campos numéricos do objetivo).
 */
export interface ResumoDescida extends Readonly<Record<CampoResumoDescida, number>> {
  readonly concluiu: boolean;
}

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

// --- Corrida em campeonato (plano `docs/plano-corrida-campeonato.md` §Contratos, C0) ---
// Tipos fixados aqui (sem lógica: isso é `corrida/`, camada nova, C2a) para Lyra/Cronos/Íris terem o contrato real
// desde já. `ModoDescida`/`criarDescida` mantêm o golden da Capi por construção: omitir `opcoes` (ou `modo`) chama
// o motor exatamente como antes (padrão sem camada, modo `'treino'`) — nenhum teste existente muda de resultado.

export const MODOS_DESCIDA = ['treino', 'corrida'] as const;
export type ModoDescida = (typeof MODOS_DESCIDA)[number];

// --- Itens na corrida (plano `docs/plano-itens-corrida.md` §Contratos, I0) ---
// Tipos fixados aqui (sem lógica: isso é I1 em diante) para Lyra/Cronos/Íris terem o contrato real desde já. Treino
// NUNCA tem itens (plano I-D8, recorde/fantasma comparáveis) — todo o resto deste bloco só é lido em `modo:'corrida'`.

/** `'escudo'` nunca é um `EfeitoExterno` (ele BLOQUEIA um, decisão do orquestrador, I2) — aparece aqui só como o
 *  item que o corredor pode estar carregando/usando. */
export const TIPOS_ITEM = ['bola', 'poca', 'nuvem', 'turbo', 'escudo', 'ima'] as const;
export type TipoItem = (typeof TIPOS_ITEM)[number];

/**
 * O que um item FAZ quando acerta/é usado (plano §Contratos): nunca entra no `ComandoDescida` (vem de fora, do
 * orquestrador `corrida/` — I2), por isso é `EXTERNO`. `item` viaja junto para o motor poder emitir
 * `EventoDescida{tipo:'atingido',item}` sabendo qual item foi. Convenção `Ms` = metros/segundo (mesma do resto do
 * motor, ex. `velocidadeMaxMs`): `turbo.ms` NÃO é milissegundos.
 *  - `trombada` (Bola de Neve / Nuvem de Granizo): corte de velocidade + controle travado + perde combo (I1).
 *  - `freada` (Poça de Calda): teto de velocidade reduzido a `fator` por `ticks` ticks (I1).
 *  - `turbo` (Chocolate Quente): soma `ms` à velocidade, reaproveitando EXATAMENTE a mesma calibragem do turbo de
 *    pouso (plano C-D7) — "1 calibragem só". `ticks` é informativo (duração de UI/som); o decaimento físico é
 *    sempre o mesmo do turbo de pouso.
 *  - `ima` (Ímã de Flocos): janela de `ticks` ticks puxando coletáveis próximos — a atração em si é lida pelo
 *    orquestrador sobre `CamadaJogo` (I2); o motor só guarda a janela ativa.
 */
export type EfeitoExterno =
  | { readonly tipo: 'trombada'; readonly item: TipoItem }
  | { readonly tipo: 'freada'; readonly item: TipoItem; readonly fator: number; readonly ticks: number }
  | { readonly tipo: 'turbo'; readonly item: TipoItem; readonly ms: number; readonly ticks: number }
  | { readonly tipo: 'ima'; readonly item: TipoItem; readonly raioM: number; readonly ticks: number };

/** Um por tick da CORRIDA (plano §Contratos): a descida continua 100% pelo `ComandoDescida`; `usarItem` é a borda
 *  separada do botão/tecla de item, resolvida pelo orquestrador (I2) — nunca pelo motor da descida direto. No
 *  replay (`ReplayV2.versaoItens`) ocupa o bit 7 de `comandos.ts` (hoje sempre 0/reservado) — ver comentário lá. */
export interface ComandoCorrida {
  readonly descida: ComandoDescida;
  /** Borda: true só no tick do aperto (mesma convenção de `ComandoDescida.pulo`). */
  readonly usarItem: boolean;
}

/** Coletável da camada de jogo (plano §Arquitetura, C3): círculo em `(x, y)` de raio `raio`, metros. `dourado` é
 *  mais raro (1 por pista) e fica fora da linha óbvia — ensina a explorar o arco de um kicker, não só seguir o chão. */
export interface ItemCamada {
  readonly tipo: 'floco' | 'dourado';
  readonly x: number;
  readonly y: number;
  readonly raio: number;
}

/** Zona de impulso extra no chão/trilho (plano §Arquitetura, C3): pular com `piloto.x` dentro de `[x, x+largura]`
 *  soma `impulsoMs` ao impulso normal do pulo (mesma fórmula de `fatorRampaMsPorGrau`), sem tocar a física de base —
 *  é inofensivo por omissão (sem `camada`/sem kicker ali, o pulo é exatamente o de sempre). */
export interface KickerCamada {
  readonly x: number;
  readonly largura: number;
  readonly impulsoMs: number;
}

/** Caixa de item na pista (plano itens-corrida §Contratos, I0): círculo em `(x, y)` de raio `raio`, 1 espaço por
 *  CORREDOR (plano I-D4/I-D5) — cada corredor pega cada caixa no máximo 1x; a lógica de sorteio/reaparecimento é
 *  de `corrida/itens.ts` (I2), não de `pista/camada-jogo.ts` (que só planta as posições, igual aos outros campos
 *  desta interface). */
export interface CaixaCamada {
  readonly x: number;
  readonly y: number;
  readonly raio: number;
}

/**
 * Camada de jogo por cima do terreno gerado (plano §Arquitetura, C3): coletáveis que ensinam a linha (chão -> arco
 * do kicker -> trilho), kickers que estendem o ar (torna o mortal alcançável sem mexer na física da Capi),
 * obstáculos altos (C4: só passa agachado — `pista/camada-jogo.ts`) e o pórtico (hoje só decorativo, mesma posição
 * que `render/chegada.ts` já desenha por conta própria em `pista.chegadaX`). `gerarPista` (M1a) NUNCA gera isto: é
 * sobreposição pura, produzida por `pista/camada-jogo.ts` (`gerarCamadaJogo`) a partir da `PistaGerada` já congelada
 * — o terreno em si (`alturas`/`objetos`/`trilhos`/hash) nunca muda. `motor.ts` só lê estes campos quando
 * `OpcoesDescida.camada` é passada: omitir (como todo chamador de treino faz) é, por construção, o comportamento de
 * sempre.
 */
export interface CamadaJogo {
  readonly itens: readonly ItemCamada[];
  readonly kickers: readonly KickerCamada[];
  /** C4: `tipo` sempre `'galho'` hoje (variantes visuais futuras não mudam a física). Só passa agachado. */
  readonly obstaculosAltos: readonly ObjetoPista[];
  /** Caixas de item (plano itens-corrida, I0): `[]` até `pista/camada-jogo.ts` ganhar o posicionamento real (I2). */
  readonly caixas: readonly CaixaCamada[];
  readonly porticoX: number;
  readonly versao: string;
  readonly hash: string;
}

/** 3º parâmetro de `criarDescida` (`descida/motor.ts`). Omitido (ou `{}`) => sem camada extra, modo `'treino'`. */
export interface OpcoesDescida {
  readonly camada?: CamadaJogo;
  readonly modo?: ModoDescida;
}

/** Quem pilota um corredor da corrida: o jogador (entrada ao vivo) ou uma IA (perfil do personagem + nível da pista). */
export type PilotoCorrida =
  | { readonly tipo: 'jogador' }
  | { readonly tipo: 'ia'; readonly perfil: IdPersonagem; readonly nivel: number };

/** Um corredor da corrida (plano §Contratos): a ficha do personagem (`config`) e quem o pilota. */
export interface ParticipanteCorrida {
  readonly id: IdPersonagem;
  readonly config: DefPersonagem;
  readonly piloto: PilotoCorrida;
}

/** Evento da CORRIDA (plano itens-corrida §Contratos, I0): o que o orquestrador (`corrida/`, I2) produz ao
 *  resolver caixas/projéteis/escudos — não confundir com `EventoDescida` (do motor de CADA corredor). `id`/`de`/`em`
 *  são sempre `IdPersonagem` do corredor envolvido. */
export type EventoCorrida =
  | { readonly tipo: 'item-pego'; readonly id: IdPersonagem; readonly item: TipoItem }
  | { readonly tipo: 'item-usado'; readonly id: IdPersonagem; readonly item: TipoItem }
  | { readonly tipo: 'acerto'; readonly de: IdPersonagem; readonly em: IdPersonagem; readonly item: TipoItem }
  | { readonly tipo: 'bloqueado'; readonly id: IdPersonagem; readonly item: TipoItem }
  | { readonly tipo: 'desviou'; readonly id: IdPersonagem; readonly item: TipoItem };

/** Projeção de UM rival na `LeituraCorrida` (plano C-D2: sem colisão, cada corredor é um motor independente).
 *  `item`/`escudo`/`atordoado` (plano itens-corrida, I0) são OPCIONAIS de propósito: `corrida/corrida.ts` ainda não
 *  os popula (isso é I2) — omitidos, o contrato de hoje (C-D2/C3/C4) não muda 1 bit. */
export interface LeituraRivalCorrida {
  readonly id: IdPersonagem;
  readonly piloto: PilotoCorrida;
  readonly fase: FaseDescida;
  readonly distancia: number;
  /** Item carregado agora, ou `null` com o slot vazio. */
  readonly item?: TipoItem | null;
  /** Bolha de Gelo ativa (absorve o próximo acerto). */
  readonly escudo?: boolean;
  /** Controle travado por uma trombada (reflete `atordoadoTicksRestantes > 0` do motor dele). */
  readonly atordoado?: boolean;
}

/** Leitura de UM tick da corrida inteira (plano §Contratos): o jogador em detalhe, os rivais resumidos.
 *  `itemJogador`/`roleta`/`entidades`/`alvoNoJogador`/`eventosCorrida` (plano itens-corrida, I0) são OPCIONAIS pela
 *  mesma razão de `LeituraRivalCorrida.item` acima: populá-los de verdade é I2, e omitidos preservam exatamente a
 *  `LeituraCorrida` de hoje (C2a/C3/C4). */
export interface LeituraCorrida {
  readonly tick: number;
  readonly jogador: LeituraDescida;
  readonly rivais: readonly LeituraRivalCorrida[];
  /** Do 1º ao último lugar NESTE tick (plano C-D1: critério de desempate só se aplica ao `ResultadoCorrida` final). */
  readonly posicoes: readonly IdPersonagem[];
  readonly chegadas: readonly { readonly id: IdPersonagem; readonly tick: number }[];
  /** Item do JOGADOR (slot único, plano I-D4), ou `null` com o slot vazio. */
  readonly itemJogador?: TipoItem | null;
  /** Roleta girando após pegar uma caixa (plano I-D5): `null` fora da janela de sorteio. */
  readonly roleta?: { readonly ticksRestantes: number; readonly resultado: TipoItem } | null;
  /** Projéteis/armadilhas/caixas visíveis neste tick, para o render desenhar sem reimplementar a física deles. */
  readonly entidades?: readonly { readonly id: string; readonly tipo: TipoItem | 'caixa'; readonly x: number; readonly y: number }[];
  /** O jogador é o alvo de uma Nuvem de Granizo com aviso ativo (plano I-D2: "casco azul", ~2s de aviso). */
  readonly alvoNoJogador?: boolean;
  readonly eventosCorrida?: readonly EventoCorrida[];
}

/** Resultado final de uma pista da corrida (plano §Contratos): pódio, duração de cada um e o que o jogador ganhou. */
export interface ResultadoCorrida {
  readonly pista: IdPista;
  /** Ordem de chegada (1º ao último); quem não chegou no teto de `corrida/` entra no fim, por distância. */
  readonly ordem: readonly IdPersonagem[];
  readonly ticks: Readonly<Record<IdPersonagem, number>>;
  readonly resumoJogador: ResumoDescida;
  readonly flocosGanhos: number;
  /** Itens do jogador na pista (plano itens-corrida, I0); opcional pela mesma razão de `LeituraCorrida` acima —
   *  populá-lo de verdade é I2 (`corrida/corrida.ts` ainda devolve `ResultadoCorrida` sem itens). */
  readonly itens?: { readonly acertosDados: number; readonly acertosSofridos: number };
}

// --- Campeonato e evolução (plano §Arquitetura: `meta/campeonato.ts` e `aplicarEvolucao`, C5a/C6, Cronos) ---
// Só os TIPOS do save aqui (plano C0): a lógica de pontuação/classificação/desempate (`meta/campeonato.ts`) e de
// upgrade (`aplicarEvolucao`) é do Cronos. `SaveV1` (`meta/tipos.ts`) ganha `campeonato?: EstadoCampeonato`,
// `trofeus?: readonly IdPersonagem[]` e `evolucao?: Evolucao` como campos ADITIVOS (mesmo padrão dos outros campos
// opcionais de `SaveV1`: ausente = sem campeonato em andamento / sem troféu / sem evolução, sem bump de versão).

/**
 * Uma pista já corrida dentro do campeonato em andamento (plano C-D1): a classificação é sempre DERIVADA daqui.
 * `ordem` guarda o PÓDIO COMPLETO (1º ao último, os até 6 ids) — não só a posição do jogador — porque
 * `meta/campeonato.ts` → `classificacao`/`situacao` precisam dos pontos de TODOS os rivais para funcionar depois
 * de um reload no meio do campeonato (sem o pódio completo, só o jogador teria pontos recalculáveis).
 */
export interface PistaConcluidaCampeonato {
  readonly pista: IdPista;
  /** Ordem de chegada completa desta pista (1º ao último); mesmo formato de `ResultadoCorrida.ordem`. */
  readonly ordem: readonly IdPersonagem[];
  /** Ticks do JOGADOR nesta pista (duração da descida dele). */
  readonly ticks: number;
}

/** Campeonato em andamento (plano §Arquitetura): semente fixa das 5 pistas, personagem escolhido, progresso. */
export interface EstadoCampeonato {
  readonly semente: number;
  readonly personagem: IdPersonagem;
  /** 0 = nenhuma pista corrida ainda; 5 = as 5 concluídas (campeonato decidido). */
  readonly etapa: 0 | 1 | 2 | 3 | 4 | 5;
  readonly pistasConcluidas: readonly PistaConcluidaCampeonato[];
}

/** Progresso de upgrade entre campeonatos (plano C-D3/C-D4): carteira única de flocos, nível por personagem. */
export interface Evolucao {
  readonly flocos: number;
  /** Ausente = nível 0 (identidade, plano C-D3: "no nível 0 é idêntico por construção"). */
  readonly niveis: Readonly<Partial<Record<IdPersonagem, number>>>;
}

/**
 * Replay C6 do modo corrida (plano §Arquitetura): mesma forma do `ReplayV1`, mais o modo, os níveis de evolução
 * ativos na hora da gravação e, se foi corrida (não treino), a semente e os rivais daquela corrida.
 */
export interface ReplayV2 extends Omit<ReplayV1, 'v'> {
  readonly v: 2;
  readonly modo: ModoDescida;
  readonly niveis: Readonly<Partial<Record<IdPersonagem, number>>>;
  readonly corrida?: {
    readonly semente: number;
    readonly rivais: readonly IdPersonagem[];
  };
  /**
   * Versão do formato de ITENS (plano itens-corrida §Contratos, I0): presente só em replays gravados com
   * `ComandoCorrida.usarItem` codificado no bit 7 de `comandos.ts` (hoje sempre 0/reservado — ver comentário lá).
   * AUSENTE = replay de antes dos itens (ou Treino, que nunca tem itens, I-D8): bit 7 é lixo-zero por construção,
   * decodifica exatamente como sempre decodificou. A codificação real (`corrida/itens.ts`) é I2, não I0/I1.
   */
  readonly versaoItens?: string;
}
