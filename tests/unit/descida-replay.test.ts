/**
 * Replay C6: determinismo (record -> encode -> decode -> replay bate `hashFinal`) e o driver de reprodução do
 * fantasma (`criarReprodutorFantasma`). Mesmo padrão de `descida-bot-harness.test.ts`: o bot "cuidadoso" dirige o
 * motor REAL até a chegada, sem UI.
 */
import { describe, expect, it } from 'vitest';
import type { ComandoDescida, ReplayV1 } from '../../src/core/contratos';
import { codificarComandos, decodificarComandos, validarReplayV1 } from '../../src/core/replay';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { CONFIG_PADRAO, VERSAO_MOTOR } from '../../src/descida/constantes';
import { criarDescida } from '../../src/descida/motor';
import { criarReprodutorFantasma } from '../../src/descida/replay';
import { exigirPistaValida } from '../../src/pista/gerador';

const MAX_TICKS = 16_200; // 270 s: generoso, mesmo teto do harness do bot.

interface DescidaCompleta {
  readonly comandos: readonly ComandoDescida[];
  readonly pontos: number;
  readonly ticks: number;
  readonly hashFinal: string;
}

/** Desce `PISTA_MORRO_DO_PINHAO` com o bot "cuidadoso" até a chegada (ou lança, se não concluir no teto do teste). */
function descerComBot(): DescidaCompleta {
  const pista = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
  const motor = criarDescida(pista);
  const bot = criarBotCuidadoso(pista);
  const comandos: ComandoDescida[] = [];
  let leitura = motor.leitura();
  for (let i = 0; i < MAX_TICKS; i++) {
    const cmd = bot(leitura);
    comandos.push(cmd);
    leitura = motor.processar(cmd);
    if (leitura.fase === 'chegou') break;
  }
  if (leitura.fase !== 'chegou') throw new Error('bot não concluiu a pista no teto de ticks deste teste');
  return { comandos, pontos: leitura.pontos, ticks: leitura.tick, hashFinal: motor.hashEstado() };
}

function montarReplay(descida: DescidaCompleta): ReplayV1 {
  const pista = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
  return {
    v: 1,
    pista: pista.id,
    hashPista: pista.hash,
    semente: pista.semente,
    personagem: 'capi',
    versaoMotor: VERSAO_MOTOR,
    comandos: codificarComandos(descida.comandos),
    resultado: { pontos: descida.pontos, ticks: descida.ticks, hashFinal: descida.hashFinal },
  };
}

describe('replay C6: determinismo (record -> encode -> decode -> replay)', () => {
  it('reexecutar os comandos decodificados dá o MESMO hashFinal, pontos e tick da gravação', () => {
    const descida = descerComBot();
    const replay = montarReplay(descida);
    expect(validarReplayV1(replay).ok).toBe(true);

    const decodificado = decodificarComandos(replay.comandos);
    expect(decodificado.ok).toBe(true);
    if (!decodificado.ok) return;
    expect(decodificado.valor).toHaveLength(descida.comandos.length);

    const pista = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
    const motor2 = criarDescida(pista);
    let leitura2 = motor2.leitura();
    for (const cmd of decodificado.valor) leitura2 = motor2.processar(cmd);

    expect(motor2.hashEstado()).toBe(replay.resultado.hashFinal);
    expect(leitura2.pontos).toBe(replay.resultado.pontos);
    expect(leitura2.tick).toBe(replay.resultado.ticks);
    expect(leitura2.fase).toBe('chegou');
  });

  it('um comando alterado no meio da corrida muda o hashFinal (prova que a reexecução de fato lê o conteúdo)', () => {
    const descida = descerComBot();
    const replay = montarReplay(descida);
    const decodificado = decodificarComandos(replay.comandos);
    if (!decodificado.ok) throw new Error('decodificação falhou');

    // `agachar` muda o atrito no chão (`motor.ts`): ao contrário de `giro` (só tem efeito no ar), um toque altera a
    // velocidade naquele tick e o erro se acumula posição a posição até a chegada — mudança garantida de hash.
    const alterados = [...decodificado.valor];
    const indice = 5;
    const original = alterados[indice] as ComandoDescida;
    alterados[indice] = { ...original, agachar: !original.agachar };

    const pista = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
    const motor2 = criarDescida(pista);
    for (const cmd of alterados) motor2.processar(cmd);

    expect(motor2.hashEstado()).not.toBe(replay.resultado.hashFinal);
  });
});

describe('criarReprodutorFantasma (driver de playback do fantasma)', () => {
  it('reproduz EXATAMENTE a mesma trajetória (x,y por tick) da gravação original, e termina em null', () => {
    const pistaOriginal = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
    const motorOriginal = criarDescida(pistaOriginal);
    const bot = criarBotCuidadoso(pistaOriginal);
    const comandos: ComandoDescida[] = [];
    const trajetoria: Array<{ x: number; y: number; pose: string }> = [];
    let leitura = motorOriginal.leitura();
    for (let i = 0; i < MAX_TICKS; i++) {
      const cmd = bot(leitura);
      comandos.push(cmd);
      leitura = motorOriginal.processar(cmd);
      trajetoria.push({ x: leitura.piloto.x, y: leitura.piloto.y, pose: leitura.piloto.pose });
      if (leitura.fase === 'chegou') break;
    }
    expect(leitura.fase).toBe('chegou');

    const replay: ReplayV1 = {
      v: 1,
      pista: pistaOriginal.id,
      hashPista: pistaOriginal.hash,
      semente: pistaOriginal.semente,
      personagem: 'capi',
      versaoMotor: VERSAO_MOTOR,
      comandos: codificarComandos(comandos),
      resultado: { pontos: leitura.pontos, ticks: leitura.tick, hashFinal: motorOriginal.hashEstado() },
    };

    // Pista gerada de NOVO (nova instância, mesma semente): prova que o fantasma não depende de reaproveitar
    // o objeto da pista original, só da semente/hash gravados no replay.
    const pistaNova = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
    const r = criarReprodutorFantasma(replay, pistaNova, CONFIG_PADRAO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    const reprodutor = r.valor;
    for (const esperado of trajetoria) {
      const obtido = reprodutor.avancar();
      expect(obtido).not.toBeNull();
      expect(obtido?.x).toBe(esperado.x);
      expect(obtido?.y).toBe(esperado.y);
      expect(obtido?.pose).toBe(esperado.pose);
    }
    expect(reprodutor.avancar()).toBeNull();
    expect(reprodutor.avancar()).toBeNull(); // idempotente depois de acabar
  });

  it('rejeita (sem lançar) um replay de outra pista ou com hashPista divergente', () => {
    const pista = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
    const base: ReplayV1 = {
      v: 1,
      pista: pista.id,
      hashPista: pista.hash,
      semente: pista.semente,
      personagem: 'capi',
      versaoMotor: VERSAO_MOTOR,
      comandos: codificarComandos([]),
      resultado: { pontos: 0, ticks: 0, hashFinal: '0'.repeat(16) },
    };

    expect(criarReprodutorFantasma({ ...base, pista: 'outra-pista' }, pista, CONFIG_PADRAO).ok).toBe(false);
    expect(criarReprodutorFantasma({ ...base, hashPista: '1'.repeat(16) }, pista, CONFIG_PADRAO).ok).toBe(false);
  });

  it('rejeita (sem lançar) um replay com versaoMotor incompatível, a menos que seja v1 da capi', () => {
    const pista = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
    const base: ReplayV1 = {
      v: 1,
      pista: pista.id,
      hashPista: pista.hash,
      semente: pista.semente,
      personagem: 'capi',
      versaoMotor: VERSAO_MOTOR,
      comandos: codificarComandos([]),
      resultado: { pontos: 0, ticks: 0, hashFinal: '0'.repeat(16) },
    };

    // v1 de outro personagem: a física dele pode ter mudado entre v1 e v2 (M3 §A.3) -> rejeita.
    expect(criarReprodutorFantasma({ ...base, versaoMotor: '1', personagem: 'beto' }, pista, CONFIG_PADRAO).ok).toBe(false);
    // v1 da própria capi: a física dela não mudou -> aceita.
    expect(criarReprodutorFantasma({ ...base, versaoMotor: '1', personagem: 'capi' }, pista, CONFIG_PADRAO).ok).toBe(true);
    // versão desconhecida, de qualquer personagem: rejeita.
    expect(criarReprodutorFantasma({ ...base, versaoMotor: '0' }, pista, CONFIG_PADRAO).ok).toBe(false);
  });

  it('rejeita (sem lançar) comandos ilegíveis', () => {
    const pista = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
    const replayRuim: ReplayV1 = {
      v: 1,
      pista: pista.id,
      hashPista: pista.hash,
      semente: pista.semente,
      personagem: 'capi',
      versaoMotor: VERSAO_MOTOR,
      comandos: '!!!nao-e-base64!!!',
      resultado: { pontos: 0, ticks: 0, hashFinal: '0'.repeat(16) },
    };
    expect(criarReprodutorFantasma(replayRuim, pista, CONFIG_PADRAO).ok).toBe(false);
  });
});
