/**
 * `criarSomContagem` (src/audio/som-contagem.ts): um beep por número da contagem "3-2-1-JÁ", acionado pelo MESMO
 * contador de ticks que `ui/cenas/contagem.ts` usa pra decidir o texto (`TICKS_POR_NUMERO`/`TICKS_JA` — aqui
 * duplicados de propósito, ver cabeçalho do arquivo).
 */
import { describe, expect, it } from 'vitest';
import { AudioDestravavel } from '../../src/audio/audio-destravavel';
import { criarSomContagem } from '../../src/audio/som-contagem';
import { TICKS_CONTAGEM, textoDaContagem } from '../../src/ui/cenas/contagem';
import { criarContextoSinteseFalso, type ContextoSinteseFalso } from '../support/audio-falso';

function montar(volumeInicial = 1): { falso: ContextoSinteseFalso; som: ReturnType<typeof criarSomContagem>; volume: { v: number } } {
  const falso = criarContextoSinteseFalso();
  const audio = new AudioDestravavel(() => falso.ctx);
  audio.init();
  const volume = { v: volumeInicial };
  const som = criarSomContagem(audio, { obterVolumeSom: () => volume.v });
  return { falso, som, volume };
}

it('toca exatamente 1 beep por número, nos 4 degraus, nunca mais que isso ao longo de toda a contagem', () => {
  const { falso, som } = montar();
  for (let t = 1; t <= TICKS_CONTAGEM; t += 1) som.atualizar(t);
  // 3, 2, 1 (1 oscilador cada) + "JÁ!" (2 osciladores, mais brilhante) = 5
  expect(falso.osciladores).toHaveLength(5);
});

it('cada beep acontece exatamente no mesmo tick em que o TEXTO muda (sincronizado com `textoDaContagem`)', () => {
  const { falso, som } = montar();
  let textoAnterior = '';
  const ticksComBeep: number[] = [];
  for (let t = 1; t <= TICKS_CONTAGEM; t += 1) {
    const antes = falso.osciladores.length;
    som.atualizar(t);
    if (falso.osciladores.length > antes) ticksComBeep.push(t);
    const { texto } = textoDaContagem(t);
    if (texto !== textoAnterior) {
      textoAnterior = texto;
      expect(ticksComBeep[ticksComBeep.length - 1]).toBe(t);
    }
  }
  expect(ticksComBeep).toHaveLength(4);
});

it('"3" "2" "1" sobem de tom; "JÁ!" é o mais agudo e ganha uma 2ª camada (brilho)', () => {
  const { falso, som } = montar();
  for (let t = 1; t <= TICKS_CONTAGEM; t += 1) som.atualizar(t);
  const f0s = falso.osciladores.map((o) => o.f0 as number);
  expect(f0s[0] as number).toBeLessThan(f0s[1] as number);
  expect(f0s[1] as number).toBeLessThan(f0s[2] as number);
  expect(f0s[2] as number).toBeLessThan(f0s[3] as number);
});

it('chamar com o mesmo degrau repetidas vezes (vários frames no mesmo número) não dobra o beep', () => {
  const { falso, som } = montar();
  som.atualizar(1);
  som.atualizar(2);
  som.atualizar(3);
  expect(falso.osciladores).toHaveLength(1);
});

it('fora da janela da contagem (0 ou depois do total): nenhum beep', () => {
  const { falso, som } = montar();
  som.atualizar(0);
  som.atualizar(TICKS_CONTAGEM + 1);
  expect(falso.osciladores).toHaveLength(0);
});

describe('volume e contexto', () => {
  it('cfg.som = 0: nenhum som é criado', () => {
    const { falso, som, volume } = montar();
    volume.v = 0;
    for (let t = 1; t <= TICKS_CONTAGEM; t += 1) som.atualizar(t);
    expect(falso.osciladores).toHaveLength(0);
  });

  it('antes do 1º gesto (ctx ainda null): não lança e não cria nada', () => {
    const falso = criarContextoSinteseFalso();
    const audio = new AudioDestravavel(() => falso.ctx);
    const som = criarSomContagem(audio, { obterVolumeSom: () => 1 });
    expect(() => som.atualizar(1)).not.toThrow();
    expect(falso.osciladores).toHaveLength(0);
  });
});
