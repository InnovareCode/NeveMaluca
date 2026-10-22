/**
 * Prova automatizada do portão do plano §3.4/§7 (M1a): "o bot conclui a pista em 100 de 100 sementes". Mesmo
 * espírito do `ferramentas/harness/cli.mjs` (que serve pra explorar manualmente com mais sementes/relatório), mas
 * aqui dentro do `npm test`, pra não depender de rodar a ferramenta à mão. Gera 100 variações da pista publicada
 * (mesmo catálogo/tema, só troca a semente) e desce cada uma com o bot "cuidadoso".
 */
import { describe, expect, it } from 'vitest';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { criarDescida } from '../../src/descida/motor';
import { gerarPista } from '../../src/pista/gerador';

const MAX_TICKS = 16200; // 270 s: generoso, não é o portão de duração do jogo (esse é com o dono, no aparelho).

function concluiu(semente: number): boolean {
  const pista = gerarPista({ ...PISTA_MORRO_DO_PINHAO, semente });
  const motor = criarDescida(pista);
  const bot = criarBotCuidadoso(pista);
  let leitura = motor.leitura();
  for (let i = 0; i < MAX_TICKS; i++) {
    leitura = motor.processar(bot(leitura));
    if (leitura.fase === 'chegou') return true;
  }
  return false;
}

describe('bot "cuidadoso" conclui a pista morro-do-pinhao em 100 sementes diferentes', () => {
  it(
    '100/100',
    () => {
      const falhas: number[] = [];
      for (let semente = 1; semente <= 100; semente++) {
        if (!concluiu(semente)) falhas.push(semente);
      }
      expect(falhas, `sementes que não concluíram: ${falhas.join(', ')}`).toEqual([]);
    },
    60_000,
  );
});
