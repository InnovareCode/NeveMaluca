/**
 * Botão e cartão de tela cheia em DOM (acessíveis por teclado, leitor de tela e toque). Usa `tela-cheia.ts` (copiado do InnoFighters).
 *
 * Por que existe o cartão (relato do dono, aparelho real: iPhone com Chrome): o WebKit do iOS, em QUALQUER navegador, não tem a Fullscreen
 * API para elementos. O toque "não fazia nada". Aqui a plataforma é DETECTADA e o botão vira "COMO ATIVAR", que abre um cartão com o
 * caminho que existe: Compartilhar > Adicionar à Tela de Início (o jogo abre sem barras: metas apple-mobile-web-app-* e manifest do
 * index.html). Aberto pelo ícone, ele já está em tela cheia ('instalado'): o botão some.
 *
 * Sem `<style>`/`style=""`: o visual está em plataforma.css; aqui só classes, `hidden` e atributos.
 */
import { alternarTelaCheia, emTelaCheia, situacaoDaTelaCheia, type AlvoTelaCheia, type SituacaoTelaCheia } from './tela-cheia';

export interface CartaoDeAjuda {
  readonly titulo: string;
  /** Primeiro parágrafo (o porquê). */
  readonly intro: string;
  /** Passos numerados (podem faltar). */
  readonly passos: readonly string[];
}

export const CARTAO_IOS: CartaoDeAjuda = {
  titulo: 'TELA CHEIA NO IPHONE / IPAD',
  intro: 'O iPhone não deixa um site ocupar a tela toda pelo navegador (vale para o Safari e para o Chrome).',
  passos: ['Toque no botão Compartilhar do navegador.', 'Escolha "Adicionar à Tela de Início".', 'Abra o Neve Maluca pelo novo ícone: ele abre sem as barras.'],
};

const CARTOES: Readonly<Record<'ios' | 'bloqueada' | 'indisponivel', CartaoDeAjuda>> = {
  ios: CARTAO_IOS,
  bloqueada: {
    titulo: 'TELA CHEIA BLOQUEADA',
    intro: 'Esta página está dentro de outra página e o navegador não deixa pedir tela cheia aqui.',
    passos: ['Abra o jogo direto pelo endereço dele, numa aba própria.'],
  },
  indisponivel: {
    titulo: 'TELA CHEIA INDISPONÍVEL',
    intro: 'Este navegador não oferece tela cheia para sites (comum em navegadores que vivem dentro de outros aplicativos).',
    passos: ['Abra o endereço do jogo no Chrome ou no Safari.'],
  },
};

export const AVISO_NEGADA = 'O navegador recusou a tela cheia desta vez. Toque de novo.';

const ICONE_ENTRAR = 'M3 9V3h6M15 3h6v6M21 15v6h-6M9 21H3v-6';
const ICONE_SAIR = 'M9 3v6H3M21 9h-6V3M15 21v-6h6M3 15h6v6';
const NS_SVG = 'http://www.w3.org/2000/svg';

export interface AlvoTelaCheiaUi extends AlvoTelaCheia {
  addEventListener: Window['addEventListener'];
  removeEventListener: Window['removeEventListener'];
}

export interface OpcoesTelaCheiaUi {
  readonly alvo?: AlvoTelaCheiaUi;
  /** Aviso discreto (platform/aviso.ts) para o "navegador recusou". */
  readonly avisar?: (mensagem: string) => void;
}

export interface TelaCheiaUi {
  /** Mostra ou esconde o botão (a UI esconde durante a descida). Escondido por situação ('instalado') continua escondido. */
  definirVisivel(visivel: boolean): void;
  /** Reavalia a situação e o texto (chamado sozinho quando a tela cheia muda). */
  atualizar(): void;
  fecharCartao(): void;
  destruir(): void;
}

function criarIcone(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(NS_SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.appendChild(doc.createElementNS(NS_SVG, 'path'));
  return svg;
}

export function montarTelaCheia(opcoes: OpcoesTelaCheiaUi = {}): TelaCheiaUi {
  const alvo: AlvoTelaCheiaUi = opcoes.alvo ?? (window as unknown as AlvoTelaCheiaUi);
  const doc = alvo.document;
  const avisar = opcoes.avisar ?? ((): void => undefined);
  let visivel = true;
  let situacao: SituacaoTelaCheia = situacaoDaTelaCheia(alvo);
  let abriuDe: HTMLElement | null = null;

  // ---- botão ----
  const botao = doc.createElement('button');
  botao.id = 'btn-tela-cheia';
  botao.type = 'button';
  const icone = criarIcone(doc);
  const rotulo = doc.createElement('span');
  rotulo.className = 'rotulo';
  botao.append(icone, rotulo);

  // ---- cartão ----
  const fundo = doc.createElement('div');
  fundo.id = 'cartao-tela-cheia';
  fundo.className = 'cartao-fundo';
  fundo.hidden = true;
  const cartao = doc.createElement('div');
  cartao.className = 'cartao';
  cartao.setAttribute('role', 'dialog');
  cartao.setAttribute('aria-modal', 'true');
  cartao.setAttribute('aria-labelledby', 'cartao-tela-cheia-titulo');
  const titulo = doc.createElement('h2');
  titulo.id = 'cartao-tela-cheia-titulo';
  const intro = doc.createElement('p');
  const passos = doc.createElement('ol');
  const fechar = doc.createElement('button');
  fechar.type = 'button';
  fechar.textContent = 'Entendi';
  cartao.append(titulo, intro, passos, fechar);
  fundo.appendChild(cartao);

  const cartaoDaSituacao = (): CartaoDeAjuda | null => (situacao === 'ios' || situacao === 'bloqueada' || situacao === 'indisponivel' ? CARTOES[situacao] : null);

  function atualizar(): void {
    situacao = situacaoDaTelaCheia(alvo);
    const cheia = emTelaCheia(doc);
    const escondido = !visivel || situacao === 'instalado';
    botao.hidden = escondido;
    const comoAtivar = situacao !== 'disponivel';
    botao.classList.toggle('com-rotulo', comoAtivar);
    rotulo.textContent = situacao === 'ios' ? 'COMO ATIVAR' : situacao === 'disponivel' ? '' : 'TELA CHEIA';
    const nome = situacao === 'disponivel' ? (cheia ? 'Sair da tela cheia' : 'Tela cheia') : situacao === 'ios' ? 'Tela cheia: como ativar' : 'Tela cheia: saiba mais';
    botao.setAttribute('aria-label', nome);
    botao.title = nome;
    icone.firstElementChild?.setAttribute('d', cheia ? ICONE_SAIR : ICONE_ENTRAR);
  }

  function abrirCartao(): void {
    const c = cartaoDaSituacao();
    if (!c) return;
    // Safari/WebKit não dá foco a um botão ao clicar nele (activeElement fica no <body>): nesse caso o foco volta ao botão
    const ativo = doc.activeElement as HTMLElement | null;
    abriuDe = ativo && ativo !== doc.body ? ativo : botao;
    titulo.textContent = c.titulo;
    intro.textContent = c.intro;
    passos.replaceChildren(
      ...c.passos.map((p) => {
        const li = doc.createElement('li');
        li.textContent = p;
        return li;
      }),
    );
    passos.hidden = c.passos.length === 0;
    fundo.hidden = false;
    fechar.focus();
  }

  function fecharCartao(): void {
    if (fundo.hidden) return;
    fundo.hidden = true;
    (abriuDe ?? botao).focus();
    abriuDe = null;
  }

  async function acionar(): Promise<void> {
    if (!fundo.hidden) return;
    situacao = situacaoDaTelaCheia(alvo);
    if (situacao === 'disponivel') {
      const r = await alternarTelaCheia(alvo);
      if (r === 'negada') avisar(AVISO_NEGADA);
      else if (r === 'sem-api') abrirCartao();
      atualizar();
      return;
    }
    abrirCartao();
  }

  const aoClicar = (): void => void acionar();
  const aoTeclar = (e: KeyboardEvent): void => {
    if (!fundo.hidden) {
      if (e.key === 'Escape') {
        e.preventDefault();
        fecharCartao();
      } else if (e.key === 'Tab') {
        e.preventDefault(); // único elemento focável do cartão: o foco fica nele
        fechar.focus();
      }
      return;
    }
    if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.repeat) {
      const alvoDoEvento = e.target as HTMLElement | null;
      if (alvoDoEvento?.closest('input, textarea, select, [contenteditable]')) return;
      if (situacao === 'instalado') return;
      void acionar();
    }
  };
  const aoClicarNoFundo = (e: Event): void => {
    if (e.target === fundo) fecharCartao();
  };

  botao.addEventListener('click', aoClicar);
  fechar.addEventListener('click', fecharCartao);
  fundo.addEventListener('click', aoClicarNoFundo);
  alvo.addEventListener('keydown', aoTeclar);
  doc.addEventListener('fullscreenchange', atualizar);
  doc.addEventListener('webkitfullscreenchange', atualizar);

  doc.body.append(botao, fundo);
  atualizar();

  return {
    definirVisivel(v) {
      visivel = v;
      atualizar();
    },
    atualizar,
    fecharCartao,
    destruir() {
      botao.removeEventListener('click', aoClicar);
      fechar.removeEventListener('click', fecharCartao);
      fundo.removeEventListener('click', aoClicarNoFundo);
      alvo.removeEventListener('keydown', aoTeclar);
      doc.removeEventListener('fullscreenchange', atualizar);
      doc.removeEventListener('webkitfullscreenchange', atualizar);
      botao.remove();
      fundo.remove();
    },
  };
}
