/**
 * Cena "campeonato" COMPLETO (plano `docs/plano-corrida-campeonato.md` §C5b/C8b): orquestra as 5 pistas em
 * sequência -- abertura -> (corrida -> pódio -> standings -> oficina) × 4 -> corrida -> pódio -> standings ->
 * final -- acumulando a classificação via `meta/campeonato.ts` (`registrarResultado`). Mesmo padrão de composição
 * de `ui/cenas/jogo.ts` (que compõe descida -> resultado), só que com mais etapas.
 *
 * Quem GRAVA é sempre o chamador (gerenciador.ts, "um único ponto de escrita" do save): esta cena só lê
 * `opcoes.save`/`opcoes.obterEvolucao()` e chama os callbacks `aoIniciarCampeonato`/`aoRegistrarResultadoCampeonato`/
 * `aoComprarUpgrade`, que devolvem o estado JÁ persistido -- sem esses callbacks (teste que não os provê), cai em
 * funções puras locais (mesmas de `meta/campeonato.ts`/`data/evolucao.ts`) que funcionam só em memória, pela
 * mesma filosofia "nunca trava" do resto da UI.
 *
 * Retomada (plano: "salva após cada corrida, dá pra retomar no meio"): `aoIniciarCampeonato` decide se existe um
 * `EstadoCampeonato` em andamento (`etapa < 5`) pra continuar, ou se começa um novo -- o `idJogador` usado em
 * TODAS as etapas é sempre o do `EstadoCampeonato` devolvido (pode diferir do personagem ativo do menu, se o
 * jogador estava retomando um campeonato de outro personagem).
 */
import type { EstadoCampeonato, Evolucao, IdPersonagem, ResultadoCorrida } from '../../core/contratos';
import { PERSONAGENS_DE_DADOS, PISTAS_DE_DADOS } from '../../data/index';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { AudioDestravavel, TrilhaMusical } from '../../audio/index';
import { classificacao, iniciarCampeonato, registrarResultado, situacao } from '../../meta/campeonato';
import type { SaveV1 } from '../../meta/tipos';
import type { Cena } from '../tipos';
import { criarCortinaNevasca } from '../transicao';
import { criarCenaAberturaCampeonato } from './abertura-campeonato';
import { criarCenaCorrida } from './corrida';
import { criarCenaFinalCampeonato } from './final-campeonato';
import { criarCenaOficina } from './oficina-campeonato';
import { criarControladorPausa, type ControladorPausa } from './pausa';
import { criarCenaPodio } from './podio';
import { criarCenaStandings } from './standings-campeonato';

const NOMES_POR_ID: Readonly<Record<string, string>> = Object.fromEntries(PERSONAGENS_DE_DADOS.map((d) => [d.id, d.nome]));

/** As 5 pistas na ordem de progressão (`DefPista.ordem`, plano M3 §B.5 -- já é a ordem natural de `PISTAS_DE_DADOS`). */
const PISTAS_ORDENADAS = [...PISTAS_DE_DADOS].sort((a, b) => a.ordem - b.ordem);

/** Nível roteirizado da IA por etapa (plano C-D5: "pista 1 ~0, pista 5 ~+12"), linear nas 5 etapas. */
const NIVEL_IA_POR_ETAPA: readonly number[] = [0, 3, 6, 9, 12];

const EVOLUCAO_VAZIA: Evolucao = { flocos: 0, niveis: {} };

export interface OpcoesCenaCampeonato {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly aoMenu?: (() => void) | undefined;
  readonly audio?: AudioDestravavel | undefined;
  /** Trilha musical real (gerenciador.ts, instância ÚNICA pro fluxo inteiro): esta cena decide qual faixa toca
   *  em cada etapa (corrida da pista x menu.mp3 nas telas entre pistas) e abaixa (duck) no pódio. */
  readonly trilha?: TrilhaMusical | undefined;
  readonly save?: SaveV1 | undefined;
  readonly personagem?: string | undefined;
  /** Inicia/retoma o `EstadoCampeonato` e persiste (gerenciador.ts). Sem ele: só em memória (teste). */
  readonly aoIniciarCampeonato?: ((personagem: IdPersonagem) => EstadoCampeonato) | undefined;
  /** Registra o resultado de UMA pista (pódio completo + flocos + troféu) e persiste. Sem ele: só em memória. */
  readonly aoRegistrarResultadoCampeonato?: ((resultado: ResultadoCorrida) => EstadoCampeonato) | undefined;
  /** Compra um nível de evolução pro personagem e persiste; devolve a evolução atualizada. */
  readonly aoComprarUpgrade?: ((personagem: IdPersonagem) => Evolucao) | undefined;
  /** Lido a cada quadro pela oficina (nunca cacheado): reflete compras na hora. */
  readonly obterEvolucao?: (() => Evolucao) | undefined;
  /** Monta a cena de Opções de verdade (gerenciador.ts); mesma semântica de `ui/cenas/jogo.ts: OpcoesCenaJogo.criarTelaOpcoes`. */
  readonly criarTelaOpcoes?: ((aoVoltar: () => void) => Cena) | undefined;
}

export function criarCenaCampeonato(opcoes: OpcoesCenaCampeonato): Cena {
  let atual: Cena | null = null;
  let telaConfig: Cena | null = null;
  // Plano C-D6 ("reinicia só antes de cruzar"): vale só pela etapa/corrida ATUAL, reseta a cada `montarCorrida`.
  let jaChegouEtapa = false;
  const personagemEscolhido = opcoes.personagem ?? 'capi';

  // Semente derivada do relógio (não é `Math.random`, proibido em `src/`; mesmo espírito do "desafio do dia"
  // derivado da data) -- só usada quando NÃO há campeonato em andamento pra retomar.
  const iniciarCampeonatoLocal = (personagem: IdPersonagem): EstadoCampeonato => iniciarCampeonato(Date.now() >>> 0, personagem);

  let estado: EstadoCampeonato = opcoes.aoIniciarCampeonato
    ? opcoes.aoIniciarCampeonato(personagemEscolhido)
    : iniciarCampeonatoLocal(personagemEscolhido);
  const idJogador = estado.personagem; // pode diferir de `personagemEscolhido` se estava retomando outro campeonato

  const nomeDaPista = (id: string): string => PISTAS_ORDENADAS.find((p) => p.id === id)?.nome ?? id;
  const nomePersonagem = NOMES_POR_ID[idJogador] ?? idJogador;

  // "Nevasca" (§10.1) entre as etapas internas (abertura -> corrida -> pódio -> standings -> oficina -> corrida
  // -> ... -> final) -- sempre "pra frente" (não há caminho de volta dentro desta cena): ver cabeçalho de
  // `ui/transicao.ts` sobre a cena antiga ser destruída já (ninguém testa o `id` destas sub-cenas no meio do
  // caminho).
  const nevasca = criarCortinaNevasca({ canvas: opcoes.canvas, janela: opcoes.janela });

  /** Destrói a sub-cena atual JÁ e só constrói a próxima no início da revelação (§10.1 passo 4). */
  function trocarComNevasca(construir: () => Cena): void {
    atual?.destruir?.();
    atual = null;
    nevasca.iniciar('frente', () => {
      atual = construir();
    });
  }

  function obterEvolucao(): Evolucao {
    return opcoes.obterEvolucao?.() ?? opcoes.save?.evolucao ?? EVOLUCAO_VAZIA;
  }

  const pausa: ControladorPausa = criarControladorPausa({
    canvas: opcoes.canvas,
    janela: opcoes.janela,
    podeReiniciar: () => !jaChegouEtapa,
    aoContinuar: () => undefined,
    aoReiniciar: () => {
      trocarComNevasca(montarCorrida);
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
    // "Voltar ao menu" no meio do campeonato NÃO corrompe o save (plano C-D6): o `EstadoCampeonato` só é
    // gravado em `aoRegistrarResultadoCampeonato`, ao CRUZAR a chegada -- sair antes disso deixa o save como
    // estava (retoma na mesma etapa, `iniciarOuRetomarCampeonato` em `gerenciador.ts`).
    aoConfirmarSaidaAoMenu: () => opcoes.aoMenu?.(),
  });

  function montarAbertura(): Cena {
    atual?.destruir?.();
    opcoes.trilha?.ducar(false);
    opcoes.trilha?.tocar('menu');
    return criarCenaAberturaCampeonato({
      canvas: opcoes.canvas,
      janela: opcoes.janela,
      documento: opcoes.documento,
      personagem: idJogador,
      nomePersonagem,
      pistas: PISTAS_ORDENADAS.map((p) => ({ id: p.id, nome: p.nome, tema: p.tema })),
      etapaAtual: estado.etapa,
      aoComecar: () => {
        trocarComNevasca(montarCorrida);
      },
      aoVoltar: () => opcoes.aoMenu?.(),
    });
  }

  function montarCorrida(): Cena {
    atual?.destruir?.();
    jaChegouEtapa = false;
    const pista = PISTAS_ORDENADAS[estado.etapa];
    if (!pista) {
      atual = montarFinal();
      return atual;
    }
    opcoes.trilha?.ducar(false);
    opcoes.trilha?.tocar(pista.musica);
    return criarCenaCorrida({
      canvas: opcoes.canvas,
      janela: opcoes.janela,
      documento: opcoes.documento,
      aoPausar: () => pausa.abrir(),
      aoChegada: () => {
        jaChegouEtapa = true;
      },
      audio: opcoes.audio,
      save: opcoes.save,
      personagem: idJogador,
      pista: pista.id,
      nivelIA: NIVEL_IA_POR_ETAPA[estado.etapa] ?? 0,
      aoTerminar: (resultado) => {
        estado = opcoes.aoRegistrarResultadoCampeonato ? opcoes.aoRegistrarResultadoCampeonato(resultado) : registrarResultado(estado, resultado, idJogador);
        // Pódio (fanfarra de chegada entra ainda na corrida, mas o pódio é a comemoração "parada" -- pedido do
        // dono: menu.mp3 por baixo, abaixado, pra não embolar com os efeitos da tela).
        opcoes.trilha?.tocar('menu');
        opcoes.trilha?.ducar(true);
        trocarComNevasca(() =>
          criarCenaPodio({
            resultado,
            nomesPorId: NOMES_POR_ID,
            idJogador,
            canvas: opcoes.canvas,
            janela: opcoes.janela,
            aoContinuar: () => trocarComNevasca(montarStandings),
          }),
        );
      },
    });
  }

  function montarStandings(): Cena {
    atual?.destruir?.();
    opcoes.trilha?.ducar(false);
    opcoes.trilha?.tocar('menu');
    const ultimaConcluida = estado.pistasConcluidas[estado.pistasConcluidas.length - 1];
    const terminou = estado.etapa >= PISTAS_ORDENADAS.length;
    const proxima = terminou ? undefined : PISTAS_ORDENADAS[estado.etapa];
    const temaFundo = (proxima ?? PISTAS_ORDENADAS[PISTAS_ORDENADAS.length - 1])?.tema ?? 'bosque';
    return criarCenaStandings({
      canvas: opcoes.canvas,
      janela: opcoes.janela,
      documento: opcoes.documento,
      classificacao: classificacao(estado.pistasConcluidas),
      nomesPorId: NOMES_POR_ID,
      idJogador,
      pistaConcluidaNome: nomeDaPista(ultimaConcluida?.pista ?? ''),
      proximaPistaNome: proxima?.nome,
      temaFundo,
      aoContinuar: () => {
        trocarComNevasca(terminou ? montarFinal : montarOficina);
      },
    });
  }

  function montarOficina(): Cena {
    atual?.destruir?.();
    opcoes.trilha?.tocar('menu');
    return criarCenaOficina({
      canvas: opcoes.canvas,
      janela: opcoes.janela,
      documento: opcoes.documento,
      personagem: idJogador,
      nomePersonagem,
      obterEvolucao,
      aoComprar: () => {
        opcoes.aoComprarUpgrade?.(idJogador);
      },
      aoContinuar: () => {
        trocarComNevasca(montarCorrida);
      },
    });
  }

  function montarFinal(): Cena {
    atual?.destruir?.();
    opcoes.trilha?.ducar(false);
    opcoes.trilha?.tocar('menu');
    const resultadoSituacao = situacao(estado.pistasConcluidas, idJogador, PISTAS_ORDENADAS.length);
    const venceu = resultadoSituacao === 'vencido';
    const ultimaPista = PISTAS_ORDENADAS[PISTAS_ORDENADAS.length - 1];
    return criarCenaFinalCampeonato({
      canvas: opcoes.canvas,
      janela: opcoes.janela,
      documento: opcoes.documento,
      venceu,
      classificacaoFinal: classificacao(estado.pistasConcluidas),
      idJogador,
      nomePersonagem,
      nomesPorId: NOMES_POR_ID,
      // Trofeu ja foi gravado (se for o caso) no `aoRegistrarResultadoCampeonato` da ULTIMA corrida, antes do
      // podio/standings -- por isso aqui so reflete `venceu`, sem checar `save.trofeus` (que a essa altura JA
      // contem `idJogador`, o que faria um "ganhou agora" sempre dar falso).
      ganhouTrofeu: venceu,
      temaFundo: ultimaPista?.tema ?? 'cume',
      aoMenu: () => opcoes.aoMenu?.(),
    });
  }

  atual = estado.etapa >= PISTAS_ORDENADAS.length ? montarFinal() : montarAbertura();

  return {
    id: 'campeonato',
    atualizar() {
      if (telaConfig) {
        telaConfig.atualizar();
        return;
      }
      if (pausa.pausado) return; // congela a corrida por baixo (abertura/pódio/standings/oficina/final nunca pausam)
      nevasca.atualizar(); // no-op fora de transição; constrói a sub-cena nova ao fim de cobrir+segurar
      if (!nevasca.congelando) atual?.atualizar(); // 'revelando': a sub-cena nova já tica a própria entrada
    },
    desenhar(ctx, alpha) {
      if (telaConfig) {
        telaConfig.desenhar(ctx, alpha);
        return;
      }
      if (nevasca.emTransicao) nevasca.desenhar(ctx, alpha, (c, a) => atual?.desenhar(c, a));
      else atual?.desenhar(ctx, alpha);
      pausa.desenhar(ctx);
    },
    destruir() {
      atual?.destruir?.();
      telaConfig?.destruir?.();
      pausa.destruir();
      nevasca.destruir();
    },
    aoPausarAutomatico() {
      if (!telaConfig && atual?.id === 'corrida') pausa.abrir();
    },
  };
}
