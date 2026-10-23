/**
 * Prova de "vencível" do Pico do Picolé (M3 F3, mesmo espírito de `descida-bot-harness.test.ts` do Morro): o bot
 * "cuidadoso" conclui a pista em várias sementes de layout (os trechos-assinatura não travam ninguém). 50 sementes
 * (não 100 como o Morro) para manter o `npm test` rápido — a varredura mais funda (100+ sementes, 6 personagens com
 * o bot manobreiro) é `npm run balanco -- --pista pico-do-picole`, fora do `npm test` (mesmo acordo do Morro/F2).
 */
import { describe, expect, it } from 'vitest';
import { PISTA_PICO_DO_PICOLE } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { criarDescida } from '../../src/descida/motor';
import { gerarPista } from '../../src/pista/gerador';

const MAX_TICKS = 16200; // 270 s, mesmo teto generoso do harness do Morro.

function concluiu(semente: number): boolean {
  const pista = gerarPista({ ...PISTA_PICO_DO_PICOLE, semente });
  const motor = criarDescida(pista);
  const bot = criarBotCuidadoso(pista);
  let leitura = motor.leitura();
  for (let i = 0; i < MAX_TICKS; i++) {
    leitura = motor.processar(bot(leitura));
    if (leitura.fase === 'chegou') return true;
  }
  return false;
}

describe('bot "cuidadoso" conclui a pista pico-do-picole em 50 sementes diferentes', () => {
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
