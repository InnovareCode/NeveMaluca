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
import { VERSAO_MOTOR, type ConfigDescida } from './constantes';
import { criarDescida } from './motor';

export interface ReprodutorFantasma {
  /**
   * Avança UM tick do fantasma e devolve a `PilotoLeitura` resultante, ou `null` quando os comandos do replay
   * terminaram (o fantasma "desaparece": fica mais ticks na pista do que a melhor descida gravada).
   */
  avancar(): PilotoLeitura | null;
}

/**
 * Cria o reprodutor. `config` é a física de QUEM GRAVOU o replay (plano M3 §A.3: desde a F1, cada personagem tem a
 * sua) — sem ela o fantasma do Tio Beto rodaria com a física da Capi e sairia da pista (achado 2 do plano §0).
 *
 * Falha (sem lançar) se: `replay.pista`/`hashPista` não forem desta `pista` (fantasma de outra pista/versão do
 * gerador não pode rodar aqui: a física mudaria o resultado); `replay.comandos` não decodificar; ou
 * `replay.versaoMotor` for incompatível — só a versão atual (`VERSAO_MOTOR`) é aceita, e a versão anterior ('1')
 * só se `replay.personagem === 'capi'`, porque a física dela não mudou entre '1' e '2' (plano §A.3). Qualquer outro
 * caso falha aqui e a descida roda sem fantasma, que já é o comportamento previsto (não é erro de boot).
 */
export function criarReprodutorFantasma(replay: ReplayV1, pista: PistaGerada, config: ConfigDescida): Resultado<ReprodutorFantasma> {
  if (replay.pista !== pista.id) return falha([`fantasma: replay é da pista "${replay.pista}", esperada "${pista.id}"`]);
  if (replay.hashPista !== pista.hash) return falha(['fantasma: hashPista não bate com a pista gerada agora (versão do gerador mudou)']);
  if (replay.versaoMotor !== VERSAO_MOTOR && !(replay.versaoMotor === '1' && replay.personagem === 'capi')) {
    return falha([`fantasma: replay da versão do motor "${replay.versaoMotor}" incompatível com "${VERSAO_MOTOR}" (personagem "${replay.personagem}")`]);
  }
  const decodificado = decodificarComandos(replay.comandos);
  if (!decodificado.ok) return falha(decodificado.erros);

  const comandos = decodificado.valor;
  const motor = criarDescida(pista, config);
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
