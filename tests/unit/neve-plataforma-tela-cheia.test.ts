// Origem: copiado de tests/unit/tela-cheia.test.ts do InnoFighters (2026-10-22) e adaptado ao Neve Maluca.
import { describe, expect, it } from 'vitest';
import { alternarTelaCheia, ehAparelhoIOS, emTelaCheia, situacaoDaTelaCheia, ultimoResultadoTelaCheia, type AlvoTelaCheia } from '../../src/platform/tela-cheia';

/*
 * Tela cheia: a plataforma é DETECTADA (iPhone/Chrome do iPhone não têm a Fullscreen API) e o pedido recusado no toque é refeito no
 * fim do toque (no Android o `touchstart` pode não valer como gesto). Windows falsos: nada aqui depende de navegador.
 */

const UA_IPHONE_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.153 Mobile/15E148 Safari/604.1';
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

interface Opcoes {
  ua?: string;
  plataforma?: string;
  toques?: number;
  api?: 'padrao' | 'prefixo' | 'nenhuma';
  habilitada?: boolean;
  standalone?: boolean;
  matchStandalone?: boolean;
  /** Como o `requestFullscreen` responde a cada chamada: true = aceita, false = recusa. */
  respostas?: boolean[];
}

function alvoFalso(o: Opcoes = {}) {
  const ouvintes = new Map<string, Set<() => void>>();
  const chamadas: number[] = [];
  const respostas = [...(o.respostas ?? [true])];
  const pedido = (): Promise<void> => {
    chamadas.push(chamadas.length);
    const ok = respostas.length > 1 ? respostas.shift() : respostas[0];
    if (ok) {
      doc.fullscreenElement = doc.documentElement as unknown as Element;
      return Promise.resolve();
    }
    return Promise.reject(new TypeError('API can only be initiated by a user gesture.'));
  };
  const api = o.api ?? 'padrao';
  const doc = {
    fullscreenElement: null as Element | null,
    fullscreenEnabled: o.habilitada,
    documentElement: api === 'padrao' ? { requestFullscreen: pedido } : api === 'prefixo' ? { webkitRequestFullscreen: pedido } : {},
    exitFullscreen: () => {
      doc.fullscreenElement = null;
      return Promise.resolve();
    },
    addEventListener: (t: string, f: () => void) => void (ouvintes.get(t) ?? ouvintes.set(t, new Set()).get(t))?.add(f),
    removeEventListener: (t: string, f: () => void) => void ouvintes.get(t)?.delete(f),
  };
  const timers: Array<() => void> = [];
  const alvo = {
    document: doc as unknown as Document,
    navigator: { userAgent: o.ua ?? UA_PC, platform: o.plataforma ?? 'Win32', maxTouchPoints: o.toques ?? 0, standalone: o.standalone } as unknown as Navigator,
    matchMedia: ((q: string) => ({ matches: q.includes('standalone') && o.matchStandalone === true })) as unknown as Window['matchMedia'],
    screen: { orientation: { lock: () => Promise.reject(new Error('x')), unlock: () => undefined } } as unknown as Screen,
    setTimeout: ((f: () => void) => timers.push(f)) as unknown as Window['setTimeout'],
    clearTimeout: (() => undefined) as unknown as Window['clearTimeout'],
  } satisfies AlvoTelaCheia;
  const disparar = (t: string): void => ouvintes.get(t)?.forEach((f) => f());
  return { alvo, doc, chamadas, disparar, estourarPrazo: () => timers.forEach((f) => f()), ouvintes };
}

describe('situacaoDaTelaCheia', () => {
  it('PC e Android Chrome (API padrão): disponível', () => {
    expect(situacaoDaTelaCheia(alvoFalso().alvo)).toBe('disponivel');
    expect(situacaoDaTelaCheia(alvoFalso({ ua: UA_ANDROID, toques: 5 }).alvo)).toBe('disponivel');
  });

  it('API só com prefixo webkit (iPad/Safari antigo): disponível', () => {
    expect(situacaoDaTelaCheia(alvoFalso({ api: 'prefixo', ua: UA_IPHONE_CHROME }).alvo)).toBe('disponivel');
  });

  it('iPhone com Chrome (sem API): "ios" — a UI explica Compartilhar > Adicionar à Tela de Início', () => {
    expect(situacaoDaTelaCheia(alvoFalso({ api: 'nenhuma', ua: UA_IPHONE_CHROME, toques: 5 }).alvo)).toBe('ios');
  });

  it('iPad que se apresenta como Mac (iPadOS 13+) conta como iOS', () => {
    const a = alvoFalso({ api: 'nenhuma', plataforma: 'MacIntel', toques: 5 }).alvo;
    expect(ehAparelhoIOS(a)).toBe(true);
    expect(ehAparelhoIOS(alvoFalso({ plataforma: 'MacIntel', toques: 0 }).alvo)).toBe(false); // Mac de verdade
  });

  it('iPhone aberto pelo ícone da Tela de Início (navigator.standalone): "instalado", já está sem barras', () => {
    expect(situacaoDaTelaCheia(alvoFalso({ api: 'nenhuma', ua: UA_IPHONE_CHROME, standalone: true }).alvo)).toBe('instalado');
    expect(situacaoDaTelaCheia(alvoFalso({ api: 'nenhuma', matchStandalone: true }).alvo)).toBe('instalado');
  });

  it('com a API, o modo standalone NÃO impede o liga/desliga', () => {
    expect(situacaoDaTelaCheia(alvoFalso({ standalone: true, matchStandalone: true }).alvo)).toBe('disponivel');
  });

  it('iframe sem permissão (fullscreenEnabled falso): "bloqueada"', () => {
    expect(situacaoDaTelaCheia(alvoFalso({ habilitada: false }).alvo)).toBe('bloqueada');
  });

  it('sem API fora do iOS (navegador embutido): "indisponivel"', () => {
    expect(situacaoDaTelaCheia(alvoFalso({ api: 'nenhuma', ua: UA_ANDROID, toques: 5 }).alvo)).toBe('indisponivel');
  });
});

describe('alternarTelaCheia', () => {
  it('desktop: entra e sai', async () => {
    const t = alvoFalso();
    expect(await alternarTelaCheia(t.alvo)).toBe('entrou');
    expect(emTelaCheia(t.alvo.document)).toBe(true);
    expect(await alternarTelaCheia(t.alvo)).toBe('saiu');
    expect(emTelaCheia(t.alvo.document)).toBe(false);
  });

  it('sem API (iPhone): devolve "sem-api" e não lança — a UI mostra o cartão de ajuda', async () => {
    const t = alvoFalso({ api: 'nenhuma', ua: UA_IPHONE_CHROME, toques: 5 });
    expect(await alternarTelaCheia(t.alvo)).toBe('sem-api');
    expect(ultimoResultadoTelaCheia()?.resultado).toBe('sem-api');
  });

  it('toque: recusado no touchstart, refeito no fim do toque -> entra (a recusa chega DEPOIS do touchend)', async () => {
    const t = alvoFalso({ ua: UA_ANDROID, toques: 5, respostas: [false, true] });
    const r = alternarTelaCheia(t.alvo);
    t.disparar('touchend'); // o dedo sobe antes de a recusa ser processada
    expect(await r).toBe('entrou');
    expect(t.chamadas).toHaveLength(2);
    expect(emTelaCheia(t.alvo.document)).toBe(true);
  });

  it('toque: recusado e nenhum gesto vem dentro do prazo -> "negada" (não fica esperando para sempre)', async () => {
    const t = alvoFalso({ ua: UA_ANDROID, toques: 5, respostas: [false] });
    const r = alternarTelaCheia(t.alvo);
    await Promise.resolve();
    await Promise.resolve();
    t.estourarPrazo();
    expect(await r).toBe('negada');
    expect(t.chamadas).toHaveLength(1);
    expect(ultimoResultadoTelaCheia()?.resultado).toBe('negada');
    // sem ouvinte sobrando depois do prazo
    expect([...t.ouvintes.get('touchend') ?? []]).toHaveLength(0);
  });

  it('desktop: recusado = "negada" na hora (sem esperar gesto)', async () => {
    const t = alvoFalso({ respostas: [false] });
    expect(await alternarTelaCheia(t.alvo)).toBe('negada');
    expect(t.chamadas).toHaveLength(1);
  });

  it('pedido aceito não deixa ouvinte de gesto pendurado', async () => {
    const t = alvoFalso({ ua: UA_ANDROID, toques: 5 });
    expect(await alternarTelaCheia(t.alvo)).toBe('entrou');
    expect([...t.ouvintes.get('touchend') ?? []]).toHaveLength(0);
  });

  it('API só com prefixo webkit: também entra', async () => {
    const t = alvoFalso({ api: 'prefixo' });
    expect(await alternarTelaCheia(t.alvo)).toBe('entrou');
  });
});
