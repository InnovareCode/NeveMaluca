/**
 * Cena de resultado (plano §7 M1a, pilar 4 "de novo em 1 toque"): mostra pontos e tempo, e volta para uma nova
 * descida no primeiro toque ou tecla (Espaço/Enter). Sem persistência de recorde aqui: isso é C4 (Cronos), ainda
 * fora do M1a.
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Cena } from '../tipos';
import type { ResultadoDescida } from './descida';

export interface OpcoesCenaResultado {
  readonly dados: ResultadoDescida;
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly aoReiniciar?: (() => void) | undefined;
}

const COR_FUNDO = '#0b1a33';
const COR_TEXTO = '#f4f9ff';

export function criarCenaResultado(opcoes: OpcoesCenaResultado): Cena {
  const janela = opcoes.janela ?? window;
  const reiniciar = (): void => opcoes.aoReiniciar?.();
  const aoTecla = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (e.code === 'Space' || e.code === 'Enter') reiniciar();
  };
  const aoTocar = (): void => reiniciar();
  janela.addEventListener('keydown', aoTecla);
  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  // Sem `destruir()` no contrato de `Cena` (ainda não há um diretor de cenas que troque a atual por outra e
  // precise desligar listeners — ver handoff da Lyra, M1a, pendências): aceitável aqui porque esta cena só
  // existe uma vez por corrida, dentro de `jogo.ts`.

  let ticks = 0;
  return {
    id: 'resultado',
    atualizar() {
      ticks += 1;
    },
    desenhar(ctx) {
      ctx.save();
      ctx.fillStyle = COR_FUNDO;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
      ctx.textAlign = 'center';
      ctx.fillStyle = COR_TEXTO;
      ctx.font = 'italic 800 56px "Barlow Condensed", sans-serif';
      ctx.fillText('CHEGOU!', LARGURA / 2, ALTURA * 0.35);
      ctx.font = '700 32px Barlow, sans-serif';
      ctx.fillText(`${opcoes.dados.pontos} pontos`, LARGURA / 2, ALTURA * 0.35 + 56);
      ctx.font = '600 20px Barlow, sans-serif';
      ctx.fillText(`${(opcoes.dados.ticks / 60).toFixed(1)} s`, LARGURA / 2, ALTURA * 0.35 + 92);
      if (ticks % 60 < 40) {
        ctx.font = '600 18px Barlow, sans-serif';
        ctx.fillText('toque ou aperte ESPAÇO para jogar de novo', LARGURA / 2, ALTURA * 0.35 + 140);
      }
      ctx.restore();
    },
  };
}
