/**
 * Origem: copiado do InnoFighters (playwright.config.ts) e adaptado em 2026-10-22.
 * Portas 5273/4273 (as do InnoFighters são 5173/4173) para os dois jogos poderem rodar lado a lado.
 *
 * Projetos:
 *  - desktop: Chromium, 1280x720.
 *  - celular: Pixel 7 em PAISAGEM (decisão D2: o jogo é paisagem), Chromium.
 *  - webkit-se: iPhone SE em paisagem no WebKit (o motor do iPhone). LIGADO por padrão; precisa de
 *    `npx playwright install webkit` uma vez (60 MiB, sem prompt). Desligar: `PLAYWRIGHT_SEM_WEBKIT=1`.
 *    É compatibilidade de motor, não medida de fps (plano §8).
 */
import { defineConfig, devices } from '@playwright/test';

const emCI = Boolean(process.env['CI']);
const comWebkit = process.env['PLAYWRIGHT_SEM_WEBKIT'] !== '1';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  workers: 4,
  forbidOnly: emCI,
  retries: emCI ? 1 : 0,
  reporter: emCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5273',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    { name: 'celular', use: { ...devices['Pixel 7 landscape'] } },
    ...(comWebkit ? [{ name: 'webkit-se', use: { ...devices['iPhone SE landscape'] } }] : []),
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5273',
    reuseExistingServer: !emCI,
    timeout: 60_000,
  },
});
