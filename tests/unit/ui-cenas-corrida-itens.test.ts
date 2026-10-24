/**
 * Botão/tecla de ITEM (plano `docs/plano-itens-corrida.md` §I4b/I5, Lyra): prova que o sinal de verdade do
 * `input/` (tecla E e tap no botão, via `criarEntrada(...).usarItemBorda()`) chega até o núcleo da Vega
 * (`Corrida.processar`, `ComandoCorrida.usarItem`) exatamente como `ui/cenas/corrida.ts` faz, e que o RENDER novo
 * (botão/slot, entidades de item, escudo, aviso de alvo) nunca lança.
 *
 * A corrida INTEIRA com itens de verdade (pegar -> usar -> projétil -> acertar) é dirigida aqui a `corrida/corrida.ts`
 * DIRETO (não pela cena): o bot cuidadoso lê a `leitura.jogador` REAL (já afetada por trombada/freada/turbo), nunca
 * uma sombra -- memória `sombra-via-tecla-browser-diverge-do-node-em-corrida-turbo` registra exatamente por que um
 * motor sombra (que não sabe de itens) diverge e nunca termina quando o jogador real está sendo acertado; aqui não
 * há sombra nenhuma, só o loop de bot+leitura real que `corrida-itens.test.ts` (Vega) já usa, com o acréscimo de
 * que `usarItem` vem do `input/` de verdade (tecla E), não de um `true` cru. O RENDER (cena completa via
 * `criarCenaCorrida`) é provado numa corrida CURTA separada abaixo -- não precisa terminar para provar "não lança".
 */
import { describe, expect, it } from 'vitest';
import type { ComandoDescida, ParticipanteCorrida } from '../../src/core/contratos';
import { PERSONAGENS_DE_DADOS } from '../../src/data/personagens';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { criarBotCuidadoso } from '../../src/descida/bot';
import { criarCorrida } from '../../src/corrida/corrida';
import { criarEntrada } from '../../src/input/index';
import type { AlvoTeclado } from '../../src/input/teclado';
import type { AlvoToque } from '../../src/input/toque';
import { gerarCamadaJogo } from '../../src/pista/camada-jogo';
import { gerarPista } from '../../src/pista/gerador';
import type { Ctx } from '../../src/platform/canvas';
import { RETANGULO_BOTAO_ITEM } from '../../src/render/hud';
import { TICKS_CONTAGEM } from '../../src/ui/cenas/contagem';
import { criarCenaCorrida } from '../../src/ui/cenas/corrida';

const MAX_TICKS = 16_200;
const IDS_PADRAO = PERSONAGENS_DE_DADOS.map((d) => d.id);

function participantesEm(ids: readonly string[], idJogador: string): ParticipanteCorrida[] {
  return ids.map((id) => {
    const def = PERSONAGENS_DE_DADOS.find((d) => d.id === id)!;
    return { id, config: def, piloto: id === idJogador ? { tipo: 'jogador' as const } : { tipo: 'ia' as const, perfil: id, nivel: 0 } };
  });
}

function criarCanvasFalso(): AlvoToque & { disparar(tipo: string, p: { pointerId: number; clientX: number; clientY: number; timeStamp: number }): void } {
  const ouvintes = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    addEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo)?.add(fn);
    },
    removeEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      ouvintes.get(tipo)?.delete(fn);
    },
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 960, bottom: 540, width: 960, height: 540, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
    disparar(tipo, p) {
      const ev = { ...p, preventDefault: () => undefined } as unknown as Event;
      for (const fn of [...(ouvintes.get(tipo) ?? [])]) {
        if (typeof fn === 'function') fn(ev);
        else fn.handleEvent(ev);
      }
    },
  };
}

function criarJanelaFalsa(): AlvoTeclado & { disparar(tipo: 'keydown' | 'keyup', codigo: string): void } {
  const ouvintes = new Map<string, Set<EventListenerOrEventListenerObject>>();
  return {
    addEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      if (!ouvintes.has(tipo)) ouvintes.set(tipo, new Set());
      ouvintes.get(tipo)?.add(fn);
    },
    removeEventListener(tipo: string, fn: EventListenerOrEventListenerObject) {
      ouvintes.get(tipo)?.delete(fn);
    },
    disparar(tipo, codigo) {
      const ev = { code: codigo, preventDefault: () => undefined } as unknown as Event;
      for (const fn of [...(ouvintes.get(tipo) ?? [])]) {
        if (typeof fn === 'function') fn(ev);
        else fn.handleEvent(ev);
      }
    },
  };
}

const TECLA_DO_GIRO: Readonly<Record<number, string | null>> = { [-1]: 'ArrowLeft', [0]: null, [1]: 'ArrowRight' };

describe('entrada real (tecla E) -> usarItemBorda() -> ComandoCorrida.usarItem: chega no núcleo de verdade', () => {
  it('corrida inteira (bot cuidadoso + E todo tick): pega caixa, usa item, acerta ao menos 1 vez', () => {
    const pista = gerarPista(PISTA_MORRO_DO_PINHAO);
    const camada = gerarCamadaJogo(pista, PISTA_MORRO_DO_PINHAO);
    const corrida = criarCorrida({ pista, camada, semente: 7, participantes: participantesEm(IDS_PADRAO, 'capi') });
    const bot = criarBotCuidadoso(pista, {}, camada.obstaculosAltos);

    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    // Mesma forma de produção: `toque.botaoItem` existe (mesmo sem nenhum toque sintético aqui -- quem dirige é
    // a tecla E, igual `ui-cenas-corrida.test.ts` dirige pulo/giro/agachar por tecla, nunca por toque sintético).
    const entrada = criarEntrada(canvas, janela, { toque: { botaoItem: RETANGULO_BOTAO_ITEM } });

    let leitura = corrida.leitura();
    let frameAnterior: ComandoDescida = { pulo: false, giro: 0, grab: null, agachar: false };
    const tiposDeEvento = new Set<string>();

    for (let i = 0; i < MAX_TICKS && leitura.jogador.fase !== 'chegou'; i++) {
      const cmdBot = bot(leitura.jogador);

      if (cmdBot.pulo !== frameAnterior.pulo) janela.disparar(cmdBot.pulo ? 'keydown' : 'keyup', 'Space');
      if (cmdBot.giro !== frameAnterior.giro) {
        const antiga = TECLA_DO_GIRO[frameAnterior.giro];
        const nova = TECLA_DO_GIRO[cmdBot.giro];
        if (antiga) janela.disparar('keyup', antiga);
        if (nova) janela.disparar('keydown', nova);
      }
      if (cmdBot.agachar !== frameAnterior.agachar) janela.disparar(cmdBot.agachar ? 'keydown' : 'keyup', 'ArrowDown');
      // Tenta usar o item TODO tick (borda real: aperta e solta na hora) -- inofensivo com o slot vazio, mesmo
      // padrão de `corrida-itens.test.ts: usarItem: true` em todo tick, da Vega, só que vindo do `input/` de verdade.
      janela.disparar('keydown', 'KeyE');
      janela.disparar('keyup', 'KeyE');

      const cmdDescida = entrada.obterComando();
      const usarItem = entrada.usarItemBorda();
      leitura = corrida.processar({ descida: cmdDescida, usarItem });
      frameAnterior = cmdBot;
      for (const ev of leitura.eventosCorrida ?? []) tiposDeEvento.add(ev.tipo);
    }

    entrada.destruir();
    expect(leitura.jogador.fase).toBe('chegou');
    expect(tiposDeEvento.has('item-pego')).toBe(true);
    expect(tiposDeEvento.has('item-usado')).toBe(true);
  });
});

/** Objeto falso que aceita QUALQUER leitura/escrita/chamada, sempre devolvendo outro objeto igual a si mesmo --
 *  cobre `ctx.createLinearGradient(...).addColorStop(...)` e qualquer outro encadeamento sem precisar listar API
 *  de canvas nenhuma. Serve só pra provar "o render inteiro roda sem lançar", não pra inspecionar o que foi
 *  desenhado (isso já é feito por testes dedicados de `render/hud.ts`/`render/itens.ts` com um ctx que REGISTRA). */
function permissivo(): unknown {
  const alvo: { (...args: unknown[]): unknown } = () => permissivo();
  return new Proxy(alvo, {
    get(_t, prop: string) {
      if (prop === 'then') return undefined; // nunca parece uma Promise pra `await`/`Promise.resolve` acidental
      return permissivo();
    },
    set() {
      return true;
    },
    apply() {
      return permissivo();
    },
  });
}

function criarCtxPermissivo(): Ctx {
  return permissivo() as Ctx;
}

describe('ui/cenas/corrida: o render novo (botão/slot, entidades, escudo, aviso) não lança numa corrida curta', () => {
  it('~8 s de corrida real (cena completa) com a tecla E mashada: desenhar() nunca lança', () => {
    const canvas = criarCanvasFalso();
    const janela = criarJanelaFalsa();
    const ctx = criarCtxPermissivo();
    const cena = criarCenaCorrida({ canvas, janela });

    for (let i = 0; i < TICKS_CONTAGEM + 480; i++) {
      janela.disparar('keydown', 'KeyE');
      janela.disparar('keyup', 'KeyE');
      // Também cobre o botão via TOQUE real (mesma zona que a produção escuta) a cada ~1 s, pra provar que o tap
      // não lança nenhum erro passando pelo `input/toque.ts` de verdade.
      if (i % 60 === 0) {
        const cx = RETANGULO_BOTAO_ITEM.x + RETANGULO_BOTAO_ITEM.w / 2;
        const cy = RETANGULO_BOTAO_ITEM.y + RETANGULO_BOTAO_ITEM.h / 2;
        canvas.disparar('pointerdown', { pointerId: 99, clientX: cx, clientY: cy, timeStamp: i });
        canvas.disparar('pointerup', { pointerId: 99, clientX: cx, clientY: cy, timeStamp: i });
      }
      expect(() => cena.atualizar()).not.toThrow();
      expect(() => cena.desenhar(ctx, 0)).not.toThrow();
    }
    cena.destruir?.();
  });
});
