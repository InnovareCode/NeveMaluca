/**
 * Acumulador do `ResumoDescida` do jogador durante a corrida (plano `docs/plano-corrida-campeonato.md` §Contratos:
 * `ResultadoCorrida.resumoJogador`).
 *
 * EXCEÇÃO DE DONO temporária (Vega, C2a): esta conta é, por desenho, de `descida/resumo.ts` (redutor puro do plano
 * M3 §B.4, "ainda não escrito — F5"); mora aqui porque `corrida/finalizar()` precisa de um `ResumoDescida` de
 * verdade e `descida/resumo.ts` não existe ainda. Só observa o contrato PÚBLICO do motor (`LeituraDescida`, nunca
 * estado interno) — por isso, quando `descida/resumo.ts` nascer, esta função deve se mudar para lá e `corrida/`
 * passa a só consumi-la; nenhuma conta muda de lugar duas vezes.
 */
import type { EventoDescida, LeituraDescida, ResumoDescida } from '../core/contratos';

export interface AcumuladorResumo {
  /** Observa UMA `LeituraDescida` (chamar com toda leitura nova produzida pelo motor, na ordem). */
  observar(leitura: LeituraDescida): void;
  /** Fecha o resumo acumulado até aqui. Pode ser chamado mais de uma vez (não reseta o acumulador). */
  fechar(): ResumoDescida;
}

export function criarAcumuladorResumo(): AcumuladorResumo {
  let pontos = 0;
  let ticks = 0;
  let tombos = 0;
  let maiorVoltasNumSalto = 0;
  let maiorTicksNoAr = 0;
  let maiorGrindTicks = 0;
  let pousosPerfeitos = 0;
  let maiorMult = 0;
  let maiorComboManobras = 0;
  let bonecos = 0;
  let grindAtual = 0;
  let concluiu = false;

  return {
    observar(leitura: LeituraDescida): void {
      pontos = leitura.pontos;
      ticks = leitura.tick;
      if (leitura.fase === 'chegou') concluiu = true;

      if (leitura.piloto.modo === 'ar' && leitura.piloto.voltas > maiorVoltasNumSalto) maiorVoltasNumSalto = leitura.piloto.voltas;
      if (leitura.piloto.ticksNoAr > maiorTicksNoAr) maiorTicksNoAr = leitura.piloto.ticksNoAr;

      grindAtual = leitura.piloto.modo === 'trilho' ? grindAtual + 1 : 0;
      if (grindAtual > maiorGrindTicks) maiorGrindTicks = grindAtual;

      if (leitura.combo.mult > maiorMult) maiorMult = leitura.combo.mult;
      if (leitura.combo.manobras.length > maiorComboManobras) maiorComboManobras = leitura.combo.manobras.length;

      for (const ev of leitura.eventos as readonly EventoDescida[]) {
        if (ev.tipo === 'tombo') tombos++;
        else if (ev.tipo === 'pouso' && ev.qualidade === 'perfeito') pousosPerfeitos++;
        else if (ev.tipo === 'boneco') bonecos++;
      }
    },
    fechar(): ResumoDescida {
      return {
        pontos,
        ticks,
        tombos,
        maiorVoltasNumSalto,
        maiorTicksNoAr,
        maiorGrindTicks,
        pousosPerfeitos,
        maiorMult,
        maiorComboManobras,
        bonecos,
        concluiu,
      };
    },
  };
}
