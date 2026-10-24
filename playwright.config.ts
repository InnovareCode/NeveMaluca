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

/**
 * Flake do `npm run verificar` no Windows (2026-10-24, Vulcano):
 * com 4 workers fullyParallel, a suite cheia (126 testes x 3 browsers) dava
 * ~87 falhas de "ENOENT ...trace..." e "Could not connect to server" sob
 * carga real da máquina — mas cada spec isolado passava 100% (confirmado por
 * Vega/Lyra). Não é regressão de lógica, é contenção de I/O (escrita de
 * trace no Windows) e o servidor único do `vite dev` ficando sem fôlego para
 * aceitar conexão nova com vários workers brigando por CPU.
 * Três ajustes, só de execução, nenhum de cobertura:
 *  - menos workers por padrão (3 em vez de 4); dá para destravar via
 *    PLAYWRIGHT_WORKERS numa máquina com mais sobra.
 *  - trace 'on-first-retry' em vez de 'retain-on-failure': já não bufferiza/
 *    grava trace de todo teste, só quando vai haver 2ª tentativa — menos
 *    escrita concorrente, menos chance do rename do zip bater no ENOENT.
 *  - retries também fora do CI (1): rede de segurança para um blip de
 *    infra. Se falhar de novo na 2ª tentativa, não é infra: é bug de
 *    verdade e a suite reprova igual.
 */
const workersPadrao = emCI ? 2 : 3;
const workers = process.env['PLAYWRIGHT_WORKERS'] ? Number(process.env['PLAYWRIGHT_WORKERS']) : workersPadrao;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  workers,
  forbidOnly: emCI,
  retries: 1,
  reporter: emCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5273',
    trace: 'on-first-retry',
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
