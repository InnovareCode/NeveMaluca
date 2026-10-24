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
  /**
   * Borda de "usar item" (I4b, plano itens-corrida): tecla E OU tap no `botaoItem` do toque OU botão de ombro do
   * controle, combinados — NUNCA entra em `ComandoDescida`/`InputFrame` (contrato de Vega); quem lê isto é
   * `ui/cenas/corrida.ts`, pra montar `ComandoCorrida.usarItem`. Chamar no máximo 1x por tick (consome a borda de
   * teclado/toque; o gamepad deriva a própria borda por dentro, comparando com o estado do tick anterior).
   */
  usarItemBorda(): boolean;
  destruir(): void;
}

function mesclar(a: InputFrame, b: InputFrame): InputFrame {
  return { pular: a.pular || b.pular, giro: a.giro !== 0 ? a.giro : b.giro, grab: a.grab ?? b.grab, agachar: a.agachar || b.agachar };
}

/** Botão de ombro do controle (L1/LB, índice 4 do Gamepad API) para usar item — "fica para depois" do README não
 *  se aplica aqui porque é 1 linha opcional por cima de uma API que o navegador já expõe, não um módulo novo de
 *  gestos. Melhor esforço: sem `navigator.getGamepads` (Node/teste/navegador antigo) ou sem controle conectado,
 *  sempre `false`, nunca lança. */
function botaoOmbroPressionado(): boolean {
  try {
    const nav = (globalThis as { navigator?: { getGamepads?: () => readonly (Gamepad | null)[] } }).navigator;
    const gamepads = nav?.getGamepads?.();
    if (!gamepads) return false;
    for (const gp of gamepads) {
      if (gp?.buttons?.[4]?.pressed) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/** Teclado + toque combinados num só `Entrada` (a cena lê só isto; não precisa saber de qual dispositivo veio). */
export function criarEntrada(canvas: AlvoToque, janela: AlvoTeclado = window, opcoes: OpcoesEntrada = {}): Entrada {
  const teclado = criarEntradaTeclado(janela, opcoes.teclado);
  const toque = criarEntradaToque(canvas, opcoes.toque);
  let anterior: InputFrame | null = null;
  let ultimo: InputFrame = INPUT_NEUTRO;
  let ombroAnteriorPressionado = false;

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
    usarItemBorda(): boolean {
      // Sem curto-circuito (`||` pularia o consumo do pendente dos outros dois): cada um PRECISA ser lido e
      // consumido todo tick, senão uma borda que "perdeu" pra outra fica pendurada e dispara sozinha depois.
      const tecladoBorda = teclado.itemBorda();
      const toqueBorda = toque.itemBorda();
      const ombroAgora = botaoOmbroPressionado();
      const ombroBorda = ombroAgora && !ombroAnteriorPressionado;
      ombroAnteriorPressionado = ombroAgora;
      return tecladoBorda || toqueBorda || ombroBorda;
    },
    destruir() {
      teclado.destruir();
      toque.destruir();
    },
  };
}
