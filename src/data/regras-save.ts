/**
 * Catálogo PROVISÓRIO de ids para o salvamento C4 (`meta/storage.ts`): quem são os personagens, as pistas e os objetivos que
 * este build conhece, e o que já nasce liberado. Sem isto o `carregarSave` mandaria todo id real para `prog.desconhecidos`.
 *
 * Provisório de verdade: os ids vêm de `docs/direcao-arte-neve-maluca.md` (§2 pistas, §3 elenco) e do plano (3 objetivos por pista);
 * a escolha final do elenco é do dono (D3) e o Cronos troca esta tabela pelos `DefPersonagem`/`DefPista`/`DefObjetivo` reais no M1.
 * Mudar um id DEPOIS de haver save gravado manda o id antigo para `desconhecidos` (não se perde, mas some da UI): renomear só antes
 * de qualquer jogador ter progresso.
 *
 * Camadas: `data/` só importa `core/`. O tipo `RegrasSave` mora em `meta/` (que importa `data/`), então aqui a forma é declarada
 * por estrutura (`RegrasDoCatalogo`); `tests/unit/integracao-m0.test.ts` prova que ela é atribuível ao `RegrasSave` do `meta/`.
 * Valida no import (`exigirRegrasSaveValidas`): id fora da `FORMA_ID`, repetido ou inicial que não existe derruba o boot.
 *
 * `validarReplay` (gancho do fantasma C6, `meta/storage.ts` → `sanearFantasmas`/`inserirFantasma`) mora aqui porque é a
 * única regra que precisa de `core/` além de `FORMA_ID`: `data/` pode importar `core/` (a proibição de ciclo é só na
 * direção contrária), e `meta/` não pode importar `core/replay` direto sem quebrar "catálogo de ids entra por parâmetro".
 */
import { FORMA_ID } from '../core/constantes';
import { ErroDeContrato } from '../core/erros';
import { validarReplayV1 } from '../core/replay';

/** Forma das regras que o `meta/` espera (cópia estrutural de `RegrasSave`, incluindo o gancho `validarReplay`). */
export interface RegrasDoCatalogo {
  readonly personagens: readonly string[];
  readonly iniciais: readonly string[];
  readonly pistas: readonly string[];
  readonly pistasIniciais: readonly string[];
  readonly objetivos: readonly string[];
  readonly versaoPista: Readonly<Record<string, string>>;
  /** Replay C6 válido (forma, limites, comandos decodificáveis) — ver `core/replay.ts`. */
  readonly validarReplay: (replay: unknown) => boolean;
}

/** Elenco final (dono, elenco-m3): capivara, tamanduá, avó, o tio, o quero-quero e a Bia. A capivara é a mascote do M1. */
export const PERSONAGENS_PROVISORIOS = ['capi', 'bandeira', 'cidinha', 'beto', 'queque', 'bia'] as const;
/** Liberados de fábrica: só a mascote. Implícitos: nunca entram no save. */
export const PERSONAGENS_INICIAIS = ['capi'] as const;

/** As 5 pistas do plano (M3), na ordem de progressão (direção de arte §2). */
export const PISTAS_PROVISORIAS = ['morro-do-pinhao', 'pico-do-picole', 'vila-chocolate', 'vulcao-pe-gelado', 'cume-da-ventania'] as const;
/** Pista inicial: o tutorial. */
export const PISTAS_INICIAIS = ['morro-do-pinhao'] as const;

/** Plano §1: 3 objetivos curtos por pista. Id = `<pista>-o1..o3` (o texto de cada um nasce com o Cronos no M1). */
export const OBJETIVOS_POR_PISTA = 3;
export const OBJETIVOS_PROVISORIOS: readonly string[] = PISTAS_PROVISORIAS.flatMap((pista) =>
  Array.from({ length: OBJETIVOS_POR_PISTA }, (_, i) => `${pista}-o${i + 1}`),
);

/**
 * Versão atual do gerador de cada pista (`PistaGerada.versaoGerador`). O gerador só nasce no M1: até lá todas valem "provisoria".
 */
export const VERSAO_PROVISORIA_DA_PISTA = 'provisoria';
/**
 * Física que gravou o recorde. Entra na versão comparada pelo `meta/` porque um tempo feito com outra física não compete
 * (ex.: o pulo mais forte do `VERSAO_MOTOR` '3'): recorde de física antiga vai para `recordesAntigos`, não some.
 * TEM que ser `f` + `VERSAO_MOTOR` (`descida/constantes.ts`; `data/` não importa `descida/`) — teste em `integracao-m0`.
 */
export const VERSAO_FISICA_DOS_RECORDES = 'f3';
export const VERSAO_DAS_PISTAS: Readonly<Record<string, string>> = Object.fromEntries(
  PISTAS_PROVISORIAS.map((p) => [p, `${VERSAO_PROVISORIA_DA_PISTA}.${VERSAO_FISICA_DOS_RECORDES}`]),
);

export const REGRAS_SAVE: RegrasDoCatalogo = {
  personagens: PERSONAGENS_PROVISORIOS,
  iniciais: PERSONAGENS_INICIAIS,
  pistas: PISTAS_PROVISORIAS,
  pistasIniciais: PISTAS_INICIAIS,
  objetivos: OBJETIVOS_PROVISORIOS,
  versaoPista: VERSAO_DAS_PISTAS,
  validarReplay: (replay) => validarReplayV1(replay).ok,
};

function problemasDeLista(rotulo: string, ids: readonly string[]): string[] {
  const p: string[] = [];
  const vistos = new Set<string>();
  for (const id of ids) {
    if (!FORMA_ID.test(id)) p.push(`${rotulo}: id "${id}" fora da forma de id`);
    if (vistos.has(id)) p.push(`${rotulo}: id "${id}" repetido`);
    vistos.add(id);
  }
  return p;
}

/** Lista o que está errado nas regras (vazia = tudo certo). Pura: não lança. */
export function problemasDasRegrasSave(regras: RegrasDoCatalogo): string[] {
  const p: string[] = [
    ...problemasDeLista('personagens', regras.personagens),
    ...problemasDeLista('iniciais', regras.iniciais),
    ...problemasDeLista('pistas', regras.pistas),
    ...problemasDeLista('pistasIniciais', regras.pistasIniciais),
    ...problemasDeLista('objetivos', regras.objetivos),
  ];
  for (const id of regras.iniciais) if (!regras.personagens.includes(id)) p.push(`iniciais: "${id}" não está em personagens`);
  for (const id of regras.pistasIniciais) if (!regras.pistas.includes(id)) p.push(`pistasIniciais: "${id}" não está em pistas`);
  if (regras.iniciais.length === 0) p.push('iniciais: o jogo precisa de ao menos um personagem liberado');
  if (regras.pistasIniciais.length === 0) p.push('pistasIniciais: o jogo precisa de ao menos uma pista liberada');
  for (const id of Object.keys(regras.versaoPista)) {
    if (!regras.pistas.includes(id)) p.push(`versaoPista: "${id}" não está em pistas`);
    const v = regras.versaoPista[id];
    if (typeof v !== 'string' || v.length < 1 || v.length > 32) p.push(`versaoPista: versão de "${id}" precisa ter 1 a 32 caracteres`);
  }
  for (const id of regras.pistas) if (!Object.hasOwn(regras.versaoPista, id)) p.push(`versaoPista: falta a versão de "${id}"`);
  return p;
}

/** Lança `ErroDeContrato` se as regras estiverem erradas (boot com tela de erro clara, nunca um catálogo meio quebrado). */
export function exigirRegrasSaveValidas(regras: RegrasDoCatalogo = REGRAS_SAVE): void {
  const problemas = problemasDasRegrasSave(regras);
  if (problemas.length > 0) throw new ErroDeContrato('contrato-invalido', 'regras do save inválidas', problemas);
}

exigirRegrasSaveValidas();
