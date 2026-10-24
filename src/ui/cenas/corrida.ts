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
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
// Import por arquivo (não o barril '../../input'): mesmo motivo de `descida.ts` (ver comentário lá).
import { criarEntrada, type Entrada } from '../../input/index';
import { exigirPistaValida } from '../../pista/index';
import { alturaEm } from '../../pista/consulta';
import { criarCamera, type Camera } from '../../render/camera';
import { desenharChegada } from '../../render/chegada';
import { criarConfete, type SistemaConfete } from '../../render/confete';
import { desenharContagemRegressiva, desenharHud } from '../../render/hud';
import { criarSistemaPopupsManobra, type SistemaPopupsManobra } from '../../render/manobra';
import { desenharObjetos, desenharTrilhos } from '../../render/objetos';
import { desenharPiloto } from '../../render/piloto';
import { criarRastreadorPoseVisual, type RastreadorPoseVisual } from '../../render/pose-visual';
import { criarParallax, type Parallax } from '../../render/parallax';
import { criarSistemaParticulas, type SistemaParticulas } from '../../render/particulas';
import { desenharRivais, type RivalVisual } from '../../render/rivais';
import { desenharTerreno } from '../../render/terreno';
import { pintorDoTema, temaDeRenderDoTema } from '../../render/temas/catalogo';
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
  readonly audio?: AudioDestravavel | undefined;
  readonly save?: SaveV1 | undefined;
  /** Id do personagem escolhido (seleção de personagem, UI); sem ele, o jogador é a `capi`. */
  readonly personagem?: string | undefined;
  /** Id da pista a carregar (`data/pistas.ts`). Sem ele, ou id desconhecido, cai no `morro-do-pinhao`. */
  readonly pista?: string | undefined;
}

export function criarCenaCorrida(opcoes: OpcoesCenaCorrida): Cena {
  const defPista = (opcoes.pista !== undefined && obterPistaDeDados(opcoes.pista)) || PISTA_MORRO_DO_PINHAO;
  const pista = exigirPistaValida(defPista);
  // Id desconhecido (save corrompido/catálogo mudou) nunca trava a corrida: cai na capi, como `obterPistaDeDados`.
  const idJogadorPedido = opcoes.personagem ?? 'capi';
  const idJogador = PERSONAGENS_DE_DADOS.some((d) => d.id === idJogadorPedido) ? idJogadorPedido : 'capi';

  // O elenco inteiro corre (plano §C2b: jogador + 5 rivais de IA) -- mesmo padrão de `ferramentas/harness-corrida`.
  const participantes: ParticipanteCorrida[] = PERSONAGENS_DE_DADOS.map((def) => ({
    id: def.id,
    config: def,
    piloto: def.id === idJogador ? { tipo: 'jogador' } : { tipo: 'ia', perfil: def.id, nivel: 0 },
  }));
  const totalCorredores = participantes.length;

  const corrida: Corrida = criarCorrida({ pista, semente: pista.semente, participantes });

  const entrada: Entrada = criarEntrada(opcoes.canvas, opcoes.janela ?? window, { teclado: { aoPausar: opcoes.aoPausar } });
  const camera: Camera = criarCamera(0, 0);
  const pintorTema: PintorTema = pintorDoTema(defPista.tema);
  const parallax: Parallax = criarParallax(opcoes.documento, pintorTema, temaDeRenderDoTema(defPista.tema));
  const rngVisual = rngDoCanal(pista.semente, 'visual');
  const particulas: SistemaParticulas = criarSistemaParticulas(rngVisual);
  const popupsManobra: SistemaPopupsManobra = criarSistemaPopupsManobra();
  const visualPiloto: RastreadorPoseVisual = criarRastreadorPoseVisual();
  const confete: SistemaConfete = criarConfete(rngVisual);
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
      leitura = corrida.processar(cmd);
      camera.atualizar(leitura.jogador.piloto, leitura.jogador.eventos, rngVisual);
      particulas.atualizar(leitura.jogador.piloto, leitura.jogador.eventos);
      popupsManobra.atualizar(leitura.jogador.piloto, leitura.jogador.eventos, leitura.jogador.tick);
      visualPiloto.atualizar(leitura.jogador.piloto, leitura.jogador.eventos);
      somManobras?.atualizar(leitura.jogador);
      musicaAdaptativa?.atualizar(leitura.jogador);
      if (leitura.jogador.fase === 'chegou') {
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
      desenharObjetos(ctx, pista, camLeitura, pintorTema);
      desenharChegada(ctx, pista, camLeitura, pintorTema);
      particulas.desenharSpray(ctx, camLeitura);

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

      desenharPiloto(ctx, leitura.jogador.piloto, camLeitura, sprites.get(idJogador) ?? null, visualPiloto.poseVisual(leitura.jogador.piloto.pose));
      particulas.desenharFlocosFrente(ctx, camLeitura.x, leitura.jogador.tick);
      popupsManobra.desenhar(ctx, camLeitura);
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
      if (!contagemConcluida) {
        const { texto, pulso } = textoDaContagem(ticksContagem + alpha);
        desenharContagemRegressiva(ctx, texto, pulso);
      }
    },
    destruir() {
      entrada.destruir();
    },
  };
}
