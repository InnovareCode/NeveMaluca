/**
 * e2e do fantasma (replay C6, M2/M3): completa uma descida em 'morro-do-pinhao' pelo GERENCIADOR real da app
 * (não uma `criarCenaDescida` isolada, ver `ui-descida-fantasma.test.ts`/`ui-gerenciador-replay.test.ts`, que já
 * cobrem isso em Node) — só assim o fluxo passa por `registrarResultadoDescida` de verdade e grava recorde +
 * fantasma no save real, exposto pelo gancho de dev `window.__neve` (só existe no servidor de dev, ver
 * `tests/README.md`). Confirma que o save ganha `fantasmas['morro-do-pinhao']`, entra de NOVO na mesma pista e
 * prova, no ctx 2D de VERDADE (não um dublê), que o fantasma foi injetado e desenhado translúcido
 * (`globalAlpha = 0.4`, o bloco do fantasma em `ui/cenas/descida.ts`).
 *
 * Técnica de condução igual a `descida-m1a.spec.ts`/`ui-gerenciador-replay.test.ts`: um motor "sombra" (mesma
 * pista, mesma semente) roda em lockstep só para alimentar `criarBotCuidadoso` (reflexo puro da Vega sobre
 * `LeituraDescida`); o comando decidido vira teclas REAIS (Espaço/←/→/↓) despachadas em `window`, que a cena de
 * descida real lê pelo `input/` de verdade — nunca inventamos física própria.
 *
 * `__neve.laco.pausar(...)`: o laço real (rAF) do `main.ts` roda em paralelo à app assim que a página carrega.
 * Sem pausá-lo, ele ticaria por conta própria *entre* uma chamada de `page.evaluate` e a outra (tempo real
 * passa aí), inclusive com teclas sintéticas "presas" no meio do caminho. Pausado, SÓ as chamadas manuais de
 * `cena.atualizar()` avançam a simulação dentro de cada `page.evaluate` — determinístico de ponta a ponta,
 * igual ao que os testes unitários já fazem em Node.
 */
import { expect, test } from '@playwright/test';

/** Forma do gancho de dev que importa para este teste (ver `src/main.ts`, linha do `window.__neve`). */
interface NeveHook {
  readonly laco: { pausar(motivo: string): void };
  readonly cena: {
    irPara(id: 'abertura' | 'menu' | 'jogo' | 'opcoes' | 'selecao'): void;
    atualizar(): void;
    desenhar(ctx: CanvasRenderingContext2D, alpha: number): void;
    cenaAtual: () => string;
  };
  readonly canvas: HTMLCanvasElement;
  readonly save: { readonly dados: SaveLike };
}

interface SaveLike {
  readonly recordes: Record<string, readonly { readonly pontos: number }[] | undefined>;
  readonly fantasmas?: Record<string, unknown>;
}

const PISTA_ID = 'morro-do-pinhao';
const LIMITE_TICKS = 16_200; // mesmo teto generoso do harness do bot (270 s), igual aos testes unitários do C6

test.describe('Fantasma (replay C6): grava na 1ª descida, injeta e reproduz na 2ª', () => {
  test('1ª descida grava o fantasma no save; 2ª descida na mesma pista injeta e desenha o fantasma translúcido', async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000); // duas corridas "de verdade" (bot até a chegada) + render instrumentado; folga sobre os 30s padrão

    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));

    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');

    // Pausa o laço real e instrumenta o ctx 2D de VERDADE (o mesmo canvas#jogo da app), guardando o histórico de
    // `globalAlpha` em `window.__e2eAlpha` — sobrevive entre chamadas de `page.evaluate` (mesma página, sem navegar
    // de novo). Shadow da própria instância do ctx (não do prototype): não afeta nenhum outro teste/página.
    await page.evaluate(() => {
      const neve = (window as unknown as { __neve: NeveHook }).__neve;
      neve.laco.pausar('e2e-fantasma');

      const ctx = neve.canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
      const proto = Object.getPrototypeOf(ctx) as object;
      const original = Object.getOwnPropertyDescriptor(proto, 'globalAlpha');
      if (!original?.get || !original.set) throw new Error('ctx 2D sem accessor globalAlpha no prototype (navegador inesperado)');
      const historico: number[] = [];
      Object.defineProperty(ctx, 'globalAlpha', {
        configurable: true,
        get: () => (original.get as () => number).call(ctx),
        set: (v: number) => {
          historico.push(v);
          (original.set as (x: number) => void).call(ctx, v);
        },
      });
      (window as unknown as { __e2eCtx: CanvasRenderingContext2D; __e2eAlpha: number[] }).__e2eCtx = ctx;
      (window as unknown as { __e2eCtx: CanvasRenderingContext2D; __e2eAlpha: number[] }).__e2eAlpha = historico;
    });

    const primeira = await test.step('1ª descida: bot cuidadoso dirige a cena real até a chegada', () =>
      page.evaluate(
        async ({ pistaId, limiteTicks }) => {
          const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
          const { derivarComando, INPUT_NEUTRO } = await carregar('/src/core/comandos.ts');
          const { criarDescida } = await carregar('/src/descida/motor.ts');
          const { criarBotCuidadoso } = await carregar('/src/descida/bot.ts');
          const { exigirPistaValida, gerarCamadaJogo } = await carregar('/src/pista/index.ts');
          const { PISTA_MORRO_DO_PINHAO } = await carregar('/src/data/pistas.ts');
          const { TICKS_CONTAGEM_DESCIDA } = await carregar('/src/ui/cenas/descida.ts');

          const neve = (window as unknown as { __neve: NeveHook }).__neve;
          neve.cena.irPara('jogo'); // ainda sem fantasma desta pista: `construirCena('jogo')` lê `obterFantasma` AGORA

          const pistaSombra = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
          // Camada de jogo (plano corrida-campeonato §C3/C4): `ui/cenas/descida.ts` passa `camada` -- a sombra
          // precisa da MESMA (pura/determinística) pra não tombar num obstáculo que ela não sabia existir.
          const camadaSombra = gerarCamadaJogo(pistaSombra, PISTA_MORRO_DO_PINHAO);
          const motorSombra = criarDescida(pistaSombra, undefined, { camada: camadaSombra });
          const bot = criarBotCuidadoso(pistaSombra, undefined, camadaSombra.obstaculosAltos);
          let leituraSombra = motorSombra.leitura();
          let frameAnterior = INPUT_NEUTRO;
          const teclaDoGiro: Record<number, string | null> = { [-1]: 'ArrowLeft', 0: null, 1: 'ArrowRight' };
          let alphaSemFantasma: number[] = [];

          let ticks = 0;
          for (; ticks < limiteTicks && (neve.save.dados.recordes[pistaId]?.length ?? 0) === 0; ticks++) {
            if (ticks < TICKS_CONTAGEM_DESCIDA) {
              // A cena está na contagem "3-2-1-JÁ": não tica nem dirige o motor sombra, só a cena mesmo
              // (ela própria não tica o motor real nesta janela — ver `ui/cenas/descida.ts`).
              neve.cena.atualizar();
              continue;
            }
            const cmdBot = bot(leituraSombra);
            const frame = { pular: cmdBot.pulo, giro: cmdBot.giro, grab: cmdBot.grab, agachar: cmdBot.agachar };

            if (frame.pular !== frameAnterior.pular) {
              window.dispatchEvent(new KeyboardEvent(frame.pular ? 'keydown' : 'keyup', { code: 'Space' }));
            }
            if (frame.giro !== frameAnterior.giro) {
              const antiga = teclaDoGiro[frameAnterior.giro];
              const nova = teclaDoGiro[frame.giro];
              if (antiga) window.dispatchEvent(new KeyboardEvent('keyup', { code: antiga }));
              if (nova) window.dispatchEvent(new KeyboardEvent('keydown', { code: nova }));
            }
            if (frame.agachar !== frameAnterior.agachar) {
              window.dispatchEvent(new KeyboardEvent(frame.agachar ? 'keydown' : 'keyup', { code: 'ArrowDown' }));
            }

            leituraSombra = motorSombra.processar(derivarComando(frameAnterior, frame));
            neve.cena.atualizar();
            frameAnterior = frame;

            // checkpoint "sem fantasma": no 6º tick (ainda sem fantasma desta pista), 1 quadro desenhado não
            // deveria passar por globalAlpha=0.4 (mesma prova que `ui-descida-fantasma.test.ts` faz com ctx
            // falso, aqui com o ctx real) — medido DENTRO do laço do bot (sem ticks "neutros" fora do lockstep
            // real/sombra, que tiravam a corrida do lockstep e fizeram o bot nunca chegar na 1ª versão deste teste).
            if (ticks === TICKS_CONTAGEM_DESCIDA + 5) {
              neve.cena.desenhar((window as unknown as { __e2eCtx: CanvasRenderingContext2D }).__e2eCtx, 0);
              const historico = (window as unknown as { __e2eAlpha: number[] }).__e2eAlpha;
              alphaSemFantasma = [...historico];
              historico.length = 0;
            }
          }

          // solta qualquer tecla ainda "presa" (higiene; a 2ª corrida usa uma `Entrada` nova, que nasce neutra
          // de qualquer forma, mas assim nenhum keyup fica devendo se algo mais tarde ouvir a janela real).
          if (frameAnterior.pular) window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
          const teclaFinal = teclaDoGiro[frameAnterior.giro];
          if (teclaFinal) window.dispatchEvent(new KeyboardEvent('keyup', { code: teclaFinal }));
          if (frameAnterior.agachar) window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowDown' }));

          return {
            ticks,
            alphaSemFantasma,
            pontos: neve.save.dados.recordes[pistaId]?.[0]?.pontos ?? null,
            qtdRecordes: neve.save.dados.recordes[pistaId]?.length ?? 0,
            fantasmaBruto: neve.save.dados.fantasmas?.[pistaId] ?? null,
          };
        },
        { pistaId: PISTA_ID, limiteTicks: LIMITE_TICKS },
      ));

    expect(primeira.ticks, 'bot não completou a pista no teto de ticks deste teste').toBeLessThan(LIMITE_TICKS);
    expect(primeira.qtdRecordes).toBe(1);
    expect(primeira.pontos).not.toBeNull();
    expect(primeira.alphaSemFantasma, 'sem fantasma ainda, nenhum quadro deveria passar por globalAlpha=0.4').not.toContain(0.4);
    expect(primeira.fantasmaBruto, "save.fantasmas['morro-do-pinhao'] deveria existir após a 1ª descida (#1 da pista)").not.toBeNull();

    // O fantasma gravado é um ReplayV1 de verdade (forma, limites, pista/pontos coerentes com o recorde) — não só
    // "um objeto qualquer" no save.
    const fantasmaValidado = await page.evaluate(async ({ pistaId, pontosEsperados }) => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { validarReplayV1 } = await carregar('/src/core/replay.ts');
      const neve = (window as unknown as { __neve: NeveHook }).__neve;
      const r = validarReplayV1(neve.save.dados.fantasmas?.[pistaId]);
      if (!r.ok) return { ok: false as const };
      return { ok: true as const, pista: r.valor.pista, pontosBatem: r.valor.resultado.pontos === pontosEsperados };
    }, { pistaId: PISTA_ID, pontosEsperados: primeira.pontos });
    expect(fantasmaValidado.ok).toBe(true);
    if (fantasmaValidado.ok) {
      expect(fantasmaValidado.pista).toBe(PISTA_ID);
      expect(fantasmaValidado.pontosBatem).toBe(true);
    }

    // Persistiu no disco (localStorage), não só em memória — mesma convenção de `selecao-personagem.spec.ts`.
    const noDisco = await page.evaluate((pistaId: string) => {
      const bruto = localStorage.getItem('neve-maluca-v1');
      const dados = bruto ? (JSON.parse(bruto) as { fantasmas?: Record<string, unknown> }) : null;
      return Boolean(dados?.fantasmas?.[pistaId]);
    }, PISTA_ID);
    expect(noDisco, 'o fantasma deveria estar no localStorage, não só no save em memória').toBe(true);

    // 2ª entrada na MESMA pista: sair de 'jogo' primeiro é obrigatório — `trocar()` no gerenciador é no-op quando
    // o id pedido já é o atual, e só `construirCena('jogo')` relê `obterFantasma` (a 1ª corrida nunca saiu de
    // 'jogo', só trocou de sub-cena descida->resultado por dentro). Isso é o próprio contrato do Vega: o
    // fantasma só é recarregado ao RE-ENTRAR na cena 'jogo', não durante "jogar de novo" (reiniciar).
    const segunda = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { TICKS_CONTAGEM_DESCIDA } = await carregar('/src/ui/cenas/descida.ts');

      const neve = (window as unknown as { __neve: NeveHook }).__neve;
      neve.cena.irPara('menu');
      neve.cena.irPara('jogo'); // agora relê obterFantasma(pista): o save já tem fantasmas['morro-do-pinhao']

      // Passa da contagem "3-2-1-JÁ" + alguns ticks de corrida de verdade: antes disso a cena nem tica o motor
      // real nem o fantasma (ver `ui/cenas/descida.ts`).
      for (let i = 0; i < TICKS_CONTAGEM_DESCIDA + 10; i++) neve.cena.atualizar();
      neve.cena.desenhar((window as unknown as { __e2eCtx: CanvasRenderingContext2D }).__e2eCtx, 0);

      return { alphaComFantasma: [...(window as unknown as { __e2eAlpha: number[] }).__e2eAlpha] };
    });

    expect(erros, 'nenhum erro não tratado na página durante as duas corridas').toEqual([]);
    expect(
      segunda.alphaComFantasma,
      'com o fantasma injetado, o quadro da 2ª descida deveria passar por globalAlpha=0.4 (o bloco do fantasma translúcido)',
    ).toContain(0.4);

    const caminhoScreenshot = testInfo.outputPath('fantasma-2a-corrida.png');
    await page.screenshot({ path: caminhoScreenshot });
    testInfo.annotations.push({ type: 'screenshot-2a-corrida', description: caminhoScreenshot });
  });
});
