/**
 * `src/audio/musica-adaptativa.ts`: mapeamento estado -> intensidade/nível (função pura, sem Web Audio) e
 * `criarMusicaAdaptativa` (sequenciador por tick, sem timer — mesmo padrão de `audio-som-manobras.test.ts`).
 */
import { describe, expect, it } from 'vitest';
import type { ComboLeitura, FaseDescida, PilotoLeitura } from '../../src/core/contratos';
import { criarRng } from '../../src/core/rng';
import { AudioDestravavel } from '../../src/audio/audio-destravavel';
import { criarMusicaAdaptativa, intensidadeDeEstado, nivelDeIntensidade } from '../../src/audio/musica-adaptativa';
import { criarContextoSinteseFalso, type ContextoSinteseFalso } from '../support/audio-falso';

function piloto(parcial: Partial<PilotoLeitura>): PilotoLeitura {
  return {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    velocidade: 0,
    angulo: 0,
    anguloTerreno: 0,
    modo: 'chao',
    pose: 'chao',
    grab: null,
    voltas: 0,
    ticksNoAr: 0,
    ...parcial,
  };
}

function combo(parcial: Partial<ComboLeitura>): ComboLeitura {
  return { ativo: false, manobras: [], soma: 0, mult: 1, janela: 0, ...parcial };
}

function leitura(fase: FaseDescida, velocidade: number, mult: number) {
  return { fase, piloto: piloto({ velocidade }), combo: combo({ mult }) };
}

/** Monta `AudioDestravavel` já destravado, ligado ao contexto falso, e a música por cima. */
function montar(volumeInicial = 1, semente = 1): { falso: ContextoSinteseFalso; musica: ReturnType<typeof criarMusicaAdaptativa>; volume: { v: number } } {
  const falso = criarContextoSinteseFalso();
  const audio = new AudioDestravavel(() => falso.ctx);
  audio.init();
  const volume = { v: volumeInicial };
  const musica = criarMusicaAdaptativa(audio, criarRng(semente), { obterVolumeMusica: () => volume.v });
  return { falso, musica, volume };
}

describe('intensidadeDeEstado: função pura estado -> 0..1', () => {
  it('parado e sem combo é 0 (repouso)', () => {
    expect(intensidadeDeEstado(0, 1)).toBe(0);
  });

  it('cresce com a velocidade (combo fixo)', () => {
    expect(intensidadeDeEstado(10, 1)).toBeLessThan(intensidadeDeEstado(20, 1));
    expect(intensidadeDeEstado(20, 1)).toBeLessThan(intensidadeDeEstado(40, 1));
  });

  it('cresce com o multiplicador de combo (velocidade fixa)', () => {
    expect(intensidadeDeEstado(0, 1)).toBeLessThan(intensidadeDeEstado(0, 5));
    expect(intensidadeDeEstado(0, 5)).toBeLessThan(intensidadeDeEstado(0, 10));
  });

  it('nunca passa de 1, mesmo com valores fora da faixa esperada (velocidade/mult absurdos)', () => {
    expect(intensidadeDeEstado(1000, 1)).toBeLessThanOrEqual(1);
    expect(intensidadeDeEstado(0, 999)).toBeLessThanOrEqual(1);
    expect(intensidadeDeEstado(1000, 999)).toBe(1);
  });

  it('o combo pesa mais que a velocidade: mult máximo sozinho supera velocidade máxima sozinha', () => {
    expect(intensidadeDeEstado(0, 10)).toBeGreaterThan(intensidadeDeEstado(40, 1));
  });

  it('velocidade/mult negativos ou não finitos não quebram (clampam em 0)', () => {
    expect(intensidadeDeEstado(-5, 1)).toBe(0);
    expect(intensidadeDeEstado(NaN, 1)).toBe(0);
  });
});

describe('nivelDeIntensidade: limiares', () => {
  it('0 é repouso; perto de 1 é alta; valores crescentes nunca retrocedem de nível', () => {
    expect(nivelDeIntensidade(0)).toBe('repouso');
    expect(nivelDeIntensidade(0.1)).toBe('repouso');
    expect(nivelDeIntensidade(0.25)).toBe('leve');
    expect(nivelDeIntensidade(0.4)).toBe('leve');
    expect(nivelDeIntensidade(0.5)).toBe('media');
    expect(nivelDeIntensidade(0.6)).toBe('media');
    expect(nivelDeIntensidade(0.75)).toBe('alta');
    expect(nivelDeIntensidade(1)).toBe('alta');
  });
});

/** Tica `n` vezes com o mesmo estado (útil para passar da suavização e cruzar o limiar de ticks-por-passo). */
function ticar(musica: ReturnType<typeof criarMusicaAdaptativa>, n: number, fase: FaseDescida, velocidade: number, mult: number): void {
  for (let i = 0; i < n; i += 1) musica.atualizar(leitura(fase, velocidade, mult));
}

describe('criarMusicaAdaptativa: sequenciador por tick (sem timer)', () => {
  it('repouso (parado, sem combo): só o pulso de baixo (1 triangle), nenhuma harmonia/percussão', () => {
    const { falso, musica } = montar();
    // suaviza até 0 (já é 0) e cruza o limiar de ticks-por-passo do nível repouso (30 ticks)
    ticar(musica, 31, 'descendo', 0, 1);
    expect(falso.osciladores.length).toBeGreaterThanOrEqual(1);
    expect(falso.osciladores.every((o) => o.forma === 'triangle')).toBe(true);
    expect(falso.ruidos).toHaveLength(0);
    expect(musica.estadoAtual().nivel).toBe('repouso');
  });

  it('intensidade alta (velocidade máxima + combo no teto): depois de suavizar, toca as 4 camadas (inclui ruído)', () => {
    const { falso, musica } = montar();
    // ~100 ticks para a média móvel (taxa 0,05) convergir de 0 perto de 1, mais o passo do nível alto (12 ticks)
    ticar(musica, 100, 'descendo', 40, 10);
    expect(musica.estadoAtual().nivel).toBe('alta');
    expect(falso.osciladores.length).toBeGreaterThan(1);
    expect(falso.ruidos.length).toBeGreaterThan(0);
  });

  it('o andamento sobe com a intensidade: nível alto dispara o 1º passo em menos ticks que o repouso', () => {
    // já suavizado (ver teste acima): mede só o número de ticks ATÉ o 1º som de cada nível, com a intensidade já lá.
    const contarTicksAtéOPrimeiroSom = (velocidade: number, mult: number): number => {
      const { falso, musica } = montar();
      // leva a intensidade suavizada ao alvo primeiro, sem deixar nada tocar nem o contador de passo avançar
      // (fase 'chegou' não toca e zera o contador a cada tick — só a intensidade, calculada antes do filtro de
      // fase, continua convergindo durante o aquecimento).
      for (let i = 0; i < 100; i += 1) musica.atualizar({ fase: 'chegou', piloto: piloto({ velocidade }), combo: combo({ mult }) });
      let ticks = 0;
      while (falso.osciladores.length === 0 && falso.ruidos.length === 0) {
        musica.atualizar(leitura('descendo', velocidade, mult));
        ticks += 1;
        if (ticks > 60) throw new Error('não tocou nada em 60 ticks');
      }
      return ticks;
    };
    const ticksRepouso = contarTicksAtéOPrimeiroSom(0, 1);
    const ticksAlto = contarTicksAtéOPrimeiroSom(40, 10);
    expect(ticksAlto).toBeLessThan(ticksRepouso);
  });

  it('volta ao repouso quando a velocidade e o combo zeram de novo', () => {
    const { musica } = montar();
    ticar(musica, 100, 'descendo', 40, 10);
    expect(musica.estadoAtual().nivel).toBe('alta');
    ticar(musica, 200, 'descendo', 0, 1);
    expect(musica.estadoAtual().nivel).toBe('repouso');
  });

  it('cfg.musica = 0: nenhum som é criado (nem o contexto é tocado), mesmo com intensidade alta', () => {
    const { falso, musica, volume } = montar();
    volume.v = 0;
    ticar(musica, 100, 'descendo', 40, 10);
    expect(falso.osciladores).toHaveLength(0);
    expect(falso.ruidos).toHaveLength(0);
  });

  it('fase "chegou" (e "contagem"... não, "contagem" TOCA — só "chegou" não): fora da descida não toca', () => {
    const { falso, musica } = montar();
    ticar(musica, 50, 'chegou', 40, 10);
    expect(falso.osciladores).toHaveLength(0);
    expect(falso.ruidos).toHaveLength(0);
  });

  it('fase "contagem" já toca (a trilha começa antes do piloto se mover)', () => {
    const { falso, musica } = montar();
    ticar(musica, 31, 'contagem', 0, 1);
    expect(falso.osciladores.length).toBeGreaterThanOrEqual(1);
  });

  it('antes do 1º gesto (ctx ainda null): não lança e não cria nada', () => {
    const falso = criarContextoSinteseFalso();
    const audio = new AudioDestravavel(() => falso.ctx); // sem init(): ctx fica null
    const musica = criarMusicaAdaptativa(audio, criarRng(1), { obterVolumeMusica: () => 1 });
    expect(() => ticar(musica, 50, 'descendo', 40, 10)).not.toThrow();
    expect(falso.osciladores).toHaveLength(0);
  });

  it('parar de chamar atualizar() é suficiente para silenciar (sem nó persistente para desligar)', () => {
    const { falso, musica } = montar();
    ticar(musica, 31, 'descendo', 0, 1);
    const tocados = falso.osciladores.length;
    expect(tocados).toBeGreaterThan(0);
    // "destruir a cena" == parar de chamar atualizar(); nada mais deveria tocar.
    expect(falso.osciladores.length).toBe(tocados);
  });

  describe('determinismo (canal `audio` do RNG, nunca Math.random)', () => {
    it('mesma semente => exatamente as mesmas frequências tocadas em duas instâncias independentes', () => {
      const rodar = (): (number | null)[] => {
        const { falso, musica } = montar(1, 777);
        ticar(musica, 100, 'descendo', 40, 10);
        return falso.osciladores.map((o) => o.f0);
      };
      expect(rodar()).toEqual(rodar());
    });

    it('sementes diferentes podem divergir na variação de tom', () => {
      const f0Primeiro = (semente: number): number | null => {
        const { falso, musica } = montar(1, semente);
        ticar(musica, 31, 'descendo', 0, 1);
        return falso.osciladores[0]?.f0 ?? null;
      };
      const valores = new Set([1, 2, 3, 4, 5].map(f0Primeiro));
      expect(valores.size).toBeGreaterThan(1);
    });
  });
});
