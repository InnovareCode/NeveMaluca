/**
 * `criarDescida(..., { camada, modo })` lendo a camada de jogo DE VERDADE (plano `docs/plano-corrida-campeonato.md`
 * §Arquitetura, C3): kicker estende o impulso do pulo, itens são coletados e contados, turbo de pouso só em modo
 * 'corrida' e só quando o voo valeu pontos. Sempre comparado contra o mesmo cenário SEM o ingrediente testado, para
 * provar que é aquele ingrediente (e não ruído) que muda o resultado.
 */
import { describe, expect, it } from 'vitest';
import type { CamadaJogo, ComandoDescida } from '../../src/core/contratos';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { CONFIG_PADRAO } from '../../src/descida/constantes';
import { criarDescida } from '../../src/descida/motor';
import { gerarPista } from '../../src/pista/gerador';

const CMD_PULO: ComandoDescida = { pulo: true, giro: 0, grab: null, agachar: false };
const CMD_NADA: ComandoDescida = { pulo: false, giro: 0, grab: null, agachar: false };
const SEM_CAMADA: CamadaJogo = { itens: [], kickers: [], obstaculosAltos: [], porticoX: 0, versao: '1', hash: '0000000000000000' };

describe('motor + camada: kicker estende o impulso do pulo', () => {
  it('pular dentro da zona do kicker dá MAIS força que pular sem camada (mesmo ponto da pista)', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const comKicker: CamadaJogo = { ...SEM_CAMADA, kickers: [{ x: 0, largura: 5, impulsoMs: 11 }] };

    const semCamada = criarDescida(pista, CONFIG_PADRAO);
    const leituraSem = semCamada.processar(CMD_PULO);
    const comCamada = criarDescida(pista, CONFIG_PADRAO, { camada: comKicker });
    const leituraCom = comCamada.processar(CMD_PULO);

    expect(leituraCom.eventos.find((e) => e.tipo === 'pulo')).toMatchObject({ tipo: 'pulo' });
    const forcaSem = leituraSem.eventos.find((e) => e.tipo === 'pulo') as { forca: number };
    const forcaCom = leituraCom.eventos.find((e) => e.tipo === 'pulo') as { forca: number };
    expect(forcaCom.forca).toBeCloseTo(forcaSem.forca + 11, 6);
  });

  it('fora da zona do kicker, o pulo é igual ao de sempre', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const kickerLonge: CamadaJogo = { ...SEM_CAMADA, kickers: [{ x: 500, largura: 2, impulsoMs: 11 }] };
    const semCamada = criarDescida(pista, CONFIG_PADRAO).processar(CMD_PULO);
    const comCamada = criarDescida(pista, CONFIG_PADRAO, { camada: kickerLonge }).processar(CMD_PULO);
    expect(comCamada).toEqual(semCamada);
  });
});

describe('motor + camada: coleta de itens', () => {
  it('item bem na frente do piloto (chão, x=0) é coletado no 1º tick: evento "coleta" + coletados=1', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const camada: CamadaJogo = { ...SEM_CAMADA, itens: [{ tipo: 'floco', x: 0, y: pista.alturas[0] as number, raio: 1.5 }] };
    const motor = criarDescida(pista, CONFIG_PADRAO, { camada });
    const leitura = motor.processar(CMD_NADA);
    expect(leitura.coletados).toBe(1);
    expect(leitura.eventos).toContainEqual({ tipo: 'coleta', item: 'floco' });
  });

  it('o mesmo item nunca é coletado duas vezes (fica parado sobre ele vários ticks)', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const camada: CamadaJogo = { ...SEM_CAMADA, itens: [{ tipo: 'floco', x: 0, y: pista.alturas[0] as number, raio: 1.5 }] };
    const motor = criarDescida(pista, CONFIG_PADRAO, { camada });
    let leitura = motor.processar(CMD_NADA);
    for (let i = 0; i < 10; i++) leitura = motor.processar(CMD_NADA);
    expect(leitura.coletados).toBe(1);
  });

  it('item fora do raio nunca é coletado: coletados fica 0', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const camada: CamadaJogo = { ...SEM_CAMADA, itens: [{ tipo: 'floco', x: 850, y: 999, raio: 0.5 }] };
    const motor = criarDescida(pista, CONFIG_PADRAO, { camada });
    let leitura = motor.leitura();
    for (let i = 0; i < 200 && leitura.fase !== 'chegou'; i++) leitura = motor.processar(CMD_NADA);
    expect(leitura.coletados).toBe(0);
  });
});

describe('motor + camada: turbo de pouso (C-D7)', () => {
  /** Kicker grande o bastante para o ar passar de `AR_LIMIAR_TICKS` (0,5 s): sem girar, já pontua "ar" (manobra). */
  const CAMADA_COM_AR_BONUS: CamadaJogo = { ...SEM_CAMADA, kickers: [{ x: 0, largura: 5, impulsoMs: 20 }] };

  /** Pula, deixa o giro em 0 (sem risco de tombo por ângulo) e processa até o 1º `'pouso'`. */
  function pousarComArBonus(modo: 'treino' | 'corrida', camada: CamadaJogo): number {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const motor = criarDescida(pista, CONFIG_PADRAO, { camada, modo });
    let leitura = motor.processar(CMD_PULO);
    for (let i = 0; i < 300; i++) {
      leitura = motor.processar(CMD_NADA);
      if (leitura.eventos.some((e) => e.tipo === 'pouso')) return leitura.piloto.velocidade;
    }
    throw new Error('não pousou dentro do teto de ticks deste teste');
  }

  it('em modo corrida, pousar bem depois de ganhar ar (manobra) dá MAIS velocidade do que em modo treino', () => {
    const treino = pousarComArBonus('treino', CAMADA_COM_AR_BONUS);
    const corrida = pousarComArBonus('corrida', CAMADA_COM_AR_BONUS);
    expect(corrida).toBeGreaterThan(treino);
  });

  it('sem manobra nenhuma (ar curto, abaixo do limiar que pontua "ar"), o turbo não dá nada: corrida === treino', () => {
    const treino = pousarComArBonus('treino', SEM_CAMADA); // pulo normal (sem kicker): ar curto, 0 ponto de manobra.
    const corrida = pousarComArBonus('corrida', SEM_CAMADA);
    expect(corrida).toBeCloseTo(treino, 6);
  });

  it('um tombo zera o turbo acumulado (plano: "cair continua custando caro")', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const motor = criarDescida(pista, CONFIG_PADRAO, { camada: CAMADA_COM_AR_BONUS, modo: 'corrida' });
    motor.processar(CMD_PULO);
    // Gira sem soltar: na física padrão isso sempre tomba por ângulo torto (prova indireta, mas estável aqui).
    let leitura = motor.leitura();
    for (let i = 0; i < 300 && leitura.fase !== 'tombo'; i++) leitura = motor.processar({ pulo: false, giro: 1, grab: null, agachar: false });
    expect(leitura.fase).toBe('tombo');
    // Processa exatamente até o tick do respawn (fase volta a 'descendo') e confere a velocidade NAQUELE tick —
    // depois dele a física normal (ladeira) já volta a acelerar, então não serve medir turbo mais adiante.
    while (leitura.fase === 'tombo') leitura = motor.processar(CMD_NADA);
    expect(leitura.fase).toBe('descendo');
    expect(leitura.piloto.velocidade).toBeCloseTo(CONFIG_PADRAO.velocidadeRespawnMs, 3);
  });
});
