// Camada input/: teclado e toque -> ComandoDescida (C2), plano §3.7 (M1a, Lyra). Gamepad fica para depois (fora
// do caminho crítico do portão do M1a: "a sensação de descer está boa?"); registrado como pendência no handoff.
// Responsável e regras no README.md desta pasta.
import { derivarComando, INPUT_NEUTRO } from '../core/comandos';
import type { ComandoDescida, InputFrame } from '../core/contratos';
import { criarEntradaTeclado, type AlvoTeclado, type OpcoesTeclado } from './teclado';
import { criarEntradaToque, type AlvoToque, type OpcoesToque } from './toque';

export * from './teclado';
export * from './toque';

export interface OpcoesEntrada {
  readonly teclado?: OpcoesTeclado;
  readonly toque?: OpcoesToque;
}

export interface Entrada {
  /** Comando do tick (C2), com a borda do pulo já derivada a partir do quadro anterior. Chamar 1x por tick. */
  obterComando(): ComandoDescida;
  /** Último `InputFrame` combinado (teclado OU toque), para HUD/depuração. Não consome nada por si só. */
  quadroBruto(): InputFrame;
  destruir(): void;
}

function mesclar(a: InputFrame, b: InputFrame): InputFrame {
  return { pular: a.pular || b.pular, giro: a.giro !== 0 ? a.giro : b.giro, grab: a.grab ?? b.grab, agachar: a.agachar || b.agachar };
}

/** Teclado + toque combinados num só `Entrada` (a cena lê só isto; não precisa saber de qual dispositivo veio). */
export function criarEntrada(canvas: AlvoToque, janela: AlvoTeclado = window, opcoes: OpcoesEntrada = {}): Entrada {
  const teclado = criarEntradaTeclado(janela, opcoes.teclado);
  const toque = criarEntradaToque(canvas, opcoes.toque);
  let anterior: InputFrame | null = null;
  let ultimo: InputFrame = INPUT_NEUTRO;

  return {
    obterComando(): ComandoDescida {
      const atual = mesclar(teclado.quadro(), toque.quadro());
      const cmd = derivarComando(anterior, atual);
      anterior = atual;
      ultimo = atual;
      return cmd;
    },
    quadroBruto(): InputFrame {
      return ultimo;
    },
    destruir() {
      teclado.destruir();
      toque.destruir();
    },
  };
}
