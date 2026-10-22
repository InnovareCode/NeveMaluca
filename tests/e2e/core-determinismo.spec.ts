/**
 * Determinismo entre motores (plano §8, linha "Determinismo": mesmo hash em Chromium e WebKit; risco R8).
 *
 * Importa o `core/` REAL pelo servidor de desenvolvimento do Vite (sem bundle nosso) dentro de cada navegador e confere
 * contra os valores dourados que o Vitest, no Node/V8, também fixa em tests/unit/core-*.test.ts. Nos projetos do
 * Playwright isso cobre V8 (desktop, celular) e JavaScriptCore (webkit-se, o motor do iPhone).
 *
 * Observação: o import de `core/index.ts` já valida o hash das tabelas de trigonometria; se divergisse neste motor, a
 * importação lançaria e o teste falharia com a mensagem do ErroDeContrato.
 *
 * O código roda como TEXTO no navegador (e não como função do teste) para o Playwright não reescrever o `import()`.
 */
import { expect, test } from '@playwright/test';

const PROGRAMA = `(async () => {
  const C = await import(new URL('/src/core/index.ts', location.href).href);
  const grade = [];
  for (let g = -720; g <= 720; g += 0.37) grade.push(C.seno(g), C.cosseno(g));
  for (let i = -50; i <= 50; i++) for (let j = -50; j <= 50; j++) grade.push(C.atan2(i * 0.7, j * 1.3));
  const r = C.criarRng(1);
  const rng = [r.proximo(), r.proximo(), r.proximo()];
  const l = C.criarLaco();
  let ticks = 0;
  for (let i = 0; i <= 600; i++) ticks += l.quadro(1000 + i * C.PASSO_MS, () => {});
  return {
    tabelas: C.hashDasTabelasTrig(),
    grade: C.hashDeFloat64s(grade),
    nGrade: grade.length,
    valor: C.hashDeValor({ id: 'bosque', semente: 123456, dificuldade: [0.1, 0.9], trechos: { reta: 3, rampa: 1 }, ok: true, obs: null }),
    rng,
    foobar: C.hashDeTexto('foobar'),
    emoji: C.hashDeTexto('a😀b'),
    replay: C.codificarComandos([C.COMANDO_NEUTRO, C.COMANDO_NEUTRO, { pulo: true, giro: 1, grab: 'frente', agachar: true }]),
    ticks,
    bootOk: (() => { C.exigirCoreValido(); return true; })(),
  };
})()`;

test('core/ dá os mesmos hashes e números neste motor que no Node (tabelas de trig, grade seno/cosseno/atan2, hash de valor, RNG, RLE)', async ({ page }) => {
  const erros: string[] = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto('/');
  const r = (await page.evaluate(PROGRAMA)) as Record<string, unknown>;
  expect(erros).toEqual([]);
  expect(r['tabelas']).toBe('11246e61fddfa40a');
  expect(r['nGrade']).toBe(17985);
  expect(r['grade']).toBe('da2e145b7467964c');
  expect(r['valor']).toBe('4833f7f2ed839dd6');
  expect(r['rng']).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  expect(r['foobar']).toBe('85944171f73967e8');
  expect(r['emoji']).toBe('33c526094d790e49');
  expect(r['replay']).toBe('AAJbAQ==');
  expect(r['ticks']).toBe(600);
  expect(r['bootOk']).toBe(true);
});
