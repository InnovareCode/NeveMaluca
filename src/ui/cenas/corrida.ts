/**
 * Cena de corrida (plano `docs/plano-corrida-campeonato.md` §C2b): dirige `corrida/criarCorrida` (núcleo pronto na
 * C2a, Vega) com o jogador (entrada real, como `descida.ts`) + 5 rivais de IA -- o elenco inteiro
 * (`data/personagens.ts`) menos quem o jogador escolheu -- numa única pista.
 *
 * `LeituraCorrida.rivais` chega SEM x/y (`{id, piloto, fase, distancia}`, `core/contratos.ts`): a câmera só segue
 * o JOGADOR (mesma `criarCamera`/`Camera` de `descida.ts`, alimentada só por `leitura.jogador.piloto`), e a
 * posição de cada rival na tela é calculada por `distancia` -- a MESMA unidade/escala de `PilotoLeitura.x`
 * (`descida/motor.ts`: `estado.distancia = p.x`) -- mais a altura do chão nesse ponto (`pista/consulta.ts
 * alturaEm`). Essa conta mora AQUI, não em `render/rivais.ts`: `render/` não pode importar `pista/` (regra de
 * camada, memória `render-nao-pode-importar-pista`).
 *
 * Por ora roda UMA corrida (plano §C2b: "por ora pode rodar uma corrida (1ª pista)"); quando o jogador chega,
 * `corrida.finalizar()` fecha o pódio na hora (os rivais que faltam correm pela própria IA até o fim ou o teto de
 * segurança -- não precisa esperar o relógio da UI). O fluxo de campeonato completo (etapas/standings/oficina,
 * C5b) fica em `ui/cenas/campeonato.ts`, que compõe esta cena com `ui/cenas/podio.ts`.
 */
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import type { ComandoDescida, ParticipanteCorrida, ResultadoCorrida } from '../../core/contratos';
import { rngDoCanal } from '../../core/rng';
import { criarCorrida, type Corrida } from '../../corrida/index';
import { PERSONAGENS_DE_DADOS, obterPistaDeDados, PISTA_MORRO_DO_PINHAO } from '../../data/index';
import { PARAMETROS_ESCUDO_ITEM } from '../../data/itens';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
// Import por arquivo (não o barril '../../input'): mesmo motivo de `descida.ts` (ver comentário lá).
import { criarEntrada, type Entrada } from '../../input/index';
import { exigirPistaValida, gerarCamadaJogo } from '../../pista/index';
import { alturaEm } from '../../pista/consulta';
import {
  desenharItensCamada,
  desenharKickers,
  desenharObstaculosAltos,
  criarSistemaAvisosObstaculo,
  criarSistemaTurboPouso,
  type SistemaAvisosObstaculo,
  type SistemaTurboPouso,
} from '../../render/camada';
import { criarCamera, type Camera } from '../../render/camera';
import { desenharChegada } from '../../render/chegada';
import { criarConfete, type SistemaConfete } from '../../render/confete';
import {
  desenharBotaoItem,
  desenharBotaoPausa,
  desenharContagemRegressiva,
  desenharHud,
  desenharLegendaCarregandoCenario,
  criarSistemaFeedbackItens,
  RETANGULO_BOTAO_ITEM,
  RETANGULO_BOTAO_PAUSA,
  type SistemaFeedbackItens,
} from '../../render/hud';
import { desenharEntidadesItens, desenharEscudo, desenharAvisoAlvo, type EntidadeItemVisual } from '../../render/itens';
import { criarSistemaPopupsManobra, type SistemaPopupsManobra } from '../../render/manobra';
import { desenharObjetos, desenharTrilhos } from '../../render/objetos';
import { desenharPiloto } from '../../render/piloto';
import { criarRastreadorPoseVisual, type RastreadorPoseVisual } from '../../render/pose-visual';
import { criarParallax, type Parallax } from '../../render/parallax';
import { criarSistemaParticulas, type SistemaParticulas } from '../../render/particulas';
import { desenharRivais, type RivalVisual } from '../../render/rivais';
import { desenharTerreno } from '../../render/terreno';
import { pintorDoTema, precarregarAssetsDoTema, rasterProntoParaTema, temaDeRenderDoTema } from '../../render/temas/catalogo';
import type { PintorTema } from '../../render/temas/tipos';
import { criarSomManobras } from '../../audio/som-manobras';
import { criarMusicaAdaptativa } from '../../audio/musica-adaptativa';
import type { AudioDestravavel } from '../../audio/index';
import type { SaveV1 } from '../../meta/tipos';
import type { Cena } from '../tipos';
import { TICKS_CONTAGEM, textoDaContagem } from './contagem';

// ~2 s de comemoração (confete) antes de ir para o pódio -- mesmo valor de `descida.ts`.
const TICKS_COMEMORACAO = 120;

/** Paleta estável por ÍNDICE no elenco (`data/personagens.ts`), não por id -- qualquer elenco de 6 encaixa. */
const PALETA_CORREDORES: readonly string[] = ['#ffd166', '#2ecc71', '#4da2ff', '#ff6b6b', '#c084fc', '#f4a259'];

function indiceNoElenco(id: string): number {
  const i = PERSONAGENS_DE_DADOS.findIndex((d) => d.id === id);
  return i < 0 ? 0 : i;
}
function corDoPersonagem(id: string): string {
  return PALETA_CORREDORES[indiceNoElenco(id) % PALETA_CORREDORES.length] ?? '#ffd166';
}
function nomeDoPersonagem(id: string): string {
  return PERSONAGENS_DE_DADOS.find((d) => d.id === id)?.nome ?? id;
}

export interface OpcoesCenaCorrida {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly aoTerminar?: ((resultado: ResultadoCorrida) => void) | undefined;
  readonly aoPausar?: (() => void) | undefined;
  /** Mesma semântica de `ui/cenas/descida.ts: OpcoesCenaDescida.aoChegada` (plano C-D6). */
  readonly aoChegada?: (() => void) | undefined;
  readonly audio?: AudioDestravavel | undefined;
  readonly save?: SaveV1 | undefined;
  /** Id do personagem escolhido (seleção de personagem, UI); sem ele, o jogador é a `capi`. */
  readonly personagem?: string | undefined;
  /** Id da pista a carregar (`data/pistas.ts`). Sem ele, ou id desconhecido, cai no `morro-do-pinhao`. */
  readonly pista?: string | undefined;
  /**
   * Nível roteirizado da IA desta pista (plano C-D5: "pista 1 ~0, pista 5 ~+12"), repassado a
   * `ParticipanteCorrida.piloto.nivel` de cada rival (`ui/cenas/campeonato.ts` decide a tabela por etapa). Sem ele,
   * nível 0 -- mesmo padrão de antes do campeonato completo existir. `corrida/ia.ts` (motor, intocado aqui) ainda
   * não LÊ este campo: threaded agora pro dia em que a IA escalar de verdade por pista.
   */
  readonly nivelIA?: number | undefined;
}

export function criarCenaCorrida(opcoes: OpcoesCenaCorrida): Cena {
  const defPista = (opcoes.pista !== undefined && obterPistaDeDados(opcoes.pista)) || PISTA_MORRO_DO_PINHAO;
  const pista = exigirPistaValida(defPista);
  // Id desconhecido (save corrompido/catálogo mudou) nunca trava a corrida: cai na capi, como `obterPistaDeDados`.
  const idJogadorPedido = opcoes.personagem ?? 'capi';
  const idJogador = PERSONAGENS_DE_DADOS.some((d) => d.id === idJogadorPedido) ? idJogadorPedido : 'capi';

  const nivelIA = opcoes.nivelIA ?? 0;
  // O elenco inteiro corre (plano §C2b: jogador + 5 rivais de IA) -- mesmo padrão de `ferramentas/harness-corrida`.
  const participantes: ParticipanteCorrida[] = PERSONAGENS_DE_DADOS.map((def) => ({
    id: def.id,
    config: def,
    piloto: def.id === idJogador ? { tipo: 'jogador' } : { tipo: 'ia', perfil: def.id, nivel: nivelIA },
  }));
  const totalCorredores = participantes.length;

  // Camada de jogo (plano corrida-campeonato §C3/C4): gerada AQUI (não só passando `def` a `criarCorrida`) pra a
  // CENA também enxergar `camada.itens`/`kickers`/`obstaculosAltos` e desenhá-los -- pura e determinística
  // (`gerarCamadaJogo`), byte a byte igual à que `criarCorrida({def})` geraria por dentro.
  const camada = gerarCamadaJogo(pista, defPista);

  // Repassa `opcoes.save?.evolucao` ao núcleo (C6, Vega acabou de ligar `criarCorrida({evolucao})` ->
  // `descida/atributos.ts` -> `aplicarEvolucao`) -- sem ela, todos correm no nível 0 (idêntico à ficha, como
  // antes do C6). `exactOptionalPropertyTypes`: só inclui a chave quando há evolução de verdade.
  const corrida: Corrida = criarCorrida({
    pista,
    camada,
    semente: pista.semente,
    participantes,
    ...(opcoes.save?.evolucao !== undefined ? { evolucao: opcoes.save.evolucao } : {}),
  });

  // `botaoItem` (I4b): a MESMA zona que `render/hud.ts: desenharBotaoItem` desenha -- um retângulo só, lido pelos
  // dois lados, pra nunca desalinhar hitbox e ícone (ver cabeçalho de `RETANGULO_BOTAO_ITEM`).
  const entrada: Entrada = criarEntrada(opcoes.canvas, opcoes.janela ?? window, {
    teclado: { aoPausar: opcoes.aoPausar },
    toque: { botaoItem: RETANGULO_BOTAO_ITEM, botaoPausa: RETANGULO_BOTAO_PAUSA, aoPausar: opcoes.aoPausar },
  });
  const camera: Camera = criarCamera(0, 0);
  const pintorTema: PintorTema = pintorDoTema(defPista.tema);
  const parallax: Parallax = criarParallax(opcoes.documento, pintorTema, temaDeRenderDoTema(defPista.tema));
  // Mesmo preload fire-and-forget de `ui/cenas/descida.ts` -- cobre CAMPEONATO direto do menu, que também pula
  // `selecao-pista.ts`. Nunca trava um tick; o `pintorTema` cai sozinho no vetorial enquanto o cache não assenta.
  void precarregarAssetsDoTema(defPista.tema, opcoes.documento);
  const rngVisual = rngDoCanal(pista.semente, 'visual');
  const particulas: SistemaParticulas = criarSistemaParticulas(rngVisual);
  const popupsManobra: SistemaPopupsManobra = criarSistemaPopupsManobra();
  // "!" sobre o galho (C4) + flash do turbo de pouso (C-D7, só existe em modo 'corrida' -- por isso só esta cena
  // liga `criarSistemaTurboPouso`, nunca `descida.ts`/TREINO).
  const avisosObstaculo: SistemaAvisosObstaculo = criarSistemaAvisosObstaculo();
  const turboPouso: SistemaTurboPouso = criarSistemaTurboPouso();
  const visualPiloto: RastreadorPoseVisual = criarRastreadorPoseVisual();
  const confete: SistemaConfete = criarConfete(rngVisual);
  // Feedback dos eventosCorrida (I5): toast curto acima do botão de item quando ENVOLVE o jogador.
  const feedbackItens: SistemaFeedbackItens = criarSistemaFeedbackItens();
  // Escudo do JOGADOR (plano itens-corrida): `LeituraRivalCorrida.escudo` existe pra cada rival, mas
  // `LeituraCorrida` não expõe o equivalente do próprio jogador (ver PENDÊNCIAS do handoff) -- espelha a MESMA
  // duração de `corrida/itens.ts` (`PARAMETROS_ESCUDO_ITEM.ticks`) a partir dos eventos, só pra desenhar a bolha;
  // nunca decide física (mero reflexo visual, como `SistemaTurboPouso`/`SistemaAvisosObstaculo` acima).
  let escudoJogadorTicks = 0;
  const rngAudio = opcoes.audio ? rngDoCanal(pista.semente, 'audio') : null;
  const somManobras = opcoes.audio && rngAudio ? criarSomManobras(opcoes.audio, rngAudio, { obterVolumeSom: () => opcoes.save?.cfg.som ?? 1 }) : null;
  const musicaAdaptativa =
    opcoes.audio && rngAudio ? criarMusicaAdaptativa(opcoes.audio, rngAudio, { obterVolumeMusica: () => opcoes.save?.cfg.musica ?? 1 }) : null;

  // Sprites dos 6 (jogador + rivais): melhor esforço -- cada um cai no fallback (cápsula/ponto colorido) até carregar.
  const sprites = new Map<string, SpritePersonagem>();
  for (const p of participantes) {
    void carregarSpritePersonagem(p.id)
      .then((s) => sprites.set(p.id, s))
      .catch(() => {
        // fallback silencioso: cápsula (jogador) ou ponto colorido + inicial (rival)
      });
  }

  let leitura = corrida.leitura();
  camera.atualizar(leitura.jogador.piloto, leitura.jogador.eventos, rngVisual);

  let ticksContagem = 0;
  let contagemConcluida = false;
  let resultadoPendente: ResultadoCorrida | null = null;
  let ticksComemoracao = 0;

  return {
    id: 'corrida',
    atualizar() {
      if (resultadoPendente) {
        confete.atualizar();
        ticksComemoracao += 1;
        if (ticksComemoracao >= TICKS_COMEMORACAO) {
          const r = resultadoPendente;
          resultadoPendente = null;
          opcoes.aoTerminar?.(r);
        }
        return;
      }
      if (!contagemConcluida) {
        ticksContagem += 1;
        if (ticksContagem >= TICKS_CONTAGEM) contagemConcluida = true;
        return;
      }
      const cmd: ComandoDescida = entrada.obterComando();
      // `usarItem` (plano itens-corrida §I4b): borda real do input (tecla E, tap no botão, ou ombro do controle) --
      // `Corrida.processar` já aceita o campo desde a I2 (Vega), aqui é só o sinal de verdade chegando.
      const usarItem = entrada.usarItemBorda();
      leitura = corrida.processar({ descida: cmd, usarItem });
      camera.atualizar(leitura.jogador.piloto, leitura.jogador.eventos, rngVisual);
      particulas.atualizar(leitura.jogador.piloto, leitura.jogador.eventos);
      popupsManobra.atualizar(leitura.jogador.piloto, leitura.jogador.eventos, leitura.jogador.tick);
      avisosObstaculo.atualizar(leitura.jogador.eventos);
      turboPouso.atualizar(leitura.jogador.piloto, leitura.jogador.eventos);
      visualPiloto.atualizar(leitura.jogador.piloto, leitura.jogador.eventos);
      somManobras?.atualizar(leitura.jogador);
      musicaAdaptativa?.atualizar(leitura.jogador);
      feedbackItens.atualizar(leitura.eventosCorrida ?? [], idJogador);
      for (const ev of leitura.eventosCorrida ?? []) {
        if (ev.tipo === 'item-usado' && ev.id === idJogador && ev.item === 'escudo') escudoJogadorTicks = PARAMETROS_ESCUDO_ITEM.ticks;
        else if (ev.tipo === 'bloqueado' && ev.id === idJogador) escudoJogadorTicks = 0;
      }
      if (escudoJogadorTicks > 0) escudoJogadorTicks -= 1;
      if (leitura.jogador.fase === 'chegou') {
        opcoes.aoChegada?.();
        confete.estourar();
        // finalizar() deixa os rivais que faltam correrem (própria IA) até o fim/teto e fecha o pódio na hora.
        resultadoPendente = corrida.finalizar();
      }
    },
    desenhar(ctx, alpha) {
      const camLeitura = camera.leitura();
      parallax.desenhar(ctx, camLeitura.x, leitura.jogador.tick);
      desenharTerreno(ctx, pista, camLeitura, pintorTema);
      desenharTrilhos(ctx, pista, camLeitura, pintorTema);
      desenharKickers(ctx, pista, camada, camLeitura, leitura.jogador.tick);
      desenharObjetos(ctx, pista, camLeitura, pintorTema);
      desenharObstaculosAltos(ctx, pista, camada, camLeitura, pintorTema);
      desenharChegada(ctx, pista, camLeitura, pintorTema);
      desenharItensCamada(ctx, camada, camLeitura, pintorTema, leitura.jogador.tick);
      particulas.desenharSpray(ctx, camLeitura);

      // Entidades de item (caixa/bola/poça, plano I5): `entidadesVisiveis` (`corrida/itens.ts`) devolve `y: 0`
      // pra bola/poça -- sem altura própria, ancoradas no CHÃO aqui (mesmo padrão de `corrida-rivais-sem-xy`: a
      // conta de posição mora na CENA, nunca em `render/`). Caixa já chega com `y` real, usado direto.
      const entidadesVisuais: EntidadeItemVisual[] = (leitura.entidades ?? []).map((e) =>
        e.tipo === 'caixa' ? { id: e.id, tipo: e.tipo, xM: e.x, yM: e.y } : { id: e.id, tipo: e.tipo, xM: e.x, yM: alturaEm(pista, e.x) + 0.3 },
      );
      desenharEntidadesItens(ctx, camLeitura, entidadesVisuais, leitura.jogador.tick);

      const rivaisVisuais: RivalVisual[] = leitura.rivais.map((r) => {
        const xM = r.distancia;
        return {
          id: r.id,
          nome: nomeDoPersonagem(r.id),
          cor: corDoPersonagem(r.id),
          xM,
          yM: alturaEm(pista, xM) + 0.9, // leve offset: ancora o anel/avatar perto do "corpo", não dos "pés"
          distanciaRelativaM: r.distancia - leitura.jogador.distancia,
          sprite: sprites.get(r.id) ?? null,
        };
      });
      desenharRivais(ctx, camLeitura, rivaisVisuais);
      // Bolha de gelo dos rivais (plano itens-corrida): `LeituraRivalCorrida.escudo` já vem pronto; mesmo índice
      // de `rivaisVisuais` (os dois nascem de `leitura.rivais.map(...)`, nunca reordenados).
      leitura.rivais.forEach((r, i) => {
        if (r.escudo) desenharEscudo(ctx, camLeitura, (rivaisVisuais[i] as RivalVisual).xM, (rivaisVisuais[i] as RivalVisual).yM, leitura.jogador.tick);
      });

      turboPouso.desenhar(ctx, camLeitura); // ANTES do piloto: o flash fica atrás, nunca cobre o sprite
      desenharPiloto(ctx, leitura.jogador.piloto, camLeitura, sprites.get(idJogador) ?? null, visualPiloto.poseVisual(leitura.jogador.piloto.pose));
      if (escudoJogadorTicks > 0) desenharEscudo(ctx, camLeitura, leitura.jogador.piloto.x, leitura.jogador.piloto.y, leitura.jogador.tick);
      if (leitura.alvoNoJogador) desenharAvisoAlvo(ctx, camLeitura, leitura.jogador.piloto.x, leitura.jogador.piloto.y, leitura.jogador.tick);
      particulas.desenharFlocosFrente(ctx, camLeitura.x, leitura.jogador.tick);
      popupsManobra.desenhar(ctx, camLeitura);
      avisosObstaculo.desenhar(ctx, pista, camLeitura);
      confete.desenhar(ctx);

      const posicaoJogador = leitura.posicoes.indexOf(idJogador) + 1;
      desenharHud(ctx, {
        velocidadeMs: leitura.jogador.piloto.velocidade,
        pontos: leitura.jogador.pontos,
        fase: leitura.jogador.fase,
        combo: leitura.jogador.combo,
        progressoJogador: leitura.jogador.piloto.x / pista.chegadaX,
        rivaisProgresso: leitura.rivais.map((r) => ({
          fracao: r.distancia / pista.chegadaX,
          cor: corDoPersonagem(r.id),
          imagem: sprites.get(r.id)?.obterQuadro('ride0')?.imagem ?? null,
        })),
        posicaoJogador: posicaoJogador > 0 ? posicaoJogador : undefined,
        totalCorredores,
      });
      desenharBotaoItem(ctx, { item: leitura.itemJogador ?? null, roleta: leitura.roleta ?? null }, leitura.jogador.tick);
      desenharBotaoPausa(ctx);
      feedbackItens.desenhar(ctx);
      if (!contagemConcluida) {
        const { texto, pulso } = textoDaContagem(ticksContagem + alpha);
        desenharContagemRegressiva(ctx, texto, pulso);
        if (!rasterProntoParaTema(defPista.tema)) desenharLegendaCarregandoCenario(ctx);
      }
    },
    destruir() {
      entrada.destruir();
    },
  };
}
