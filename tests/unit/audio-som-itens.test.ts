/**
 * `criarSomItens` (src/audio/som-itens.ts): caixa pega + roleta, uso de cada item (6 timbres), acerto dado,
 * bloqueio do escudo e desvio — filtrado por `idJogador`, nunca tocando som de evento de outro corredor.
 */
import { describe, expect, it } from 'vitest';
import type { EventoCorrida, TipoItem } from '../../src/core/contratos';
import { TIPOS_ITEM } from '../../src/core/contratos';
import { criarRng } from '../../src/core/rng';
import { AudioDestravavel } from '../../src/audio/audio-destravavel';
import { criarSomItens } from '../../src/audio/som-itens';
import { criarContextoSinteseFalso, type ContextoSinteseFalso } from '../support/audio-falso';

const JOGADOR = 'capi';
const RIVAL = 'beto';

function montar(volumeInicial = 1, semente = 1): { falso: ContextoSinteseFalso; som: ReturnType<typeof criarSomItens>; volume: { v: number } } {
  const falso = criarContextoSinteseFalso();
  const audio = new AudioDestravavel(() => falso.ctx);
  audio.init();
  const volume = { v: volumeInicial };
  const som = criarSomItens(audio, criarRng(semente), JOGADOR, { obterVolumeSom: () => volume.v });
  return { falso, som, volume };
}

it('item-pego do jogador: toca o grab (tom) + a textura de roleta (ruído)', () => {
  const { falso, som } = montar();
  som.aoEvento({ tipo: 'item-pego', id: JOGADOR, item: 'turbo' });
  expect(falso.osciladores.length).toBeGreaterThan(0);
  expect(falso.ruidos).toHaveLength(1);
});

it('item-pego de um RIVAL: nenhum som (filtrado por idJogador)', () => {
  const { falso, som } = montar();
  som.aoEvento({ tipo: 'item-pego', id: RIVAL, item: 'turbo' });
  expect(falso.osciladores).toHaveLength(0);
  expect(falso.ruidos).toHaveLength(0);
});

describe('item-usado: um timbre por TipoItem, só do jogador', () => {
  it.each(TIPOS_ITEM)('%s: toca pelo menos 1 nó de áudio', (item: TipoItem) => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'item-usado', id: JOGADOR, item });
    expect(falso.osciladores.length + falso.ruidos.length).toBeGreaterThan(0);
  });

  it('cada item tem um timbre audivelmente diferente (forma OU faixa de frequência distinta)', () => {
    const assinaturaDe = (item: TipoItem): string => {
      const { falso, som } = montar();
      som.aoEvento({ tipo: 'item-usado', id: JOGADOR, item });
      const formas = falso.osciladores.map((o) => `${o.forma}:${o.f0}`).join(',');
      const ruidos = falso.ruidos.map((r) => `${r.tipo}:${r.f0}`).join(',');
      return `${formas}|${ruidos}`;
    };
    const assinaturas = new Set(TIPOS_ITEM.map(assinaturaDe));
    expect(assinaturas.size).toBe(TIPOS_ITEM.length);
  });

  it('de um RIVAL: nenhum som', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'item-usado', id: RIVAL, item: 'bola' });
    expect(falso.osciladores).toHaveLength(0);
    expect(falso.ruidos).toHaveLength(0);
  });
});

describe('acerto: só o DADO pelo jogador toca som (sofrido mora em som-descida.ts, evento "atingido")', () => {
  it('jogador acertou o rival (de = jogador): toca', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'acerto', de: JOGADOR, em: RIVAL, item: 'bola' });
    expect(falso.osciladores.length + falso.ruidos.length).toBeGreaterThan(0);
  });

  it('rival acertou o jogador (em = jogador, de = rival): NÃO toca aqui (isso é "atingido" em som-descida.ts)', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'acerto', de: RIVAL, em: JOGADOR, item: 'bola' });
    expect(falso.osciladores).toHaveLength(0);
    expect(falso.ruidos).toHaveLength(0);
  });

  it('acerto entre dois rivais: não toca', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'acerto', de: RIVAL, em: 'duda', item: 'bola' });
    expect(falso.osciladores).toHaveLength(0);
    expect(falso.ruidos).toHaveLength(0);
  });
});

describe('bloqueado (escudo) e desviou: só do jogador', () => {
  it('bloqueado do jogador: toca 1 tom cristalino', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'bloqueado', id: JOGADOR, item: 'bola' });
    expect(falso.osciladores).toHaveLength(1);
  });

  it('bloqueado de um rival: não toca', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'bloqueado', id: RIVAL, item: 'bola' });
    expect(falso.osciladores).toHaveLength(0);
  });

  it('desviou do jogador: toca 1 ruído sutil', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'desviou', id: JOGADOR, item: 'nuvem' });
    expect(falso.ruidos).toHaveLength(1);
  });

  it('desviou de um rival: não toca', () => {
    const { falso, som } = montar();
    som.aoEvento({ tipo: 'desviou', id: RIVAL, item: 'nuvem' });
    expect(falso.ruidos).toHaveLength(0);
  });
});

describe('volume e contexto', () => {
  it('cfg.som = 0: nenhum som é criado', () => {
    const { falso, som, volume } = montar();
    volume.v = 0;
    som.aoEvento({ tipo: 'item-pego', id: JOGADOR, item: 'turbo' });
    som.aoEvento({ tipo: 'acerto', de: JOGADOR, em: RIVAL, item: 'bola' });
    expect(falso.osciladores).toHaveLength(0);
    expect(falso.ruidos).toHaveLength(0);
  });

  it('antes do 1º gesto (ctx ainda null): não lança e não cria nada', () => {
    const falso = criarContextoSinteseFalso();
    const audio = new AudioDestravavel(() => falso.ctx);
    const som = criarSomItens(audio, criarRng(1), JOGADOR, { obterVolumeSom: () => 1 });
    expect(() => som.aoEvento({ tipo: 'item-pego', id: JOGADOR, item: 'turbo' })).not.toThrow();
    expect(falso.osciladores).toHaveLength(0);
  });
});

it('atualizar(eventos): dispara aoEvento para cada evento do tick, já filtrado por idJogador', () => {
  const { falso, som } = montar();
  const eventos: EventoCorrida[] = [
    { tipo: 'item-pego', id: RIVAL, item: 'turbo' }, // ignorado
    { tipo: 'item-usado', id: JOGADOR, item: 'escudo' }, // toca
    { tipo: 'bloqueado', id: JOGADOR, item: 'bola' }, // toca
  ];
  som.atualizar(eventos);
  expect(falso.osciladores.length).toBeGreaterThan(0);
});
