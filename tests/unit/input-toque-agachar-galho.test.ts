/**
 * Prova de ponta a ponta do I4 (toque → agachar): o `InputFrame.agachar` que `src/input/toque.ts` produz a partir
 * de um SEGUNDO dedo real (`Pointer Events` sintéticos, mesma técnica de `input-toque.test.ts`) chega, via
 * `core/comandos.derivarComando`, ao motor (`descida/motor.ts`) e evita o tombo no "galho" (`CamadaJogo.obstaculosAltos`,
 * C4) — o mesmo cenário de `descida-motor-camada.test.ts`, mas alimentado pelo toque de verdade, não por um
 * `ComandoDescida` escrito à mão. Sem o 2º dedo, o comportamento de sempre (tomba) continua intacto.
 */
import { describe, expect, it } from 'vitest';
import type { CamadaJogo } from '../../src/core/contratos';
import { derivarComando } from '../../src/core/comandos';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { CONFIG_PADRAO } from '../../src/descida/constantes';
import { criarDescida } from '../../src/descida/motor';
import { criarEntradaToque, type AlvoToque } from '../../src/input/toque';
import { gerarPista } from '../../src/pista/gerador';

const RETANGULO = { left: 0, top: 0, right: 960, bottom: 540, width: 960, height: 540, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

interface PointerFalso {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly timeStamp: number;
}

function criarAlvoFalso(): AlvoToque & { disparar(tipo: string, p: PointerFalso): void } {
  const ouvintes = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    addEventListener(tipo: string, ouvinte: EventListenerOrEventListenerObject) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo)?.add(ouvinte);
    },
    removeEventListener(tipo: string, ouvinte: EventListenerOrEventListenerObject) {
      ouvintes.get(tipo)?.delete(ouvinte);
    },
    getBoundingClientRect() {
      return RETANGULO;
    },
    disparar(tipo, p) {
      const evento = { ...p, preventDefault: () => {} } as unknown as Event;
      for (const ouvinte of ouvintes.get(tipo) ?? []) {
        if (typeof ouvinte === 'function') ouvinte(evento);
        else ouvinte.handleEvent(evento);
      }
    },
  };
}

const OBSTACULO: CamadaJogo = {
  itens: [],
  kickers: [],
  caixas: [],
  porticoX: 0,
  versao: '1',
  hash: '0000000000000000',
  obstaculosAltos: [{ tipo: 'galho', x: 8, largura: 2, altura: 1.3, variante: 0 }],
};

describe('toque (2 dedos) -> agachar -> motor: desvia do galho de verdade', () => {
  it('com o 2º dedo pressionado (agachar via toque), atravessa o galho sem tombar', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const motor = criarDescida(pista, CONFIG_PADRAO, { camada: OBSTACULO });
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);

    // 1º dedo toca e solta na hora (não chega a saltar: solta antes do 1º quadro()); o 2º dedo fica segurado —
    // é a mesma independência provada em input-toque.test.ts ("soltar o 1º não afeta o 2º").
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 480, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointerdown', { pointerId: 2, clientX: 480, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointerup', { pointerId: 1, clientX: 480, clientY: 300, timeStamp: 0 });

    let anterior = null as Parameters<typeof derivarComando>[0];
    let leitura = motor.leitura();
    for (let i = 0; i < 1000 && leitura.piloto.x < 11; i++) {
      const quadro = entrada.quadro();
      expect(quadro.agachar).toBe(true); // o toque de verdade está reportando agachar
      const cmd = derivarComando(anterior, quadro);
      anterior = quadro;
      leitura = motor.processar(cmd);
      expect(leitura.fase).not.toBe('tombo');
    }
    expect(leitura.piloto.x).toBeGreaterThanOrEqual(11);
    entrada.destruir();
  });

  it('sem o 2º dedo (toque ocioso, agachar sempre false), tomba no galho igual a antes do I4', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const motor = criarDescida(pista, CONFIG_PADRAO, { camada: OBSTACULO });
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);

    let anterior = null as Parameters<typeof derivarComando>[0];
    let leitura = motor.leitura();
    let tombouPorObstaculo = false;
    for (let i = 0; i < 1000 && leitura.fase !== 'tombo'; i++) {
      const quadro = entrada.quadro();
      expect(quadro.agachar).toBe(false);
      const cmd = derivarComando(anterior, quadro);
      anterior = quadro;
      leitura = motor.processar(cmd);
      if (leitura.eventos.some((e) => e.tipo === 'tombo' && e.causa === 'obstaculo')) tombouPorObstaculo = true;
    }
    expect(leitura.fase).toBe('tombo');
    expect(tombouPorObstaculo).toBe(true);
    entrada.destruir();
  });
});
