/**
 * Núcleo de itens na corrida (`docs/plano-itens-corrida.md` §Núcleo, I2): caixas reais plantadas por
 * `pista/camada-jogo.ts`, slot único, sorteio sem estado e o tick em 2 fases de `corrida/corrida.ts` — prova que a
 * interação entre corredores (1ª vez que um afeta o outro no projeto) continua determinística, inclusive com a
 * ORDEM dos participantes permutada (plano §Determinismo: "a ordem não pode mudar o resultado").
 */
import { describe, expect, it } from 'vitest';
import type { ComandoCorrida, ParticipanteCorrida } from '../../src/core/contratos';
import { PERSONAGENS_DE_DADOS } from '../../src/data/personagens';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { VERSAO_MOTOR } from '../../src/descida/constantes';
import { gerarCamadaJogo } from '../../src/pista/camada-jogo';
import { gerarPista } from '../../src/pista/gerador';
import { criarCorrida } from '../../src/corrida/corrida';
import { codificarComandosCorrida, decodificarComandosCorrida } from '../../src/corrida/itens';
import { FORMATO_HASH } from '../../src/core/hash';

const MAX_TICKS = 16200; // mesmo teto generoso do golden do F0 e dos harnesses de bot/corrida.
const IDS_PADRAO = PERSONAGENS_DE_DADOS.map((d) => d.id);

function participantesEm(ids: readonly string[], idJogador: string): ParticipanteCorrida[] {
  return ids.map((id) => {
    const def = PERSONAGENS_DE_DADOS.find((d) => d.id === id)!;
    return { id, config: def, piloto: id === idJogador ? { tipo: 'jogador' as const } : { tipo: 'ia' as const, perfil: id, nivel: 0 } };
  });
}

/** Pista + camada do Morro, geradas 1x (mesmo padrão do harness: o bot cuidadoso PRECISA de `obstaculosAltos`
 *  pra agachar nos galhos — sem passar isso, ele bate sempre no mesmo e fica preso no respawn do checkpoint,
 *  nada a ver com itens). */
function prepararMorro() {
  const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
  const camada = gerarCamadaJogo(pista, PISTA_MORRO_DO_PINHAO);
  return { pista, camada };
}

describe('corrida + itens: caixas reais (I-D5), slot (I-D4) e uso', () => {
  it('o jogador pega ao menos 1 caixa e usa ao menos 1 item na pista oficial do Morro', () => {
    const { pista, camada } = prepararMorro();
    const corrida = criarCorrida({ pista, camada, semente: 7, participantes: participantesEm(IDS_PADRAO, 'capi') });
    const bot = criarBotCuidadoso(pista, {}, camada.obstaculosAltos);
    let leitura = corrida.leitura();
    const tiposDeEvento = new Set<string>();
    for (let i = 0; i < MAX_TICKS && leitura.jogador.fase !== 'chegou'; i++) {
      // Tenta usar o item em TODO tick: inofensivo com o slot vazio (a 1ª caixa só aparece depois de uns metros).
      leitura = corrida.processar({ descida: bot(leitura.jogador), usarItem: true });
      for (const ev of leitura.eventosCorrida ?? []) tiposDeEvento.add(ev.tipo);
    }
    expect(leitura.jogador.fase).toBe('chegou');
    expect(tiposDeEvento.has('item-pego')).toBe(true);
    expect(tiposDeEvento.has('item-usado')).toBe(true);
  });
});

describe('corrida + itens: determinismo com a ORDEM dos participantes permutada', () => {
  it('mesma semente, mesmos comandos do jogador, ordem de `participantes` invertida => mesmo ResultadoCorrida e mesmo hashEstado', () => {
    const { pista, camada } = prepararMorro();

    function rodar(ordem: readonly string[]) {
      const corrida = criarCorrida({ pista, camada, semente: 99, participantes: participantesEm(ordem, 'capi') });
      const bot = criarBotCuidadoso(pista, {}, camada.obstaculosAltos);
      let leitura = corrida.leitura();
      for (let i = 0; i < MAX_TICKS && leitura.jogador.fase !== 'chegou'; i++) {
        leitura = corrida.processar({ descida: bot(leitura.jogador), usarItem: true });
      }
      const hashNaChegada = corrida.hashEstado();
      const resultado = corrida.finalizar();
      return { resultado, hashNaChegada };
    }

    const ordemA = IDS_PADRAO;
    const ordemB = [...IDS_PADRAO].reverse();
    const a = rodar(ordemA);
    const b = rodar(ordemB);

    expect(a.resultado).toEqual(b.resultado);
    expect(a.hashNaChegada).toBe(b.hashNaChegada);
  });
});

describe('corrida + itens: IA usa item e desvia (plano itens-corrida §Fases, I3)', () => {
  it('jogador NUNCA usa item (usarItem:false sempre); ainda assim rivais pegam caixa, usam item, acertam/bloqueiam/desviam', () => {
    const { pista, camada } = prepararMorro();
    const bot = criarBotCuidadoso(pista, {}, camada.obstaculosAltos);
    const tiposDeEventoDeRival = new Set<string>();
    let algumaCorridaComUsoRival = false;

    for (let semente = 1; semente <= 6; semente++) {
      const corrida = criarCorrida({ pista, camada, semente, participantes: participantesEm(IDS_PADRAO, 'capi') });
      let leitura = corrida.leitura();
      let usoRivalNestaCorrida = false;
      for (let i = 0; i < MAX_TICKS && leitura.jogador.fase !== 'chegou'; i++) {
        leitura = corrida.processar({ descida: bot(leitura.jogador), usarItem: false });
        for (const ev of leitura.eventosCorrida ?? []) {
          const idEnvolvido = 'id' in ev ? ev.id : ev.de;
          if (idEnvolvido !== 'capi') {
            tiposDeEventoDeRival.add(ev.tipo);
            usoRivalNestaCorrida = true;
          }
        }
      }
      expect(leitura.jogador.fase, `semente ${semente}: jogador não chegou`).toBe('chegou');
      corrida.finalizar();
      if (usoRivalNestaCorrida) algumaCorridaComUsoRival = true;
    }

    expect(algumaCorridaComUsoRival).toBe(true);
    expect(tiposDeEventoDeRival.has('item-usado'), `tipos vistos: ${[...tiposDeEventoDeRival].join(',')}`).toBe(true);
  });

  it('determinismo: a decisão da IA de usar item (mesma semente) não muda entre 2 corridas do zero', () => {
    const { pista, camada } = prepararMorro();
    const bot = criarBotCuidadoso(pista, {}, camada.obstaculosAltos);

    function rodar() {
      const corrida = criarCorrida({ pista, camada, semente: 11, participantes: participantesEm(IDS_PADRAO, 'capi') });
      let leitura = corrida.leitura();
      const eventos: string[] = [];
      for (let i = 0; i < MAX_TICKS && leitura.jogador.fase !== 'chegou'; i++) {
        leitura = corrida.processar({ descida: bot(leitura.jogador), usarItem: false });
        for (const ev of leitura.eventosCorrida ?? []) eventos.push(JSON.stringify(ev));
      }
      return { eventos, hash: corrida.hashEstado(), resultado: corrida.finalizar() };
    }

    const a = rodar();
    const b = rodar();
    expect(b.eventos).toEqual(a.eventos);
    expect(b.hash).toBe(a.hash);
    expect(b.resultado).toEqual(a.resultado);
  });
});

describe('corrida + itens: grava e reproduz 1 ReplayV2 com itens', () => {
  it('codifica os `ComandoCorrida` do jogador (bit 7 = usarItem), decodifica, roda de novo do zero e bate o hashEstado final', () => {
    const { pista, camada } = prepararMorro();
    const semente = 2026;
    const idJogador = 'capi';
    const participantes = participantesEm(IDS_PADRAO, idJogador);

    // Corrida "ao vivo": grava o `ComandoCorrida` de cada tick do jogador.
    const corridaOriginal = criarCorrida({ pista, camada, semente, participantes });
    const bot = criarBotCuidadoso(pista, {}, camada.obstaculosAltos);
    const comandos: ComandoCorrida[] = [];
    let leitura = corridaOriginal.leitura();
    for (let i = 0; i < MAX_TICKS && leitura.jogador.fase !== 'chegou'; i++) {
      const cmd: ComandoCorrida = { descida: bot(leitura.jogador), usarItem: true };
      comandos.push(cmd);
      leitura = corridaOriginal.processar(cmd);
    }
    expect(leitura.jogador.fase).toBe('chegou');
    const hashFinalOriginal = corridaOriginal.hashEstado();

    // Forma de um `ReplayV2` com itens (plano §Contratos: `versaoItens` presente = `comandos` codificado pelo byte
    // de 8 bits de `corrida/itens.ts`, NÃO pelo `codificarComandos`/`validarReplayV2` genéricos de `core/replay.ts`
    // — aqueles continuam estritos ao byte de 7 bits, de propósito (bit 7 reservado/0 fora daqui). Um validador de
    // replay-com-itens de fora é trabalho futuro (I3+: `ui/cenas/corrida.ts` ainda não grava nada), fora desta
    // fase — aqui a prova é o round-trip do CODEC em si, que é o que `corrida/itens.ts` fixa na I2.
    const comandosCodificados = codificarComandosCorrida(comandos);
    const replay = {
      v: 2 as const,
      pista: pista.id,
      hashPista: pista.hash,
      semente,
      personagem: idJogador,
      versaoMotor: VERSAO_MOTOR,
      comandos: comandosCodificados,
      resultado: { pontos: leitura.jogador.pontos, ticks: leitura.jogador.tick, hashFinal: hashFinalOriginal },
      modo: 'corrida' as const,
      niveis: {},
      corrida: { semente, rivais: IDS_PADRAO.filter((id) => id !== idJogador) },
      versaoItens: '1',
    };
    expect(FORMATO_HASH.test(replay.hashPista)).toBe(true);
    expect(FORMATO_HASH.test(replay.resultado.hashFinal)).toBe(true);

    const decodificado = decodificarComandosCorrida(replay.comandos);
    expect(decodificado.ok).toBe(true);
    if (!decodificado.ok) return;
    expect(decodificado.valor).toHaveLength(comandos.length);

    // Reproduz do ZERO (2ª `Corrida`, mesma semente/pista/participantes) alimentada pelos comandos decodificados.
    const corridaReproduzida = criarCorrida({ pista, camada, semente, participantes });
    let leituraReproduzida = corridaReproduzida.leitura();
    for (const cmd of decodificado.valor) leituraReproduzida = corridaReproduzida.processar(cmd);

    expect(leituraReproduzida.jogador.fase).toBe('chegou');
    expect(corridaReproduzida.hashEstado()).toBe(hashFinalOriginal);
  });
});
