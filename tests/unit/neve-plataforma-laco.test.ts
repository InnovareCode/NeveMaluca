import { describe, expect, it } from 'vitest';
import { ACUMULADOR_MAXIMO_MS, PASSO_MS } from '../../src/platform/constantes';
import { criarLaco } from '../../src/platform/laco';

/** requestAnimationFrame falso: o teste decide o carimbo de cada quadro. */
function raf() {
  let proximo: ((t: number) => void) | null = null;
  let id = 0;
  const cancelados: number[] = [];
  return {
    agendar: (cb: (t: number) => void): number => {
      proximo = cb;
      return ++id;
    },
    cancelar: (i: number): void => {
      cancelados.push(i);
      proximo = null;
    },
    agendado: (): boolean => proximo !== null,
    quadro: (t: number): void => {
      const cb = proximo;
      proximo = null;
      cb?.(t);
    },
    cancelados,
  };
}

function montar(opcoes: { passoMs?: number; aoErro?: (e: unknown) => void; falhaEmAtualizar?: boolean } = {}) {
  const r = raf();
  const registro = { atualizacoes: 0, alphas: [] as number[] };
  const laco = criarLaco({
    atualizar: () => {
      registro.atualizacoes += 1;
      if (opcoes.falhaEmAtualizar) throw new Error('quebrou');
    },
    desenhar: (a) => registro.alphas.push(a),
    agendar: r.agendar,
    cancelar: r.cancelar,
    ...(opcoes.passoMs !== undefined ? { passoMs: opcoes.passoMs } : {}),
    ...(opcoes.aoErro ? { aoErro: opcoes.aoErro } : {}),
  });
  return { r, registro, laco };
}

describe('laço de passo fixo', () => {
  it('constantes do plano §3.2: 1000/60 ms por tick, acumulador limitado a 100 ms', () => {
    expect(PASSO_MS).toBeCloseTo(16.6667, 3);
    expect(ACUMULADOR_MAXIMO_MS).toBe(100);
  });

  it('o primeiro quadro só marca o tempo (0 ticks) e desenha uma vez', () => {
    const { r, registro, laco } = montar();
    laco.iniciar();
    r.quadro(5000);
    expect(registro.atualizacoes).toBe(0);
    expect(registro.alphas).toEqual([0]);
    expect(laco.quadros).toBe(1);
  });

  it('60 Hz: um tick por quadro; 120 Hz: um tick a cada dois quadros; sempre 60 ticks por segundo', () => {
    for (const hz of [60, 120, 144]) {
      const { r, registro, laco } = montar();
      laco.iniciar();
      const dt = 1000 / hz;
      r.quadro(0);
      for (let i = 1; i <= hz * 10; i += 1) r.quadro(i * dt);
      // 10 s => 600 ticks (± 1 de arredondamento do acumulador)
      expect(Math.abs(registro.atualizacoes - 600)).toBeLessThanOrEqual(1);
      expect(laco.ticks).toBe(registro.atualizacoes);
    }
  });

  it('um quadro lento roda vários ticks de uma vez, e alpha é a fração do tick que sobrou', () => {
    const { r, registro, laco } = montar({ passoMs: 10 });
    laco.iniciar();
    r.quadro(0);
    r.quadro(35);
    expect(registro.atualizacoes).toBe(3);
    expect(registro.alphas.at(-1)).toBeCloseTo(0.5, 10);
    expect(registro.alphas.every((a) => a >= 0 && a < 1)).toBe(true);
  });

  it('aba parada por 10 s NÃO vira 600 ticks: o acumulador é limitado a 100 ms (5 a 6 ticks, conforme o arredondamento)', () => {
    const { r, registro, laco } = montar();
    laco.iniciar();
    r.quadro(0);
    r.quadro(10_000);
    expect(registro.atualizacoes).toBeGreaterThanOrEqual(5);
    expect(registro.atualizacoes).toBeLessThanOrEqual(6);
  });

  it('carimbo que anda para trás não gera tick nem tempo negativo', () => {
    const { r, registro, laco } = montar({ passoMs: 10 });
    laco.iniciar();
    r.quadro(100);
    r.quadro(50);
    r.quadro(60);
    expect(registro.atualizacoes).toBe(1);
    expect(registro.alphas.every((a) => a >= 0 && a < 1)).toBe(true);
  });

  it('iniciar duas vezes não agenda dois quadros', () => {
    const { r, laco } = montar();
    laco.iniciar();
    laco.iniciar();
    r.quadro(0);
    expect(r.agendado()).toBe(true);
    r.quadro(16);
    r.quadro(33);
    expect(laco.quadros).toBe(3);
  });
});

describe('pausa por motivo', () => {
  it('pausar cancela o quadro agendado; retomar volta; o tempo parado NÃO vira ticks', () => {
    const { r, registro, laco } = montar();
    laco.iniciar();
    r.quadro(0);
    r.quadro(17);
    const antes = registro.atualizacoes;
    laco.pausar('foco');
    expect(laco.pausado).toBe(true);
    expect(laco.rodando).toBe(false);
    expect(r.agendado()).toBe(false);
    expect(r.cancelados.length).toBe(1);
    laco.retomar('foco');
    expect(laco.pausado).toBe(false);
    expect(r.agendado()).toBe(true);
    r.quadro(60_000); // 1 minuto depois
    expect(registro.atualizacoes).toBe(antes);
    r.quadro(60_017);
    expect(registro.atualizacoes).toBe(antes + 1);
  });

  it('dois motivos: só volta quando o ÚLTIMO sai (foco perdido em retrato não retoma ao voltar o foco)', () => {
    const { r, laco } = montar();
    laco.iniciar();
    r.quadro(0);
    laco.pausar('retrato');
    laco.pausar('foco');
    expect([...laco.motivosDePausa].sort()).toEqual(['foco', 'retrato']);
    laco.retomar('foco');
    expect(laco.pausado).toBe(true);
    expect(r.agendado()).toBe(false);
    laco.retomar('retrato');
    expect(laco.pausado).toBe(false);
    expect(r.agendado()).toBe(true);
  });

  it('pausar o mesmo motivo duas vezes e retomar uma só é suficiente (idempotente por motivo)', () => {
    const { laco } = montar();
    laco.iniciar();
    laco.pausar('foco');
    laco.pausar('foco');
    laco.retomar('foco');
    expect(laco.pausado).toBe(false);
  });

  it('retomar sem ter iniciado não liga o laço; pausar antes de iniciar adia o início', () => {
    const { r, laco } = montar();
    laco.retomar('foco');
    expect(r.agendado()).toBe(false);
    laco.pausar('oculta');
    laco.iniciar();
    expect(r.agendado()).toBe(false);
    laco.retomar('oculta');
    expect(r.agendado()).toBe(true);
  });

  it('parar encerra de vez (retomar não religa)', () => {
    const { r, laco } = montar();
    laco.iniciar();
    laco.parar();
    expect(r.agendado()).toBe(false);
    laco.pausar('x');
    laco.retomar('x');
    expect(r.agendado()).toBe(false);
  });

  it('a cena pode pausar de dentro do tick sem que o laço agende o próximo quadro', () => {
    const r = raf();
    const laco = criarLaco({
      atualizar: () => laco.pausar('cena'),
      desenhar: () => undefined,
      agendar: r.agendar,
      cancelar: r.cancelar,
    });
    laco.iniciar();
    r.quadro(0);
    r.quadro(20);
    expect(r.agendado()).toBe(false);
    expect(laco.pausado).toBe(true);
  });
});

describe('erro dentro do quadro', () => {
  it('com aoErro: o laço PARA (não repete o erro 60 vezes por segundo) e avisa uma vez', () => {
    const erros: unknown[] = [];
    const { r, laco } = montar({ aoErro: (e) => erros.push(e), falhaEmAtualizar: true });
    laco.iniciar();
    r.quadro(0);
    r.quadro(20);
    expect(erros).toHaveLength(1);
    expect((erros[0] as Error).message).toBe('quebrou');
    expect(r.agendado()).toBe(false);
    expect(laco.rodando).toBe(false);
  });

  it('sem aoErro: relança (não engole)', () => {
    const { r, laco } = montar({ falhaEmAtualizar: true });
    laco.iniciar();
    r.quadro(0);
    expect(() => r.quadro(20)).toThrow('quebrou');
  });
});
