# Handoff da Vega: M0, integração das três partes

Data: 2026-10-22. Escopo: costurar `core/` (Vega), `platform/` (Lyra) e `meta/` (Cronos) sem mudar comportamento, mais o destrave de áudio. Sem commit, sem remoto.

## RESULTADO

- `src/platform/constantes.ts` virou só re-export de `core/constantes` (os 7 nomes pedidos). Os testes da Lyra passam sem tocar nas asserções.
- **Laço:** a platform usa o `PASSO_MS`/`ACUMULADOR_MAXIMO_MS` do core. Mantive o `platform/laco.ts` (o `criarLaco` do core **não é equivalente**, ver abaixo).
- `src/data/regras-save.ts` (+ barril `data/index.ts`): `REGRAS_SAVE` com personagens `capi, bandeira, cidinha, brunao, queque, bia` (inicial `capi`), as 5 pistas
  `morro-do-pinhao` (inicial), `pico-do-picole`, `vila-chocolate`, `vulcao-pe-gelado`, `cume-da-ventania`, 15 objetivos (`<pista>-o1..o3`), `versaoPista` = `"provisoria"`.
  Valida no import (`FORMA_ID`, repetição, iniciais existentes, versão por pista).
- `src/audio/audio-destravavel.ts` (+ barril): `AudioDestravavel` (`ctx`, `init`, `resume`), nota de origem no cabeçalho. `AudioContext` só no `init()` (gesto). Sem sons.
- `src/main.ts`: importa `./core` (valida no import), lê o save (`carregarSave(new ArmazenamentoResiliente(), REGRAS_SAVE)`), mostra o aviso, liga
  `desbloquearAudio(window, new AudioDestravavel())`. Nada é gravado. Dev hook `window.__neve` ganhou `save`, `audio`, `armazenamento`.
- `src/platform/erros-no-carregamento.ts` (novo, importado primeiro no `main.ts`): liga a caixa `#err` no import.
- READMEs de audio, data, platform, core, meta, ui, tests e raiz; `PROGRESSO.md` (M0 pronto no código, decisões).
- Testes novos: `tests/unit/integracao-m0.test.ts` (23), `tests/e2e/integracao-m0.spec.ts` (8 x 3 projetos), `tests/e2e-build/integracao-m0.build.spec.ts` (2 x 2 motores).

## O que foi provado (rodado aqui, Windows, árvore parada, uma execução só)

- `npm run verificar` verde, duas vezes seguidas: typecheck limpo; vitest 18 arquivos / 338 testes; `test:e2e:build` 18 passam; `test:e2e` 91 passam, 2 pulados de propósito
  (o Tab até o botão no WebKit, já existente, e o teste do `AudioContext` real no WebKit, que no Windows não tem Web Audio).
- **Bundle inicial** (`npm run build`): JS 31,0 KB bruto / **12,5 KB gzip** (era 5,7), CSS 1,5 KB gzip, HTML 1,2 KB gzip. Meta de 60 KB gzip: folga grande. O `core/` entrou inteiro (sem o tree-shaking quebrar a validação).
- **Determinismo do core no WebKit mantido:** `tests/e2e/core-determinismo.spec.ts` (hash das tabelas de trig, 17 985 saídas, RNG, RLE, 600 ticks) segue verde nos 3 projetos, incluindo `webkit-se`, depois da integração.
- **Laço com relógio sintético** (`integracao-m0.test.ts`): platform e core dão a mesma contagem de ticks (diferença <= 1 por quadro) a 30, 60, 75, 120 e 144 Hz por 10 s e com jitter de 4 a 45 ms
  (semente fixa); os dois limitam salto de 10 s a 5 ou 6 ticks; a mesma entrada dá a mesma saída em duas execuções.
- **Falha do núcleo aparece na tela:** e2e intercepta `trig.ts` trocando o hash fixo; nos 3 motores a `#err` mostra "tabelas de trigonometria divergem do hash fixo" e `data-pronto` não é posto.
  **Mutação feita:** tirei o import de `erros-no-carregamento` do `main.ts` e o teste reprovou (tela em branco sem a caixa); restaurado.
- **localStorage real** (Chromium, WebKit): aparelho novo não grava nada; `{v:2}` plantado vira `futuro`, o aviso aparece e o valor segue byte a byte; lixo vira `recuperado` com a cópia `-quebrada`;
  `localStorage` que lança (`SecurityError`) sobe o jogo com o aviso. Mesmos casos de aviso no build (CSP sem violação).
- Áudio: com `AudioContext` falso (igual nos 3 motores) nada é criado no boot, o 1º gesto cria UM contexto e chama `resume`, o 2º não cria outro; sem Web Audio nada quebra; com o real, só no Chromium.

## O que NÃO foi provado

- Nada no iPhone real: o destrave de áudio no WebKit do iOS, o `localStorage` do Safari privado (existe e só falha na 1ª escrita), safe-area, fps. (Os mesmos do handoff da Lyra.)
- O `AudioContext` real só foi exercitado no Chromium; o WebKit do Playwright no Windows não tem Web Audio.
- Não varri `Math.random`/relógio em `audio/` com mutação nova: vale a varredura que já existe (`arquitetura.test.ts`), que passou com os arquivos novos.

## Achados e decisões (para o Atlas decidir ou saber)

1. **Os dois laços NÃO são equivalentes.** `platform/laco.ts` limita o *delta* de cada quadro a 100 ms; `core/laco.ts` limita o *acumulador* inteiro (e tem `FOLGA` numérica e teto de 6 ticks por quadro).
   Em quadro de ~85 ms ou mais logo depois de sobra de tick, a platform roda 1 tick a mais (medi diferença de 8 acumulados em 4 mil quadros de jitter 4 a 90 ms). Em cadência normal, são iguais. Não mudei (instrução: sem
   mudar comportamento). Para o M1 a simulação da descida usa o do core (com replay); o da platform só tem de chamar `atualizar` por tick. Se quiser um só, é trocar uma linha na platform (limitar `acumulado`, não `dt`) ou fazer a platform delegar ao `core.criarLaco().quadro`.
2. **Lacuna no contrato do Cronos:** com `ArmazenamentoResiliente`, `localStorage` bloqueado (modo privado) **não** gera `estado: 'indisponivel'` (a leitura cai para memória: estado `novo`, `avisar: false`).
   `indisponivel` só ocorre se passar `null`. Por isso o `main.ts` avisa quando `save.avisar || !armazenamento.persistente` (extensão minha à sua instrução "quando avisar for true"). Quem gravar no M1 deve avisar também quando `salvarSave` != `'gravado'`.
3. **Erro no import do `core/` ficava invisível:** `core/index.ts` e `trig.ts` validam NO IMPORT, antes de o `boot()` registrar o `#err`, então a falha seria tela em branco (no celular não há console). Resolvido com `platform/erros-no-carregamento.ts`
   importado primeiro (ES modules avaliam os imports em ordem). Removi a chamada `mostrarErrosNaTela()` de dentro do `boot()` (agora é feita nesse módulo; chamar duas vezes duplicaria a mensagem).
4. **Camadas:** `data/` só importa `core/`, e o tipo `RegrasSave` mora em `meta/` (que importa `data/`). Então `data/regras-save.ts` declara a forma por estrutura (`RegrasDoCatalogo`) e um teste prova a atribuição a `RegrasSave`. Se o `RegrasSave` ganhar campo obrigatório, o `tsc` acusa no teste.
5. `AudioDestravavel.resume()` engole a rejeição da promessa (`.catch`): o `main.ts` mostra `unhandledrejection` na `#err`, e um `resume()` recusado fora de gesto não é erro do jogo (a origem InnoFighters usava `void`).
6. `meta/` não recebeu `validarReplay` (o gancho do `core/` `validarReplayV1`) nas regras: só importa quando houver `fantasmas` (M2). Fica para quem ligar o fantasma.

## PARA O PRÓXIMO

- **Íris:** rodar `npm run verificar` com a árvore parada (porta 5273/4273 fixas). No iPhone real (dono): primeira batida de toque cria o áudio e ele fica `running`; save em aba privada mostra o aviso; ligação no meio e volta do segundo plano religam o áudio (`interrupted`).
- **Órion:** revisar `regras-save.ts` (nenhum dado externo entra aqui; ids fixos) e a ordem de imports do `main.ts` (a segurança do boot depende dela: erro de validação precisa estar visível). A CSP não mudou.
- **Lyra / M1:** a cena de descida usa `core/laco.ts` ou o da platform (ver achado 1); `save.dados` está em `window.__neve.save` no dev; a UI deve guardar `dados` em memória e chamar `salvarSave` ao fim da corrida.
- **Cronos (M1):** trocar `regras-save.ts` pelos `Def*` reais; decidir os iniciais (provisório: só `capi` e `morro-do-pinhao`), o ganho de flocos, e a escolha final do elenco (D3 do dono).

## PENDÊNCIAS

- Commit inicial e remoto: Atlas/dono (D8). O CI `ci.yml` nunca rodou.
- Nenhum bloqueio de contrato.

## APRENDIZADO

- Módulo que valida no import precisa de ouvinte de erro registrado ANTES dele: importe o módulo de `#err` primeiro, senão a falha vira tela em branco. Prove com mutação (tirar o import e o e2e tem de reprovar).
- "Equivalente" só se prova com relógio sintético em região de borda (quadro lento, perto do teto), não só em cadência regular: o jitter de 4 a 90 ms achou a divergência que 30 a 144 Hz escondia.
- Camada de dados cujo tipo de contrato está numa camada que a importa: declare a forma por estrutura e teste a atribuição, em vez de abrir a regra de importação.
- WebKit do Playwright no Windows não tem `AudioContext`: teste de áudio multi-motor usa classe falsa injetada por `addInitScript`; o real só onde existe (`test.skip` com motivo).
- `ArmazenamentoResiliente` esconde o modo privado atrás de `estado: 'novo'`: o sinal é `persistente === false`.

## Pós-QA (2026-10-22): correções depois da aprovação com ressalvas da Íris

Íris aprovou o portão do M0 com 3 achados de baixo risco e sujeira. Corrigi tudo; `npm run verificar` verde, sozinho, árvore parada (portas 5273/4273 livres antes): 343 unit, 18 e2e do build, 91 e2e dev (2 skipped que já existiam). Bundle JS 12.602 bytes gzip -9 (meta <= 60 KB).

1. **`textoDoErro` no WebKit** (`src/platform/erros.ts`). Causa raiz: usava `e.stack ?? e.message`; a pilha do V8 começa por "Nome: mensagem", a do JavaScriptCore não, então na `#err` do iPhone um erro em execução saía só com nomes de função. Agora: `Nome: mensagem` sempre; a pilha entra depois se ainda não contém a mensagem; sem pilha, só o cabeçalho. Testes em `neve-plataforma-erros-aviso.test.ts` (pilha no formato do WebKit, pilha ausente, pilha do V8 sem duplicar). Não rodei no WebKit real do iPhone: o formato foi simulado.
2. **Preload das fontes** (`index.html`). Removi os 2 `<link rel=preload>` (opção segura: o fix por `crossorigin` precisaria de medição nos 3 motores e o ganho é pequeno). Quem puxa as fontes antes do 1º quadro continua sendo `carregarFontes`. O teste de `neve-plataforma-fontes.test.ts` agora exige a AUSÊNCIA do preload; os e2e de fontes (dev e build, CSP sem violação) passaram. A economia de ~46 KB no WebKit é número da Íris, eu não medi no iPhone.
3. **Laço único** (`src/platform/laco.ts`). O cabeçalho citava `tests/unit/integracao-laco.test.ts`, que não existe (o real é `integracao-m0.test.ts`); corrigido com os números da Íris: 60 Hz exatos, platform 3599 ticks em 3600 quadros com quadros de 0 e 2 ticks; quadros de 95 ms, platform 3419 x core 3300; jitter 95,1,95,1, divergência de 130 ticks; teto de 6 ticks por quadro igual nos dois. **Decisão:** o M1 usa `core/laco.ts` (`criarLaco().quadro(carimbo, passo)`, `reiniciar()` na retomada) como única fonte de ticks por quadro. Fiz a troca pequena: `platform/laco.ts` cria um laço do core e só mantém rAF, pausa por motivo e parada no erro (o `suspender` chama `reiniciar()`; o erro também). API pública da platform inalterada. Prova: `integracao-m0.test.ts` agora exige sequências IDÊNTICAS quadro a quadro (30 a 144 Hz, jitter 4 a 45 ms, 95 ms, jitter 95/1) e 60 Hz exatos = 1 tick por quadro em 3600 quadros; mutação (recoloquei a conta antiga) reprovou esses testes. Os 15 testes de `neve-plataforma-laco.test.ts` passaram sem mudança. Efeito colateral aceito: pausar zera o resto fracionário do acumulador (o `alpha` do 1º quadro depois da retomada é 0).
4. **CRLF para LF**: os 8 arquivos pedidos (`core/constantes.ts`, `laco.ts`, `rng.ts`, `trig.ts`; `arquitetura`, `core-hash`, `core-rng`, `core-trig` em `tests/unit`) mais `docs/relatorio-curadoria-capi-f2.md` (do Apolo, também tinha CR; conversão só de fim de linha). Conferido com `tr -cd '\r' < f | wc -c` em todo arquivo de texto não ignorado: nenhum CR. Os `.png`/`.woff2` têm bytes 0x0D por natureza (binários).
5. **`.gitignore`**: acrescentei `.claude/`, `dist-*/`, `Thumbs.db`, `.DS_Store`, `.vscode/`, `.idea/`.

**Substitui o achado 1 acima** ("os dois laços não são equivalentes"): resolvido pela troca.

APRENDIZADO: duas implementações da mesma conta de tempo divergem em silêncio; "provado equivalente" precisa de teste que exija igualdade EXATA nos casos de borda, não só tolerância de ±1 em cadência regular. Cabeçalho que cita arquivo de teste precisa ser conferido com `ls`.
