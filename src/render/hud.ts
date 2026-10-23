/**
 * HUD de velocidade e pontos (plano §7 M1a). Tipografia igual à do boot.ts (Barlow/Barlow Condensed, já carregada
 * por `platform/fontes.ts` antes do 1º quadro). Contorno marinho + miolo claro: legível sobre céu ou neve.
 */
import { LARGURA } from '../core/constantes';
import type { ComboLeitura, FaseDescida } from '../core/contratos';
import { JANELA_LIGACAO_TICKS } from '../data/manobras';

export interface DadosHud {
  readonly velocidadeMs: number;
  readonly pontos: number;
  readonly fase: FaseDescida;
  readonly combo: ComboLeitura;
}

const COR_TEXTO = '#f4f9ff';
const COR_CONTORNO = '#0b1a33';
const COR_BARRA_COMBO_FUNDO = 'rgba(11, 26, 51, 0.55)';
const COR_BARRA_COMBO_PREENCHIMENTO = '#ffd166';
const LARGURA_BARRA_COMBO = 220;
const ALTURA_BARRA_COMBO = 10;

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

  if (dados.fase === 'contagem') {
    ctx.textAlign = 'center';
    ctx.font = 'italic 800 48px "Barlow Condensed", sans-serif';
    ctx.strokeText('PREPARA...', LARGURA / 2, 100);
    ctx.fillText('PREPARA...', LARGURA / 2, 100);
  }
  ctx.restore();
}
