/**
 * Testes do salvamento C4 `neve-maluca-v1` (src/meta/storage.ts). Rodam em Node, sem jsdom: o Storage entra por
 * parametro (tests/support/storage-falso.ts). Catalogo com ids FALSOS: o storage nao depende de data/.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ArmazenamentoResiliente,
  CHAVE_SAVE,
  CHAVE_SAVE_QUEBRADA,
  CONFIG_PADRAO,
  FORMA_ID,
  MAX_CHARS_REPLAY,
  MAX_DESCONHECIDOS,
  MAX_EXTRAS_CHARS_POR_CAMPO,
  MAX_EXTRAS_CHAVES,
  MAX_FANTASMAS,
  MAX_PISTAS_DESCONHECIDAS,
  MAX_RECORDES_POR_PISTA,
  MAX_TEXTO_SAVE,
  MIGRACOES,
  TETO_FLOCOS,
  TETO_PONTOS,
  TETO_TICKS,
  carregarSave,
  ehDataUtc,
  ehInstanteUtc,
  inserirRecorde,
  obterArmazenamentoDoNavegador,
  paraDisco,
  salvarSave,
  sanearCfg,
  sanearDiario,
  sanearExtras,
  sanearFantasmas,
  sanearPersonagemAtivo,
  sanearProg,
  sanearRecorde,
  sanearRecordes,
  sanearSave,
  saveVazio,
} from '../../../src/meta/storage';
import type { ArmazenamentoLike, Migracao, Recorde, RegrasSave, SaveV1 } from '../../../src/meta/tipos';
import { StorageFalso } from '../../support/storage-falso';

const REGRAS: RegrasSave = {
  personagens: ['kaka', 'pingu', 'yeti'],
  iniciais: ['kaka'],
  pistas: ['vale', 'cume', 'gelo'],
  pistasIniciais: ['vale'],
  objetivos: ['obj-a', 'obj-b', 'obj-c'],
  versaoPista: { vale: 'g1', cume: 'g1' },
};

const QUANDO = '2026-10-22T15:30:00.000Z';
const rec = (pontos: number, ticks = 3000, extra: Partial<Recorde> = {}): Recorde => ({
  pontos,
  ticks,
  personagem: 'kaka',
  versaoPista: 'g1',
  quando: QUANDO,
  ...extra,
});

/** Save valido e cheio, para os testes de ida e volta. */
function saveCheio(): SaveV1 {
  return {
    v: 1,
    cfg: { som: 0.5, musica: 0.25, movimentoReduzido: true, controles: 'botoes', maoEsquerda: true },
    prog: { desbloqueados: ['pingu'], pistas: ['cume'], flocos: 1234, objetivos: ['obj-a', 'obj-c'], desconhecidos: ['urso-polar'] },
    recordes: { vale: [rec(9000), rec(5000)], cume: [rec(100, 10)] },
    diario: { data: '2026-10-22', melhor: 777 },
  };
}

const salvo = (s: StorageFalso): unknown => JSON.parse(s.dados.get(CHAVE_SAVE) ?? 'null');

// ---------------------------------------------------------------------------
describe('cfg: preferencias de volume e controles', () => {
  it('ausente ou nao-objeto -> padrao', () => {
    for (const lixo of [undefined, null, 5, 'x', [], true]) expect(sanearCfg(lixo)).toEqual(CONFIG_PADRAO);
  });

  it('valores validos passam intactos', () => {
    const cfg = { som: 0.3, musica: 1, movimentoReduzido: true, controles: 'botoes', maoEsquerda: true };
    expect(sanearCfg(cfg)).toEqual(cfg);
  });

  it('volume fora de 0..1 e preso; NaN/Infinity/texto/null caem no padrao', () => {
    expect(sanearCfg({ som: 7, musica: -3 })).toMatchObject({ som: 1, musica: 0 });
    expect(sanearCfg({ som: Number.NaN, musica: Number.POSITIVE_INFINITY })).toMatchObject({ som: CONFIG_PADRAO.som, musica: CONFIG_PADRAO.musica });
    expect(sanearCfg({ som: Number.NEGATIVE_INFINITY })).toMatchObject({ som: CONFIG_PADRAO.som });
    expect(sanearCfg({ som: '0.5', musica: null })).toMatchObject({ som: CONFIG_PADRAO.som, musica: CONFIG_PADRAO.musica });
  });

  it('booleanos e modo de controle de tipo errado ou fora da lista -> padrao', () => {
    expect(sanearCfg({ movimentoReduzido: 'sim', maoEsquerda: 1, controles: 'teclado' })).toEqual(CONFIG_PADRAO);
    expect(sanearCfg({ controles: 5 })).toEqual(CONFIG_PADRAO);
    expect(sanearCfg({ controles: 'botoes' }).controles).toBe('botoes');
  });
});

// ---------------------------------------------------------------------------
describe('prog: desbloqueios, flocos, objetivos, desconhecidos', () => {
  it('ausente -> vazio; iniciais nunca sao guardados; duplicados somem', () => {
    expect(sanearProg(undefined, REGRAS)).toEqual({ desbloqueados: [], pistas: [], flocos: 0, objetivos: [], desconhecidos: [] });
    const p = sanearProg(
      { desbloqueados: ['kaka', 'pingu', 'pingu', 'yeti'], pistas: ['vale', 'cume', 'cume'], objetivos: ['obj-a', 'obj-a'] },
      REGRAS,
    );
    expect(p.desbloqueados).toEqual(['pingu', 'yeti']);
    expect(p.pistas).toEqual(['cume']);
    expect(p.objetivos).toEqual(['obj-a']);
  });

  it('id de OUTRO catalogo na lista errada e lixo (nao vira desbloqueio nem desconhecido)', () => {
    const p = sanearProg({ desbloqueados: ['cume', 'obj-a'], pistas: ['pingu'], objetivos: ['yeti'] }, REGRAS);
    expect(p).toEqual({ desbloqueados: [], pistas: [], flocos: 0, objetivos: [], desconhecidos: [] });
  });

  it('id desconhecido com forma de id e preservado; lixo e descartado', () => {
    const p = sanearProg(
      {
        desbloqueados: ['urso-polar', 'URSO', 'a', 'com espaco', '../../x', 42, null, {}, 'x'.repeat(40), '__proto__'],
        pistas: ['vulcao-gelado'],
        objetivos: ['obj-futuro'],
      },
      REGRAS,
    );
    expect(p.desconhecidos).toEqual(['urso-polar', 'vulcao-gelado', 'obj-futuro']);
    expect(p.desbloqueados).toEqual([]);
  });

  it('desconhecido que passa a existir e promovido a sua lista (personagem, pista, objetivo)', () => {
    const p = sanearProg({ desconhecidos: ['yeti', 'gelo', 'obj-b', 'kaka', 'vale', 'ainda-nao'] }, REGRAS);
    expect(p.desbloqueados).toEqual(['yeti']); // 'kaka' e inicial: some
    expect(p.pistas).toEqual(['gelo']); // 'vale' e inicial
    expect(p.objetivos).toEqual(['obj-b']);
    expect(p.desconhecidos).toEqual(['ainda-nao']);
  });

  it('teto de desconhecidos; os que ja estavam gravados tem prioridade sobre os novos', () => {
    const antigos = Array.from({ length: 30 }, (_, i) => `velho-${i}`);
    const novos = Array.from({ length: 30 }, (_, i) => `novo-${i}`);
    const p = sanearProg({ desbloqueados: novos, desconhecidos: antigos }, REGRAS);
    expect(p.desconhecidos).toHaveLength(MAX_DESCONHECIDOS);
    expect(p.desconhecidos.slice(0, 30)).toEqual(antigos);
  });

  it('flocos: inteiro 0..teto; fracao perde a fracao; NaN/Infinity/negativo/texto/acima do teto -> 0', () => {
    const f = (v: unknown): number => sanearProg({ flocos: v }, REGRAS).flocos;
    expect(f(42)).toBe(42);
    expect(f(2.9)).toBe(2);
    expect(f(TETO_FLOCOS)).toBe(TETO_FLOCOS);
    expect(f(TETO_FLOCOS + 1)).toBe(0);
    for (const lixo of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, -0.5, '10', null, {}, [], 1e308]) expect(f(lixo)).toBe(0);
  });

  it('listas gigantes: so os primeiros itens sao lidos (nao ha laco de 1e6 voltas)', () => {
    const gigante = Array.from({ length: 1_000_000 }, (_, i) => `id-${i}`);
    const t0 = Date.now();
    const p = sanearProg({ desbloqueados: gigante, desconhecidos: gigante }, REGRAS);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(p.desconhecidos.length).toBeLessThanOrEqual(MAX_DESCONHECIDOS);
  });

  it('nao muta a entrada e e idempotente', () => {
    const bruto = { desbloqueados: ['pingu', 'pingu', 'zzz-futuro'], flocos: 5.5, desconhecidos: ['yeti'] };
    const copia = JSON.parse(JSON.stringify(bruto)) as unknown;
    const uma = sanearProg(bruto, REGRAS);
    expect(bruto).toEqual(copia);
    expect(sanearProg(uma, REGRAS)).toEqual(uma);
  });

  it('um catalogo vazio manda tudo para desconhecidos (por isso o catalogo e obrigatorio, sem padrao)', () => {
    const vazio: RegrasSave = { personagens: [], iniciais: [], pistas: [], pistasIniciais: [], objetivos: [] };
    expect(sanearProg({ desbloqueados: ['pingu'] }, vazio).desconhecidos).toEqual(['pingu']);
  });
});

// ---------------------------------------------------------------------------
describe('recordes por pista', () => {
  it('sanearRecorde: valido passa; cada campo adulterado derruba o registro', () => {
    expect(sanearRecorde(rec(10), REGRAS)).toEqual(rec(10));
    const ruins: Array<Record<string, unknown>> = [
      { pontos: -1 },
      { pontos: Number.NaN },
      { pontos: Number.POSITIVE_INFINITY },
      { pontos: TETO_PONTOS + 1 },
      { pontos: '100' },
      { ticks: 0 },
      { ticks: Number.NaN },
      { ticks: TETO_TICKS + 1 },
      { ticks: -5 },
      { personagem: 42 },
      { personagem: 'Kaka Maluca' },
      { versaoPista: '' },
      { versaoPista: 'x'.repeat(33) },
      { versaoPista: 5 },
      { quando: 'ontem' },
      { quando: '2026-13-01T00:00:00Z' },
      { quando: '2026-02-30T00:00:00Z' },
      { quando: '2026-10-22T25:00:00Z' },
      { quando: 20261022 },
    ];
    for (const ruim of ruins) expect(sanearRecorde({ ...rec(10), ...ruim }, REGRAS), JSON.stringify(ruim)).toBeUndefined();
    for (const lixo of [null, undefined, 5, 'x', [], true]) expect(sanearRecorde(lixo, REGRAS)).toBeUndefined();
  });

  it('pontos fracionarios perdem a fracao', () => {
    expect(sanearRecorde({ ...rec(10), pontos: 10.9 }, REGRAS)?.pontos).toBe(10);
  });

  it('top 5 por pista, melhor primeiro; empate de pontos -> menos ticks; repetidos exatos somem', () => {
    const lista = [rec(10), rec(50), rec(30), rec(50, 2000), rec(40), rec(20), rec(60), rec(60)];
    const { recordes } = sanearRecordes({ vale: lista }, undefined, REGRAS);
    expect(recordes['vale']?.map((r) => [r.pontos, r.ticks])).toEqual([
      [60, 3000],
      [50, 2000],
      [50, 3000],
      [40, 3000],
      [30, 3000],
    ]);
    expect(recordes['vale']).toHaveLength(MAX_RECORDES_POR_PISTA);
  });

  it('itens invalidos no meio da lista sao descartados sem derrubar os validos; pista sem recorde some do mapa', () => {
    const { recordes } = sanearRecordes({ vale: [rec(5), { pontos: 'x' }, null, rec(7)], cume: [{ lixo: 1 }], gelo: 'nao-e-lista' }, undefined, REGRAS);
    expect(recordes['vale']?.map((r) => r.pontos)).toEqual([7, 5]);
    expect(Object.keys(recordes)).toEqual(['vale']);
  });

  it('versaoPista diferente da atual vai para recordesAntigos (nao compete, nao some); sem versao conhecida nada e julgado', () => {
    const velho = rec(99_999, 1000, { versaoPista: 'g0' });
    const { recordes, recordesAntigos } = sanearRecordes({ vale: [rec(10), velho], gelo: [rec(1, 5, { versaoPista: 'qualquer' })] }, undefined, REGRAS);
    expect(recordes['vale']).toEqual([rec(10)]);
    expect(recordesAntigos['vale']).toEqual([velho]);
    expect(recordes['gelo']).toHaveLength(1); // 'gelo' nao tem versao conhecida
    expect(recordesAntigos['gelo']).toBeUndefined();
  });

  it('recordesAntigos ja gravados sao mantidos, mesclados com os novos, com o mesmo teto', () => {
    const antigos = Array.from({ length: 4 }, (_, i) => rec(100 + i, 1000, { versaoPista: 'g0' }));
    const novo = rec(500, 1000, { versaoPista: 'g0' });
    const { recordesAntigos } = sanearRecordes({ vale: [novo] }, { vale: antigos.concat(antigos) }, REGRAS);
    expect(recordesAntigos['vale']).toHaveLength(MAX_RECORDES_POR_PISTA);
    expect(recordesAntigos['vale']?.[0]).toEqual(novo);
  });

  it('recordes de pista DESCONHECIDA (build futuro) sobrevivem, com teto de pistas; chave sem forma de id e descartada', () => {
    const mapa: Record<string, unknown> = { 'pista-futura': [rec(8)], 'PISTA RUIM': [rec(9)], x: [rec(9)] };
    for (let i = 0; i < 50; i++) mapa[`extra-${i}`] = [rec(1)];
    const { recordes } = sanearRecordes(mapa, undefined, REGRAS);
    expect(recordes['pista-futura']).toEqual([rec(8)]);
    expect(recordes['PISTA RUIM']).toBeUndefined();
    expect(recordes['x']).toBeUndefined();
    expect(Object.keys(recordes).length).toBeLessThanOrEqual(MAX_PISTAS_DESCONHECIDAS);
  });

  it('nao-objeto -> vazio; listas gigantes nao travam', () => {
    for (const lixo of [null, 5, 'x', [], undefined]) expect(sanearRecordes(lixo, lixo, REGRAS)).toEqual({ recordes: {}, recordesAntigos: {} });
    const gigante = Array.from({ length: 500_000 }, (_, i) => rec(i));
    const t0 = Date.now();
    expect(sanearRecordes({ vale: gigante }, undefined, REGRAS).recordes['vale']).toHaveLength(MAX_RECORDES_POR_PISTA);
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it('inserirRecorde: devolve posicao 0-based, nao muta, ignora invalido/pista inexistente, recorde fora do top 5 -> null', () => {
    let save = saveVazio();
    for (const p of [10, 20, 30, 40, 50]) save = inserirRecorde(save, 'vale', rec(p), REGRAS).save;
    const antes = JSON.stringify(save);
    const r1 = inserirRecorde(save, 'vale', rec(45), REGRAS);
    expect(r1.posicao).toBe(1);
    expect(r1.save.recordes['vale']?.map((r) => r.pontos)).toEqual([50, 45, 40, 30, 20]);
    expect(JSON.stringify(save)).toBe(antes);
    expect(inserirRecorde(save, 'vale', rec(5), REGRAS).posicao).toBeNull();
    expect(inserirRecorde(save, 'vale', rec(5, 3000, { quando: 'lixo' }), REGRAS).posicao).toBeNull();
    expect(inserirRecorde(save, 'pista-que-nao-existe', rec(999), REGRAS).posicao).toBeNull();
    expect(inserirRecorde(save, 'pista-que-nao-existe', rec(999), REGRAS).save.recordes['pista-que-nao-existe']).toBeUndefined();
    expect(inserirRecorde(save, 'vale', rec(999, 1000, { versaoPista: 'g0' }), REGRAS).posicao).toBeNull(); // versao antiga
    expect(inserirRecorde(save, 'vale', rec(999, 1000, { versaoPista: 'g0' }), REGRAS).save.recordesAntigos?.['vale']).toHaveLength(1);
    expect(inserirRecorde(save, 'vale', rec(999), REGRAS).posicao).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('datas puras (sem Date)', () => {
  it('ehDataUtc: calendario real, bissexto, formato estrito', () => {
    expect(ehDataUtc('2026-10-22')).toBe(true);
    expect(ehDataUtc('2028-02-29')).toBe(true);
    expect(ehDataUtc('2026-02-29')).toBe(false);
    expect(ehDataUtc('2100-02-29')).toBe(false);
    expect(ehDataUtc('2000-02-29')).toBe(true);
    for (const ruim of ['2026-00-10', '2026-13-10', '2026-04-31', '2026-10-00', '26-10-22', '2026/10/22', '1999-12-31', '2026-10-22T00:00:00Z', 20261022, null, undefined])
      expect(ehDataUtc(ruim), String(ruim)).toBe(false);
  });

  it('ehInstanteUtc: so ISO UTC com Z', () => {
    expect(ehInstanteUtc('2026-10-22T15:30:00Z')).toBe(true);
    expect(ehInstanteUtc('2026-10-22T15:30:00.5Z')).toBe(true);
    expect(ehInstanteUtc('2026-10-22T23:59:59.999Z')).toBe(true);
    for (const ruim of ['2026-10-22T24:00:00Z', '2026-10-22T15:60:00Z', '2026-10-22T15:30:60Z', '2026-10-22T15:30:00', '2026-10-22T15:30:00-03:00', '2026-10-22 15:30:00Z', '2026-10-22T15:30:00.Z', ''])
      expect(ehInstanteUtc(ruim), ruim).toBe(false);
  });
});

describe('diario, fantasmas e extras', () => {
  it('diario: data valida + melhor inteiro dentro do teto; qualquer defeito -> ausente', () => {
    expect(sanearDiario({ data: '2026-10-22', melhor: 10.7 })).toEqual({ data: '2026-10-22', melhor: 10 });
    for (const ruim of [{ data: '2026-02-30', melhor: 1 }, { data: '2026-10-22', melhor: -1 }, { data: '2026-10-22', melhor: TETO_PONTOS + 1 }, { data: '2026-10-22' }, { melhor: 1 }, null, 5, []])
      expect(sanearDiario(ruim)).toBeUndefined();
  });

  it('fantasmas: objeto JSON pequeno passa como copia; grande demais, nao-objeto e ciclico caem', () => {
    const ok = { v: 1, cmds: [1, 2, 3] };
    const f = sanearFantasmas({ vale: ok, cume: 'x', gelo: { grande: 'x'.repeat(MAX_CHARS_REPLAY) } }, REGRAS);
    expect(f).toEqual({ vale: ok });
    expect(f?.['vale']).not.toBe(ok);
    const ciclo: Record<string, unknown> = {};
    ciclo['eu'] = ciclo;
    expect(sanearFantasmas({ vale: ciclo }, REGRAS)).toBeUndefined();
    expect(sanearFantasmas({ vale: [1, 2] }, REGRAS)).toBeUndefined();
    expect(sanearFantasmas(null, REGRAS)).toBeUndefined();
  });

  it('fantasmas: gancho validarReplay (rejeita, ou lanca) so vale para pista conhecida; teto de quantidade', () => {
    const regras: RegrasSave = { ...REGRAS, validarReplay: (r) => (r as { v?: unknown }).v === 1 };
    expect(sanearFantasmas({ vale: { v: 1 }, cume: { v: 2 } }, regras)).toEqual({ vale: { v: 1 } });
    const lanca: RegrasSave = { ...REGRAS, validarReplay: () => { throw new Error('boom'); } };
    expect(sanearFantasmas({ vale: { v: 1 } }, lanca)).toBeUndefined();
    const muitos: Record<string, unknown> = { vale: { v: 1 }, cume: { v: 1 }, gelo: { v: 1 } };
    for (let i = 0; i < 20; i++) muitos[`futura-${i}`] = { v: 1 };
    const f = sanearFantasmas(muitos, REGRAS) ?? {};
    expect(Object.keys(f)).toHaveLength(MAX_FANTASMAS);
    expect(Object.keys(f).slice(0, 3)).toEqual(['vale', 'cume', 'gelo']); // conhecidas primeiro
  });

  it('fantasmas: __proto__ interno e removido', () => {
    const bruto = JSON.parse('{"vale":{"v":1,"__proto__":{"admin":true}}}') as unknown;
    const f = sanearFantasmas(bruto, REGRAS);
    expect(Object.keys(f?.['vale'] ?? {})).toEqual(['v']);
  });

  it('extras: campos de raiz desconhecidos sao preservados como copia; conhecidos e chaves ruins ficam de fora', () => {
    const extras = sanearExtras({ v: 1, cfg: {}, tema: 'neon', placar: { a: [1, 2] }, __proto__x: 1, 'Chave Ruim': 1, '9abc': 1 });
    expect(extras).toEqual({ tema: 'neon', placar: { a: [1, 2] } });
    expect(sanearExtras({ v: 1 })).toBeUndefined();
  });

  it('extras: teto de chaves e de tamanho por campo; __proto__ aninhado removido', () => {
    const muitos: Record<string, unknown> = {};
    for (let i = 0; i < 40; i++) muitos[`campo${String.fromCharCode(97 + (i % 26))}${i}`] = i;
    expect(Object.keys(sanearExtras(muitos) ?? {})).toHaveLength(MAX_EXTRAS_CHAVES);
    expect(sanearExtras({ grande: 'x'.repeat(MAX_EXTRAS_CHARS_POR_CAMPO) })).toBeUndefined();
    const aninhado = JSON.parse('{"campo":{"__proto__":{"x":1},"ok":1}}') as Record<string, unknown>;
    expect(sanearExtras(aninhado)).toEqual({ campo: { ok: 1 } });
  });
});

describe('personagemAtivo (selecao de personagem)', () => {
  it('id do catalogo inteiro passa, mesmo sem estar em desbloqueados (gating e M3-futuro)', () => {
    expect(sanearPersonagemAtivo('pingu', REGRAS)).toBe('pingu'); // nao esta em prog.desbloqueados de ninguem
    expect(sanearPersonagemAtivo('kaka', REGRAS)).toBe('kaka'); // inicial
  });

  it('ausente, lixo ou id fora do catalogo -> undefined (quem le decide o padrao)', () => {
    for (const ruim of [undefined, null, 5, [], {}, 'urso-polar', 'kaka ', ''])
      expect(sanearPersonagemAtivo(ruim, REGRAS)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
describe('sanearSave', () => {
  it('lixo de qualquer tipo -> save vazio valido', () => {
    for (const lixo of [undefined, null, 5, 'texto', true, [], [1, 2], Number.NaN]) expect(sanearSave(lixo, REGRAS)).toEqual(saveVazio());
  });

  it('save valido passa intacto (ida e volta) e e idempotente', () => {
    const s = saveCheio();
    expect(sanearSave(s, REGRAS)).toEqual(s);
    expect(sanearSave(sanearSave(s, REGRAS), REGRAS)).toEqual(sanearSave(s, REGRAS));
  });

  it('sempre devolve v: 1 e so as chaves do contrato; opcionais ausentes nao aparecem (exactOptionalPropertyTypes)', () => {
    const s = sanearSave({ v: 99, cfg: 3, lixo: undefined }, REGRAS);
    expect(Object.keys(s).sort()).toEqual(['cfg', 'prog', 'recordes', 'v']);
    expect(s.v).toBe(1);
  });

  it('personagemAtivo valido entra no save saneado; invalido ou ausente nao aparece', () => {
    expect(sanearSave({ ...saveCheio(), personagemAtivo: 'pingu' }, REGRAS).personagemAtivo).toBe('pingu');
    expect(sanearSave({ ...saveCheio(), personagemAtivo: 'ninja-fantasma' }, REGRAS).personagemAtivo).toBeUndefined();
    expect(sanearSave(saveCheio(), REGRAS).personagemAtivo).toBeUndefined();
    expect('personagemAtivo' in sanearSave(saveCheio(), REGRAS)).toBe(false);
  });

  it('nao muta a entrada', () => {
    const entrada = { ...saveCheio(), prog: { desbloqueados: ['pingu', 'pingu', 'futuro-x'], flocos: 5.5 } };
    const antes = JSON.stringify(entrada);
    sanearSave(entrada, REGRAS);
    expect(JSON.stringify(entrada)).toBe(antes);
  });

  it('campos desconhecidos de raiz sao preservados e os de ids/recordes de build futuro tambem', () => {
    const s = sanearSave({ ...saveCheio(), tema: 'neon', prog: { ...saveCheio().prog, desbloqueados: ['pingu', 'bicho-novo'] }, recordes: { 'pista-futura': [rec(3)] } }, REGRAS);
    expect(s.extras).toEqual({ tema: 'neon' });
    expect(s.prog.desconhecidos).toEqual(['urso-polar', 'bicho-novo']);
    expect(s.recordes['pista-futura']).toEqual([rec(3)]);
  });

  it('extras: em memoria ficam em `extras`; no disco voltam para a RAIZ (onde um build mais novo os escreveu), sem aninhar a cada ciclo', () => {
    const lido = sanearSave({ ...saveCheio(), tema: 'neon' }, REGRAS);
    expect(lido.extras).toEqual({ tema: 'neon' });
    const disco = paraDisco(lido);
    expect(disco['tema']).toBe('neon');
    expect('extras' in disco).toBe(false);
    let ciclo: SaveV1 = lido;
    for (let i = 0; i < 3; i++) ciclo = sanearSave(JSON.parse(JSON.stringify(paraDisco(ciclo))), REGRAS);
    expect(ciclo.extras).toEqual({ tema: 'neon' });
    // campo desconhecido nao pode sobrescrever um campo do contrato
    expect(paraDisco(sanearSave({ extras: { v: 9, cfg: 'x', tema: 'a' } }, REGRAS))['v']).toBe(1);
  });

  it('o pior caso possivel cabe folgado no teto de leitura (nunca fica grande demais para ler de volta)', () => {
    const todas = Array.from({ length: 40 }, (_, i) => `pista-${i}`);
    const regras: RegrasSave = { ...REGRAS, pistas: todas, pistasIniciais: [], versaoPista: Object.fromEntries(todas.map((p) => [p, 'g1'])) };
    const recs = Array.from({ length: 5 }, (_, i) => rec(i + 1));
    const antigos = Array.from({ length: 5 }, (_, i) => rec(i + 1, 3000, { versaoPista: 'g0' }));
    const bruto = {
      recordes: Object.fromEntries([...todas, ...Array.from({ length: 50 }, (_, i) => `futura-${i}`)].map((p) => [p, recs])),
      recordesAntigos: Object.fromEntries(todas.map((p) => [p, antigos])),
      fantasmas: Object.fromEntries(todas.map((p) => [p, { v: 1, lixo: 'x'.repeat(MAX_CHARS_REPLAY - 100) }])),
      prog: { desconhecidos: Array.from({ length: 100 }, (_, i) => `desc-${i}`) },
    };
    const texto = JSON.stringify(sanearSave(bruto, regras));
    expect(texto.length).toBeLessThan(MAX_TEXTO_SAVE);
  });
});

// ---------------------------------------------------------------------------
describe('fuzz deterministico: nunca lanca, sempre valido, idempotente', () => {
  function mulberry(seed: number): () => number {
    let a = seed;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const CHAVES = ['v', 'cfg', 'prog', 'recordes', 'recordesAntigos', 'fantasmas', 'diario', 'desbloqueados', 'pistas', 'objetivos', 'desconhecidos',
    'flocos', 'som', 'musica', 'controles', 'vale', 'cume', 'pontos', 'ticks', 'personagem', 'versaoPista', 'quando', 'data', 'melhor', 'tema', 'x'];
  const FOLHAS: unknown[] = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1, 0, 1, 2.5, 1e308, -0, 'kaka', 'pingu', 'vale', 'obj-a',
    'urso-polar', 'g1', 'botoes', 'gestos', QUANDO, '2026-10-22', '__proto__', '', 'A'.repeat(50), true, false, null, undefined, 3000, 99];
  function gerar(rnd: () => number, prof: number): unknown {
    const r = rnd();
    if (prof <= 0 || r < 0.35) return FOLHAS[Math.floor(rnd() * FOLHAS.length)];
    if (r < 0.6) return Array.from({ length: Math.floor(rnd() * 7) }, () => gerar(rnd, prof - 1));
    const o: Record<string, unknown> = {};
    for (let i = Math.floor(rnd() * 8); i > 0; i--) o[CHAVES[Math.floor(rnd() * CHAVES.length)] ?? 'x'] = gerar(rnd, prof - 1);
    return o;
  }

  /** Verificador INDEPENDENTE do saneador: so olha a forma do resultado. */
  function invalidos(s: SaveV1): string[] {
    const e: string[] = [];
    const ints = (n: number, max: number): boolean => Number.isInteger(n) && n >= 0 && n <= max;
    if (s.v !== 1) e.push('v');
    if (!(s.cfg.som >= 0 && s.cfg.som <= 1) || !(s.cfg.musica >= 0 && s.cfg.musica <= 1)) e.push('volume');
    if (!['gestos', 'botoes'].includes(s.cfg.controles)) e.push('controles');
    if (typeof s.cfg.movimentoReduzido !== 'boolean' || typeof s.cfg.maoEsquerda !== 'boolean') e.push('bool');
    if (!ints(s.prog.flocos, TETO_FLOCOS)) e.push('flocos');
    for (const lista of [s.prog.desbloqueados, s.prog.pistas, s.prog.objetivos, s.prog.desconhecidos]) {
      if (new Set(lista).size !== lista.length) e.push('repetidos');
      if (!lista.every((x) => typeof x === 'string')) e.push('nao-string');
    }
    if (s.prog.desconhecidos.length > MAX_DESCONHECIDOS) e.push('teto-desconhecidos');
    if (!s.prog.desconhecidos.every((x) => FORMA_ID.test(x))) e.push('forma-desconhecido');
    if (s.prog.desbloqueados.some((x) => REGRAS.iniciais.includes(x))) e.push('inicial-gravado');
    for (const mapa of [s.recordes, s.recordesAntigos ?? {}]) {
      for (const lista of Object.values(mapa)) {
        if (lista.length > MAX_RECORDES_POR_PISTA) e.push('teto-recordes');
        for (const r of lista) {
          if (!ints(r.pontos, TETO_PONTOS) || !ints(r.ticks, TETO_TICKS) || r.ticks < 1 || !ehInstanteUtc(r.quando)) e.push('recorde');
        }
      }
    }
    for (const [pista, lista] of Object.entries(s.recordes)) {
      const atual = (REGRAS.versaoPista ?? {})[pista];
      if (atual !== undefined && lista.some((r) => r.versaoPista !== atual)) e.push('versao-no-lugar-errado');
    }
    if (s.diario !== undefined && (!ehDataUtc(s.diario.data) || !ints(s.diario.melhor, TETO_PONTOS))) e.push('diario');
    if (Object.keys(s.fantasmas ?? {}).length > MAX_FANTASMAS) e.push('fantasmas');
    if (Object.keys(s.extras ?? {}).length > MAX_EXTRAS_CHAVES) e.push('extras');
    return e;
  }

  it('2000 entradas aleatorias (objetos, e tambem passando por JSON de verdade)', () => {
    const rnd = mulberry(20261022);
    for (let i = 0; i < 2000; i++) {
      const bruto = gerar(rnd, 5);
      const s = sanearSave(bruto, REGRAS);
      expect(invalidos(s), JSON.stringify(bruto)).toEqual([]);
      expect(sanearSave(s, REGRAS)).toEqual(s);
      // e o que sai tem de sobreviver a JSON sem mudar
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });

  it('a mesma semente produz as mesmas entradas (o fuzz e reproduzivel)', () => {
    const a = mulberry(7);
    const b = mulberry(7);
    expect(JSON.stringify(gerar(a, 4))).toBe(JSON.stringify(gerar(b, 4)));
  });
});

// ---------------------------------------------------------------------------
describe('disco: carregar e salvar', () => {
  it('nada no disco -> novo, padroes, e carregar NAO escreve nada', () => {
    const s = new StorageFalso();
    const r = carregarSave(s, REGRAS);
    expect(r).toEqual({ dados: saveVazio(), estado: 'novo', avisar: false });
    expect(s.escritas).toEqual([]);
  });

  it('ida e volta: o que se salva e o que se le (e so a chave neve-maluca-v1 e escrita)', () => {
    const s = new StorageFalso();
    expect(salvarSave(s, saveCheio(), REGRAS)).toBe('gravado');
    expect(s.chavesEscritas()).toEqual([CHAVE_SAVE]);
    expect(carregarSave(s, REGRAS)).toEqual({ dados: saveCheio(), estado: 'ok', avisar: false });
  });

  it('a chave e a do contrato e o corpo gravado tem v: 1', () => {
    const s = new StorageFalso();
    salvarSave(s, saveVazio(), REGRAS);
    expect(CHAVE_SAVE).toBe('neve-maluca-v1');
    expect(CHAVE_SAVE_QUEBRADA).toBe('neve-maluca-v1-quebrada');
    expect((salvo(s) as { v: number }).v).toBe(1);
  });

  it('salvar saneia: o disco nunca guarda lixo, mesmo que o chamador entregue lixo', () => {
    const s = new StorageFalso();
    const sujo = { ...saveCheio(), cfg: { som: 99, musica: Number.NaN, movimentoReduzido: 'x', controles: 'tela', maoEsquerda: 0 }, prog: { desbloqueados: ['kaka', 'pingu', 'pingu'], flocos: Number.POSITIVE_INFINITY } } as unknown as SaveV1;
    salvarSave(s, sujo, REGRAS);
    const lido = carregarSave(s, REGRAS).dados;
    expect(lido.cfg).toEqual({ ...CONFIG_PADRAO, som: 1 });
    expect(lido.prog.desbloqueados).toEqual(['pingu']);
    expect(lido.prog.flocos).toBe(0);
    expect(s.dados.get(CHAVE_SAVE)).not.toMatch(/NaN|Infinity/);
  });

  it('desconhecidos e campos extras fazem a viagem completa: carregar -> salvar -> carregar', () => {
    const s = new StorageFalso({
      [CHAVE_SAVE]: JSON.stringify({ ...saveCheio(), tema: 'neon', prog: { ...saveCheio().prog, desbloqueados: ['pingu', 'bicho-novo'] }, recordes: { 'pista-futura': [rec(3)] } }),
    });
    const a = carregarSave(s, REGRAS);
    expect(a.estado).toBe('ok');
    salvarSave(s, a.dados, REGRAS);
    const b = carregarSave(s, REGRAS).dados;
    expect(b.extras).toEqual({ tema: 'neon' });
    expect((salvo(s) as Record<string, unknown>)['tema']).toBe('neon');
    expect(b.prog.desconhecidos).toContain('bicho-novo');
    expect(b.recordes['pista-futura']).toEqual([rec(3)]);
    // e quando o catalogo passa a conhecer o id, ele e promovido
    const nova: RegrasSave = { ...REGRAS, personagens: [...REGRAS.personagens, 'bicho-novo'] };
    const c = carregarSave(s, nova).dados;
    expect(c.prog.desbloqueados).toEqual(['pingu', 'bicho-novo']);
    expect(c.prog.desconhecidos).not.toContain('bicho-novo');
  });

  describe('lixo no disco', () => {
    const LIXOS: Array<[string, string]> = [
      ['texto livre', 'isto nao e json'],
      ['json truncado', '{"v":1,"cfg":{"som":0.5'],
      ['null', 'null'],
      ['array', '[1,2,3]'],
      ['numero', '42'],
      ['string json', '"neve"'],
      ['objeto vazio (sem v)', '{}'],
      ['v texto', '{"v":"1"}'],
      ['v zero', '{"v":0}'],
      ['v negativo', '{"v":-1}'],
      ['v nulo', '{"v":null}'],
      ['v booleano', '{"v":true}'],
      ['v array', '{"v":[1]}'],
      ['string vazia', ''],
    ];

    for (const [nome, texto] of LIXOS) {
      it(`${nome}: copia para ${CHAVE_SAVE_QUEBRADA}, comeca do zero, nao lanca`, () => {
        const s = new StorageFalso({ [CHAVE_SAVE]: texto });
        const r = carregarSave(s, REGRAS);
        expect(r).toEqual({ dados: saveVazio(), estado: 'recuperado', avisar: false });
        expect(s.dados.get(CHAVE_SAVE_QUEBRADA)).toBe(texto);
        // o original ainda esta la ate o jogador salvar
        expect(s.dados.get(CHAVE_SAVE)).toBe(texto);
      });
    }

    it('salvar por cima do lixo guarda a copia antes de substituir', () => {
      const s = new StorageFalso({ [CHAVE_SAVE]: '{estragado' });
      expect(salvarSave(s, saveCheio(), REGRAS)).toBe('gravado');
      expect(s.dados.get(CHAVE_SAVE_QUEBRADA)).toBe('{estragado');
      expect(carregarSave(s, REGRAS).estado).toBe('ok');
    });

    it('a copia quebrada NAO e sobrescrita pela corrupcao seguinte (a primeira evidencia vale)', () => {
      const s = new StorageFalso({ [CHAVE_SAVE]: 'primeira' });
      carregarSave(s, REGRAS);
      s.dados.set(CHAVE_SAVE, 'segunda');
      carregarSave(s, REGRAS);
      salvarSave(s, saveVazio(), REGRAS);
      expect(s.dados.get(CHAVE_SAVE_QUEBRADA)).toBe('primeira');
    });

    it('texto gigante (maior que o teto) e tratado como adulterado', () => {
      const s = new StorageFalso({ [CHAVE_SAVE]: `{"v":1,"x":"${'a'.repeat(MAX_TEXTO_SAVE)}"}` });
      expect(carregarSave(s, REGRAS).estado).toBe('recuperado');
    });

    it('sem espaco para a copia quebrada: carregar segue sem lancar', () => {
      const s = new StorageFalso({ [CHAVE_SAVE]: 'lixo-grande-demais' }, { cota: 20 });
      expect(carregarSave(s, REGRAS).estado).toBe('recuperado');
      expect(s.dados.has(CHAVE_SAVE_QUEBRADA)).toBe(false);
    });

    it('JSON valido mas com tipos errados dentro: v correto, campos saneados campo a campo', () => {
      const s = new StorageFalso({
        [CHAVE_SAVE]: JSON.stringify({ v: 1, cfg: 'x', prog: { desbloqueados: 'pingu', flocos: '7', objetivos: [1, null, 'obj-a'] }, recordes: [], diario: 'hoje' }),
      });
      const r = carregarSave(s, REGRAS);
      expect(r.estado).toBe('ok');
      expect(r.dados).toEqual({ ...saveVazio(), prog: { desbloqueados: [], pistas: [], flocos: 0, objetivos: ['obj-a'], desconhecidos: [] } });
      expect(s.dados.has(CHAVE_SAVE_QUEBRADA)).toBe(false);
    });

    it('numeros NaN/Infinity que o JSON consegue carregar (1e999) sao saneados', () => {
      const s = new StorageFalso({ [CHAVE_SAVE]: '{"v":1,"cfg":{"som":1e999,"musica":-1e999},"prog":{"flocos":1e999},"recordes":{"vale":[{"pontos":1e999,"ticks":3,"personagem":"kaka","versaoPista":"g1","quando":"2026-10-22T15:30:00Z"}]}}' });
      const r = carregarSave(s, REGRAS);
      expect(r.estado).toBe('ok');
      expect(r.dados.cfg.som).toBe(CONFIG_PADRAO.som);
      expect(r.dados.cfg.musica).toBe(CONFIG_PADRAO.musica);
      expect(r.dados.prog.flocos).toBe(0);
      expect(r.dados.recordes).toEqual({});
    });
  });

  describe('versao futura (v > 1): lida em memoria, nunca sobrescrita', () => {
    const FUTURAS = ['{"v":2}', '{"v":3,"coisa":"nova"}', '{"v":1.5}', '{"v":1e999}', '{"v":99999}'];

    for (const texto of FUTURAS) {
      it(`${texto}: estado futuro, avisar, salvar recusa e o disco fica byte a byte igual`, () => {
        const s = new StorageFalso({ [CHAVE_SAVE]: texto });
        const r = carregarSave(s, REGRAS);
        expect(r.estado).toBe('futuro');
        expect(r.avisar).toBe(true);
        expect(salvarSave(s, saveCheio(), REGRAS)).toBe('recusado-futuro');
        expect(s.dados.get(CHAVE_SAVE)).toBe(texto);
        expect(s.escritas).toEqual([]);
        expect(s.dados.has(CHAVE_SAVE_QUEBRADA)).toBe(false);
      });
    }

    it('os campos que este build entende sao lidos (tolerante); o resto e ignorado', () => {
      const s = new StorageFalso({ [CHAVE_SAVE]: JSON.stringify({ ...saveCheio(), v: 2, formatoNovo: { x: 1 } }) });
      const r = carregarSave(s, REGRAS);
      expect(r.estado).toBe('futuro');
      expect(r.dados.prog.flocos).toBe(1234);
      expect(r.dados.recordes['vale']).toHaveLength(2);
    });

    it('ROLLBACK de build: depois do build mais novo gravar a chave v2, este build segue lendo a v1 intacta e nunca toca a v2', () => {
      const v1 = JSON.stringify(saveCheio());
      const v2 = JSON.stringify({ v: 2, tudo: 'mudou' });
      const s = new StorageFalso({ [CHAVE_SAVE]: v1, 'neve-maluca-v2': v2 });
      const r = carregarSave(s, REGRAS);
      expect(r.estado).toBe('ok');
      expect(r.dados).toEqual(saveCheio());
      salvarSave(s, { ...r.dados, prog: { ...r.dados.prog, flocos: 1 } }, REGRAS);
      expect(s.dados.get('neve-maluca-v2')).toBe(v2);
      expect(s.chavesEscritas()).toEqual([CHAVE_SAVE]);
    });

    it('recuperar-se: se o jogador voltar ao build novo e a v1 for v1 de novo, tudo volta a funcionar', () => {
      const s = new StorageFalso({ [CHAVE_SAVE]: '{"v":2}' });
      expect(salvarSave(s, saveVazio(), REGRAS)).toBe('recusado-futuro');
      s.dados.set(CHAVE_SAVE, JSON.stringify(saveVazio()));
      expect(salvarSave(s, saveCheio(), REGRAS)).toBe('gravado');
    });
  });

  describe('armazenamento ausente, bloqueado ou lotado', () => {
    it('sem armazenamento (null/undefined): carregar devolve padroes com aviso; salvar devolve falhou', () => {
      for (const nada of [null, undefined]) {
        expect(carregarSave(nada, REGRAS)).toEqual({ dados: saveVazio(), estado: 'indisponivel', avisar: true });
        expect(salvarSave(nada, saveCheio(), REGRAS)).toBe('falhou');
      }
    });

    it('leitura que lanca (SecurityError): indisponivel, com aviso, sem lancar', () => {
      const s = new StorageFalso();
      s.falhaLeitura = true;
      expect(carregarSave(s, REGRAS)).toEqual({ dados: saveVazio(), estado: 'indisponivel', avisar: true });
    });

    it('escrita que lanca: salvar devolve falhou e nao lanca', () => {
      const s = new StorageFalso();
      s.falhaEscrita = true;
      expect(salvarSave(s, saveCheio(), REGRAS)).toBe('falhou');
    });

    it('COTA EXCEDIDA: salvar devolve falhou, o save anterior continua legivel e o jogo segue', () => {
      const s = new StorageFalso();
      expect(salvarSave(s, saveVazio(), REGRAS)).toBe('gravado');
      const anterior = s.dados.get(CHAVE_SAVE);
      s.cota = 50;
      expect(salvarSave(s, saveCheio(), REGRAS)).toBe('falhou');
      expect(s.dados.get(CHAVE_SAVE)).toBe(anterior);
      expect(carregarSave(s, REGRAS).estado).toBe('ok');
    });

    it('armazenamento cujo getItem devolve algo que nao e texto: tratado como lixo, nao quebra', () => {
      const estranho: ArmazenamentoLike = { getItem: () => 123 as unknown as string, setItem: () => undefined, removeItem: () => undefined };
      expect(() => carregarSave(estranho, REGRAS)).not.toThrow();
      expect(carregarSave(estranho, REGRAS).dados).toEqual(saveVazio());
    });
  });
});

// ---------------------------------------------------------------------------
describe('gancho de migracao (o v1 e inaugural: a tabela real esta vazia)', () => {
  const CHAVE_V0 = 'neve-maluca-v0';
  const migrarV0: Migracao = {
    de: 0,
    chave: CHAVE_V0,
    migrar: (b) => {
      const o = b as { pontos?: unknown; vol?: unknown };
      return { v: 1, cfg: { som: o.vol }, prog: { flocos: o.pontos } };
    },
  };
  const V0 = JSON.stringify({ pontos: 321, vol: 0.4 });

  it('MIGRACOES do build inaugural e vazia (migracao de nada)', () => {
    expect(MIGRACOES).toEqual([]);
  });

  it('sem v1 e com a chave antiga: migra, grava a v1 e DEIXA a antiga byte a byte intacta', () => {
    const s = new StorageFalso({ [CHAVE_V0]: V0 });
    const r = carregarSave(s, REGRAS, [migrarV0]);
    expect(r.estado).toBe('migrado');
    expect(r.dados.prog.flocos).toBe(321);
    expect(r.dados.cfg.som).toBe(0.4);
    expect(s.dados.get(CHAVE_V0)).toBe(V0);
    expect(s.escritas.every(([tipo, k]) => tipo === 'set' && k === CHAVE_SAVE)).toBe(true);
    expect((salvo(s) as { v: number }).v).toBe(1);
  });

  it('idempotente: a segunda carga le a v1 (nao migra de novo) e o resultado e igual', () => {
    const s = new StorageFalso({ [CHAVE_V0]: V0 });
    const a = carregarSave(s, REGRAS, [migrarV0]);
    const escritas = s.escritas.length;
    const b = carregarSave(s, REGRAS, [migrarV0]);
    expect(b.estado).toBe('ok');
    expect(b.dados).toEqual(a.dados);
    expect(s.escritas.length).toBe(escritas);
  });

  it('ROLLBACK: com a v1 ja gravada, a chave antiga mexida por um build antigo NAO sobrescreve a v1', () => {
    const s = new StorageFalso({ [CHAVE_V0]: V0 });
    carregarSave(s, REGRAS, [migrarV0]);
    s.dados.set(CHAVE_V0, JSON.stringify({ pontos: 999999, vol: 1 })); // build antigo voltou a gravar
    const r = carregarSave(s, REGRAS, [migrarV0]);
    expect(r.estado).toBe('ok');
    expect(r.dados.prog.flocos).toBe(321);
  });

  it('a v1 valida tem prioridade: a migracao nem e consultada', () => {
    let chamada = false;
    const m: Migracao = { ...migrarV0, migrar: () => { chamada = true; return {}; } };
    const s = new StorageFalso({ [CHAVE_V0]: V0, [CHAVE_SAVE]: JSON.stringify(saveCheio()) });
    expect(carregarSave(s, REGRAS, [m]).estado).toBe('ok');
    expect(chamada).toBe(false);
  });

  it('v1 corrompida + chave antiga boa: copia a quebrada E recupera da antiga', () => {
    const s = new StorageFalso({ [CHAVE_V0]: V0, [CHAVE_SAVE]: '{ruim' });
    const r = carregarSave(s, REGRAS, [migrarV0]);
    expect(r.estado).toBe('migrado');
    expect(r.dados.prog.flocos).toBe(321);
    expect(s.dados.get(CHAVE_SAVE_QUEBRADA)).toBe('{ruim');
  });

  it('v1 FUTURA + chave antiga: nao migra e nao escreve por cima', () => {
    const s = new StorageFalso({ [CHAVE_V0]: V0, [CHAVE_SAVE]: '{"v":2}' });
    expect(carregarSave(s, REGRAS, [migrarV0]).estado).toBe('futuro');
    expect(s.escritas).toEqual([]);
  });

  it('migracao que lanca, devolve lixo ou le chave ilegivel e ignorada (cai no proximo / no padrao)', () => {
    const lanca: Migracao = { de: 0, chave: CHAVE_V0, migrar: () => { throw new Error('boom'); } };
    const lixo: Migracao = { de: 0, chave: CHAVE_V0, migrar: () => 'texto' };
    for (const m of [lanca, lixo]) {
      const s = new StorageFalso({ [CHAVE_V0]: V0 });
      expect(carregarSave(s, REGRAS, [m])).toEqual({ dados: saveVazio(), estado: 'novo', avisar: false });
    }
    const s2 = new StorageFalso({ [CHAVE_V0]: '{nao json' });
    expect(carregarSave(s2, REGRAS, [migrarV0]).estado).toBe('novo');
  });

  it('varias migracoes: a de formato mais novo vence', () => {
    const m1: Migracao = { de: 1, chave: 'neve-maluca-v1b', migrar: () => ({ v: 1, prog: { flocos: 11 } }) };
    const s = new StorageFalso({ [CHAVE_V0]: V0, 'neve-maluca-v1b': '{}' });
    expect(carregarSave(s, REGRAS, [migrarV0, m1]).dados.prog.flocos).toBe(11);
  });

  it('o dado migrado tambem passa pelo saneamento', () => {
    const m: Migracao = { de: 0, chave: CHAVE_V0, migrar: () => ({ cfg: { som: 50 }, prog: { flocos: -4, desbloqueados: ['kaka', 'pingu'] } }) };
    const s = new StorageFalso({ [CHAVE_V0]: '{}' });
    const r = carregarSave(s, REGRAS, [m]);
    expect(r.dados.cfg.som).toBe(1);
    expect(r.dados.prog.flocos).toBe(0);
    expect(r.dados.prog.desbloqueados).toEqual(['pingu']);
  });
});

// ---------------------------------------------------------------------------
describe('armazenamento resiliente: localStorage indisponivel, lotado ou em modo privado', () => {
  it('sem localStorage (obter devolve undefined/null ou lanca): tudo funciona em memoria, persistente = false', () => {
    const fontes: Array<() => ArmazenamentoLike | null | undefined> = [() => undefined, () => null, () => { throw new Error('SecurityError'); }];
    for (const fonte of fontes) {
      const a = new ArmazenamentoResiliente(fonte);
      expect(a.persistente).toBe(false);
      expect(salvarSave(a, saveCheio(), REGRAS)).toBe('so-memoria');
      expect(carregarSave(a, REGRAS).dados).toEqual(saveCheio());
      a.removeItem(CHAVE_SAVE);
      expect(a.getItem(CHAVE_SAVE)).toBeNull();
    }
  });

  it('modo privado: setItem lanca -> o jogo segue em memoria nesta sessao, e o aviso e possivel', () => {
    const disco = new StorageFalso();
    disco.falhaEscrita = true;
    const a = new ArmazenamentoResiliente(() => disco);
    expect(a.persistente).toBe(true);
    expect(salvarSave(a, saveCheio(), REGRAS)).toBe('so-memoria');
    expect(a.persistente).toBe(false);
    expect(carregarSave(a, REGRAS).dados).toEqual(saveCheio());
    expect(disco.dados.size).toBe(0);
  });

  it('cota cheia: grava em memoria; quando o disco volta a aceitar, a memoria e liberada e persistente volta a true', () => {
    const disco = new StorageFalso({}, { cota: 10 });
    const a = new ArmazenamentoResiliente(() => disco);
    expect(salvarSave(a, saveCheio(), REGRAS)).toBe('so-memoria');
    disco.cota = undefined;
    expect(salvarSave(a, saveCheio(), REGRAS)).toBe('gravado');
    expect(a.persistente).toBe(true);
    expect(disco.dados.has(CHAVE_SAVE)).toBe(true);
  });

  it('leitura e remocao que lancam no disco nao lancam para o jogo', () => {
    const disco = new StorageFalso({ [CHAVE_SAVE]: JSON.stringify(saveCheio()) });
    const a = new ArmazenamentoResiliente(() => disco);
    disco.falhaLeitura = true;
    disco.falhaEscrita = true;
    expect(a.getItem(CHAVE_SAVE)).toBeNull();
    expect(() => a.removeItem(CHAVE_SAVE)).not.toThrow();
    expect(carregarSave(a, REGRAS).estado).toBe('novo');
  });

  it('disco saudavel: persistente e leitura/escrita passam direto', () => {
    const disco = new StorageFalso();
    const a = new ArmazenamentoResiliente(() => disco);
    expect(salvarSave(a, saveCheio(), REGRAS)).toBe('gravado');
    expect(a.persistente).toBe(true);
    expect(disco.dados.has(CHAVE_SAVE)).toBe(true);
    expect(carregarSave(new ArmazenamentoResiliente(() => disco), REGRAS).dados).toEqual(saveCheio());
  });

  it('obterArmazenamentoDoNavegador: acesso que lanca, ausente e presente', () => {
    const lanca = Object.defineProperty({}, 'localStorage', { get: () => { throw new Error('SecurityError'); } });
    expect(obterArmazenamentoDoNavegador(lanca)).toBeUndefined();
    expect(obterArmazenamentoDoNavegador({})).toBeUndefined();
    expect(obterArmazenamentoDoNavegador({ localStorage: null })).toBeUndefined();
    const falso = new StorageFalso();
    expect(obterArmazenamentoDoNavegador({ localStorage: falso })).toBe(falso);
  });
});

// ---------------------------------------------------------------------------
describe('pureza da camada meta/ (mesma regra do motor: sem relogio, sem aleatorio, sem DOM)', () => {
  const fonte = readFileSync(new URL('../../../src/meta/storage.ts', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  it('storage.ts nao usa Date, Math.random, performance, window, document nem localStorage direto', () => {
    for (const proibido of [/\bDate\b/, /Math\.random/, /\bperformance\b/, /\bwindow\b/, /\bdocument\b/, /\blocalStorage\b(?!\?)/]) {
      // `localStorage` so aparece como nome de propriedade lida do alvo injetado.
      if (proibido.source.includes('localStorage')) {
        expect(fonte.match(/localStorage/g)?.length ?? 0).toBeLessThanOrEqual(2);
      } else {
        expect(fonte, String(proibido)).not.toMatch(proibido);
      }
    }
  });

  it('storage.ts so importa tipos (nao depende de core/ nem de data/)', () => {
    const importes = [...fonte.matchAll(/^import\s.*?from\s+'([^']+)'/gms)].map((m) => m[1]);
    expect(importes).toEqual(['./tipos']);
    expect(fonte).toMatch(/import type/);
  });
});
