/**
 * Orquestrador (diretor) de cenas da Fase 1.
 *
 * Fluxo: Abertura (splash) -> Menu -> Opções/Jogo -> Resultado -> Menu (ou nova descida).
 *
 * Por que um diretor e não `main.ts` trocando variáveis: cada cena ouve eventos (toque/tecla) e precisa
 * **desligá-los** quando sai, senão o menu receberia o toque que era do jogo, e a cena antiga manteria
 * ouvintes vivos para sempre (vazamento + toque fantasma). Por isso `Cena` ganhou `destruir()` opcional
 * (`ui/tipos.ts`) e este diretor é o único lugar que a chama — inclusive na troca de cena do M1a.
 *
 * O estado do save (audio on/off, modo de controles) mora aqui, com UM ponto de gravação (`salvarSave`),
 * conforme o comentário de C4. A tela de opções só avisa "alternou"; quem grava é este arquivo.
 */
import { REGRAS_SAVE } from '../../data/regras-save';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { AudioDestravavel } from '../../audio/index';
import type { ArmazenamentoLike, SaveV1 } from '../../meta/tipos';
import { salvarSave } from '../../meta/storage';
import type { Ctx } from '../../platform/canvas';
import { alternarTelaCheia, situacaoDaTelaCheia, type AlvoTelaCheia } from '../../platform/tela-cheia';
import type { Cena } from '../tipos';
import { criarCenaAbertura } from './abertura';
import { criarCenaJogo } from './jogo';
import { criarCenaMenu } from './menu';
import { criarCenaOpcoes } from './opcoes';
import { criarCenaSelecao } from './selecao';

/** Nome de cada cena do fluxo, para depuração/testes (o `id` que `Cena` já carrega). */
export type IdCenaFluxo = 'abertura' | 'menu' | 'jogo' | 'opcoes' | 'selecao';

export interface OpcoesGerenciador {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly save: SaveV1;
  readonly armazenamento?: ArmazenamentoLike | undefined;
  /** Áudio destravável (de main.ts), repassado à cena de descida para o som das manobras. */
  readonly audio?: AudioDestravavel | undefined;
  /** Alvo da tela cheia; separado para permitir testes em Node sem DOM. */
  readonly alvoTelaCheia?: AlvoTelaCheia | undefined;
  /** Ponto de entrada da cena de abertura; por padrão já começa na abertura. */
  readonly cenaInicial?: IdCenaFluxo | undefined;
}

export interface GerenciadorCenas extends Cena {
  /** Troca de cena na mão (usado por testes e pelo hook de dev). Devolve o id novo. */
  irPara(id: IdCenaFluxo): void;
  /** Id da cena em tela. */
  readonly cenaAtual: () => IdCenaFluxo;
}

export function criarGerenciadorCenas(opcoes: OpcoesGerenciador): GerenciadorCenas {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  const alvoTelaCheia = opcoes.alvoTelaCheia ?? (typeof window !== 'undefined' ? window : undefined);

  let cenaAtual: Cena | null = null;
  let idAtual: IdCenaFluxo = opcoes.cenaInicial ?? 'abertura';

  /** Grava a config no save (um único ponto de escrita na Fase 1). */
  function persistirConfig(): void {
    if (opcoes.armazenamento) salvarSave(opcoes.armazenamento, opcoes.save, REGRAS_SAVE);
  }

  /** Personagem ativo: escolha do jogador, ou o primeiro inicial do catálogo quando ele nunca escolheu (implícito, nunca gravado por padrão). */
  const obterPersonagemAtivo = (): string => opcoes.save.personagemAtivo ?? REGRAS_SAVE.iniciais[0] ?? 'capi';

  const selecionarPersonagem = (id: string): void => {
    opcoes.save.personagemAtivo = id;
    persistirConfig();
  };

  const alternarControles = (): void => {
    opcoes.save.cfg.controles = opcoes.save.cfg.controles === 'gestos' ? 'botoes' : 'gestos';
    persistirConfig();
  };

  const alternarAudio = (): void => {
    const ligado = opcoes.save.cfg.som > 0 || opcoes.save.cfg.musica > 0;
    if (ligado) {
      opcoes.save.cfg.som = 0;
      opcoes.save.cfg.musica = 0;
    } else {
      opcoes.save.cfg.som = 0.8;
      opcoes.save.cfg.musica = 0.6;
    }
    persistirConfig();
  };

  const acionarTelaCheia = (): void => {
    if (!alvoTelaCheia) return;
    const situacao = situacaoDaTelaCheia(alvoTelaCheia);
    if (situacao === 'disponivel') {
      void alternarTelaCheia(alvoTelaCheia);
    }
    // Se não há API (iPhone e similares), o botão do DOM `platform/tela-cheia-ui.ts` (já montado por Atlas em
    // `main.ts`) mostra o cartão "como ativar" pelo teclado/tecla F; aqui não há o que fazer no canvas.
  };

  /** Constrói a cena do fluxo pedido, já desligando a anterior. */
  function construirCena(id: IdCenaFluxo): Cena {
    const canvas = opcoes.canvas;
    switch (id) {
      case 'abertura':
        return criarCenaAbertura({
          canvas,
          janela,
          documento: doc,
          aoAvancar: () => irPara('menu'),
        });
      case 'menu':
        return criarCenaMenu({
          canvas,
          janela,
          documento: doc,
          aoJogar: () => irPara('jogo'),
          aoOpcoes: () => irPara('opcoes'),
          aoPersonagem: () => irPara('selecao'),
          obterPersonagemAtivo,
        });
      case 'selecao':
        return criarCenaSelecao({
          canvas,
          janela,
          documento: doc,
          catalogo: REGRAS_SAVE.personagens,
          obterPersonagemAtivo,
          aoEscolher: selecionarPersonagem,
          aoVoltar: () => irPara('menu'),
        });
      case 'opcoes':
        return criarCenaOpcoes({
          canvas,
          janela,
          obterControles: () => opcoes.save.cfg.controles,
          obterAudioLigado: () => opcoes.save.cfg.som > 0 || opcoes.save.cfg.musica > 0,
          aoAlternarControles: alternarControles,
          aoAlternarAudio: alternarAudio,
          aoTelaCheia: acionarTelaCheia,
          aoVoltar: () => irPara('menu'),
        });
      case 'jogo':
        // `criarCenaJogo` já gerencia descida -> resultado -> descida internamente; injetamos o "voltar ao menu"
        // como atalho para o jogador não ficar preso na corrida. O `aoPausar` fica no main.ts (Esc/pausa).
        return criarCenaJogo({
          canvas,
          janela,
          documento: doc,
          aoMenu: () => irPara('menu'),
          audio: opcoes.audio,
          save: opcoes.save,
          personagem: obterPersonagemAtivo(),
        });
      default: {
        const nunca: never = id;
        throw new Error(`cena desconhecida: ${String(nunca)}`);
      }
    }
  }

  function trocar(id: IdCenaFluxo): void {
    if (id === idAtual && cenaAtual) return;
    cenaAtual?.destruir?.();
    idAtual = id;
    cenaAtual = construirCena(id);
  }

  function irPara(id: IdCenaFluxo): void {
    trocar(id);
  }

  // monta a primeira cena já na criação
  cenaAtual = construirCena(idAtual);

  return {
    id: 'gerenciador',
    atualizar() {
      cenaAtual?.atualizar();
    },
    desenhar(ctx: Ctx, alpha: number) {
      cenaAtual?.desenhar(ctx, alpha);
    },
    destruir() {
      cenaAtual?.destruir?.();
    },
    irPara,
    cenaAtual: () => idAtual,
  };
}