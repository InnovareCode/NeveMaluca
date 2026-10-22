# tests/

| Pasta | O que roda | Comando |
|---|---|---|
| `unit/` | Vitest (`tests/unit/**/*.test.ts`), ambiente Node | `npm test` |
| `e2e/` | Playwright no servidor de desenvolvimento (porta 5273): projetos `desktop`, `celular` (Pixel 7 paisagem), `webkit-se` (iPhone SE paisagem; desligar com `PLAYWRIGHT_SEM_WEBKIT=1`) | `npm run test:e2e` |
| `e2e-build/` | Playwright contra o **build** (`vite preview`, porta 4273): é onde a CSP vale | `npm run test:e2e:build` |
| `support/` | auxiliares compartilhados pelos testes (vazio no M0) | |
| `fixtures/replays/` | comandos gravados (C6) para testes de regressão de determinismo (vazio no M0) | |

Tudo junto: `npm run verificar`. Regra da squad: quem escreveu o código não é quem prova que funciona (skill
`quem-valida-o-que`). Teste que mede geometria ou layout roda no navegador (skill `medir-antes-de-afirmar`).

Integração do M0 (Vega): `tests/unit/integracao-m0.test.ts` (constantes, laços com relógio sintético, catálogo do save, `AudioDestravavel`), `tests/e2e/integracao-m0.spec.ts` (localStorage real, áudio, falha do núcleo na `#err`) e `tests/e2e-build/integracao-m0.build.spec.ts`.

Ganchos de teste do jogo (equivalente ao `window.__inno` do InnoFighters) **não existem no build**: só no dev server.

Plataforma (M0, Lyra): `tests/unit/neve-plataforma-*.test.ts`, `tests/e2e/neve-plataforma.spec.ts` e `tests/e2e-build/neve-plataforma.build.spec.ts`.
O dev server expõe `window.__neve` (`laco`, `cena`, `canvas`, `save`, `audio`, `armazenamento`); o build não. Entalhe simulado: `--teste-esq/direita/topo/base` no `<html>`.
