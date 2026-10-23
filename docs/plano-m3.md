# M3 de verdade: física por personagem e as 5 pistas com tema próprio (plano faseado)

> **Autora:** Nova (arquitetura), 2026-10-23. **Estado:** PLANO, nada implementado.
> **Base:** `docs/plano-neve-maluca.md` (§3.3 motor, §3.4 gerador, §4 contratos, §7 M3, §8 critérios),
> `docs/elenco-m3.md` (§1 casas, §4 atributos), `docs/direcao-arte-neve-maluca.md` (§2 mundo e paletas).
> **Código conferido:** `src/descida/{constantes,motor,replay,bot}.ts`, `src/pista/{gerador,catalogo}.ts`,
> `src/data/{pistas,regras-save}.ts`, `src/core/contratos.ts`, `src/meta/tipos.ts`, `src/ui/cenas/{descida,gerenciador}.ts`,
> `src/render/parallax.ts`, `ferramentas/harness/cli.mjs`, `tests/unit/descida-bot-harness.test.ts`.

---

## 0. Contexto e hipóteses (declaradas)

| Item | Hipótese | Efeito no desenho |
|---|---|---|
| Escala | jogo de navegador, 1 jogador por aparelho, sem backend (D4 = ranking só local) | tudo continua cliente puro; nada de serviço novo |
| Maturidade | MVP jogável no ar (M0 a M2 prontos), M3 é **conteúdo**, não fundação | reaproveitar motor, gerador, harness e save; **zero reescrita** |
| Equipe | squad de agentes; o Vega é o gargalo (motor, gerador e bot são dele) | trilhas paralelas que não dependem do Vega (Apolo, Lyra, Cronos, Íris) |
| Prazo | não informado | plano por fases com portões, sem datas |
| Inegociável | **a sensação da Capi** (`CONFIG_PADRAO`, aprovada pelo dono no M1/M2) e os **recordes do Morro do Pinhão** que o dono já tem | dois testes de "congelamento" entram ANTES de qualquer mudança (Fase 0) |

O que **já existe** e não se refaz: seleção de personagem, `personagemAtivo` no save, replay C6, fantasma e recordes por
pista, `ConfigDescida` injetável (`criarDescida(pista, config?)`), gerador por semente com catálogo de trechos e
`hashEsperado`, bot "cuidadoso" e harness CLI (`npm run harness`).
O que **não existe**: física por personagem, pistas 2 a 5, tema visual por pista, objetivos avaliados, gating de
desbloqueio, seleção de pista, coletáveis (`coletados` é sempre 0 no motor).

### Três achados no código que mudam o desenho
1. **"Aceleração" não cabe no atrito.** No chão, `a = −g·sen(θ) − atrito·v − arrasto·v²`. Com `atrito = 0,02`, a 10 m/s o
   termo é 0,2 m/s², contra 4,6 m/s² da gravidade num declive de 12°. Mexer no atrito seria imperceptível. Por isso a
   aceleração ganha um campo próprio, `fatorEmbalo` (§A.2).
2. **O fantasma não sabe quem correu.** `criarReprodutorFantasma` chama `criarDescida(pista)` com `CONFIG_PADRAO` e nunca
   lê `replay.personagem` nem `replay.versaoMotor`. Com física por personagem, o fantasma do Tio Beto rodaria com a física
   da Capi e sairia da pista. É preciso corrigir isso na Fase 1.
3. **O "Capi não muda" não está travado por teste.** Há determinismo entre rodadas, mas nenhum hash golden de uma
   corrida inteira. Sem ele, "a Capi continua igual" é opinião. Fase 0.

---

## A. Física por personagem

### A.1 Como a tabela da §4 vira número do motor: 3 opções

| Opção | Como | Prós | Contras |
|---|---|---|---|
| **A1. Relativa à Capi, linear, com ganho por atributo** (recomendada) | `campo = base × (1 + sentido × ganho × (atrib − atribCapi) / 100)` | a Capi devolve `CONFIG_PADRAO` **bit a bit** (multiplicar por 1 é exato em IEEE 754); a tabela continua sendo a fonte; o ganho é o único botão de afinação e preserva quem é forte em quê | ganho é mais um número para afinar |
| A2. Tabela de `ConfigDescida` escrita à mão por personagem | 6 configs completas | controle total | a tabela §4 vira enfeite, o orçamento soma 500 deixa de significar algo, e cada afinação mexe em ~20 números × 6 |
| A3. Normalizada à média 100 | `campo = base100 × atrib/100`, com `base100 = padrão × 100/atribCapi` | parece mais "limpa" | **quebra a identidade da Capi**: `padrão × 100/90 × 90/100` não volta exatamente ao `padrão` em ponto flutuante, e o hash da Capi muda. Descartada |

**Recomendação: A1.** É a única que dá a garantia que o dono precisa ("a Capi é a mesma") por construção, e não por
tolerância.

**Atenção à escala:** a Capi não é 100 em tudo (giro 90, equilíbrio 110). Medido a partir dela, a diferença chega a
**±20%** (ex.: giro da Cidinha 110 contra 90 da Capi), e não aos ±10% da média que a tabela sugere. Isso é intencional:
a Capi é a "de iniciante", então todos giram mais rápido que ela e ninguém pousa melhor que ela. O ganho existe para
encolher esse efeito, se o harness pedir.

### A.2 Mapa atributo → campo do motor (números de partida; quem afina é a Íris com o harness)

| Atributo | Campo(s) de `ConfigDescida` | Sentido | Ganho inicial | Exemplo nos extremos |
|---|---|---|---|---|
| velocidade | `velocidadeMaxMs` | + | 0,6 | Beto 110 → 29,68 m/s · Quequé 90 → 26,32 (Capi 28) |
| aceleração | **`fatorEmbalo` (novo, padrão 1)** · `velocidadeRespawnMs` | + · + | 0,8 · 1,5 | Quequé 110 → embalo 1,08, respawn 4,6 · Bandeira 90 → 0,92 |
| giro | `giroVelMaxGrausPorTick` · `giroAcelGrausPorTick2` | + · + | 1,0 · 1,0 | Cidinha 110 → 7,2 °/tick (Capi 6) |
| equilíbrio | `limiarPerfeitoGraus` · `limiarBomGraus` · `limiarTortoGraus` | + | 1,0 | Beto 90 → 6,4 / 19,2 / 46,4° (Capi 8 / 24 / 58) |
| pulo | `impulsoPuloMs` | + | 1,0 | Bandeira 110 → 6,6 m/s · Cidinha 90 → 5,4 |

**Nunca variam por personagem (são regras do mundo):** `gravidadeMs2`, `atrito`, `atritoAgachado`, `arrasto`,
`fatorRampaMsPorGrau`, `atrasoGiroTicks` (é contrato de controle: "um toque rápido é só um pulo"), `amortecimentoGiro`,
`fatorPerdaBom/Torto`, `ticksTombo`, `fatorBonecoDeNeve`, `velocidadeMinimaChaoMs`.

**`fatorEmbalo`** multiplica só a componente da gravidade **no chão**:
`aceleracao = −gravidadeMs2 × fatorEmbalo × seno(θ) − …`. Com 1, a conta `(−g × 1) × s` dá exatamente `−g × s`, então o
hash da Capi não muda. Como a velocidade de cruzeiro quase sempre bate no teto, "mais embalo com teto mais baixo" produz
exatamente o Quequé da ficha: arranca bem e perde no fim da reta.

### A.3 Contratos da parte A

```ts
// core/contratos.ts (dono: Vega; mudança aprovada pelo Atlas)
export const ATRIBUTOS = ['velocidade', 'aceleracao', 'giro', 'equilibrio', 'pulo'] as const;
export type Atributo = (typeof ATRIBUTOS)[number];

export type RequisitoDesbloqueio =
  | { readonly tipo: 'inicial' }
  | { readonly tipo: 'concluir'; readonly pista: IdPista }      // concluir a pista uma vez
  | { readonly tipo: 'objetivos'; readonly total: number };      // N objetivos somados no jogo todo

export interface DefPersonagem {
  readonly id: IdPersonagem;                 // os 6 ids JÁ gravados em regras-save (não renomear: o save usa)
  readonly nome: string;
  readonly bordao: string;
  readonly nomeAssinatura: string;           // Cauda-Vela, Novelo Supersônico... É nome e pose, NUNCA bônus de pontos
  readonly atributos: Readonly<Record<Atributo, number>>; // inteiros 90..110, soma 500
  readonly casa: IdPista;
  readonly desbloqueio: RequisitoDesbloqueio;
}

// descida/constantes.ts: ConfigDescida ganha `fatorEmbalo: number` (CONFIG_PADRAO.fatorEmbalo = 1)

// descida/atributos.ts (novo, Vega). Puro, sem Math.pow.
export const PERSONAGEM_REFERENCIA: IdPersonagem = 'capi';
export interface RegraAtributo { readonly campo: keyof ConfigDescida; readonly sentido: 1 | -1; readonly ganho: number }
export const MAPA_ATRIBUTOS: Readonly<Record<Atributo, readonly RegraAtributo[]>>;
export function configDoPersonagem(def: DefPersonagem, ref: DefPersonagem,
  mapa?: typeof MAPA_ATRIBUTOS, base?: ConfigDescida): ConfigDescida;

// descida/replay.ts: a assinatura muda
export function criarReprodutorFantasma(replay: ReplayV1, pista: PistaGerada, config: ConfigDescida): Resultado<ReprodutorFantasma>;
```

- **Validação no import** (`data/personagens.ts`, padrão `exigir*Validos`): ids iguais aos de `REGRAS_SAVE.personagens`;
  atributos inteiros entre 90 e 110; soma igual a 500; `casa` existe; existe exatamente uma referência (`capi`).
  Já a regra "cada atributo tem um único dono do 110" é de **desenho**: vai num teste unitário, não derruba o boot.
- **Regra de versão do replay:** `VERSAO_MOTOR` passa a `'2'`. O reprodutor aceita `'2'`, e aceita `'1'` **só se**
  `replay.personagem === 'capi'`, porque a física dela não mudou. Qualquer outro caso falha em silêncio: a descida roda
  sem fantasma, que já é o comportamento previsto. Recordes não mudam (pontos são pontos). Cada afinação de ganho
  **depois de publicada** é um novo bump.

### A.4 Como a Íris prova o balanceamento

**O bot cuidadoso sozinho não mede equilíbrio.** Ele nunca gira de propósito nem segura grab, então a vantagem da Cidinha
(giro) e da Bandeira (pulo) ficaria invisível. São necessários dois bots:

| Bot | Dono | O que mede |
|---|---|---|
| **cuidadoso** (já existe) | Vega | se a pista **é vencível** com aquele personagem, e quanto dura |
| **manobreiro** (novo, `descida/bot.ts`) | Vega | o **teto prático de pontos**. Lê a própria `ConfigDescida`: estima o tempo de ar pela balística, escolhe quantas voltas cabem com a velocidade de giro DELE e deixa margem para pousar dentro da janela DELE. Tem 2 ou 3 níveis de ousadia, e conta o melhor deles |

O bot manobreiro precisa conhecer a própria física. Sem isso, o que se mede é o bot, e não o personagem.

**Harness de elenco** (`ferramentas/harness`, Íris): `npm run balanco -- --pistas … --personagens … --sementes N`.
A matriz é 6 personagens × pistas prontas × N sementes × 2 bots. Para cada célula: conclusão, tombos por corrida, ticks
(duração) e pontos (média, p50, p90). A saída vai para um relatório versionado `docs/balanco-m3.md` (uma tabela por
rodada, com o ganho usado).

**Portões:**

| # | Portão | Bloqueia? |
|---|---|---|
| G1 | bot cuidadoso conclui **100%** em toda célula (personagem × pista) | sim |
| G2 | duração da Capi com o bot cuidadoso entre **60 e 90 s** em cada pista (plano §8) | sim |
| G3 | por pista e no agregado, **pontos médios do manobreiro de cada personagem a até ±10% da mediana do elenco** (plano §7 M3) | sim |
| G4 | o objetivo o1 de cada pista é cumprido pela Capi com o bot cuidadoso, e o2 e o3 por ao menos um bot ou replay gravado (ver B.4) | sim |
| G5 | o dono jogou os 6 e não sentiu nenhum "roubado" | portão humano final |

**Custo:** a matriz cheia (6 × 5 × 100 × 2 = 6.000 descidas) fica fora do `npm test`. No CI roda uma versão reduzida
(10 sementes por célula para G1, a semente oficial para G2), igual ao teste de 100 sementes de hoje, que já leva até 60 s.

**Se alguém ficar OP (ou fraco demais), nesta ordem, parando no primeiro passo que resolver:**
1. **Descartar artefato do bot:** repetir com outro nível de ousadia e com um replay jogado à mão. Vantagem que só um bot
   enxerga não é vantagem.
2. **Mexer no ganho do atributo responsável** (`MAPA_ATRIBUTOS`). Isso afeta todos na mesma proporção e **preserva quem é
   forte em quê**. É o botão preferido.
3. **Mover 5 pontos dentro do próprio personagem**, mantendo a soma 500, o ponto forte e o ponto fraco da ficha (o "jeito"
   não muda, só os números, como pede a §4 do elenco).
4. Se nada disso resolver, volta para a Nova e o dono decide.

**A Capi nunca é ajustada.** Se ela for a fora da curva, quem se move são os outros, porque ela é a referência aprovada.

---

## B. As 5 pistas com tema próprio

### B.1 Quanto de "identidade" cada pista ganha: 3 opções

| Opção | O que muda por pista | Custo | Risco |
|---|---|---|---|
| B1. Só pele | mesmos 8 trechos, só pesos, dificuldade e arte diferentes | baixo | as pistas 2 a 5 parecem o Morro pintado de outra cor |
| **B2. Pele + trechos-assinatura de geometria** (recomendada) | ~4 trechos novos por tema, montados com a física que já existe (rampa, vão, degrau, trilho, obstáculo duro) e com objetos visuais por tema | médio, **sem mexer no motor** | baixo: o harness pega trecho invencível |
| B3. B2 + uma mecânica nova por pista | vento no ar, poça termal, gêiser com tempo, avalanche | alto: cada mecânica mexe no motor, no bot e na versão | médio/alto. Fica **opcional na Fase 6**, com decisão do dono |

**Recomendação: B2 agora e B3 como fase opcional.** A identidade vem da **forma** do trecho e da arte. Física nova vem
depois, uma de cada vez, se o dono quiser.

### B.2 As pistas (números de partida; o harness afina comprimento e faixa até passar em G1 e G2)

| # | id | tema | comprimento | dificuldade | Trechos-assinatura novos (só geometria + objetos) | Trilho tem cara de | Obstáculo duro tem cara de |
|---|---|---|---|---|---|---|---|
| 1 | `morro-do-pinhao` | `bosque` | 900 m | [0, 0,4] | **nenhum: pista CONGELADA** (hash `1c4d551601d3a6ae`) | cerca de fazenda | pedra, tronco de araucária |
| 2 | `pico-do-picole` | `parque` | ~1000 m | [0,15, 0,55] | `kicker-duplo`, `palito-longo` (trilho longo), `vao-calda`, `carrinhos` (degraus baixos em escada) | palito de picolé | picolé caído, casquinha |
| 3 | `vila-chocolate` | `vila` | ~1050 m | [0,25, 0,65] | `telhados` (degrau + vão curto em série), `varal` (trilho alto e longo), `chamine`, `escadaria` | varal de luzinhas | chaminé, barril, trenó |
| 4 | `vulcao-pe-gelado` | `vulcao` | ~1100 m | [0,35, 0,8] | `geiser` (rampa curta e íngreme), `ponte-basalto` (vão com trilho por cima), `basalto`, `cratera` (vão largo) | ponte de pedra | basalto |
| 5 | `cume-da-ventania` | `cume` | ~1200 m | [0,45, 0,9] | `fenda-corda` (vão + trilho de corda), `teleferico` (trilho alto e longo), `cornija` (degrau grande), `reta-avalanche` (reta final longa) | corda | rocha de gelo |

São 8 trechos de hoje mais 16 novos, total 24 (o plano previa ~20). A **dificuldade progressiva** vem de três botões que
o gerador já tem: a faixa `dificuldade` (o gerador já casa o trecho com o alvo ao longo da descida), os **pesos** (mais
vão e degrau no fim do jogo) e o `velMinEntradaMs` dos trechos novos. O comprimento é secundário: a duração tem que
ficar em 60 a 90 s.

**Regras que não podem quebrar:**
- **O Morro fica congelado.** O gerador filtra o catálogo pelos pesos da pista e preserva a ordem de inserção. Então
  trechos novos **acrescentados ao FIM** do catálogo, e ausentes dos pesos do Morro, não mudam a sequência do RNG dele.
  Teste dedicado: `gerarPista(PISTA_MORRO_DO_PINHAO).hash === '1c4d551601d3a6ae'` e `VERSAO_DAS_PISTAS['morro-do-pinhao']`
  inalterada (mudar esse texto manda os recordes do dono para "antigos"). Tudo o que mudar o algoritmo do gerador
  (não o catálogo) fica **proibido** no M3.
- **Visual sem contrato novo.** A física continua decidida pelo `TipoObjeto` (`pedra`, `tronco` e `pinheiro` são duros;
  `boneco-de-neve` é atravessável). A chaminé é um obstáculo duro desenhado como chaminé. A aparência sai de
  `(tema, tipo, variante)` no render. `TIPOS_OBJETO` só cresce na Fase 6, se houver mecânica nova.
- **Trecho vencível pelo mais lento.** O `velMinEntradaMs` de cada trecho novo precisa ser alcançável pelo Quequé (teto
  26,3 m/s) e pela Bandeira (embalo 0,92). Quem prova é o G1 em toda célula.
- **Validação no boot sai do caminho do iPhone.** Gerar as 5 pistas no boot custa 5 × (meta < 20 ms). Proposta: o CI
  confere os 5 `hashEsperado`; no jogo, `exigirPistaValida` roda **só na pista que vai ser jogada**, ao carregar.

### B.3 Contratos da parte B

```ts
// core/contratos.ts. DefPista (C5) ganha campos de PROGRESSÃO. O gerador os ignora; o hash é da PistaGerada, então nada muda nele.
export interface DefPista {
  /* …campos atuais… */
  readonly ordem: number;                    // 1..5, ordem no mapa
  readonly desbloqueio: RequisitoDesbloqueio;
}

// data/temas.ts (novo, Cronos): DADO visual, sem desenho
export const TEMAS = ['bosque', 'parque', 'vila', 'vulcao', 'cume'] as const;
export interface DefTema {
  readonly id: IdTema;
  readonly cores: { ceu: readonly [string, string]; montanhaDistante: string; montanhaMedia: string;
                    silhueta: string; neveLuz: string; neveSombra: string; destaque: string }; // tabela §2.1 da direção de arte
  readonly clima: 'neve-fofa' | 'confeito' | 'neve-noturna' | 'vapor' | 'vento-aurora';            // partículas
  readonly musica: IdMusica;
}

// render/temas/<tema>.ts (novo, Lyra): o DESENHO de cada tema, atrás de uma interface só
export interface PintorTema {
  construirCamadas(doc: Document, largura: number, altura: number, tema: DefTema): Parallax; // pré-desenhado fora da tela
  desenharObjeto(ctx: CanvasRenderingContext2D, o: ObjetoPista, xTela: number, yTela: number, escala: number): void;
  desenharTrilho(ctx: CanvasRenderingContext2D, t: Trilho, /* … */): void;
}
```

A **cena** recebe `DefPista` (e não só a `PistaGerada`, que não carrega o tema) e entrega o `DefTema` ao render. Só o
tema da pista atual fica montado na memória.

### B.4 Objetivos (3 por pista) e a prova de que são possíveis

```ts
// descida/resumo.ts (novo, Vega). Redutor PURO sobre as leituras: reproduzível pelo replay.
export interface ResumoDescida {
  readonly concluiu: boolean; readonly pontos: number; readonly ticks: number; readonly tombos: number;
  readonly maiorVoltasNumSalto: number; readonly maiorTicksNoAr: number; readonly maiorGrindTicks: number;
  readonly pousosPerfeitos: number; readonly maiorMult: number; readonly maiorComboManobras: number;
  readonly bonecos: number;
}
export function acumularResumo(r: ResumoDescida, l: LeituraDescida): ResumoDescida;

// core/contratos.ts + data/objetivos.ts (Cronos)
type CampoNumerico = Exclude<keyof ResumoDescida, 'concluiu'>;
export type CondicaoObjetivo =
  | { readonly tipo: 'concluir' }
  | { readonly tipo: 'minimo'; readonly campo: CampoNumerico; readonly valor: number }
  | { readonly tipo: 'maximo'; readonly campo: CampoNumerico; readonly valor: number }
  | { readonly tipo: 'todos'; readonly condicoes: readonly CondicaoObjetivo[] };
export interface DefObjetivo { readonly id: IdObjetivo; readonly pista: IdPista; readonly texto: string; readonly condicao: CondicaoObjetivo }
```

Escada por pista: **o1 é acessível** (iniciante, Capi), **o2 é a técnica do tema**, **o3 é desafio**. Os valores são de
partida, e o harness confirma G4 antes de publicar.

| Pista | o1 | o2 | o3 |
|---|---|---|---|
| Morro | chegar lá embaixo | dar um mortal | descer sem cair |
| Picolé | grind de 3 s num palito | combo ×3 | 15.000 pontos |
| Vila | 5 pousos perfeitos | grind de 4 s no varal | 2 voltas num salto só |
| Vulcão | 2 s no ar | mortal duplo | sem cair |
| Cume | chegar lá embaixo | combo de 5 manobras | 30.000 pontos |

Os ids continuam `<pista>-o1..o3`, já reservados no `REGRAS_SAVE`, então o save não precisa mudar.

### B.5 Desbloqueio e progressão

`meta/progresso.ts` (novo, Cronos), puro:
`aplicarResultado(save, regras, pista, resumo) → { save, novosObjetivos, novasPistas, novosPersonagens }`.
É o único ponto que escreve progresso, na mesma convenção de `inserirRecorde`. A **regra** de desbloqueio é decisão do
dono (M3-D1). Recomendação de partida:

| Libera | Requisito |
|---|---|
| Pista 2 / 3 / 4 / 5 | 2 / 4 / 6 / 8 objetivos somados no jogo todo |
| Bia, Cidinha, Bandeira | concluir a pista-casa uma vez (Picolé, Vila, Vulcão) |
| Quequé e Tio Beto | concluir o Cume |

O save ganha `pistaAtiva?` (aditivo, sem bump, igual a `personagemAtivo`). `?tudo=1` libera tudo para teste e e2e,
**sem gravar no save**.

### B.6 Arte de cenário por tema: 2 opções (o Morro é a referência)

| Opção | Como | Créditos | Observação |
|---|---|---|---|
| **S1. Tudo em código** (recomendada) | o Apolo escreve uma **ficha de tema** (silhuetas da camada de floresta, 5 a 8 objetos com a forma descrita para desenho vetorial, a gag de fundo, partículas, luz da hora do dia); a Lyra pinta em Canvas como fez no Morro; o Apolo faz a curadoria pelo screenshot lado a lado com o Morro | 0 | coerente com o Morro e com o plano ("cenário em código"); peso e memória sob controle (R4) |
| S2. S1 + folha gerada só para objetos difíceis | Nano Banana 4×3 por tema para 2 ou 3 objetos que o código não alcança | ~6 a 12 por tema mais refação | só se a curadoria de S1 reprovar algum objeto; cabe no D5 (sobram ~300 créditos) |

Fundo pintado inteiro está **descartado**: pesa, gasta memória e destoa do sprite (riscos R3 e R4).
**A primeira tarefa da Lyra é um refactor sem mudança visual:** extrair o Morro de `render/parallax.ts` (cores fixas
hoje) para `render/temas/bosque.ts` atrás do `PintorTema`, com prova por **comparação de pixels antes e depois**
(skill `medir-antes-de-afirmar`). Só depois disso entram os 4 temas novos.

---

## C. Fases, dependências e quem faz o quê

```
F0 ─┬─> F1 ──> F2 ─────────────┐
    ├─> F3 (pista a pista) ─────┼─> F5 ──> F7
    └─> F4 (tema a tema) ───────┘     F6 (opcional, ← F2 + F3 + M3-D3)
Apolo (fichas de tema) começa já, sem depender de nada.
```

| Fase | Entrega | Quem | Depende de | Pronto quando |
|---|---|---|---|---|
| **F0. Congelar e contratar** | (a) teste golden: Capi + bot cuidadoso no Morro (semente oficial e 3 outras) com `hashEstado` final e pontos **gravados como constante**; (b) teste do Morro congelado (B.2); (c) tipos novos em `contratos.ts` (`DefPersonagem`, `RequisitoDesbloqueio`, campos de `DefPista`, `DefObjetivo`/`CondicaoObjetivo`) | Vega (testes + tipos), Atlas aprova o contrato | nada | os dois testes verdes **no código de hoje**, antes de qualquer outra mudança |
| **F1. Física por personagem** | `data/personagens.ts` com a tabela §4 e validação (Cronos); `descida/atributos.ts`, `fatorEmbalo` no motor, cena e fantasma usando `configDoPersonagem`, `VERSAO_MOTOR='2'` + regra da Capi (Vega) | Cronos ‖ Vega; depois Íris | F0 | `configDoPersonagem(capi)` igual a `CONFIG_PADRAO` campo a campo (`Object.is`); golden do F0 inalterado; G1 nos 6 personagens no Morro; fantasma do Beto roda com a física do Beto (e2e) |
| **F2. Harness de balanceamento** | bot manobreiro (Vega); `npm run balanco` com a matriz e o relatório `docs/balanco-m3.md` (Íris); 1ª rodada de afinação no Morro | Vega (bot) ‖ Íris (harness) | F1 | G3 no Morro; procedimento de A.4 aplicado e registrado |
| **F3. Pistas 2 a 5** | por pista: trechos-assinatura no FIM do catálogo (Vega) + `DefPista` com semente, faixa, pesos e `hashEsperado` (Cronos). **Ordem: Picolé, Vila, Vulcão, Cume**, uma de cada vez | Vega + Cronos; Íris valida cada uma | F0 (G1 com 6 personagens precisa do F1) | por pista: hash fixo, G1 e G2 verdes, Morro ainda congelado |
| **F4. Temas visuais** | Apolo: 4 fichas de tema (bloco novo na direção de arte §2); Lyra: refactor do bosque com prova por pixel, depois um `PintorTema` por pista, **sincronizado com a F3**; `data/temas.ts` (Cronos) | Apolo → Lyra; Cronos (dados) | F0 (`DefTema`); a ficha do tema antes do pintor | por tema: screenshot no portão do dono (ele quer ver o progresso visual); fps sem queda no CPU 4x (plano §8); só 1 tema montado na memória |
| **F5. Objetivos, progressão e seleção de pista** | `descida/resumo.ts` (Vega); `data/objetivos.ts`, `meta/progresso.ts`, `pistaAtiva` no save (Cronos); tela de seleção de pista com cadeado, ✓ dos objetivos e recorde, resultado mostrando objetivo cumprido e o que liberou, cadeado na seleção de personagem (Lyra) | Vega ‖ Cronos → Lyra; Íris | F3 (pistas existem), F1 (personagens), **M3-D1 e M3-D2** | G4; e2e do fluxo cumprir objetivo → liberar pista → liberar personagem; save antigo carrega sem perder nada |
| **F6. Mecânicas-assinatura (opcional)** | as que o dono escolher em M3-D3. Avalanche e gags são **só visuais** (Lyra, motor intocado); poça, vento e gêiser mexem no motor, no bot e em `TIPOS_OBJETO` (Vega) | Vega / Lyra; Íris | F2, F3, M3-D3 | G1 a G3 de novo nas pistas afetadas; golden do Morro inalterado |
| **F7. Fechamento** | matriz completa 6 × 5 com o G3 final (Íris); preset de música por tema na trilha procedural (Vega); revisão do Órion no save e na progressão (entrada não confiável do `localStorage`); docs (Alexandria) | todos | F2, F3, F4, F5 | G1 a G4 verdes; G5 com o dono no iPhone |

**Gargalo:** o Vega aparece em F0, F1, F2, F3 e F5. A ordem dele é F0 → F1 → bot manobreiro → F3 pista a pista → resumo.
Enquanto isso, rodam sem esperar por ele: o **Apolo** (fichas, já), a **Lyra** (refactor do bosque, já, porque só depende
do `DefTema`, que é dado), o **Cronos** (personagens, temas, objetivos) e a **Íris** (harness CLI).

---

## D. Riscos e dívidas conscientes

| # | Risco | Mitigação |
|---|---|---|
| R-M3-1 | a física da Capi muda sem ninguém ver | identidade multiplicativa (A1) + golden da F0 antes de tudo + teste `Object.is` campo a campo |
| R-M3-2 | recordes do Morro do dono vão para "antigos" | catálogo cresce só no fim, algoritmo do gerador congelado, teste do hash do Morro, `versaoPista` dele intocada |
| R-M3-3 | o balanceamento mede o bot e não o personagem | bot manobreiro que lê a própria config + passo 1 do procedimento (replay jogado à mão) + G5 com o dono |
| R-M3-4 | fantasma gravado na v1 por outro personagem dessincroniza | `VERSAO_MOTOR='2'` + aceitar v1 só da Capi |
| R-M3-5 | trecho novo invencível para o personagem mais lento | `velMinEntradaMs` × harness G1 por célula; regra "vencível pelo mais lento" |
| R-M3-6 | o gating tranca o dono fora de personagens que ele já joga | decisão M3-D2 (manter o que já está aberto) + `?tudo=1` |
| R-M3-7 | 5 temas pesam no iPhone | camadas pré-desenhadas fora da tela, 1 tema na memória, sem `shadowBlur`/`filter`, portão de fps por tema |
| R-M3-8 | escopo cresce com mecânicas novas | B3 isolado na F6 opcional, uma mecânica por vez |
| R-M3-9 | o Vega vira gargalo | trilhas paralelas descritas na seção C |

**Dívidas conscientes:** flocos como moeda e coletáveis ficam fora do M3 (`coletados` continua 0; o objetivo não depende
deles); vozes por personagem e desafio do dia (D7) ficam para depois do M3; a "assinatura" de cada personagem continua
sendo só nome e pose.

---

## E. Decisões que dependem do dono

| # | Decisão | Opção A (recomendada) | Opção B | Opção C | Bloqueia |
|---|---|---|---|---|---|
| M3-D1 | Desbloqueio | **pistas por objetivos somados (2/4/6/8); personagem ao concluir a pista-casa** (B.5) | linear: concluir a pista N libera a N+1 | tudo liberado; objetivos viram medalha | F5 |
| M3-D2 | Quem já tem save (inclusive o dono) | **mantém liberado o que já usou** (personagem ativo e pistas com recorde entram em `desbloqueados` na 1ª carga) | todo mundo recomeça do zero | | F5 |
| M3-D3 | Mecânicas novas por pista (F6) | **só as visuais** (avalanche no Cume, gatos e vapor), motor intocado | visuais + poça termal e vento (baratas) | visuais + poça + vento + gêiser com tempo | F6 |
| M3-D4 | Arte de cenário | **S1, tudo em código**, Apolo faz ficha e curadoria (0 crédito) | S2: folha gerada para objetos difíceis (~6 a 12 por tema) | | F4 |
| M3-D5 | Critério de equilíbrio | **±10% de pontos médios** (o que o plano já diz) | ±10% em pontos E em tempo de descida | | F2 |
| M3-D6 | Entrega | **uma pista por vez, com screenshot e link no ar a cada uma** | as 4 juntas no fim | | F3, F4 |
