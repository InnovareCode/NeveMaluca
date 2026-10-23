/**
 * Prova de "vencível" da Vila do Chocolate Quente (M3 F3, mesmo espírito de `descida-bot-harness-picole.test.ts`):
 * o bot "cuidadoso" conclui a pista em várias sementes de layout (os trechos-assinatura `telhados`/`escadaria`/
 * `varal`/`chamine` não travam ninguém). 50 sementes (não 100 como o harness oficial) para manter o `npm test`
 * rápido — a varredura mais funda é `npm run balanco -- --pista vila-chocolate`, fora do `npm test`.
 */
import { describe, expect, it } from 'vitest';
import { PISTA_VILA_CHOCOLATE } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { criarDescida } from '../../src/descida/motor';
import { gerarPista } from '../../src/pista/gerador';

const MAX_TICKS = 16200; // 270 s, mesmo teto generoso do harness do Morro/Picolé.

function concluiu(semente: number): boolean {
  const pista = gerarPista({ ...PISTA_VILA_CHOCOLATE, semente });
  const motor = criarDescida(pista);
  const bot = criarBotCuidadoso(pista);
  let leitura = motor.leitura();
  for (let i = 0; i < MAX_TICKS; i++) {
    leitura = motor.processar(bot(leitura));
    if (leitura.fase === 'chegou') return true;
  }
  return false;
}

describe('bot "cuidadoso" conclui a pista vila-chocolate em 50 sementes diferentes', () => {
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
