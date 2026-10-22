/**
 * Constantes oficiais do Neve Maluca (plano §3.2, §3.3, §4 e M0). Uma fonte só: `main.ts` provisório, `platform/`,
 * `render/` e `descida/` leem daqui. Mudar um número aqui muda o jogo inteiro; o teste `constantes.test.ts` guarda
 * as relações entre eles (buffer = lógico x escala, 60 Hz, 6 passos máximos por quadro).
 *
 * Origem do padrão: InnoFighters `src/core/constantes.ts` (LARGURA/ALTURA lógicas), adaptado em 2026-10-22.
 */

// --- Tela (plano M0: "960x540 lógico com buffer 2x") ---
/** Resolução LÓGICA: todo desenho e toda coordenada de tela usam este espaço. */
export const LARGURA_LOGICA = 960;
export const ALTURA_LOGICA = 540;
/** O canvas é criado com o dobro da resolução lógica (nitidez em tela retina); o desenho aplica esta escala. */
export const ESCALA_BUFFER = 2;
export const LARGURA_BUFFER = LARGURA_LOGICA * ESCALA_BUFFER; // 1920
export const ALTURA_BUFFER = ALTURA_LOGICA * ESCALA_BUFFER; // 1080
/** Nomes curtos, os mesmos do InnoFighters e da `platform/` (que re-exporta daqui): LARGURA/ALTURA lógicas e RS (escala do buffer). */
export const LARGURA = LARGURA_LOGICA;
export const ALTURA = ALTURA_LOGICA;
export const RS = ESCALA_BUFFER;
/** Razão de aspecto 16:9 que o CSS e o letterbox da `platform/` mantêm. */
export const PROPORCAO_TELA = LARGURA_LOGICA / ALTURA_LOGICA;

// --- Tempo (plano §3.2: passo fixo de 1000/60 ms, acumulador limitado a 100 ms) ---
export const TICKS_POR_SEGUNDO = 60;
export const PASSO_MS = 1000 / TICKS_POR_SEGUNDO;
export const PASSO_S = 1 / TICKS_POR_SEGUNDO;
/** Teto do acumulador: depois de aba parada o jogo NÃO salta; descarta o excesso (plano §3.2). */
export const ACUMULADOR_MAX_MS = 100;
/** Mesmo valor que `ACUMULADOR_MAX_MS`, no nome que a `platform/` já usa. */
export const ACUMULADOR_MAXIMO_MS = ACUMULADOR_MAX_MS;
/** Máximo de ticks por quadro de tela decorrente do teto acima: ceil(100 / 16,67) = 6. */
export const MAX_PASSOS_POR_QUADRO = Math.ceil(ACUMULADOR_MAX_MS / PASSO_MS);

// --- Mundo (plano §3.3/§3.4: unidades em metros e segundos, convertidas para pixels só no render) ---
/** Espaçamento das amostras de altura da pista (`PistaGerada.dx`), em metros. */
export const DX_PISTA_M = 0.5;
/**
 * Pixels LÓGICOS por metro com zoom 1,0 (a tela mostra 960 / 40 = 24 m de largura). PONTO DE PARTIDA para o M1a:
 * é um número de render, o motor não o usa. Afinar no aparelho junto com a câmera.
 */
export const PX_POR_METRO = 40;
/** Zoom da câmera: 1,0 parado até 0,8 na velocidade máxima (plano §1, pilar 1). Só render; aqui para uma fonte única. */
export const ZOOM_PARADO = 1.0;
export const ZOOM_VELOCIDADE_MAX = 0.8;

// --- Geradores separados por finalidade (plano §3.3): semente da corrida + deslocamento ---
export const CANAL_RNG = {
  logica: 0,
  visual: 1,
  ui: 2,
  audio: 3,
  falas: 4,
} as const;

// --- Limites de dado externo (replay, save). Nunca confiar no que vem de fora. ---
/** Corrida mais longa aceita num replay: 5 min. A de jogo normal tem 60 a 90 s (5400 ticks no máximo esperado). */
export const TETO_TICKS_REPLAY = 5 * 60 * TICKS_POR_SEGUNDO;
/** Teto de pontos (mesmo valor do C4 do plano §4). */
export const TETO_PONTOS = 99_999_999;
/** Forma de todo id do jogo (C4): minúsculas, dígitos e hífen, 2 a 24 caracteres, começa por letra. */
export const FORMA_ID = /^[a-z][a-z0-9-]{1,23}$/;
