import { describe, expect, it } from 'vitest';
import { criarEntradaTeclado, type AlvoTeclado } from '../../src/input/teclado';

/** Alvo falso (sem DOM; o vitest deste projeto roda em `environment: 'node'`). Mesma ideia do `AlvoFoco` de platform. */
function criarAlvoFalso(): AlvoTeclado & { disparar(tipo: 'keydown' | 'keyup', code: string): boolean } {
  const ouvintes = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    addEventListener(tipo: string, ouvinte: EventListenerOrEventListenerObject) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo)?.add(ouvinte);
    },
    removeEventListener(tipo: string, ouvinte: EventListenerOrEventListenerObject) {
      ouvintes.get(tipo)?.delete(ouvinte);
    },
    disparar(tipo, code) {
      let evitado = false;
      const evento = { code, preventDefault: () => (evitado = true) } as unknown as Event;
      for (const ouvinte of ouvintes.get(tipo) ?? []) {
        if (typeof ouvinte === 'function') ouvinte(evento);
        else ouvinte.handleEvent(evento);
      }
      return evitado;
    },
  };
}

describe('input/teclado: tecla -> InputFrame (C2)', () => {
  it('Espaço segurado = pular; soltar = pular false; preventDefault chamado (R6)', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaTeclado(alvo);
    expect(entrada.quadro().pular).toBe(false);
    const evitado = alvo.disparar('keydown', 'Space');
    expect(evitado).toBe(true);
    expect(entrada.quadro().pular).toBe(true);
    alvo.disparar('keyup', 'Space');
    expect(entrada.quadro().pular).toBe(false);
  });

  it('ArrowLeft/ArrowRight -> giro -1/+1; sem nenhuma pressionada -> 0', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaTeclado(alvo);
    alvo.disparar('keydown', 'ArrowRight');
    expect(entrada.quadro().giro).toBe(1);
    alvo.disparar('keyup', 'ArrowRight');
    alvo.disparar('keydown', 'ArrowLeft');
    expect(entrada.quadro().giro).toBe(-1);
  });

  it('Z/X/C/V -> grab de borda (só no tick do aperto; `quadro()` consome)', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaTeclado(alvo);
    alvo.disparar('keydown', 'KeyZ');
    expect(entrada.quadro().grab).toBe('cima');
    expect(entrada.quadro().grab).toBeNull(); // consumido: não repete enquanto segura
  });

  it('ArrowDown = agachar (segurado, não é borda)', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaTeclado(alvo);
    alvo.disparar('keydown', 'ArrowDown');
    expect(entrada.quadro().agachar).toBe(true);
    expect(entrada.quadro().agachar).toBe(true);
  });

  it('KeyE -> itemBorda() (I4b): só true no tick do aperto, NUNCA entra no InputFrame', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaTeclado(alvo);
    expect(entrada.itemBorda()).toBe(false);
    const evitado = alvo.disparar('keydown', 'KeyE');
    expect(evitado).toBe(true);
    expect(entrada.itemBorda()).toBe(true);
    expect(entrada.itemBorda()).toBe(false); // consumido: não repete enquanto segura
    const frame = entrada.quadro();
    expect(frame).toEqual({ pular: false, giro: 0, grab: null, agachar: false }); // nunca entra no InputFrame
    alvo.disparar('keyup', 'KeyE');
    alvo.disparar('keydown', 'KeyE'); // soltou e apertou de novo: nova borda
    expect(entrada.itemBorda()).toBe(true);
  });

  it('Escape/P chamam aoPausar e NÃO entram no InputFrame', () => {
    const alvo = criarAlvoFalso();
    let pausas = 0;
    const entrada = criarEntradaTeclado(alvo, { aoPausar: () => (pausas += 1) });
    alvo.disparar('keydown', 'Escape');
    alvo.disparar('keydown', 'KeyP');
    expect(pausas).toBe(2);
    const frame = entrada.quadro();
    expect(frame).toEqual({ pular: false, giro: 0, grab: null, agachar: false });
  });

  it('destruir() remove os listeners: depois disso, disparar não muda mais nada', () => {
    const alvo = criarAlvoFalso();
    const entrada = criarEntradaTeclado(alvo);
    entrada.destruir();
    alvo.disparar('keydown', 'Space');
    expect(entrada.quadro().pular).toBe(false);
  });
});
