/**
 * Mede o fps do jogo no Chromium com a CPU atrasada (CDP `Emulation.setCPUThrottlingRate`). M0 (Lyra), portão do plano §8:
 * "mediana >= 58 fps e p95 do quadro <= 20 ms".
 *
 * Uso (o servidor já precisa estar de pé: `npm run dev` ou `npm run preview`):
 *   node ferramentas/medir/fps.mjs [url] [--cpu=4] [--segundos=10] [--gpu=nao|swiftshader] [--tela=844x390]
 *
 * Como mede: injeta um laço de `requestAnimationFrame` NA PÁGINA que guarda o intervalo entre quadros (independe de o jogo expor
 * ganchos), depois de 2 s de aquecimento. Mostra mediana de fps, p95 e máximo do intervalo, e quantos quadros passaram de 20 ms.
 *
 * LIMITES (plano §8): CPU 4x no Chromium do PC é APROXIMAÇÃO, não é o WebKit do iPhone; sem GPU (padrão do headless) o canvas é
 * rasterizado por software, o que pesa mais que o canvas acelerado de um celular. O número que vale para o portão é o lido no aparelho
 * do dono. `--gpu=swiftshader` liga o canvas acelerado por GL em software (mais parecido com um aparelho com GPU, ainda sem ser um).
 */
import { createRequire } from 'node:module';

const exigir = createRequire(import.meta.url);
const { chromium } = exigir('playwright');

const args = process.argv.slice(2);
const opcao = (nome, padrao) => (args.find((a) => a.startsWith(`--${nome}=`)) ?? `--${nome}=${padrao}`).split('=')[1];
const url = args.find((a) => !a.startsWith('--')) ?? 'http://127.0.0.1:5273/';
const cpu = Number(opcao('cpu', 4));
const segundos = Number(opcao('segundos', 10));
const gpu = opcao('gpu', 'nao');
const [largura, altura] = opcao('tela', '844x390').split('x').map(Number);

const argsDoNavegador = gpu === 'swiftshader' ? ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] : [];
const navegador = await chromium.launch({ args: argsDoNavegador });
const pagina = await navegador.newPage({ viewport: { width: largura, height: altura } });
const erros = [];
pagina.on('pageerror', (e) => erros.push(e.message));
pagina.on('console', (m) => {
  if (m.type() === 'error') erros.push(m.text());
});

await pagina.goto(url);
await pagina.waitForSelector('html[data-pronto="true"]');
const sessao = await pagina.context().newCDPSession(pagina);
await sessao.send('Emulation.setCPUThrottlingRate', { rate: cpu });
await pagina.waitForTimeout(2000); // aquecimento (JIT, fontes, 1º quadro caro)

const resultado = await pagina.evaluate(
  (ms) =>
    new Promise((resolver) => {
      const intervalos = [];
      let anterior = null;
      const fim = performance.now() + ms;
      const passo = (t) => {
        if (anterior !== null) intervalos.push(t - anterior);
        anterior = t;
        if (t < fim) requestAnimationFrame(passo);
        else resolver(intervalos);
      };
      requestAnimationFrame(passo);
    }),
  segundos * 1000,
);

const ordenados = [...resultado].sort((a, b) => a - b);
const pega = (p) => ordenados[Math.min(ordenados.length - 1, Math.floor(ordenados.length * p))];
const mediana = pega(0.5);
const gl = await pagina.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl');
  const ext = c?.getExtension('WEBGL_debug_renderer_info');
  return c && ext ? c.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'sem WebGL';
});
const sumario = {
  url,
  cpu: `${cpu}x`,
  gpu: gpu === 'nao' ? 'padrão do headless (canvas por software)' : gpu,
  renderizador: gl,
  tela: `${largura}x${altura}`,
  quadros: resultado.length,
  fpsMediano: Number((1000 / mediana).toFixed(1)),
  intervaloMedianoMs: Number(mediana.toFixed(2)),
  intervaloP95Ms: Number(pega(0.95).toFixed(2)),
  intervaloMaximoMs: Number(ordenados.at(-1).toFixed(2)),
  quadrosAcimaDe20ms: resultado.filter((x) => x > 20).length,
  errosDeConsole: erros,
};
console.log(JSON.stringify(sumario, null, 2));
const portao = sumario.fpsMediano >= 58 && sumario.intervaloP95Ms <= 20;
console.log(portao ? 'PORTÃO (mediana >= 58 fps e p95 <= 20 ms): ATENDIDO neste ambiente' : 'PORTÃO (mediana >= 58 fps e p95 <= 20 ms): NÃO atendido neste ambiente');
await navegador.close();
process.exitCode = erros.length > 0 ? 1 : 0;
