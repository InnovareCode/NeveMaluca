/**
 * Gerador de pista (plano §3.4, contrato C5). Propriedades principais: determinismo (mesma semente => mesmo hash),
 * tangente casada entre trechos (sem degrau no ângulo nas junções), checkpoints/chegada dentro da pista, e o hash
 * fixo da pista publicada (`morro-do-pinhao`) trava mudanças acidentais no gerador ou no catálogo.
 */
import { describe, expect, it } from 'vitest';
import type { DefPista } from '../../src/core/contratos';
import { FORMATO_HASH } from '../../src/core/hash';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { inclinacaoGrausEm } from '../../src/pista/consulta';
import { exigirPistaValida, exigirPistasValidas, gerarPista } from '../../src/pista/gerador';

const DEF_BASE: DefPista = {
  id: 'teste-pista',
  nome: 'Teste',
  tema: 'bosque',
  semente: 42,
  comprimentoM: 300,
  dificuldade: [0, 0.5],
  trechos: { reta: 5, ondulado: 3, boneco: 2, pedras: 1.5, trilho: 1.5, rampa: 1, degrau: 0.3, vao: 0.2 },
  musica: 'teste',
  objetivos: [],
  hashEsperado: '0000000000000000',
  ordem: 1,
  desbloqueio: { tipo: 'inicial' },
};

describe('gerarPista: determinismo', () => {
  it('mesma semente e mesmo DefPista => mesmo hash, duas vezes', () => {
    const a = gerarPista(DEF_BASE);
    const b = gerarPista(DEF_BASE);
    expect(a.hash).toBe(b.hash);
    expect(FORMATO_HASH.test(a.hash)).toBe(true);
  });

  it('sementes diferentes (tudo o mais igual) quase sempre dão pistas diferentes', () => {
    const hashes = new Set<string>();
    for (let s = 1; s <= 20; s++) hashes.add(gerarPista({ ...DEF_BASE, semente: s }).hash);
    expect(hashes.size).toBeGreaterThan(15);
  });

  it('mutação: mudar um peso de trecho muda o hash (a varredura real depende disso para travar recordes)', () => {
    const a = gerarPista(DEF_BASE);
    const b = gerarPista({ ...DEF_BASE, trechos: { ...DEF_BASE.trechos, reta: 50 } });
    expect(a.hash).not.toBe(b.hash);
  });
});

describe('gerarPista: forma do resultado (C5)', () => {
  const pista = gerarPista(DEF_BASE);

  it('alturas cobrem exatamente [0, comprimentoM] a cada 0,5 m', () => {
    expect(pista.dx).toBe(0.5);
    expect(pista.alturas.length).toBe(Math.round(DEF_BASE.comprimentoM / 0.5) + 1);
    expect(pista.alturas[0]).toBe(0);
  });

  it('chegada no fim exato da pista', () => {
    expect(pista.chegadaX).toBe(DEF_BASE.comprimentoM);
  });

  it('checkpoints: começam em 0, crescem estritamente, nunca passam da chegada', () => {
    expect(pista.checkpoints[0]).toBe(0);
    for (let i = 1; i < pista.checkpoints.length; i++) expect(pista.checkpoints[i] as number).toBeGreaterThan(pista.checkpoints[i - 1] as number);
    for (const c of pista.checkpoints) expect(c).toBeLessThan(pista.chegadaX);
  });

  it('objetos e trilhos ficam dentro de [0, comprimentoM]', () => {
    for (const o of pista.objetos) {
      expect(o.x).toBeGreaterThanOrEqual(0);
      expect(o.x).toBeLessThan(pista.chegadaX);
    }
    for (const t of pista.trilhos) {
      expect(t.x0).toBeGreaterThanOrEqual(0);
      expect(t.x1).toBeLessThanOrEqual(pista.chegadaX);
      expect(t.x1).toBeGreaterThan(t.x0);
    }
  });

  it('tangente casada: a inclinação amostrada não tem degrau nas emendas (varredura fina)', () => {
    // Varre toda a pista de 0,1 em 0,1 m: a diferença de ângulo entre amostras vizinhas tem de ser pequena
    // (continuidade de tangente). Um degrau de verdade (bug de emenda) passaria de várias dezenas de graus.
    let anterior = inclinacaoGrausEm(pista, 0);
    let maiorSalto = 0;
    for (let x = 0.1; x <= pista.chegadaX; x += 0.1) {
      const atual = inclinacaoGrausEm(pista, x);
      const salto = Math.abs(atual - anterior);
      if (salto > maiorSalto) maiorSalto = salto;
      anterior = atual;
    }
    expect(maiorSalto).toBeLessThan(8);
  });
});

describe('exigirPistaValida / exigirPistasValidas (boot)', () => {
  it('aceita quando o hash bate', () => {
    const esperado = gerarPista(DEF_BASE).hash;
    expect(() => exigirPistaValida({ ...DEF_BASE, hashEsperado: esperado })).not.toThrow();
  });

  it('lança ErroDeContrato quando o hash diverge (mutação: hash errado)', () => {
    expect(() => exigirPistaValida(DEF_BASE)).toThrow(/hash diverge/);
  });

  it('exigirPistasValidas confere a lista inteira e aponta qual pista falhou', () => {
    const boaBase: DefPista = { ...DEF_BASE, id: 'boa' };
    const boa: DefPista = { ...boaBase, hashEsperado: gerarPista(boaBase).hash };
    expect(() => exigirPistasValidas([boa, DEF_BASE])).toThrow(/teste-pista/);
    expect(() => exigirPistasValidas([boa])).not.toThrow();
  });
});

describe('pista publicada: morro-do-pinhao (o que o jogo usa de verdade)', () => {
  it('hashEsperado em src/data/pistas.ts bate com o gerador atual (hash fixo do plano §3.4)', () => {
    expect(() => exigirPistaValida(PISTA_MORRO_DO_PINHAO)).not.toThrow();
  });
});
