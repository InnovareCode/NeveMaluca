/**
 * Origem: adaptado de src/platform/erros.ts do InnoFighters (2026-10-22). Mostra erros de JavaScript numa caixa sobre o jogo
 * (`<pre id="err" hidden>` do index.html): no celular não há console. A convenção `#err` é do Vulcano (M0) e os e2e dependem dela.
 * Usa o atributo `hidden` (a CSP do build não deixa `style="..."` no HTML; `hidden` é atributo, não estilo).
 */

/** Acrescenta uma linha à caixa de erro e a mostra. Sem a caixa no HTML, não faz nada. */
export function mostrarErro(mensagem: string, doc: Document = document): void {
  const caixa = doc.getElementById('err');
  if (!caixa) return;
  caixa.textContent = `${caixa.textContent ?? ''}${caixa.textContent ? '\n' : ''}${mensagem}`;
  caixa.hidden = false;
}

/**
 * Texto de um erro para a caixa. A `stack` do V8 (Chrome) começa por "Nome: mensagem"; a do WebKit/JavaScriptCore (iPhone) traz só os
 * quadros de função, sem a mensagem. Por isso o texto é sempre `Nome: mensagem` e a pilha entra depois, se ainda não contém a mensagem.
 */
export function textoDoErro(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const cabecalho = `${e.name}: ${e.message}`;
  const pilha = e.stack;
  if (!pilha) return cabecalho;
  return pilha.includes(e.message) ? pilha : `${cabecalho}\n${pilha}`;
}

/** Liga `error` e `unhandledrejection` da janela à caixa. Devolve a função que desfaz. */
export function mostrarErrosNaTela(alvo: Window = window): () => void {
  const aoErro = (e: ErrorEvent): void => mostrarErro(`Erro: ${e.message} (linha ${e.lineno})`, alvo.document);
  const aoRejeitar = (e: PromiseRejectionEvent): void => mostrarErro(`Promessa rejeitada: ${textoDoErro(e.reason)}`, alvo.document);
  alvo.addEventListener('error', aoErro);
  alvo.addEventListener('unhandledrejection', aoRejeitar);
  return () => {
    alvo.removeEventListener('error', aoErro);
    alvo.removeEventListener('unhandledrejection', aoRejeitar);
  };
}
