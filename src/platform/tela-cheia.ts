/**
 * Origem: copiado do InnoFighters (src/platform/tela-cheia.ts) em 2026-10-22, sem mudança de comportamento (texto do jogo trocado nos cartões, que vivem em tela-cheia-ui.ts).
 * Lição do aparelho real do dono (iPhone com Chrome): o WebKit do iOS NAO tem Fullscreen API em elementos; ver COMO ATIVAR em tela-cheia-ui.ts.
 */
import { travarPaisagem } from './orientacao';

/**
 * Tela cheia (tecla F e linha das Opções).
 *
 * Por que isto virou mais que três linhas (relato do dono, aparelho real): a Fullscreen API NÃO existe no iPhone — nem no
 * Safari nem no Chrome do iOS (todo navegador do iOS usa o WebKit, que só põe `<video>` em tela cheia). Ali o toque não
 * faz nada e a linha das Opções parecia morta. Agora a plataforma é DETECTADA (`situacaoDaTelaCheia`) e a UI explica o
 * caminho que existe (Compartilhar > Adicionar à Tela de Início, que abre o jogo sem barras: meta apple-mobile-web-app-capable
 * + manifest em index.html). No Android o pedido precisa vir de um gesto "de ativação" do navegador; o toque do jogo age no
 * `touchstart`, que em alguns navegadores NÃO conta como gesto: o pedido recusado é refeito no `touchend` seguinte.
 */

/** Onde o jogo está, do ponto de vista da tela cheia. */
export type SituacaoTelaCheia =
  /** A API existe: a linha liga e desliga. */
  | 'disponivel'
  /** A API existe mas a página não pode usá-la (ex.: dentro de um iframe sem `allow="fullscreen"`). */
  | 'bloqueada'
  /** Sem API, mas o jogo já roda como app instalado (iOS "tela de início"): já está sem barras. */
  | 'instalado'
  /** Sem API num aparelho iOS (iPhone/iPad), em qualquer navegador: só pela tela de início. */
  | 'ios'
  /** Sem API em outro lugar (navegador embutido de aplicativo, WebView antigo...). */
  | 'indisponivel';

export type ResultadoTelaCheia = 'entrou' | 'saiu' | 'adiado' | 'negada' | 'sem-api';

/** O que da `Window` interessa (permite testar em Node com um objeto falso). */
export type AlvoTelaCheia = Pick<Window, 'document' | 'navigator'> & {
  matchMedia?: Window['matchMedia'];
  screen?: Window['screen'];
  setTimeout?: Window['setTimeout'];
  clearTimeout?: Window['clearTimeout'];
};

interface ElementoComPrefixo {
  requestFullscreen?: (opcoes?: FullscreenOptions) => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface DocumentoComPrefixo {
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  exitFullscreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void> | void;
}

const comPrefixo = (doc: Document): Document & DocumentoComPrefixo => doc as Document & DocumentoComPrefixo;

export function emTelaCheia(doc: Document = document): boolean {
  const d = comPrefixo(doc);
  return (d.fullscreenElement ?? d.webkitFullscreenElement ?? null) !== null;
}

function temApi(doc: Document): boolean {
  const el = doc.documentElement as unknown as ElementoComPrefixo | null;
  return !!el && (typeof el.requestFullscreen === 'function' || typeof el.webkitRequestFullscreen === 'function');
}

/** iPhone, iPod ou iPad (o iPadOS 13+ se apresenta como Mac, mas é o que tem toque). */
export function ehAparelhoIOS(alvo: Pick<Window, 'navigator'> = window): boolean {
  const n = alvo.navigator;
  if (/iPhone|iPod|iPad/.test(n.userAgent)) return true;
  return n.platform === 'MacIntel' && n.maxTouchPoints > 1;
}

/** O jogo foi aberto pelo ícone da tela de início (sem barras do navegador)? */
export function rodandoComoApp(alvo: AlvoTelaCheia = window): boolean {
  if ((alvo.navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  return alvo.matchMedia?.('(display-mode: standalone)').matches === true;
}

export function situacaoDaTelaCheia(alvo: AlvoTelaCheia = window): SituacaoTelaCheia {
  const doc = comPrefixo(alvo.document);
  if (temApi(alvo.document)) {
    const habilitada = doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled;
    return habilitada === false ? 'bloqueada' : 'disponivel';
  }
  if (rodandoComoApp(alvo)) return 'instalado';
  return ehAparelhoIOS(alvo) ? 'ios' : 'indisponivel';
}

// ---------------------------------------------------------------------------------------------------------------------------------
// o pedido
// ---------------------------------------------------------------------------------------------------------------------------------

let ultimo: { readonly resultado: ResultadoTelaCheia; readonly em: number } | null = null;
let pendente = false;
const comOuvinteDeMudanca = new WeakSet<Document>();

/** O último resultado de um pedido e quando saiu (ms de `Date.now`), para a UI mostrar "negada" por alguns segundos. */
export function ultimoResultadoTelaCheia(): { readonly resultado: ResultadoTelaCheia; readonly em: number } | null {
  return ultimo;
}

const anotar = (resultado: ResultadoTelaCheia): ResultadoTelaCheia => {
  ultimo = { resultado, em: Date.now() };
  return resultado;
};

const temToque = (alvo: AlvoTelaCheia): boolean => alvo.navigator.maxTouchPoints > 0 || 'ontouchstart' in alvo;

async function pedirAoNavegador(doc: Document): Promise<void> {
  const el = doc.documentElement as unknown as ElementoComPrefixo;
  if (typeof el.requestFullscreen === 'function') await el.requestFullscreen();
  else if (typeof el.webkitRequestFullscreen === 'function') await el.webkitRequestFullscreen();
  else throw new Error('sem API');
}

/**
 * Fica de olho no próximo gesto que o navegador reconhece (fim do toque, clique, tecla). Começa a ouvir AGORA (antes da
 * resposta do pedido): a recusa chega depois do tick e o toque pode já ter terminado. `veio` resolve true se algum gesto passou
 * dentro de `ms`; `parar` encerra a escuta (pedido que deu certo).
 */
function observarGesto(alvo: AlvoTelaCheia, ms: number): { readonly veio: Promise<boolean>; readonly parar: () => void } {
  const eventos = ['touchend', 'pointerup', 'mouseup', 'click', 'keydown'] as const;
  const agendar = alvo.setTimeout ?? setTimeout;
  const cancelar = alvo.clearTimeout ?? clearTimeout;
  const doc = alvo.document;
  let fim: (veio: boolean) => void = () => undefined;
  const veio = new Promise<boolean>((resolver) => {
    let feito = false;
    const ouvinte = (): void => fim(true);
    const prazo = agendar(() => fim(false), ms);
    fim = (ok) => {
      if (feito) return;
      feito = true;
      for (const e of eventos) doc.removeEventListener(e, ouvinte, true);
      cancelar(prazo);
      resolver(ok);
    };
    for (const e of eventos) doc.addEventListener(e, ouvinte, true);
  });
  return { veio, parar: () => fim(false) };
}

/** Ao entrar, trava em paisagem (celular); ao sair da tela cheia, destrava. Melhor esforço. */
function acompanharMudanca(alvo: AlvoTelaCheia): void {
  const doc = alvo.document;
  if (comOuvinteDeMudanca.has(doc)) return;
  comOuvinteDeMudanca.add(doc);
  const aoMudar = (): void => {
    if (emTelaCheia(doc)) {
      if (temToque(alvo)) void travarPaisagem(alvo as unknown as Window);
    } else {
      try {
        alvo.screen?.orientation?.unlock?.();
      } catch {
        /* ignorado */
      }
    }
  };
  doc.addEventListener('fullscreenchange', aoMudar);
  doc.addEventListener('webkitfullscreenchange', aoMudar);
}

/**
 * Entra ou sai da tela cheia. Nunca lança. Devolve o que aconteceu:
 * 'entrou' | 'saiu' | 'sem-api' (iPhone etc.: a UI explica) | 'negada' (o navegador recusou) | 'adiado' (outro pedido em andamento).
 */
export async function alternarTelaCheia(alvo: AlvoTelaCheia = window): Promise<ResultadoTelaCheia> {
  const doc = comPrefixo(alvo.document);
  try {
    if (emTelaCheia(alvo.document)) {
      if (typeof doc.exitFullscreen === 'function') await doc.exitFullscreen();
      else if (typeof doc.webkitExitFullscreen === 'function') await doc.webkitExitFullscreen();
      return anotar('saiu');
    }
    if (!temApi(alvo.document)) return anotar('sem-api');
    if (pendente) return 'adiado';
    acompanharMudanca(alvo);
    const gesto = temToque(alvo) ? observarGesto(alvo, 1500) : null;
    try {
      await pedirAoNavegador(alvo.document);
      gesto?.parar();
      return anotar('entrou');
    } catch {
      // recusado: no toque o `touchstart` pode não valer como gesto; tenta de novo quando o toque terminar (uma vez, sem esperar para sempre)
      if (!gesto) return anotar('negada');
      pendente = true;
      try {
        if (!(await gesto.veio)) return anotar('negada');
        await pedirAoNavegador(alvo.document);
        return anotar('entrou');
      } finally {
        pendente = false;
      }
    }
  } catch {
    return anotar('negada');
  }
}
