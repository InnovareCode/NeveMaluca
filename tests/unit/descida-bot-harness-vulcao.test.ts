/**
 * Prova de "vencível" do Vulcão Pé-Gelado (M3 F3, mesmo espírito de `descida-bot-harness-picole.test.ts`/
 * `descida-bot-harness-vila.test.ts`): o bot "cuidadoso" conclui a pista em várias sementes de layout (os
 * trechos-assinatura `geiser`/`ponte-basalto`/`basalto`/`cratera` não travam ninguém). 50 sementes (não 100 como
 * o harness oficial) para manter o `npm test` rápido — a varredura mais funda é `npm run balanco -- --pista
 * vulcao-pe-gelado`, fora do `npm test`.
 */
import { describe, expect, it } from 'vitest';
import { PISTA_VULCAO_PE_GELADO } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { criarDescida } from '../../src/descida/motor';
import { gerarPista } from '../../src/pista/gerador';

const MAX_TICKS = 16200; // 270 s, mesmo teto generoso do harness do Morro/Picolé/Vila.

function concluiu(semente: number): boolean {
  const pista = gerarPista({ ...PISTA_VULCAO_PE_GELADO, semente });
  const motor = criarDescida(pista);
  const bot = criarBotCuidadoso(pista);
  let leitura = motor.leitura();
  for (let i = 0; i < MAX_TICKS; i++) {
    leitura = motor.processar(bot(leitura));
    if (leitura.fase === 'chegou') return true;
  }
  return false;
}

describe('bot "cuidadoso" conclui a pista vulcao-pe-gelado em 50 sementes diferentes', () => {
  it(
    '50/50',
    () => {
      const falhas: number[] = [];
      for (let semente = 1; semente <= 50; semente++) {
        if (!concluiu(semente)) falhas.push(semente);
      }
      expect(falhas, `sementes que não concluíram: ${falhas.join(', ')}`).toEqual([]);
    },
    60_000,
  );
});
