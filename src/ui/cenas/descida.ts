/**
 * Cena de descida (plano §7 M1a): junta entrada (toque/teclado), o motor/pista REAIS da Vega
 * (`src/descida/criarDescida` + `src/pista/exigirPistaValida` sobre `PISTA_MORRO_DO_PINHAO`, de `data/pistas`) e o
 * render (câmera, terreno, parallax, objetos, piloto, HUD). Integrado por Atlas em cima do dublê original
 * (`motor-teste.ts`/`pista-teste.ts`, que ficam em `ui/cenas/` sem uso em produção — ver README desta pasta).
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
import { desenharHud } from '../../render/hud';
import { criarSistemaPopupsManobra, type SistemaPopupsManobra } from '../../render/manobra';
import { desenharObjetos } from '../../render/objetos';
import { desenharPiloto } from '../../render/piloto';
import { criarParallax, type Parallax } from '../../render/parallax';
import { criarSistemaParticulas, type SistemaParticulas } from '../../render/particulas';
import { desenharTerreno } from '../../render/terreno';
import type { Cena } from '../tipos';
import { PISTA_MORRO_DO_PINHAO } from '../../data/pistas';
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
  /**
   * Fantasma (replay C6) a correr junto, translúcido — tipicamente o #1 salvo desta pista (`SaveV1.fantasmas`).
   * Se a pista/`hashPista` não bater (versão do gerador mudou) ou os comandos não decodificarem, é ignorado em
   * silêncio: a descida roda normalmente, só sem fantasma (nunca é motivo para travar o jogo).
   */
  readonly fantasma?: ReplayV1 | undefined;
}

export function criarCenaDescida(opcoes: OpcoesCenaDescida): Cena {
  const pista = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
  // Física do personagem ESCOLHIDO (plano M3 §A.3): `configDoPersonagem('capi')` devolve `CONFIG_PADRAO` bit a
  // bit, então nenhuma descida da Capi muda de comportamento com esta troca (golden `m3-congelamento-capi.test.ts`).
  const motor: MotorDescida = criarDescida(pista, configDoPersonagem(opcoes.personagem ?? 'capi'));
  const entrada: Entrada = criarEntrada(opcoes.canvas, opcoes.janela ?? window, { teclado: { aoPausar: opcoes.aoPausar } });
  const camera: Camera = criarCamera(0, 0);
  const parallax: Parallax = criarParallax(opcoes.documento);
  const rngVisual = rngDoCanal(pista.semente, 'visual');
  const particulas: SistemaParticulas = criarSistemaParticulas(rngVisual);
  const popupsManobra: SistemaPopupsManobra = criarSistemaPopupsManobra();
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
  let terminou = false;

  return {
    id: 'descida',
    atualizar() {
      if (terminou) return;
      const cmd = entrada.obterComando();
      comandosGravados.push(cmd);
      leitura = motor.processar(cmd);
      leituraFantasma = reprodutorFantasma ? reprodutorFantasma.avancar() : null;
      camera.atualizar(leitura.piloto, leitura.eventos, rngVisual);
      particulas.atualizar(leitura.piloto, leitura.eventos);
      popupsManobra.atualizar(leitura.piloto, leitura.eventos, leitura.tick);
      somManobras?.atualizar(leitura);
      musicaAdaptativa?.atualizar(leitura);
      if (leitura.fase === 'chegou') {
        terminou = true;
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
        opcoes.aoTerminar?.({ pontos: leitura.pontos, ticks: leitura.tick, replay });
      }
    },
    desenhar(ctx) {
      const camLeitura = camera.leitura();
      parallax.desenhar(ctx, camLeitura.x, leitura.tick);
      desenharTerreno(ctx, pista, camLeitura);
      desenharObjetos(ctx, pista, camLeitura);
      particulas.desenharSpray(ctx, camLeitura);
      if (leituraFantasma) {
        // translúcido e ANTES do piloto real: nunca deve confundir qual é o jogador de verdade
        ctx.save();
        ctx.globalAlpha = 0.4;
        desenharPiloto(ctx, leituraFantasma, camLeitura, spriteFantasma);
        ctx.restore();
      }
      desenharPiloto(ctx, leitura.piloto, camLeitura, spritePiloto);
      particulas.desenharFlocosFrente(ctx, camLeitura.x, leitura.tick);
      popupsManobra.desenhar(ctx, camLeitura);
      desenharHud(ctx, {
        velocidadeMs: leitura.piloto.velocidade,
        pontos: leitura.pontos,
        fase: leitura.fase,
        combo: leitura.combo,
      });
    },
    destruir() {
      entrada.destruir();
    },
  };
}
