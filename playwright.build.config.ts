/**
 * Origem: copiado do InnoFighters (playwright.build.config.ts) e adaptado em 2026-10-22.
 *
 * Testes contra o BUILD de produção (`vite build` + `vite preview`), não contra o servidor de desenvolvimento.
 * Existem porque a CSP (`<meta http-equiv>`) só entra no build: o e2e normal (playwright.config.ts) roda no dev
 * server, que injeta scripts inline (HMR) e por isso não leva a meta.
 * Rodar com `npm run test:e2e:build`. Um por vez com `npm run test:e2e` (os dois usam o Chromium).
 * Roda também no WebKit (a CSP se comporta diferente por motor); desligar com PLAYWRIGHT_SEM_WEBKIT=1.
 *
 * trace/retries alinhados com playwright.config.ts (2026-10-24, Vulcano — conserto do flake de I/O no
 * Windows sob paralelismo real): 'on-first-retry' grava menos (só quando há 2ª tentativa) e 1 retry
 * absorve blip de infra sem mascarar bug de verdade (se falhar de novo, reprova igual).
 */
import { defineConfig, devices } from '@playwright/test';

const comWebkit = process.env['PLAYWRIGHT_SEM_WEBKIT'] !== '1';

export default defineConfig({
  testDir: 'tests/e2e-build',
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4273', trace: 'on-first-retry' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    ...(comWebkit ? [{ name: 'webkit-se', use: { ...devices['iPhone SE landscape'] } }] : []),
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    url: 'http://127.0.0.1:4273',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
