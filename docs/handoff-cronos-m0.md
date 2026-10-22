# Handoff do Cronos: M0, salvamento `neve-maluca-v1` (C4)

Data: 2026-10-22. Escopo: so armazenamento (camada `meta/`). Sem logica de jogo, sem UI, sem commit. Nao toquei `core/`, `platform/`,
`package.json`, vite nem playwright.

## Arquivos

- `src/meta/tipos.ts`: tipos do contrato (so tipos). `src/meta/storage.ts`: tudo o mais. `src/meta/index.ts`: barril (`export *`).
- `tests/unit/meta/storage.test.ts` (95 testes) e `tests/support/storage-falso.ts` (Storage falso com cota/erros injetaveis).

Origem: tecnica adaptada de `InnoFighters/src/core/storage.ts` e `src/meta/progresso.ts` (estado do disco ausente/ok/futura/corrompida,
`v>N` nunca sobrescrita, copia `-quebrada`, desconhecidos com teto e promocao, saneamento campo a campo). Nota de origem no cabecalho do arquivo.

## Contrato publico (`import ... from '../meta'` ou `'../meta/storage'`)

```ts
carregarSave(armazenamento, regras, migracoes = MIGRACOES): { dados: SaveV1; estado: EstadoCarga; avisar: boolean }
salvarSave(armazenamento, dados, regras): 'gravado' | 'so-memoria' | 'recusado-futuro' | 'falhou'
sanearSave(bruto: unknown, regras): SaveV1            // pura, nunca lanca, idempotente
inserirRecorde(save, pista, recorde, regras): { save: SaveV1; posicao: number | null }   // pura; top 5; 0 = melhor
saveVazio(): SaveV1
new ArmazenamentoResiliente(() => globalThis.localStorage)   // nunca lanca; cai para memoria; .persistente
obterArmazenamentoDoNavegador(alvo = globalThis)             // le localStorage sem lancar (SecurityError)
```

- `armazenamento` e `ArmazenamentoLike` (`getItem/setItem/removeItem`, `persistente?`); aceita `null/undefined`.
- `EstadoCarga`: `novo` | `ok` | `migrado` | `recuperado` (lixo no disco; copiado para `neve-maluca-v1-quebrada`) | `futuro` (`v>1`) | `indisponivel`.
  `avisar === true` em `futuro` e `indisponivel`: a UI mostra "Progresso nao salvo neste aparelho". Tambem avisar quando `salvarSave`
  devolver qualquer coisa diferente de `'gravado'`.
- `RegrasSave` e **obrigatoria e sem padrao** (catalogo vazio mandaria todo id real para `desconhecidos` em silencio):
  `{ personagens, iniciais, pistas, pistasIniciais, objetivos, versaoPista?: Record<IdPista,string>, validarReplay?: (r) => boolean }`.
  **Quem monta o jogo (data/) entrega as regras**; hoje so os testes as montam (ids falsos). `versaoPista` = `PistaGerada.versaoGerador` atual de cada pista.
- Formato `SaveV1` = C4 do plano (`v, cfg, prog, recordes, fantasmas?, diario?`) mais dois campos ADITIVOS opcionais, ausentes quando vazios:
  `recordesAntigos` (recorde de outra `versaoPista`: nao compete, nao some, ate 5/pista) e `extras` (campos de raiz desconhecidos).
- Defaults de `cfg` (decisao minha, ajustavel em `CONFIG_PADRAO`): `som 0.8`, `musica 0.6`, `movimentoReduzido false`, `controles 'gestos'` (D10), `maoEsquerda false`.
- Constantes exportadas: `CHAVE_SAVE`, `CHAVE_SAVE_QUEBRADA`, `TETO_PONTOS` (99.999.999), `TETO_FLOCOS` (999.999), `TETO_TICKS` (1.000.000),
  `MAX_RECORDES_POR_PISTA` (5), `MAX_DESCONHECIDOS` (32), `FORMA_ID` (`/^[a-z][a-z0-9-]{1,23}$/`: ids novos de personagem/pista/objetivo TEM que seguir esta forma).

## Regras de saneamento (resumo)

- Numeros: inteiros, nao negativos, com teto; fracao perde a fracao; NaN/Infinity/texto/acima do teto -> 0 (campo) ou registro descartado (recorde). Volume: preso em 0..1.
- Listas: sem repeticao; iniciais nunca gravados; cada lista aceita so ids do SEU catalogo; so os 1024 primeiros itens sao lidos.
- Id fora do catalogo, com `FORMA_ID` -> `prog.desconhecidos` (teto 32; os ja gravados tem prioridade); promovido quando o id passa a existir.
- Recorde: valida cada campo (`quando` = ISO UTC `...Z` validado sem `Date`); registro adulterado e descartado inteiro. Recordes de pista desconhecida (build futuro) sobrevivem (ate 32 pistas).
- `fantasmas`: replay opaco (JSON simples, <= 96 KB, ate 8 no total); validacao real pelo gancho `validarReplay` (do `core/`).
- `extras`: ate 16 campos de raiz, 2 KB cada, 8 KB no total; no disco ficam na RAIZ (um build mais novo os le onde escreveu). O nome `extras` e reservado.
- Disco: `v===1` ok; `v` numerico `>1` (inclui 1.5 e 1e999) = futura (lida em memoria, **nunca sobrescrita**, byte a byte); qualquer outra coisa (JSON ruim, `null`, `[]`, `v` texto/0/negativo, texto > 1,5 MB) = corrompida: copia para `neve-maluca-v1-quebrada` (a primeira evidencia nao e sobrescrita) e comeca do zero. `carregarSave` so escreve a copia quebrada e o resultado de uma migracao.

## Migracao e rollback

- v1 e inaugural: `MIGRACOES = []`. O gancho existe (`Migracao { de, chave, migrar }`, parametro de `carregarSave`) e esta provado com uma v0 falsa:
  migra uma vez, grava a v1, **nunca altera nem apaga a chave antiga**, e a v1 valida tem prioridade sobre a antiga.
- Mudanca de formato = **chave nova** (`neve-maluca-v2`). Um build v1 num aparelho que ja tem a v2 le a v1 intacta e nunca toca a v2 (teste de rollback).
  Se a v2 precisar do progresso feito no build v1 depois do rollback, a mescla (como o `max(hi)` do InnoFighters) e regra da migracao v1->v2, nao daqui.

## O que foi provado (rodado aqui, 2026-10-22)

- `npm run typecheck`, `npm test` (17 arquivos, 315 testes, os 95 de `meta/` incluidos), `npm run build`: verdes. Nao rodei os e2e (nao ha UI/laco de salvamento).
- Mutacao: 42 mutantes aplicados a `storage.ts` numa COPIA isolada (fora do projeto), todos reprovados pelos testes (futura sem deteccao, salvar sobre futura,
  sem copia quebrada, copia sobrescrita, sem clamp, NaN aceito, sem tetos, sem promocao, ordem de recordes, versao velha competindo, extras aninhando,
  migracao que apaga a antiga, gravacao que lanca, memoria que nao libera, etc.). Roteiro: `mutar.mjs` no scratchpad da sessao (nao versionado).
- O fuzz deterministico (2000 entradas) achou um bug real durante a obra: `extras` re-lido como campo desconhecido aninhava a cada ciclo. Corrigido (`paraDisco`) com teste.
- Pureza: teste le `storage.ts` e prova que nao usa `Date`, `Math.random`, `performance`, `window`, `document` e que so importa `./tipos`.

## O que NAO foi provado

- Nenhum `localStorage` real de navegador (Chromium/WebKit/iPhone, cota, modo privado do Safari): so Storage falso em Node. Pede um e2e quando Lyra ligar o salvamento.
- Duas abas gravando ao mesmo tempo: ultima gravacao vence (sem merge). Em jogo de uma aba so, risco baixo; anotar se o dono quiser multi-aba.
- `main.ts` ainda nao importa `meta/`; por isso o build nao inclui o modulo (tree-shaking). Quem ligar o salvamento importa de `../meta`.
- Custo de bytes no `localStorage` do pior caso: so limitado por teste de comprimento (< 1,5 MB), nao medido em navegador.

## Para o proximo

- **Vega/Lyra**: chamar `carregarSave(new ArmazenamentoResiliente(), regras)` no boot (um objeto resiliente para a sessao inteira); guardar `dados` em memoria; chamar
  `salvarSave(armazenamento, dados, regras)` ao fim da corrida/mudanca de opcoes (nao a cada quadro); usar `inserirRecorde` e mostrar o aviso quando `avisar`/resultado != `'gravado'`.
  `quando` do recorde e o chamador que fornece (ISO UTC); o storage nao le relogio.
- **data/ (Cronos, M1)**: criar o modulo que monta `RegrasSave` a partir de `DefPersonagem/DefPista/DefObjetivo` (ids com `FORMA_ID`, `iniciais`, `pistasIniciais`, `versaoPista`).
- **Iris**: e2e com `localStorage` real (gravar, recarregar, `neve-maluca-v1` com lixo/`v:2` plantado via `page.addInitScript`, modo privado).

## Pendencias (decisao de negocio)

1. Quais personagens/pistas sao "iniciais" e se objetivos cumpridos viram `flocos` (o plano so cita as listas e o saldo). O storage guarda o saldo; a regra de ganho/gasto e do jogo.
2. Defaults de volume (0,8/0,6) e se `movimentoReduzido` deve nascer de `prefers-reduced-motion` (a UI pode aplicar o padrao do aparelho quando `estado === 'novo'`).
3. Politica de dados (D6/privacidade): o save tem so preferencias, progresso e recordes (sem nome, sem dado pessoal, sem rede). Se o ranking online (D4) vier, `fantasmas`/replays viram dado enviado: rever.

## Aprendizado

- Campo "livre" que o saneador devolve em memoria (`extras`) e um campo conhecido do tipo: se for serializado como esta, na leitura seguinte vira "desconhecido" e aninha. Converter para a forma de disco (`paraDisco`) na gravacao e aceitar as duas formas no saneador.
- `Object.hasOwn` e chaves por regex de id (nao `obj[id]`) evitam `constructor`/`__proto__` como id; JSON.parse cria `__proto__` como chave propria, entao clones passam por reviver que a remove.
- Windows: a ferramenta de escrita gerou CRLF; `.editorconfig` manda LF. Conferir com `file` antes de entregar.
