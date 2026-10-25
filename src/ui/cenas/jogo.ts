/**
 * Cena "jogo" do M1a/Fase 1: compõe descida -> resultado -> descida de novo (reinício em 1 toque, plano §1 pilar 4)
 * ou resultado -> menu principal quando `aoMenu` é fornecido.
 *
 * Pausa (feedback do dono, playtest iPhone: "durante a partida não dá pra pausar"): `criarControladorPausa`
 * (`ui/cenas/pausa.ts`) é montado UMA vez aqui e sobrevive a reinícios da descida -- `descida.ts` chama
 * `aoPausar`/`aoChegada` (tecla Esc/P, botão do HUD, ou borda de chegada), e esta cena congela a descida (para
 * de chamar `atualizar()`) e desenha o painel por cima. CONFIGURAÇÕES reaproveita a cena de Opções de verdade
 * (`criarTelaOpcoes`, injetada pelo `gerenciador.ts`): a pausa fica "suspensa" (sem desenhar/reagir) enquanto ela
 * está à mostra, e volta ao fechar.
 */
import type { ReplayV1 } from '../../core/contratos';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { AudioDestravavel } from '../../audio/index';
import type { SaveV1 } from '../../meta/tipos';
import type { Cena } from '../tipos';
import { criarCortinaNevasca } from '../transicao';
import { criarCenaDescida, type ResultadoDescida } from './descida';
import { criarControladorPausa, type ControladorPausa } from './pausa';
import { criarCenaResultado } from './resultado';

export interface OpcoesCenaJogo {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly aoMenu?: (() => void) | undefined;
  readonly audio?: AudioDestravavel | undefined;
  readonly save?: SaveV1 | undefined;
  /** Id do personagem escolhido (seleção de personagem, UI); repassado direto à cena de descida. */
  readonly personagem?: string | undefined;
  /** Id da pista a carregar; repassado direto a `OpcoesCenaDescida.pista` (padrão `morro-do-pinhao`). */
  readonly pista?: string | undefined;
  /** Fantasma a correr junto na descida; repassado direto a `OpcoesCenaDescida.fantasma`. */
  readonly fantasma?: ReplayV1 | undefined;
  /** Chamado a cada chegada, ANTES de montar a tela de resultado (quem persiste recorde/fantasma, ver `gerenciador.ts`). */
  readonly aoResultado?: ((resultado: ResultadoDescida) => void) | undefined;
  /** Monta a cena de Opções de verdade (gerenciador.ts), com o `aoVoltar` que o CHAMADO (aqui) decide -- usada
   *  pelo botão CONFIGURAÇÕES do menu de pausa. Sem ela, o botão fica inerte (testes que não a fornecem). */
  readonly criarTelaOpcoes?: ((aoVoltar: () => void) => Cena) | undefined;
}

export function criarCenaJogo(opcoes: OpcoesCenaJogo): Cena {
  let jogoAtual: Cena | null = null;
  let telaConfig: Cena | null = null;
  // Plano C-D6 ("reinicia só antes de cruzar"): posto a `true` no tick da chegada (`aoChegada`), antes mesmo da
  // comemoração acabar -- desliga o REINICIAR do menu de pausa a partir desse instante.
  let jaChegou = false;
  // "Nevasca" (§10.1) entre descida/resultado -- sempre "pra frente" (não há caminho de volta dentro desta
  // cena): ver cabeçalho de `ui/transicao.ts` sobre a cena antiga ser destruída já (ninguém testa o `id` desta
  // sub-cena no meio do caminho).
  const nevasca = criarCortinaNevasca({ canvas: opcoes.canvas, janela: opcoes.janela });

  /** Destrói a sub-cena atual JÁ e só constrói a próxima no início da revelação (§10.1 passo 4). */
  function trocarComNevasca(construir: () => Cena): void {
    jogoAtual?.destruir?.();
    jogoAtual = null;
    nevasca.iniciar('frente', () => {
      jogoAtual = construir();
    });
  }

  const pausa: ControladorPausa = criarControladorPausa({
    canvas: opcoes.canvas,
    janela: opcoes.janela,
    podeReiniciar: () => !jaChegou,
    aoContinuar: () => undefined,
    aoReiniciar: () => {
      trocarComNevasca(montarDescida);
    },
    aoAbrirConfiguracoes: () => {
      if (!opcoes.criarTelaOpcoes) return;
      pausa.suspender();
      telaConfig = opcoes.criarTelaOpcoes(() => {
        telaConfig?.destruir?.();
        telaConfig = null;
        pausa.retomar();
      });
    },
    aoConfirmarSaidaAoMenu: () => opcoes.aoMenu?.(),
  });

  function montarDescida(): Cena {
    jogoAtual?.destruir?.();
    jaChegou = false;
    return criarCenaDescida({
      canvas: opcoes.canvas,
      janela: opcoes.janela,
      documento: opcoes.documento,
      aoPausar: () => pausa.abrir(),
      aoChegada: () => {
        jaChegou = true;
      },
      audio: opcoes.audio,
      save: opcoes.save,
      personagem: opcoes.personagem,
      pista: opcoes.pista,
      fantasma: opcoes.fantasma,
      aoTerminar: (resultado) => {
        opcoes.aoResultado?.(resultado);
        trocarComNevasca(() =>
          criarCenaResultado({
            dados: resultado,
            canvas: opcoes.canvas,
            janela: opcoes.janela,
            aoReiniciar: () => trocarComNevasca(montarDescida),
            aoMenu: opcoes.aoMenu,
          }),
        );
      },
    });
  }

  jogoAtual = montarDescida();

  return {
    id: 'jogo',
    atualizar() {
      if (telaConfig) {
        telaConfig.atualizar();
        return;
      }
      if (pausa.pausado) return; // congela a descida/resultado por baixo enquanto o menu de pausa está aberto
      nevasca.atualizar(); // no-op fora de transição; constrói a sub-cena nova ao fim de cobrir+segurar
      if (!nevasca.congelando) jogoAtual?.atualizar(); // 'revelando': a sub-cena nova já tica a própria entrada
    },
    desenhar(ctx, alpha) {
      if (telaConfig) {
        telaConfig.desenhar(ctx, alpha);
        return;
      }
      if (nevasca.emTransicao) nevasca.desenhar(ctx, alpha, (c, a) => jogoAtual?.desenhar(c, a));
      else jogoAtual?.desenhar(ctx, alpha);
      pausa.desenhar(ctx);
    },
    destruir() {
      jogoAtual?.destruir?.();
      telaConfig?.destruir?.();
      pausa.destruir();
      nevasca.destruir();
    },
    aoPausarAutomatico() {
      // Só abre a pausa se há de fato uma descida rolando (resultado/tela de config não precisam disto).
      if (!telaConfig && jogoAtual?.id === 'descida') pausa.abrir();
    },
  };
}
