/**
 * Constantes oficiais, validação do boot (funções puras) e o barril `core/index.ts`.
 * O teste fixa os números do plano: se alguém mudar 960x540, o buffer 2x ou os 60 Hz, ele acusa e lembra do e2e de fumaça.
 */
import { describe, expect, it } from 'vitest';
import * as core from '../../src/core';
import * as C from '../../src/core/constantes';
import { ErroDeContrato, exigir, falha, ok } from '../../src/core/erros';
import { exigirCoreValido, problemasDasConstantes, problemasDasPecas } from '../../src/core/validacao';

describe('constantes oficiais (plano M0 e §3.2)', () => {
  it('tela: 960x540 lógico, buffer 2x = 1920x1080, 16:9 (o e2e de fumaça espera 1920x1080)', () => {
    expect([C.LARGURA_LOGICA, C.ALTURA_LOGICA, C.ESCALA_BUFFER]).toEqual([960, 540, 2]);
    expect([C.LARGURA_BUFFER, C.ALTURA_BUFFER]).toEqual([1920, 1080]);
    expect(C.PROPORCAO_TELA).toBeCloseTo(16 / 9, 12);
    expect([C.LARGURA, C.ALTURA, C.RS]).toEqual([960, 540, 2]); // aliases usados pela platform/
  });

  it('tempo: 60 Hz, passo de 1000/60 ms, acumulador de 100 ms, no máximo 6 passos por quadro', () => {
    expect(C.TICKS_POR_SEGUNDO).toBe(60);
    expect(C.PASSO_MS).toBe(1000 / 60);
    expect(C.PASSO_S).toBe(1 / 60);
    expect(C.ACUMULADOR_MAX_MS).toBe(100);
    expect(C.ACUMULADOR_MAXIMO_MS).toBe(C.ACUMULADOR_MAX_MS);
    expect(C.MAX_PASSOS_POR_QUADRO).toBe(6);
  });

  it('mundo e limites: dx 0,5 m, zoom 1,0 a 0,8, canais de RNG, teto de replay de 5 min, forma de id', () => {
    expect(C.DX_PISTA_M).toBe(0.5);
    expect(C.ZOOM_PARADO).toBe(1);
    expect(C.ZOOM_VELOCIDADE_MAX).toBe(0.8);
    expect(C.PX_POR_METRO).toBeGreaterThan(0);
    expect(C.TETO_TICKS_REPLAY).toBe(18000);
    expect(C.TETO_PONTOS).toBe(99_999_999);
    expect(C.FORMA_ID.test('bosque-1')).toBe(true);
    for (const ruim of ['', 'a', 'A1', '1abc', 'a_b', 'a b', 'x'.repeat(25), '../a', 'ação']) expect(C.FORMA_ID.test(ruim), ruim).toBe(false);
  });
});

describe('validação do boot', () => {
  it('o núcleo atual passa: nenhum problema nas constantes nem nas peças', () => {
    expect(problemasDasConstantes()).toEqual([]);
    expect(problemasDasPecas()).toEqual([]);
    expect(() => exigirCoreValido()).not.toThrow();
  });

  it('importar o barril roda a validação (e expõe a API sem colisão de nomes)', () => {
    for (const nome of ['criarRng', 'rngDoCanal', 'seno', 'cosseno', 'atan2', 'hashDeValor', 'criarLaco', 'codificarComandos', 'validarReplayV1', 'exigirCoreValido', 'LARGURA_BUFFER', 'ErroDeContrato']) {
      expect((core as Record<string, unknown>)[nome], nome).toBeDefined();
    }
  });
});

describe('erros estruturados', () => {
  it('ErroDeContrato carrega código e detalhes legíveis por programa', () => {
    const e = new ErroDeContrato('hash-divergente', 'pista bosque', ['esperado=a', 'obtido=b']);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('ErroDeContrato');
    expect(e.codigo).toBe('hash-divergente');
    expect(e.detalhes).toEqual(['esperado=a', 'obtido=b']);
    expect(e.message).toBe('pista bosque: esperado=a; obtido=b');
    expect(new ErroDeContrato('contrato-invalido', 'sem detalhes').message).toBe('sem detalhes');
  });

  it('exigir devolve o valor ou lança com os erros do resultado', () => {
    expect(exigir(ok(5), 'contrato-invalido', 'x')).toBe(5);
    expect(() => exigir(falha(['a', 'b']), 'contrato-invalido', 'dado ruim')).toThrowError('dado ruim: a; b');
  });
});
