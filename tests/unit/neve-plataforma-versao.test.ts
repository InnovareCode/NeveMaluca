// Origem: copiado de tests/unit/versao.test.ts do InnoFighters (2026-10-22) e adaptado ao Neve Maluca.
import { describe, expect, it } from 'vitest';
import { recarregarSemCache, rotuloDaVersao, verificarVersao, type IdentidadeDoBuild } from '../../src/versao';

const ATUAL: IdentidadeDoBuild = { commit: '64f2647', data: '2026-10-22T02:17:41.055Z', sujo: false };

const resposta = (corpo: unknown, ok = true): typeof fetch => (() => Promise.resolve({ ok, json: () => Promise.resolve(corpo) } as Response)) as unknown as typeof fetch;

describe('rotuloDaVersao', () => {
  it('commit curto + data no horário de Brasília (UTC-3)', () => {
    expect(rotuloDaVersao(ATUAL)).toBe('64f2647 · 21/10 23:17');
  });

  it('build com alterações não commitadas leva "+" (só em máquina de desenvolvimento)', () => {
    expect(rotuloDaVersao({ ...ATUAL, sujo: true })).toBe('64f2647+ · 21/10 23:17');
  });

  it('data ausente ou inválida: só o commit', () => {
    expect(rotuloDaVersao({ commit: 'dev', data: '', sujo: false })).toBe('dev');
    expect(rotuloDaVersao({ commit: 'abc1234', data: 'lixo', sujo: false })).toBe('abc1234');
  });
});

describe('verificarVersao', () => {
  it('mesma identidade no ar: "atual"', async () => {
    expect((await verificarVersao(ATUAL, resposta(ATUAL), '/')).estado).toBe('atual');
  });

  it('commit diferente OU mesma commit com build mais novo: "nova", e devolve a que está no ar', async () => {
    const outro = { ...ATUAL, commit: 'abc1234' };
    const r = await verificarVersao(ATUAL, resposta(outro), '/');
    expect(r.estado).toBe('nova');
    expect(r.noAr?.commit).toBe('abc1234');
    expect((await verificarVersao(ATUAL, resposta({ ...ATUAL, data: '2026-10-23T00:00:00.000Z' }), '/')).estado).toBe('nova');
  });

  it('sem rede, 404 ou resposta que não é a esperada: "desconhecida" e nunca lança', async () => {
    const semRede = (() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;
    expect((await verificarVersao(ATUAL, semRede, '/')).estado).toBe('desconhecida');
    expect((await verificarVersao(ATUAL, resposta({}, false), '/')).estado).toBe('desconhecida');
    expect((await verificarVersao(ATUAL, resposta({ commit: 1 }), '/')).estado).toBe('desconhecida');
    expect((await verificarVersao(ATUAL, resposta(null), '/')).estado).toBe('desconhecida');
  });

  it('pede version.json na base do site, sem cache e com parâmetro que fura o cache do navegador', async () => {
    const pedidos: Array<{ url: string; cache: string | undefined }> = [];
    const espia = ((url: string, init?: RequestInit) => {
      pedidos.push({ url, cache: init?.cache });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(ATUAL) } as Response);
    }) as unknown as typeof fetch;
    await verificarVersao(ATUAL, espia, '/NeveMaluca/');
    expect(pedidos[0]?.url).toMatch(/^\/NeveMaluca\/version\.json\?t=\d+$/);
    expect(pedidos[0]?.cache).toBe('no-store');
  });
});

describe('recarregarSemCache', () => {
  it('troca a URL com ?v=<commit> (outra entrada de cache para o index.html), preservando o resto', () => {
    let destino = '';
    const alvo = { location: { href: 'https://x.github.io/NeveMaluca/?seed=3', replace: (u: string) => (destino = u) } } as unknown as Pick<Window, 'location'>;
    recarregarSemCache(alvo, { ...ATUAL, commit: 'abc1234' });
    expect(destino).toBe('https://x.github.io/NeveMaluca/?seed=3&v=abc1234');
  });
});
