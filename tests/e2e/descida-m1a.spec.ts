/**
 * e2e do M1a (Lyra): render, câmera, entrada e cenas, medido NO NAVEGADOR (skill medir-antes-de-afirmar).
 *
 * `src/main.ts` (Atlas, integração) já bota em `criarCenaJogo`, e `src/ui/cenas/descida.ts` já usa o motor/pista
 * REAIS da Vega (`src/descida/`, `src/pista/`) — não mais o dublê `motor-teste.ts`/`pista-teste.ts`. Mesmo assim,
 * os testes aqui montam as cenas por fora, via `import()` dinâmico contra o servidor de desenvolvimento (Vite
 * serve qualquer `/src/*.ts` pedido por módulo, não só os referenciados pelo `index.html`): dá controle fino do
 * número de ticks e acesso direto a `criarCenaDescida`/`criarCenaResultado` sem depender do laço real do `main.ts`.
 *
 * `carregar(caminho)`: um `import()` com argumento NÃO literal (parâmetro de função) faz o `tsc` devolver `any`
 * em vez de tentar resolver o módulo em tempo de compilação (o caminho só existe para o navegador, servido pelo
 * Vite em runtime) — evita um TS2307 sem precisar de `// @ts-expect-error` em cada import. O comentário
 * "vite-ignore" (ver o código abaixo) cala o aviso equivalente do Vite, que também não analisa um caminho dinâmico.
 */
import { expect, test } from '@playwright/test';

test.describe('M1a: render + câmera + cenas (cena "jogo")', () => {
  test('a cena de descida desenha terreno, parallax, piloto e HUD (várias cores reais no canvas)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');

    const cores = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { criarCenaJogo } = await carregar('/src/ui/cenas/jogo.ts');
      const { usarEspacoLogico } = await carregar('/src/platform/canvas.ts');

      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('sem contexto 2d');

      const cena = criarCenaJogo({ canvas });
      // contagem (60 ticks) + descida real o bastante para o terreno/parallax/piloto aparecerem na tela
      for (let i = 0; i < 180; i += 1) cena.atualizar();
      usarEspacoLogico(ctx);
      cena.desenhar(ctx, 0);

      const dados = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const unicas = new Set<number>();
      for (let i = 0; i < dados.length; i += 4 * 997) unicas.add((dados[i]! << 16) | (dados[i + 1]! << 8) | dados[i + 2]!);
      return unicas.size;
    });

    // céu em degradê + montanhas + neve + terreno + piloto + HUD: bem mais que as 3 cores do fumaça.spec.ts (fundo mais simples)
    expect(cores).toBeGreaterThan(8);
  });

  test('"de novo" em 1 toque: ao chegar (motor REAL da Vega, pista morro-do-pinhao), `aoTerminar` dispara; a cena de resultado reinicia ao tocar no canvas', async ({ page }) => {
    await page.goto('/');

    const resultado = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { criarCenaDescida, TICKS_CONTAGEM_DESCIDA } = await carregar('/src/ui/cenas/descida.ts');
      const { criarCenaResultado } = await carregar('/src/ui/cenas/resultado.ts');
      const { exigirPistaValida, gerarCamadaJogo } = await carregar('/src/pista/index.ts');
      const { criarDescida } = await carregar('/src/descida/index.ts');
      const { criarBotCuidadoso } = await carregar('/src/descida/bot.ts');
      const { PISTA_MORRO_DO_PINHAO } = await carregar('/src/data/pistas.ts');
      const { derivarComando, INPUT_NEUTRO } = await carregar('/src/core/comandos.ts');

      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      document.body.appendChild(canvas);

      let dadosFinais: { pontos: number; ticks: number } | null = null;
      const cena = criarCenaDescida({
        canvas,
        aoTerminar: (r: { pontos: number; ticks: number }) => {
          dadosFinais = r;
        },
      });

      // `criarCenaDescida` usa o motor/pista REAIS por dentro e não expõe a `LeituraDescida` (ela só sai pelo
      // `aoTerminar`, no fim). Para dirigir a descida de ponta a ponta sem inventar física própria, uma SOMBRA
      // (mesma pista, mesmo motor determinístico) roda em lockstep só para alimentar o `criarBotCuidadoso` da
      // Vega (`src/descida/bot.ts`, reflexo puro sobre `LeituraDescida`) — o comando decidido vira teclas REAIS
      // (Espaço/←/→) despachadas na janela, que `criarCenaDescida` lê pelo `input/` de verdade. `derivarComando`
      // é a mesma função pura que `input/index.ts` usa por dentro: aplicada aqui aos MESMOS estados de tecla que
      // acabamos de despachar, dá exatamente o `ComandoDescida` que a cena vai produzir neste tick — por isso a
      // sombra fica em lockstep exato com o motor de dentro da cena (ambos deterministas, mesma semente, mesmos
      // comandos).
      const pistaSombra = exigirPistaValida(PISTA_MORRO_DO_PINHAO);
      // Camada de jogo (plano corrida-campeonato §C3/C4): `ui/cenas/descida.ts` passa `camada` -- a sombra
      // precisa da MESMA (pura/determinística) pra não tombar num obstáculo que ela não sabia existir.
      const camadaSombra = gerarCamadaJogo(pistaSombra, PISTA_MORRO_DO_PINHAO);
      const motorSombra = criarDescida(pistaSombra, undefined, { camada: camadaSombra });
      const bot = criarBotCuidadoso(pistaSombra, undefined, camadaSombra.obstaculosAltos);
      let leituraSombra = motorSombra.leitura();
      let frameAnterior = INPUT_NEUTRO;
      const teclaDoGiro: Record<number, string | null> = { [-1]: 'ArrowLeft', [0]: null, [1]: 'ArrowRight' };

      // ~2340 ticks (plano: bot cuidadoso nesta pista, ~39 s); folga generosa.
      const LIMITE_TICKS = 15_000;
      for (let i = 0; i < LIMITE_TICKS && dadosFinais === null; i += 1) {
        if (i < TICKS_CONTAGEM_DESCIDA) {
          // A cena está na contagem "3-2-1-JÁ": não tica nem dirige o motor sombra, só a cena mesmo (ela
          // própria não tica o motor real nesta janela — ver `ui/cenas/descida.ts`).
          cena.atualizar();
          continue;
        }
        const cmdBot = bot(leituraSombra);
        const frame = { pular: cmdBot.pulo, giro: cmdBot.giro, grab: cmdBot.grab, agachar: cmdBot.agachar };

        if (frame.pular !== frameAnterior.pular) {
          window.dispatchEvent(new KeyboardEvent(frame.pular ? 'keydown' : 'keyup', { code: 'Space' }));
        }
        if (frame.giro !== frameAnterior.giro) {
          const teclaAntiga = teclaDoGiro[frameAnterior.giro];
          const teclaNova = teclaDoGiro[frame.giro];
          if (teclaAntiga) window.dispatchEvent(new KeyboardEvent('keyup', { code: teclaAntiga }));
          if (teclaNova) window.dispatchEvent(new KeyboardEvent('keydown', { code: teclaNova }));
        }
        // Obstáculo alto (C4): só passa agachado -- faltava este despacho (a cena agora tem `camada` de verdade,
        // com obstáculos reais; sem isto o bot tombaria no primeiro galho).
        if (frame.agachar !== frameAnterior.agachar) {
          window.dispatchEvent(new KeyboardEvent(frame.agachar ? 'keydown' : 'keyup', { code: 'ArrowDown' }));
        }

        leituraSombra = motorSombra.processar(derivarComando(frameAnterior, frame));
        cena.atualizar();
        frameAnterior = frame;
      }
      if (dadosFinais === null) return { chegou: false, reiniciou: false };

      let reiniciou = false;
      const cenaResultado = criarCenaResultado({ dados: dadosFinais, canvas, aoReiniciar: () => (reiniciou = true) });
      cenaResultado.atualizar();
      canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return { chegou: true, reiniciou };
    });

    expect(resultado.chegou).toBe(true);
    expect(resultado.reiniciou).toBe(true);
  });
});

test.describe('M1a: entrada (teclado e toque) muda o estado do piloto, de verdade no navegador', () => {
  test('Espaço (teclado) faz o comando de pulo chegar como `pulo: true`', async ({ page }) => {
    await page.goto('/');

    const pulou = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { criarEntrada } = await carregar('/src/input/index.ts');
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      document.body.appendChild(canvas);

      const entrada = criarEntrada(canvas, window);
      entrada.obterComando(); // consome o estado neutro inicial
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      const cmd = entrada.obterComando();
      entrada.destruir();
      return cmd.pulo;
    });

    expect(pulou).toBe(true);
  });

  test('tocar (Pointer Event) na metade direita do canvas produz giro +1', async ({ page }) => {
    await page.goto('/');

    const giro = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { criarEntrada } = await carregar('/src/input/index.ts');
      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      canvas.style.width = '960px';
      canvas.style.height = '540px';
      canvas.style.position = 'fixed';
      canvas.style.left = '0px';
      canvas.style.top = '0px';
      document.body.appendChild(canvas);

      const entrada = criarEntrada(canvas, window);
      const retangulo = canvas.getBoundingClientRect();
      const xDireita = retangulo.left + retangulo.width * 0.8;
      canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: xDireita, clientY: retangulo.top + 100, bubbles: true }));
      const cmd = entrada.obterComando();
      entrada.destruir();
      return cmd.giro;
    });

    expect(giro).toBe(1);
  });

  test('pulo (teclado) muda de verdade o motor REAL da Vega: piloto vai ao chão -> ar', async ({ page }) => {
    await page.goto('/');

    const modos = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { criarEntrada } = await carregar('/src/input/index.ts');
      const { criarDescida } = await carregar('/src/descida/index.ts');
      const { exigirPistaValida } = await carregar('/src/pista/index.ts');
      const { PISTA_MORRO_DO_PINHAO } = await carregar('/src/data/pistas.ts');

      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      document.body.appendChild(canvas);

      const entrada = criarEntrada(canvas, window);
      const motor = criarDescida(exigirPistaValida(PISTA_MORRO_DO_PINHAO));
      const historico: string[] = [];
      for (let i = 0; i < 65; i += 1) {
        const cmd = entrada.obterComando();
        historico.push(motor.processar(cmd).piloto.modo);
      }
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      const cmdComPulo = entrada.obterComando();
      const leituraComPulo = motor.processar(cmdComPulo);
      entrada.destruir();
      return { antes: historico[historico.length - 1], depoisDoEspaco: leituraComPulo.piloto.modo };
    });

    expect(modos.antes).toBe('chao');
    expect(modos.depoisDoEspaco).toBe('ar');
  });
});
