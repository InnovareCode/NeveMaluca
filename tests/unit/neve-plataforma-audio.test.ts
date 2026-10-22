import { describe, expect, it } from 'vitest';
import { aoGestoDeAudio, desbloquearAudio, type AudioDestravavel } from '../../src/platform/audio-desbloqueio';

/*
 * Destrave de áudio no iPhone: o contexto só vira `running` se o resume() vier DENTRO de um gesto que o WebKit reconhece.
 * `touchstart` NÃO conta; `touchend`, `pointerup`, `mouseup`, `click` e `keydown` contam. Estado `interrupted` (ligação, volta do
 * segundo plano) é religado no próximo gesto. O comportamento no aparelho real fica com o dono (plano §8).
 */

function alvoFalso() {
  const ouvintes = new Map<string, Array<{ f: () => void; opcoes: unknown }>>();
  return {
    addEventListener: (t: string, f: () => void, opcoes?: unknown): void => void (ouvintes.get(t) ?? ouvintes.set(t, []).get(t))?.push({ f, opcoes }),
    removeEventListener: (t: string, f: () => void): void => void ouvintes.set(t, (ouvintes.get(t) ?? []).filter((x) => x.f !== f)),
    emitir: (t: string): void => ouvintes.get(t)?.slice().forEach((x) => x.f()),
    tipos: (): string[] => [...ouvintes.entries()].filter(([, v]) => v.length > 0).map(([k]) => k).sort(),
    opcoesDe: (t: string): unknown => ouvintes.get(t)?.[0]?.opcoes,
  };
}

function audioFalso(estado: string | null): AudioDestravavel & { chamadas: string[] } {
  const chamadas: string[] = [];
  const a = {
    ctx: estado === null ? null : { state: estado },
    chamadas,
    init() {
      chamadas.push('init');
      a.ctx ??= { state: 'suspended' };
    },
    resume() {
      chamadas.push('resume');
      if (a.ctx) a.ctx.state = 'running';
    },
  };
  return a;
}

describe('desbloquearAudio', () => {
  it('liga os 5 gestos que o WebKit reconhece e NÃO o touchstart', () => {
    const alvo = alvoFalso();
    desbloquearAudio(alvo, audioFalso('suspended'));
    expect(alvo.tipos()).toEqual(['click', 'keydown', 'mouseup', 'pointerup', 'touchend']);
    expect(alvo.opcoesDe('touchend')).toEqual({ capture: true, passive: true });
  });

  for (const gesto of ['touchend', 'pointerup', 'mouseup', 'click', 'keydown']) {
    it(`contexto suspenso é religado no ${gesto}`, () => {
      const alvo = alvoFalso();
      const audio = audioFalso('suspended');
      desbloquearAudio(alvo, audio);
      alvo.emitir(gesto);
      expect(audio.chamadas).toEqual(['init', 'resume']);
      expect(audio.ctx?.state).toBe('running');
    });
  }

  it('sem contexto ainda (cena de abertura não criou): o gesto cria e liga', () => {
    const alvo = alvoFalso();
    const audio = audioFalso(null);
    desbloquearAudio(alvo, audio);
    alvo.emitir('click');
    expect(audio.chamadas).toEqual(['init', 'resume']);
    expect(audio.ctx?.state).toBe('running');
  });

  it('religa o estado `interrupted` do iOS (ligação, volta do segundo plano) no próximo gesto', () => {
    const alvo = alvoFalso();
    const audio = audioFalso('running');
    desbloquearAudio(alvo, audio);
    alvo.emitir('touchend');
    expect(audio.chamadas).toEqual([]); // já rodando: só confere
    audio.ctx = { state: 'interrupted' };
    alvo.emitir('touchend');
    expect(audio.chamadas).toEqual(['init', 'resume']);
    expect(audio.ctx?.state).toBe('running');
  });

  it('com o contexto rodando, cada gesto é só uma conferência (barato, idempotente)', () => {
    const alvo = alvoFalso();
    const audio = audioFalso('running');
    desbloquearAudio(alvo, audio);
    for (let i = 0; i < 50; i += 1) alvo.emitir('pointerup');
    expect(audio.chamadas).toEqual([]);
  });

  it('desfazer remove todos os ouvintes', () => {
    const alvo = alvoFalso();
    const desfazer = desbloquearAudio(alvo, audioFalso('suspended'));
    desfazer();
    expect(alvo.tipos()).toEqual([]);
  });

  it('ouvintes de gesto rodam sempre; um que falha não derruba o desbloqueio nem os outros', () => {
    const alvo = alvoFalso();
    const audio = audioFalso('suspended');
    desbloquearAudio(alvo, audio);
    const vistos: string[] = [];
    const cortar1 = aoGestoDeAudio(() => {
      throw new Error('ouvinte ruim');
    });
    const cortar2 = aoGestoDeAudio((a) => vistos.push(a.ctx?.state ?? 'sem'));
    const original = console.error;
    console.error = (): void => undefined;
    try {
      alvo.emitir('click');
    } finally {
      console.error = original;
      cortar1();
      cortar2();
    }
    expect(audio.ctx?.state).toBe('running');
    expect(vistos).toEqual(['running']);
    alvo.emitir('click');
    expect(vistos).toEqual(['running']); // cortado
  });
});
