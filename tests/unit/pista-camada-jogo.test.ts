/**
 * `gerarCamadaJogo` (plano `docs/plano-corrida-campeonato.md` §Arquitetura, C3): determinismo, forma do resultado e
 * a garantia mais importante — o terreno (hash de `gerarPista`) nunca muda, a camada é sobreposição pura.
 */
import { describe, expect, it } from 'vitest';
import { FORMATO_HASH } from '../../src/core/hash';
import { PISTA_CUME_DA_VENTANIA, PISTA_MORRO_DO_PINHAO, PISTA_PICO_DO_PICOLE, PISTA_VILA_CHOCOLATE, PISTA_VULCAO_PE_GELADO } from '../../src/data/pistas';
import { gerarCamadaJogo } from '../../src/pista/camada-jogo';
import { gerarPista } from '../../src/pista/gerador';

const PISTAS = [PISTA_MORRO_DO_PINHAO, PISTA_PICO_DO_PICOLE, PISTA_VILA_CHOCOLATE, PISTA_VULCAO_PE_GELADO, PISTA_CUME_DA_VENTANIA];

describe('gerarCamadaJogo: determinismo', () => {
  it('mesma pista + mesma semente => mesmo hash, duas vezes', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const a = gerarCamadaJogo(pista, PISTA_MORRO_DO_PINHAO);
    const b = gerarCamadaJogo(pista, PISTA_MORRO_DO_PINHAO);
    expect(a.hash).toBe(b.hash);
    expect(FORMATO_HASH.test(a.hash)).toBe(true);
  });

  it('sementes diferentes dão camadas diferentes (canal próprio, não o mesmo fluxo do gerador)', () => {
    const base = PISTA_MORRO_DO_PINHAO;
    const hashes = new Set<string>();
    for (let s = 1; s <= 10; s++) hashes.add(gerarCamadaJogo(gerarPista({ ...base, semente: s }), { ...base, semente: s }).hash);
    expect(hashes.size).toBeGreaterThan(5);
  });

  it('NUNCA muda o hash do terreno (gerarPista): a camada é só sobreposição', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const hashAntes = pista.hash;
    gerarCamadaJogo(pista, PISTA_MORRO_DO_PINHAO);
    expect(pista.hash).toBe(hashAntes);
    expect(gerarPista(PISTA_MORRO_DO_PINHAO).hash).toBe(hashAntes);
  });
});

describe('gerarCamadaJogo: forma do resultado (C3), nas 5 pistas oficiais', () => {
  for (const def of PISTAS) {
    const pista = gerarPista(def);
    const camada = gerarCamadaJogo(pista, def);

    it(`${def.id}: tem ao menos 1 kicker e algum coletável`, () => {
      expect(camada.kickers.length).toBeGreaterThan(0);
      expect(camada.itens.length).toBeGreaterThan(0);
    });

    it(`${def.id}: exatamente 1 "dourado"`, () => {
      expect(camada.itens.filter((i) => i.tipo === 'dourado')).toHaveLength(1);
    });

    it(`${def.id}: kickers e itens dentro dos limites da pista`, () => {
      for (const k of camada.kickers) {
        expect(k.x).toBeGreaterThanOrEqual(0);
        expect(k.x + k.largura).toBeLessThanOrEqual(pista.chegadaX);
        expect(k.impulsoMs).toBeGreaterThan(0);
      }
      for (const item of camada.itens) {
        expect(item.x).toBeGreaterThanOrEqual(0);
        expect(item.raio).toBeGreaterThan(0);
      }
    });

    it(`${def.id}: porticoX é a chegada`, () => {
      expect(camada.porticoX).toBe(pista.chegadaX);
    });

    it(`${def.id}: obstaculosAltos reservado (vazio, C4 ainda não existe)`, () => {
      expect(camada.obstaculosAltos).toEqual([]);
    });
  }
});
