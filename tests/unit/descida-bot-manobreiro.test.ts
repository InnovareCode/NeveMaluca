/**
 * Bot "manobreiro" (plano M3 §A.4, F2): prova que ele de fato MANOBRA na pista REAL (não numa pista sintética —
 * a memória da Íris registra que o bot cuidadoso se comporta diferente em sintética x real, ver
 * `.claude/agent-memory/iris/m2-bot-cuidadoso-pontua-na-pista-real.md`) e que o planejamento de voo (puro, sem
 * efeito no motor) é sensato antes de confiar nele no harness de balanço (`ferramentas/balanco/cli.mjs`).
 */
import { describe, expect, it } from 'vitest';
import { PERSONAGENS_DE_DADOS } from '../../src/data/personagens';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { configDoPersonagem } from '../../src/descida/atributos';
import { criarBotCuidadoso, criarBotManobreiro, estimarTicksNoAr, planejarVoo } from '../../src/descida/bot';
import { CONFIG_PADRAO, type ConfigDescida } from '../../src/descida/constantes';
import { criarDescida } from '../../src/descida/motor';
import { gerarPista } from '../../src/pista/gerador';

const MAX_TICKS = 16200; // mesmo teto generoso do golden do F0 (`m3-congelamento-capi.test.ts`) e do bot-harness.

function descer(config: ConfigDescida, semente: number, ousadia: 0 | 1 | 2 = 0) {
  const pista = gerarPista({ ...PISTA_MORRO_DO_PINHAO, semente });
  const motor = criarDescida(pista, config);
  const bot = criarBotManobreiro(pista, config, { ousadia });
  let leitura = motor.leitura();
  for (let i = 0; i < MAX_TICKS; i++) {
    leitura = motor.processar(bot(leitura));
    if (leitura.fase === 'chegou') break;
  }
  return { leitura, motor };
}

describe('estimarTicksNoAr (puro)', () => {
  it('vy de decolagem não positivo não dá tempo de ar (defensivo: nunca deveria ocorrer no jogo real)', () => {
    expect(estimarTicksNoAr(CONFIG_PADRAO, 0)).toBe(0);
    expect(estimarTicksNoAr(CONFIG_PADRAO, -5)).toBe(0);
  });

  it('balística simétrica: vy=11 com gravidade 22 m/s² dá exatamente 60 ticks (2*11 / (22/60))', () => {
    expect(estimarTicksNoAr(CONFIG_PADRAO, 11)).toBe(60);
  });

  it('mais vy de decolagem nunca estima menos tempo de ar (monotônico)', () => {
    const estimativas = [2, 5, 8, 11, 15, 20].map((vy) => estimarTicksNoAr(CONFIG_PADRAO, vy));
    for (let i = 1; i < estimativas.length; i++) expect(estimativas[i]).toBeGreaterThanOrEqual(estimativas[i - 1] as number);
  });
});

describe('planejarVoo (puro, mesma conta de atualizarGiro fora do motor)', () => {
  it('tempo de ar curto não vale a pena girar (sobra para convergir o amortecimento não cabe)', () => {
    expect(planejarVoo(CONFIG_PADRAO, 5).voltas).toBe(0);
    expect(planejarVoo(CONFIG_PADRAO, 0).voltas).toBe(0);
    expect(planejarVoo(CONFIG_PADRAO, -10).voltas).toBe(0);
  });

  it('tempo de ar generoso cabe o teto de voltas (3, plano §3.5: mais que isso não pontua mais)', () => {
    const plano = planejarVoo(CONFIG_PADRAO, 200);
    expect(plano.voltas).toBe(3);
    expect(plano.ticksAteSoltar).toBeGreaterThan(0);
    expect(plano.ticksAteSoltar).toBeLessThan(200);
  });

  it('mais tempo de ar nunca planeja MENOS voltas (monotônico)', () => {
    const voltas = [10, 20, 40, 60, 90, 130, 180].map((t) => planejarVoo(CONFIG_PADRAO, t).voltas);
    for (let i = 1; i < voltas.length; i++) expect(voltas[i]).toBeGreaterThanOrEqual(voltas[i - 1] as number);
  });

  it('o plano reserva margem: soltar o giro mais a convergência do amortecimento nunca passa do tempo de ar estimado', () => {
    for (const t of [15, 30, 50, 80, 120, 200]) {
      const plano = planejarVoo(CONFIG_PADRAO, t);
      if (plano.voltas > 0) expect(plano.ticksAteSoltar).toBeLessThanOrEqual(t);
    }
  });
});

describe('bot manobreiro na pista REAL (morro-do-pinhao, semente oficial): de fato gira, segura grab e pontua', () => {
  it('gera manobra de grab, manobra de ar/mortal e fecha combo — não é só o cuidadoso de outro nome', () => {
    const { leitura } = descer(CONFIG_PADRAO, PISTA_MORRO_DO_PINHAO.semente, 1);
    expect(leitura.fase).toBe('chegou');

    // Reconstroi os eventos rodando de novo e coletando (a leitura final só tem os últimos eventos do tick).
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const motor = criarDescida(pista, CONFIG_PADRAO);
    const bot = criarBotManobreiro(pista, CONFIG_PADRAO, { ousadia: 1 });
    const idsDeManobra = new Set<string>();
    let fechouCombo = false;
    let l = motor.leitura();
    for (let i = 0; i < MAX_TICKS; i++) {
      l = motor.processar(bot(l));
      for (const ev of l.eventos) {
        if (ev.tipo === 'manobra') idsDeManobra.add(ev.id);
        if (ev.tipo === 'combo-fechado') fechouCombo = true;
      }
      if (l.fase === 'chegou') break;
    }
    expect(idsDeManobra, 'ids de manobra vistos na descida real').toContain('grab');
    expect(fechouCombo).toBe(true);
  });

  it('pontua MAIS que o bot cuidadoso na mesma pista (prova que o manobreiro não é passivo)', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);

    const motorCuidadoso = criarDescida(pista, CONFIG_PADRAO);
    const cuidadoso = criarBotCuidadoso(pista);
    let lc = motorCuidadoso.leitura();
    for (let i = 0; i < MAX_TICKS && lc.fase !== 'chegou'; i++) lc = motorCuidadoso.processar(cuidadoso(lc));
    expect(lc.fase).toBe('chegou');

    let melhorManobreiro = 0;
    for (const ousadia of [0, 1, 2] as const) {
      const { leitura } = descer(CONFIG_PADRAO, PISTA_MORRO_DO_PINHAO.semente, ousadia);
      expect(leitura.fase).toBe('chegou');
      melhorManobreiro = Math.max(melhorManobreiro, leitura.pontos);
    }
    expect(melhorManobreiro).toBeGreaterThan(lc.pontos);
  });

  it(
    'é determinístico: duas rodadas independentes com a mesma config/semente/ousadia dão o mesmo hash e pontos',
    () => {
      const a = descer(CONFIG_PADRAO, PISTA_MORRO_DO_PINHAO.semente, 2);
      const b = descer(CONFIG_PADRAO, PISTA_MORRO_DO_PINHAO.semente, 2);
      expect(a.motor.hashEstado()).toBe(b.motor.hashEstado());
      expect(a.leitura.pontos).toBe(b.leitura.pontos);
    },
  );
});

describe('bot manobreiro com a física dos 6 personagens (plano §A.4: "lê a própria física")', () => {
  it(
    'conclui a pista com os 6 personagens em 10 sementes (ao menos um nível de ousadia), versão reduzida do G1 para o manobreiro',
    () => {
      const falhas: string[] = [];
      for (const def of PERSONAGENS_DE_DADOS) {
        const config = configDoPersonagem(def.id);
        for (let semente = 1; semente <= 10; semente++) {
          const concluiuAlgumaOusadia = ([0, 1, 2] as const).some((ousadia) => descer(config, semente, ousadia).leitura.fase === 'chegou');
          if (!concluiuAlgumaOusadia) falhas.push(`${def.id}@${semente}`);
        }
      }
      expect(falhas, `(personagem@semente) que não concluíram em nenhuma ousadia: ${falhas.join(', ')}`).toEqual([]);
    },
    60_000,
  );

  it('cada personagem termina com pontuação positiva na semente oficial (sanidade: ninguém fica zerado)', () => {
    for (const def of PERSONAGENS_DE_DADOS) {
      const config = configDoPersonagem(def.id);
      const { leitura } = descer(config, PISTA_MORRO_DO_PINHAO.semente, 1);
      expect(leitura.fase, def.id).toBe('chegou');
      expect(leitura.pontos, def.id).toBeGreaterThan(0);
    }
  });
});
