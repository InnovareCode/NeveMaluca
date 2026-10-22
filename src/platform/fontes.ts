/**
 * Origem: copiado do InnoFighters (src/platform/fontes.ts) em 2026-10-22. As faces são as mesmas (direção de arte do Neve Maluca, §4).
 */
/**
 * Carga das fontes do jogo antes do 1º quadro. O canvas NÃO espera a fonte: se ela ainda não chegou, o `fillText` usa a de reserva e o
 * texto "pisca" quando a verdadeira entra. Por isso o jogo pede cada face por `document.fonts.load` e só abre a 1ª cena depois (com um teto
 * de tempo: sem a fonte o jogo abre com a reserva, nunca fica preso na tela preta).
 */

/** As faces usadas (a mesma lista de src/platform/fontes.css). O texto de amostra tem os acentos do português. */
export const FACES_DO_JOGO: readonly string[] = ['italic 800 20px "Barlow Condensed"', '600 20px "Barlow"', '400 24px "Bangers"'];
const AMOSTRA = 'ÃÕÇÁÉÍÓÚÂÊÔÀaeiou•¡¿';

/** Teto de espera pelas fontes (ms): em rede ruim o jogo abre com a fonte de reserva em vez de esperar para sempre. */
export const ESPERA_MAXIMA_DAS_FONTES_MS = 4000;

export interface ConjuntoDeFontes {
  load(fonte: string, texto?: string): Promise<unknown>;
}

/** Resolve `true` se TODAS as faces carregaram dentro do teto; `false` se falhou ou estourou o tempo (nunca rejeita). */
export async function carregarFontes(
  fontes: ConjuntoDeFontes | undefined = typeof document === 'undefined' ? undefined : document.fonts,
  faces: readonly string[] = FACES_DO_JOGO,
  tetoMs: number = ESPERA_MAXIMA_DAS_FONTES_MS,
): Promise<boolean> {
  if (!fontes) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const teto = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), tetoMs);
  });
  const carga = Promise.all(faces.map((f) => fontes.load(f, AMOSTRA))).then(
    () => true as const,
    () => false as const,
  );
  const ok = await Promise.race([carga, teto]);
  if (timer !== undefined) clearTimeout(timer);
  return ok;
}
