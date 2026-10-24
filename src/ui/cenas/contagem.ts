/**
 * Contagem "3-2-1-JÁ" (plano "corrida em campeonato" §C1), compartilhada por `descida.ts` e `corrida.ts` (§C2b):
 * ~0,83 s por número + ~0,5 s no "JÁ!", contada em ticks PRÓPRIOS da cena -- nunca chama `entrada.obterComando()`/
 * `motor.processar()`/`corrida.processar()` nesta janela, então não entra tick nenhum no replay/resultado antes
 * da corrida de fato começar.
 */

export const TICKS_POR_NUMERO = 50;
export const TICKS_JA = 30;
export const TICKS_CONTAGEM = TICKS_POR_NUMERO * 3 + TICKS_JA;

/** Texto e "pulso" (0=acabou de trocar, perto de 1=tamanho de repouso) da contagem em `t` ticks (fração incluída, p/ interpolar). */
export function textoDaContagem(t: number): { texto: string; pulso: number } {
  if (t < TICKS_POR_NUMERO) return { texto: '3', pulso: t / TICKS_POR_NUMERO };
  if (t < TICKS_POR_NUMERO * 2) return { texto: '2', pulso: (t - TICKS_POR_NUMERO) / TICKS_POR_NUMERO };
  if (t < TICKS_POR_NUMERO * 3) return { texto: '1', pulso: (t - TICKS_POR_NUMERO * 2) / TICKS_POR_NUMERO };
  return { texto: 'JÁ!', pulso: (t - TICKS_POR_NUMERO * 3) / TICKS_JA };
}
