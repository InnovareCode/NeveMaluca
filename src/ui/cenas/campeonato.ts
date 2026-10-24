/**
 * Cena "campeonato" (plano `docs/plano-corrida-campeonato.md` §C2b): compõe corrida -> pódio -> menu, mesmo
 * padrão de `ui/cenas/jogo.ts` (que compõe descida -> resultado). Por ora roda UMA corrida na pista escolhida
 * (plano §C2b: "por ora pode rodar uma corrida (1ª pista)"); o fluxo de campeonato completo com várias etapas,
 * classificação entre elas e oficina de upgrade (C5a/C5b) ainda não existe -- é só trocar o que `aoContinuar` do
 * pódio faz (hoje sempre `aoMenu`), sem mudar `corrida.ts`/`podio.ts`.
 */
import { PERSONAGENS_DE_DADOS } from '../../data/index';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { AudioDestravavel } from '../../audio/index';
import type { SaveV1 } from '../../meta/tipos';
import type { Cena } from '../tipos';
import { criarCenaCorrida } from './corrida';
import { criarCenaPodio } from './podio';

const NOMES_POR_ID: Readonly<Record<string, string>> = Object.fromEntries(PERSONAGENS_DE_DADOS.map((d) => [d.id, d.nome]));

export interface OpcoesCenaCampeonato {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly aoPausar?: (() => void) | undefined;
  readonly aoMenu?: (() => void) | undefined;
  readonly audio?: AudioDestravavel | undefined;
  readonly save?: SaveV1 | undefined;
  readonly personagem?: string | undefined;
  readonly pista?: string | undefined;
}

export function criarCenaCampeonato(opcoes: OpcoesCenaCampeonato): Cena {
  let atual: Cena | null = null;
  const idJogador = opcoes.personagem ?? 'capi';

  function montarCorrida(): Cena {
    atual?.destruir?.();
    return criarCenaCorrida({
      canvas: opcoes.canvas,
      janela: opcoes.janela,
      documento: opcoes.documento,
      aoPausar: opcoes.aoPausar,
      audio: opcoes.audio,
      save: opcoes.save,
      personagem: opcoes.personagem,
      pista: opcoes.pista,
      aoTerminar: (resultado) => {
        atual?.destruir?.();
        atual = criarCenaPodio({
          resultado,
          nomesPorId: NOMES_POR_ID,
          idJogador,
          canvas: opcoes.canvas,
          janela: opcoes.janela,
          aoContinuar: opcoes.aoMenu,
        });
      },
    });
  }

  atual = montarCorrida();

  return {
    id: 'campeonato',
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
