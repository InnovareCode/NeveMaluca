/**
 * Origem: copiado do InnoFighters (vite.config.ts) e adaptado para o Neve Maluca em 2026-10-22.
 * Diferenças: `__NEVE_BUILD__` no lugar de `__INNO_BUILD__`; CSP mais apertada (sem 'unsafe-inline' em estilo,
 * porque o CSS sai em arquivo, não em <style> inline); `object-src` e `base-uri` explícitos; portas 5273/4273.
 *
 * BASE: por padrão '/' (raiz do domínio, caso do EasyPanel). Para publicar em subcaminho (ex.: GitHub Pages),
 * use a opção nativa do Vite: `npm run build -- --base=/NeveMaluca/`. Nada aqui lê variável de ambiente para isso.
 */
import { execSync } from 'node:child_process';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Política de segurança de conteúdo. Vai por `<meta http-equiv>` porque o Pages não deixa definir cabeçalhos;
 * ao migrar para um servidor próprio (EasyPanel), passar a servir como cabeçalho (e então acrescentar
 * `frame-ancestors`, que a meta não cobre). Validada contra o BUILD por `npm run test:e2e:build`
 * (tests/e2e-build/csp.spec.ts), que fixa esta string: qualquer exceção nova entra aqui E no teste, com motivo.
 *
 *  - style-src 'self' (SEM 'unsafe-inline'): todo CSS vive em src/*.css e sai do build como arquivo. Não escreva
 *    `<style>` nem `style="..."` no HTML. Alterar `elemento.style.x = ...` por script é permitido pela CSP;
 *    `setAttribute('style', ...)` não é.
 *  - font-src 'self': fontes futuras serão woff2 auto-hospedados; Google Fonts/CDN ficam barrados por desenho.
 *  - img-src data: blob: / media-src blob: / connect-src 'self': folga para createImageBitmap/blob e áudio
 *    sintetizado sem afrouxar nada de script. Hoje nada disso é exceção de uso.
 * O que o `<meta>` NÃO cobre: frame-ancestors, report-uri e sandbox (só valem por cabeçalho).
 */
export const POLITICA_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

/** Injeta o `<meta>` da CSP SÓ no build: o servidor de desenvolvimento injeta scripts inline (HMR, preamble). */
function cspSoNoBuild(): Plugin {
  return {
    name: 'neve-csp-so-no-build',
    apply: 'build',
    transformIndexHtml() {
      // head-prepend: a meta precisa vir antes de qualquer <script>/<link> que ela deve governar.
      return [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: POLITICA_CSP }, injectTo: 'head-prepend' }];
    },
  };
}

/**
 * Identidade do build: commit curto + instante da compilação. Vai para o código por `define` (`__NEVE_BUILD__`, lido
 * em src/versao.ts) e para `version.json` ao lado do index.html. Serve para o dono PROVAR qual versão está vendo.
 */
function identidadeDoBuild(): { commit: string; data: string; sujo: boolean } {
  let commit = (process.env['GITHUB_SHA'] ?? '').slice(0, 7);
  let sujo = false;
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || commit;
    sujo = execSync('git status --porcelain', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().length > 0;
  } catch {
    /* sem git, ou git sem nenhum commit ainda: fica o que veio do ambiente */
  }
  return { commit: commit || 'dev', data: new Date().toISOString(), sujo };
}

const BUILD = identidadeDoBuild();

/** Publica `version.json` (a mesma identidade) no build. */
function versaoJson(): Plugin {
  return {
    name: 'neve-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(BUILD) });
    },
  };
}

export default defineConfig({
  plugins: [cspSoNoBuild(), versaoJson()],
  define: { __NEVE_BUILD__: JSON.stringify(BUILD) },
  server: { port: 5273, strictPort: true },
  preview: { port: 4273, strictPort: true },
  build: { target: 'es2022', sourcemap: true },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
