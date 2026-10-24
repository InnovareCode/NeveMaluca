/**
 * Toque -> `InputFrame` (C2), plano §3.7. Usa PONTER EVENTS (não `TouchEvent`): unificam dedo/mouse/caneta, têm
 * suporte melhor entre motores (inclusive para testar com eventos sintéticos) e o navegador os entrega mesmo com
 * `touch-action: none` (que já vem de `src/estilo.css`, fora desta pasta). Um só ponteiro por vez (plano: "com um
 * dedo"); ponteiros extras são ignorados até o primeiro soltar.
 *
 * Semântica (tabela do plano §3.7), no 1º dedo (ponteiro primário):
 *  - `pular`: true enquanto o dedo está na tela (a BORDA do pulo é derivada depois, em `core/comandos.derivarComando`;
 *    tocar rápido = 1 pulo, segurar não repete).
 *  - `giro`: metade esquerda/direita do canvas => -1/+1, enquanto segurado e sem ter virado um deslize.
 *  - `grab`: deslize (deslocamento >= `limiarDeslizePx` dentro de `janelaGestoMs`) na direção dominante; some o
 *    `giro` daquele toque (não é mais "segurar", é gesto). Depois da janela sem deslize, fica travado em "segurar".
 *
 * `agachar` (I4, multi-toque): um 2º dedo na tela, SIMULTÂNEO ao primeiro ou não — `agachar` é true enquanto
 * esse 2º ponteiro estiver pressionado, e volta a false quando ele soltar. É deliberadamente independente do 1º
 * dedo (que continua controlando pulo/giro/grab sem nenhuma mudança): soltar o 1º dedo não afeta o 2º e
 * vice-versa, então agachar nunca "contamina" o pulo nem é perdido se o jogador soltar o dedo do pulo primeiro.
 * Um 3º+ ponteiro é ignorado (só dois dedos têm efeito).
 *
 * Risco R6 (plano): no Chrome do iPhone, um deslize que nasce rente à borda pode voltar a página mesmo com
 * `touch-action: none` (gesto de sistema fora do alcance do toque da página). Mitigação AQUI: `preventDefault`
 * sempre (nos dois dedos), e a faixa `margemBordaPx` perto das bordas não conta como "segurar" um lado no 1º
 * dedo (reduz a chance de um giro acidental competir com o gesto do sistema). **Confirmar no aparelho** (plano:
 * risco ainda aberto).
 *
 * `alvo` é um subconjunto estrutural de `HTMLCanvasElement` (mesma ideia do `AlvoFoco` de `platform/foco.ts`):
 * permite testar com um objeto falso em Node, sem DOM real.
 */
import type { Grab, InputFrame } from '../core/contratos';

export type AlvoToque = Pick<HTMLCanvasElement, 'addEventListener' | 'removeEventListener' | 'getBoundingClientRect'>;

export interface OpcoesToque {
  readonly limiarDeslizePx?: number;
  readonly janelaGestoMs?: number;
  readonly margemBordaPx?: number;
}

export interface EntradaToque {
  /** Um quadro por leitura; consome o `grab` pendente (borda). Chamar uma vez por tick. */
  quadro(): InputFrame;
  destruir(): void;
}

const LIMIAR_DESLIZE_PADRAO_PX = 24;
const JANELA_GESTO_PADRAO_MS = 150;
const MARGEM_BORDA_PADRAO_PX = 16;

function direcaoDoGesto(dx: number, dy: number): Grab {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'frente' : 'tras';
  return dy >= 0 ? 'baixo' : 'cima';
}

export function criarEntradaToque(alvo: AlvoToque, opcoes: OpcoesToque = {}): EntradaToque {
  const limiar = opcoes.limiarDeslizePx ?? LIMIAR_DESLIZE_PADRAO_PX;
  const janela = opcoes.janelaGestoMs ?? JANELA_GESTO_PADRAO_MS;
  const margem = opcoes.margemBordaPx ?? MARGEM_BORDA_PADRAO_PX;

  let ponteiroId: number | null = null;
  let ativo = false;
  let inicioX = 0;
  let inicioY = 0;
  let inicioT = 0;
  let classificado: 'pendente' | 'segurando' | 'deslize' = 'pendente';
  let giroAtual: -1 | 0 | 1 = 0;
  let grabPendente: Grab | null = null;
  // 2º dedo (I4): exclusivamente agachar, sem gesto nem posição — só "pressionado ou não".
  let ponteiroAgacharId: number | null = null;
  let agacharAtivo = false;

  const aoDescer = (ev: Event): void => {
    const e = ev as PointerEvent;
    if (ponteiroId === null) {
      e.preventDefault();
      ponteiroId = e.pointerId;
      ativo = true;
      inicioX = e.clientX;
      inicioY = e.clientY;
      inicioT = e.timeStamp;
      classificado = 'pendente';
      const retangulo = alvo.getBoundingClientRect();
      const naBorda = e.clientX - retangulo.left < margem || retangulo.right - e.clientX < margem;
      giroAtual = naBorda ? 0 : e.clientX - retangulo.left < retangulo.width / 2 ? -1 : 1;
      return;
    }
    if (e.pointerId === ponteiroId || ponteiroAgacharId !== null) return; // 3º+ ponteiro: ignorado
    e.preventDefault();
    ponteiroAgacharId = e.pointerId;
    agacharAtivo = true;
  };

  const aoMover = (ev: Event): void => {
    const e = ev as PointerEvent;
    if (e.pointerId === ponteiroAgacharId) {
      e.preventDefault(); // R6: não deixa o 2º dedo também escapar pro gesto de sistema se deslizar
      return;
    }
    if (e.pointerId !== ponteiroId || !ativo) return;
    e.preventDefault();
    if (classificado !== 'pendente') return;
    const dx = e.clientX - inicioX;
    const dy = e.clientY - inicioY;
    const dt = e.timeStamp - inicioT;
    if (Math.hypot(dx, dy) >= limiar && dt <= janela) {
      classificado = 'deslize';
      grabPendente = direcaoDoGesto(dx, dy);
      giroAtual = 0;
    } else if (dt > janela) {
      classificado = 'segurando';
    }
  };

  const aoSoltar = (ev: Event): void => {
    const e = ev as PointerEvent;
    if (e.pointerId === ponteiroAgacharId) {
      ponteiroAgacharId = null;
      agacharAtivo = false;
      return;
    }
    if (e.pointerId !== ponteiroId) return;
    ativo = false;
    giroAtual = 0;
    ponteiroId = null;
    classificado = 'pendente';
  };

  alvo.addEventListener('pointerdown', aoDescer);
  alvo.addEventListener('pointermove', aoMover);
  alvo.addEventListener('pointerup', aoSoltar);
  alvo.addEventListener('pointercancel', aoSoltar);

  return {
    quadro(): InputFrame {
      const grab = grabPendente;
      grabPendente = null;
      return { pular: ativo, giro: giroAtual, grab, agachar: agacharAtivo };
    },
    destruir() {
      alvo.removeEventListener('pointerdown', aoDescer);
      alvo.removeEventListener('pointermove', aoMover);
      alvo.removeEventListener('pointerup', aoSoltar);
      alvo.removeEventListener('pointercancel', aoSoltar);
    },
  };
}
