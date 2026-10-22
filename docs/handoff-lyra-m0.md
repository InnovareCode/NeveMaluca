# Handoff da Lyra: M0, plataforma e cena vazia

Data: 2026-10-22. Escopo: `src/platform/`, `src/ui/` (cena de boot), `src/main.ts`, e2e e unitários da plataforma. Não toquei em `src/core`,
storage, `package.json`, `vite.config.ts` nem nos `playwright*.config.ts`. Sem commit. Sem MISSION_ID no pedido: nada foi publicado no painel.

## RESULTADO

- `src/platform/` completo (tabela de arquivos e origem no `README.md` da pasta). Copiado do InnoFighters com nota de origem: `tela-cheia.ts`,
  `audio-desbloqueio.ts`, `aviso.ts`, `fontes.ts` (+ `src/versao.ts` ganhou `verificarVersao`/`recarregarSemCache`). Adaptados e ampliados: `escala.ts`
  (área segura, posição, observador), `orientacao.ts`, `foco.ts` (volta do foco), `erros.ts` (`#err` por `hidden`). Novos: `laco.ts`, `canvas.ts`,
  `constantes.ts`, `tela-cheia-ui.ts`, `plataforma.css`, `fontes.css`.
- Escala 960x540 lógico, buffer 1920x1080 fixo, tamanho CSS em px inteiros (contas com inteiros, arredonda para baixo), letterbox centrado na área útil
  (janela menos `env(safe-area-inset-*)`); reajusta em `resize`, `orientationchange` (de novo no próximo quadro e aos 250 ms, porque o iOS reporta tamanho velho) e `visualViewport.resize`.
- Orientação: o aviso `#rot` ("Vire o aparelho para o modo paisagem") é só CSS, aparece antes do JS, cobre a tela (z-index 50) e usa a mesma media query que
  o JS (`observarOrientacao`), que pausa o laço com o motivo `retrato`. Quadrada conta como retrato.
- Foco/visibilidade: `blur`/`focus` e `visibilitychange` pausam e retomam por motivo (`foco`, `oculta`, `retrato`); o laço só anda sem motivo ativo.
- Laço (`laco.ts`): passo fixo 1000/60, acumulador limitado a 100 ms, só o carimbo do rAF como relógio, `desenhar(alpha)`, pausa não agenda quadro e a volta não acumula o tempo parado,
  erro dentro do quadro PARA o laço e vai para `#err`. Provisório: troca o `PASSO_MS` quando a `core/` da Vega o exportar.
- Tela cheia: botão DOM no canto (44 px, rótulo, foco amarelo de 3 px, tecla F). Com a API: entra e sai. iPhone/iPad (sem API): vira "COMO ATIVAR" e abre o cartão
  (Compartilhar > Adicionar à Tela de Início), com `role=dialog`, foco preso, Esc/"Entendi"/fundo fecham e o foco volta. Aberto pelo ícone (standalone): o botão some.
  Recusa do navegador: aviso discreto `role=status`. Entrada para a UI do M1: `montarTelaCheia().definirVisivel(false)` esconde o botão durante a descida.
- Destrave de áudio: `desbloquearAudio(window, audio)` (touchend/pointerup/mouseup/click/keydown, nunca touchstart; religa `suspended` e `interrupted`).
  **Não está ligado no `main.ts`**: ainda não existe `audio/`. A Vega implementa `AudioDestravavel` (`ctx`, `init`, `resume`) e chama uma vez no boot.
- Versão do build: rótulo ("commit · dd/mm hh:mm", horário de Brasília) no canto da cena de boot; `verificarVersao` pronto (não chamado no boot: no dev server o 404 de `version.json` vira erro de console).
- Cena `boot` (`src/ui/cenas/boot.ts`, contrato `Cena` em `src/ui/tipos.ts`): degradê, ladeira, 28 flocos determinísticos (movem com ticks+alpha), título PROVISÓRIO em Barlow Condensed 800 itálico com contorno, "em construção", versão.
  Fundo e título numa camada desenhada uma vez (ver Medidas).
- Fontes: as 3 woff2 (Barlow Condensed 800 itálico, Barlow 600, Bangers) + licenças OFL copiadas para `public/assets/fontes/`, `@font-face` em `src/platform/fontes.css`,
  preload no `index.html`, `carregarFontes` (teto de 4 s) antes do primeiro quadro. Fonte do título definitiva (Lilita One) não entra: vira desenho no M4.
- `index.html`: acrescentei `#aviso`, `#rot` e 2 `<link rel=preload>`. `main.ts` mantém `html[data-pronto="true"]` (agora só depois do 1º quadro desenhado, mesmo em retrato) e `#err`. Gancho de teste `window.__neve` só no dev.
- Testes novos: `tests/unit/neve-plataforma-{escala,laco,foco-orientacao,audio,fontes,erros-aviso,tela-cheia,versao}.test.ts`; `tests/e2e/neve-plataforma.spec.ts` (21 testes x 3 projetos);
  `tests/e2e-build/neve-plataforma.build.spec.ts` (4 testes x 2 motores, valida CSP com o DOM criado por script).

## O que foi provado (rodado aqui, Windows, 2026-10-22)

- `npm run verificar` verde: typecheck limpo; vitest 17 arquivos / 315 testes (inclui os da Vega e do Cronos); `test:e2e:build` 14 passam (Chromium + WebKit); `test:e2e` 68 passam, 1 pulado de propósito (Tab até o botão no WebKit, ver abaixo).
- **Medido no navegador** (`getBoundingClientRect`, `elementFromPoint`, `getComputedStyle`): 915x412 -> 732x412 em x=91; 844x390 -> 693x390 em x=75; 1280x720 inteiro; 16:9 com erro < 0,01; bordas reais (1 px dentro é o canvas, 2 px fora não é).
  Entalhe simulado (47/47/21 px) em 915x412 -> 695x391 em x=110; em 844x390 -> 656x369 em x=94; ao remover o entalhe volta a 693x390.
- Retrato (390x844): `#rot` cobre 390x844, contraste do texto > 7:1 (medido do CSS calculado), laço parado de verdade (ticks e quadros iguais depois de 400 ms) e o canvas já tinha o 1º quadro. Girar para paisagem esconde o aviso e retoma; voltar pausa.
- Laço: 35 a 75 ticks em 1 s (tolerância de máquina carregada) e quadros crescendo; blur parado 1,2 s e retomada = menos de 30 ticks (o tempo parado não vira salto).
- Fontes: as 3 faces carregam do mesmo host, status 200; `document.fonts.check` verdadeiro; o título mede < 90% da largura da fonte de reserva. Subcaminho: `--base=/NeveMaluca/` reescreve `url()` do CSS e os `href` de preload.
- Cartão do iPhone nos 3 projetos, incluindo WebKit: rótulo, foco no "Entendi", Tab preso, Esc/botão/fundo fecham, foco volta, janela do cartão cabe em 844x390.
- **Mutação** (10 mutantes aplicados numa cópia): 9 mortos de primeira (aviso de retrato, margem segura, relógio da pausa, pausa em retrato, contorno do título, retomada por foco, foco de volta no cartão, tecla F, touchstart no lugar de touchend);
  o 10º (`Math.ceil` na escala) sobreviveu e fiz o teste mais forte (piso exato da proporção em milhares de janelas); agora morre.
- **Bug real achado pelo teste no WebKit e corrigido:** o Safari/WebKit não dá foco ao botão no clique, então `document.activeElement` ficava no `<body>` e, ao fechar o cartão, o foco não voltava. Agora volta ao botão.

## Medidas (ferramentas/medir/fps.mjs; CDP `Emulation.setCPUThrottlingRate`)

- **JS inicial: 13,4 KB bruto, 5,7 KB gzip** (meta <= 60 KB). CSS 1,6 KB gzip. `index.html` 1,2 KB gzip. (JS de Vega/Cronos entra quando o `main.ts` importar `core/`.)
- fps, cena de boot, 844x390, 8 s depois de 2 s de aquecimento, dev e build iguais:

| Canvas | CPU | fps mediano | p95 do quadro |
|---|---|---|---|
| por software (padrão do headless) | 1x | 59,9 | 16,7 ms |
| por software | 4x | 59,9 | **33,4 ms** |
| acelerado (SwiftShader) | 4x | 59,9 | 16,8 ms |

  Portão do plano §8 (mediana >= 58 e p95 <= 20 ms): **atendido com canvas acelerado a 4x; NÃO atendido no canvas por software a 4x (p95 33,4 ms)**. Esse p95 é o piso do ambiente: um `fillRect` sólido de 1920x1080 sem nada
  mais dá o mesmo 33 ms a 4x por software. Antes da camada em cache, a cena (degradê + `strokeText` por quadro) fazia 12 fps a 4x e 15 fps a 1x por software; a camada em cache resolveu isso.
  O número que vale é o do iPhone do dono (plano §8).

## O que NÃO foi provado

- **Nada rodou em iPhone real.** Falta ver no aparelho: `env(safe-area-inset-*)` reais (o entalhe aqui é simulado por variável CSS), o rótulo/cartão COMO ATIVAR no Chrome do iOS, o destrave de áudio no WebKit do iOS
  (o e2e prova o disparo por gesto real num WebKit de desktop com um áudio falso, não o `AudioContext` do iOS), a barra do Chrome mudando a altura (`visualViewport`), o reajuste logo após girar o aparelho e o fps.
- WebKit do Playwright no Windows serve para compatibilidade, não para fps nem para o comportamento do iOS (plano §8).
- Fullscreen API real: nos e2e a API é simulada (determinismo; o motor real varia). A entrada em tela cheia de verdade foi vista só no Chromium, por captura manual.
- Teste "foco visível por Tab" só roda no Chromium (o WebKit do Playwright não faz Tab até botões); o contorno de 3 px amarelo é medido lá.
- `verificarVersao` e o aviso "versão nova" não estão ligados na UI (ficam para as Opções).
- Wake lock (tela acesa) e PWA (service worker) não fazem parte deste M0.

## PARA O PRÓXIMO

**Íris (testar na interface):**
- Em iPhone real com Chrome, paisagem: título aparece, flocos andam, versão no canto inferior esquerdo, botão no canto superior direito diz COMO ATIVAR, o toque abre o cartão e o "Entendi" fecha. Girar para retrato mostra o aviso e o jogo para; girar de volta retoma.
- Conferir que a barra do navegador aparecendo/sumindo reescala o canvas sem sobrar faixa estranha, e que nada do jogo fica sob o entalhe/ilha/barra inferior.
- Rodar `node ferramentas/medir/fps.mjs http://127.0.0.1:4273/ --cpu=4 [--gpu=swiftshader]` contra o `vite preview` e decidir como tratar o p95 do canvas por software (portão do M0).
- Atenção: `playwright.config.ts` usa a porta 5273 fixa e `reuseExistingServer`. Duas execuções simultâneas (outro agente rodando `verificar`) fazem a outra levar `ERR_CONNECTION_REFUSED` em massa (vi isso uma vez); rode sozinho.

**Vega:** exportar de `core/` as constantes (`LARGURA`, `ALTURA`, `RS`, passo fixo) e trocar o conteúdo de `src/platform/constantes.ts` por re-export (os testes importam de lá). Implementar `AudioDestravavel` em `audio/` e chamar `desbloquearAudio(window, audio)` no boot.
A cena recebe `atualizar()` por tick; `descida.update` entra lá.

## PENDÊNCIAS

- Decisão de produto (dono): botão de tela cheia fica sempre visível no canto superior direito. Na descida ele pode colidir com o HUD; a UI do M1 deve chamar `definirVisivel(false)` ou mover o botão.
- O `PASSO_MS` do laço é provisório (ver Vega acima).
- `src/versao.ts` (do Vulcano) ganhou duas funções; o `tests/unit/neve-plataforma-versao.test.ts` as cobre.
- Nenhum bloqueio de contrato de API (não há API).

## APRENDIZADO

- Float em escala: `375 * (960/540)` pode dar 666,99 e perder 1 px; fazer a conta com inteiros (comparar `larg*ALTURA <= alt*LARGURA`) e arredondar margens seguras para cima.
- Teste e2e de WebKit achou o que o Chromium escondeu: botão não recebe foco no clique. Sempre guardar o elemento de origem quando `activeElement` for o `<body>`.
- `page.addInitScript(fn, arg)`: a função é serializada, não enxerga variáveis de fora (o `instalado is not defined` quebrou 11 testes de uma vez).
- Canvas por software: `strokeText` grande + degradê todo quadro = 65 ms; camada em cache + `drawImage` = piso do ambiente. Medir os dois modos (software e `--use-angle=swiftshader`).
- Ambiente: `python`/`python -` trava no Windows (stub); `rm -rf` em pasta com junction de `node_modules` é perigoso: remover a junction com `cmd /c rmdir` primeiro. Mutação em cópia do projeto (porta 5373) para não quebrar os e2e dos outros agentes.
