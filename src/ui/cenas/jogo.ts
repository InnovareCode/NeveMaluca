/**
 * Cena "jogo" do M1a/Fase 1: compõe descida -> resultado -> descida de novo (reinício em 1 toque, plano §1 pilar 4)
 * ou resultado -> menu principal quando `aoMenu` é fornecido.
 */
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { AudioDestravavel } from '../../audio/index';
import type { SaveV1 } from '../../meta/tipos';
import type { Cena } from '../tipos';
import { criarCenaDescida } from './descida';
import { criarCenaResultado } from './resultado';

export interface OpcoesCenaJogo {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly aoPausar?: (() => void) | undefined;
  readonly aoMenu?: (() => void) | undefined;
  readonly audio?: AudioDestravavel | undefined;
  readonly save?: SaveV1 | undefined;
}

export function criarCenaJogo(opcoes: OpcoesCenaJogo): Cena {
  let atual: Cena | null = null;

  function montarDescida(): Cena {
    atual?.destruir?.();
    return criarCenaDescida({
      canvas: opcoes.canvas,
      janela: opcoes.janela,
      documento: opcoes.documento,
      aoPausar: opcoes.aoPausar,
      audio: opcoes.audio,
      save: opcoes.save,
      aoTerminar: (resultado) => {
        atual?.destruir?.();
        atual = criarCenaResultado({
          dados: resultado,
          canvas: opcoes.canvas,
          janela: opcoes.janela,
          aoReiniciar: () => {
            atual = montarDescida();
          },
          aoMenu: opcoes.aoMenu,
        });
      },
    });
  }

  atual = montarDescida();

  return {
    id: 'jogo',
    atualizar() {
      atual?.atualizar();
    },
    desenhar(ctx, alpha) {
      atual?.desenhar(ctx, alpha);
    },
    destruir() {
      atual?.destruir?.();
    },
  };
}
