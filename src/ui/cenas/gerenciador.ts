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
import type { EstadoCampeonato, Evolucao, IdPersonagem, ReplayV1, ResultadoCorrida } from '../../core/contratos';
import { validarReplayV1 } from '../../core/replay';
import { comprarNivel } from '../../data/evolucao';
import { PISTA_MORRO_DO_PINHAO, PISTAS_DE_DADOS } from '../../data/pistas';
import { REGRAS_SAVE, VERSAO_PROVISORIA_DA_PISTA } from '../../data/regras-save';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { AudioDestravavel } from '../../audio/index';
import { iniciarCampeonato, registrarResultado, situacao } from '../../meta/campeonato';
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
  // Fluxo "escolha o personagem antes de correr" (feedback do dono): setado só quando TREINO/CAMPEONATO leva à
  // seleção; a entrada "PERSONAGEM" do menu (navegação livre, sem destino) deixa isto em `null` -- nesse caso
  // `aoEscolher` só persiste e fica na tela (comportamento de sempre, ver `ui/cenas/selecao.ts`).
  let proximaCenaAposSelecao: 'jogo' | 'campeonato' | null = null;

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

  /** Evolução entre campeonatos (plano C-D3/C-D4): carteira de flocos + nível por personagem; ausente = nunca comprou. */
  const obterEvolucao = (): Evolucao => opcoes.save.evolucao ?? { flocos: 0, niveis: {} };

  /**
   * Inicia/retoma o campeonato (plano §C5b: "salva após cada corrida, dá pra retomar no meio"): se já existe um
   * `EstadoCampeonato` com etapa < 5 no save, RETOMA ele (mesmo que o personagem escolhido no menu agora seja
   * outro — continuidade de progresso vale mais que a escolha mais recente). Só começa um campeonato NOVO quando
   * não há nenhum em andamento, ou o anterior já tinha decidido (etapa 5). Semente derivada do relógio (não
   * `Math.random`, proibido em `src/`) — mesmo espírito do "desafio do dia" de `diario`.
   */
  const iniciarOuRetomarCampeonato = (personagem: string): EstadoCampeonato => {
    const existente = opcoes.save.campeonato;
    if (existente && existente.etapa < 5) return existente;
    const novo = iniciarCampeonato(Date.now() >>> 0, personagem);
    opcoes.save.campeonato = novo;
    persistirConfig();
    return novo;
  };

  /**
   * Registra o pódio COMPLETO de UMA pista do campeonato (avança a etapa, credita os flocos da corrida na
   * carteira de evolução e, se essa foi a 5ª pista e o jogador venceu, grava o troféu — plano C-D9). Único ponto
   * de escrita desses três campos (mesma convenção de `registrarResultadoDescida`).
   */
  const registrarResultadoCampeonato = (resultado: ResultadoCorrida): EstadoCampeonato => {
    const atual = opcoes.save.campeonato ?? iniciarOuRetomarCampeonato(obterPersonagemAtivo());
    const jogador: IdPersonagem = atual.personagem;
    const novoEstado = registrarResultado(atual, resultado, jogador);
    opcoes.save.campeonato = novoEstado;

    const evolucaoAtual = obterEvolucao();
    opcoes.save.evolucao = { ...evolucaoAtual, flocos: evolucaoAtual.flocos + resultado.flocosGanhos };

    if (novoEstado.etapa >= 5 && situacao(novoEstado.pistasConcluidas, jogador, PISTAS_DE_DADOS.length) === 'vencido') {
      const trofeusAtuais = opcoes.save.trofeus ?? [];
      if (!trofeusAtuais.includes(jogador)) opcoes.save.trofeus = [...trofeusAtuais, jogador];
    }

    persistirConfig();
    return novoEstado;
  };

  /** Compra um nível de evolução do personagem (`data/evolucao.ts` → `comprarNivel`, pura); persiste se comprou. */
  const comprarUpgradeCampeonato = (personagem: string): Evolucao => {
    const { evolucao: novaEvolucao, comprou } = comprarNivel(obterEvolucao(), personagem);
    if (comprou) {
      opcoes.save.evolucao = novaEvolucao;
      persistirConfig();
    }
    return opcoes.save.evolucao ?? novaEvolucao;
  };

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

  /** Monta a cena de Opções de verdade com `aoVoltar` escolhido por quem chama -- reusada pelo `case 'opcoes'`
   *  (volta ao menu) E pelo menu de pausa de `jogo.ts`/`campeonato.ts` (volta pra pausa), plano "CONFIGURAÇÕES
   *  reaproveita a cena de opções existente". Único lugar que monta `criarCenaOpcoes`, pra nunca desalinhar os
   *  callbacks de save das duas entradas. */
  function montarOpcoes(aoVoltar: () => void): Cena {
    return criarCenaOpcoes({
      canvas: opcoes.canvas,
      janela,
      obterControles: () => opcoes.save.cfg.controles,
      obterAudioLigado: () => opcoes.save.cfg.som > 0 || opcoes.save.cfg.musica > 0,
      aoAlternarControles: alternarControles,
      aoAlternarAudio: alternarAudio,
      aoTelaCheia: acionarTelaCheia,
      aoVoltar,
    });
  }

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
          // TREINO/CAMPEONATO passam pela seleção de personagem antes de correr (feedback do dono): quem clicou
          // decide o DESTINO depois de escolher; a entrada dedicada "PERSONAGEM" (abaixo) não tem destino --
          // continua só trocando o ativo, como sempre.
          aoJogar: () => {
            proximaCenaAposSelecao = 'jogo';
            irPara('selecao');
          },
          aoModos: () => {
            proximaCenaAposSelecao = 'campeonato';
            irPara('selecao');
          },
          aoOpcoes: () => irPara('opcoes'),
          aoPersonagem: () => {
            proximaCenaAposSelecao = null;
            irPara('selecao');
          },
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
          obterEvolucao,
          aoEscolher: (idPersonagem) => {
            selecionarPersonagem(idPersonagem);
            // Veio de TREINO/CAMPEONATO: escolheu -> corre direto. Veio da entrada "PERSONAGEM" (navegação
            // livre): fica na tela, pra poder comparar outros cards antes de VOLTAR (comportamento de sempre).
            if (proximaCenaAposSelecao) {
              const destino = proximaCenaAposSelecao;
              proximaCenaAposSelecao = null;
              irPara(destino);
            }
          },
          aoVoltar: () => {
            proximaCenaAposSelecao = null;
            irPara('menu');
          },
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
        return montarOpcoes(() => irPara('menu'));
      case 'jogo':
        // `criarCenaJogo` já gerencia descida -> resultado -> descida internamente, e o próprio menu de pausa
        // (Esc/P, botão do HUD) por cima -- `criarTelaOpcoes` é o CONFIGURAÇÕES de dentro da pausa.
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
          criarTelaOpcoes: montarOpcoes,
        });
      case 'campeonato':
        // Campeonato completo (plano "corrida em campeonato" §C5b/C8b): as 5 pistas em sequência, com
        // standings/oficina entre elas e a tela final. A pista ativa do menu NÃO entra aqui -- o campeonato
        // sempre corre as 5 na ordem fixa de progressão, começando pela 1ª (ou retomando onde parou).
        return criarCenaCampeonato({
          canvas,
          janela,
          documento: doc,
          aoMenu: () => irPara('menu'),
          audio: opcoes.audio,
          save: opcoes.save,
          personagem: obterPersonagemAtivo(),
          aoIniciarCampeonato: iniciarOuRetomarCampeonato,
          aoRegistrarResultadoCampeonato: registrarResultadoCampeonato,
          aoComprarUpgrade: comprarUpgradeCampeonato,
          obterEvolucao,
          criarTelaOpcoes: montarOpcoes,
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
    // Repassa a perda de foco/visibilidade pra cena de verdade (main.ts chama isto além de `laco.pausar`): só
    // `jogo.ts`/`campeonato.ts` fazem algo com isto (abrem o menu de pausa se houver uma corrida rolando).
    aoPausarAutomatico() {
      cenaAtual?.aoPausarAutomatico?.();
    },
    irPara,
    cenaAtual: () => idAtual,
  };
}