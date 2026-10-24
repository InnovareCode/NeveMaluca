/**
 * Cena de descida (plano §7 M1a): junta entrada (toque/teclado), o motor/pista REAIS da Vega
 * (`src/descida/criarDescida` + `src/pista/exigirPistaValida` sobre um `DefPista` de `data/pistas`) e o
 * render (câmera, terreno, parallax, objetos, piloto, HUD). Integrado por Atlas em cima do dublê original
 * (`motor-teste.ts`/`pista-teste.ts`, que ficam em `ui/cenas/` sem uso em produção — ver README desta pasta).
 *
 * Qual pista roda é `OpcoesCenaDescida.pista` (id; padrão `morro-do-pinhao`), resolvido por `obterPistaDeDados`
 * (M3 F3: destrava `pico-do-picole` para teste/e2e antes da tela de seleção de pista existir, que é F5). Id
 * desconhecido cai no Morro, mesma filosofia de "nunca é motivo para travar o jogo" do fantasma incompatível.
 *
 * Contrato da cena (ver `ui/tipos.ts`): `atualizar()` por tick de passo fixo avança o motor; `desenhar()` por
 * quadro só LÊ o último estado (nunca tica o motor de novo — por isso a leitura inicial é feita na criação,
 * com um comando neutro, e não dentro de `desenhar`).
 */
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import type { ComandoDescida, PilotoLeitura, ReplayV1 } from '../../core/contratos';
import { codificarComandos } from '../../core/replay';
import { rngDoCanal } from '../../core/rng';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
// Import por arquivo (não o barril '../../input'): a varredura de arquitetura (tests/support/varredura.ts)
// resolve um barril de camada importado de outra camada como "arquivo da raiz" quando o caminho normalizado
// cai num só segmento igual ao nome da camada — ver tests/unit/arquitetura.test.ts. Import direto evita o falso positivo.
import { criarEntrada, type Entrada } from '../../input/index';
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
import { desenharTerreno } from '../../render/terreno';
import { pintorDoTema, temaDeRenderDoTema } from '../../render/temas/catalogo';
import type { PintorTema } from '../../render/temas/tipos';
import type { Cena } from '../tipos';
import { obterPistaDeDados, PISTA_MORRO_DO_PINHAO } from '../../data/pistas';
import { configDoPersonagem, criarDescida, criarReprodutorFantasma, VERSAO_MOTOR, type MotorDescida, type ReprodutorFantasma } from '../../descida/index';
import { exigirPistaValida } from '../../pista/index';
import { criarSomManobras } from '../../audio/som-manobras';
import { criarMusicaAdaptativa } from '../../audio/musica-adaptativa';
import type { AudioDestravavel } from '../../audio/index';
import type { SaveV1 } from '../../meta/tipos';

export interface ResultadoDescida {
  readonly pontos: number;
  readonly ticks: number;
  /**
   * Replay C6 desta descida (gravado tick a tick, pronto para `codificarComandos`/persistência). Opcional só para um
   * dublê de teste poder montar `ResultadoDescida` à mão sem repetir o motor — `criarCenaDescida` SEMPRE preenche.
   */
  readonly replay?: ReplayV1 | undefined;
}

// Contagem "3-2-1-JÁ" (plano "corrida em campeonato" §C1), ~0,83 s por número + ~0,5 s no "JÁ!": roda ANTES do
// motor, só na cena -- nunca chama `entrada.obterComando()`/`motor.processar()` nesta janela, então não grava
// tick nenhum no replay antes da corrida de fato começar.
const TICKS_POR_NUMERO = 50;
const TICKS_JA = 30;
/**
 * Exportada para quem dirige a cena por um motor "sombra" em testes (`ui-descida-*.test.ts`): o sombra precisa
 * ficar OCIOSO pelos mesmos ticks (sem tickar nem despachar tecla), senão desalinha do motor real da cena -- que
 * só começa a consumir `entrada.obterComando()` depois da contagem -- e os bots saem de sincronia.
 */
export const TICKS_CONTAGEM_DESCIDA = TICKS_POR_NUMERO * 3 + TICKS_JA;
const TOTAL_TICKS_CONTAGEM = TICKS_CONTAGEM_DESCIDA;

/** Texto e "pulso" (0=acabou de trocar, perto de 1=tamanho de repouso) da contagem em `t` ticks (fração incluída, p/ interpolar). */
function textoDaContagem(t: number): { texto: string; pulso: number } {
  if (t < TICKS_POR_NUMERO) return { texto: '3', pulso: t / TICKS_POR_NUMERO };
  if (t < TICKS_POR_NUMERO * 2) return { texto: '2', pulso: (t - TICKS_POR_NUMERO) / TICKS_POR_NUMERO };
  if (t < TICKS_POR_NUMERO * 3) return { texto: '1', pulso: (t - TICKS_POR_NUMERO * 2) / TICKS_POR_NUMERO };
  return { texto: 'JÁ!', pulso: (t - TICKS_POR_NUMERO * 3) / TICKS_JA };
}

// ~2 s de comemoração (confete + pose 'celeb', já ativa pela última leitura) antes de ir para o resultado: o
// motor fica CONGELADO neste intervalo (nunca mais `processar`), então não entra tick extra no replay/resultado.
const TICKS_COMEMORACAO = 120;

export interface OpcoesCenaDescida {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly aoTerminar?: ((resultado: ResultadoDescida) => void) | undefined;
  readonly aoPausar?: (() => void) | undefined;
  /** Instância de áudio já destravável (de main.ts); sem ela a cena roda muda (testes/preview sem som). */
  readonly audio?: AudioDestravavel | undefined;
  /** Save, só para ler o volume (`cfg.som`) ao vivo. */
  readonly save?: SaveV1 | undefined;
  /** Id do personagem escolhido (seleção de personagem, UI); sem ele, a cápsula/sprite padrão é a `capi`. */
  readonly personagem?: string | undefined;
  /** Id da pista a carregar (`data/pistas.ts`). Sem ele, ou id desconhecido, cai no `morro-do-pinhao`. */
  readonly pista?: string | undefined;
  /**
   * Fantasma (replay C6) a correr junto, translúcido — tipicamente o #1 salvo desta pista (`SaveV1.fantasmas`).
   * Se a pista/`hashPista` não bater (versão do gerador mudou) ou os comandos não decodificarem, é ignorado em
   * silêncio: a descida roda normalmente, só sem fantasma (nunca é motivo para travar o jogo).
   */
  readonly fantasma?: ReplayV1 | undefined;
}

export function criarCenaDescida(opcoes: OpcoesCenaDescida): Cena {
  const defPista = (opcoes.pista !== undefined && obterPistaDeDados(opcoes.pista)) || PISTA_MORRO_DO_PINHAO;
  const pista = exigirPistaValida(defPista);
  // Física do personagem ESCOLHIDO (plano M3 §A.3): `configDoPersonagem('capi')` devolve `CONFIG_PADRAO` bit a
  // bit, então nenhuma descida da Capi muda de comportamento com esta troca (golden `m3-congelamento-capi.test.ts`).
  const motor: MotorDescida = criarDescida(pista, configDoPersonagem(opcoes.personagem ?? 'capi'));
  const entrada: Entrada = criarEntrada(opcoes.canvas, opcoes.janela ?? window, { teclado: { aoPausar: opcoes.aoPausar } });
  const camera: Camera = criarCamera(0, 0);
  // Pele do tema da pista (M3 F3/F4): `defPista.tema` decide o `PintorTema`/`DefTema` (`render/temas/catalogo.ts`).
  const pintorTema: PintorTema = pintorDoTema(defPista.tema);
  const parallax: Parallax = criarParallax(opcoes.documento, pintorTema, temaDeRenderDoTema(defPista.tema));
  const rngVisual = rngDoCanal(pista.semente, 'visual');
  const particulas: SistemaParticulas = criarSistemaParticulas(rngVisual);
  const popupsManobra: SistemaPopupsManobra = criarSistemaPopupsManobra();
  // Pose visual (takeoff/wobble/grab, §C1) e confete de chegada: ambos de RENDER só, nunca entram no replay.
  const visualPiloto: RastreadorPoseVisual = criarRastreadorPoseVisual();
  const confete: SistemaConfete = criarConfete(rngVisual);
  // Um gerador só para o canal `audio`, compartilhado entre som de manobras e música adaptativa (mesmo padrão de
  // `rngVisual`, compartilhado por câmera e partículas): consumido em ordem fixa (som antes de música) a cada tick.
  const rngAudio = opcoes.audio ? rngDoCanal(pista.semente, 'audio') : null;
  const somManobras = opcoes.audio && rngAudio ? criarSomManobras(opcoes.audio, rngAudio, { obterVolumeSom: () => opcoes.save?.cfg.som ?? 1 }) : null;
  const musicaAdaptativa =
    opcoes.audio && rngAudio ? criarMusicaAdaptativa(opcoes.audio, rngAudio, { obterVolumeMusica: () => opcoes.save?.cfg.musica ?? 1 }) : null;

  let spritePiloto: SpritePersonagem | null = null;
  void carregarSpritePersonagem(opcoes.personagem ?? 'capi')
    .then((s) => {
      spritePiloto = s;
    })
    .catch(() => {
      // fallback silencioso para a cápsula se o sprite falhar
    });

  // Fantasma (C6): replay de outra descida (tipicamente o #1 salvo) rodando num 2º motor, em lockstep por tick com
  // este. Pista/versão incompatível ou comandos ilegíveis -> `reprodutorFantasma` fica `null` e a descida segue sem
  // fantasma (ver doc de `OpcoesCenaDescida.fantasma`).
  let reprodutorFantasma: ReprodutorFantasma | null = null;
  let spriteFantasma: SpritePersonagem | null = null;
  let leituraFantasma: PilotoLeitura | null = null;
  if (opcoes.fantasma) {
    // Física de QUEM GRAVOU o replay (plano M3 §A.3): sem isso o fantasma de outro personagem rodaria com a
    // física da Capi e sairia da pista (achado 2 do plano §0).
    const r = criarReprodutorFantasma(opcoes.fantasma, pista, configDoPersonagem(opcoes.fantasma.personagem));
    if (r.ok) {
      reprodutorFantasma = r.valor;
      void carregarSpritePersonagem(opcoes.fantasma.personagem)
        .then((s) => {
          spriteFantasma = s;
        })
        .catch(() => {
          // fallback silencioso para a cápsula
        });
    }
  }

  // Comandos desta descida, um por tick (ordem de `processar`): vira `ReplayV1.comandos` na chegada (ver `aoTerminar`).
  const comandosGravados: ComandoDescida[] = [];

  // leitura inicial fora do `desenhar()`: a cena nunca tica o motor no quadro, só no tick (ver `ui/tipos.ts`)
  let leitura = motor.leitura();
  camera.atualizar(leitura.piloto, leitura.eventos, rngVisual);

  // UI local, nunca no replay: contagem "3-2-1-JÁ" ANTES do motor rodar, e a comemoração DEPOIS do motor
  // congelar (§C1). `resultadoPendente` guarda o resultado já calculado no tick da chegada; só sai pra
  // `aoTerminar` depois de `TICKS_COMEMORACAO` ticks de confete.
  let ticksContagem = 0;
  let contagemConcluida = false;
  let resultadoPendente: ResultadoDescida | null = null;
  let ticksComemoracao = 0;

  return {
    id: 'descida',
    atualizar() {
      if (resultadoPendente) {
        // Já chegou: o motor fica CONGELADO (nunca mais `processar`) -- só a comemoração (confete) avança.
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
        // SEM `entrada.obterComando()`/`motor.processar()` aqui: nenhum tick de contagem entra no replay.
        ticksContagem += 1;
        if (ticksContagem >= TOTAL_TICKS_CONTAGEM) contagemConcluida = true;
        return;
      }
      const cmd = entrada.obterComando();
      comandosGravados.push(cmd);
      leitura = motor.processar(cmd);
      leituraFantasma = reprodutorFantasma ? reprodutorFantasma.avancar() : null;
      camera.atualizar(leitura.piloto, leitura.eventos, rngVisual);
      particulas.atualizar(leitura.piloto, leitura.eventos);
      popupsManobra.atualizar(leitura.piloto, leitura.eventos, leitura.tick);
      visualPiloto.atualizar(leitura.piloto, leitura.eventos);
      somManobras?.atualizar(leitura);
      musicaAdaptativa?.atualizar(leitura);
      if (leitura.fase === 'chegou') {
        confete.estourar();
        const replay: ReplayV1 = {
          v: 1,
          pista: pista.id,
          hashPista: pista.hash,
          semente: pista.semente,
          personagem: opcoes.personagem ?? 'capi',
          versaoMotor: VERSAO_MOTOR,
          comandos: codificarComandos(comandosGravados),
          resultado: { pontos: leitura.pontos, ticks: leitura.tick, hashFinal: motor.hashEstado() },
        };
        resultadoPendente = { pontos: leitura.pontos, ticks: leitura.tick, replay };
      }
    },
    desenhar(ctx, alpha) {
      const camLeitura = camera.leitura();
      parallax.desenhar(ctx, camLeitura.x, leitura.tick);
      desenharTerreno(ctx, pista, camLeitura, pintorTema);
      desenharTrilhos(ctx, pista, camLeitura, pintorTema);
      desenharObjetos(ctx, pista, camLeitura, pintorTema);
      desenharChegada(ctx, pista, camLeitura, pintorTema);
      particulas.desenharSpray(ctx, camLeitura);
      if (leituraFantasma) {
        // translúcido e ANTES do piloto real: nunca deve confundir qual é o jogador de verdade
        ctx.save();
        ctx.globalAlpha = 0.4;
        desenharPiloto(ctx, leituraFantasma, camLeitura, spriteFantasma);
        ctx.restore();
      }
      desenharPiloto(ctx, leitura.piloto, camLeitura, spritePiloto, visualPiloto.poseVisual(leitura.piloto.pose));
      particulas.desenharFlocosFrente(ctx, camLeitura.x, leitura.tick);
      popupsManobra.desenhar(ctx, camLeitura);
      confete.desenhar(ctx);
      desenharHud(ctx, {
        velocidadeMs: leitura.piloto.velocidade,
        pontos: leitura.pontos,
        fase: leitura.fase,
        combo: leitura.combo,
        progressoJogador: leitura.piloto.x / pista.chegadaX,
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
