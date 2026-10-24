/**
 * IA da corrida (plano `docs/plano-corrida-campeonato.md` §Arquitetura, C2a): perfil por personagem e a trava
 * anti-travamento. O caso real que motivou a trava (medição da Nova, plano §medições): Beto, manobreiro ousadia 2,
 * caiu 35x no MESMO checkpoint do Vulcão Pé-Gelado (pista OFICIAL, layout fixo — nunca travar o terreno nem a
 * física é escopo deste teste) e nunca chegou — esta é a regressão que prova que, COM a trava, ele sempre chega,
 * em várias sementes de CORRIDA (a que sorteia a IA pelo canal `ia-<id>`, não a semente da pista).
 */
import { describe, expect, it } from 'vitest';
import { PERSONAGENS_DE_DADOS } from '../../src/data/personagens';
import { PISTA_VULCAO_PE_GELADO } from '../../src/data/pistas';
import { configDoPersonagem } from '../../src/descida/atributos';
import { criarDescida } from '../../src/descida/motor';
import { gerarPista } from '../../src/pista/gerador';
import { PERFIS_IA, criarIA, perfilIA } from '../../src/corrida/ia';

const MAX_TICKS = 16200; // mesmo teto generoso do golden do F0 e dos harnesses de bot.
const BETO = PERSONAGENS_DE_DADOS.find((d) => d.id === 'beto')!;
// Pista OFICIAL do Vulcão Pé-Gelado, layout fixo (não varia por semente: isso seria testar o terreno, fora de escopo).
const PISTA_OFICIAL = gerarPista(PISTA_VULCAO_PE_GELADO);
const CONFIG_BETO = configDoPersonagem('beto');

function correrComIA(sementeDaCorrida: number): { readonly concluiu: boolean; readonly hashFinal: string; readonly pontos: number; readonly ticks: number } {
  const motor = criarDescida(PISTA_OFICIAL, CONFIG_BETO, { modo: 'corrida' });
  const ia = criarIA(PISTA_OFICIAL, CONFIG_BETO, BETO, sementeDaCorrida);
  let leitura = motor.leitura();
  for (let i = 0; i < MAX_TICKS; i++) {
    leitura = motor.processar(ia(leitura));
    if (leitura.fase === 'chegou') break;
  }
  return { concluiu: leitura.fase === 'chegou', hashFinal: motor.hashEstado(), pontos: leitura.pontos, ticks: leitura.tick };
}

describe('criarIA: Beto (manobreiro ousadia 2) conclui o Vulcão Pé-Gelado oficial sem travar', () => {
  it(
    '50/50 sementes de CORRIDA (mesmo layout de pista, oficial, em todas)',
    () => {
      const falhas: number[] = [];
      for (let sementeDaCorrida = 1; sementeDaCorrida <= 50; sementeDaCorrida++) {
        if (!correrComIA(sementeDaCorrida).concluiu) falhas.push(sementeDaCorrida);
      }
      expect(falhas, `sementes de corrida que não concluíram: ${falhas.join(', ')}`).toEqual([]);
    },
    60_000,
  );
});

describe('criarIA: determinismo', () => {
  it('mesma pista + mesma física + mesma semente da corrida => sempre o mesmo resultado (hash, pontos, ticks)', () => {
    const a = correrComIA(7);
    const b = correrComIA(7);
    expect(a).toEqual(b);
  });

  it('sementes de corrida diferentes variam o resultado (prova que o sorteio por canal ia-<id> está de fato ligado)', () => {
    const resultados = new Set([correrComIA(1).ticks, correrComIA(2).ticks, correrComIA(3).ticks]);
    expect(resultados.size).toBeGreaterThan(1);
  });
});

describe('perfilIA', () => {
  it('cada personagem do elenco real tem perfil em PERFIS_IA', () => {
    for (const def of PERSONAGENS_DE_DADOS) expect(PERFIS_IA[def.id], def.id).toBeDefined();
  });

  it('id desconhecido (save/perfil de build futuro) cai no padrão moderado, nunca derruba', () => {
    expect(perfilIA('nao-existe-no-catalogo')).toEqual({ ousadia: 1 });
  });

  it('beto é o perfil de maior risco (ousadia 2) — o caso que motivou a trava', () => {
    expect(perfilIA('beto').ousadia).toBe(2);
  });

  it('capi é o perfil mais constante (ousadia 0), coerente com a personalidade do plano', () => {
    expect(perfilIA('capi').ousadia).toBe(0);
  });
});
