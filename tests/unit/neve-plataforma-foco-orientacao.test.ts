import { describe, expect, it } from 'vitest';
import { observarFoco, type AlvoFoco } from '../../src/platform/foco';
import { emRetrato, observarOrientacao, travarPaisagem, type AlvoOrientacao } from '../../src/platform/orientacao';

type Ouvinte = (e?: unknown) => void;

function emissor() {
  const mapa = new Map<string, Set<Ouvinte>>();
  return {
    addEventListener: (t: string, f: Ouvinte): void => void (mapa.get(t) ?? mapa.set(t, new Set()).get(t))?.add(f),
    removeEventListener: (t: string, f: Ouvinte): void => void mapa.get(t)?.delete(f),
    emitir: (t: string, e?: unknown): void => mapa.get(t)?.forEach((f) => f(e)),
    quantos: (t: string): number => mapa.get(t)?.size ?? 0,
  };
}

describe('observarFoco', () => {
  function montar() {
    const janela = emissor();
    const doc = { hidden: false, ...emissor() };
    const alvo = { addEventListener: janela.addEventListener, removeEventListener: janela.removeEventListener, document: doc } as unknown as AlvoFoco;
    const eventos: string[] = [];
    const desfazer = observarFoco(alvo, {
      aoPerderFoco: () => eventos.push('perdeu'),
      aoGanharFoco: () => eventos.push('ganhou'),
      aoOcultar: () => eventos.push('ocultou'),
      aoMostrar: () => eventos.push('mostrou'),
    });
    return { janela, doc, eventos, desfazer };
  }

  it('blur/focus da janela viram perdeu/ganhou', () => {
    const { janela, eventos } = montar();
    janela.emitir('blur');
    janela.emitir('focus');
    expect(eventos).toEqual(['perdeu', 'ganhou']);
  });

  it('visibilitychange: oculta quando document.hidden, mostra quando volta', () => {
    const { doc, eventos } = montar();
    doc.hidden = true;
    doc.emitir('visibilitychange');
    doc.hidden = false;
    doc.emitir('visibilitychange');
    expect(eventos).toEqual(['ocultou', 'mostrou']);
  });

  it('callbacks ausentes são aceitos e desfazer remove todos os ouvintes', () => {
    const janela = emissor();
    const doc = { hidden: false, ...emissor() };
    const alvo = { addEventListener: janela.addEventListener, removeEventListener: janela.removeEventListener, document: doc } as unknown as AlvoFoco;
    const desfazer = observarFoco(alvo, {});
    janela.emitir('blur');
    doc.emitir('visibilitychange');
    expect(janela.quantos('blur') + janela.quantos('focus') + doc.quantos('visibilitychange')).toBe(3);
    desfazer();
    expect(janela.quantos('blur') + janela.quantos('focus') + doc.quantos('visibilitychange')).toBe(0);
  });
});

describe('orientação', () => {
  it('emRetrato = a mesma regra da media query (orientation: portrait): altura >= largura', () => {
    expect(emRetrato(390, 844)).toBe(true);
    expect(emRetrato(844, 390)).toBe(false);
    expect(emRetrato(800, 800)).toBe(true); // quadrada conta como retrato no CSS
  });

  it('observarOrientacao avisa já com o estado atual e a cada mudança, e desfaz', () => {
    const consulta = { matches: true, ...emissor() };
    const alvo = { matchMedia: (q: string) => (q === '(orientation: portrait)' ? consulta : null) } as unknown as AlvoOrientacao;
    const vistos: boolean[] = [];
    const desfazer = observarOrientacao(alvo, (r) => vistos.push(r));
    expect(vistos).toEqual([true]);
    consulta.emitir('change', { matches: false });
    consulta.emitir('change', { matches: true });
    expect(vistos).toEqual([true, false, true]);
    desfazer();
    expect(consulta.quantos('change')).toBe(0);
  });

  it('travarPaisagem: melhor esforço, nunca lança (iOS não tem lock)', async () => {
    const semLock = { screen: { orientation: {} } } as unknown as Window;
    expect(await travarPaisagem(semLock)).toBe(false);
    const recusa = { screen: { orientation: { lock: () => Promise.reject(new Error('nao')) } } } as unknown as Window;
    expect(await travarPaisagem(recusa)).toBe(false);
    let pedido = '';
    const ok = { screen: { orientation: { lock: (o: string) => ((pedido = o), Promise.resolve()) } } } as unknown as Window;
    expect(await travarPaisagem(ok)).toBe(true);
    expect(pedido).toBe('landscape');
    expect(await travarPaisagem({ screen: undefined } as unknown as Window)).toBe(false);
  });
});
