# Handoff da Vega: M0, `src/core/`

Data: 2026-10-22. Escopo: núcleo puro (sem lógica de descida/física, que é o M1). Nenhum commit. Não toquei em `src/platform`, `src/meta`,
`package.json`, `vite.config.ts` nem nos configs do Playwright.

## O que foi provado (rodado aqui, Windows, Node 24)

- `npm run typecheck`: limpo. `npm test`: 17 arquivos, 315 testes verdes (os meus: `tests/unit/arquitetura.test.ts` e 6 arquivos `core-*.test.ts`, 135 testes). `npm run build`: ok (o `core/` ainda não é importado por `main.ts`, então o JS do build não mudou: 13,4 kB, 5,6 kB gzip).
- Tamanho do `core/` inteiro, minificado e SEM tree-shaking (build de biblioteca de teste): 14,7 kB, **6,1 kB gzip**.
- **Mesmo resultado em V8 (Node e Chromium) e em JavaScriptCore (WebKit do Playwright)**: `tests/e2e/core-determinismo.spec.ts` importa o `core/` real pelo dev server nos 3 projetos (desktop, celular, webkit-se) e confere hash das tabelas de trig, hash de 17 985 saídas de seno/cosseno/atan2, hash de valor, RNG, RLE e 600 ticks do laço. 3 de 3 verdes. Limite: WebKit do Playwright no Windows prova o motor JavaScript, não o aparelho (plano §8).
- Mutação (defeito plantado, teste tem de reprovar), feita à mão em 6 pontos do `src/core/` (laço sem teto, primo do hash, interpolação do seno, repetição máxima do RLE, constante do RNG, octante do atan2): os testes de cada área reprovaram nos 6. O teste de arquitetura tem mutação embutida (ver abaixo).
- `npm run verificar` completo **não ficou verde nesta máquina por causa de 5 testes de `tests/e2e/neve-plataforma.spec.ts` (Lyra)**, todos com `ENOENT` em `test-results/.playwright-artifacts-*/traces/...`. Parece colisão de duas execuções do Playwright ao mesmo tempo apagando `test-results/` (Lyra roda em paralelo). Não investiguei a fundo (é código dela); os meus specs e o `fumaca.spec.ts` passam sozinhos. Íris deve rodar `verificar` com a árvore parada.

## API pública (o que Lyra, Cronos e as camadas de cima podem importar)

Importe por arquivo (`../core/rng`) ou pelo barril (`../core`). O barril roda `exigirCoreValido()` no import. Tudo exportado de `src/core/`:

**Constantes (`constantes.ts`)**
- Tela: `LARGURA_LOGICA`=960, `ALTURA_LOGICA`=540, `ESCALA_BUFFER`=2, `LARGURA_BUFFER`=1920, `ALTURA_BUFFER`=1080, `PROPORCAO_TELA`. **Aliases com os nomes que a `platform/` já usa:** `LARGURA`, `ALTURA`, `RS`, `ACUMULADOR_MAXIMO_MS`. Então `platform/constantes.ts` pode virar um `export { LARGURA, ALTURA, RS, LARGURA_BUFFER, ALTURA_BUFFER, PASSO_MS, ACUMULADOR_MAXIMO_MS } from '../core/constantes'` sem mudar mais nada.
- Tempo: `TICKS_POR_SEGUNDO`=60, `PASSO_MS`, `PASSO_S`, `ACUMULADOR_MAX_MS`=100, `MAX_PASSOS_POR_QUADRO`=6.
- Mundo: `DX_PISTA_M`=0,5, `PX_POR_METRO`=40 (**ponto de partida para afinar no M1a**, só render), `ZOOM_PARADO`=1, `ZOOM_VELOCIDADE_MAX`=0,8.
- `CANAL_RNG` (logica 0, visual 1, ui 2, audio 3, falas 4); limites de dado externo: `TETO_TICKS_REPLAY`=18000 (5 min), `TETO_PONTOS`=99 999 999, `FORMA_ID` (`/^[a-z][a-z0-9-]{1,23}$/`, a do C4).

**RNG (`rng.ts`)**: `criarRng(semente)` -> `Rng { proximo, entre, inteiro, escolher, estado }`; `criarRng(r.estado())` retoma a sequência de onde parou (estado é uint32, sobrevive a JSON). `rngDoCanal(semente, 'logica'|'visual'|'ui'|'audio'|'falas')`. `sementeAleatoria(fonte)`: a entropia entra por parâmetro (passe `globalThis.crypto`); o núcleo não tem `Math.random` nem `Date`. `inteiro(n)` lança `RangeError` se `n` não for inteiro >= 1 (diferente do InnoFighters, que devolvia lixo).

**Trigonometria (`trig.ts`)**: `seno(graus)`, `cosseno(graus)`, `atan2(y, x)` (devolve graus em (-180, 180], mesma ordem de argumentos do `Math.atan2`), `normalizarGraus`, `grausParaRadianos`/`radianosParaGraus` (para o render), variantes inteiras `senoU`/`cossenoU`/`grausParaUnidades`/`unidadesParaGraus` (2^24 unidades por volta).

**Hash (`hash.ts`)**: `criarHasher().texto().f64s().u32()....hex()`, `hashDeTexto`, `hashDeBytes`, `hashDeFloat64s`, `hashDeValor(valor)` (dado estruturado: chaves em ordem, tipos etiquetados, Float64Array/Int32Array/Uint8Array), `exigirHashIgual(rotulo, esperado, obtido)`, `FORMATO_HASH`. Saída: 16 dígitos hex minúsculos.

**Contratos (`contratos.ts`)**: `ComandoDescida`, `InputFrame`, `Grab`/`GRABS`, `Giro`, `LeituraDescida`, `EventoDescida`, `PilotoLeitura`, `ComboLeitura`, `DefPista`, `PistaGerada`, `ObjetoPista`, `Trilho`, `ReplayV1`, `ResultadoReplay`, e os ids (`IdPista`, `IdPersonagem`... por ora `string`). **Não inclui o C4** (é do Cronos, `meta/`).

**Comandos (`comandos.ts`)**: `COMANDO_NEUTRO`, `INPUT_NEUTRO`, `derivarComando(anterior, atual)`, `byteDoComando`/`comandoDoByte`, `validarComandoDescida`, `validarInputFrame`.

**Replay (`replay.ts`)**: `codificarComandos(cmds)` / `decodificarComandos(texto, maxTicks?)` -> `Resultado`; `validarReplayV1(x)` -> `Resultado<ReplayV1>` (devolve cópia só com os campos conhecidos; confere formato, limites e que os comandos decodificam; NÃO reexecuta o motor). `base64Codificar`/`base64Decodificar`.

**Laço (`laco.ts`)**: `criarLaco({ passoMs?, maxAcumuladoMs? })` -> `{ quadro(agoraMs, passo), alfa(), ticks(), reiniciar(agoraMs?) }`.

**Erros/boot (`erros.ts`, `validacao.ts`)**: `Resultado<T>` (`ok`/`falha`), `ErroDeContrato { codigo, detalhes }`, `exigir`, `exigirCoreValido()`, `problemasDasConstantes()`, `problemasDasPecas()`.

## Contratos, na forma como foram implementados (para a Lyra)

- **`InputFrame` é minha interpretação** (o briefing só o citava): quadro BRUTO do dispositivo, um por tick, `{ pular (segurado), giro, grab (já é evento), agachar }`. `input/` produz `InputFrame`; `derivarComando(anterior, atual)` gera o `ComandoDescida` (o `pulo` vira borda). O motor só vê `ComandoDescida`. Se a Lyra prefere que `input/` já entregue a borda pronta, é só pular o `InputFrame` e devolver `ComandoDescida` direto; nada no `core/` obriga o intermediário.
- `ComandoDescida` e todos os campos de `LeituraDescida`/`EventoDescida` são **`readonly`** (o plano os mostrava mutáveis). Os comandos decodificados do replay são objetos compartilhados e congelados.
- `PilotoLeitura.angulo`/`anguloTerreno` são em **graus**, convenção do `trig.ts` (0 = +x, anti-horário, y para cima). O render converte com `grausParaRadianos` para o canvas.
- `ObjetoPista`/`Trilho`/`TIPOS_OBJETO` são **propostas minhas** (o plano não definiu os campos). O gerador do M1 pode ajustá-los; avisem antes de a Lyra depender deles.
- Formato do replay: ver cabeçalho de `comandos.ts` (byte do tick: bit0 pulo, bits1-2 giro 0/+1/-1, bits3-5 grab 0..4, bit6 agachar) e de `replay.ts` (pares `[byte, repetições 1..255]`, base64 com `=`). Mudar isso exige `ReplayV1` `v: 2`.

## Decisões de trigonometria (e por quê)

1. **Tabela construída só com `+ - * /`** (série de Taylor em `trig-tabelas.ts`), nunca com `Math.sin/atan`. Essas quatro operações são definidas bit a bit pelo IEEE 754/ECMAScript; as funções do `Math` não. Se eu tivesse montado a tabela com `Math.sin` no import, o iPhone poderia montar uma tabela com um bit diferente e o hash de pista divergiria.
2. **Interpolação em inteiros, ponto fixo 2^30.** Ângulo em 2^24 unidades por volta (0,0000215°), tabela de seno de um quarto de volta em 1024 passos, tabela de atan de 0 a 1 em 1024 passos. Saída = inteiro / 2^30 (divisão por potência de 2, exata). Não há erro de arredondamento dependente do motor.
3. **`Math.sqrt` é permitido** (o plano §3.3 o declara exato; é correto em IEEE 754). A tabela de atan **não** o usa. A lista permitida de `Math.*` no motor: `abs ceil floor round trunc sign min max sqrt imul fround clz32 PI SQRT2`. O operador `**` também é proibido (é `Math.pow`).
4. **Unidade da API: graus**, porque o plano pensa em graus (janela de pouso de 20°, inclinação de 5° a 35°) e o motor compara ângulos com esses limites. Variantes `*U` em unidades inteiras existem para quem quiser contar sem float.
5. **Precisão medida** (contra `Math.sin`/`Math.atan2` dentro do teste): seno/cosseno erro máximo **3,5e-7** (varredura de 720 mil pontos e 200 mil sorteios em ±1e6°); atan2 erro máximo **4,9e-6 grau** (600 mil pontos + 200 mil vetores de escala 1e-6 a 1e6). Monotonicidade provada em **todas** as 8,4 milhões de unidades de 0° a 180° (o resto por simetria exata, conferida em toda a volta de 3 em 3 unidades) e em varreduras do cosseno e do atan2.
6. **Entrada não finita devolve `NaN`** (não vira ângulo qualquer em silêncio). `senoU` com não inteiro também. `atan2(0,0)` = 0; `y = -0` conta como 0 (então `atan2(-0, -1)` = +180, não -180). Nunca devolve `-0`.
7. **Tabelas travadas por hash** (`HASH_TABELAS_TRIG`, conferido no import de `trig.ts`: divergência derruba o boot com `ErroDeContrato('trig-tabela-divergente')`). Mudança PROPOSITAL de tabela = trocar o hash fixo e tratar como mudança de versão do motor (recordes e fantasmas antigos).
8. Ângulo enorme (acima de ~1e11 graus) perde precisão no `Math.round`, mas continua determinístico. Não ocorre no jogo (o `anguloAcumulado` de um mortal fica em centenas de graus).

## Teste de varredura (`tests/unit/arquitetura.test.ts` + `tests/support/varredura.ts`)

- **Camadas**: a tabela do plano §3.1 (11 camadas) com matriz completa 11x11 de mutação (121 casos: planta-se `import ... from '../X/index'` em cada camada e confere que reprova exatamente quando o plano proíbe). O arquivo de teste tem uma segunda cópia da tabela escrita à mão; afrouxar a regra em `varredura.ts` faz o teste reprovar. Também: grafo sem ciclo; formas de importe (type, `export from`, efeito, `import()` literal, `import.meta.glob`); `import()` não literal reprova; pacote externo (`node:fs`, `zod`...) reprova (hoje nenhuma dependência de runtime é permitida); import que sai de `src/`; pasta nova em `src/` que não é camada reprova até alguém registrá-la.
- **Arquivos soltos da raiz**: `main.ts` importa tudo; `versao.ts` só `ui`, `platform` e `main` (decisão minha, o plano não diz; é fácil ajustar em `RAIZ_IMPORTAVEL_POR`); `estilo.css` só o `main`; arquivo novo na raiz só o `main` até ser registrado.
- **Textos proibidos**, com escopo por camada: `Math.random` em TODO `src/`; em `core`, `pista`, `descida`: qualquer `Math.*` fora da lista permitida (inclui `const m = Math`, `Math['sin']`, desestruturação), `**`, `Intl`/`toLocale*`/`localeCompare`, `crypto`, `eval`/`new Function`, `globalThis/window/document/navigator/localStorage/sessionStorage/process/require`; em `core`, `pista`, `descida` **e `audio`** (o plano §3.8 diz que o áudio também não usa): `Date`, `performance`, timers e `requestAnimationFrame`. Escopo: o briefing pediu `descida/pista/core`; **estendi** `Math.random` a todo `src/` e relógio ao `audio/`; não apliquei determinismo a `data/` nem a `meta/` (Cronos usa `Date`? o `meta/` pode).
- **Sem falso positivo**: um analisador léxico tira comentários e o miolo de strings/templates/regex antes de procurar, mantendo as posições (a linha acusada confere). Expressões `${...}` dentro de template contam como código.
- **Prova de que reprova**: mutação em memória sobre os arquivos reais (`core/rng.ts`, `trig.ts`, `hash.ts`, `laco.ts` + 4 defeitos cada), mutação em disco (copia mini `src/` para pasta temporária, planta o defeito, varre o disco), exemplo por regra em toda camada (reprova onde vale, passa onde não vale), cada função proibida do plano uma a uma em `descida/`, `pista/` e `core/`.
- **Limite**: é varredura de TEXTO, não de tipos nem de execução. `globalThis['Ma' + 'th']` escaparia fora do `core/pista/descida` (e lá `globalThis` é proibido). Existe para o descuido, não para o sabotador. Quem confere o resultado de verdade é o hash da pista e o hash do replay.

## O que cada frente faz com isso

- **Cronos**: `storage.ts` está bem em `src/meta/` (a regra do plano deixa `meta` importar `core`). Use `FORMA_ID`, `TETO_PONTOS`, `TETO_TICKS_REPLAY` e `validarReplayV1` (para `fantasmas`) de `core/`. Para `DefPista.hashEsperado` use `hashDeValor`/`criarHasher` e `exigirHashIgual`. Se `data/` ou `meta/` precisarem de `Date`, o teste de arquitetura não proíbe (não está no escopo dessas camadas).
- **Lyra**: troque `platform/constantes.ts` pelo re-export de `core/constantes` (nomes já compatíveis). `core/laco.ts` é o passo fixo puro; o laço do `platform/laco.ts` pode chamar `criarLaco().quadro(carimbo, atualizar)` dentro do `requestAnimationFrame` e ganhar o teste de cadência/teto de graça. `input/` produz `InputFrame` e usa `derivarComando`.
- **Íris**: as propriedades estão em `core-*.test.ts` (RNG retomado em qualquer ponto, RLE ida e volta em 400 corridas aleatórias, fuzz do decodificador com 20 mil textos, FNV contra oráculo BigInt em 3 mil sequências, laço com relógio sintético e parada de até 1 hora). Falta, e é M1: o hash de estado em 5400 ticks (precisa do motor).
- **Órion**: revisar `replay.ts` (decodificador de dado externo: teto de ticks antes de alocar, base64 canônico, byte inválido, repetição 0) e `hash.ts` (não é criptográfico, dito no cabeçalho; só detecta mudança acidental, não serve para autenticar replay sem reexecução).

## Pendências / riscos

- **`npm run verificar`: 5 falhas em `neve-plataforma.spec.ts` (Lyra)**, ver acima. Não são do `core/`.
- `ObjetoPista`/`Trilho`/`TIPOS_OBJETO` e a escolha de `InputFrame` precisam do "de acordo" do Atlas/Nova antes de a Lyra e o gerador do M1 se apoiarem neles.
- Ids (`IdPista` etc.) são `string` até o Cronos fixar os catálogos em `data/`.
- Falta ligar `exigirCoreValido()` no boot real: ou `main.ts` importa `./core` (barril), ou `data/` importa `../core`. Hoje nada importa o `core/` no app, então o build não o inclui.
- A versão do motor/gerador (`ReplayV1.versaoMotor`, `PistaGerada.versaoGerador`) não tem constante ainda: nascem no M1 junto com o motor. O validador só exige texto de 1 a 32 caracteres.

## APRENDIZADO (também registrado na memória da Vega)

- Hash estável entre motores: alimente em bytes com ordem e endianness explícitos (DataView little-endian), canonicalize `-0` e NaN, e nunca derive tabela com `Math.sin` (só `+ - * /`).
- Teste de propriedade sem biblioteca nova: o próprio `criarRng` com semente fixa gera as entradas; em laços quentes, conte falhas e faça UM `expect` no fim (um `expect` por iteração custou 2,7 s em 100 mil iterações).
- Conta de combinações: o byte de comando tem 2x2x3x5 = **60** combinações válidas, não 120 (errei a conta no primeiro teste, o teste pegou).
- Vitest rodando em paralelo com outro agente na mesma pasta pode estourar `testTimeout` de 5 s em teste pesado: o varrimento exaustivo do seno ganhou timeout próprio de 60 s.
