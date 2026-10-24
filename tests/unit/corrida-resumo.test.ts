/**
 * `criarAcumuladorResumo` (plano `docs/plano-corrida-campeonato.md` §Contratos, exceção de dono em
 * `corrida/resumo.ts`): confere que todos os campos de `ResumoDescida` são acumulados certo a partir só do
 * contrato público do motor (`LeituraDescida`), numa descida real da Capi.
 */
import { describe, expect, it } from 'vitest';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { criarBotManobreiro } from '../../src/descida/bot';
import { CONFIG_PADRAO } from '../../src/descida/constantes';
import { criarDescida } from '../../src/descida/motor';
import { gerarPista } from '../../src/pista/gerador';
import { criarAcumuladorResumo } from '../../src/corrida/resumo';

const MAX_TICKS = 16200;

describe('criarAcumuladorResumo', () => {
  it('nunca observado: zerado, não concluiu', () => {
    expect(criarAcumuladorResumo().fechar()).toEqual({
      pontos: 0,
      ticks: 0,
      tombos: 0,
      maiorVoltasNumSalto: 0,
      maiorTicksNoAr: 0,
      maiorGrindTicks: 0,
      pousosPerfeitos: 0,
      maiorMult: 0,
      maiorComboManobras: 0,
      bonecos: 0,
      concluiu: false,
    });
  });

  it('descida real do manobreiro (Capi, ousadia 2): resumo coerente com a leitura final e os eventos', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const motor = criarDescida(pista, CONFIG_PADRAO);
    const bot = criarBotManobreiro(pista, CONFIG_PADRAO, { ousadia: 2 });
    const acumulador = criarAcumuladorResumo();
    let leitura = motor.leitura();
    let tombosEsperados = 0;
    let pousosPerfeitosEsperados = 0;
    let bonecosEsperados = 0;
    for (let i = 0; i < MAX_TICKS; i++) {
      leitura = motor.processar(bot(leitura));
      acumulador.observar(leitura);
      for (const ev of leitura.eventos) {
        if (ev.tipo === 'tombo') tombosEsperados++;
        else if (ev.tipo === 'pouso' && ev.qualidade === 'perfeito') pousosPerfeitosEsperados++;
        else if (ev.tipo === 'boneco') bonecosEsperados++;
      }
      if (leitura.fase === 'chegou') break;
    }
    expect(leitura.fase).toBe('chegou');

    const resumo = acumulador.fechar();
    expect(resumo.concluiu).toBe(true);
    expect(resumo.pontos).toBe(leitura.pontos);
    expect(resumo.ticks).toBe(leitura.tick);
    expect(resumo.tombos).toBe(tombosEsperados);
    expect(resumo.pousosPerfeitos).toBe(pousosPerfeitosEsperados);
    expect(resumo.bonecos).toBe(bonecosEsperados);
    // o manobreiro em ousadia 2 arrisca voo: ao menos um salto relevante e algum combo acontece nesta pista.
    expect(resumo.maiorTicksNoAr).toBeGreaterThan(0);
    expect(resumo.maiorMult).toBeGreaterThanOrEqual(1);
  });
});
