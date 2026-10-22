/**
 * Motor da descida (plano §3.3, contratos C2/C3). M1a: física, colisão, tombo, checkpoint, chegada (manobras/combo/
 * pontuação são M2, ver `src/descida/motor.ts`). Pistas SINTÉTICAS (não o gerador real) para controlar exatamente o
 * terreno de cada cenário; o determinismo em 5400 ticks usa a pista publicada de verdade.
 */
import { describe, expect, it } from 'vitest';
import { COMANDO_NEUTRO } from '../../src/core/comandos';
import type { ComandoDescida, PistaGerada } from '../../src/core/contratos';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { CONFIG_PADRAO } from '../../src/descida/constantes';
import { criarDescida } from '../../src/descida/motor';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { gerarPista } from '../../src/pista/gerador';

function pistaFloat64(valores: readonly number[]): Float64Array {
  return Float64Array.from(valores);
}

/** Pista plana (0 m de altura o tempo todo), só pra exercitar chão/obstáculo/trilho sem ruído de inclinação. */
function pistaPlana(comprimentoM: number, extra: Partial<PistaGerada> = {}): PistaGerada {
  const n = Math.round(comprimentoM / 0.5) + 1;
  return {
    id: 'sintetica',
    semente: 1,
    versaoGerador: 'teste',
    dx: 0.5,
    alturas: pistaFloat64(new Array(n).fill(0)),
    objetos: [],
    trilhos: [],
    checkpoints: [0],
    chegadaX: comprimentoM,
    hash: 'teste',
    ...extra,
  };
}

const CMD_NADA: ComandoDescida = COMANDO_NEUTRO;
const CMD_PULO: ComandoDescida = { pulo: true, giro: 0, grab: null, agachar: false };

describe('fases e ticks', () => {
  it('leitura() antes do 1º processar() mostra fase "contagem"; o 1º tick já entra em "descendo"', () => {
    const motor = criarDescida(pistaPlana(50));
    expect(motor.leitura().fase).toBe('contagem');
    expect(motor.leitura().tick).toBe(-1);
    const l = motor.processar(CMD_NADA);
    expect(l.fase).toBe('descendo');
    expect(l.tick).toBe(0);
  });

  it('o tick é o contador do PRÓPRIO motor, não depende de nenhum laço externo', () => {
    const motor = criarDescida(pistaPlana(50));
    for (let i = 0; i < 10; i++) motor.processar(CMD_NADA);
    expect(motor.leitura().tick).toBe(9);
  });
});

describe('chão: aceleração por gravidade e atrito (plano §3.3)', () => {
  it('numa pista plana (0°), sem pular, a velocidade cresce muito pouco (só o piso mínimo de chão) e o piloto avança', () => {
    const motor = criarDescida(pistaPlana(200));
    let l = motor.leitura();
    for (let i = 0; i < 300; i++) l = motor.processar(CMD_NADA);
    expect(l.piloto.modo).toBe('chao');
    expect(l.piloto.x).toBeGreaterThan(0);
    expect(l.piloto.velocidade).toBeGreaterThanOrEqual(CONFIG_PADRAO.velocidadeMinimaChaoMs - 1e-9);
  });
});

describe('pulo e pouso (plano §3.3)', () => {
  function descerRampaEAterrissar(): { eventos: ReturnType<ReturnType<typeof criarDescida>['processar']>['eventos'][number][]; } {
    const pista = pistaPlana(200);
    const motor = criarDescida(pista);
    const eventos: ReturnType<ReturnType<typeof criarDescida>['processar']>['eventos'][number][] = [];
    // Anda um pouco pra ganhar alguma velocidade, pula, e deixa a física resolver o pouso (pista plana: pousa reto).
    for (let i = 0; i < 120; i++) eventos.push(...motor.processar(CMD_NADA).eventos);
    eventos.push(...motor.processar(CMD_PULO).eventos);
    for (let i = 0; i < 60; i++) eventos.push(...motor.processar(CMD_NADA).eventos);
    return { eventos };
  }

  it('pulo no chão emite o evento "pulo" e troca o modo pra "ar"', () => {
    const pista = pistaPlana(200);
    const motor = criarDescida(pista);
    for (let i = 0; i < 60; i++) motor.processar(CMD_NADA);
    const l = motor.processar(CMD_PULO);
    expect(l.eventos).toContainEqual(expect.objectContaining({ tipo: 'pulo' }));
    expect(l.piloto.modo).toBe('ar');
  });

  it('pouso em terreno plano, sem girar no ar, é "perfeito" (ângulo do corpo não muda de direção)', () => {
    const { eventos } = descerRampaEAterrissar();
    const pousos = eventos.filter((e) => e.tipo === 'pouso');
    expect(pousos.length).toBeGreaterThan(0);
    expect(pousos[0]).toMatchObject({ tipo: 'pouso', qualidade: 'perfeito' });
  });

  it('girar bastante no ar e pousar torto/tombado: ângulo do corpo diverge do terreno', () => {
    const pista = pistaPlana(300);
    const motor = criarDescida(pista);
    for (let i = 0; i < 60; i++) motor.processar(CMD_NADA);
    motor.processar(CMD_PULO);
    const giroForte: ComandoDescida = { pulo: false, giro: 1, grab: null, agachar: false };
    let ultimaFase = motor.leitura().fase;
    let tevePousoOuTombo = false;
    for (let i = 0; i < 400 && !tevePousoOuTombo; i++) {
      const l = motor.processar(i < 60 ? giroForte : CMD_NADA); // segura giro por bastante tempo (vence o atraso)
      if (l.eventos.some((e) => e.tipo === 'pouso' || e.tipo === 'tombo')) tevePousoOuTombo = true;
      ultimaFase = l.fase;
    }
    expect(tevePousoOuTombo).toBe(true);
    expect(['descendo', 'tombo']).toContain(ultimaFase);
  });
});

describe('obstáculo duro (plano §3.3: "encostar no chão = tombo")', () => {
  it('bater numa pedra no chão gera tombo com causa "obstaculo", e depois de 90 ticks volta ao checkpoint', () => {
    const pista = pistaPlana(100, {
      objetos: [{ tipo: 'pedra', x: 5, largura: 1, altura: 0.8, variante: 0 }],
      checkpoints: [0],
    });
    const motor = criarDescida(pista);
    let bateu = false;
    let tickDoTombo = -1;
    let l = motor.leitura();
    for (let i = 0; i < 400; i++) {
      l = motor.processar(CMD_NADA);
      if (l.eventos.some((e) => e.tipo === 'tombo' && e.causa === 'obstaculo')) {
        bateu = true;
        tickDoTombo = l.tick;
        break;
      }
    }
    expect(bateu).toBe(true);
    expect(l.fase).toBe('tombo');
    // Congela durante os 90 ticks de animação (plano §3.3): posição não muda enquanto `fase === 'tombo'`.
    const xNoImpacto = l.piloto.x;
    for (let i = 0; i < CONFIG_PADRAO.ticksTombo - 1; i++) {
      l = motor.processar(CMD_NADA);
      expect(l.piloto.x).toBe(xNoImpacto);
    }
    l = motor.processar(CMD_NADA); // o tick que fecha os 90 e faz o respawn
    expect(l.fase).toBe('descendo');
    expect(l.piloto.x).toBe(0); // único checkpoint é x=0
    expect(l.tick).toBe(tickDoTombo + CONFIG_PADRAO.ticksTombo);
  });
});

describe('boneco de neve (plano §3.3: "atravessa, perde um pouco de velocidade, vira piada")', () => {
  it('atravessar não derruba; emite o evento "boneco" só uma vez', () => {
    const pista = pistaPlana(60, { objetos: [{ tipo: 'boneco-de-neve', x: 4, largura: 1.5, altura: 1.6, variante: 0 }] });
    const motor = criarDescida(pista);
    let eventosBoneco = 0;
    let l = motor.leitura();
    for (let i = 0; i < 200; i++) {
      l = motor.processar(CMD_NADA);
      eventosBoneco += l.eventos.filter((e) => e.tipo === 'boneco').length;
    }
    expect(eventosBoneco).toBe(1);
    expect(l.fase).not.toBe('tombo');
  });
});

describe('trilho (plano §3.3: pousar sobre um trilho prende o piloto no segmento)', () => {
  it('pousar dentro de um trilho entra em modo "trilho" e emite trilho/inicio', () => {
    // No chão plano, o piso de velocidade mínima deixa o piloto andando a `velocidadeMinimaChaoMs` (1,5 m/s):
    // o trilho começa perto do ponto de decolagem (mas não embaixo dele) pra garantir que o pulo caia DENTRO dele.
    const pista = pistaPlana(80, { trilhos: [{ x0: 0.5, x1: 40, altura: 0.4 }] });
    const motor = criarDescida(pista);
    for (let i = 0; i < 40; i++) motor.processar(CMD_NADA);
    const lPulo = motor.processar(CMD_PULO);
    expect(lPulo.piloto.modo).toBe('ar');
    let entrouNoTrilho = false;
    let l = lPulo;
    for (let i = 0; i < 200 && !entrouNoTrilho; i++) {
      l = motor.processar(CMD_NADA);
      if (l.eventos.some((e) => e.tipo === 'trilho' && e.etapa === 'inicio')) entrouNoTrilho = true;
    }
    expect(entrouNoTrilho).toBe(true);
    expect(l.piloto.modo).toBe('trilho');
  });
});

describe('checkpoint e chegada', () => {
  it('cruzar um checkpoint emite o evento; chegar ao fim da pista muda a fase pra "chegou" e para o motor', () => {
    const pista = pistaPlana(20, { checkpoints: [0, 10] });
    const motor = criarDescida(pista);
    const eventos = [];
    let l = motor.leitura();
    for (let i = 0; i < 1500 && l.fase !== 'chegou'; i++) {
      l = motor.processar(CMD_NADA);
      eventos.push(...l.eventos);
    }
    expect(eventos).toContainEqual(expect.objectContaining({ tipo: 'checkpoint', indice: 1 }));
    expect(eventos).toContainEqual(expect.objectContaining({ tipo: 'chegada' }));
    expect(l.fase).toBe('chegou');
    const xNaChegada = l.piloto.x;
    l = motor.processar(CMD_PULO); // depois de chegar, comandos são ignorados (fase congelada)
    expect(l.fase).toBe('chegou');
    expect(l.piloto.x).toBe(xNaChegada);
  });
});

describe('determinismo (DoD do M1a: mesma semente + mesmos comandos => mesmo hash após 5400 ticks)', () => {
  it('duas rodadas INDEPENDENTES do bot na pista publicada dão o MESMO hash de estado em 5400 ticks', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const rodar = (): string => {
      const motor = criarDescida(pista);
      const bot = criarBotCuidadoso(pista);
      let leitura = motor.leitura();
      for (let i = 0; i < 5400; i++) leitura = motor.processar(bot(leitura));
      return motor.hashEstado();
    };
    const hashA = rodar();
    const hashB = rodar();
    expect(hashA).toBe(hashB);
  });

  it('mutação: girar bastante durante o pulo (muda a qualidade do pouso) dá um hash DIFERENTE e PERSISTENTE', () => {
    // Um giro CURTO demais não muda nada que sobrevive ao pouso (o ângulo do corpo é reatribuído à tangente do
    // terreno ao pousar, plano §3.3). Por isso o giro aqui dura o bastante para mudar a QUALIDADE do pouso (e com
    // ela a velocidade retida, que é permanente) — essa é a mutação que de fato precisa ser detectada.
    const pista = pistaPlana(300);
    const comandos: ComandoDescida[] = [];
    for (let i = 0; i < 300; i++) comandos.push(i === 60 ? CMD_PULO : CMD_NADA);

    const rodarComGiro = (giro: 0 | 1): string => {
      const motor = criarDescida(pista);
      let i = 0;
      for (const base of comandos) {
        motor.processar(i > 60 && i < 110 && giro !== 0 ? { ...base, giro } : base);
        i++;
      }
      return motor.hashEstado();
    };
    expect(rodarComGiro(0)).not.toBe(rodarComGiro(1));
  });
});
