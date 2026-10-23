/**
 * Reprodução do replay C6 como FANTASMA (plano §7 M1a/M2: correr contra a melhor descida da pista). Roda um 2º
 * `criarDescida` da MESMA pista, alimentado tick a tick pelos comandos decodificados do `ReplayV1` — o mesmo motor
 * determinístico, só que lido de fora em vez de reagir à entrada ao vivo. Não toca DOM/áudio/render: devolve só a
 * `PilotoLeitura` de cada tick (quem desenha é `ui/cenas/descida.ts`).
 *
 * Por que não expor `hashEstado()`/pontos/combo do fantasma: o fantasma é decoração visual (silhueta translúcida),
 * não um segundo HUD — expor mais do motor interno convidaria a cena a tratá-lo como um 2º jogador de verdade, que
 * não é o escopo (plano §7 só pede "correr junto").
 */
import type { PilotoLeitura, PistaGerada, ReplayV1 } from '../core/contratos';
import { falha, ok, type Resultado } from '../core/erros';
import { decodificarComandos } from '../core/replay';
import { criarDescida } from './motor';

export interface ReprodutorFantasma {
  /**
   * Avança UM tick do fantasma e devolve a `PilotoLeitura` resultante, ou `null` quando os comandos do replay
   * terminaram (o fantasma "desaparece": fica mais ticks na pista do que a melhor descida gravada).
   */
  avancar(): PilotoLeitura | null;
}

/**
 * Cria o reprodutor. Falha (sem lançar) se `replay.pista`/`hashPista` não forem desta `pista` (fantasma de outra
 * pista/versão do gerador não pode rodar aqui: a física mudaria o resultado) ou se `replay.comandos` não decodificar.
 */
export function criarReprodutorFantasma(replay: ReplayV1, pista: PistaGerada): Resultado<ReprodutorFantasma> {
  if (replay.pista !== pista.id) return falha([`fantasma: replay é da pista "${replay.pista}", esperada "${pista.id}"`]);
  if (replay.hashPista !== pista.hash) return falha(['fantasma: hashPista não bate com a pista gerada agora (versão do gerador mudou)']);
  const decodificado = decodificarComandos(replay.comandos);
  if (!decodificado.ok) return falha(decodificado.erros);

  const comandos = decodificado.valor;
  const motor = criarDescida(pista);
  let i = 0;

  return ok({
    avancar(): PilotoLeitura | null {
      if (i >= comandos.length) return null;
      const leitura = motor.processar(comandos[i] as (typeof comandos)[number]);
      i++;
      return leitura.piloto;
    },
  });
}
