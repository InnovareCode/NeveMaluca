/**
 * Origem: copiado do InnoFighters (src/platform/aviso.ts) em 2026-10-22, sem mudança de comportamento.
 */
/**
 * Aviso discreto e NÃO bloqueante, sobre o jogo (ex.: "progresso não salvo"). Um `<div id="aviso" role="status">`
 * fixo no HTML, sem captura de ponteiro (nunca atrapalha toque/mouse), que some sozinho. Repetir o aviso enquanto
 * ele está visível só renova o prazo (não pisca nem empilha).
 */

/** O mínimo de um elemento DOM que usamos; permite testar em Node com um objeto falso. */
export interface ElementoAviso {
  textContent: string | null;
  hidden: boolean | string;
}

export interface OpcoesAviso {
  /** Quanto tempo o aviso fica na tela, em ms. Padrão: 6000. */
  readonly duracaoMs?: number;
  /** Injetáveis nos testes (padrão: os globais). */
  readonly agendar?: (fn: () => void, ms: number) => unknown;
  readonly cancelar?: (id: unknown) => void;
}

export const DURACAO_AVISO_MS = 6000;

/** Devolve `mostrar(mensagem)`. Com `elemento` nulo (HTML sem o aviso) vira um no-op. */
export function criarAviso(elemento: ElementoAviso | null, opcoes: OpcoesAviso = {}): (mensagem: string) => void {
  const duracao = opcoes.duracaoMs ?? DURACAO_AVISO_MS;
  const agendar = opcoes.agendar ?? ((fn: () => void, ms: number): unknown => setTimeout(fn, ms));
  const cancelar = opcoes.cancelar ?? ((id: unknown): void => clearTimeout(id as ReturnType<typeof setTimeout>));
  let prazo: unknown = null;
  return (mensagem) => {
    if (!elemento) return;
    if (prazo !== null) cancelar(prazo);
    if (elemento.textContent !== mensagem) elemento.textContent = mensagem;
    elemento.hidden = false;
    prazo = agendar(() => {
      prazo = null;
      elemento.hidden = true;
      elemento.textContent = '';
    }, duracao);
  };
}
