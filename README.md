# Neve Maluca

Jogo de snowboard com personagens comicos originais (pistas em 2,5D lateral, manobras e combos).
Projeto da InnovareCode, irmao do InnoFighters. Ver `docs/plano-neve-maluca.md` e `PROGRESSO.md`.

Decisoes do dono (2026-10-22): D1 = 2,5D lateral estilo Alto em Canvas 2D; D2 = paisagem.

## Como rodar

Requisitos: Node 24 (`.nvmrc`; o `package.json` aceita >= 20) e npm. Sem passos manuais alem destes:

```bash
npm ci                                   # instala as versoes exatas do lock
npx playwright install chromium webkit   # uma vez por maquina (so para os e2e)
npm run dev                              # http://127.0.0.1:5273
```

| Comando | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento (porta 5273) |
| `npm run build` | typecheck estrito + build de producao em `dist/` (CSP por `<meta>` so aqui) |
| `npm run build -- --base=/NeveMaluca/` | build para subcaminho (ex.: GitHub Pages) |
| `npm run preview` | serve o `dist/` (porta 4273) |
| `npm run typecheck` | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`, etc.) |
| `npm test` | testes unitarios (Vitest) |
| `npm run test:e2e` | Playwright no dev server: desktop, celular (Pixel 7 paisagem), webkit-se (iPhone SE paisagem) |
| `npm run test:e2e:build` | Playwright contra o build (valida a CSP e os artefatos) |
| `npm run verificar` | tudo acima, em ordem: o portao antes de qualquer entrega |

No Windows com Git Bash, `--base=/x/` e reescrito como caminho do Windows: prefixe com `MSYS_NO_PATHCONV=1`
(ou use PowerShell). Para pular o WebKit: `PLAYWRIGHT_SEM_WEBKIT=1`.

## Mapa

`src/` tem uma pasta por camada (`core`, `data`, `pista`, `descida`, `meta`, `render`, `audio`, `input`, `assets`,
`ui`, `platform`), cada uma com um `README.md` que diz o que ela faz, quem e dono e de quem pode importar.
`tests/README.md` e `ferramentas/README.md` explicam as demais pastas. Handoffs do M0: `docs/handoff-vulcano-m0.md` (fundacao), `handoff-vega-m0.md` (core), `handoff-lyra-m0.md` (plataforma),
`handoff-cronos-m0.md` (save) e `handoff-vega-m0-integracao.md` (a costura das tres partes).
