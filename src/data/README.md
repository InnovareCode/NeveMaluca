# src/data/

**Dono:** Cronos. **Estado no M0:** só o catálogo provisório de ids do save (`regras-save.ts`).

**Responsabilidade (plano §3.1, §3.9):** personagens, pistas (`DefPista`), catálogo de trechos, manobras, objetivos e
textos pt-BR. Cada módulo valida seus dados **no import** (`exigir*Validos`): dado inválido derruba o boot com tela de
erro clara, nunca um jogo meio quebrado. `main.ts` importa esses módulos para o tree-shaking não os remover.

**Importa de:** `core/`.

**Regras:** dados puros (sem DOM, áudio, render). Textos em tabela, prontos para um segundo idioma (D6).

## Estado (M0)

- `regras-save.ts`: ids **provisórios** (vêm de `docs/direcao-arte-neve-maluca.md` §2-§3 e do plano) e `REGRAS_SAVE`, o que o `meta/storage.ts` pede
  em `carregarSave(armazenamento, regras)`. Personagens `capi`, `bandeira`, `cidinha`, `beto`, `queque`, `bia` (inicial: `capi`); pistas
  `morro-do-pinhao` (inicial), `pico-do-picole`, `vila-chocolate`, `vulcao-pe-gelado`, `cume-da-ventania`; 3 objetivos por pista (`<pista>-o1..o3`);
  `versaoPista` = `"provisoria"` até o gerador existir. Valida no import (`exigirRegrasSaveValidas`: `FORMA_ID`, repetição, iniciais existentes).
- `meta/` importa `data/`, então `data/` **não** importa o tipo `RegrasSave`: declara a forma por estrutura (`RegrasDoCatalogo`) e o teste
  `tests/unit/integracao-m0.test.ts` prova que ela é atribuível a `RegrasSave`.
- **Trocar id depois de haver save gravado** manda o id antigo para `prog.desconhecidos` (não se perde, mas some da UI). Renomear só antes de haver jogador.
- Cronos substitui esta tabela pelos `DefPersonagem`/`DefPista`/`DefObjetivo` reais no M1 (e decide os iniciais, o ganho de flocos e a escolha final do elenco, D3).
- `objetivos.ts`: as 5 pistas têm 3 objetivos cada agora (Morro ganhou os seus no C5a); `CUME_O2` usa
  `maiorComboManobras` (não `maiorMult` — ×6 é impossível, só 4 famílias de manobra existem).
- `evolucao.ts` (plano C-D3/C-D4, C5a): custo em flocos por nível (1 nível por personagem, até 5), e
  `flocosDaCorrida` (conversão de `ResultadoCorrida` em flocos ganhos — hoje plugada em `0` em `corrida/corrida.ts`,
  Vega conecta). `aplicarEvolucao` (a física do upgrade) NÃO mora aqui: é `descida/atributos.ts`, C6.
