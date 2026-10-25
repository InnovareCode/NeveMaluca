/**
 * Coordenadas lógicas do jogo: 960x540.
 * Converte coordenadas de um ponteiro / clique / toque no canvas para o espaço lógico.
 */
import { ALTURA, LARGURA } from '../core/constantes';
import type { AlvoToque } from '../input/toque';
import { mola } from './animacao';

export interface PontoLogico {
  readonly x: number;
  readonly y: number;
}

export function eventoParaPontoLogico(e: { clientX: number; clientY: number }, canvas: AlvoToque): PontoLogico {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width > 0 ? LARGURA / rect.width : 1;
  const scaleY = rect.height > 0 ? ALTURA / rect.height : 1;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  return { x, y };
}

export interface BotaoRetangular {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export function pontoDentroDoBotao(p: PontoLogico, b: BotaoRetangular): boolean {
  return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
}

// ---------------------------------------------------------------------------------------------------------------
// Botão 3D: estado de "pressionado -> soltar" (`docs/direcao-ui-premium.md` §4.3/§8.3)
// ---------------------------------------------------------------------------------------------------------------

const DURACAO_PRESSIONAR_TICKS = 5; // 80ms a 60Hz (§8.3): a face desce sobre o lábio
const DURACAO_SOLTAR_TICKS = 16; // 260ms a 60Hz: mola 1,06 -> 1

export interface PoseBotaoPressao {
  readonly pressionado: boolean;
  /** Multiplicador pronto para `Botao3DProps.escalaExtra` -- 1 fora da janela de soltura. */
  readonly escalaExtra: number;
}

export interface EstadoPressao {
  /** Chamar no `pointerdown`, quando o ponto cai sobre um botão reconhecido -- grava SÓ o instante (ticks). */
  marcar(id: string, tAtual: number): void;
  /** Pose visual deste botão neste quadro, pura função de `tAtual - instante marcado`. */
  pose(id: string, tAtual: number): PoseBotaoPressao;
}

/**
 * Rastreador do estado visual "pressionado -> soltar" de botões `botao3D` (§4.3), para cenas que já disparam a
 * ação no `pointerdown` (padrão deste projeto, pilar "de novo em 1 toque" -- nenhuma cena deste jogo adia a ação
 * pro `pointerup`, só o VISUAL de pressionar/soltar é pós-produzido a partir do instante do toque). Por isso
 * `marcar` não precisa de `pointerup`/"ainda em cima do botão" -- é chamado junto da própria ação, e a pose é
 * sempre função pura de `t` (mesma filosofia de `ui/animacao.ts`): nenhuma cena fica "pendurada" esperando soltura.
 */
export function criarEstadoPressao(): EstadoPressao {
  const marcados = new Map<string, number>();
  return {
    marcar(id, tAtual) {
      marcados.set(id, tAtual);
    },
    pose(id, tAtual) {
      const t0 = marcados.get(id);
      if (t0 === undefined) return { pressionado: false, escalaExtra: 1 };
      const e = tAtual - t0;
      if (e < 0) return { pressionado: false, escalaExtra: 1 };
      if (e < DURACAO_PRESSIONAR_TICKS) return { pressionado: true, escalaExtra: 1 };
      const p = (e - DURACAO_PRESSIONAR_TICKS) / DURACAO_SOLTAR_TICKS;
      if (p >= 1) return { pressionado: false, escalaExtra: 1 };
      return { pressionado: false, escalaExtra: 1.06 - 0.06 * mola(Math.max(0, p)) };
    },
  };
}
