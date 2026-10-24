/**
 * `criarDescida(...).processar(cmd, efeitos?)` (plano `docs/plano-itens-corrida.md` §I1): efeitos externos
 * (trombada/freada/turbo/ima) vindos do orquestrador da corrida (`corrida/`, ainda não escrito — I2), nunca do
 * próprio `ComandoDescida`. Omitido (como todo chamador de hoje faz, incluindo o golden de
 * `m3-congelamento-capi.test.ts`) é, por construção, idêntico ao comportamento de sempre — mesmo padrão de
 * `OpcoesDescida` provado em `descida-motor-opcoes.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import type { CamadaJogo, ComandoDescida } from '../../src/core/contratos';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { CONFIG_PADRAO } from '../../src/descida/constantes';
import { criarDescida } from '../../src/descida/motor';
import { gerarPista } from '../../src/pista/gerador';

const CMD_NADA: ComandoDescida = { pulo: false, giro: 0, grab: null, agachar: false };
const CMD_PULO: ComandoDescida = { pulo: true, giro: 0, grab: null, agachar: false };
const SEM_CAMADA: CamadaJogo = { itens: [], kickers: [], obstaculosAltos: [], caixas: [], porticoX: 0, versao: '1', hash: '0000000000000000' };

describe('motor + itens: efeitos omitido/vazio não muda nada (golden)', () => {
  it('omitir efeitos e passar [] dão EXATAMENTE o mesmo resultado (hash/pontos/ticks), descida completa com o bot cuidadoso', () => {
    function descer(passarArrayVazio: boolean) {
      const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
      const motor = criarDescida(pista, CONFIG_PADRAO);
      const bot = criarBotCuidadoso(pista);
      let leitura = motor.leitura();
      for (let i = 0; i < 16200 && leitura.fase !== 'chegou'; i++) {
        const cmd = bot(leitura);
        leitura = passarArrayVazio ? motor.processar(cmd, []) : motor.processar(cmd);
      }
      return { hashFinal: motor.hashEstado(), pontos: leitura.pontos, ticks: leitura.tick };
    }
    expect(descer(true)).toEqual(descer(false));
  });
});

describe('motor + itens: trombada', () => {
  it('corta a velocidade a ~50% (PARAMETROS_TROMBADA_ITEM.fator, data/itens.ts), emite "atingido" (não "tombo"), não respawna/reseta posição', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const motor = criarDescida(pista, CONFIG_PADRAO);
    let l = motor.leitura();
    for (let i = 0; i < 40; i++) l = motor.processar(CMD_NADA);
    const vAntes = l.piloto.velocidade;
    const xAntes = l.piloto.x;
    expect(vAntes).toBeGreaterThan(0);

    l = motor.processar(CMD_NADA, [{ tipo: 'trombada', item: 'bola' }]);

    expect(l.eventos).toContainEqual({ tipo: 'atingido', item: 'bola' });
    expect(l.eventos.some((e) => e.tipo === 'tombo')).toBe(false);
    expect(l.fase).toBe('descendo');
    expect(l.piloto.velocidade).toBeGreaterThan(vAntes * 0.45);
    expect(l.piloto.velocidade).toBeLessThan(vAntes * 0.55);
    expect(l.piloto.x).toBeGreaterThanOrEqual(xAntes); // nunca volta pro checkpoint (plano I-D7)
  });

  it('trava giro/grab por um bom tempo; pulo e agachar continuam livres', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const motor = criarDescida(pista, CONFIG_PADRAO);
    for (let i = 0; i < 40; i++) motor.processar(CMD_NADA);
    motor.processar(CMD_NADA, [{ tipo: 'trombada', item: 'nuvem' }]);

    const lPulo = motor.processar(CMD_PULO);
    expect(lPulo.piloto.modo).toBe('ar'); // pulo não é afetado pela trava

    const anguloNoPulo = lPulo.piloto.angulo;
    for (let i = 0; i < 10; i++) {
      const l = motor.processar({ pulo: false, giro: 1, grab: 'cima', agachar: false });
      expect(l.piloto.grab).toBeNull(); // grab ignorado
      expect(l.piloto.angulo).toBe(anguloNoPulo); // giro nunca acelera enquanto atordoado: ângulo no ar não muda
    }
  });

  it('perde o combo ativo (evento "combo-perdido"), mas sem tombar nem voltar ao checkpoint', () => {
    // Pista sintética plana + kicker gigante: pulo vertical garantido o bastante pra pontuar "ar" e pousar
    // "perfeito" no mesmo x (sem deslocamento horizontal) — combo fica ATIVO e ABERTO ao aterrissar.
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const camada: CamadaJogo = { ...SEM_CAMADA, kickers: [{ x: 0, largura: pista.chegadaX, impulsoMs: 60 }] };
    const motor = criarDescida(pista, CONFIG_PADRAO, { camada });
    let l = motor.processar(CMD_PULO);
    expect(l.piloto.modo).toBe('ar');
    let pousou = false;
    for (let i = 0; i < 1000 && !pousou; i++) {
      l = motor.processar(CMD_NADA);
      if (l.eventos.some((e) => e.tipo === 'pouso')) pousou = true;
    }
    expect(pousou).toBe(true);
    expect(l.combo.ativo).toBe(true); // pré-condição do teste: sem isto, "perde combo" não prova nada
    const xAntes = l.piloto.x;

    l = motor.processar(CMD_NADA, [{ tipo: 'trombada', item: 'bola' }]);

    expect(l.eventos.map((e) => e.tipo)).toEqual(expect.arrayContaining(['combo-perdido', 'atingido']));
    expect(l.combo.ativo).toBe(false);
    expect(l.fase).toBe('descendo');
    expect(l.piloto.x).toBeGreaterThanOrEqual(xAntes);
  });
});

describe('motor + itens: freada', () => {
  it('reduz o teto de velocidade por `ticks` ticks (fração `fator`), depois libera de novo', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const motor = criarDescida(pista, CONFIG_PADRAO);
    let l = motor.leitura();
    for (let i = 0; i < 600; i++) l = motor.processar(CMD_NADA);
    const vAntes = l.piloto.velocidade;
    expect(vAntes).toBeGreaterThan(CONFIG_PADRAO.velocidadeMaxMs * 0.5); // pré-condição: já perto do teto normal

    l = motor.processar(CMD_NADA, [{ tipo: 'freada', item: 'poca', fator: 0.3, ticks: 20 }]);
    let vMinDuranteFreada = l.piloto.velocidade;
    for (let i = 0; i < 19; i++) {
      l = motor.processar(CMD_NADA);
      if (l.piloto.velocidade < vMinDuranteFreada) vMinDuranteFreada = l.piloto.velocidade;
    }
    expect(vMinDuranteFreada).toBeLessThan(vAntes * 0.5);

    for (let i = 0; i < 600; i++) l = motor.processar(CMD_NADA); // janela esgotou: acelera de novo
    expect(l.piloto.velocidade).toBeGreaterThan(vMinDuranteFreada);
  });

  it('não trava controle nem perde combo (mais leve que a trombada: armadilha de chão, não acerto direto)', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const motor = criarDescida(pista, CONFIG_PADRAO);
    for (let i = 0; i < 40; i++) motor.processar(CMD_NADA);
    const l = motor.processar(CMD_NADA, [{ tipo: 'freada', item: 'poca', fator: 0.3, ticks: 20 }]);
    expect(l.eventos.some((e) => e.tipo === 'combo-perdido')).toBe(false);
    // sem trombada, giro/grab seguem livres: pular e segurar grab no ar funciona normalmente.
    const lPulo = motor.processar(CMD_PULO);
    const lGrab = motor.processar({ pulo: false, giro: 0, grab: 'cima', agachar: false });
    expect(lPulo.piloto.modo).toBe('ar');
    expect(lGrab.piloto.grab).not.toBeNull();
  });
});

describe('motor + itens: turbo (reusa a MESMA calibragem do turbo de pouso, C-D7)', () => {
  it('soma `ms` à velocidade e ao teto, visível em modo "corrida"', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const motor = criarDescida(pista, CONFIG_PADRAO, { modo: 'corrida' });
    let l = motor.leitura();
    for (let i = 0; i < 5; i++) l = motor.processar(CMD_NADA);
    const vAntes = l.piloto.velocidade;

    l = motor.processar(CMD_NADA, [{ tipo: 'turbo', item: 'turbo', ms: 5, ticks: 120 }]);

    expect(l.eventos.some((e) => e.tipo === 'atingido')).toBe(false); // buff próprio, nunca "atingido"
    expect(l.piloto.velocidade).toBeGreaterThan(vAntes + 3);
  });
});

describe('motor + itens: ima', () => {
  it('é inerte nesta camada (física/hash iguais a não receber efeito algum) — a atração real é do orquestrador (I2)', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const comIma = criarDescida(pista, CONFIG_PADRAO);
    const semEfeito = criarDescida(pista, CONFIG_PADRAO);
    let viuAtingido = false;
    for (let i = 0; i < 40; i++) {
      const l = comIma.processar(CMD_NADA, [{ tipo: 'ima', item: 'ima', raioM: 5, ticks: 30 }]);
      if (l.eventos.some((e) => e.tipo === 'atingido')) viuAtingido = true;
      semEfeito.processar(CMD_NADA);
    }
    expect(viuAtingido).toBe(false);
    expect(comIma.hashEstado()).toBe(semEfeito.hashEstado());
  });
});

describe('motor + itens: hashEstado só muda quando o efeito vem', () => {
  it('dois motores idênticos divergem no hash só depois de um deles receber um efeito', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const motorA = criarDescida(pista, CONFIG_PADRAO);
    const motorB = criarDescida(pista, CONFIG_PADRAO);
    for (let i = 0; i < 40; i++) {
      motorA.processar(CMD_NADA);
      motorB.processar(CMD_NADA);
    }
    expect(motorA.hashEstado()).toBe(motorB.hashEstado());

    motorA.processar(CMD_NADA, [{ tipo: 'trombada', item: 'bola' }]);
    motorB.processar(CMD_NADA);

    expect(motorA.hashEstado()).not.toBe(motorB.hashEstado());
  });
});
