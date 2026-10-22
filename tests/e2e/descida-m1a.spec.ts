/**
 * e2e do M1a (Lyra): render, câmera, entrada e cenas, medido NO NAVEGADOR (skill medir-antes-de-afirmar).
 *
 * `src/ui/cenas/jogo.ts` ainda não está plugado em `main.ts` (main.ts é NÃO-toque para a Lyra; a integração é a
 * próxima etapa, ver handoff). Por isso os testes aqui montam a cena por fora, via `import()` dinâmico contra o
 * servidor de desenvolvimento (Vite serve qualquer `/src/*.ts` pedido por módulo, não só os referenciados pelo
 * `index.html`) — sem precisar de HTML novo nem de tocar em `main.ts`/`index.html`.
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

  test('"de novo" em 1 toque: ao chegar, `aoTerminar` dispara; a cena de resultado reinicia ao tocar no canvas', async ({ page }) => {
    await page.goto('/');

    const resultado = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { criarCenaDescida } = await carregar('/src/ui/cenas/descida.ts');
      const { criarCenaResultado } = await carregar('/src/ui/cenas/resultado.ts');

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
      // sem nenhum comando, o motor-teste desliza morro abaixo e chega sozinho (mesma garantia do teste
      // unitário de motor-teste.ts); 10_000 ticks é folga de sobra para a pista padrão.
      for (let i = 0; i < 10_000 && dadosFinais === null; i += 1) cena.atualizar();
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

  test('pulo (teclado) muda de verdade o motor de teste: piloto vai ao chão -> ar', async ({ page }) => {
    await page.goto('/');

    const modos = await page.evaluate(async () => {
      const carregar = (caminho: string) => import(/* @vite-ignore */ caminho);
      const { criarEntrada } = await carregar('/src/input/index.ts');
      const { criarMotorTeste } = await carregar('/src/ui/cenas/motor-teste.ts');
      const { gerarPistaTeste } = await carregar('/src/ui/cenas/pista-teste.ts');

      const canvas = document.createElement('canvas');
      canvas.width = 960;
      canvas.height = 540;
      document.body.appendChild(canvas);

      const entrada = criarEntrada(canvas, window);
      const motor = criarMotorTeste(gerarPistaTeste(200));
      const historico: string[] = [];
      for (let i = 0; i < 65; i += 1) {
        const cmd = entrada.obterComando();
        historico.push(motor.tick(cmd).piloto.modo);
      }
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      const cmdComPulo = entrada.obterComando();
      const leituraComPulo = motor.tick(cmdComPulo);
      entrada.destruir();
      return { antes: historico[historico.length - 1], depoisDoEspaco: leituraComPulo.piloto.modo };
    });

    expect(modos.antes).toBe('chao');
    expect(modos.depoisDoEspaco).toBe('ar');
  });
});
