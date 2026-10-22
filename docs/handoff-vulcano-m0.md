# Handoff do Vulcano: M0, fundacao de projeto

Data: 2026-10-22. Escopo: so ferramentas, configuracao e esqueleto. Nenhuma logica de jogo, nenhuma imagem, nenhum remoto,
nenhum push, nenhum commit (o Atlas decide).

## Como rodar

```bash
npm ci
npx playwright install chromium webkit   # uma vez por maquina
npm run verificar                        # typecheck + vitest + e2e no build + e2e no dev (~26 s nesta maquina)
npm run dev                              # http://127.0.0.1:5273
```

Os comandos individuais estao no `README.md` da raiz. Portas **5273** (dev) e **4273** (preview), diferentes das do
InnoFighters (5173/4173), para os dois jogos rodarem ao mesmo tempo.

## Versoes (exatas, sem `^`; `.npmrc` tem `save-exact=true`)

| Pacote | Versao | Observacao |
|---|---|---|
| vite | 8.3.4 | mesma do lock do InnoFighters |
| typescript | 7.0.2 | idem |
| vitest | 5.0.5 | idem |
| @playwright/test | 1.64.1 | idem |
| @types/node | 26.6.5 | idem; necessario para `node:child_process` no `vite.config.ts` |

Nao instalei `jsdom` (o InnoFighters nao usa), nem `sharp` (so o pipeline de sprites, no M1b, e la se justifica).
`npm ci` num diretorio limpo reproduziu a arvore (43 pacotes, 0 vulnerabilidades pelo `npm audit` do install).
Ambiente: Node 24.12.0, npm 11.6.2 (`.nvmrc` = 24). WebKit do Playwright: 27.2 (build v2370).

## O que foi provado (rodado aqui, Windows, 2026-10-22)

- `npm run typecheck`: limpo (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noUnused*`, como no InnoFighters).
- `npm test`: 1 arquivo, 2 testes (rotulo da versao; as 11 camadas existem e importam).
- `npm run build`: ok. JS 2,03 kB (1,14 kB gzip), CSS 0,44 kB, `version.json` emitido. Meta da meta de M0 "JS <= 60 KB gzip": folga enorme.
- `npm run build -- --base=/NeveMaluca/` (com `MSYS_NO_PATHCONV=1`): `href`/`src` do HTML saem com o prefixo; manifest usa caminhos relativos.
- `npm run test:e2e`: 3 passam (desktop 1280x720, celular Pixel 7 paisagem, webkit-se iPhone SE paisagem). O teste MEDE no navegador: canvas 1920x1080,
  razao 16:9 (tolerancia 0,02), dentro do viewport, mais de 3 cores amostradas, zero erro de console.
- `npm run test:e2e:build`: 3 testes x 2 projetos (Chromium e WebKit) passam: meta CSP no HTML antes de qualquer script/link e igual a string fixada no teste;
  sem script/`<style>`/`style=` inline; **zero violacao de CSP (evento `securitypolicyviolation`)**; CSS externo aplicado; manifest, icones e `version.json` servidos.
- `npm run verificar` completo: verde.
- YAML do `ci.yml` e do `dependabot.yml`: valido (PyYAML).

## O que NAO foi provado

- **O workflow `ci.yml` nunca rodou** (nao ha remoto). So o YAML foi validado. Pontos de risco: `playwright install --with-deps chromium webkit` no Ubuntu do
  runner e o `actions/upload-artifact` v5.0.0 (SHA conferido com `git ls-remote`, nao usado em producao ainda).
- **fps com CPU 4x e "tempo ate jogar"**: nao medidos (o canvas atual e estatico, sem laco). O portao "60 fps com CPU 4x" do M0 fica com a Iris quando Vega/Lyra
  colocarem o laco; ha sugestao de `ferramentas/medir/` no plano.
- WebKit do Playwright no Windows serve para compatibilidade, nao para fps nem para o comportamento real do iPhone (plano §8).

## Decisoes de configuracao (e por que)

- **WebKit ligado por padrao** (projeto `webkit-se`, iPhone SE paisagem): baixou sem nenhum prompt (60 MiB), roda em ~1 s e o iPhone e o aparelho principal.
  Desligar: `PLAYWRIGHT_SEM_WEBKIT=1`. No CI ele e instalado junto com o Chromium.
- **Projeto `celular` em paisagem** (`Pixel 7 landscape`), por D2. Teste de retrato, se Lyra quiser (aviso de girar o aparelho), usa `test.use({ ...devices['Pixel 7'] })` no proprio spec.
- **Base**: padrao `/`; subcaminho pelo `--base` nativo do Vite. Nenhuma variavel de ambiente. URLs de `public/` no codigo devem usar `import.meta.env.BASE_URL`.
- **CSP so no build**, por `<meta>` (injetada pelo plugin em `vite.config.ts`, antes de qualquer script). **Mais apertada que a do InnoFighters**: `style-src 'self'`
  sem `'unsafe-inline'`, mais `object-src 'none'` e `base-uri 'self'`. Consequencia: nada de `<style>` nem `style="..."` no HTML, e nada de `setAttribute('style', ...)`;
  `elemento.style.x = ...` por script e permitido. O teste de build falha se alguem violar. Qualquer afrouxamento entra em `vite.config.ts` **e** em `tests/e2e-build/csp.spec.ts`, com motivo.
- **Sem lint**: o InnoFighters tambem nao tem. O gate estatico e o `tsc` estrito. Se o dono quiser lint, e decisao nova (pacote novo).
- **CI**: jobs `qualidade` (typecheck, test, build) e `e2e` (build e dev, Chromium e WebKit), mais o job `portao`, que e o **unico check a marcar como obrigatorio** na protecao da `main`.
  Actions pinadas por SHA (checkout e setup-node: os mesmos do InnoFighters, v4.4.0; upload-artifact v5.0.0 `330a01c`). Permissao `contents: read`. Sem deploy, sem secrets, sem variaveis de ambiente.
  Pages/EasyPanel so no M5 (e Pages so se D8 permitir). Os SHAs sao atualizados pelo Dependabot (semanal, npm + actions).
- **Armadilha do Git Bash no Windows**: `--base=/x/` vira `C:/Program Files/Git/x/`. Usar `MSYS_NO_PATHCONV=1` ou PowerShell.
- `.gitattributes` forca LF (`* text=auto eol=lf`). Sem LICENSE (decisao do dono).

## Icone e manifest

Icone provisorio (bola de neve sorridente) gerado por `npm run icone:provisorio` (`ferramentas/icone/gerar-icone-provisorio.mjs`, sem dependencia, PNG escrito a mao)
em `public/icones/` (192, 512, apple-touch 180, favicon 32). O mesmo 512 serve a `any` e `maskable` (conteudo dentro da zona segura). Definitivo so no M4 (D9).
`public/manifest.webmanifest`: standalone, `landscape`, cores azul/marinho. `index.html` tem as metas `apple-mobile-web-app-*`, `viewport-fit=cover`, `theme-color` e `robots noindex`.

## O que cada frente vai encontrar

**Todos**
- `src/<camada>/index.ts` com `export {};` e um `README.md` com dono, responsabilidade e "importa de" (tabela do plano §3.1). Apague o `export {};` ao criar o primeiro modulo real
  (o teste de fumaca exige que o `index.ts` exista em cada uma das 11 pastas; mantenha o arquivo, mesmo que vire barril).
- Testes unitarios: `tests/unit/**/*.test.ts` (so esse padrao entra no Vitest), ambiente `node`. E2e em `tests/e2e/*.spec.ts` (dev server) e `tests/e2e-build/*.spec.ts` (build).
- Pastas vazias prontas: `tests/support/`, `tests/fixtures/replays/` (com `.gitkeep`).
- O `tsconfig.json` inclui `src`, `tests` e as configs. Se criarem ferramentas em TypeScript dentro de `ferramentas/`, e preciso acrescentar a pasta ao `include` (as `.mjs` nao passam pelo `tsc`).
- Hoje o working tree nao tem commit: o build sai com commit `dev`/`sujo: true`. Isso se resolve sozinho no primeiro commit.

**Vega (`core/`, depois `descida/`, `pista/`, `audio/`)**
- `core/` espera `contratos.ts` (C2 a C6), `rng.ts`, `trig.ts`, `hash.ts`, constantes. O teste de varredura de camadas e de funcoes proibidas (`Math.sin/cos/atan2/pow/exp`, `Math.random`, `Date`, `performance`) e seu: crie em `tests/unit/`.
- Constantes oficiais do canvas (960x540 logico, buffer 2x = 1920x1080) devem morar em `core/`; o `main.ts` provisorio repete 1920/1080 localmente e o `index.html` fixa `width/height`. Se mudarem, o e2e de fumaca (1920x1080) acompanha.
- Laco de passo fixo: o `main.ts` atual nao tem laco; entra junto com a Lyra.
- Nada de `Math.random`/`Date` no motor: o Vite `define` so injeta `__NEVE_BUILD__` (em `src/versao.ts`, fora do motor).

**Lyra (`platform/`, `render/`, `input/`, `ui/`)**
- `src/main.ts` e **provisorio**: pinta degrade + texto e seta `document.documentElement.dataset.pronto = 'true'`. Substitua pela montagem real, **mantendo** a convencao `html[data-pronto="true"]`
  (os e2e esperam por ela) e o `#err` para erro fatal de boot.
- `index.html` tem `canvas#jogo` (1920x1080, `tabindex=0`) e `pre#err`. `src/estilo.css` ja define 16:9 por CSS puro, `touch-action: none` e `overscroll-behavior: none` (risco R6). Escala em px inteiros, letterbox,
  pausa por foco e aviso de orientacao ficam com voce em `platform/`. **Sem `<style>`/`style=""` em HTML; so CSS em `src/*.css`** (CSP do build).
- Fontes: woff2 auto-hospedados em `public/` e `@font-face` em CSS sob `src/`; nada de CDN (`font-src 'self'`).
- `src/versao.ts` exporta `VERSAO` e `rotuloDaVersao()` (para mostrar o commit na tela de titulo e provar a versao no aparelho); `version.json` sai no build.
- Ganchos de teste do jogo (tipo `window.__inno`): escolha o nome; nao existem no build, so no dev server.

**Cronos (`storage` em `core/storage.ts`, `data/`, `meta/`)**
- Teste do armazenamento roda em Node: receba o `Storage` por parametro e use um falso em memoria no teste. Nao ha `jsdom`; se achar que precisa dele, justifique antes de instalar (pacote novo).
- Chave `neve-maluca-v1` (C4). CSP: `connect-src 'self'` (sem rede externa).
- `data/` valida no import; `main.ts` deve importar esses modulos para o tree-shaking nao os remover.

**Iris**
- `npm run verificar` e o portao local; o job `portao` do CI e o equivalente remoto. Para o portao de fps (M0: "60 fps com CPU 4x", plano §8), e preciso o laco rodando; a medicao
  usa CDP `Emulation.setCPUThrottlingRate` no Chromium (so desktop; WebKit nao expoe isso).

## Pendencias

- Atlas decide o commit inicial; depois disso, `git status` fica limpo e o `version.json` ganha o commit real.
- Quando houver remoto (D8): fazer push, conferir o primeiro run do `ci.yml`, ativar protecao da `main` exigindo o check `portao` e, no Settings > Actions, "Require actions to be pinned to a full-length commit SHA".
- Sem pendencia de Orion para este marco (sem deploy). Orion revisa a CSP no M5.
