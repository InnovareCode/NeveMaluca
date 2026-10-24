/**
 * HUD de velocidade e pontos (plano §7 M1a). Tipografia igual à do boot.ts (Barlow/Barlow Condensed, já carregada
 * por `platform/fontes.ts` antes do 1º quadro). Contorno marinho + miolo claro: legível sobre céu ou neve.
 */
import { ALTURA, LARGURA } from '../core/constantes';
import type { ComboLeitura, FaseDescida } from '../core/contratos';
import { JANELA_LIGACAO_TICKS } from '../data/manobras';

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

/** Uma marca na barra de progresso (hoje só o jogador; o C2b empilha aqui os 5 rivais com rosto/cor por personagem). */
interface MarcaProgresso {
  readonly fracao: number;
  readonly cor: string;
  readonly raio: number;
}

/** Barra linear 0..1 ao longo da pista, pensada desde já para receber os 6 rostos (plano §C1/C2b): hoje desenha
 *  só a marca do jogador num array de 1 — o C2b só PREENCHE este array, sem mudar a função. */
function desenharBarraProgresso(ctx: CanvasRenderingContext2D, fracaoJogador: number): void {
  const x = LARGURA / 2 - LARGURA_BARRA_PROGRESSO / 2;
  const y = Y_BARRA_PROGRESSO;
  const fracao = Math.max(0, Math.min(1, fracaoJogador));

  const marcas: readonly MarcaProgresso[] = [{ fracao, cor: COR_BARRA_PROGRESSO_PREENCHIMENTO, raio: 7 }];

  ctx.fillStyle = COR_BARRA_PROGRESSO_FUNDO;
  ctx.fillRect(x, y, LARGURA_BARRA_PROGRESSO, ALTURA_BARRA_PROGRESSO);

  ctx.fillStyle = COR_BARRA_PROGRESSO_PREENCHIMENTO;
  ctx.fillRect(x, y, LARGURA_BARRA_PROGRESSO * fracao, ALTURA_BARRA_PROGRESSO);

  ctx.lineWidth = 2;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.strokeRect(x, y, LARGURA_BARRA_PROGRESSO, ALTURA_BARRA_PROGRESSO);

  for (const m of marcas) {
    const mx = x + LARGURA_BARRA_PROGRESSO * Math.max(0, Math.min(1, m.fracao));
    ctx.beginPath();
    ctx.arc(mx, y + ALTURA_BARRA_PROGRESSO / 2, m.raio, 0, Math.PI * 2);
    ctx.fillStyle = m.cor;
    ctx.fill();
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
    desenharBarraProgresso(ctx, dados.progressoJogador);
  }

  if (dados.fase === 'chegou') {
    ctx.textAlign = 'center';
    ctx.font = 'italic 800 52px "Barlow Condensed", sans-serif';
    ctx.strokeText('CHEGOU!', LARGURA / 2, 100);
    ctx.fillText('CHEGOU!', LARGURA / 2, 100);
  }
  ctx.restore();
}
