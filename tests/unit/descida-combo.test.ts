/**
 * M2 — combo e pontuação (plano §3.5). A máquina de combo (`descida/combo.ts`) é testada pura; a integração no
 * motor é provada por um cenário de trilho (grind), que é o jeito mais determinístico de garantir uma manobra
 * pontuada sem depender do ajuste fino de salto/giro. O determinismo COM pontos já está coberto por
 * `descida-motor.test.ts` (o `hashEstado` agora inclui `pontos` e o combo).
 */
import { describe, expect, it } from 'vitest';
import type { ComandoDescida, PistaGerada } from '../../src/core/contratos';
import {
  abrirJanela,
  adicionarManobra,
  comboInicial,
  deveFechar,
  fechar,
  leituraCombo,
  multiplicador,
  perder,
  tiqueJanela,
} from '../../src/descida/combo';
import { JANELA_LIGACAO_TICKS } from '../../src/data/manobras';
import { criarDescida } from '../../src/descida/motor';

describe('combo — máquina pura (plano §3.5)', () => {
  it('multiplicador = 1 + famílias DISTINTAS (repetir a mesma família não aumenta)', () => {
    const c = comboInicial();
    expect(multiplicador(c)).toBe(1);
    adicionarManobra(c, { id: 'ar', familia: 'ar', pontos: 100 });
    expect(multiplicador(c)).toBe(2);
    adicionarManobra(c, { id: 'mortal', familia: 'mortal', pontos: 500 });
    expect(multiplicador(c)).toBe(3);
    adicionarManobra(c, { id: 'ar', familia: 'ar', pontos: 100 }); // ar de novo: família já contada
    expect(multiplicador(c)).toBe(3);
  });

  it('repetir a MESMA família: 1ª cheia, 2ª 50%, 3ª+ 25%', () => {
    const c = comboInicial();
    expect(adicionarManobra(c, { id: 'ar', familia: 'ar', pontos: 100 })).toBe(100);
    expect(adicionarManobra(c, { id: 'ar', familia: 'ar', pontos: 100 })).toBe(50);
    expect(adicionarManobra(c, { id: 'ar', familia: 'ar', pontos: 100 })).toBe(25);
    expect(adicionarManobra(c, { id: 'ar', familia: 'ar', pontos: 100 })).toBe(25);
    expect(c.soma).toBe(200);
  });

  it('fechar: total = soma × mult, e zera o estado', () => {
    const c = comboInicial();
    adicionarManobra(c, { id: 'ar', familia: 'ar', pontos: 100 });
    adicionarManobra(c, { id: 'mortal', familia: 'mortal', pontos: 500 });
    const r = fechar(c); // soma 600, mult 3
    expect(r).toEqual({ soma: 600, mult: 3, total: 1800 });
    expect(c.ativo).toBe(false);
    expect(c.soma).toBe(0);
    expect(c.manobras).toEqual([]);
  });

  it('perder (tombo): devolve a soma perdida mas NÃO vira pontuação; zera', () => {
    const c = comboInicial();
    adicionarManobra(c, { id: 'mortal', familia: 'mortal', pontos: 500 });
    expect(perder(c)).toEqual({ soma: 500 });
    expect(c.ativo).toBe(false);
    expect(c.soma).toBe(0);
  });

  it('janela de ligação: abre, consome no chão e manda fechar quando esgota', () => {
    const c = comboInicial();
    adicionarManobra(c, { id: 'ar', familia: 'ar', pontos: 100 });
    abrirJanela(c);
    expect(c.janela).toBe(JANELA_LIGACAO_TICKS);
    expect(deveFechar(c)).toBe(false);
    for (let i = 0; i < JANELA_LIGACAO_TICKS; i++) tiqueJanela(c);
    expect(c.janela).toBe(0);
    expect(deveFechar(c)).toBe(true);
  });

  it('leituraCombo (C3) reflete o estado e copia os arrays', () => {
    const c = comboInicial();
    adicionarManobra(c, { id: 'grab', familia: 'grab', pontos: 150 });
    const l = leituraCombo(c);
    expect(l).toMatchObject({ ativo: true, soma: 150, mult: 2, janela: 0 });
    expect(l.manobras).toEqual(['grab']);
    expect(l.manobras).not.toBe(c.manobras); // cópia, não o array vivo
  });
});

describe('motor — pontuação real (integração M2)', () => {
  function pistaPlana(comprimentoM: number, extra: Partial<PistaGerada> = {}): PistaGerada {
    const n = Math.round(comprimentoM / 0.5) + 1;
    return {
      id: 'sintetica',
      semente: 1,
      versaoGerador: 'teste',
      dx: 0.5,
      alturas: Float64Array.from(new Array(n).fill(0)),
      objetos: [],
      trilhos: [],
      checkpoints: [0],
      chegadaX: comprimentoM,
      hash: 'teste',
      ...extra,
    };
  }
  const CMD_NADA: ComandoDescida = { pulo: false, giro: 0, grab: null, agachar: false };
  const CMD_PULO: ComandoDescida = { pulo: true, giro: 0, grab: null, agachar: false };

  it('no começo a pontuação é 0 e o combo está vazio', () => {
    const motor = criarDescida(pistaPlana(60));
    const l0 = motor.leitura();
    expect(l0.pontos).toBe(0);
    expect(l0.combo).toMatchObject({ ativo: false, soma: 0, mult: 1 });
  });

  it('grind num trilho pontua uma manobra, fecha o combo e a pontuação sobe acima de 0', () => {
    const motor = criarDescida(pistaPlana(60, { trilhos: [{ x0: 0.5, x1: 15, altura: 0.4 }] }));
    for (let i = 0; i < 40; i++) motor.processar(CMD_NADA);
    motor.processar(CMD_PULO);

    const tipos: string[] = [];
    let manobraTrilho = false;
    let fechou = false;
    let pontosFinais = 0;
    let l = motor.leitura();
    for (let i = 0; i < 3000 && l.fase !== 'chegou'; i++) {
      l = motor.processar(CMD_NADA);
      for (const e of l.eventos) {
        tipos.push(e.tipo);
        if (e.tipo === 'manobra' && e.id === 'trilho') manobraTrilho = true;
        if (e.tipo === 'combo-fechado') fechou = true;
      }
      if (l.pontos > pontosFinais) pontosFinais = l.pontos;
    }

    expect(tipos).toContain('trilho'); // entrou/saiu do trilho
    expect(manobraTrilho).toBe(true); // o grind virou manobra pontuada
    expect(fechou).toBe(true); // o combo fechou (janela esgotou no chão)
    expect(pontosFinais).toBeGreaterThan(0); // pontuação real, não mais placeholder 0
  });

  it('o combo fica ATIVO durante o grind e só soma à pontuação ao fechar', () => {
    const motor = criarDescida(pistaPlana(60, { trilhos: [{ x0: 0.5, x1: 15, altura: 0.4 }] }));
    for (let i = 0; i < 40; i++) motor.processar(CMD_NADA);
    let l = motor.processar(CMD_PULO);
    let viuComboAtivoComPontosZero = false;
    for (let i = 0; i < 3000 && l.fase !== 'chegou'; i++) {
      l = motor.processar(CMD_NADA);
      if (l.combo.ativo && l.combo.soma > 0 && l.pontos === 0) viuComboAtivoComPontosZero = true;
    }
    // Enquanto o combo está aberto, a soma vive no combo (não na pontuação) — ela só migra no fechamento.
    expect(viuComboAtivoComPontosZero).toBe(true);
  });

  it('(regressão) o AÉREO pontua: um salto com bastante tempo de ar emite manobra id "ar"', () => {
    // Bug achado pelo Apolo: `p.ticksNoAr = 0` rodava ANTES de `commitarVoo`, então o aéreo dava sempre 0.
    // Ladeira -20° pra ganhar velocidade + um "penhasco" (queda de 50 m): o salto sobre a borda garante segundos de ar.
    const incl = Math.tan((20 * Math.PI) / 180);
    const n = 401; // 200 m
    const alturas = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const x = i * 0.5;
      alturas[i] = x <= 40 ? -x * incl : -40 * incl - 50 - (x - 40) * incl;
    }
    const pista: PistaGerada = {
      id: 'penhasco',
      semente: 1,
      versaoGerador: 'teste',
      dx: 0.5,
      alturas,
      objetos: [],
      trilhos: [],
      checkpoints: [0],
      chegadaX: 150,
      hash: 'teste',
    };
    const motor = criarDescida(pista);
    let l = motor.leitura();
    for (let i = 0; i < 3000 && l.piloto.x < 35; i++) l = motor.processar(CMD_NADA); // ganha velocidade
    l = motor.processar(CMD_PULO); // salta perto da borda do penhasco
    let arManobra = false;
    for (let i = 0; i < 600 && l.fase !== 'chegou'; i++) {
      l = motor.processar(CMD_NADA);
      if (l.eventos.some((e) => e.tipo === 'manobra' && e.id === 'ar')) arManobra = true;
    }
    expect(arManobra).toBe(true);
  });
});
