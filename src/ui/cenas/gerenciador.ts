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
import type { ReplayV1 } from '../../core/contratos';
import { validarReplayV1 } from '../../core/replay';
import { PISTA_MORRO_DO_PINHAO } from '../../data/pistas';
import { REGRAS_SAVE, VERSAO_PROVISORIA_DA_PISTA } from '../../data/regras-save';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { AudioDestravavel } from '../../audio/index';
import type { ArmazenamentoLike, Recorde, ReplayOpaco, SaveV1 } from '../../meta/tipos';
import { inserirFantasma, inserirRecorde, salvarSave } from '../../meta/storage';
import type { Ctx } from '../../platform/canvas';
import { alternarTelaCheia, situacaoDaTelaCheia, type AlvoTelaCheia } from '../../platform/tela-cheia';
import type { Cena } from '../tipos';
import { criarCenaAbertura } from './abertura';
import { criarCenaCampeonato } from './campeonato';
import type { ResultadoDescida } from './descida';
import { criarCenaJogo } from './jogo';
import { criarCenaMenu } from './menu';
import { criarCenaOpcoes } from './opcoes';
import { criarCenaSelecao } from './selecao';
import { criarCenaSelecaoPista } from './selecao-pista';

/** Nome de cada cena do fluxo, para depuração/testes (o `id` que `Cena` já carrega). */
export type IdCenaFluxo = 'abertura' | 'menu' | 'jogo' | 'campeonato' | 'opcoes' | 'selecao' | 'selecao-pista';

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

  /**
   * Substitui o CONTEÚDO do save em memória pelo `novo` (mesma identidade de objeto: quem guardou a referência de
   * `opcoes.save` — ex. `criarCenaDescida` lendo `cfg.som` ao vivo — continua vendo os campos atualizados). Chaves
   * que `novo` não tem (ex. `fantasmas` ficou vazio de novo) são removidas, não deixadas penduradas do save antigo.
   */
  function aplicarSave(novo: SaveV1): void {
    const alvo = opcoes.save as unknown as Record<string, unknown>;
    const fonte = novo as unknown as Record<string, unknown>;
    for (const chave of new Set([...Object.keys(alvo), ...Object.keys(fonte)])) {
      if (Object.hasOwn(fonte, chave)) alvo[chave] = fonte[chave];
      else delete alvo[chave];
    }
  }

  /** Fantasma salvo desta pista, já validado como `ReplayV1` (save guarda opaco; `sanearFantasmas` só confere forma/tamanho). */
  function obterFantasma(pista: string): ReplayV1 | undefined {
    const bruto = opcoes.save.fantasmas?.[pista];
    if (bruto === undefined) return undefined;
    const r = validarReplayV1(bruto);
    return r.ok ? r.valor : undefined;
  }

  /**
   * Registra recorde + fantasma ao fim de UMA descida (C6): sempre tenta o recorde; o fantasma (replay completo,
   * mais caro) só é gravado quando o recorde bate o #1 da pista — fantasma é "a melhor descida", não um histórico.
   * Único ponto de escrita de recorde/fantasma (mesma convenção de `persistirConfig` para a config).
   */
  function registrarResultadoDescida(resultado: ResultadoDescida): void {
    const replay = resultado.replay;
    if (!replay) return; // dublê de teste sem motor real por baixo: nada para persistir
    const recorde: Recorde = {
      pontos: resultado.pontos,
      ticks: resultado.ticks,
      personagem: replay.personagem,
      versaoPista: REGRAS_SAVE.versaoPista[replay.pista] ?? VERSAO_PROVISORIA_DA_PISTA,
      quando: new Date().toISOString(),
    };
    const { save: comRecorde, posicao } = inserirRecorde(opcoes.save, replay.pista, recorde, REGRAS_SAVE);
    const comFantasma = posicao === 0 ? inserirFantasma(comRecorde, replay.pista, replay as unknown as ReplayOpaco, REGRAS_SAVE) : comRecorde;
    aplicarSave(comFantasma);
    persistirConfig();
  }

  /** Personagem ativo: escolha do jogador, ou o primeiro inicial do catálogo quando ele nunca escolheu (implícito, nunca gravado por padrão). */
  const obterPersonagemAtivo = (): string => opcoes.save.personagemAtivo ?? REGRAS_SAVE.iniciais[0] ?? 'capi';

  const selecionarPersonagem = (id: string): void => {
    opcoes.save.personagemAtivo = id;
    persistirConfig();
  };

  /** Pista ativa: escolha do jogador, ou a primeira inicial do catálogo quando ele nunca escolheu (mesma convenção de `obterPersonagemAtivo`). */
  const obterPistaAtiva = (): string => opcoes.save.pistaAtiva ?? REGRAS_SAVE.pistasIniciais[0] ?? PISTA_MORRO_DO_PINHAO.id;

  const selecionarPista = (id: string): void => {
    opcoes.save.pistaAtiva = id;
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
          aoModos: () => irPara('campeonato'),
          aoOpcoes: () => irPara('opcoes'),
          aoPersonagem: () => irPara('selecao'),
          aoPista: () => irPara('selecao-pista'),
          obterPersonagemAtivo,
          obterPistaAtiva,
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
      case 'selecao-pista':
        return criarCenaSelecaoPista({
          canvas,
          janela,
          documento: doc,
          catalogo: REGRAS_SAVE.pistas,
          obterPistaAtiva,
          aoEscolher: selecionarPista,
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
          pista: obterPistaAtiva(),
          fantasma: obterFantasma(obterPistaAtiva()),
          aoResultado: registrarResultadoDescida,
        });
      case 'campeonato':
        // Por ora roda UMA corrida na pista ativa (plano "corrida em campeonato" §C2b); o fluxo de campeonato
        // completo com várias etapas (C5a/C5b) troca o `aoMenu` abaixo por "próxima etapa", sem mudar mais nada.
        return criarCenaCampeonato({
          canvas,
          janela,
          documento: doc,
          aoMenu: () => irPara('menu'),
          audio: opcoes.audio,
          save: opcoes.save,
          personagem: obterPersonagemAtivo(),
          pista: obterPistaAtiva(),
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