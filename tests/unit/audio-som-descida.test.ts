/**
 * `criarSomDescida` (src/audio/som-descida.ts): pulo (whoosh proporcional à força + camada extra do kicker),
 * pouso (3 qualidades), tombo, coleta (floco/dourado), acerto sofrido (`'atingido'`) e chegada — sem tocar em
 * `descida/`, só reagindo a `EventoDescida` (contrato C3).
 */
import { describe, expect, it } from 'vitest';
import type { EventoDescida } from '../../src/core/contratos';
import { criarRng } from '../../src/core/rng';
import { AudioDestravavel } from '../../src/audio/audio-destravavel';
import { criarSomDescida } from '../../src/audio/som-descida';
import { criarContextoSinteseFalso, type ContextoSinteseFalso } from '../support/audio-falso';

function montar(volumeInicial = 1, semente = 1): { falso: ContextoSinteseFalso; audio: AudioDestravavel; som: ReturnType<typeof criarSomDescida>; volume: { v: number } } {
  const falso = criarContextoSinteseFalso();
  const audio = new AudioDestravavel(() => falso.ctx);
  audio.init();
  const volume = { v: volumeInicial };
  const som = criarSomDescida(audio, criarRng(semente), { obterVolumeSom: () => volume.v });
  return { falso, audio, som, volume };
}

describe('pulo: whoosh proporcional à força, kicker ganha uma 2ª camada', () => {
  it('pulo normal (força baixa): só o whoosh (1 ruído), sem camada extra', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'pulo', forca: 9 });
    expect(falso.ruidos).toHaveLength(1);
    expect(falso.osciladores).toHaveLength(0);
  });

  it('pulo com rampa (força moderada, ainda abaixo do limiar do kicker): sem camada extra', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'pulo', forca: 20 });
    expect(falso.ruidos).toHaveLength(1);
    expect(falso.osciladores).toHaveLength(0);
  });

  it('pulo turbinado por kicker (força bem acima do normal): ganha 1 oscilador extra por cima do whoosh', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'pulo', forca: 9 + 32 }); // impulsoPuloMs + IMPULSO_KICKER_MS
    expect(falso.ruidos).toHaveLength(1);
    expect(falso.osciladores).toHaveLength(1);
    expect(falso.osciladores[0]?.forma).toBe('sawtooth');
  });

  it('o whoosh fica mais agudo/mais longo com mais força (nunca estoura: satura em 40)', () => {
    const fracoRodar = (): number | null => {
      const { falso, som } = montar();
      som.aoEvento({ tipo: 'pulo', forca: 2 });
      return falso.ruidos[0]?.f1 ?? null;
    };
    const forteRodar = (): number | null => {
      const { falso, som } = montar();
      som.aoEvento({ tipo: 'pulo', forca: 40 });
      return falso.ruidos[0]?.f1 ?? null;
    };
    expect(forteRodar() as number).toBeGreaterThan(fracoRodar() as number);
  });
});

describe('pouso: 3 qualidades com timbre distinto', () => {
  it('perfeito: 2 osciladores (o tom principal + o brilho)', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'pouso', qualidade: 'perfeito', queda: 1 });
    expect(falso.osciladores).toHaveLength(2);
    expect(falso.ruidos).toHaveLength(0);
  });

  it('bom: 1 oscilador só, sem brilho extra', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'pouso', qualidade: 'bom', queda: 1 });
    expect(falso.osciladores).toHaveLength(1);
    expect(falso.ruidos).toHaveLength(0);
  });

  it('torto: ruído grave caindo + 1 oscilador baixo (sem brilho)', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'pouso', qualidade: 'torto', queda: 1 });
    expect(falso.ruidos).toHaveLength(1);
    expect(falso.ruidos[0]?.tipo).toBe('lowpass');
    expect(falso.osciladores).toHaveLength(1);
  });

  it('os 3 são acusticamente diferentes entre si (frequência base distinta)', () => {
    const f0De = (qualidade: 'perfeito' | 'bom' | 'torto'): number => {
      const { falso, som } = montar();
      som.aoEvento({ tipo: 'pouso', qualidade, queda: 1 });
      return falso.osciladores[0]?.f0 as number;
    };
    const valores = new Set([f0De('perfeito'), f0De('bom'), f0De('torto')]);
    expect(valores.size).toBe(3);
  });
});

it('tombo: ruído grave caindo + 1 tom grave com filtro', () => {
  const { falso, som } = montar();
  som.aoEvento({ tipo: 'tombo', causa: 'angulo' });
  expect(falso.ruidos).toHaveLength(1);
  expect(falso.osciladores).toHaveLength(1);
  expect(falso.filtros.length).toBeGreaterThan(0);
});

describe('coleta: floco e dourado têm timbres distintos', () => {
  it('floco: 1 "ping" curto e neutro', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'coleta', item: 'floco' });
    expect(falso.osciladores).toHaveLength(1);
  });

  it('dourado: 2 osciladores (mais rico, mais raro)', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'coleta', item: 'dourado' });
    expect(falso.osciladores).toHaveLength(2);
  });

  it('id desconhecido cai no timbre do floco (nunca fica mudo)', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'coleta', item: 'id-futuro' });
    expect(falso.osciladores).toHaveLength(1);
  });
});

it('atingido: baque de ruído + tom caindo, igual pra qualquer item', () => {
  const { falso, som } = montar();
  som.aoEvento({ tipo: 'atingido', item: 'bola' });
  expect(falso.ruidos).toHaveLength(1);
  expect(falso.osciladores).toHaveLength(1);
});

it('chegada: fanfarra de 4 notas', () => {
  const { falso, som } = montar();
  som.aoEvento({ tipo: 'chegada', pontos: 100, ticks: 600 });
  expect(falso.osciladores).toHaveLength(4);
});

describe('eventos que esta camada não conhece são ignorados', () => {
  it('manobra, combo-fechado, combo-perdido, trilho, boneco, checkpoint: nenhum som (são de outra camada)', () => {
    const { falso, som } = montar();
    const eventos: EventoDescida[] = [
      { tipo: 'manobra', id: 'ar', pontos: 10 },
      { tipo: 'combo-fechado', soma: 10, mult: 2, total: 20 },
      { tipo: 'combo-perdido', soma: 10 },
      { tipo: 'trilho', etapa: 'inicio' },
      { tipo: 'boneco', x: 1 },
      { tipo: 'checkpoint', indice: 1 },
    ];
    for (const ev of eventos) som.aoEvento(ev);
    expect(falso.osciladores).toHaveLength(0);
    expect(falso.ruidos).toHaveLength(0);
  });
});

describe('volume e contexto', () => {
  it('cfg.som = 0: nenhum som é criado', () => {
    const { falso, som, volume } = montar();
    volume.v = 0;
    som.aoEvento({ tipo: 'pulo', forca: 9 });
    som.aoEvento({ tipo: 'pouso', qualidade: 'perfeito', queda: 1 });
    som.aoEvento({ tipo: 'chegada', pontos: 1, ticks: 1 });
    expect(falso.osciladores).toHaveLength(0);
    expect(falso.ruidos).toHaveLength(0);
  });

  it('antes do 1º gesto (ctx ainda null): não lança e não cria nada', () => {
    const falso = criarContextoSinteseFalso();
    const audio = new AudioDestravavel(() => falso.ctx); // sem init(): ctx fica null
    const som = criarSomDescida(audio, criarRng(1), { obterVolumeSom: () => 1 });
    expect(() => som.aoEvento({ tipo: 'pulo', forca: 9 })).not.toThrow();
    expect(falso.osciladores).toHaveLength(0);
  });

  it('o buffer de ruído é criado 1 vez só, mesmo com vários eventos de ruído', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'pulo', forca: 9 });
    som.aoEvento({ tipo: 'pouso', qualidade: 'torto', queda: 1 });
    som.aoEvento({ tipo: 'tombo', causa: 'angulo' });
    som.aoEvento({ tipo: 'atingido', item: 'poca' });
    expect(falso.buffersCriados).toBe(1);
  });
});

it('atualizar(leitura): dispara aoEvento para cada evento do tick, na ordem', () => {
  const { falso, som } = montar();
  som.atualizar({
    eventos: [
      { tipo: 'pulo', forca: 9 },
      { tipo: 'coleta', item: 'floco' },
    ],
  });
  expect(falso.ruidos).toHaveLength(1); // pulo
  expect(falso.osciladores).toHaveLength(1); // coleta (floco)
});

describe('determinismo (canal `audio` do RNG, nunca Math.random)', () => {
  it('mesma semente => exatamente as mesmas frequências tocadas, em duas instâncias independentes', () => {
    const rodar = (): (number | null)[] => {
      const { falso, som } = montar(1, 777);
      som.aoEvento({ tipo: 'pulo', forca: 9 });
      som.aoEvento({ tipo: 'pouso', qualidade: 'bom', queda: 1 });
      return falso.ruidos.map((r) => r.f0).concat(falso.osciladores.map((o) => o.f0));
    };
    expect(rodar()).toEqual(rodar());
  });
});
