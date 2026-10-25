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
import { criarTrilhaMusical, type TrilhaMusical } from '../../audio/index';
import { iniciarCampeonato, registrarResultado, situacao } from '../../meta/campeonato';
import type { ArmazenamentoLike, Recorde, ReplayOpaco, SaveV1 } from '../../meta/tipos';
import { inserirFantasma, inserirRecorde, salvarSave } from '../../meta/storage';
import type { Ctx } from '../../platform/canvas';
import { alternarTelaCheia, situacaoDaTelaCheia, type AlvoTelaCheia } from '../../platform/tela-cheia';
import type { Cena } from '../tipos';
import { criarCortinaNevasca } from '../transicao';
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
  // Trilha musical REAL (pedido do dono, 2026-10-24: "musicas reais" -- `docs/creditos-musica.md`), UM só
  // ganho mestre pro fluxo inteiro (sobrevive à troca de cena, senão cada `irPara` cortaria o crossfade no meio).
  // Quem decide QUAL faixa toca em cada cena de TOPO é este arquivo (menu/treino, abaixo) OU, pro campeonato (5
  // pistas em sequência + pódio), a própria `campeonato.ts` (só ela sabe em qual etapa está).
  const trilha: TrilhaMusical | null = opcoes.audio ? criarTrilhaMusical(opcoes.audio, { obterVolumeMusica: () => opcoes.save.cfg.musica }) : null;
  // "Nevasca" (guia de UI premium do Apolo, `docs/direcao-ui-premium.md` §10.1): transição padrão entre TODAS as
  // cenas de topo (menu <-> seleção <-> jogo/campeonato/opções) -- criada ANTES da 1ª cena pra seus ouvintes de
  // bloqueio (toque/tecla) terem prioridade de registro sobre os de qualquer sub-cena (ver cabeçalho de
  // `ui/transicao.ts`).
  const nevasca = criarCortinaNevasca({ canvas: opcoes.canvas, janela });
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

  /** Campeonato em andamento (etapa < 5) pro menu oferecer "Continuar"; `null` se nunca começou ou já decidiu. */
  const obterCampeonatoEmAndamento = (): EstadoCampeonato | null => {
    const atual = opcoes.save.campeonato;
    return atual && atual.etapa < 5 ? atual : null;
  };

  /** "Continuar" do menu (pedido do dono, playtest iPhone): pula a seleção de personagem -- o campeonato em
   *  andamento já tem o SEU próprio personagem (`EstadoCampeonato.personagem`), que `iniciarOuRetomarCampeonato`
   *  devolve de qualquer forma (ver comentário dela: "continuidade de progresso vale mais que a escolha mais
   *  recente"). Vai direto pra `campeonato`, sem passar por `selecao`. */
  const continuarCampeonato = (): void => {
    proximaCenaAposSelecao = null;
    trocar('campeonato');
  };

  /** "Novo jogo" do menu (pedido do dono): só é chamado depois que `ui/cenas/menu.ts` já confirmou com o jogador
   *  que o progresso atual será perdido. Apaga o `EstadoCampeonato` salvo e segue o fluxo de sempre (escolhe
   *  personagem -> `iniciarOuRetomarCampeonato` cria um novo, pois não há mais nenhum em andamento). */
  const novoCampeonato = (): void => {
    delete (opcoes.save as { campeonato?: EstadoCampeonato }).campeonato;
    persistirConfig();
    proximaCenaAposSelecao = 'campeonato';
    trocar('selecao');
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
          aoAvancar: () => trocar('menu'),
        });
      case 'menu':
        trilha?.tocar('menu');
        return criarCenaMenu({
          canvas,
          janela,
          documento: doc,
          // TREINO/CAMPEONATO passam pela seleção de personagem antes de correr (feedback do dono): quem clicou
          // decide o DESTINO depois de escolher; a entrada dedicada "PERSONAGEM" (abaixo) não tem destino --
          // continua só trocando o ativo, como sempre.
          aoJogar: () => {
            proximaCenaAposSelecao = 'jogo';
            trocar('selecao');
          },
          aoModos: () => {
            proximaCenaAposSelecao = 'campeonato';
            trocar('selecao');
          },
          aoOpcoes: () => trocar('opcoes'),
          aoPersonagem: () => {
            proximaCenaAposSelecao = null;
            trocar('selecao');
          },
          aoPista: () => trocar('selecao-pista'),
          obterPersonagemAtivo,
          obterPistaAtiva,
          obterCampeonatoEmAndamento,
          aoContinuarCampeonato: continuarCampeonato,
          aoNovoCampeonato: novoCampeonato,
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
              trocar(destino);
            }
          },
          aoVoltar: () => {
            proximaCenaAposSelecao = null;
            trocar('menu');
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
          aoVoltar: () => trocar('menu'),
        });
      case 'opcoes':
        return montarOpcoes(() => trocar('menu'));
      case 'jogo': {
        // Treino sempre roda a MESMA pista do início ao fim (sem etapas): dá pra decidir a faixa aqui mesmo, uma
        // vez, sem `jogo.ts`/`descida.ts` precisarem saber de música (diferente do campeonato, 5 pistas em sequência).
        const pistaDoTreino = PISTAS_DE_DADOS.find((p) => p.id === obterPistaAtiva());
        trilha?.tocar(pistaDoTreino?.musica ?? 'menu');
        // `criarCenaJogo` já gerencia descida -> resultado -> descida internamente, e o próprio menu de pausa
        // (Esc/P, botão do HUD) por cima -- `criarTelaOpcoes` é o CONFIGURAÇÕES de dentro da pausa.
        return criarCenaJogo({
          canvas,
          janela,
          documento: doc,
          aoMenu: () => trocar('menu'),
          audio: opcoes.audio,
          save: opcoes.save,
          personagem: obterPersonagemAtivo(),
          pista: obterPistaAtiva(),
          fantasma: obterFantasma(obterPistaAtiva()),
          aoResultado: registrarResultadoDescida,
          criarTelaOpcoes: montarOpcoes,
        });
      }
      case 'campeonato':
        // Campeonato completo (plano "corrida em campeonato" §C5b/C8b): as 5 pistas em sequência, com
        // standings/oficina entre elas e a tela final. A pista ativa do menu NÃO entra aqui -- o campeonato
        // sempre corre as 5 na ordem fixa de progressão, começando pela 1ª (ou retomando onde parou).
        // `trilha` entra aqui (e só aqui) porque é a ÚNICA cena com várias pistas/pódio em sequência -- só ela
        // sabe em qual etapa está pra trocar de faixa (ver `campeonato.ts`).
        return criarCenaCampeonato({
          canvas,
          janela,
          documento: doc,
          aoMenu: () => trocar('menu'),
          audio: opcoes.audio,
          trilha: trilha ?? undefined,
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

  /**
   * Troca "de verdade" (com a Nevasca, §10.1): usada por TODA navegação disparada por um toque/tecla real dentro
   * das cenas (os callbacks de `construirCena`/`continuarCampeonato`/`novoCampeonato`, abaixo -- NUNCA pela API
   * pública `irPara`, ver cabeçalho dela).
   */
  function trocar(id: IdCenaFluxo): void {
    if (id === idAtual && cenaAtual) return;
    // Direção da Nevasca (§10.1): "voltar" é sempre o destino 'menu' (todo caminho de volta deste fluxo leva lá
    // -- selecao/selecao-pista/opcoes/jogo/campeonato só voltam PRO menu, nunca um pro outro); qualquer outro
    // destino é "pra frente".
    const direcao = id === 'menu' ? 'volta' : 'frente';
    // A cena antiga é destruída JÁ (seus ouvintes não podem sobreviver) -- o que fica visível por baixo da
    // Nevasca enquanto ela cobre é só o ÚLTIMO QUADRO already desenhado (nada limpa o canvas entre quadros, ver
    // cabeçalho de `ui/transicao.ts`). BUG achado pela Lyra das telas premium (memória
    // `nevasca-cortina-bloqueia-input-apos-cenaatual-flip`): `idAtual` NÃO pode virar o destino antes da hora --
    // um teste/jogador que espera `cenaAtual() === destino` e só então toca cairia na janela de "cobrir/segurar"
    // (toque bloqueado) e o toque seria engolido em silêncio. Por isso `idAtual` só é atualizado DENTRO do
    // callback de `nevasca.iniciar`, junto com `construirCena` -- no exato instante em que o bloqueio de entrada
    // já caiu (início de "revelar"). `cenaAtual()`/o hook de depuração passam a refletir com fidelidade "dá pra
    // tocar agora", não "o pedido de troca foi feito".
    cenaAtual?.destruir?.();
    cenaAtual = null;
    nevasca.iniciar(direcao, () => {
      idAtual = id;
      cenaAtual = construirCena(id);
    });
  }

  /**
   * API pública (`GerenciadorCenas.irPara`, usada por testes e pelo hook de depuração `window.__neve`): troca
   * INSTANTÂNEA, sem Nevasca -- contrato de sempre, preservado de propósito. Ferramentas que pulam direto entre
   * cenas (ex. `tests/e2e/fantasma.spec.ts` chamando `irPara('menu'); irPara('jogo');` de volta a volta, sem
   * ticks entre as chamadas) não podem ficar à mercê de uma animação de ~0,67s nem da regra "só uma transição
   * por vez" da Nevasca -- por isso a navegação real (toque/tecla, via `trocar` acima) e o atalho de teste/devtool
   * são dois caminhos deliberadamente separados.
   */
  function irPara(id: IdCenaFluxo): void {
    if (id === idAtual && cenaAtual) return;
    cenaAtual?.destruir?.();
    idAtual = id;
    cenaAtual = construirCena(id);
  }

  // monta a primeira cena já na criação
  cenaAtual = construirCena(idAtual);

  return {
    id: 'gerenciador',
    atualizar() {
      // Sempre (qualquer cena de topo, inclusive transição): sincroniza volume/mudo/duck com as Opções a cada
      // quadro -- é só AQUI, não em cada cena, porque é o único ponto que sobrevive à troca de cena inteira.
      trilha?.atualizar();
      nevasca.atualizar(); // no-op fora de transição; chama `construirCena` por dentro ao fim de cobrir+segurar
      if (!nevasca.congelando) cenaAtual?.atualizar(); // 'revelando': a cena NOVA já tica a própria entrada
    },
    desenhar(ctx: Ctx, alpha: number) {
      if (nevasca.emTransicao) nevasca.desenhar(ctx, alpha, (c, a) => cenaAtual?.desenhar(c, a));
      else cenaAtual?.desenhar(ctx, alpha);
    },
    destruir() {
      cenaAtual?.destruir?.();
      nevasca.destruir();
      trilha?.parar();
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