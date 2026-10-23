# NEVE MALUCA — fichas de tema das 4 pistas novas do M3 (cenário em código)

Autor: Apolo (direção de arte) · 2026-10-23 · Fase F4 do `docs/plano-m3.md` (opção S1, decisão M3-D4: **0 crédito,
nenhuma imagem gerada**). Base: `docs/direcao-arte-neve-maluca.md` §2 (pistas e tabela de cores §2.1) e o Morro do
Pinhão como está no código (`src/render/parallax.ts`, `terreno.ts`, `objetos.ts`).

Tudo aqui é **forma + cor + gradiente** em Canvas 2D: retângulo, arco, elipse, `quadraticCurveTo`, `roundRect`,
traço. Nenhum asset de imagem. As medidas de cenário estão no espaço do tile do parallax (960 × 540, igual ao Morro);
as dos objetos de jogo, em metros (40 px/m no zoom 1, `PX_POR_METRO`).

---

## 0. O que vale para as 4 fichas

### 0.1 O DNA do Morro que não pode se perder

1. **Luz do alto à esquerda, sempre.** Faceta clara do lado esquerdo das montanhas e objetos, capuz claro na crista.
   Mesmo nas pistas noturnas: quem ilumina é a lua (Vila, Vulcão, Cume), posta no alto à esquerda. É o que segura
   o sprite "3D" do personagem no cenário plano (risco R3).
2. **Montanha facetada em polígono reto** em pelo menos uma camada de cada tema. O Picolé arredonda a distante, mas a
   média continua facetada.
3. **Capuz** (neve, calda, cobertura) em toda crista e todo objeto. É o "sorvete de montanha" da marca (§1.4 A).
4. **Pré-desenhado fora da tela, 0 `Math.random`.** Camadas de fundo vão para tile offscreen no boot do tema; o que é
   desenhado por quadro (decoração do terreno) sai de hash determinístico do índice do metro, igual ao Morro.
5. **Sem `shadowBlur` e sem `filter`** (R-M3-7). Brilho é **traço largo com alfa baixo por baixo do traço fino**, ou um
   sprite radial pré-desenhado uma vez e copiado com `drawImage`. Gradiente criado por quadro: só no céu (já é assim hoje).

### 0.2 Cinco regras de leitura (valem para os 4 temas; nascem da conta de contraste da §0.6)

| # | Regra | Por quê |
|---|---|---|
| L1 | **Contorno é física.** Obstáculo duro (`pedra`, `tronco`, `pinheiro`): contorno escuro `#1B2733` 1,5 px (temas claros) ou **contorno duplo** nos temas escuros: `#0B1630` 1,5 px + aro claro de 1 px só na metade de cima e da esquerda. Atravessável (`boneco-de-neve`): contorno **claro**, nunca escuro. Decoração sem física: **sem contorno**. | O jogador aprende em 1 descida o que dói e o que não dói, em qualquer tema. O Morro já faz isso (pedra com `#1B2733`, boneco com `#BDD5EA`); aqui vira lei. É também a regra do contorno duplo do logo (§1.3). |
| L2 | **Calda e magma nunca são chão de pouso.** Só aparecem na face da queda e em rachaduras do corpo do terreno; a zona de pouso é sempre neve/gelo claro. | Tombo é "atordoado e rindo" (§1.2). Pousar em lava lê como morte, e o jogo não mata ninguém. |
| L3 | **A superfície de grind tem um fio claro** com contraste **≥ 3:1** contra a camada que fica atrás dela, e contorno escuro embaixo. | Trilho é objeto de jogo: tem que ler de longe e no sol do iPhone. |
| L4 | **Nada de texto no cenário.** Placa, pórtico e letreiro só com pictograma (seta, floco, termômetro, raio de vento). | Texto no cenário escapa da revisão de i18n e do teto de caracteres. |
| L5 | **Originalidade e respeito.** Sem símbolo religioso (nada de capela, cruz, bandeira de oração), sem bandeira de país ou estado, sem marca (nem de sorvete, nem de chocolate), sem cidade real reconhecível. A serra gaúcha entra pela **arquitetura e pelo clima** (enxaimel, basalto, minuano), não por monumento. | §6 da direção de arte. |

### 0.3 Camadas e fatores de parallax (mesma pilha do Morro, mais 1 opcional)

| Ordem | Camada | Fator | Onde | Observação |
|---|---|---|---|---|
| 0 | **céu pré-desenhado** (degradê + astros + aurora) | 0 a 0,01 | tile offscreen | Novo, opcional. Nos temas com estrelas/lua/aurora, pré-desenhar o céu inteiro num tile troca o gradiente por quadro por 1 `drawImage`: fica **mais barato** que hoje. |
| 1 | montanhas distantes | 0,04 | tile | igual ao Morro |
| 1b | camada extra do tema (só no Cume: mar de nuvens) | 0,06 | tile | Cume apenas |
| 2 | montanhas médias | 0,10 | tile | igual ao Morro |
| 3 | silhuetas (a "floresta" do tema) | 0,22 | tile | igual ao Morro, `baseY = 0,52 × 540 = 281` |
| 4 | terreno (manta + corpo + pele das feições) | 1 | por quadro | ver §0.4 |
| 5 | objetos e trilhos | 1 | por quadro | ver §0.5 |
| 6 | partículas do `clima` | — | por quadro | `DefTema.clima` |

Picos de cada tile: **primeiro e último ponto com o mesmo `y`** (encaixe do tiling, como o Morro faz em `x = 0` e
`x = 960`). Elementos que cruzariam a borda do tile: não cruzam, ficam a ≥ 40 px dela.

Memória: 3 tiles por tema (4 com céu) × 960 × 540 × 4 bytes ≈ 6,2 a 8,3 MB, com **um tema montado por vez** (B.3).

### 0.4 Feições do terreno: como a rampa e o vão ganham pele sem contrato novo

O terreno não sabe que trecho é qual (`PistaGerada` só tem `alturas`, `objetos`, `trilhos`), e **a rampa e o vão não
são objetos**: são forma do terreno (`src/pista/catalogo.ts`). Para vestir a rampa de casquinha e o vão de calda sem
mexer em contrato nem no hash, o pintor **detecta as feições pela inclinação**, uma vez por pista, ao montar o tema:

```
ang(i) = inclinação entre a amostra i e i+1 (a mesma conta de inclinacaoGrausEm, em pista/consulta.ts)
SUBIDA  = trecho contínuo com ang >= +8°, de pelo menos 2 amostras (1 m)  -> a rampa e a borda de lançamento do vão
QUEDA   = trecho contínuo com ang <= -28°, de pelo menos 2 amostras (1 m) -> a face do vão e do degrau
```

Os limiares são **de partida**, deduzidos dos pontos do catálogo (reta -12°, ondulado entre -18° e +4°, rampa termina
em +22°, borda do vão ~+20°, face do vão ~-45°, face do degrau ~-50°); não medi na curva gerada. **Prova que a Lyra
roda:** em cada pista, o nº de SUBIDAS bate com o nº de trechos `rampa` + `vao` (+ assinaturas com lançamento) e o nº de
QUEDAS bate com `vao` + `degrau` (+ assinaturas com queda); em `reta`/`ondulado` nenhuma feição. A lista de feições é
dado de render: não entra no hash, não muda a física.

Como cada feição é desenhada (a forma; a pele de cada tema está nas fichas):

- **Subida:** uma faixa da pele do tema colada na superfície entre `x0` e `x1`, com altura de 2 × a espessura da manta,
  e **um adereço na borda** (`x1`): o Morro tem a bandeirinha vermelha em `desenharRampa`; cada tema troca o adereço.
- **Queda:** a **cunha** abaixo da superfície: superfície de `(x0, y0)` até `(x1, y1)`, desce a `(x1, y1 + E)`, volta
  na horizontal a `(x0, y1 + E)` e fecha (`E` = espessura da manta). A cunha recebe a pele (parede, calda, fenda) e a
  **manta de neve não é desenhada sobre a face da queda** (neve não gruda em parede): fica só um fio de 2 px de borda.

O Morro (`bosque`) **não ganha pele de feição** no M3: ele está congelado e o refactor tem de ser idêntico por pixel.

### 0.5 Mapa único: tipo de objeto → pele por tema (o que o `PintorTema.desenharObjeto` resolve)

`variante` decide entre as duas peles do mesmo tipo (0 e 1); qualquer outro valor cai na 0.

| Elemento (física) | `bosque` (Morro, hoje) | `parque` (Picolé) | `vila` (Vila) | `vulcao` (Vulcão) | `cume` (Cume) |
|---|---|---|---|---|---|
| `pedra` v0 (duro) | pedra nevada | **picolé caído** | **chaminé** | **prisma de basalto** | **rocha de gelo** |
| `pedra` v1 (duro) | pedra nevada | **bola de sorvete caída** | **barril** | **bomba vulcânica** | **bloco de gelo** |
| `tronco` (duro, baixo e comprido) | tronco de araucária | **casquinha tombada** | **trenó estacionado** | **coluna de basalto tombada** | **laje de cornija caída** |
| `pinheiro` (duro, alto) | sem desenho (cai no fallback) | **picolé gigante fincado** | **pinheiro com luzinhas** | **fumarola de basalto** | **pinheiro torto pelo vento** |
| `boneco-de-neve` (atravessa) | boneco de chapéu | **boneco de sorvete** | **boneco de gorro e caneca** | **boneco no escalda-pés** | **boneco de cachecol ao vento** |
| trilho (`pista.trilhos`) | cerca de fazenda | **palito de picolé** | **varal de luzinhas** | **ponte de basalto** | **corda** (altura < 1 m) / **cabo de teleférico** (altura ≥ 1 m) |
| SUBIDA (feição) | rampa de neve + bandeirinha | **casquinha com calda** + bandeirola listrada | **telhado de telha colonial** + cata-vento | **crosta de gêiser** + baforada | **cornija enrolada** + biruta pequena |
| QUEDA (feição) | (nenhuma) | **calda de chocolate congelada** | **parede enxaimel** com janela acesa | **parede de basalto** com rachadura de magma | **fenda de gelo** com pingentes |
| `placa`/`bandeira`/`portico` (sem física) | — | carrinho de sorvete · bandeirolas · arco de casquinhas | caneca gigante · lampião · pórtico enxaimel | termômetro gigante · chaleira · pórtico de basalto | biruta · placa-pictograma de vento · pórtico de gelo |

Os três últimos tipos **não têm física** (lido em `pista/consulta.ts`: só `pedra`/`tronco`/`pinheiro` colidem e só o
boneco desacelera). Servem para a Vega enfeitar os trechos-assinatura. Como ficam no plano do jogo, seguem a regra L1
(sem contorno) e mais duas: **escala ≤ 0,8**, **cor misturada 25% com o horizonte do céu** e **base afundada 30% na
manta**, para nunca serem lidos como obstáculo.

### 0.6 Contraste calculado (fórmula WCAG sobre hex chapado; aritmética, não medição em tela)

Script em scratchpad, pares mais críticos. "Faixa de ação" = a colina da camada de silhuetas, que é o que fica atrás do
personagem e do topo dos obstáculos na maior parte do tempo.

| Par | Razão | Consequência |
|---|---|---|
| Picolé: corpo do obstáculo morango `#E8457A` × manta `#FFF4F8` | 3,51 | passa só com o contorno escuro (`#1B2733` × manta = **14,12**): L1 obrigatória |
| Picolé: palito `#E9C27A` × manta | **1,57** | o palito sozinho some na neve: L3 (fio claro + contorno escuro) obrigatória |
| Vila: chaminé `#9C4A3A` × colina `#3A2E5C` | **2,00** | aro de lanterna `#FFD9A0` × colina = **9,09**: contorno duplo obrigatório |
| Vila: corda do varal clara `#E9D9B8` × colina | 8,74 | corda clara, não escura (a escura `#1C1530` daria 1,3) |
| Vulcão: basalto `#2E2A38` × colina `#2A2638` | **1,05** | sem aro o basalto desaparece; aro frio `#BFD0EA` × colina = **9,37** |
| Vulcão: laje da ponte `#6A6680` × colina | 2,67 | o fio de geada `#DDEBFA` (× colina **12,10**) é o que se lê |
| Cume: rocha de gelo, faceta clara `#B7D3FF` × colina `#1A2040` | 10,40 | lê bem |
| Personagens nas pistas escuras | — | Bandeira (pelo 4,36, colete 4,73, prancha 6,22 sobre o Vulcão), Cidinha (cardigã 3,70, gorro 3,69 sobre a Vila), Beto (camisa 6,72) e Quequé (rosto branco 15,25) leem. **Peças escuras somem:** macacão do Quequé `#1659B8` (2,38) e bermuda do Beto `#0F4C6B` (1,71) sobre o Cume, saia da Cidinha (1,32) sobre a Vila. A silhueta se segura pelas partes claras. |

Testei e **descartei** a ideia de um halo claro atrás do personagem nos temas escuros: clarear o fundo derruba o
contraste dos tons médios (macacão do Quequé cai para 1,13; pelo da Bandeira para 1,53). Fundo escuro é o certo; o que
falta confirmar é no screenshot.

---

## 1. PICO DO PICOLÉ (`pico-do-picole`, tema `parque`) — casa da Bia Pipoca

**A cara.** A montanha que virou sobremesa. É o parque de manobras que uma criança de 9 anos desenharia: neve em
camadas de baunilha, morango e menta, casquinhas gigantes fincadas, palitos de picolé virando trilho. Humor de
**fartura e açúcar**: tudo é grande demais, colorido demais e um pouco derretido. A Bia narra ("Tá gravando? Olha essa
calda!"), e o cenário é o "estúdio" dela. É a pista mais clara e mais saturada do jogo, de propósito: depois do Morro
verde e azul, o jogador sente que entrou no parque.

**Hora e luz.** Meio-dia, sol forte. Sol mais alto que no Morro, **ainda à esquerda** (regra 0.1-1). Sombras curtas e
coloridas (sombra rosada, nunca cinza).

### 1.1 Paleta

| Papel | Hex | Origem |
|---|---|---|
| céu topo → horizonte | `#5BB8FF` → `#D9F1FF` | §2.1 |
| brilho do sol (radial, centro 24% × 8% da tela, raio 260) | `rgba(255,250,235,0.45)` → 0 | novo |
| montanha distante: sombra · luz · calda do capuz | `#F2C6D8` · `#FBE0EA` · `#FFF4F8` | §2.1 + novo |
| montanha média: sombra · luz · cobertura | `#B9E8D6` · `#D4F4E7` · `#FFF4F8` | §2.1 + novo |
| granulado (5 cores, ciclo fixo) | `#FF5C8A` `#FFD23F` `#5BB8FF` `#3DDC97` `#FF8A1F` | tokens da marca |
| colina das silhuetas | `#EFC3D3` | novo |
| casquinha · grade do waffle | `#E9C27A` · `#C9973F` | §2.1 + novo |
| bolas de sorvete: morango · menta · baunilha · chocolate | `#FF9EC0` · `#7FE0C4` · `#FFF1C9` · `#8A5236` | novo (menta = destaque §2.1) |
| terreno: manta · corpo | `#FFF4F8` · `#F2D3E0` | §2.1 |
| terreno: faixa morango · faixa menta · borda · contorno da superfície | `#F4B3CB` · `#A8E4CF` · `#E7AFC4` · `#FFE6EF` | novo |
| obstáculo: morango forte · luz · palito · casquinha · grade | `#E8457A` · `#FF7FA8` · `#E9C27A` · `#C98A3A` · `#8F5E22` | novo |
| calda de chocolate · brilho da calda | `#6B3A2A` · `#A0644A` | novo |
| contorno de obstáculo e trilho | `#1B2733` | igual ao Morro |

### 1.2 Camadas (fundo → frente)

1. **Céu:** degradê de 2 paradas + brilho do sol. Sem nuvem (meio-dia limpo). Opcional: 3 nuvens-chantili (3 círculos
   sobrepostos `#FFFFFF` alfa 0,8, base achatada) no tile do céu.
2. **Distantes, "bolas de sorvete gigantes":** os mesmos 8 pontos de pico do Morro (`x` 0, 120, 250, 390, 530, 670,
   810, 960), mas cada pico vira **cúpula**: `quadraticCurveTo` com o ponto de controle 30 px acima do pico. Metade
   esquerda de cada cúpula em `luz`. Capuz de **calda de baunilha escorrendo**: faixa ondulada na cúpula com 3 gotas
   (meia-elipse 6 × 10 px pendurada), nunca simétricas.
3. **Médias, facetadas como no Morro** (o DNA fica aqui): mesmos 10 pontos, faceta esquerda em `luz`. No lugar do capuz
   de neve, **cobertura de baunilha** com 2 gotas por crista e **granulado**: 10 a 14 retângulos 2 × 5 px por crista,
   girados em ângulos fixos da tabela (−40°, −10°, 25°, 60°…), cor no ciclo das 5.
4. **Silhuetas (fator 0,22, `baseY` 281):** colina `#EFC3D3` com a curva do Morro. Sobre ela, nesta ordem de `x`:
   - **Casquinhas gigantes** em `x` 90, 330, 600, 840, alturas 70 a 90 px: cone para baixo (triângulo, ponta na
     colina), grade de waffle (linhas diagonais a ±45°, espaço 7 px, `#C9973F`), bola de sorvete em cima (círculo com a
     metade esquerda 1 tom mais clara) e uma gota de calda descendo pelo cone.
   - **Picolés fincados** em `x` 190, 270, 470, 700, 900, alturas 50 a 60: palito `#E9C27A` 5 × 14 px na colina, corpo
     `roundRect` 22 × 40 px raio 10 com **mordida** (arco côncavo no canto superior direito: o caminho entra com
     `arc(..., true)`), uma das 3 cores de bola, faixa de luz de 4 px na borda esquerda.
   - **Carrinho de sorvete** em `x` 530: caixa `roundRect` 34 × 20 px menta, 2 rodas, guarda-sol listrado (meio-disco
     com 6 gomos alternando `#FF5C8A` e `#FFF4F8`).
   - **Bandeirolas de festa** entre os topos das casquinhas de 600 e 840: curva `quadraticCurveTo` com flecha 18 px e
     triângulos 6 × 8 px a cada 12 px, ciclo das 5 cores.
   - **Gag de fundo** em `x` 410: um **boneco de neve tomando picolé** com "congelamento cerebral": olhos são dois
     traços apertados (`><` desenhado com 4 linhas), a mão-graveto segura um picolé de morango encostado na boca.
     É o Morro mandando um convidado; o mesmo boneco reaparece na Vila e no Cume (gag recorrente das 4 pistas).
5. **Terreno.** Manta `#FFF4F8` como no Morro. O corpo é **sorvete napolitano**: abaixo da manta, duas faixas
   paralelas à superfície (mesmo caminho da superfície deslocado em `y`): morango de `E + 10` a `E + 18` px, menta de
   `E + 30` a `E + 38` px; o resto em `#F2D3E0`. Um `path` por faixa, sem loop por pixel. **Granulado na manta:** 1
   pedaço a cada 3 m (hash do índice do metro decide se aparece, cor e ângulo), no máximo 40 por quadro.

### 1.3 Pele dos objetos de jogo

| Elemento | Forma (Canvas) | Contorno |
|---|---|---|
| `pedra` v0 → **picolé caído** | `roundRect` deitado (largura × 0,6 da altura), cantos raio = metade da altura, girado −12°; morango forte com faixa de luz no terço de cima; mordida côncava na ponta direita; palito saindo da esquerda (retângulo 0,3 × 0,12 da largura, `#E9C27A`) | escuro (L1) |
| `pedra` v1 → **bola de sorvete caída** | elipse achatada no chão + 3 gotas escorrendo pela base; menta ou chocolate (variante fixa); 5 granulados no topo | escuro |
| `tronco` → **casquinha tombada** | triângulo deitado com a ponta para a direita, waffle em grade `#8F5E22`, boca do cone à esquerda com a bola de baunilha meio para fora | escuro |
| `pinheiro` → **picolé gigante fincado** | igual ao da silhueta, 2× maior, com contorno e mordida | escuro |
| `boneco-de-neve` → **boneco de sorvete** | as 3 esferas do boneco do Morro, cada uma uma bola (baunilha embaixo, morango no meio, menta em cima), cereja (círculo `#C7301C` com cabinho) no lugar do chapéu, olhos de gota de chocolate, nariz de casquinha (triângulo `#E9C27A`) | **claro** `#FFE6EF` |
| trilho → **palito de picolé** | `roundRect` com cantos raio = metade da espessura (a ponta arredondada é o que faz ler "palito"), corpo `#E9C27A`, 2 veios de madeira `#C9973F` ao longo; **pés** = palitos verticais a cada ≤ 4 m; fio claro `#FFFFFF` alfa 0,8 de 2 px no topo; trilho longo (`palito-longo`) = palitos emendados a cada 6 m, com a emenda visível (sobreposição de 6 px) | escuro embaixo (L3) |
| SUBIDA → **casquinha com calda** | faixa da subida com waffle (grade 45°, `#C9973F` sobre `#E9C27A`); na borda, uma onda de calda de morango escorrendo 2 gotas; adereço: **bandeirola listrada** (mastro + triângulo com 3 listras menta/rosa/menta) no lugar da bandeirinha vermelha | — |
| QUEDA → **calda de chocolate congelada** (`vao-calda`) | cunha em `#6B3A2A`; um traço de brilho `#A0644A` paralelo à face a 4 px dela; 3 gotas penduradas na borda de cima. A zona de pouso continua manta de baunilha (L2) | — |
| decor sem física | carrinho de sorvete (como na silhueta) · bandeirolas · **pórtico** = arco de 2 casquinhas de ponta-cabeça unidas por uma faixa de calda | nenhum |

**Trechos-assinatura na tela:** `kicker-duplo` = duas casquinhas seguidas (a 2ª bandeirola em menta, para o olho contar
"dois"); `palito-longo` = o trilho de palitos emendados; `vao-calda` = a calda de chocolate; `carrinhos` = cada degrau
baixo ganha um carrinho de sorvete de decoração **atrás** da borda (decor, sem física, regra 0.5).

**Partículas (`clima: 'confeito'`).** Os flocos de fundo do Morro viram **confeito**: mesmo sistema, 70% flocos
brancos e 30% granulado (retângulo 2 × 4 px girando, ciclo das 5 cores). O spray do pouso continua neve
(`#FFF4F8`), com 1 granulado a cada 6 partículas.

**Microtextos de carregamento:** "Derretendo a calda…" · "Afiando os palitos…" · "Contando o granulado…".

**Curadoria (o que eu reprovo no screenshot):** pastel virando "lavado" (o obstáculo tem que saltar da neve; se o picolé
caído não ler a 1 m do celular, sobe a saturação); granulado demais (a manta vira ruído atrás do personagem: teto 40);
a Bia sumindo no céu (jaqueta `#FFD23F` × céu claro dá **1,03** de luminância; o capacete marinho segura a silhueta,
mas é o primeiro ponto a olhar; já é igual no Morro).

---

## 2. VILA DO CHOCOLATE QUENTE (`vila-chocolate`, tema `vila`) — casa da Vó Cidinha

**A cara.** Uma vila colonial da serra na hora em que as luzes acendem, tão ladeira abaixo que **os telhados viraram
pista**: a descida passa por cima das casas, pula de um beiral para o outro e desliza pelos varais de luzinhas. É a
pista **aconchegante**: janela amarela, fumaça de chaminé, caneca fumegante na praça. A arquitetura é **enxaimel**
(parede clara com vigas escuras em X), a assinatura visual das colônias da serra gaúcha. Humor de **vó**: tudo é
quentinho e convidativo, e a Cidinha atravessa a vila a 80 km/h gritando "Sai da frente, netinho!". Os gatos da vila
são a gag viva (mecânica visual da F6, M3-D3).

**Hora e luz.** Fim de tarde virando noite. Poente baixo à esquerda (o brilho laranja do horizonte), lua crescente no
alto à esquerda. A luz dos objetos vem das **lanternas** (aro quente).

### 2.1 Paleta

| Papel | Hex | Origem |
|---|---|---|
| céu topo → horizonte | `#2A2257` → `#E88A5A` | §2.1 |
| brilho do poente (radial, 10% × 58% da tela, raio 300) | `rgba(255,170,90,0.35)` → 0 | novo |
| estrelas (24, só nos 35% de cima, raio 1 a 1,6) · lua crescente | `#FFF3D6` alfa 0,7 · `#FFF3D6` | novo |
| montanha distante: sombra · luz · neve | `#5B4A8A` · `#7564A3` · `#C8C1E6` | §2.1 + novo |
| montanha média: sombra · luz · neve | `#3F3570` · `#554A8A` · `#A9A3D6` | §2.1 + novo |
| colina · chalé em silhueta · neve do telhado | `#3A2E5C` · `#2A1F3D` · `#C9CBEB` | §2.1 + novo |
| janela acesa · janela apagada · fumaça | `#FFB84D` · `#1C1530` · `#8F86B8` alfa 0,45 | §2.1 (destaque) + novo |
| luzinhas (ciclo de 4) | `#FFB84D` `#FF5C8A` `#9FE3FF` `#3DDC97` | tokens |
| terreno: manta · corpo | `#EAF0FF` · `#8F9BD1` | §2.1 |
| terreno: telha · sombra da telha · borda · contorno | `#8A3B2E` · `#5E2620` · `#7C88C2` · `#F4F7FF` | novo |
| enxaimel: parede · viga | `#D9C7A8` · `#4A2E1B` | novo |
| chaminé: tijolo · junta · barril: madeira · aro · trenó · esqui | `#9C4A3A` · `#6E2F24` · `#7A4D2E` · `#3A3F4A` · `#C7301C` · `#4A2E1B` | novo (`#C7301C` = `--nm-sinal`) |
| contorno duplo: escuro · aro de lanterna | `#0B1630` · `#FFD9A0` | `--nm-tinta` + novo |
| brilho de lanterna (sprite radial pré-desenhado, raio 26 px) | `rgba(255,184,77,0.35)` → 0 | novo |

### 2.2 Camadas (fundo → frente)

1. **Céu pré-desenhado:** degradê + brilho do poente + estrelas + **lua crescente** em (16% × 13%) raio 16: caminho de 2
   arcos (externo de 0 a 360°, interno deslocado 7 px para a direita, em sentido contrário), sem recortar com a cor do céu.
2. **Distantes:** perfil do Morro, mais arredondado (morros da serra, não Alpes): picos a 60% da altura dos do Morro.
   Faceta esquerda em `luz`, capuz de neve lavanda.
3. **Médias:** facetadas, mesmos pontos do Morro; nas encostas, **5 janelinhas acesas** soltas (quadrado 3 × 3
   `#FFB84D`): as casas longe, lidas só pela luz.
4. **Silhuetas (`baseY` 281):** colina `#3A2E5C`. Sobre ela:
   - **8 chalés** em `x` 60, 160, 250, 380, 470, 610, 730, 880: corpo `#2A1F3D` 34 a 52 px de largura, telhado de duas
     águas **íngreme** (altura = 0,7 × largura: é o que lê "serra" e não "praia"), capuz de neve grosso `#C9CBEB` no
     telhado, **chaminé** com 3 cachos de fumaça (3 círculos crescentes subindo e inclinando para a direita, alfa 0,45).
     **2 a 3 janelas** por chalé, 6 × 7 px com cruzeta `#120D20`, acesas ou apagadas pela tabela fixa (≈ 60% acesas).
   - **Varais de luzinhas** entre as cumeeiras de (160 → 250) e (610 → 730): curva com flecha 14 px, fio `#1C1530`,
     lâmpada = círculo 2 px a cada 9 px, ciclo de 4 cores.
   - **Praça** em `x` 540: **caneca gigante** (`roundRect` 26 × 30 `#F2E3C2`, alça em arco, chocolate `#6B3A2A` na boca,
     2 marshmallows `#FFFFFF` boiando, 3 cachos de vapor) ao lado de um **lampião** (poste fino + lanterna `#FFB84D`).
   - **Gag de fundo:** o **gato laranja** (`#FF8A1F`) sentado no topo da chaminé do chalé de `x` 730, de costas para a
     fumaça, rabo em S, dois pontos `#FFE08A` de olho. E o boneco de neve recorrente, de gorro, na janela de um sótão
     em `x` 380 (só cabeça e gorro, nariz de cenoura para fora).
5. **Terreno, "telhado sem fim":** manta `#EAF0FF`; logo abaixo dela, a **faixa de telha colonial**: escamas (meio-arco
   de 10 px de largura, uma fileira) em `#8A3B2E` com a meia-sombra `#5E2620` na base de cada escama, um único `path`
   seguindo a superfície. Abaixo, corpo `#8F9BD1`. **Janelas no corpo:** a cada 11 m (hash decide), uma janela
   `#FFB84D` 8 × 10 px a `E + 24` px da superfície, com o sprite de brilho atrás: lê "tem gente morando embaixo da
   pista". Teto: 6 janelas por quadro.

### 2.3 Pele dos objetos de jogo

| Elemento | Forma | Contorno |
|---|---|---|
| `pedra` v0 → **chaminé** (`chamine`) | retângulo de tijolo com 3 fileiras de junta (linhas horizontais + verticais desencontradas), coroa mais larga no topo com capuz de neve, 2 cachos de fumaça parados acima (alfa 0,45, **sem contorno**, para a fumaça não parecer parte do obstáculo) | duplo (escuro + aro `#FFD9A0` em cima/esquerda) |
| `pedra` v1 → **barril** | `roundRect` com as laterais levemente bojudas (2 `quadraticCurveTo`), 3 aros `#3A3F4A`, tampa de neve | duplo |
| `tronco` → **trenó estacionado** | assento em "L" `#C7301C` com faixa de luz, esqui embaixo virando para cima na frente (curva), almofada de neve no assento | duplo |
| `pinheiro` → **pinheiro com luzinhas** | o pinheiro de 3 andares do Morro, com 1 fio de luzinhas em zigue-zague por andar (ponto a cada 6 px, ciclo de 4). Sem estrela na ponta (L5) | duplo |
| `boneco-de-neve` → **boneco de gorro e caneca** | boneco do Morro com **gorro de pompom** rosa-goiaba `#E85D8A` (homenagem à Cidinha) no lugar do chapéu e uma caneca na mão-graveto, com 1 cacho de vapor | claro `#F4F7FF` |
| trilho → **varal de luzinhas** (`varal`) | **postes coloniais** (`#2A1F3D`, 4 px) a cada ≤ 6 m, cada um com lanterna `#FFB84D` + sprite de brilho; o trilho é a **corda clara** `#E9D9B8` de 3 px, reta (é a superfície de grind: curva de varal enganaria o pulo); as lâmpadas ficam **penduradas embaixo** da corda (2 px abaixo, a cada 9 px), nunca em cima | fio claro + contorno escuro embaixo (L3) |
| SUBIDA → **beiral de telhado** (`telhados`) | faixa de telhas mais altas (escama de 14 px) com capuz de neve; adereço: **cata-vento** (haste + seta + rabo triangular), sem galo, para não virar símbolo | — |
| QUEDA → **parede enxaimel** (`telhados`, `escadaria`) | cunha `#D9C7A8`; vigas `#4A2E1B` de 3 px: 1 horizontal no meio, verticais a cada 14 px e **um X** no maior vão entre elas; 1 janela acesa `#FFB84D` com o brilho atrás; beiral de neve na borda de cima | — |
| decor sem física | caneca gigante (`placa`) · lampião (`bandeira`) · **pórtico enxaimel** (`portico`): 2 pilares de viga + travessa com telhadinho nevado | nenhum |

**Trechos-assinatura na tela:** `telhados` = sequência beiral (subida) → parede (queda) → telhado, que é a piada visual
da pista; `varal` = varal alto e longo, com 3 postes ou mais; `chamine` = uma chaminé no meio de um telhado; `escadaria`
= as quedas curtas em série, cada uma uma paredinha enxaimel com a janela acendendo em degraus.

**Partículas (`clima: 'neve-noturna'`).** Flocos de fundo em `#EAF0FF`, maiores e mais lentos que no Morro (neve de
fim de tarde, sem vento). **Vapor** das canecas é partícula do jogo (§2.4 da direção de arte): se a F6 entrar, 1 emissor
por caneca visível. O spray do pouso continua `#EAF0FF`.

**Microtextos de carregamento:** "Esquentando o chocolate…" · "Acendendo as luzinhas…" · "Netinho, leva um casaco!".

**Curadoria:** a faixa de telha cansando a vista (se competir com a manta, cai a 70% de opacidade); chalés virando
borrão roxo (as janelas acesas são o que desenha a vila: se não houver ≥ 12 acesas visíveis na tela, aumentar);
contorno duplo ausente em qualquer obstáculo (sem ele a chaminé tem **2,00** contra a colina).

---

## 3. VULCÃO PÉ-GELADO (`vulcao-pe-gelado`, tema `vulcao`) — casa da Professora Bandeira

**A cara.** A montanha que não decidiu se é quente ou fria: **gelo azul por fora, magma brilhando nas rachaduras**. É o
laboratório de campo da Bandeira, com termômetro gigante e estação de medição. O basalto vem em **colunas
hexagonais**, como as da Serra Geral (os paredões de basalto colunar dos cânions do sul): é o pé gaúcho do vulcão
inventado. Humor de **contraste térmico**: um boneco de neve fazendo escalda-pés na poça quente, uma chaleira esquentando
a água do chimarrão numa fenda de magma ("no ponto, nem ferve"). Perigo de mentirinha: o vulcão é fotogênico, não
ameaçador (L2).

**Hora e luz.** Crepúsculo frio. Lua fria no alto à esquerda faz o aro de luz de cima; o magma faz um **segundo aro
quente embaixo à direita**: é o efeito "duas luzes" de longa de animação, desenhado com 2 traços de 1 px.

### 3.1 Paleta

| Papel | Hex | Origem |
|---|---|---|
| céu topo → horizonte | `#1F2A55` → `#7A5A8A` | §2.1 |
| lua (16% × 12%, raio 14) · halo (raio 60) | `#DDEBFA` · `rgba(221,235,250,0.18)` → 0 | novo |
| montanha distante: sombra · luz · neve | `#3A3F66` · `#50578A` · `#BCCBE8` | §2.1 + novo |
| cratera · borda da cratera · rios de lava · pluma | `#FF6A1F` · `#FFB23F` · `#FF6A1F` · `#8C86A8` alfa 0,5 | §2.1 (magma) + novo |
| brilho do vulcão (radial na cratera, raio 140, no tile) | `rgba(255,106,31,0.35)` → 0 | novo |
| montanha média: sombra · luz · gelo | `#2B2E45` · `#3E4366` · `#A9BCE0` | §2.1 + novo |
| colina · basalto em silhueta · topo do prisma | `#2A2638` · `#1E1C26` · `#3A3646` | §2.1 + novo |
| terreno: manta · corpo | `#DDEBFA` · `#7FA0C8` | §2.1 |
| terreno: borda · contorno · rachadura (traço · miolo · halo de 5 px) | `#6E8EBA` · `#EEF5FF` · `#FF6A1F` · `#FFD23F` · `rgba(255,106,31,0.3)` | novo |
| basalto de jogo: face esquerda (luz) · frente · topo | `#4A4658` · `#2E2A38` · `#5C5870` | novo |
| ponte: laje · luz · junta · fio de geada · pilar | `#6A6680` · `#8A86A0` · `#2E2A38` · `#DDEBFA` · `#3A3646` | novo |
| gêiser: crosta · sombra · vapor | `#D8C9A3` · `#A8946E` · `#CFC8E3` alfa 0,4 | novo |
| contorno duplo: escuro · aro frio · aro quente | `#0B1630` · `#BFD0EA` (cima/esquerda) · `#FF6A1F` (baixo/direita) | novo |

### 3.2 Camadas (fundo → frente)

1. **Céu pré-desenhado:** degradê + lua com halo + 12 estrelas fracas (só no terço de cima).
2. **Distantes com o vulcão:** perfil baixo e largo; em `x` 420 a 640, **o cone**: trapézio (base 220, topo 60 px,
   altura 120) com a faceta esquerda em `luz`, **cratera** = elipse `#FF6A1F` 50 × 8 com borda `#FFB23F`, **brilho
   radial** atrás da cratera (no tile), **3 rios de lava** descendo pela encosta (traço `#FF6A1F` 2 px, zigue-zague
   suave, com o traço largo de alfa 0,3 por baixo), **pluma** de vapor = 5 círculos crescentes subindo e derivando para
   a direita, alfa 0,5. Neve nos ombros do cone, nunca na cratera. Na velocidade 0,04 o tile anda 0,32 px por metro: na
   pista de ~1100 m ele **não se repete** (um vulcão só, como deve ser).
3. **Médias:** facetadas, gelo azul `#A9BCE0` como capuz; **4 rachaduras de magma** descendo de cristas (traço 1,5 px).
4. **Silhuetas (`baseY` 281):** colina `#2A2638`. Sobre ela:
   - **Grupos de colunas de basalto** em `x` 70, 250, 520, 760, 900: cada grupo tem 4 a 6 colunas retangulares de
     largura 10 a 14 px e alturas diferentes (tabela fixa), **topo plano** em `#3A3646` (a "tampa" do prisma, 3 px) com
     neve `#DDEBFA` em metade dos topos. É a forma mais característica da pista: colunas, não pedras redondas.
   - **2 gêiseres de fundo** em `x` 170 e 640: monte de crosta (meia-elipse `#A8946E`) + coluna de vapor (6 círculos
     empilhados `#CFC8E3` alfa 0,4).
   - **Estação da Professora** em `x` 380: casinha quadrada com **antena** (traço + 2 círculos), **anemômetro** (cruz
     com 3 conchinhas) e a **gag**: um **termômetro gigante** fincado ao lado (tubo `roundRect` 8 × 60 `#F7FBFF`, bulbo
     círculo `#C7301C` embaixo, coluna interna metade de baixo vermelha e metade de cima `#9FE3FF`: marca quente e frio
     ao mesmo tempo).
   - Gag 2 em `x` 820: **chaleira** (corpo em elipse `#B8C4DA`, bico, alça) apoiada sobre uma rachadura de magma, com
     1 cacho de vapor. Boneco de neve recorrente: aparece como objeto de jogo (escalda-pés), não aqui.
5. **Terreno:** manta `#DDEBFA` (gelo-neve) e corpo `#7FA0C8` (gelo). **Rachaduras de magma no corpo:** a cada 9 m (hash
   decide se aparece, comprimento 20 a 40 px e forma entre 3 zigue-zagues pré-definidos), começando a `E + 12` px da
   superfície e indo para baixo; cada rachadura = halo de 5 px alfa 0,3 + traço `#FF6A1F` 2 px + miolo `#FFD23F` 1 px.
   Teto: 8 por quadro. Rachadura **nunca** encosta na manta (L2: o chão de pouso é gelo).

### 3.3 Pele dos objetos de jogo

| Elemento | Forma | Contorno |
|---|---|---|
| `pedra` v0 → **prisma de basalto** (`basalto`) | coluna hexagonal vista de 3/4: **face esquerda** `#4A4658` (estreita, a luz), **frente** `#2E2A38` (larga), **topo** losango achatado `#5C5870` com neve; 1 rachadura de magma fina na frente | duplo + aro quente |
| `pedra` v1 → **bomba vulcânica** | elipse irregular (8 vértices com `quadraticCurveTo`), `#2E2A38` com 3 rachaduras brilhando e capuz de neve derretendo (borda do capuz com 2 gotas) | duplo + aro quente |
| `tronco` → **coluna de basalto tombada** | prisma deitado: retângulo comprido + hexágono na ponta esquerda (a "seção" com 6 lados, em `luz`), juntas transversais a cada 0,5 m | duplo + aro quente |
| `pinheiro` → **fumarola de basalto** | 3 colunas altas juntas (o grupo da silhueta, em escala de jogo) com vapor saindo do topo | duplo + aro quente |
| `boneco-de-neve` → **boneco no escalda-pés** | o boneco sentado (só 2 esferas) dentro de uma **bacia de alumínio** (trapézio `#B8C4DA` com faixa de luz), **toalha rosa** `#FF5C8A` enrolada na cabeça, olhos fechados de satisfação (2 arcos), 2 cachos de vapor saindo da bacia | claro `#EEF5FF` |
| trilho → **ponte de basalto** (`ponte-basalto`) | **lajes** retangulares `#6A6680` de 1,5 m emendadas (junta `#2E2A38` de 2 px), faixa de luz `#8A86A0` no terço de cima, **fio de geada** `#DDEBFA` 2 px no topo (é a superfície de grind, 12,10 de contraste); **pilares** `#3A3646` nas pontas e a cada ≤ 5 m; sobre um vão, o brilho radial do magma por baixo da ponte (sprite pré-desenhado) | escuro embaixo (L3) |
| SUBIDA → **crosta de gêiser** (`geiser`) | faixa da subida em crosta `#D8C9A3` com 3 "terraços" (degraus de 2 px em `#A8946E`), borda de crosta mais grossa; adereço: **baforada** de vapor na borda (4 círculos `#CFC8E3` alfa 0,4, pré-desenhados) | — |
| QUEDA → **parede de basalto** (`cratera`, `vao`, `degrau`) | cunha `#2E2A38` com **juntas verticais** `#1E1C26` a cada 10 px (as colunas vistas de lado) e **2 rachaduras de magma** atravessando; na borda de cima, uma tampa de gelo `#DDEBFA` de 3 px. O fundo da cratera (a zona de pouso) é gelo (L2) | — |
| decor sem física | termômetro gigante (`placa`) · chaleira (`bandeira`) · **pórtico de basalto** (`portico`): 2 colunas + laje por cima | nenhum |

**Trechos-assinatura na tela:** `geiser` = a subida curta e íngreme com a baforada na borda (se a F6 aprovar gêiser com
tempo, a baforada vira emissor de partícula no ritmo dele); `ponte-basalto` = vão com a ponte de lajes por cima;
`basalto` = 2 a 3 prismas em sequência, alturas diferentes; `cratera` = a parede de basalto mais larga, com o maior
brilho de magma da pista.

**Partículas (`clima: 'vapor'`).** Fundo: flocos azulados `#DDEBFA` (metade da densidade do Morro) e **vapor** subindo
(círculo 6 a 14 px `#CFC8E3` alfa 0,25, sobe devagar e cresce). Raras **brasas**: ponto `#FFB23F` de 1,5 px subindo
rápido, 1 a cada 40 partículas. Spray do pouso: `#DDEBFA`.

**Microtextos de carregamento:** "Medindo a temperatura…" · "Pelas minhas contas… dá!" · "Esquentando o pé-gelado…".

**Curadoria:** basalto sem aro sumindo na colina (**1,05**, é o caso mais crítico das 4 pistas); magma demais (se mais de
~15% do terreno visível brilhar, a pista vira "inferno" e perde o "pé-gelado": o gelo azul tem que dominar); rachadura
chegando à manta (L2).

---

## 4. CUME DA VENTANIA (`cume-da-ventania`, tema `cume`) — casa do Quequé e do Tio Beto

**A cara.** O final. O topo do mundo, de madrugada, **acima das nuvens**, com aurora no céu e o **minuano** soprando
(o vento frio do sul, que é gaúcho de nascença). Tudo está inclinado pelo vento: biruta esticada na horizontal, pinheiro
torto, cachecol do boneco de neve duro de vento. É a pista **épica e cômica** ao mesmo tempo: o teleférico parou, a
ponte é de corda e, na reta final, a **avalanche cômica** vem atrás. O Tio Beto desce de bermuda jurando que "isso aí
é ar-condicionado"; o Quequé grita que o cume é dele.

**Hora e luz.** Madrugada com aurora. Lua cheia no alto à esquerda faz o aro frio de tudo; a aurora é o espetáculo do
céu, verde-menta com uma franja roxa.

### 4.1 Paleta

| Papel | Hex | Origem |
|---|---|---|
| céu topo → horizonte | `#0C1230` → `#2C3E7A` | §2.1 |
| aurora: faixa 1 · faixa 2 (de baixo, opaca, para cima, transparente) | `#5CF2C2` alfa 0,55 → 0 · `#8A6CFF` alfa 0,30 → 0 | §2.1 (destaque) + novo |
| estrelas (40) · lua (14% × 11%, raio 18) · halo (raio 70) | `#E8F1FF` · `#E8F1FF` · `rgba(232,241,255,0.15)` → 0 | novo |
| montanha distante: sombra · luz · neve | `#3B4C86` · `#5468A6` · `#C9D8F5` | §2.1 + novo |
| mar de nuvens: corpo · topo · luz da borda | `#5D6FA8` · `#7F8FC4` · `#A3B2DE` | novo |
| montanha média: sombra · luz · neve | `#27325E` · `#3A4A82` · `#B7C7EC` | §2.1 + novo |
| colina de rocha · refúgio: parede · janela | `#1A2040` · `#4A2E1B` · `#FFD23F` | §2.1 + novo |
| teleférico: cabo · torre · gôndola · janela | `#B8C4DA` · `#3B4C86` · `#C7301C` · `#FFD23F` | novo |
| biruta: listras · mastro | `#FF8A1F` / `#F7FBFF` · `#B8C4DA` | tokens |
| terreno: manta · corpo | `#E8F1FF` · `#5D6FA8` | §2.1 |
| terreno: estilhaço · luz do estilhaço · borda · contorno | `#8FA3D8` · `#B7C7EC` · `#4E5F98` · `#F4F8FF` | novo |
| rocha de gelo: luz · miolo · sombra · neve | `#B7D3FF` · `#7E9BD8` · `#4E6BB0` · `#E8F1FF` | novo |
| bloco de gelo: face · face escura · reflexo | `#9FE3FF` · `#5FB8E6` · `#F7FBFF` | `--nm-gelo` + novo |
| corda: fibra · trança · poste | `#C9A46A` · `#8A6A3A` · `#4A2E1B` | novo |
| contorno duplo: escuro · aro de lua | `#0B1630` · `#E8F1FF` | novo |
| avalanche: neve · sombra · linhas de giro | `#E8F1FF` · `#BFD0EE` · `#A9BCE0` | novo |
| rajada de vento (traço) | `rgba(232,241,255,0.35)` | novo |

### 4.2 Camadas (fundo → frente)

1. **Céu pré-desenhado (fator 0,01):** degradê + 40 estrelas + lua com halo + **aurora**: 2 faixas onduladas que
   atravessam o tile, cada uma um polígono com a borda de baixo em `quadraticCurveTo` (3 ondas) e a de cima paralela
   60 px acima, preenchido com degradê vertical (opaco embaixo, transparente em cima). Faixa 1 menta mais baixa; faixa 2
   roxa, mais alta e mais fina. Brilho vivo opcional: alfa da camada inteira oscilando entre 0,85 e 1 num ciclo de 6 s
   (um `globalAlpha`, sem redesenho).
2. **Distantes, "estamos acima delas":** picos **agudos e baixos** (`baseY` a 0,40 da altura, não 0,32): o jogador está
   no cume, então a cordilheira fica abaixo da linha dos olhos. Faceta esquerda em `luz`, capuz de neve longo.
3. **Mar de nuvens (camada 1b, fator 0,06):** faixa de rolos de nuvem cobrindo a base das distantes: sequência de arcos
   (raio 20 a 36 px, tabela fixa) com o topo `#7F8FC4` e o corpo `#5D6FA8`; a luz `#A3B2DE` em meia-lua na borda
   superior esquerda de cada rolo. É o que diz "final" sem uma palavra.
4. **Médias:** cristas **serrilhadas** (o dobro de pontos do Morro, deslocamentos maiores) com **cornijas**: em 3
   cristas, o capuz de neve passa da crista para a direita e faz uma onda pendurada (curva que volta para baixo de si
   mesma), o lado do vento.
5. **Silhuetas (`baseY` 281):** colina de rocha `#1A2040` mais irregular (polígono com 12 pontos, não curva). Sobre ela:
   - **Teleférico parado:** 2 **torres de treliça** (trapézio alto + X internos em traço 1,5 px, `#3B4C86`) em `x` 140
     e 700, **cabo** em catenária entre elas (`quadraticCurveTo`, flecha 30 px) e a **gôndola** `#C7301C` pendurada no
     meio, parada, levemente inclinada pelo vento (8°), com janela `#FFD23F` acesa.
   - **Refúgio** em `x` 420: cabana baixa de pedra e madeira, telhado nevado com cornija, 1 janela acesa, chaminé com a
     fumaça **deitada pelo vento** (os cachos saem na horizontal para a direita).
   - **Pinheiros tortos** em `x` 260, 300, 560, 860: o pinheiro do Morro com os andares deslocados para a direita
     (cada andar 3 px mais à direita que o de baixo) e a ponta inclinada.
   - **Biruta** em `x` 620: mastro `#B8C4DA` 40 px + cone listrado (5 faixas `#FF8A1F`/`#F7FBFF`) **esticado na
     horizontal** para a direita.
   - **Gag de fundo** em `x` 790: o **boneco de neve recorrente agarrado a um poste**, com o corpo inclinado na direção
     do vento, o cachecol `#C7301C` esticado reto na horizontal e o chapéu já a 30 px dele, voando.
6. **Terreno:** manta `#E8F1FF`; corpo `#5D6FA8`. **Estilhaços de gelo no corpo:** a cada 7 m (hash decide), um
   triângulo facetado de 14 a 26 px a `E + 10` px da superfície, metade esquerda `#B7C7EC` e metade direita `#8FA3D8`
   (o cristal recebe a luz da lua). Teto: 10 por quadro. Na manta, **sastrugi**: 1 traço curto `#BFD0EE` de 1 px
   inclinado a cada 2 m (a neve esculpida pelo vento).

### 4.3 Pele dos objetos de jogo

| Elemento | Forma | Contorno |
|---|---|---|
| `pedra` v0 → **rocha de gelo** | polígono de 6 vértices (tabela fixa), dividido em 3 facetas: esquerda `#B7D3FF`, miolo `#7E9BD8`, direita `#4E6BB0`; capuz de neve deslocado para a **esquerda** (o vento empurrou) | duplo (escuro + aro `#E8F1FF`) |
| `pedra` v1 → **bloco de gelo** | cubo em 3/4 (frente `#9FE3FF`, lateral direita `#5FB8E6`, topo mais claro), **2 traços de reflexo** `#F7FBFF` em diagonal na frente | duplo |
| `tronco` → **laje de cornija caída** | prisma deitado de neve compacta, frente `#BFD0EE`, ponta esquerda em meia-onda (a cornija que despencou) | duplo |
| `pinheiro` → **pinheiro torto pelo vento** | como na silhueta, em escala de jogo | duplo |
| `boneco-de-neve` → **boneco de cachecol ao vento** | boneco do Morro com o corpo inclinado 10° para a direita, cachecol `#C7301C` em retângulo comprido esticado para a direita com franja, chapéu firme na cabeça (ele o segura com a mão-graveto) | claro `#F4F8FF` |
| trilho, altura < 1 m → **corda** (`fenda-corda`) | **postes de madeira** `#4A2E1B` nas pontas (com amarração em X) e a cada ≤ 5 m; corda `#C9A46A` de 3 px **reta** (no máximo 2 px de flecha: barriga maior engana o pouso), trança = traços curtos `#8A6A3A` a 45° a cada 4 px; fio claro `#F7FBFF` alfa 0,6 no topo | escuro embaixo (L3) |
| trilho, altura ≥ 1 m → **cabo de teleférico** (`teleferico`) | cabo de aço `#B8C4DA` 3 px com fio `#F7FBFF` em cima; **torre de treliça** em cada ponta; **sem postes** no meio (o vazio embaixo é a graça: trilho alto e longo) | escuro embaixo |
| SUBIDA → **cornija enrolada** (`cornija`, rampas) | a borda da subida ganha uma **onda de neve** que se enrola para a frente (curva que passa da borda e volta), luz `#E8F1FF`, barriga `#BFD0EE`; adereço: **biruta pequena** esticada | — |
| QUEDA → **fenda de gelo** (`fenda-corda`, `cornija`) | cunha em degradê vertical **pré-desenhado** (sprite de 1 × 64 px esticado) de `#2C3E7A` (fundo) a `#5D6FA8`, 2 faixas de estratos de gelo `#8FA3D8` paralelas à borda, e **pingentes** (triângulos de 4 × 10 a 16 px) pendurados na borda de cima | — |
| decor sem física | biruta (`bandeira`) · **placa-pictograma** de vento (losango amarelo com 3 traços curvos, sem texto, L4) (`placa`) · **pórtico de gelo** (`portico`): 2 blocos de gelo + laje com pingentes | nenhum |

**Trechos-assinatura na tela:** `fenda-corda` = fenda de gelo com a corda por cima; `teleferico` = cabo alto entre
torres, com uma gôndola parada **de decoração** pendurada no começo; `cornija` = o degrau grande, com a onda de neve na
borda e a fenda embaixo; `reta-avalanche` = reta longa, onde entra a avalanche.

**A avalanche cômica (`reta-avalanche`; mecânica visual da F6, M3-D3).** Bola de neve **gigante** entrando pela
esquerda da tela, só a metade direita visível (raio 1,5 × a altura da tela; o centro fica fora). Corpo `#E8F1FF` com
a sombra `#BFD0EE` em meia-lua à direita; **linhas de giro** = 5 arcos curtos `#A9BCE0` dentro do disco, girando com o
tempo (rotação do contexto, não redesenho). Espetados nela, girando junto: **um esqui, uma placa-pictograma, um tronco
de araucária do Morro e o chapéu do boneco de neve** (o mesmo que voou na silhueta: a gag fecha). **Sem olhos, sem
boca** (§2.6: ameaça, não personagem). Spray de neve forte na borda que toca o chão.

**Partículas (`clima: 'vento-aurora'`).** **Rajadas:** traços de 20 a 40 px `rgba(232,241,255,0.35)`, inclinados −8°,
correndo da esquerda para a direita mais rápido que a câmera (o vento é a favor), 8 a 14 na tela. Flocos com velocidade
horizontal 3× a do Morro. Spray do pouso: `#E8F1FF`, arrastado para a direita.

**Microtextos de carregamento:** "Segurando o chapéu…" · "O minuano chegou!" · "Frio? É ar-condicionado!".

**Curadoria:** peças escuras do Quequé e do Beto (macacão **2,38**, bermuda **1,71** sobre a colina): se a silhueta
inteira não ler no iPhone, a saída é **clarear a colina** na faixa da altura do personagem (ex.: `#1A2040` → `#2A3366`),
não pôr halo (ver §0.6); aurora brigando com o HUD (o HUD fica no topo: a aurora não sobe acima de 25% da altura da
tela); vento "sujando" a tela (teto de 14 rajadas).

---

## 5. Dados para o `DefTema` (Cronos) e o que fica no pintor (Lyra)

O `DefTema.cores` (B.3) tem 7 campos e **é a tabela §2.1, sem mudança**. Todo o resto das paletas acima é constante do
pintor (`render/temas/<tema>.ts`), como as constantes de cor do Morro em `parallax.ts`. O `clima` de cada tema:
`parque` → `'confeito'`, `vila` → `'neve-noturna'`, `vulcao` → `'vapor'`, `cume` → `'vento-aurora'`.

## 6. Ordem de implementação sugerida e custo por quadro

1. Refactor do bosque com prova por pixel (já previsto no plano B.6).
2. **Duas correções no Morro, cada uma no seu commit, depois da prova do refactor** (mudam pixels de propósito; o dono
   vê no portão):
   - **Os trilhos de `pista.trilhos` não são desenhados hoje.** Pela leitura do código: `ui/cenas/descida.ts` só chama
     `desenharTerreno` e `desenharObjetos`; `desenharObjetos` percorre `pista.objetos`; nenhum trecho do catálogo emite
     objeto do tipo `trilho`. O caso `'trilho'` de `render/objetos.ts` nunca dispara, e o piloto desliza 16 px acima da
     neve sem nada embaixo. O `PintorTema.desenharTrilho` (B.3) é o lugar da correção, para os 5 temas.
   - **O objeto é desenhado meia largura à esquerda da sua colisão.** A física usa o intervalo `[x, x + largura]`
     (`pista/consulta.ts`); o render centra o desenho em `x` (`render/objetos.ts`). Centrar em `x + largura / 2`
     (e medir a altura do chão nesse ponto) alinha desenho e colisão.
3. Um tema por vez, na ordem da F3: Picolé, Vila, Vulcão, Cume. Por tema: camadas → terreno (corpo + feições) →
   objetos → partículas → screenshot lado a lado com o Morro para a minha curadoria.

Orçamento por quadro que proponho como portão, além do fps da F4: **≤ 60 primitivas extras no terreno** (granulado,
janelas, rachaduras, estilhaços, sastrugi somados), **≤ 12 sprites de brilho** e **1 `path` por padrão repetido**
(faixa de telha, faixa napolitana), nunca um `fill` por escama.
