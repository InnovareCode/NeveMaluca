/**
 * HUD de velocidade e pontos (plano §7 M1a). Tipografia igual à do boot.ts (Barlow/Barlow Condensed, já carregada
 * por `platform/fontes.ts` antes do 1º quadro). Contorno marinho + miolo claro: legível sobre céu ou neve.
 *
 * Botão/slot de item + feedback de eventos (plano itens-corrida §I4b/I5, Lyra): `RETANGULO_BOTAO_ITEM` é a MESMA
 * zona que `ui/cenas/corrida.ts` repassa pro toque (`input/toque.ts: OpcoesToque.botaoItem`) — um retângulo só,
 * lido pelos dois lados (desenho aqui, hit-test lá), pra nunca desalinhar hitbox e ícone. Ícone real (2026-10-24,
 * `assets/itens.ts`: `bola`/`poca`/`nuvem`/`turbo`/`escudo`/`ima`, 256x256) quando já carregado; círculo colorido
 * + inicial é só o fallback enquanto a imagem não chegou (nunca travado, mesmo padrão de `assetsMenuCapaProntos`).
 */
import { ALTURA, LARGURA } from '../core/constantes';
import type { ComboLeitura, EventoCorrida, FaseDescida, IdPersonagem, TipoItem } from '../core/contratos';
import { TIPOS_ITEM } from '../core/contratos';
import { JANELA_LIGACAO_TICKS } from '../data/manobras';
import { assetsItensProntos } from '../assets/itens';

export interface DadosHud {
  readonly velocidadeMs: number;
  readonly pontos: number;
  readonly fase: FaseDescida;
  readonly combo: ComboLeitura;
  /**
   * Fração 0..1 já percorrida da pista (`piloto.x / pista.chegadaX`), para a barra de progresso (plano "corrida
   * em campeonato" §C1). Vem pronta (não `x`/`chegadaX` crus): o HUD não precisa conhecer `PistaGerada`. Sem
   * valor, a barra não desenha (compat com quem ainda chama `desenharHud` sem este campo).
   */
  readonly progressoJogador?: number | undefined;
  /**
   * Um marcador por RIVAL na barra de progresso (plano "corrida em campeonato" §C2b: "a barra... agora com os 6
   * rostos"), além do marcador do jogador (sempre o último, por cima). Sem valor, a barra mostra só o jogador
   * (compat com `ui/cenas/descida.ts`, que não tem rivais).
   */
  readonly rivaisProgresso?: readonly MarcaCorredorHud[] | undefined;
  /**
   * Posição do jogador NESTA corrida (1º..Nº) e o total de corredores (plano §C2b: "'2º/6' grande no HUD").
   * Sem os dois, não desenha (compat com a descida solo).
   */
  readonly posicaoJogador?: number | undefined;
  readonly totalCorredores?: number | undefined;
}

/** Um marcador de rival na barra de progresso: cor sempre; `imagem` (thumbnail do sprite, já carregado) é opcional
 *  -- sem ela, cai no ponto colorido de sempre (fallback, nunca trava por sprite ainda não carregado). */
export interface MarcaCorredorHud {
  readonly fracao: number;
  readonly cor: string;
  readonly imagem?: CanvasImageSource | null | undefined;
}

const COR_TEXTO = '#f4f9ff';
const COR_CONTORNO = '#0b1a33';
const COR_BARRA_COMBO_FUNDO = 'rgba(11, 26, 51, 0.55)';
const COR_BARRA_COMBO_PREENCHIMENTO = '#ffd166';
const LARGURA_BARRA_COMBO = 220;
const ALTURA_BARRA_COMBO = 10;

const COR_BARRA_PROGRESSO_FUNDO = 'rgba(11, 26, 51, 0.5)';
const COR_BARRA_PROGRESSO_PREENCHIMENTO = '#ffd166';
const LARGURA_BARRA_PROGRESSO = 480;
const ALTURA_BARRA_PROGRESSO = 10;
const Y_BARRA_PROGRESSO = 14;

/** Uma marca na barra de progresso: cor sempre; `imagem` (thumbnail, já carregado) opcional -- sem ela, ponto colorido. */
interface MarcaProgresso {
  readonly fracao: number;
  readonly cor: string;
  readonly raio: number;
  readonly imagem?: CanvasImageSource | null | undefined;
}

/** Barra linear 0..1 ao longo da pista (plano §C1/C2b): a marca do jogador (sempre, por cima) + uma por rival
 *  (`rivais`, vazio na descida solo). Cada marca é o thumbnail do sprite do personagem (se já carregado) recortado
 *  em círculo, ou um ponto colorido de fallback -- nunca trava por sprite ainda não carregado. */
function desenharBarraProgresso(ctx: CanvasRenderingContext2D, fracaoJogador: number, rivais: readonly MarcaCorredorHud[]): void {
  const x = LARGURA / 2 - LARGURA_BARRA_PROGRESSO / 2;
  const y = Y_BARRA_PROGRESSO;
  const fracao = Math.max(0, Math.min(1, fracaoJogador));

  const marcas: readonly MarcaProgresso[] = [
    ...rivais.map((r): MarcaProgresso => ({ fracao: r.fracao, cor: r.cor, raio: 5, imagem: r.imagem })),
    { fracao, cor: COR_BARRA_PROGRESSO_PREENCHIMENTO, raio: 7 },
  ];

  ctx.fillStyle = COR_BARRA_PROGRESSO_FUNDO;
  ctx.fillRect(x, y, LARGURA_BARRA_PROGRESSO, ALTURA_BARRA_PROGRESSO);

  ctx.fillStyle = COR_BARRA_PROGRESSO_PREENCHIMENTO;
  ctx.fillRect(x, y, LARGURA_BARRA_PROGRESSO * fracao, ALTURA_BARRA_PROGRESSO);

  ctx.lineWidth = 2;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.strokeRect(x, y, LARGURA_BARRA_PROGRESSO, ALTURA_BARRA_PROGRESSO);

  for (const m of marcas) {
    const mx = x + LARGURA_BARRA_PROGRESSO * Math.max(0, Math.min(1, m.fracao));
    const my = y + ALTURA_BARRA_PROGRESSO / 2;
    if (m.imagem) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(mx, my, m.raio, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(m.imagem, mx - m.raio, my - m.raio, m.raio * 2, m.raio * 2);
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(mx, my, m.raio, 0, Math.PI * 2);
      ctx.fillStyle = m.cor;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(mx, my, m.raio, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = COR_CONTORNO;
    ctx.stroke();
  }
}

/** Contagem "3-2-1-JÁ" (plano §C1): desenhada pela CENA (`ui/cenas/descida.ts`), não por `desenharHud` — ela
 *  conta ticks próprios ANTES do motor rodar, então não cabe em `DadosHud` (que lê `LeituraDescida`). `pulso`
 *  em [0, 1): 0 = acabou de trocar (maior, "pop"), perto de 1 = tamanho de repouso. */
export function desenharContagemRegressiva(ctx: CanvasRenderingContext2D, texto: string, pulso: number): void {
  // Escala pelo TAMANHO DA FONTE (não `ctx.scale`): menos uma dependência de API de canvas pros contextos falsos
  // de teste (`ui-descida-fantasma.test.ts`), e o contorno (`lineWidth`) escala de verdade com o texto.
  const escala = 1.35 - 0.35 * Math.max(0, Math.min(1, pulso));
  ctx.save();
  ctx.translate(LARGURA / 2, ALTURA / 2 - 40);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.font = `italic 900 ${Math.round(120 * escala)}px "Barlow Condensed", Impact, sans-serif`;
  ctx.lineWidth = Math.max(1, Math.round(12 * escala));
  ctx.strokeStyle = COR_CONTORNO;
  ctx.strokeText(texto, 0, 0);
  ctx.fillStyle = COR_TEXTO;
  ctx.fillText(texto, 0, 0);
  ctx.restore();
}

/** Legenda discreta sob a contagem (polimento "Pixar no gameplay", corrida em campeonato): a cena chama isto
 * enquanto `render/temas/catalogo.ts: rasterProntoParaTema` for falso -- some sozinha assim que o cache do tema
 * fica pronto, no meio da própria contagem. NUNCA atrasa o relógio: os ticks da contagem são os mesmos de
 * sempre, só o desenho muda enquanto o raster não chegou (ver comentário em `ui/cenas/descida.ts`). */
export function desenharLegendaCarregandoCenario(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 18px Barlow, sans-serif';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.strokeText('carregando cenário...', LARGURA / 2, ALTURA / 2 + 72);
  ctx.fillStyle = COR_TEXTO;
  ctx.fillText('carregando cenário...', LARGURA / 2, ALTURA / 2 + 72);
  ctx.restore();
}

/** Medidor de combo (plano §3.5/M2): xMULT + soma acumulada, e a janela de ligação como barra que esvazia. */
function desenharBarraCombo(ctx: CanvasRenderingContext2D, combo: ComboLeitura): void {
  if (!combo.ativo) return;

  const x = LARGURA / 2 - LARGURA_BARRA_COMBO / 2;
  const y = 48;

  ctx.textAlign = 'center';
  ctx.font = '800 26px "Barlow Condensed", sans-serif';
  const texto = `x${combo.mult}  +${Math.round(combo.soma)}`;
  ctx.strokeText(texto, LARGURA / 2, y - 6);
  ctx.fillText(texto, LARGURA / 2, y - 6);

  ctx.fillStyle = COR_BARRA_COMBO_FUNDO;
  ctx.fillRect(x, y, LARGURA_BARRA_COMBO, ALTURA_BARRA_COMBO);

  // A janela só corre de verdade no chão (abrirJanela/tiqueJanela, ver descida/combo.ts); no voo fica em 0 com o
  // combo já ativo — por isso a barra aparece vazia até o 1º pouso bom, o que é o comportamento esperado.
  const fracao = Math.max(0, Math.min(1, combo.janela / JANELA_LIGACAO_TICKS));
  if (fracao > 0) {
    ctx.fillStyle = COR_BARRA_COMBO_PREENCHIMENTO;
    ctx.fillRect(x, y, LARGURA_BARRA_COMBO * fracao, ALTURA_BARRA_COMBO);
  }

  ctx.lineWidth = 2;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.strokeRect(x, y, LARGURA_BARRA_COMBO, ALTURA_BARRA_COMBO);
}

export function desenharHud(ctx: CanvasRenderingContext2D, dados: DadosHud): void {
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.font = '700 28px "Barlow Condensed", sans-serif';
  ctx.lineWidth = 4;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.fillStyle = COR_TEXTO;

  const kmh = Math.round(dados.velocidadeMs * 3.6);
  ctx.textAlign = 'left';
  ctx.strokeText(`${kmh} km/h`, 16, 36);
  ctx.fillText(`${kmh} km/h`, 16, 36);

  ctx.textAlign = 'right';
  const pontosTxt = String(Math.max(0, Math.round(dados.pontos))).padStart(6, '0');
  ctx.strokeText(pontosTxt, LARGURA - 16, 36);
  ctx.fillText(pontosTxt, LARGURA - 16, 36);

  desenharBarraCombo(ctx, dados.combo);

  if (dados.progressoJogador !== undefined) {
    desenharBarraProgresso(ctx, dados.progressoJogador, dados.rivaisProgresso ?? []);
  }

  if (dados.posicaoJogador !== undefined && dados.totalCorredores !== undefined) {
    ctx.textAlign = 'left';
    ctx.font = 'italic 900 34px "Barlow Condensed", Impact, sans-serif';
    const texto = `${dados.posicaoJogador}º/${dados.totalCorredores}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = COR_CONTORNO;
    ctx.strokeText(texto, 16, 78);
    ctx.fillStyle = COR_TEXTO;
    ctx.fillText(texto, 16, 78);
  }

  if (dados.fase === 'chegou') {
    ctx.textAlign = 'center';
    ctx.font = 'italic 800 52px "Barlow Condensed", sans-serif';
    ctx.strokeText('CHEGOU!', LARGURA / 2, 100);
    ctx.fillText('CHEGOU!', LARGURA / 2, 100);
  }
  ctx.restore();
}

// --- Botão/slot de item (plano itens-corrida §I4b/I5) ---

const LADO_BOTAO_ITEM = 76;
/** Margem >= 24 px da borda (plano I-D3: alvo de toque numa área segura, nunca colado no canto físico da tela). */
const MARGEM_BOTAO_ITEM = 24;

/** Zona do botão de item, em coordenadas LÓGICAS (960x540) — canto inferior direito. `ui/cenas/corrida.ts` repassa
 *  este MESMO objeto pro toque (`input/toque.ts: OpcoesToque.botaoItem`): um retângulo só, nunca duplicado. */
export const RETANGULO_BOTAO_ITEM = {
  x: LARGURA - MARGEM_BOTAO_ITEM - LADO_BOTAO_ITEM,
  y: ALTURA - MARGEM_BOTAO_ITEM - LADO_BOTAO_ITEM,
  w: LADO_BOTAO_ITEM,
  h: LADO_BOTAO_ITEM,
} as const;

/** Cor placeholder por item (vetorial, sem asset — Apolo troca depois). Distinta por item, nada mais. */
const COR_ITEM: Readonly<Record<TipoItem, string>> = {
  bola: '#eaf6ff',
  poca: '#c87f3c',
  nuvem: '#8fa3c8',
  turbo: '#ff8a3d',
  escudo: '#7fe3ff',
  ima: '#ff5fa8',
};

export interface DadosBotaoItem {
  /** Item no slot agora, ou `null` com o slot vazio (nada pra usar). */
  readonly item: TipoItem | null;
  /** Roleta girando (plano I-D5): enquanto não for `null`, o ícone cicla entre os tipos até assentar no resultado. */
  readonly roleta?: { readonly ticksRestantes: number; readonly resultado: TipoItem } | null | undefined;
}

/** Ticks finais da roleta em que o ícone já assenta no resultado (não cicla até o último tick: ia trocar de ícone
 *  bem na hora de desaparecer, o que lê como "pisca", não "parou"). */
const TICKS_ASSENTAR_ROLETA = 4;

function itemMostradoNoBotao(dados: DadosBotaoItem, tick: number): TipoItem | null {
  const roleta = dados.roleta;
  if (!roleta) return dados.item;
  if (roleta.ticksRestantes <= TICKS_ASSENTAR_ROLETA) return roleta.resultado;
  return TIPOS_ITEM[tick % TIPOS_ITEM.length] as TipoItem;
}

/** Botão de item (I4b, a MESMA zona que `input/toque.ts` escuta) + ícone do slot/roleta (I5): círculo com fundo
 *  translúcido sempre visível (alvo de toque óbvio, mesmo com o slot vazio); miolo colorido + inicial do item
 *  quando há algo pra usar, anel pontilhado quando o slot está vazio (nada a apertar, mas o botão não "some"). */
export function desenharBotaoItem(ctx: CanvasRenderingContext2D, dados: DadosBotaoItem, tick: number): void {
  const r = RETANGULO_BOTAO_ITEM;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const raio = r.w / 2;
  const itemMostrado = itemMostradoNoBotao(dados, tick);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(11, 26, 51, 0.55)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.stroke();

  if (itemMostrado === null) {
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(244, 249, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, raio - 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    const icone = assetsItensProntos()?.[itemMostrado];
    if (icone) {
      const ladoIcone = (raio - 6) * 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, raio - 6, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(8, 18, 36, 0.35)';
      ctx.fill();
      ctx.drawImage(icone, cx - ladoIcone / 2, cy - ladoIcone / 2, ladoIcone, ladoIcone);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx, cy, raio - 6, 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = COR_CONTORNO;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(cx, cy, raio - 8, 0, Math.PI * 2);
      ctx.fillStyle = COR_ITEM[itemMostrado];
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = COR_CONTORNO;
      ctx.stroke();
      ctx.fillStyle = COR_CONTORNO;
      ctx.font = `800 ${Math.round(raio * 0.9)}px Barlow, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(itemMostrado.charAt(0).toUpperCase(), cx, cy + 1);
    }
  }
  ctx.restore();
}

// --- Botão de pausa (feedback do dono, playtest iPhone: "durante a partida não dá pra pausar") ---

const LADO_BOTAO_PAUSA = 72;
const MARGEM_BOTAO_PAUSA = 20;

/** Canto SUPERIOR esquerdo, abaixo do velocímetro/posição (que ocupam só até y~78 nesse canto) — medido no
 *  iPhone (webkit-se, `playwright.config.ts`) pra não sobrepor NADA: nem o resto do HUD (pontos/combo/barra de
 *  progresso ficam nos outros cantos/centro), nem o botão de tela cheia do DOM (`platform/tela-cheia-ui.ts:
 *  #btn-tela-cheia`, `position: fixed; top/right: 8px`, SEMPRE visível durante o jogo -- ninguém chama
 *  `definirVisivel(false)`). Esse botão fica ANCORADO AO VIEWPORT, não ao canvas; num aparelho onde o canvas
 *  quase enche a tela (iPhone real), o canto SUPERIOR DIREITO do canvas cai embaixo dele — um toque ali abre
 *  tela cheia, não a pausa (achado real rodando `tests/e2e/pausa.spec.ts` no projeto `webkit-se`, não suposição
 *  de CSS). Por isso o botão de pausa foi para o canto OPOSTO. 72px lógicos: no iPhone em paisagem (canvas
 *  escalado a ~0,65x do lógico, `platform/escala.ts`), isso cobre o alvo de toque de ~44pt da Apple HIG — mesmo
 *  raciocínio de `LADO_BOTAO_ITEM`. `ui/cenas/descida.ts` e `corrida.ts` repassam este MESMO retângulo pro toque
 *  (`input/toque.ts: OpcoesToque.botaoPausa`), igual ao botão de item: um retângulo só, nunca duplicado entre
 *  desenho e hit-test. */
export const RETANGULO_BOTAO_PAUSA = {
  x: MARGEM_BOTAO_PAUSA,
  y: 92,
  w: LADO_BOTAO_PAUSA,
  h: LADO_BOTAO_PAUSA,
} as const;

/** Ícone de pausa (duas barras) num círculo translúcido — mesmo estilo visual do botão de item, sempre visível
 *  (nunca "some": é o único jeito de pausar por toque). */
export function desenharBotaoPausa(ctx: CanvasRenderingContext2D): void {
  const r = RETANGULO_BOTAO_PAUSA;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const raio = r.w / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(11, 26, 51, 0.55)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.stroke();

  const barraW = raio * 0.22;
  const barraH = raio * 0.9;
  ctx.fillStyle = COR_TEXTO;
  ctx.fillRect(cx - barraW * 1.5, cy - barraH / 2, barraW, barraH);
  ctx.fillRect(cx + barraW * 0.5, cy - barraH / 2, barraW, barraH);
  ctx.restore();
}

// --- Feedback dos eventos de item (plano §I5: "feedback dos eventosCorrida") ---

const CAPACIDADE_FEEDBACK_ITENS = 4;
const VIDA_FEEDBACK_ITENS_TICKS = 50;
const COR_FEEDBACK_NEUTRO = '#ffd166';
const COR_FEEDBACK_BOM = '#7CFC9A';
const COR_FEEDBACK_RUIM = '#ff6b6b';

interface ToastItem {
  ativo: boolean;
  texto: string;
  cor: string;
  vida: number;
}

export interface SistemaFeedbackItens {
  /** Lê os `eventosCorrida` do tick (só os que envolvem `idJogador`); ignora o resto (rival acertando outro rival). */
  atualizar(eventos: readonly EventoCorrida[], idJogador: IdPersonagem): void;
  /** Desenha o toast mais recente ainda vivo, acima do botão de item. */
  desenhar(ctx: CanvasRenderingContext2D): void;
}

/** Pool fixo pré-alocado (mesmo padrão de `render/manobra.ts`/`render/particulas.ts`): zero alocação por quadro. */
export function criarSistemaFeedbackItens(): SistemaFeedbackItens {
  const pool: ToastItem[] = Array.from({ length: CAPACIDADE_FEEDBACK_ITENS }, () => ({ ativo: false, texto: '', cor: COR_FEEDBACK_NEUTRO, vida: 0 }));
  let cabeca = 0;

  function abrir(texto: string, cor: string): void {
    const t = pool[cabeca]!;
    t.ativo = true;
    t.texto = texto;
    t.cor = cor;
    t.vida = VIDA_FEEDBACK_ITENS_TICKS;
    cabeca = (cabeca + 1) % CAPACIDADE_FEEDBACK_ITENS;
  }

  return {
    atualizar(eventos, idJogador) {
      for (let i = 0; i < CAPACIDADE_FEEDBACK_ITENS; i += 1) {
        const t = pool[i]!;
        if (!t.ativo) continue;
        t.vida -= 1;
        if (t.vida <= 0) t.ativo = false;
      }
      for (const ev of eventos) {
        switch (ev.tipo) {
          case 'item-pego':
            if (ev.id === idJogador) abrir('ITEM!', COR_FEEDBACK_NEUTRO);
            break;
          case 'item-usado':
            if (ev.id === idJogador) abrir('USOU!', COR_FEEDBACK_NEUTRO);
            break;
          case 'acerto':
            if (ev.de === idJogador) abrir('ACERTOU!', COR_FEEDBACK_BOM);
            else if (ev.em === idJogador) abrir('ATINGIDO!', COR_FEEDBACK_RUIM);
            break;
          case 'bloqueado':
            if (ev.id === idJogador) abrir('BLOQUEADO!', COR_FEEDBACK_BOM);
            break;
          case 'desviou':
            if (ev.id === idJogador) abrir('DESVIOU!', COR_FEEDBACK_BOM);
            break;
        }
      }
    },
    desenhar(ctx) {
      // Só o mais recente ainda vivo (índice anterior a `cabeca`, voltando): empilhar vários toasts ao mesmo tempo
      // leria pior do que mostrar 1 por vez (mesmo critério de `LIMIAR_COLADO_PX` em `render/rivais.ts`).
      let maisRecente: ToastItem | null = null;
      for (let passo = 1; passo <= CAPACIDADE_FEEDBACK_ITENS; passo += 1) {
        const t = pool[(cabeca - passo + CAPACIDADE_FEEDBACK_ITENS) % CAPACIDADE_FEEDBACK_ITENS]!;
        if (t.ativo) {
          maisRecente = t;
          break;
        }
      }
      if (!maisRecente) return;
      const x = RETANGULO_BOTAO_ITEM.x + RETANGULO_BOTAO_ITEM.w / 2;
      const y = RETANGULO_BOTAO_ITEM.y - 14;
      const alpha = maisRecente.vida / VIDA_FEEDBACK_ITENS_TICKS < 0.3 ? Math.max(0, maisRecente.vida / VIDA_FEEDBACK_ITENS_TICKS / 0.3) : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      ctx.font = '800 20px "Barlow Condensed", sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = COR_CONTORNO;
      ctx.strokeText(maisRecente.texto, x, y);
      ctx.fillStyle = maisRecente.cor;
      ctx.fillText(maisRecente.texto, x, y);
      ctx.restore();
    },
  };
}
