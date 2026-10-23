/**
 * Integração do M0 (Vega): as três costuras entre as frentes.
 *  1. platform/constantes re-exporta core/constantes (uma fonte só) e o laço da platform conta os ticks pelo laço do core (fonte única; pós-QA);
 *  2. o catálogo provisório de ids do save (data/regras-save) é aceito pelo meta/storage e respeita a FORMA_ID;
 *  3. o AudioDestravavel (audio/) só cria o contexto no gesto e se liga ao desbloquearAudio da platform.
 */
import { describe, expect, it } from 'vitest';
import { AudioDestravavel, type ContextoDeAudio } from '../../src/audio';
import * as Core from '../../src/core/constantes';
import { criarLaco as criarLacoDoCore } from '../../src/core/laco';
import { criarRng } from '../../src/core/rng';
import {
  OBJETIVOS_PROVISORIOS,
  PERSONAGENS_INICIAIS,
  PERSONAGENS_PROVISORIOS,
  PISTAS_INICIAIS,
  PISTAS_PROVISORIAS,
  REGRAS_SAVE,
  VERSAO_PROVISORIA_DA_PISTA,
  exigirRegrasSaveValidas,
  problemasDasRegrasSave,
  type RegrasDoCatalogo,
} from '../../src/data';
import { ArmazenamentoResiliente, carregarSave, salvarSave, sanearSave, type RegrasSave } from '../../src/meta';
import { desbloquearAudio } from '../../src/platform/audio-desbloqueio';
import * as Plataforma from '../../src/platform/constantes';
import { criarLaco as criarLacoDaPlataforma } from '../../src/platform/laco';
import { StorageFalso } from '../support/storage-falso';

describe('platform/constantes é o re-export de core/constantes', () => {
  it('os 7 nomes existem e são os mesmos valores do core', () => {
    const nomes = ['LARGURA', 'ALTURA', 'RS', 'LARGURA_BUFFER', 'ALTURA_BUFFER', 'PASSO_MS', 'ACUMULADOR_MAXIMO_MS'] as const;
    expect(Object.keys(Plataforma).sort()).toEqual([...nomes].sort());
    for (const n of nomes) expect(Plataforma[n], n).toBe(Core[n]);
  });
});

/** Relógio sintético: devolve os ticks acumulados depois de cada quadro, nos dois laços, com os mesmos carimbos. */
function ticksDosDoisLacos(carimbos: readonly number[]): { plataforma: number[]; core: number[] } {
  let proximo: ((t: number) => void) | null = null;
  const plataforma = criarLacoDaPlataforma({
    atualizar: () => {},
    desenhar: () => {},
    agendar: (cb) => {
      proximo = cb;
      return 1;
    },
    cancelar: () => {},
  });
  plataforma.iniciar();
  const core = criarLacoDoCore();
  const a: number[] = [];
  const b: number[] = [];
  for (const c of carimbos) {
    const cb = proximo as ((t: number) => void) | null;
    proximo = null;
    cb?.(c);
    core.quadro(c, () => {});
    a.push(plataforma.ticks);
    b.push(core.ticks());
  }
  return { plataforma: a, core: b };
}

describe('laço da platform x laço do core com relógio sintético', () => {
  const regular = (hz: number, segundos: number, inicio = 1000): number[] => Array.from({ length: hz * segundos + 1 }, (_, i) => inicio + (i * 1000) / hz);

  for (const hz of [30, 60, 75, 120, 144]) {
    it(`${hz} Hz por 10 s: os dois dão 600 ticks, idênticos quadro a quadro`, () => {
      const r = ticksDosDoisLacos(regular(hz, 10));
      expect(r.plataforma).toEqual(r.core);
      expect(Math.abs((r.plataforma.at(-1) ?? 0) - 600)).toBeLessThanOrEqual(1);
      expect(Math.abs((r.core.at(-1) ?? 0) - 600)).toBeLessThanOrEqual(1);
    });
  }

  // Regressão do QA da Íris (pós-M0): antes a platform tinha conta própria (limitava o delta, sem folga numérica) e divergia do core.
  it('60 Hz exatos por 3600 quadros: UM tick por quadro (nada de quadro com 0 e quadro com 2), 3600 no total, nos dois', () => {
    const r = ticksDosDoisLacos(regular(60, 60));
    expect(r.plataforma).toHaveLength(3601);
    const porQuadro = r.plataforma.map((t, i) => t - (r.plataforma[i - 1] ?? 0));
    expect(porQuadro.slice(1).every((n) => n === 1)).toBe(true);
    expect(r.plataforma.at(-1)).toBe(3600);
    expect(r.core).toEqual(r.plataforma);
  });

  it('600 quadros fixos de 95 ms: 3300 ticks nos dois (antes: 3419 na platform contra 3300 no core)', () => {
    const carimbos = Array.from({ length: 601 }, (_, i) => i * 95);
    const r = ticksDosDoisLacos(carimbos);
    expect(r.plataforma).toEqual(r.core);
    expect(r.plataforma.at(-1)).toBe(3300); // o valor do core: a platform agora conta igual
    expect(Math.max(...r.core.map((t, i) => t - (r.core[i - 1] ?? 0)))).toBeLessThanOrEqual(6); // teto de 6 ticks por quadro
  });

  it('jitter 95, 1, 95, 1 ms: mesma sequência nos dois (antes: divergência de 130 ticks)', () => {
    const carimbos: number[] = [0];
    for (let i = 0; i < 3600; i++) carimbos.push((carimbos.at(-1) ?? 0) + (i % 2 === 0 ? 95 : 1));
    const r = ticksDosDoisLacos(carimbos);
    expect(r.plataforma).toEqual(r.core);
  });

  it('jitter de 4 a 45 ms (semente fixa, longe do teto): mesma sequência de ticks, quadro a quadro', () => {
    const rng = criarRng(20261022);
    const carimbos: number[] = [0];
    for (let i = 0; i < 4000; i++) carimbos.push((carimbos.at(-1) ?? 0) + 4 + rng.proximo() * 41);
    const r = ticksDosDoisLacos(carimbos);
    expect(r.plataforma).toEqual(r.core);
  });

  it('aba parada (salto de 10 s): ambos limitam ao teto de 100 ms (5 a 6 ticks)', () => {
    const r = ticksDosDoisLacos([0, 16.7, 10_000]);
    const saltoPlataforma = (r.plataforma[2] ?? 0) - (r.plataforma[1] ?? 0);
    const saltoCore = (r.core[2] ?? 0) - (r.core[1] ?? 0);
    expect(saltoPlataforma).toBeGreaterThanOrEqual(5);
    expect(saltoPlataforma).toBeLessThanOrEqual(6);
    expect(saltoCore).toBeGreaterThanOrEqual(5);
    expect(saltoCore).toBeLessThanOrEqual(6);
  });

  it('determinismo: o mesmo relógio sintético dá a mesma sequência de ticks nas duas execuções', () => {
    const rng = criarRng(7);
    const carimbos: number[] = [0];
    for (let i = 0; i < 1500; i++) carimbos.push((carimbos.at(-1) ?? 0) + 2 + rng.proximo() * 60);
    const um = ticksDosDoisLacos(carimbos);
    const dois = ticksDosDoisLacos(carimbos);
    expect(dois.plataforma).toEqual(um.plataforma);
    expect(dois.core).toEqual(um.core);
  });
});

describe('data/regras-save (catálogo provisório de ids)', () => {
  it('traz os ids pedidos: 6 personagens, 5 pistas, 3 objetivos por pista, inicial capi e morro-do-pinhao', () => {
    expect([...PERSONAGENS_PROVISORIOS]).toEqual(['capi', 'bandeira', 'cidinha', 'beto', 'queque', 'bia']);
    expect([...PISTAS_PROVISORIAS]).toEqual(['morro-do-pinhao', 'pico-do-picole', 'vila-chocolate', 'vulcao-pe-gelado', 'cume-da-ventania']);
    expect(OBJETIVOS_PROVISORIOS).toHaveLength(15);
    expect([...PERSONAGENS_INICIAIS]).toEqual(['capi']);
    expect([...PISTAS_INICIAIS]).toEqual(['morro-do-pinhao']);
  });

  it('todo id obedece a FORMA_ID e não repete; o catálogo passa na validação do boot', () => {
    const todos = [...REGRAS_SAVE.personagens, ...REGRAS_SAVE.pistas, ...REGRAS_SAVE.objetivos];
    for (const id of todos) expect(Core.FORMA_ID.test(id), id).toBe(true);
    expect(new Set(todos).size).toBe(todos.length);
    expect(problemasDasRegrasSave(REGRAS_SAVE)).toEqual([]);
    expect(() => exigirRegrasSaveValidas()).not.toThrow();
  });

  it('é atribuível ao RegrasSave do meta/ (a forma estrutural não se afastou do contrato do Cronos)', () => {
    const comoMeta: RegrasSave = REGRAS_SAVE;
    expect(comoMeta.versaoPista?.['morro-do-pinhao']).toBe(VERSAO_PROVISORIA_DA_PISTA);
  });

  it('a validação REPROVA catálogo ruim (id fora da forma, repetido, inicial inexistente, pista sem versão)', () => {
    const base: RegrasDoCatalogo = REGRAS_SAVE;
    expect(problemasDasRegrasSave({ ...base, personagens: [...base.personagens, 'Maiuscula'] }).join()).toContain('fora da forma');
    expect(problemasDasRegrasSave({ ...base, pistas: [...base.pistas, 'morro-do-pinhao'] }).join()).toContain('repetido');
    expect(problemasDasRegrasSave({ ...base, iniciais: ['ninguem'] }).join()).toContain('não está em personagens');
    expect(problemasDasRegrasSave({ ...base, pistasIniciais: [] }).join()).toContain('ao menos uma pista');
    expect(problemasDasRegrasSave({ ...base, versaoPista: {} }).join()).toContain('falta a versão');
    expect(() => exigirRegrasSaveValidas({ ...base, iniciais: [] })).toThrow(/regras do save inválidas/);
  });

  it('carregarSave com as regras reais: disco vazio = novo, sem aviso, e NADA é gravado', () => {
    const falso = new StorageFalso();
    const r = carregarSave(new ArmazenamentoResiliente(() => falso), REGRAS_SAVE);
    expect(r.estado).toBe('novo');
    expect(r.avisar).toBe(false);
    expect(falso.escritas).toEqual([]);
  });

  it('sem armazenamento (modo privado): estado indisponível e avisar = true (o main mostra "Progresso não salvo neste aparelho")', () => {
    const r = carregarSave(null, REGRAS_SAVE);
    expect(r.estado).toBe('indisponivel');
    expect(r.avisar).toBe(true);
  });

  it('ids reais não caem em desconhecidos; id de um build futuro com a forma certa cai (e não se perde)', () => {
    const bruto = {
      v: 1,
      prog: { desbloqueados: ['bandeira', 'capi', 'novo-bicho'], pistas: ['pico-do-picole', 'morro-do-pinhao'], objetivos: ['pico-do-picole-o2'] },
    };
    const s = sanearSave(bruto, REGRAS_SAVE);
    expect(s.prog.desbloqueados).toEqual(['bandeira']); // 'capi' é inicial: implícito, nunca gravado
    expect(s.prog.pistas).toEqual(['pico-do-picole']);
    expect(s.prog.objetivos).toEqual(['pico-do-picole-o2']);
    expect(s.prog.desconhecidos).toEqual(['novo-bicho']);
  });

  it('ida e volta com o catálogo real (salvar e carregar dá o mesmo save)', () => {
    const falso = new StorageFalso();
    const arm = new ArmazenamentoResiliente(() => falso);
    const inicial = carregarSave(arm, REGRAS_SAVE).dados;
    const dados = { ...inicial, prog: { ...inicial.prog, flocos: 12, desbloqueados: ['bia'] } };
    expect(salvarSave(arm, dados, REGRAS_SAVE)).toBe('gravado');
    const volta = carregarSave(new ArmazenamentoResiliente(() => falso), REGRAS_SAVE);
    expect(volta.estado).toBe('ok');
    expect(volta.dados.prog.flocos).toBe(12);
    expect(volta.dados.prog.desbloqueados).toEqual(['bia']);
  });
});

function contextoFalso(estadoInicial: string) {
  const c = {
    state: estadoInicial,
    chamadasDeResume: 0,
    rejeitar: false,
    resume(): Promise<void> {
      c.chamadasDeResume += 1;
      if (c.rejeitar) return Promise.reject(new Error('NotAllowedError'));
      c.state = 'running';
      return Promise.resolve();
    },
  };
  return c;
}

describe('audio/AudioDestravavel', () => {
  it('não cria o contexto no construtor: só no init (depois do gesto)', () => {
    let criados = 0;
    const audio = new AudioDestravavel(() => {
      criados += 1;
      return contextoFalso('suspended');
    });
    expect(audio.ctx).toBeNull();
    expect(criados).toBe(0);
    audio.init();
    audio.init();
    audio.init();
    expect(criados).toBe(1);
    expect(audio.ctx).not.toBeNull();
  });

  it('aparelho sem Web Audio: init deixa ctx nulo e resume não faz nada nem lança', () => {
    const audio = new AudioDestravavel(() => null);
    audio.init();
    expect(audio.ctx).toBeNull();
    expect(() => audio.resume()).not.toThrow();
  });

  it('resume religa suspended e interrupted (iOS), e não toca em running nem closed', () => {
    for (const [estado, deveLigar] of [['suspended', true], ['interrupted', true], ['running', false], ['closed', false]] as const) {
      const c = contextoFalso(estado);
      const audio = new AudioDestravavel(() => c);
      audio.init();
      audio.resume();
      expect(c.chamadasDeResume, estado).toBe(deveLigar ? 1 : 0);
    }
  });

  it('resume recusado pelo navegador não vira promessa rejeitada solta (o main mostraria na caixa de erro)', async () => {
    const c = contextoFalso('suspended');
    c.rejeitar = true;
    const soltas: unknown[] = [];
    const ouvir = (e: unknown): void => void soltas.push(e);
    process.on('unhandledRejection', ouvir);
    const audio = new AudioDestravavel(() => c);
    audio.init();
    audio.resume();
    await new Promise((r) => setTimeout(r, 20));
    process.off('unhandledRejection', ouvir);
    expect(c.chamadasDeResume).toBe(1);
    expect(soltas).toEqual([]);
  });

  it('liga ao desbloquearAudio: um gesto cria o contexto e o religa; sem gesto nada acontece; o toque nasce só depois do gesto', () => {
    const ouvintes = new Map<string, Array<() => void>>();
    const alvo = {
      addEventListener: (t: string, f: () => void): void => void (ouvintes.get(t) ?? ouvintes.set(t, []).get(t))?.push(f),
      removeEventListener: (): void => {},
    };
    const c = contextoFalso('suspended');
    const audio = new AudioDestravavel(() => c);
    const desfazer = desbloquearAudio(alvo, audio);
    expect(audio.ctx).toBeNull();
    expect(ouvintes.has('touchstart')).toBe(false);
    for (const f of ouvintes.get('touchend') ?? []) f();
    expect(audio.ctx).toBe(c);
    expect(c.chamadasDeResume).toBe(1);
    expect(c.state).toBe('running');
    for (const f of ouvintes.get('click') ?? []) f(); // já running: só confere
    expect(c.chamadasDeResume).toBe(1);
    c.state = 'interrupted'; // ligação no iPhone
    for (const f of ouvintes.get('pointerup') ?? []) f();
    expect(c.chamadasDeResume).toBe(2);
    desfazer();
  });

  it('o tipo é aceito pela interface do desbloqueio sem conversão', () => {
    const ctxFalso: ContextoDeAudio = contextoFalso('suspended');
    expect(ctxFalso.state).toBe('suspended');
  });
});
