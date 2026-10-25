/**
 * `criarTrilhaMusical` (`src/audio/musica-trilha.ts`): troca de faixa com crossfade, laço sem corte seco (2 vozes
 * encadeadas por `onended`), volume/mudo/duck pelo ganho mestre, carregamento sob demanda (nunca todas de uma vez)
 * e fallback silencioso quando o arquivo falha. Contexto/buscador FALSOS (sem Web Audio/`fetch` de verdade) —
 * mesma técnica de `tests/support/audio-falso.ts`, mas dedicado aqui porque precisa de `decodeAudioData`/
 * `onended`/`duration`, que `ContextoSintese` (notas curtas) não usa.
 */
import { describe, expect, it, vi } from 'vitest';
import type { AudioDestravavel } from '../../src/audio/audio-destravavel';
import { criarTrilhaMusical, type BufferMusica, type Buscador, type ContextoMusica, type FonteMusica } from '../../src/audio/musica-trilha';

function criarParametroFalso() {
  let valor = 0;
  return {
    get value(): number {
      return valor;
    },
    set value(v: number) {
      valor = v;
    },
    setValueAtTime(v: number): void {
      valor = v;
    },
    linearRampToValueAtTime(v: number): void {
      valor = v;
    },
    exponentialRampToValueAtTime(v: number): void {
      valor = v;
    },
  };
}

interface FonteRegistrada {
  fonte: FonteMusica;
  largadaEm: number | null;
  paradaEm: number | null;
}

/** Contexto falso: cada `createBufferSource().start(t)` registra `t` (e `stop(t)` também), pra afirmar o
 *  cronograma do loop sem precisar ouvir nada. `onended` é disparado manualmente pelo teste (`dispararFimDe`). */
function criarContextoMusicaFalso() {
  const fontesIniciadas: FonteRegistrada[] = [];
  const ganhosCriados: ReturnType<typeof criarParametroFalso>[] = [];
  let buffersDecodificados = 0;

  function criarGanho() {
    const gain = criarParametroFalso();
    ganhosCriados.push(gain);
    return { gain, connect: vi.fn() };
  }

  function criarFonte(): FonteMusica {
    const registro: FonteRegistrada = { fonte: null as unknown as FonteMusica, largadaEm: null, paradaEm: null };
    const fonte: FonteMusica = {
      buffer: null,
      onended: null,
      connect: vi.fn(),
      start(t: number) {
        registro.largadaEm = t;
        fontesIniciadas.push(registro);
      },
      stop(t: number) {
        registro.paradaEm = t;
      },
    };
    registro.fonte = fonte;
    return fonte;
  }

  const ctx: ContextoMusica = {
    currentTime: 0,
    sampleRate: 48000,
    destination: { connect: vi.fn() },
    createOscillator: () => {
      throw new Error('não usado pela trilha');
    },
    createGain: criarGanho,
    createBiquadFilter: () => {
      throw new Error('não usado pela trilha');
    },
    createBuffer: () => {
      throw new Error('não usado pela trilha');
    },
    createBufferSource: criarFonte,
    decodeAudioData: async (bytes: ArrayBuffer): Promise<BufferMusica> => {
      buffersDecodificados++;
      const duracao = new Float64Array(bytes)[0] ?? 180; // o teste "codifica" a duração no 1º float8 dos bytes falsos.
      return { duration: duracao, getChannelData: () => new Float32Array(0) };
    },
  };

  return { ctx, fontesIniciadas, ganhosCriados, get buffersDecodificados() { return buffersDecodificados; } };
}

/** "Bytes" de um arquivo falso que carregam a duração (segundos) no primeiro float64 — só pra `decodeAudioData`
 *  falso acima decidir a duração sem precisar de um `AudioBuffer` de verdade. */
function bytesComDuracao(duracaoS: number): ArrayBuffer {
  const buf = new ArrayBuffer(8);
  new Float64Array(buf)[0] = duracaoS;
  return buf;
}

function criarBuscadorFalso(opcoes: { ok?: boolean; falhaNoFetch?: boolean; duracaoS?: number } = {}) {
  const chamadas: string[] = [];
  const buscar: Buscador = async (url: string) => {
    chamadas.push(url);
    if (opcoes.falhaNoFetch) throw new Error('rede caiu');
    return {
      ok: opcoes.ok ?? true,
      status: opcoes.ok === false ? 404 : 200,
      arrayBuffer: async () => bytesComDuracao(opcoes.duracaoS ?? 180),
    };
  };
  return { buscar, chamadas };
}

function audioDestravavelFalso(ctx: ContextoMusica | null): AudioDestravavel {
  return { ctx: ctx as unknown as AudioDestravavel['ctx'] } as AudioDestravavel;
}

/** Deixa a cadeia de `await`s de `carregar`/`tentarIniciar` (buscar -> arrayBuffer -> decodeAudioData -> .then)
 *  terminar antes do teste inspecionar o resultado. */
async function assentar(n = 8): Promise<void> {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

describe('criarTrilhaMusical', () => {
  it('tocar: carrega sob demanda, cria o ganho mestre em 0 e a faixa chega a tocar (2 vozes iniciais encadeadas)', async () => {
    const { ctx, fontesIniciadas } = criarContextoMusicaFalso();
    const { buscar, chamadas } = criarBuscadorFalso({ duracaoS: 100 });
    const trilha = criarTrilhaMusical(audioDestravavelFalso(ctx), { obterVolumeMusica: () => 1 }, buscar);

    expect(trilha.estaTocando()).toBeNull();
    trilha.tocar('vanerao-morro');
    await assentar();

    expect(chamadas).toEqual(['/assets/musica/vanerao-morro.mp3']);
    expect(trilha.estaTocando()).toBe('vanerao-morro');
    // vozA (largada em 0) + vozB (largada em duracao - crossfade) = 2 fontes já iniciadas.
    expect(fontesIniciadas).toHaveLength(2);
    expect(fontesIniciadas[0]?.largadaEm).toBe(0);
    expect(fontesIniciadas[1]?.largadaEm).toBeCloseTo(100 - 1.6, 5);
  });

  it('o laço encadeia sem fim: disparar onended da voz N agenda a voz N+2, sempre respeitando o crossfade', async () => {
    const { ctx, fontesIniciadas } = criarContextoMusicaFalso();
    const { buscar } = criarBuscadorFalso({ duracaoS: 100 });
    const trilha = criarTrilhaMusical(audioDestravavelFalso(ctx), { obterVolumeMusica: () => 1 }, buscar);
    trilha.tocar('vanerao-morro');
    await assentar();

    for (let i = 0; i < 4; i++) {
      // `proxima()` sempre põe o `onended` na voz mais recente (vozB na 1ª vez, depois cada nova voz criada).
      const vozQueTermina = fontesIniciadas[fontesIniciadas.length - 1] as FonteRegistrada;
      vozQueTermina.fonte.onended?.();
    }
    // 2 iniciais + 1 nova por disparo (o encadeamento SEMPRE promove exatamente 1 voz nova por `onended`).
    expect(fontesIniciadas).toHaveLength(6);
    for (let i = 1; i < fontesIniciadas.length; i++) {
      const anterior = fontesIniciadas[i - 1] as FonteRegistrada;
      const atual = fontesIniciadas[i] as FonteRegistrada;
      expect((atual.largadaEm as number) - (anterior.largadaEm as number)).toBeCloseTo(100 - 1.6, 5);
    }
  });

  it('trocar de faixa: a sessão anterior some de `estaTocando`, e a nova assume depois de carregar', async () => {
    const { ctx } = criarContextoMusicaFalso();
    const { buscar } = criarBuscadorFalso({ duracaoS: 60 });
    const trilha = criarTrilhaMusical(audioDestravavelFalso(ctx), { obterVolumeMusica: () => 1 }, buscar);
    trilha.tocar('vanerao-morro');
    await assentar();
    expect(trilha.estaTocando()).toBe('vanerao-morro');

    trilha.tocar('pop-picole');
    await assentar();
    expect(trilha.estaTocando()).toBe('pop-picole');
  });

  it('chamar tocar com o MESMO id repetidas vezes não dispara um 2º carregamento/sessão', async () => {
    const { ctx, fontesIniciadas } = criarContextoMusicaFalso();
    const { buscar, chamadas } = criarBuscadorFalso({ duracaoS: 60 });
    const trilha = criarTrilhaMusical(audioDestravavelFalso(ctx), { obterVolumeMusica: () => 1 }, buscar);
    trilha.tocar('vanerao-morro');
    trilha.tocar('vanerao-morro');
    trilha.tocar('vanerao-morro');
    await assentar();
    expect(chamadas).toHaveLength(1);
    expect(fontesIniciadas).toHaveLength(2); // só as 2 vozes de UMA sessão, não 6.
  });

  it('precarregar: esquenta o cache sem tocar nada (0 fontes, mas o fetch já aconteceu)', async () => {
    const { ctx, fontesIniciadas } = criarContextoMusicaFalso();
    const { buscar, chamadas } = criarBuscadorFalso({ duracaoS: 60 });
    const trilha = criarTrilhaMusical(audioDestravavelFalso(ctx), { obterVolumeMusica: () => 1 }, buscar);
    trilha.precarregar('vila-chocolate');
    await assentar();
    expect(chamadas).toEqual(['/assets/musica/vila-chocolate.mp3']);
    expect(fontesIniciadas).toHaveLength(0);
    expect(trilha.estaTocando()).toBeNull();

    // o `tocar` seguinte reaproveita o cache (não busca de novo).
    trilha.tocar('vila-chocolate');
    await assentar();
    expect(chamadas).toHaveLength(1);
    expect(trilha.estaTocando()).toBe('vila-chocolate');
  });

  it('arquivo falha (404 ou decodeAudioData rejeita): fica em silêncio, nunca lança, `estaTocando` continua null', async () => {
    const { ctx } = criarContextoMusicaFalso();
    const { buscar } = criarBuscadorFalso({ ok: false });
    const trilha = criarTrilhaMusical(audioDestravavelFalso(ctx), { obterVolumeMusica: () => 1 }, buscar);
    expect(() => trilha.tocar('faixa-inexistente')).not.toThrow();
    await assentar();
    expect(trilha.estaTocando()).toBeNull();
  });

  it('rede cai (fetch rejeita a promessa): mesmo assim fica em silêncio, sem lançar', async () => {
    const { ctx } = criarContextoMusicaFalso();
    const { buscar } = criarBuscadorFalso({ falhaNoFetch: true });
    const trilha = criarTrilhaMusical(audioDestravavelFalso(ctx), { obterVolumeMusica: () => 1 }, buscar);
    trilha.tocar('vanerao-morro');
    await assentar();
    expect(trilha.estaTocando()).toBeNull();
  });

  it('atualizar: ganho mestre segue `obterVolumeMusica` (mudo = 0) e `ducar(true)` abaixa pelo MESMO fator', async () => {
    const { ctx, ganhosCriados } = criarContextoMusicaFalso();
    const { buscar } = criarBuscadorFalso({ duracaoS: 60 });
    let volume = 1;
    const trilha = criarTrilhaMusical(audioDestravavelFalso(ctx), { obterVolumeMusica: () => volume }, buscar);
    trilha.tocar('vanerao-morro');
    await assentar();
    // O ganho mestre é o 1º criado (nasce em `tentarIniciar`, antes do ganho da faixa/vozes).
    const ganhoMestre = ganhosCriados[0] as ReturnType<typeof criarParametroFalso>;

    trilha.atualizar();
    expect(ganhoMestre.value).toBe(1);

    volume = 0; // mudo
    trilha.atualizar();
    expect(ganhoMestre.value).toBe(0);

    volume = 0.8;
    trilha.atualizar();
    expect(ganhoMestre.value).toBeCloseTo(0.8, 5);

    trilha.ducar(true); // fanfarra/pódio: mesmo fator pra qualquer faixa, só multiplica o volume atual.
    trilha.atualizar();
    expect(ganhoMestre.value).toBeCloseTo(0.8 * 0.35, 5);

    trilha.ducar(false);
    trilha.atualizar();
    expect(ganhoMestre.value).toBeCloseTo(0.8, 5);
  });

  it('parar: esquece a faixa atual (`estaTocando` volta a null) e não lança mesmo sem nada tocando', async () => {
    const { ctx } = criarContextoMusicaFalso();
    const { buscar } = criarBuscadorFalso({ duracaoS: 60 });
    const trilha = criarTrilhaMusical(audioDestravavelFalso(ctx), { obterVolumeMusica: () => 1 }, buscar);
    expect(() => trilha.parar()).not.toThrow();
    trilha.tocar('vanerao-morro');
    await assentar();
    expect(trilha.estaTocando()).toBe('vanerao-morro');
    trilha.parar();
    expect(trilha.estaTocando()).toBeNull();
  });

  it('sem contexto (antes do 1º gesto): `tocar` não lança, e assim que o contexto aparece, `atualizar` completa o carregamento pendente', async () => {
    const trilhaSemCtx = criarTrilhaMusical(audioDestravavelFalso(null), { obterVolumeMusica: () => 1 }, criarBuscadorFalso({ duracaoS: 60 }).buscar);
    expect(() => trilhaSemCtx.tocar('vanerao-morro')).not.toThrow();
    expect(trilhaSemCtx.estaTocando()).toBeNull();

    const { ctx } = criarContextoMusicaFalso();
    const { buscar } = criarBuscadorFalso({ duracaoS: 60 });
    const audio = audioDestravavelFalso(null);
    const trilha = criarTrilhaMusical(audio, { obterVolumeMusica: () => 1 }, buscar);
    trilha.tocar('vanerao-morro'); // pedido ANTES do destrave: fica guardado em `idDesejado`, sem contexto ainda.
    expect(trilha.estaTocando()).toBeNull();
    (audio as { ctx: unknown }).ctx = ctx; // simula o 1º gesto criando o contexto.
    trilha.atualizar(); // mesmo laço que a cena chama a cada quadro: pega o pedido pendente.
    await assentar();
    expect(trilha.estaTocando()).toBe('vanerao-morro');
  });
});
