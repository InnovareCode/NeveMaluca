import { describe, expect, it } from 'vitest';
import { COMANDO_NEUTRO } from '../../src/core/comandos';
import type { ComandoDescida } from '../../src/core/contratos';
import { criarMotorTeste } from '../../src/ui/cenas/motor-teste';
import { gerarPistaTeste } from '../../src/ui/cenas/pista-teste';

/**
 * Testes do DUBLÊ de motor do M1a (`motor-teste.ts`), não do motor de produção da Vega (`src/descida/`, fora do
 * escopo da Lyra). Aqui só se prova que ele responde a `ComandoDescida` o bastante para exercitar render/câmera.
 */
describe('ui/cenas/motor-teste (dublê do M1a)', () => {
  it('pista de teste: amostras suficientes, comprimento positivo e objetos dentro da pista', () => {
    const pista = gerarPistaTeste(200);
    expect(pista.alturas.length).toBeGreaterThan(10);
    expect(pista.chegadaX).toBeGreaterThan(0);
    for (const obj of pista.objetos) {
      expect(obj.x).toBeGreaterThanOrEqual(0);
      expect(obj.x).toBeLessThanOrEqual(pista.chegadaX);
    }
  });

  it('fase começa em contagem e passa a "descendo" depois de 60 ticks, sem precisar de comando', () => {
    const motor = criarMotorTeste(gerarPistaTeste(200));
    let leitura = motor.tick(COMANDO_NEUTRO);
    expect(leitura.fase).toBe('contagem');
    for (let i = 0; i < 60; i += 1) leitura = motor.tick(COMANDO_NEUTRO);
    expect(leitura.fase).toBe('descendo');
  });

  it('responde ao comando de pulo: vira "ar" e `vy` fica positivo no tick do pulo', () => {
    const motor = criarMotorTeste(gerarPistaTeste(200));
    for (let i = 0; i < 61; i += 1) motor.tick(COMANDO_NEUTRO); // sai da contagem
    const comPulo: ComandoDescida = { pulo: true, giro: 0, grab: null, agachar: false };
    const leitura = motor.tick(comPulo);
    expect(leitura.piloto.modo).toBe('ar');
    expect(leitura.piloto.vy).toBeGreaterThan(0);
    expect(leitura.eventos.some((e) => e.tipo === 'pulo')).toBe(true);
  });

  it('sem nenhum comando, acelera morro abaixo e eventualmente chega ("fase: chegou")', () => {
    const pista = gerarPistaTeste(60); // pista curta: chega rápido, teste não fica lento
    const motor = criarMotorTeste(pista);
    let leitura = motor.tick(COMANDO_NEUTRO);
    let seguranca = 0;
    while (leitura.fase !== 'chegou' && seguranca < 5000) {
      leitura = motor.tick(COMANDO_NEUTRO);
      seguranca += 1;
    }
    expect(leitura.fase).toBe('chegou');
    expect(leitura.eventos.some((e) => e.tipo === 'chegada')).toBe(true);
  });
});
