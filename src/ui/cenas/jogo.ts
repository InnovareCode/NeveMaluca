/**
 * Cena "jogo" do M1a: compõe descida -> resultado -> descida de novo (reinício em 1 toque, plano §1 pilar 4).
 * É o ponto de integração que falta plugar em `src/main.ts` no lugar de `criarCenaBoot` (main.ts é NÃO-toque
 * para a Lyra — ver handoff, "PARA O PRÓXIMO"). Hoje o motor por trás é o `motor-teste.ts` (roteirizado); quando
 * `src/descida/` e `src/pista/` da Vega existirem, troca-se só o que `criarCenaDescida` usa por dentro.
 */
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Cena } from '../tipos';
import { criarCenaDescida } from './descida';
import { criarCenaResultado } from './resultado';

export interface OpcoesCenaJogo {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly aoPausar?: (() => void) | undefined;
}

export function criarCenaJogo(opcoes: OpcoesCenaJogo): Cena {
  let atual: Cena = montarDescida();

  function montarDescida(): Cena {
    return criarCenaDescida({
      canvas: opcoes.canvas,
      janela: opcoes.janela,
      documento: opcoes.documento,
      aoPausar: opcoes.aoPausar,
      aoTerminar: (resultado) => {
        atual = criarCenaResultado({
          dados: resultado,
          canvas: opcoes.canvas,
          janela: opcoes.janela,
          aoReiniciar: () => {
            atual = montarDescida();
          },
        });
      },
    });
  }

  return {
    id: 'jogo',
    atualizar() {
      atual.atualizar();
    },
    desenhar(ctx, alpha) {
      atual.desenhar(ctx, alpha);
    },
  };
}
