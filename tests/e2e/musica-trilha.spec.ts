/**
 * Prova no navegador (webkit-se incluso) que a trilha musical REAL (`src/audio/musica-trilha.ts`, ligada em
 * `ui/cenas/gerenciador.ts`/`campeonato.ts`) toca de fato: nasce no 1º toque, busca o arquivo certo (menu no
 * menu, a faixa da pista na corrida -- troca ao mudar de tela), e o ganho mestre respeita volume/mudo das Opções.
 *
 * Técnica: MESMO padrão de `tests/e2e/integracao-m0.spec.ts` (fake `AudioContext` injetado por `addInitScript`,
 * pulando o teste onde o motor real não suporta Web Audio) + fluxo/coordenadas de clique de
 * `tests/e2e/campeonato-corrida.spec.ts` (menu -> CAMPEONATO -> seleção -> abertura do campeonato -> COMEÇAR).
 * O fake intercepta `createGain`/`createBufferSource`/`decodeAudioData` (sem precisar decodificar um mp3 de
 * verdade) e `page.route` troca o ARQUIVO de música por um corpo minúsculo -- rápido e determinístico, sem baixar
 * ~1,8 MB por pista. Isto prova a CONEXÃO (fetch certo, ganho certo, troca na hora certa), não o áudio audível em
 * si (decodificar/ouvir de verdade já é coberto pelo teste de integração do M0 para o `AudioContext` REAL).
 */
import { expect, test } from '@playwright/test';

interface NeveHook {
  readonly laco: { pausar(motivo: string): void };
  readonly cena: { cenaAtual: () => string; irPara: (id: string) => void };
  readonly save: { dados: { cfg: { musica: number } } };
}

/** Instala o `AudioContext` falso (igual ao de `integracao-m0.spec.ts`, +`decodeAudioData`/`onended`) e o
 *  registro `window.__musica` que o teste lê do lado de fora. Chamar ANTES de `page.goto`. */
async function instalarAudioFalso(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __musica: { ganhoMestre: { gain: { value: number } } | null; fontesIniciadas: number; decodificacoes: number };
    };
    w.__musica = { ganhoMestre: null, fontesIniciadas: 0, decodificacoes: 0 };

    function parametroMudo() {
      const p = { value: 0 };
      return {
        get value(): number {
          return p.value;
        },
        set value(v: number) {
          p.value = v;
        },
        setValueAtTime(v: number) {
          p.value = v;
        },
        linearRampToValueAtTime(v: number) {
          p.value = v;
        },
        exponentialRampToValueAtTime(v: number) {
          p.value = v;
        },
      };
    }

    class ACFalso {
      state = 'running';
      currentTime = 0;
      sampleRate = 48000;
      destination = { connect() {} };
      resume() {
        return Promise.resolve();
      }
      createOscillator() {
        return { type: 'sine', frequency: parametroMudo(), detune: parametroMudo(), connect() {}, start() {}, stop() {} };
      }
      createGain() {
        const gain = parametroMudo();
        const destinoFinal = this.destination;
        const no = {
          gain,
          connect(destino: unknown) {
            if (destino === destinoFinal) w.__musica.ganhoMestre = no;
          },
        };
        return no;
      }
      createBiquadFilter() {
        return { type: 'lowpass', frequency: parametroMudo(), Q: parametroMudo(), connect() {} };
      }
      createBuffer(_canais: number, tamanho: number) {
        const dados = new Float32Array(tamanho);
        return { getChannelData: () => dados };
      }
      createBufferSource() {
        return {
          buffer: null as unknown,
          onended: null as (() => void) | null,
          connect() {},
          start() {
            w.__musica.fontesIniciadas += 1;
          },
          stop() {},
        };
      }
      decodeAudioData(_bytes: ArrayBuffer) {
        w.__musica.decodificacoes += 1;
        return Promise.resolve({ duration: 2, getChannelData: () => new Float32Array(0) });
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = ACFalso;
  });
}

test.describe('trilha musical real', () => {
  test('menu toca menu.mp3 no 1º toque; CAMPEONATO troca pra faixa da pista; volume/mudo chegam ao ganho mestre', async ({
    page,
  }) => {
    test.setTimeout(30_000);
    const erros: string[] = [];
    page.on('pageerror', (e) => erros.push(e.message));

    const pedidos: string[] = [];
    await page.route('**/assets/musica/*.mp3', async (route) => {
      pedidos.push(new URL(route.request().url()).pathname);
      await route.fulfill({ status: 200, contentType: 'audio/mpeg', body: Buffer.alloc(16) });
    });

    // Diferente de `integracao-m0.spec.ts` (que testa o `AudioContext` NATIVO e pula onde falta), aqui o fake É o
    // `AudioContext` do teste -- roda nos 3 projetos (desktop/celular/webkit-se) sem depender do motor ter Web
    // Audio de verdade, porque não queremos BAIXAR/decodificar ~1,8 MB por pista num teste rápido.
    await instalarAudioFalso(page);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-pronto', 'true');

    const canvas = page.locator('canvas#jogo');
    await canvas.click(); // Abertura -> Menu (e o 1º gesto que destrava o AudioContext)
    await expect.poll(() => page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.cena.cenaAtual())).toBe('menu');

    // O laço roda em tempo real (rAF) a partir daqui -- sem tique manual: dá tempo de `trilha.atualizar()` correr
    // e o `fetch('/assets/musica/menu.mp3')` (via `page.route`, interceptado acima) acontecer.
    await expect.poll(() => pedidos).toContain('/assets/musica/menu.mp3');
    await expect.poll(() => page.evaluate(() => (window as unknown as { __musica: { fontesIniciadas: number } }).__musica.fontesIniciadas)).toBeGreaterThan(0);

    // Volume (Opções, `cfg.musica` padrão 0.6) chega ao ganho mestre depois de alguns quadros.
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __musica: { ganhoMestre: { gain: { value: number } } | null } }).__musica.ganhoMestre?.gain.value))
      .toBeCloseTo(0.6, 1);

    // Mudo: muda `save.cfg.musica` ao vivo (o jogo lê isto a cada quadro, mesma função usada pelo toggle de Opções) e
    // confere que o ganho mestre segue pra 0 sem precisar reiniciar nada.
    await page.evaluate(() => {
      (window as unknown as { __neve: NeveHook }).__neve.save.dados.cfg.musica = 0;
    });
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __musica: { ganhoMestre: { gain: { value: number } } | null } }).__musica.ganhoMestre?.gain.value))
      .toBe(0);
    await page.evaluate(() => {
      (window as unknown as { __neve: NeveHook }).__neve.save.dados.cfg.musica = 0.6;
    });

    // Vai direto pro campeonato pelo gancho de dev (`cena.irPara`, o MESMO método que o botão CAMPEONATO do menu
    // chama por dentro) -- evita clicar em coordenadas de pixel de telas que duas Lyras estão editando ao vivo em
    // paralelo (`ui/cenas/menu.ts`/`selecao.ts`), que já fazem `campeonato-corrida.spec.ts` (preexistente, não é
    // deste commit) flutuar nesta mesma sessão. O que este teste prova é a TROCA DE FAIXA (`campeonato.ts`), não
    // a navegação por clique (coberta por outro spec).
    await page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.cena.irPara('campeonato'));
    await expect.poll(() => page.evaluate(() => (window as unknown as { __neve: NeveHook }).__neve.cena.cenaAtual())).toBe('campeonato');

    // Abertura do campeonato troca pra menu.mp3 de novo (saiu do menu principal, mas ainda não é corrida) --
    // continua sendo o MESMO pedido já visto, então o sinal real é o próximo: a faixa da 1ª pista, após COMEÇAR.
    const caixa = await canvas.boundingBox();
    expect(caixa).not.toBeNull();
    if (!caixa) return;
    const escalaX = caixa.width / 960;
    const escalaY = caixa.height / 540;
    await expect
      .poll(async () => {
        await page.mouse.click(caixa.x + 480 * escalaX, caixa.y + 473 * escalaY); // botão COMEÇAR (abertura-campeonato.ts)
        return pedidos;
      })
      .toContain('/assets/musica/vanerao-morro.mp3'); // pista 1 (Morro do Pinhão) -- troca de faixa de verdade.

    expect(erros, `erros de página: ${erros.join('; ')}`).toEqual([]);
  });
});
