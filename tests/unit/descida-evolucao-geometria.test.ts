/**
 * Teste de GEOMETRIA do upgrade (plano `docs/plano-corrida-campeonato.md` §Arquitetura/C6: "testar nível 0 e máx").
 * `aplicarEvolucao` muda a física de verdade (velocidade/equilíbrio/força sobem com o nível) — isso pode, em tese,
 * fazer o bot pousar/pular diferente o bastante para travar numa pista que o nível 0 sempre vencia. Matriz só com
 * nível 0 e MÁXIMO (não every nível, "pra não explodir" — texto do plano): 6 personagens x 5 pistas x 2 níveis.
 */
import { describe, expect, it } from 'vitest';
import { NIVEL_MAXIMO_EVOLUCAO } from '../../src/data/evolucao';
import { PERSONAGENS_DE_DADOS } from '../../src/data/personagens';
import { PISTAS_DE_DADOS } from '../../src/data/pistas';
import { aplicarEvolucao, configDoPersonagem } from '../../src/descida/atributos';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { criarDescida } from '../../src/descida/motor';
import { gerarPista } from '../../src/pista/gerador';

const MAX_TICKS = 16200; // mesmo teto generoso dos harnesses de bot (270s) — não é o portão de duração do jogo.
const NIVEIS_DA_MATRIZ = [0, NIVEL_MAXIMO_EVOLUCAO] as const;

function concluiu(idPersonagem: string, idPista: string, nivel: number): boolean {
  const def = PISTAS_DE_DADOS.find((p) => p.id === idPista)!;
  const personagem = PERSONAGENS_DE_DADOS.find((p) => p.id === idPersonagem)!;
  const pista = gerarPista(def);
  const config = aplicarEvolucao(configDoPersonagem(idPersonagem), personagem, { [idPersonagem]: nivel });
  const motor = criarDescida(pista, config);
  const bot = criarBotCuidadoso(pista);
  let leitura = motor.leitura();
  for (let i = 0; i < MAX_TICKS; i++) {
    leitura = motor.processar(bot(leitura));
    if (leitura.fase === 'chegou') return true;
  }
  return false;
}

describe('aplicarEvolucao: geometria — os 6 concluem as 5 pistas oficiais no nível 0 E no nível MÁXIMO', () => {
  it(
    `${PERSONAGENS_DE_DADOS.length} personagens x ${PISTAS_DE_DADOS.length} pistas x níveis [0, ${NIVEL_MAXIMO_EVOLUCAO}]`,
    () => {
      const falhas: string[] = [];
      for (const personagem of PERSONAGENS_DE_DADOS) {
        for (const pista of PISTAS_DE_DADOS) {
          for (const nivel of NIVEIS_DA_MATRIZ) {
            if (!concluiu(personagem.id, pista.id, nivel)) falhas.push(`${personagem.id} x ${pista.id} x nível ${nivel}`);
          }
        }
      }
      expect(falhas, `combinações que travaram: ${falhas.join(', ')}`).toEqual([]);
    },
    120_000,
  );
});
