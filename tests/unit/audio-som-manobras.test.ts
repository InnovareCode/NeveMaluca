/**
 * `criarSomManobras` (src/audio/som-manobras.ts): um som por manobra (ar/mortal/grab/trilho), a "escada" do
 * combo-fechado (uma nota por nível de `mult`) e o som de combo-perdido — sem tocar em `descida/`, só reagindo a
 * `EventoDescida` (contrato C3).
 */
import { describe, expect, it } from 'vitest';
import type { EventoDescida } from '../../src/core/contratos';
import { criarRng } from '../../src/core/rng';
import { AudioDestravavel } from '../../src/audio/audio-destravavel';
import { criarSomManobras } from '../../src/audio/som-manobras';
import { criarContextoSinteseFalso, type ContextoSinteseFalso } from '../support/audio-falso';

/** Monta `AudioDestravavel` já destravado (`init()`), ligado ao contexto falso, e o sistema de som por cima. */
function montar(volumeInicial = 1, semente = 1): { falso: ContextoSinteseFalso; audio: AudioDestravavel; som: ReturnType<typeof criarSomManobras>; volume: { v: number } } {
  const falso = criarContextoSinteseFalso();
  const audio = new AudioDestravavel(() => falso.ctx);
  audio.init();
  const volume = { v: volumeInicial };
  const som = criarSomManobras(audio, criarRng(semente), { obterVolumeSom: () => volume.v });
  return { falso, audio, som, volume };
}

describe('manobra: um timbre distinto por id, dentro de ±3% da frequência base', () => {
  it('ar: 1 oscilador senoidal subindo a 520 -> 900 Hz', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'manobra', id: 'ar', pontos: 10 });
    expect(falso.osciladores).toHaveLength(1);
    expect(falso.osciladores[0]?.forma).toBe('sine');
    expect(falso.osciladores[0]?.f0 as number).toBeGreaterThan(500);
    expect(falso.osciladores[0]?.f0 as number).toBeLessThan(540);
    expect(falso.osciladores[0]?.f1).toBe(900);
  });

  it('mortal: 2 osciladores (o golpe e o brilho)', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'manobra', id: 'mortal', pontos: 20 });
    expect(falso.osciladores).toHaveLength(2);
    expect(falso.osciladores[0]?.forma).toBe('square');
    expect(falso.osciladores[1]?.forma).toBe('sine');
  });

  it('grab: 1 ruído metálico + 1 oscilador triangular', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'manobra', id: 'grab', pontos: 15 });
    expect(falso.ruidos).toHaveLength(1);
    expect(falso.ruidos[0]?.tipo).toBe('bandpass');
    expect(falso.osciladores).toHaveLength(1);
    expect(falso.osciladores[0]?.forma).toBe('triangle');
  });

  it('trilho: só o ruído de grind, sem oscilador', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'manobra', id: 'trilho', pontos: 5 });
    expect(falso.ruidos).toHaveLength(1);
    expect(falso.osciladores).toHaveLength(0);
  });

  it('id desconhecido (manobra futura): toca um "ding" neutro em vez de ficar mudo', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'manobra', id: 'manobra-que-ainda-nao-existe', pontos: 1 });
    expect(falso.osciladores).toHaveLength(1);
  });
});

describe('combo-fechado: a escada sobe uma nota por nível de mult', () => {
  it('mult = 3: 3 degraus + 1 acento no topo = 4 osciladores, subindo', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'combo-fechado', soma: 100, mult: 3, total: 300 });
    expect(falso.osciladores).toHaveLength(4);
    const [d1, d2, d3] = falso.osciladores.map((o) => o.f0 as number);
    expect(d1).toBeLessThan(d2 as number);
    expect(d2).toBeLessThan(d3 as number);
  });

  it('mult <= 0 ainda toca pelo menos 1 degrau (nunca fica mudo)', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'combo-fechado', soma: 10, mult: 0, total: 10 });
    expect(falso.osciladores).toHaveLength(2); // 1 degrau + 1 acento
  });

  it('mult muito alto é limitado ao tamanho da escala (nunca lança)', () => {
    const { falso, som } = montar();
    expect(() => som.aoEvento({ tipo: 'combo-fechado', soma: 10, mult: 50, total: 10 })).not.toThrow();
    expect(falso.osciladores.length).toBeGreaterThan(0);
  });
});

it('combo-perdido: um tom descendo + um baque de ruído', () => {
  const { falso, som } = montar();
  som.aoEvento({ tipo: 'combo-perdido', soma: 40 });
  expect(falso.osciladores).toHaveLength(1);
  expect(falso.osciladores[0]?.forma).toBe('sawtooth');
  expect(falso.ruidos).toHaveLength(1);
});

describe('volume e contexto', () => {
  it('cfg.som = 0: nenhum som é criado (nem o contexto é tocado)', () => {
    const { falso, som, volume } = montar();
    volume.v = 0;
    som.aoEvento({ tipo: 'manobra', id: 'ar', pontos: 10 });
    som.aoEvento({ tipo: 'combo-fechado', soma: 10, mult: 5, total: 50 });
    som.aoEvento({ tipo: 'combo-perdido', soma: 10 });
    expect(falso.osciladores).toHaveLength(0);
    expect(falso.ruidos).toHaveLength(0);
  });

  it('cfg.som muda ao vivo entre dois eventos (sem precisar recriar o sistema)', () => {
    const { falso, som, volume } = montar();
    volume.v = 0;
    som.aoEvento({ tipo: 'manobra', id: 'ar', pontos: 10 });
    expect(falso.osciladores).toHaveLength(0);
    volume.v = 0.6;
    som.aoEvento({ tipo: 'manobra', id: 'ar', pontos: 10 });
    expect(falso.osciladores).toHaveLength(1);
  });

  it('antes do 1º gesto (ctx ainda null): não lança e não cria nada', () => {
    const falso = criarContextoSinteseFalso();
    const audio = new AudioDestravavel(() => falso.ctx); // sem init(): ctx fica null
    const som = criarSomManobras(audio, criarRng(1), { obterVolumeSom: () => 1 });
    expect(() => som.aoEvento({ tipo: 'manobra', id: 'ar', pontos: 10 })).not.toThrow();
    expect(falso.osciladores).toHaveLength(0);
  });

  it('o buffer de ruído é criado 1 vez só, mesmo com várias manobras de ruído', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'manobra', id: 'grab', pontos: 1 });
    som.aoEvento({ tipo: 'manobra', id: 'trilho', pontos: 1 });
    som.aoEvento({ tipo: 'manobra', id: 'grab', pontos: 1 });
    som.aoEvento({ tipo: 'combo-perdido', soma: 1 });
    expect(falso.buffersCriados).toBe(1);
  });
});

describe('eventos que esta camada não conhece são ignorados (sem confundir o tipo "trilho")', () => {
  it('{tipo:"trilho", etapa} (início/fim do grind) NÃO é a manobra "trilho" — não toca nada', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'trilho', etapa: 'inicio' });
    som.aoEvento({ tipo: 'trilho', etapa: 'fim' });
    expect(falso.osciladores).toHaveLength(0);
    expect(falso.ruidos).toHaveLength(0);
  });

  it('pulo, pouso, tombo, coleta, boneco, checkpoint, chegada: nenhum som (ainda não é desta camada)', () => {
    const { falso, som } = montar();
    const eventos: EventoDescida[] = [
      { tipo: 'pulo', forca: 1 },
      { tipo: 'pouso', qualidade: 'bom', queda: 1 },
      { tipo: 'tombo', causa: 'angulo' },
      { tipo: 'coleta', item: 'moeda' },
      { tipo: 'boneco', x: 1 },
      { tipo: 'checkpoint', indice: 1 },
      { tipo: 'chegada', pontos: 1, ticks: 1 },
    ];
    for (const ev of eventos) som.aoEvento(ev);
    expect(falso.osciladores).toHaveLength(0);
    expect(falso.ruidos).toHaveLength(0);
  });
});

it('atualizar(leitura): dispara aoEvento para cada evento do tick, na ordem', () => {
  const { falso, som } = montar();
  som.atualizar({
    eventos: [
      { tipo: 'manobra', id: 'ar', pontos: 10 },
      { tipo: 'manobra', id: 'grab', pontos: 15 },
      { tipo: 'combo-fechado', soma: 25, mult: 2, total: 50 },
    ],
  });
  // ar (1 osc) + grab (1 ruído + 1 osc) + combo mult=2 (2 degraus + 1 acento = 3 osc) = 5 osciladores, 1 ruído
  expect(falso.osciladores).toHaveLength(5);
  expect(falso.ruidos).toHaveLength(1);
});

describe('determinismo (canal `audio` do RNG, nunca Math.random)', () => {
  it('mesma semente => exatamente as mesmas frequências tocadas, em duas instâncias independentes', () => {
    const rodar = (): (number | null)[] => {
      const { falso, som } = montar(1, 777);
      som.aoEvento({ tipo: 'manobra', id: 'ar', pontos: 10 });
      som.aoEvento({ tipo: 'manobra', id: 'mortal', pontos: 10 });
      som.aoEvento({ tipo: 'manobra', id: 'grab', pontos: 10 });
      return falso.osciladores.map((o) => o.f0);
    };
    expect(rodar()).toEqual(rodar());
  });

  it('sementes diferentes podem divergir na variação de tom', () => {
    const rodar = (semente: number): number | null => {
      const { falso, som } = montar(1, semente);
      som.aoEvento({ tipo: 'manobra', id: 'ar', pontos: 10 });
      return falso.osciladores[0]?.f0 ?? null;
    };
    // não é garantido matematicamente que NUNCA coincidam, mas com várias sementes ao menos uma diverge
    const valores = new Set([1, 2, 3, 4, 5].map(rodar));
    expect(valores.size).toBeGreaterThan(1);
  });
});
