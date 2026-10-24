# src/meta/

**Dono:** Cronos (com Vega nos objetivos).

**Responsabilidade (plano §3.1):** progresso, recordes, objetivos, desbloqueios e a semente do desafio do dia (D7).

**Importa de:** `core/`, `data/`. O salvamento (`storage.ts`, `tipos.ts`) so importa tipos locais: o catalogo de ids entra por
parametro (`RegrasSave`), entao `meta/` nao depende de `data/` para ser testada.

## Estado (M0)

- `tipos.ts`: contrato C4 (`SaveV1`, `Recorde`, `RegrasSave`, `ResultadoCarga`...). So tipos.
- `storage.ts`: `carregarSave`, `salvarSave`, `sanearSave`, `inserirRecorde`, `inserirFantasma`, `ArmazenamentoResiliente`.
  Contrato publico e decisoes em `docs/handoff-cronos-m0.md`.
- `inserirFantasma` (C6, replay/fantasma): grava o `ReplayV1` opaco (`SaveV1.fantasmas`, 1 por pista — a melhor descida
  salva). Pura, igual `inserirRecorde`: devolve save novo ja saneado; pista fora do catalogo ou replay reprovado por
  `RegrasSave.validarReplay` (gancho que `data/regras-save.ts` preenche com `validarReplayV1` do `core/`) nao entra.
  Quem chama decide QUANDO (so quando `inserirRecorde` devolve posicao 0): ver `ui/cenas/gerenciador.ts`.
- Testes: `tests/unit/meta/storage.test.ts` (Node, `Storage` falso em `tests/support/storage-falso.ts`).
- Regra: **mudanca de formato = chave nova** (`neve-maluca-v2`); a v1 fica intacta para rollback de build.

## Campeonato e evolução (C5a, marco corrida em campeonato)

- `campeonato.ts`: `pontosDaPosicao`, `classificacao`, `situacao`, `desempate` (plano C-D1) — puro, opera sobre
  `ResultadoCorrida[]` (o `ordem` de CADA pista, nunca um total guardado). `iniciarCampeonato`/`registrarResultado`
  são o ciclo de vida do `EstadoCampeonato`. Pendência registrada no topo do arquivo: o save só guarda a posição do
  JOGADOR por pista (`PistaConcluidaCampeonato`), não o pódio completo — reabrir o app no meio de um campeonato não
  reconstrói os pontos dos adversários sem decidir o que persistir.
- `tipos.ts`/`storage.ts`: `SaveV1` ganhou `campeonato?`, `trofeus?`, `evolucao?` (todos ADITIVOS, tipos de
  `core/contratos`). Saneados por `sanearCampeonato`/`sanearTrofeus`/`sanearEvolucao`: a `etapa` do campeonato NUNCA
  vem do disco, é sempre `pistasConcluidas.length` depois de saneado (mesmo "nunca confiar num total guardado" da
  classificação). `TETO_NIVEL_EVOLUCAO = 5`, `MAX_CORREDORES_CAMPEONATO = 6`.
- Custos de evolução e a conversão de uma corrida em flocos (`flocosDaCorrida`) ficam em `data/evolucao.ts` (não
  aqui: `meta/` não precisa saber a curva de custo para validar o save, só os limites de forma).

## Ligação no app (integração do M0)

`main.ts` cria UM `ArmazenamentoResiliente` por sessão e chama `carregarSave(armazenamento, REGRAS_SAVE)` no boot (`REGRAS_SAVE` vem de `data/regras-save.ts`, ids provisórios).
**Nada é gravado no boot** (só a cópia `-quebrada` quando o disco tem lixo). O aviso "Progresso não salvo neste aparelho" aparece quando `avisar` é `true` **ou** quando
`!armazenamento.persistente`: com o armazenamento resiliente, `localStorage` bloqueado (modo privado) NÃO dá `indisponivel` (a leitura cai para memória e o estado é `novo`,
`avisar: false`); o sinal é `persistente === false`. O M1 que gravar deve avisar também quando `salvarSave` devolver algo diferente de `'gravado'`
(no Safari privado o `localStorage` existe e só falha na 1ª escrita).
