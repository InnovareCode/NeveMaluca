/**
 * "Nevasca": a transição PADRÃO entre telas cheias (guia de UI premium do Apolo, `docs/direcao-ui-premium.md`
 * §10.1/§8.3) — nunca um corte seco, sempre uma faixa de neve inclinada (12°) varrendo a tela. Usada tanto pelo
 * `ui/cenas/gerenciador.ts` (menu <-> seleção <-> jogo/campeonato/opções) quanto pelos orquestradores internos
 * (`ui/cenas/jogo.ts`: descida <-> resultado; `ui/cenas/campeonato.ts`: abertura -> corrida -> pódio -> standings
 * -> oficina -> corrida -> ... -> final) -- UM estilo só de transição em todo o jogo (pedido do Apolo/Atlas).
 *
 * As 3 pernas (§8.3: 280 + 60 + 320 ms = 17 + 4 + 19 ticks a 60 Hz):
 *  1. **Cobrir** (17 ticks, easeInCubic): a faixa varre cobrindo de neve o que estava na tela. A cena ANTIGA já foi
 *     destruída pelo chamador antes de `iniciar()` (os ouvintes dela não podem sobreviver) -- o que fica visível
 *     por baixo da faixa, enquanto ela não cobre tudo, é simplesmente o ÚLTIMO QUADRO já desenhado no canvas: o
 *     laço principal (`main.ts`) nunca limpa o canvas entre quadros, só a própria cena desenha por cima -- então
 *     não chamar `atual.desenhar()` já BASTA pra "congelar a foto" de graça, sem `drawImage`/canvas auxiliar.
 *  2. **Segurar** (4 ticks): tela toda de neve sólida. É aqui que `trocar()` de quem chama constrói a cena NOVA
 *     (passo "construir a cena nova só agora, pra entrada dela começar junto com a revelação").
 *  3. **Revelar** (19 ticks, easeOutCubic): a faixa continua, descobrindo a cena NOVA (já construída, já rodando
 *     por baixo -- `desenharConteudo` é chamado a cada quadro desta perna).
 *
 * Direção (§10.1): "ir pra frente" varre esquerda->direita; "voltar" varre direita->esquerda -- dá sensação de
 * mapa, não de telas soltas. Entrada bloqueada (toque/tecla) só nas pernas 1-2 (~340 ms); na perna 3 o jogador já
 * pode interagir com a cena nova, que está sendo revelada.
 */
import { ALTURA, LARGURA } from '../core/constantes';
import type { AlvoTeclado } from '../input/teclado';
import type { AlvoToque } from '../input/toque';
import type { Ctx } from '../platform/canvas';

/** Token `neve` de `docs/direcao-arte-neve-maluca.md` §1.5 / `docs/direcao-ui-premium.md` §2.1. */
const COR_NEVE_SOLIDA = '#F7FBFF';
const LARGURA_FAIXA = 130;
const ANGULO_FAIXA = (12 * Math.PI) / 180;

const TICKS_COBRIR = 17;
const TICKS_SEGURAR = 4;
const TICKS_REVELAR = 19;

const easeInCubic = (p: number): number => p * p * p;
const easeOutCubic = (p: number): number => 1 - (1 - p) ** 3;
const progresso = (tick: number, alpha: number, duracao: number): number => Math.min(1, (tick + alpha) / duracao);

/**
 * Faixa inclinada cobrindo a fração `fracaoCoberta` (0 = nada, 1 = tela toda) da tela, no sentido de `sinal`
 * (+1 = esquerda->direita, "frente"; −1 = direita->esquerda, "volta"). Mesma faixa serve pra cobrir (0->1) e pra
 * revelar (1->0, chamando com `fracaoCoberta` decrescente) -- é a mesma geometria, só a fração muda.
 */
function desenharFaixaDeNeve(ctx: Ctx, fracaoCoberta: number, sinal: 1 | -1): void {
  if (fracaoCoberta <= 0) return;
  const alcance = LARGURA + LARGURA_FAIXA;
  const avanco = -LARGURA_FAIXA + fracaoCoberta * alcance; // 0 -> 1: -130 .. 1090, sempre no sentido do avanço
  const edge = sinal > 0 ? avanco : LARGURA - avanco;
  const diag = Math.hypot(LARGURA, ALTURA) * 1.2;

  ctx.save();
  ctx.translate(edge, ALTURA / 2);
  ctx.rotate(ANGULO_FAIXA * sinal);

  // Metade já coberta (sólida), atrás da borda no sentido do avanço -- clip próprio, não escapa pro resto da faixa.
  ctx.save();
  ctx.beginPath();
  ctx.rect(sinal > 0 ? -diag : 0, -diag, diag, diag * 2);
  ctx.clip();
  ctx.fillStyle = COR_NEVE_SOLIDA;
  ctx.fillRect(-diag, -diag, diag * 2, diag * 2);
  ctx.restore();

  // Borda de ataque: gradiente transparente -> neve, no sentido do avanço (§10.1: "borda de ataque... 120 px").
  const x0 = sinal > 0 ? -LARGURA_FAIXA : 0;
  const x1 = sinal > 0 ? 0 : LARGURA_FAIXA;
  const grad = ctx.createLinearGradient(x0, 0, x1, 0);
  grad.addColorStop(0, 'rgba(247, 251, 255, 0)');
  grad.addColorStop(1, COR_NEVE_SOLIDA);
  ctx.fillStyle = grad;
  ctx.fillRect(Math.min(x0, x1), -ALTURA, LARGURA_FAIXA, ALTURA * 2);

  // Flocos na borda (determinístico, sem `Math.random`, mesma regra de `desenharFlocos`).
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  for (let i = 0; i < 12; i += 1) {
    const ly = -ALTURA + ((i * 97) % (ALTURA * 2));
    const lx = Math.min(x0, x1) + ((i * 53) % LARGURA_FAIXA);
    const r = 2 + (i % 3);
    ctx.moveTo(lx + r, ly);
    ctx.arc(lx, ly, r, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.restore();
}

export type DirecaoNevasca = 'frente' | 'volta';

export interface OpcoesNevasca {
  readonly canvas?: AlvoToque | undefined;
  readonly janela?: AlvoTeclado | undefined;
}

export interface CortinaNevasca {
  /** true durante as 3 pernas (cobrir/segurar/revelar). */
  readonly emTransicao: boolean;
  /** true só nas pernas "cobrir"/"segurar" (a cena embaixo está destruída/nula -- nada pra atualizar mesmo; na
   *  perna "revelar" é false, pra cena NOVA já rodar a própria entrada por baixo da faixa, como pede o §10.1). */
  readonly congelando: boolean;
  /** Começa a transição. `trocar()` (destruir não entra aqui -- quem chama já destruiu a cena antiga ANTES de
   *  chamar `iniciar`, ver cabeçalho do arquivo) é chamado no início da perna "revelar", construindo a cena nova
   *  bem no instante em que ela vai começar a ser descoberta. Reentrância durante uma transição já em curso é
   *  ignorada. */
  iniciar(direcao: DirecaoNevasca, trocar: () => void): void;
  atualizar(): void;
  /** `desenharConteudo(ctx, alpha)` só é chamado durante a perna "revelar" (desenha a cena NOVA por baixo da
   *  faixa que termina de descobri-la). Nas pernas "cobrir"/"segurar" não é chamado -- não desenhar nada É o
   *  "congela a foto" (ver cabeçalho do arquivo). */
  desenhar(ctx: Ctx, alpha: number, desenharConteudo: (ctx: Ctx, alpha: number) => void): void;
  destruir(): void;
}

export function criarCortinaNevasca(opcoes: OpcoesNevasca = {}): CortinaNevasca {
  let fase: 'ociosa' | 'cobrindo' | 'segurando' | 'revelando' = 'ociosa';
  let tick = 0;
  let direcao: DirecaoNevasca = 'frente';
  let pendente: (() => void) | null = null;

  // Bloqueia toque/tecla só durante cobrir/segurar (§10.1 passo 6: "~340 ms") -- registrado antes de qualquer
  // sub-cena (mesmo truque de `ui/cenas/pausa.ts`: ouvintes do MESMO nó disparam na ordem de registro).
  const bloquear = (e: Event): void => {
    if (fase !== 'cobrindo' && fase !== 'segurando') return;
    (e as Partial<PointerEvent & KeyboardEvent>).stopImmediatePropagation?.();
    (e as Partial<PointerEvent>).preventDefault?.();
  };
  opcoes.canvas?.addEventListener('pointerdown', bloquear);
  opcoes.canvas?.addEventListener('pointermove', bloquear);
  opcoes.canvas?.addEventListener('pointerup', bloquear);
  opcoes.janela?.addEventListener('keydown', bloquear);

  return {
    get emTransicao() {
      return fase !== 'ociosa';
    },
    get congelando() {
      return fase === 'cobrindo' || fase === 'segurando';
    },
    iniciar(novaDirecao, trocar) {
      // Reentrância só é ignorada enquanto a entrada já está bloqueada (cobrindo/segurando -- nenhum toque real
      // chegaria aqui de qualquer forma). Durante "revelando" a cena nova já está interativa (§10.1 passo 6: só
      // bloqueia nos passos 2-4); se o jogador navegar de novo nesse meio tempo, corta a revelação em curso e
      // recomeça a cobrir -- NUNCA descarta o pedido em silêncio (era o bug: um toque "cedo demais" na cena recém
      // revelada virava clique morto).
      if (fase === 'cobrindo' || fase === 'segurando') return;
      direcao = novaDirecao;
      fase = 'cobrindo';
      tick = 0;
      pendente = trocar;
    },
    atualizar() {
      if (fase === 'ociosa') return;
      tick += 1;
      if (fase === 'cobrindo' && tick >= TICKS_COBRIR) {
        tick = 0;
        fase = 'segurando';
      } else if (fase === 'segurando' && tick >= TICKS_SEGURAR) {
        tick = 0;
        const ir = pendente;
        pendente = null;
        ir?.(); // constrói a cena nova JUSTO no início da revelação (§10.1 passo 4)
        fase = 'revelando';
      } else if (fase === 'revelando' && tick >= TICKS_REVELAR) {
        tick = 0;
        fase = 'ociosa';
      }
    },
    desenhar(ctx, alpha, desenharConteudo) {
      const sinal: 1 | -1 = direcao === 'frente' ? 1 : -1;
      if (fase === 'cobrindo') {
        desenharFaixaDeNeve(ctx, easeInCubic(progresso(tick, alpha, TICKS_COBRIR)), sinal);
      } else if (fase === 'segurando') {
        ctx.save();
        ctx.fillStyle = COR_NEVE_SOLIDA;
        ctx.fillRect(0, 0, LARGURA, ALTURA);
        ctx.restore();
      } else if (fase === 'revelando') {
        desenharConteudo(ctx, alpha);
        desenharFaixaDeNeve(ctx, 1 - easeOutCubic(progresso(tick, alpha, TICKS_REVELAR)), sinal);
      }
    },
    destruir() {
      opcoes.canvas?.removeEventListener('pointerdown', bloquear);
      opcoes.canvas?.removeEventListener('pointermove', bloquear);
      opcoes.canvas?.removeEventListener('pointerup', bloquear);
      opcoes.janela?.removeEventListener('keydown', bloquear);
    },
  };
}

/** Duração total (ticks) de uma transição completa -- útil pra testes esperarem a travessia inteira. */
export const TICKS_NEVASCA_TOTAL = TICKS_COBRIR + TICKS_SEGURAR + TICKS_REVELAR;
/** Ticks até o início da perna "revelar" (quando a cena nova é construída) -- útil pra testes. */
export const TICKS_NEVASCA_ATE_CONSTRUIR = TICKS_COBRIR + TICKS_SEGURAR;
