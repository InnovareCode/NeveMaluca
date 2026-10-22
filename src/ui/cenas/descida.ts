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
import { rngDoCanal } from '../../core/rng';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
// Import por arquivo (não o barril '../../input'): a varredura de arquitetura (tests/support/varredura.ts)
// resolve um barril de camada importado de outra camada como "arquivo da raiz" quando o caminho normalizado
// cai num só segmento igual ao nome da camada — ver tests/unit/arquitetura.test.ts. Import direto evita o falso positivo.
import { criarEntrada, type Entrada } from '../../input/index';
import { criarCamera, type Camera } from '../../render/camera';
import { desenharHud } from '../../render/hud';
import { desenharObjetos } from '../../render/objetos';
import { desenharPiloto } from '../../render/piloto';
import { criarParallax, type Parallax } from '../../render/parallax';
import { desenharTerreno } from '../../render/terreno';
import type { Cena } from '../tipos';
import { PISTA_MORRO_DO_PINHAO } from '../../data/pistas';
import { criarDescida, type MotorDescida } from '../../descida/index';
import { exigirPistaValida } from '../../pista/index';

export interface ResultadoDescida {
  readonly pontos: number;
  readonly ticks: number;
}

export interface OpcoesCenaDescida {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly aoTerminar?: ((resultado: ResultadoDescida) => void) | undefined;
  readonly aoPausar?: (() => void) | undefined;
}

export function criarCenaDescida(opcoes: OpcoesCenaDescida): Cena {
  const pista = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
  const motor: MotorDescida = criarDescida(pista);
  const entrada: Entrada = criarEntrada(opcoes.canvas, opcoes.janela ?? window, { teclado: { aoPausar: opcoes.aoPausar } });
  const camera: Camera = criarCamera(0, 0);
  const parallax: Parallax = criarParallax(opcoes.documento ?? document);
  const rngVisual = rngDoCanal(pista.semente, 'visual');

  // leitura inicial fora do `desenhar()`: a cena nunca tica o motor no quadro, só no tick (ver `ui/tipos.ts`)
  let leitura = motor.leitura();
  camera.atualizar(leitura.piloto, leitura.eventos, rngVisual);
  let terminou = false;

  return {
    id: 'descida',
    atualizar() {
      if (terminou) return;
      const cmd = entrada.obterComando();
      leitura = motor.processar(cmd);
      camera.atualizar(leitura.piloto, leitura.eventos, rngVisual);
      if (leitura.fase === 'chegou') {
        terminou = true;
        opcoes.aoTerminar?.({ pontos: leitura.pontos, ticks: leitura.tick });
      }
    },
    desenhar(ctx) {
      const camLeitura = camera.leitura();
      parallax.desenhar(ctx, camLeitura.x, leitura.tick);
      desenharTerreno(ctx, pista, camLeitura);
      desenharObjetos(ctx, pista, camLeitura);
      desenharPiloto(ctx, leitura.piloto, camLeitura);
      desenharHud(ctx, { velocidadeMs: leitura.piloto.velocidade, pontos: leitura.pontos, fase: leitura.fase });
    },
  };
}
