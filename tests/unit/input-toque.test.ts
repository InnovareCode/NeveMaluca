import { describe, expect, it } from 'vitest';
import { criarEntradaToque, type AlvoToque } from '../../src/input/toque';

const RETANGULO = { left: 0, top: 0, right: 960, bottom: 540, width: 960, height: 540, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;

interface PointerFalso {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly timeStamp: number;
}

/** Alvo falso (sem DOM; o vitest deste projeto roda em `environment: 'node'`). Mesma ideia do `AlvoFoco` de platform. */
function criarAlvoFalso(): AlvoToque & { disparar(tipo: string, p: PointerFalso): boolean } {
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
      let evitado = false;
      const evento = { ...p, preventDefault: () => (evitado = true) } as unknown as Event;
      for (const ouvinte of ouvintes.get(tipo) ?? []) {
        if (typeof ouvinte === 'function') ouvinte(evento);
        else ouvinte.handleEvent(evento);
      }
      return evitado;
    },
  };
}

describe('input/toque: Pointer Events -> InputFrame (C2)', () => {
  it('tocar em qualquer lugar = pular; metade esquerda = giro -1', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);
    const evitado = alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    expect(evitado).toBe(true); // R6: preventDefault sempre
    const frame = entrada.quadro();
    expect(frame.pular).toBe(true);
    expect(frame.giro).toBe(-1);
  });

  it('metade direita = giro +1', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 800, clientY: 300, timeStamp: 0 });
    expect(entrada.quadro().giro).toBe(1);
  });

  it('margem da borda (R6): tocar perto da borda não conta como "segurar" um lado', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 5, clientY: 300, timeStamp: 0 });
    const frame = entrada.quadro();
    expect(frame.pular).toBe(true); // pular funciona em qualquer lugar, inclusive na borda
    expect(frame.giro).toBe(0);
  });

  it('soltar o dedo zera pular e giro', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointerup', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 10 });
    const frame = entrada.quadro();
    expect(frame.pular).toBe(false);
    expect(frame.giro).toBe(0);
  });

  it('deslize rápido (acima do limiar, dentro da janela) vira grab na direção dominante e some o giro', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo, { limiarDeslizePx: 24, janelaGestoMs: 150 });
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointermove', { pointerId: 1, clientX: 150, clientY: 302, timeStamp: 50 }); // dx=50 >= 24, dt=50<=150
    const frame = entrada.quadro();
    expect(frame.grab).toBe('frente'); // dx positivo e |dx|>=|dy|
    expect(frame.giro).toBe(0);
    expect(entrada.quadro().grab).toBeNull(); // borda: consumido
  });

  it('segurar sem deslizar além da janela classifica como "segurar" (giro continua valendo)', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo, { limiarDeslizePx: 24, janelaGestoMs: 150 });
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointermove', { pointerId: 1, clientX: 105, clientY: 300, timeStamp: 200 }); // dt > 150, dist pequena
    const frame = entrada.quadro();
    expect(frame.grab).toBeNull();
    expect(frame.giro).toBe(-1);
  });

  it('um segundo dedo não muda pulo/giro do primeiro (I4: 2º dedo é só agachar)', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointerdown', { pointerId: 2, clientX: 800, clientY: 300, timeStamp: 0 });
    const frame = entrada.quadro();
    expect(frame.giro).toBe(-1); // o segundo dedo não disputa giro (não é mais ignorado, mas também não governa isto)
    expect(frame.pular).toBe(true);
  });

  it('I4: segundo dedo pressionado = agachar; soltar o segundo zera agachar e mantém o primeiro', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    expect(entrada.quadro().agachar).toBe(false);
    alvo.disparar('pointerdown', { pointerId: 2, clientX: 800, clientY: 300, timeStamp: 0 });
    let frame = entrada.quadro();
    expect(frame.agachar).toBe(true);
    expect(frame.pular).toBe(true); // o 1º dedo continua intacto
    alvo.disparar('pointerup', { pointerId: 2, clientX: 800, clientY: 300, timeStamp: 10 });
    frame = entrada.quadro();
    expect(frame.agachar).toBe(false);
    expect(frame.pular).toBe(true); // soltar o 2º não afeta o 1º
  });

  it('I4: soltar o 1º dedo primeiro não afeta o agachar do 2º (independentes)', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointerdown', { pointerId: 2, clientX: 800, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointerup', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 10 });
    const frame = entrada.quadro();
    expect(frame.pular).toBe(false); // 1º dedo soltou
    expect(frame.agachar).toBe(true); // 2º continua pressionado
  });

  it('I4: um 3º ponteiro é ignorado (só dois dedos têm efeito)', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointerdown', { pointerId: 2, clientX: 800, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointerdown', { pointerId: 3, clientX: 500, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointerup', { pointerId: 3, clientX: 500, clientY: 300, timeStamp: 5 });
    const frame = entrada.quadro();
    expect(frame.agachar).toBe(true); // ainda é o 2º dedo que manda, o 3º não teve efeito
    expect(frame.pular).toBe(true);
  });

  it('destruir() remove os listeners', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo);
    entrada.destruir();
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    expect(entrada.quadro().pular).toBe(false);
  });
});

// Canto inferior direito, 76x76, margem 24 -- mesmos números de `render/hud.ts: RETANGULO_BOTAO_ITEM`.
const BOTAO_ITEM = { x: 860, y: 440, w: 76, h: 76 };
const DENTRO_DO_BOTAO = { x: 890, y: 470 }; // centro do botão

describe('input/toque: botão de item (I4b) -- coexiste com pulo/giro/agachar sem conflitar', () => {
  it('tap dentro do botão: itemBorda() true, mas NUNCA pula/gira/agacha (1º toque da tela)', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo, { botaoItem: BOTAO_ITEM });
    const evitado = alvo.disparar('pointerdown', { pointerId: 1, clientX: DENTRO_DO_BOTAO.x, clientY: DENTRO_DO_BOTAO.y, timeStamp: 0 });
    expect(evitado).toBe(true);
    expect(entrada.itemBorda()).toBe(true);
    const frame = entrada.quadro();
    expect(frame.pular).toBe(false);
    expect(frame.giro).toBe(0);
    expect(frame.agachar).toBe(false);
  });

  it('itemBorda() é borda: só true no tick do tap, consome o pendente', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo, { botaoItem: BOTAO_ITEM });
    alvo.disparar('pointerdown', { pointerId: 1, clientX: DENTRO_DO_BOTAO.x, clientY: DENTRO_DO_BOTAO.y, timeStamp: 0 });
    expect(entrada.itemBorda()).toBe(true);
    expect(entrada.itemBorda()).toBe(false); // consumido
    // segurando o dedo no botão, sem soltar: continua sem repetir a borda
    expect(entrada.itemBorda()).toBe(false);
  });

  it('soltar e tocar de novo no botão abre uma nova borda', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo, { botaoItem: BOTAO_ITEM });
    alvo.disparar('pointerdown', { pointerId: 1, clientX: DENTRO_DO_BOTAO.x, clientY: DENTRO_DO_BOTAO.y, timeStamp: 0 });
    expect(entrada.itemBorda()).toBe(true);
    alvo.disparar('pointerup', { pointerId: 1, clientX: DENTRO_DO_BOTAO.x, clientY: DENTRO_DO_BOTAO.y, timeStamp: 10 });
    alvo.disparar('pointerdown', { pointerId: 2, clientX: DENTRO_DO_BOTAO.x, clientY: DENTRO_DO_BOTAO.y, timeStamp: 20 });
    expect(entrada.itemBorda()).toBe(true);
  });

  it('1º dedo já pulando em outro lugar: um 2º dedo que cai no botão vira item, NÃO agachar', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo, { botaoItem: BOTAO_ITEM });
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 }); // pulo normal
    alvo.disparar('pointerdown', { pointerId: 2, clientX: DENTRO_DO_BOTAO.x, clientY: DENTRO_DO_BOTAO.y, timeStamp: 0 });
    expect(entrada.itemBorda()).toBe(true);
    const frame = entrada.quadro();
    expect(frame.pular).toBe(true); // o 1º dedo continua intacto
    expect(frame.agachar).toBe(false); // o 2º NÃO virou agachar -- foi pro botão
  });

  it('agachar (2º dedo) fora da zona do botão continua funcionando normalmente', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo, { botaoItem: BOTAO_ITEM });
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointerdown', { pointerId: 2, clientX: 500, clientY: 300, timeStamp: 0 }); // fora do botão
    const frame = entrada.quadro();
    expect(frame.pular).toBe(true);
    expect(frame.agachar).toBe(true);
    expect(entrada.itemBorda()).toBe(false);
  });

  it('sem `opcoes.botaoItem` (treino/descida solo): tocar na mesma região continua sendo pulo normal, como antes', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo); // sem botaoItem
    alvo.disparar('pointerdown', { pointerId: 1, clientX: DENTRO_DO_BOTAO.x, clientY: DENTRO_DO_BOTAO.y, timeStamp: 0 });
    const frame = entrada.quadro();
    expect(frame.pular).toBe(true);
    expect(entrada.itemBorda()).toBe(false);
  });

  it('soltar o dedo do item não afeta pulo/agachar dos outros dois slots', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaToque(alvo, { botaoItem: BOTAO_ITEM });
    alvo.disparar('pointerdown', { pointerId: 1, clientX: 100, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointerdown', { pointerId: 2, clientX: 500, clientY: 300, timeStamp: 0 });
    alvo.disparar('pointerdown', { pointerId: 3, clientX: DENTRO_DO_BOTAO.x, clientY: DENTRO_DO_BOTAO.y, timeStamp: 0 });
    entrada.itemBorda();
    alvo.disparar('pointerup', { pointerId: 3, clientX: DENTRO_DO_BOTAO.x, clientY: DENTRO_DO_BOTAO.y, timeStamp: 10 });
    const frame = entrada.quadro();
    expect(frame.pular).toBe(true);
    expect(frame.agachar).toBe(true);
  });
});
