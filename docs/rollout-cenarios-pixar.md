# NEVE MALUCA — rollout do cenário raster "Pixar" nas outras 4 pistas

Apolo, 2026-10-23. Projeto, não geração: quem gera é o Atlas, com os prompts daqui. Método = o do piloto do Pico do
Picolé (`docs/piloto-cenario-pixar.md`), sem reinventar: **6 imagens por pista**, mesmas camadas, mesmo pós, mesmo
contrato `PintorTema`, mesmo fallback vetorial. As fichas de cor e de objeto são as de `docs/temas-pistas-m3.md` (Vila
§2, Vulcão §3, Cume §4) e, para o Morro, `docs/direcao-arte-neve-maluca.md` §2.2 + `src/render/temas/bosque.ts`.

| Pista | Tema | Hora | Chroma | Anexo da #1 |
|---|---|---|---|---|
| Morro do Pinhão (`morro-do-pinhao`) | `bosque` | manhã | **magenta `#FF00FF`** | ref limpa do Picolé sobre magenta |
| Vila do Chocolate Quente (`vila-chocolate`) | `vila` | entardecer virando noite | verde `#00FF00` | ref limpa do Picolé sobre verde |
| Vulcão Pé-Gelado (`vulcao-pe-gelado`) | `vulcao` | crepúsculo frio | verde | ref limpa do Picolé sobre verde |
| Cume da Ventania (`cume-da-ventania`) | `cume` | madrugada com aurora | verde | ref limpa do Picolé sobre verde |

---

## 1. O que muda em relação ao piloto (e por quê)

Olhei as 6 fontes do Picolé (`arte-fonte/cenarios/pico-do-picole/*-v1.png`) e o script que as processou
(`arte-fonte/ferramentas-curadoria/cenario-pico-do-picole.py`). Cinco ajustes, todos vindos do que o piloto mostrou:

| # | Ajuste | Por quê (o que o piloto mostrou) |
|---|---|---|
| R1 | **Frase anti-fantasma em toda imagem com chroma** e nenhuma menção a "haze/atmospheric" nelas. | Nas silhuetas do Picolé o gerador pintou **uma segunda fileira de objetos esmaecidos** no verde, acima da real; o script teve de cortar o topo em 31% (`corte_topo_frac=0.31`, medido). A manta veio com uma **faixa-eco** da neve no verde. No Picolé o fantasma era claro; numa pista noturna ele sai **escuro e opaco** (longe do verde), o recorte não o remove e o corte só funciona se ele ficar inteiro acima dos objetos. O pedido de "light warm atmospheric haze" na #1 do piloto é o suspeito: saiu. |
| R2 | **Brilho só dentro da forma** nas imagens com chroma (janela, lanterna, luzinha, magma); halo vem do código (sprite radial pré-desenhado, que as fichas já preveem). | Halo pintado sobre o verde vira meia-transparência esverdeada; o despill a deixa cinza. Halo cinza à noite lê como sujeira. |
| R3 | **Fumaça e vapor nas imagens com chroma = bolinhas de algodão opacas**, nunca fiapo translúcido. | Mesma razão do R2. Vapor é a cara do Vulcão e a fumaça da chaminé é a cara da Vila: não dá para cortar, dá para fazer opaco. O vapor solto continua partícula do jogo. |
| R4 | **A lua não vai no `fundo`: vira célula da folha de objetos** e o código a desenha em posição fixa, com o halo radial (como o brilho do sol do Picolé, camada 1b). | O `fundo` anda a 0,04: numa pista de ~1100 m a lua atravessaria ~350 px lógicos da tela. Astro tem de ficar parado. Estrelas podem ir no `fundo` (pontos pequenos andando devagar não incomodam). |
| R5 | **Anexo da imagem #1 de cada pista = as silhuetas aprovadas do Picolé, já recortadas, compostas sobre o chroma daquela pista** (arquivo de referência, 0 crédito, abaixo). As #2 a #6 anexam a #1 aprovada da própria pista, como no piloto. | (a) O Capi **não tem mestra** (`arte-fonte/personagens/` só tem bandeira, beto, bia, cidinha, queque), então "mestra da casa" não serve para o Morro. (b) No piloto, as 5 imagens que anexaram a #1 **não copiaram nenhum objeto dela** quando o REF mandou não copiar: cenário como referência já foi provado. (c) Anexar a `silhuetas-v1.png` original ensinaria o fantasma ao gerador; a versão processada (`silhuetas.webp`) não tem. (d) Anexar fundo verde num pedido magenta (Morro) convida o gerador a manter o verde. |

**Arquivo de referência (Atlas, script, 0 crédito):** abrir `public/assets/cenarios/pico-do-picole/silhuetas.webp`
(RGBA, 2520 × 1080) e compor sobre um fundo chapado. Duas saídas em `arte-fonte/cenarios/_ref/`:
`ref-picole-verde.png` (sobre `#00FF00`) e `ref-picole-magenta.png` (sobre `#FF00FF`). Plano B se a #1 de uma pista
noturna vier pastel/diurna demais (o Picolé puxando a paleta): refazer anexando a mestra do personagem da casa
(`cidinha`, `bandeira` ou `beto`, em `arte-fonte/personagens/<id>/modelo/mestra-v1.png`) com o REF de mestra do piloto
§3.2. Isso gasta reserva.

### 1.1 Chroma por pista (a mesma conta da A3 do piloto)

Distância RGB euclidiana (a de `alfa_chave` em `comum.py`, opaco a partir de 118) da cor mais próxima da paleta da
ficha até cada chave. Aritmética sobre os hex da ficha, não sobre a imagem gerada: a curadoria confere.

| Pista | Menor distância ao verde | Menor distância ao magenta | Escolha |
|---|---|---|---|
| Morro | **165** (araucária `#2E6B3A`) | **211** (bandeirinha `#E74C3C`) | **magenta** |
| Vila | **167** (luzinha `#3DDC97`) | 149 (luzinha `#FF5C8A`), 151 (gorro `#E85D8A`) | verde |
| Vulcão | **218** (basalto `#4A4658`) | 149 (toalha `#FF5C8A`) | verde |
| Cume | **211** (trança `#8A6A3A`) | 159 (aurora roxa `#8A6CFF`) | verde |

O Morro é o único que troca, e a conta não é o motivo principal: as duas chaves passam de 118. O motivo é o **despill**.
O do piloto limita G a `max(R, B)` na borda: numa araucária `#2E6B3A` isso leva o G de 107 para 58 e a borda da
folhagem fica cinza. Um tema cheio de verde não pode ter chave verde. (Os tons de brilho que o render põe na folhagem,
tipo `#4CA050`, ficam a ~146 do verde e a ~297 do magenta: reforça.)

**Despill magenta** (no lugar do verde, só no Morro): nos pixels de alfa < 255, `e = min(R, B) − G`; se `e > 0`,
`R −= e` e `B −= e`. Tira a componente magenta igual dos dois canais. Conferido nos vermelhos do Morro: celeiro
`#B83A2B` e bandeirinha `#E74C3C` têm `min(R, B) < G`, o despill não toca neles.

Nas pistas de chave verde, o despill do piloto acinzenta um pouco a borda das luzinhas menta da Vila e do cristal do
Cume. São pontos de 2 a 4 px: aceito.

---

## 2. Orçamento e ordem (Nano Banana a 2K = 6 créditos por imagem; saldo do Atlas: 170)

| Ordem | Pista | Imagens | Créditos | Acumulado |
|---|---|---|---|---|
| 1 | **Morro do Pinhão** | #1 #2 #3 → portão → #4 #5 #6 | 36 | 36 |
| 2 | **Vila do Chocolate Quente** | idem | 36 | 72 |
| 3 | **Vulcão Pé-Gelado** | idem | 36 | 108 |
| 4 | **Cume da Ventania** | idem | 36 | **144 (plano)** |
| — | sobra | — | 26 | **= 4 imagens de reserva, não planejadas** |

- **Plano: 24 imagens, 144 créditos.** Sem reserva de estilo (o Picolé ancorou).
- **A sobra de 26 créditos é a única reserva das 4 pistas** (reparo de costura, refazer uma reprovada). Ela é do
  rollout inteiro, não de cada pista. Depois de 2 falhas na mesma imagem: aceitar e ajustar no jogo (BAATAR, §4.13 da
  direção de arte). Conferir o saldo antes de cada imagem.
- Se a reserva for gasta, **a UI fica sem crédito nenhum** (era a pendência do piloto e continua).

**Por que essa ordem.** O Morro é a pista 1, a primeira impressão e o tutorial; é dia, como o piloto (menor risco), e
é onde estreia a chave magenta. A Vila é a **primeira noturna**: prova a receita da noite (R1 a R4) antes de gastar nas
outras duas. O Cume fica por último porque é o mais carregado (aurora, mar de nuvens, vento) e herda tudo o que a Vila
e o Vulcão ensinarem.

**Portão por pista (grátis, igual ao §4 do piloto):** depois de #1 a #3, montagem 1920 × 1080 por script com o recorte
do personagem da casa em escala de jogo (Capi no Morro, Cidinha na Vila, Bandeira no Vulcão, Quequé **e** Beto no Cume:
são as peças escuras que a ficha §0.6 marcou como risco). A pergunta do portão é a mesma: "o personagem parece estar
DENTRO deste mundo?". No Morro e na Vila o portão é obrigatório (chave nova; primeira noite). No Vulcão e no Cume o
dono decide se quer ver antes ou só no fim.

---

## 3. Blocos comuns (cole na ordem: BLOCO S0, BLOCO S da pista, CAMERA, linha em branco, REF, linha em branco, o bloco da imagem, linha em branco, o BLOCO P da pista)

### 3.1 BLOCO S0 (início de toda imagem, todas as pistas)

```
Stylized 3D animated family-movie environment art for a comic side-scrolling snowboarding video game, matching the look of the game's characters: appealing cartoon shapes, soft rounded forms, smooth high-quality CG render, gentle ambient occlusion.
```

### 3.2 CAMERA (logo depois do BLOCO S da pista; idêntico ao piloto)

```
CAMERA: a straight side view like a side-scrolling game, flat orthographic look, level horizon, no perspective vanishing point, no tilt, everything seen exactly from the side.
```

### 3.3 REF

Imagem #1 de cada pista (anexo: `arte-fonte/cenarios/_ref/ref-picole-verde.png`; no Morro, `ref-picole-magenta.png`):
```
Use the attached image ONLY as a reference for rendering quality, material softness, shape language and lighting style: this new image is a different place in the same game world. Do NOT copy its objects (no ice cream, no cones, no popsicles, no sprinkles, no cart), do NOT copy its colors, its palette or its time of day. Follow the description below.
```
Imagens #2 a #6 (anexo: a #1 aprovada **da própria pista**, a original, antes do recorte). Igual ao piloto:
```
Use the attached image ONLY as a reference for rendering style, materials, palette and lighting: this new image must look like it belongs to the same game world. Do NOT copy its composition or its objects unless they are described below.
```

### 3.4 Frases fixas das imagens com chroma (já estão escritas dentro de cada prompt; aqui só para a curadoria saber o que procurar)

- **[UMA FILEIRA]** `There is only ONE row of objects. Nothing stands behind them: no second row, no faded or transparent copies, no distant scenery, no reflections.`
- **[CHAVE]** `... one single flat solid pure <cor> <hex>, completely empty: no sky, no clouds, no haze, no gradient, no glow and no shadow on it.`
- **[BRILHO]** `Glowing parts glow only inside their own shapes: no light halo, no bloom and no glow spilling onto the background.`
- **[FUMAÇA]** `Smoke and steam are small, fully opaque, puffy cartoon balls like cotton, never transparent or wispy.`

### 3.5 BLOCO P-DIA (fim de toda imagem do Morro)

```
Absolutely NO text, letters, numbers, logos, brand names, labels, signs with words, flags of countries, captions, grid lines, borders or frames. NO people, NO characters, NO animals, NO snowboarders. NO visual effects: no falling snowflakes, no sparkles, no glitter particles, no lens flare, no sun disc, no light rays, no motion blur, no depth-of-field blur, no vignette.
```
Só na #1 do Morro, troque `NO animals,` por `NO animals except the one cow described above,`.

### 3.6 BLOCO P-NOITE (fim de toda imagem da Vila, do Vulcão e do Cume)

```
Absolutely NO text, letters, numbers, logos, brand names, labels, signs with words, flags of any kind, captions, grid lines, borders or frames. NO people, NO characters, NO animals, NO snowboarders. NO religious symbols: no church, no chapel, no cross, no bell tower, no prayer flags. NO visual effects: no falling snowflakes, no sparkles, no glitter particles, no lens flare, no light rays, no bloom, no motion blur, no depth-of-field blur, no vignette.
```
Só na #1 da Vila, troque `NO animals,` por `NO animals except the one orange cat described above,`.

---

## 4. MORRO DO PINHÃO (`morro-do-pinhao`, tema `bosque`) — casa do Capi

Serra fria do sul do Brasil num inverno raro, de manhã: araucárias nevadas, cerca de fazenda, celeiro vermelho ao longe.
É a primeira pista: limpa, acolhedora, de leitura fácil. Paleta de `bosque.ts`/§2.1 sem mudança.

**Decisão para o dono (registrar em "Decisões em aberto"):** o Morro vetorial **não tem pele de feição** (a ficha §0.4
o congelou porque o refactor tinha de ser idêntico por pixel). O pintor raster é novo, então pode ganhar rampa e queda
com textura. A #6 já traz as duas texturas (custo igual); se o dono preferir o Morro sem feições, a Lyra usa só corpo,
manta e neve, e as outras duas ficam sem uso. A **vaca malhada** (gag de fundo da §2.2) e o **boneco de cartola** (o
boneco recorrente, que volta na Vila e no Cume) também não existem no vetor de hoje: entram aqui.

### 4.1 BLOCO S da pista

```
Fresh soft powder snow with a gentle cool-blue subsurface glow, rough bark, dark evergreen needles holding clumps of snow, painted wood. Sunny MORNING light: soft warm key light from the upper LEFT, a soft cool sky-blue fill light, soft colored shadows that are light blue, never gray. Clear, bright, fresh morning colors.
World theme: a cold mountain ridge in the highlands of southern Brazil on a rare snowy winter morning: tall Brazilian araucaria trees (Parana pine: a tall straight bare trunk topped by a flat, wide candelabra crown of upward-curving branches), small snowy fir trees, rustic wooden farm fences, a red wooden barn far away. Cozy, fresh and welcoming: the first slope of the game.
```

### 4.2 Imagem #1 — SILHUETAS (21:9, chroma magenta)

```
A wide panoramic strip, aspect ratio 21:9: the NEAR BACKGROUND layer of a parallax background, seen exactly from the side.
A gentle, softly rolling hill of snow crosses the whole image from the left edge to the right edge: bright snow (#F7FBFF) on its sunny top edge, soft blue shade (#BFD9EE) lower down. The top of the hill sits between 50% and 56% of the image height measured from the top, and the hill fills everything below it down to the bottom edge.
Standing on top of the hill, spaced out with clear empty gaps between them, all at the same distance from the camera and all seen straight from the side:
- four tall araucaria trees (dark evergreen #2E6B3A, brown trunks #4A2E1B), each with a tall bare trunk and a flat wide crown of upward-curving branches like a candelabra, every branch tip holding a soft clump of snow; different heights;
- four small snowy fir trees in two or three tiers, in groups of two;
- one small red wooden barn (#B83A2B with darker trim #6E1F16) with a thick rounded snow roof and white cross-braced doors, the only building;
- one short stretch of rustic wooden farm fence (three posts and two rails) with snow on the top rail;
- one black-and-white spotted dairy cow sitting on its rump in the snow like a puppy, calm and a little confused, looking at the camera;
- one small friendly snowman made of three snowballs, with a black top hat, a carrot nose pointing RIGHT, a red scarf and twig arms.
The tallest araucaria reaches up to about 30% of the image height from the top. Every object stands firmly on the hill.
There is only ONE row of objects. Nothing stands behind them: no second row, no faded or transparent copies, no distant scenery, no reflections.
This layer sits behind the gameplay: slightly softer contrast than a hero object, but crisp clean silhouette edges.
It must repeat sideways: at the left edge and at the right edge there is only bare hill, at exactly the same height, and no object is closer than 6% of the image width to either edge.
Everything above the hill and around the objects is one single flat solid pure magenta #FF00FF, completely empty: no sky, no clouds, no haze, no gradient, no glow and no shadow on the magenta. The magenta stays perfectly flat and pure.
```

### 4.3 Imagem #2 — MONTANHAS MÉDIAS (16:9, chroma magenta)

```
A wide strip, aspect ratio 16:9: the MIDDLE layer of a parallax background, seen exactly from the side.
One continuous range of mountains made of cool blue-gray rock and snow (#7FA3C9), built from big flat angular facets like a low-poly sculpture with slightly softened edges; the facets facing LEFT are lit lighter (#9EBFE3). The peaks sit between 28% and 45% of the image height measured from the top, with uneven heights, and the mountains fill everything below them down to the bottom edge.
Each peak wears a thick soft cap of snow (#EAF2FA) running down the slope in two or three rounded tongues, never symmetric.
On the lower slopes, scattered tiny distant araucaria tree silhouettes in muted blue-green (#5C82A6), only as small shapes, no detail.
This range is in the middle distance: lighter colors and lower contrast than the near layer.
It must repeat sideways: the left edge and the right edge both cut through the same low valley at exactly the same height.
Everything above the mountains is one single flat solid pure magenta #FF00FF, completely empty: no sky, no clouds, no haze, no gradient, no glow. The magenta stays perfectly flat and pure.
```

### 4.4 Imagem #3 — FUNDO: céu + serra distante (16:9, opaca)

```
A wide image, aspect ratio 16:9, that fills the whole frame: the FAR BACKGROUND layer of a parallax background, seen exactly from the side.
Sky: a smooth vertical gradient from clear morning blue (#4FA8F0) at the top to pale icy blue (#BFE6FF) at the horizon. Three small soft rounded clouds in the upper half, simple and puffy.
Far away, a long mountain range of broad, gently pointed ridges in pale blue (#A9C7E6), the faces turned to the LEFT lit lighter (#D2E4F7), each ridge with a long soft cap of snow (#F7FBFF). The tops of the ridges sit between 16% and 34% of the image height measured from the top, and the range fills everything below them down to the bottom edge.
Strong atmospheric haze: the range is very soft and low in contrast, melting into a pale blue morning mist toward the bottom of the image.
It must repeat sideways: the left edge and the right edge both cut through the same valley at exactly the same height, and the clouds stay away from both edges.
No sun disc and no moon in the sky.
```

### 4.5 Imagem #4 — FOLHA DE OBJETOS (4:3, chroma magenta)

```
Game object sprite sheet, landscape image, aspect ratio 4:3.
Exactly 12 separate objects in an invisible grid of 4 columns and 3 rows, one object centered in each cell. Each object is only about 70% of the height of its row and 75% of the width of its column, with an empty band of plain background at least 8% of the image height between rows and along every edge. No object touches another object or the image border. Nothing is cut off. No captions, no labels and no names under the objects.
Every object is seen straight from the side, like in a side-scrolling game, and rests on the same invisible baseline at the bottom of its row.
These objects are shown very small in the game: chunky, simple, bold shapes with saturated colors and a few big readable details, no tiny clutter.
Background: one single flat solid pure magenta #FF00FF filling the whole image. No ground, no snow surface, no ground line, no ground shadow, no contact shadow, no gradient.
Row 1: (1) a low rounded gray granite boulder (lit side #7B8F9F, shade #4A5B6C), wider than tall, with a thick soft cap of snow on top, (2) a chunkier boulder made of two stacked gray rocks, about as tall as wide, with snow on top and a small snow pile at its foot, (3) a fallen araucaria log lying perfectly horizontal, rough brown bark (#4A2E1B and #7A4D2E), its cut LEFT end showing pale tree rings, one short broken branch stub on top, a long strip of snow along its top, (4) a young snowy fir tree in three tiers, dark evergreen (#2E6B3A) with thick snow on every tier, a short brown trunk, taller than wide.
Row 2: (1) a friendly snowman made of three snowballs, black top hat, coal eyes and smile, carrot nose pointing RIGHT, red scarf (#C0392B), two twig arms, (2) a shiny golden pine nut seed (pinhao) shaped like a plump elongated drop, glossy amber-gold (#F5B041) with a darker tip (#D68910) and a white shine on its upper left, a collectible toy-like object, (3) one long wooden fence rail lying perfectly horizontal, planed light-brown wood (#7A4D2E) with two faint grain lines along its length, rounded ends, about ten times longer than it is thick, (4) one short wooden fence post standing perfectly vertical, dark wood (#4A2E1B), square, with a small cap of snow on top, about four times taller than wide.
Row 3: (1) a small red pennant flag (#E74C3C) on a thin wooden pole, the triangle pointing RIGHT, (2) the same pennant flag on a thin wooden pole, golden yellow (#F5B041), (3) a rustic farm gate arch made of two log posts joined at the top by a horizontal log beam, snow on the beam, (4) a wooden signpost with one plank shaped like an arrow pointing RIGHT, no writing on it, snow on top of the plank.
```

### 4.6 Imagem #5 — FAIXA DA MANTA (21:9, chroma magenta em cima)

```
A wide panoramic image, aspect ratio 21:9: a straight side cross-section of a thick slab of mountain snow, like a slice of cake seen exactly from the side, used as a repeating ground texture in a side-scrolling game.
The top 70% of the image is one single flat solid pure magenta #FF00FF, completely empty: no faded copy of the slab, no reflection, no haze band. The magenta stays perfectly flat and pure.
The slab fills only the lower 30% of the image, from edge to edge. From top to bottom: a fluffy layer of fresh powder snow (#F7FBFF) with a soft rounded top edge catching warm sunlight from the upper LEFT and a gentle light-blue shade underneath (about one third of the slab height); a band of older packed snow (#DCEAF6) with two faint thin horizontal strata lines; then soft blue shaded snow (#BFD9EE) down to the bottom edge.
The top edge of the snow is one straight horizontal line across the whole width, with only tiny soft bumps. All bands are perfectly horizontal and parallel and run past the left and right edges.
It must repeat sideways: the left edge and the right edge are identical in height and color.
No objects, no ground shadow, no sky.
```

### 4.7 Imagem #6 — FOLHA DE TEXTURAS (1:1, opaca)

```
A square image, aspect ratio 1:1, divided into 4 equal square texture swatches in a 2 by 2 grid, each swatch completely filled edge to edge with one flat, evenly lit material seen straight on, with no objects, no horizon, no perspective and no shadows from outside. No gaps, borders or lines between the swatches.
Top left: soft shaded packed snow (#BFD9EE) with a very subtle powdery grain.
Top right: hard groomed snow (#DCEAF6) with a subtle even pattern of small compressed snow granules and a few tiny ice glints.
Bottom left: a gray granite rock face (#7B8F9F with darker cracks #4A5B6C) with small patches of snow stuck in the cracks.
Bottom right: fresh bright snow (#F7FBFF) with a very subtle soft powdery grain.
Each swatch is even and uniform from edge to edge, with no strong single highlight, so it can repeat as a tiling texture.
```

### 4.8 Objeto → arquivo → tipo (Morro)

R1C1 `obj-pedra-baixa` (`pedra` v0) · R1C2 `obj-pedra-dupla` (`pedra` v1) · R1C3 `obj-tora-araucaria` (`tronco`) ·
R1C4 `obj-pinheiro` (`pinheiro`; no vetor ele cai no fallback, aqui ganha pele) · R2C1 `obj-boneco-cartola`
(`boneco-de-neve`) · R2C2 `obj-pinhao` (`floco`) · R2C3 `obj-travessa` (trilho: o fio de grind, 3 fatias, como o palito)
· R2C4 `obj-mourao` (trilho: os pés, a cada ≤ 4 m, sem girar) · R3C1 `obj-bandeirinha-vermelha` (adereço da SUBIDA) ·
R3C2 `obj-bandeirinha-amarela` (2ª rampa do `kicker-duplo`) · R3C3 `obj-porteira` (`portico`) · R3C4 `obj-placa-seta`
(`placa`). `bandeira` sem física = `obj-bandeirinha-vermelha` em escala 0,8.

Texturas: `tex-corpo` (TL) · `tex-subida` (TR) · `tex-queda` (BL) · `tex-neve` (BR).

**Curadoria específica:** araucária que não lê como araucária (copa de pinheiro comum em cone) é o defeito que mais
importa: é a identidade da pista; vaca ou boneco grandes demais (passaram de ~18% da altura): competem com o Capi;
borda da folhagem acinzentada ou rosada: despill errado (tem de ser o magenta da §1.1).

---

## 5. VILA DO CHOCOLATE QUENTE (`vila-chocolate`, tema `vila`) — casa da Vó Cidinha

Vila colonial da serra na hora em que as luzes acendem, tão ladeira abaixo que os telhados viraram pista. Enxaimel,
janela amarela, luzinhas, caneca fumegante. A pista aconchegante. Paleta da ficha §2.1.

### 5.1 BLOCO S da pista

```
Soft snow with a cool lavender glow, warm half-timbered walls, glazed clay roof tiles, brick, painted wood. EVENING turning into night: soft cool moonlight from the upper LEFT is the key light and leaves a pale lavender rim on the left and top edges of every shape; warm golden light from windows and lanterns is the fill. Soft colored shadows that are deep violet-blue, never gray and never black. Rich, cozy, saturated evening colors.
World theme: a cozy colonial mountain village in the highlands of southern Brazil, built so steeply downhill that its snowy rooftops became the ski slope: half-timbered houses (cream walls with dark brown wooden beams forming squares and X shapes, the German colonial "enxaimel" style), very steep snowy gable roofs with rounded clay tiles, brick chimneys, glowing yellow windows, strings of colorful little lights, a giant mug of hot chocolate in the little square. Warm and welcoming, like grandma's house.
```

### 5.2 Imagem #1 — SILHUETAS (21:9, chroma verde)

```
A wide panoramic strip, aspect ratio 21:9: the NEAR BACKGROUND layer of a parallax background, seen exactly from the side.
A gentle, softly rolling snowy hill in deep evening shade crosses the whole image from the left edge to the right edge: dusky violet (#3A2E5C) with a thin pale lavender moonlit rim (#C9CBEB) along its top edge. The top of the hill sits between 50% and 56% of the image height measured from the top, and the hill fills everything below it down to the bottom edge.
Standing on top of the hill, spaced out with clear gaps between them, all at the same distance from the camera and all seen straight from the side:
- seven small half-timbered houses of different widths, each showing its gable end to the camera: a very steep triangular roof (the roof is about as tall as 0.7 times the house width) with a thick rounded cap of snow (#C9CBEB), walls in deep evening shade (#2A1F3D) with the dark beams just visible, two or three small square windows with a cross in the middle, most of them glowing warm yellow (#FFB84D) and a few dark (#1C1530), and one brick chimney (#9C4A3A) on each roof with three small puffs of smoke leaning to the right;
- two strings of little round light bulbs hanging in a gentle curve between the roof tops of two pairs of neighboring houses, the bulbs repeating amber, pink, sky blue and mint;
- one small square with a giant mug of hot chocolate (cream mug #F2E3C2, chocolate #6B3A2A, two white marshmallows floating) and one slim lamppost with a glowing lantern beside it;
- one orange cat (#FF8A1F) sitting on top of one chimney, seen from the back, its tail curled in an S, two tiny glowing eyes looking back over its shoulder;
- in the small round attic window of one house, the head of a small snowman wearing a knitted pink beanie (#E85D8A), its carrot nose sticking out.
The tallest roof reaches up to about 30% of the image height from the top. Every house stands firmly on the hill.
There is only ONE row of houses. Nothing stands behind them: no second row, no faded or transparent copies, no distant scenery, no reflections.
Smoke and steam are small, fully opaque, puffy cartoon balls like cotton (#8F86B8), never transparent or wispy.
Glowing parts (windows, bulbs, lantern) glow only inside their own shapes: no light halo, no bloom and no glow spilling onto the green.
This layer sits behind the gameplay: slightly softer contrast than a hero object, but crisp clean silhouette edges.
It must repeat sideways: at the left edge and at the right edge there is only bare hill, at exactly the same height, and no object is closer than 6% of the image width to either edge.
Everything above the hill and around the objects is one single flat solid pure green #00FF00, completely empty: no sky, no clouds, no haze, no gradient, no glow and no shadow on the green. The green stays perfectly flat and pure.
```

### 5.3 Imagem #2 — MONTANHAS MÉDIAS (16:9, chroma verde)

```
A wide strip, aspect ratio 16:9: the MIDDLE layer of a parallax background, seen exactly from the side.
One continuous range of mountains in deep evening violet (#3F3570), built from big flat angular facets like a low-poly sculpture with slightly softened edges; the facets facing LEFT catch the moonlight and are lighter (#554A8A). The peaks sit between 28% and 45% of the image height measured from the top, with uneven heights, and the mountains fill everything below them down to the bottom edge.
Each peak wears a thick cap of lavender snow (#A9A3D6) running down the slope in two or three rounded tongues, never symmetric.
On the slopes, five tiny warm yellow windows (#FFB84D) scattered far apart: faraway houses seen only by their light, glowing only inside their own small squares.
This range is in the middle distance: lower contrast than the near layer.
It must repeat sideways: the left edge and the right edge both cut through the same low valley at exactly the same height.
Everything above the mountains is one single flat solid pure green #00FF00, completely empty: no sky, no clouds, no haze, no gradient, no glow. The green stays perfectly flat and pure.
```

### 5.4 Imagem #3 — FUNDO: céu do entardecer + serra distante (16:9, opaca)

```
A wide image, aspect ratio 16:9, that fills the whole frame: the FAR BACKGROUND layer of a parallax background, seen exactly from the side.
Sky: a smooth vertical gradient from deep indigo (#2A2257) at the top to warm sunset orange (#E88A5A) at the horizon, evenly across the whole width. About twenty-four tiny soft round stars (#FFF3D6), dim and calm, only in the top third. No sun disc and no moon in the sky.
Far away, a range of low, rounded old hills (not sharp alpine peaks) in dusky violet (#5B4A8A), the faces turned to the LEFT lit lighter (#7564A3), each hill with a soft cap of lavender snow (#C8C1E6). The tops of the hills sit between 26% and 40% of the image height measured from the top, and the range fills everything below them down to the bottom edge.
Strong atmospheric haze: the hills are very soft and low in contrast, melting into a warm violet-orange evening haze toward the bottom of the image.
It must repeat sideways: the left edge and the right edge both cut through the same valley at exactly the same height.
```

### 5.5 Imagem #4 — FOLHA DE OBJETOS (4:3, chroma verde)

```
Game object sprite sheet, landscape image, aspect ratio 4:3.
Exactly 12 separate objects in an invisible grid of 4 columns and 3 rows, one object centered in each cell. Each object is only about 70% of the height of its row and 75% of the width of its column, with an empty band of plain background at least 8% of the image height between rows and along every edge. No object touches another object or the image border. Nothing is cut off. No captions, no labels and no names under the objects.
Every object is seen straight from the side, like in a side-scrolling game, and rests on the same invisible baseline at the bottom of its row. Evening light: cool lavender moonlight from the upper LEFT, a soft warm golden bounce from below. The objects are clearly lit and readable, not dark.
These objects are shown very small in the game: chunky, simple, bold shapes with saturated colors and a few big readable details, no tiny clutter.
Glowing parts glow only inside their own shapes: no light halo and no glow on the background. No smoke and no steam on any object.
Background: one single flat solid pure green #00FF00 filling the whole image. No ground, no snow surface, no ground line, no ground shadow, no contact shadow, no gradient.
Row 1: (1) a short square brick chimney standing on the ground (bricks #9C4A3A, mortar lines #6E2F24), its top crown a little wider, with a thick rounded cap of snow, (2) a wooden barrel (#7A4D2E) standing upright with slightly bulging sides, three dark iron hoops (#3A3F4A) and a cap of snow on its lid, (3) a parked wooden sled seen from the side, longer than tall: a bright red seat (#C7301C) shaped like an L with its backrest on the LEFT, dark wooden runners (#4A2E1B) curling up at the RIGHT end, a cushion of snow on the seat, (4) a snowy fir tree in three tiers, dark evergreen with snow on every tier, wrapped in one zigzag string of little round lights (amber, pink, sky blue, mint), no star on top, taller than wide.
Row 2: (1) a friendly snowman made of three snowballs, a knitted pink beanie with a pompom (#E85D8A), coal eyes and smile, carrot nose pointing RIGHT, one twig arm holding a small cream mug of hot chocolate, (2) a plump glossy white marshmallow with a soft pink shade underneath and a white shine on its upper left, a collectible toy-like object, (3) one long straight cream-colored rope (#E9D9B8) lying perfectly horizontal, about ten times longer than it is thick, with tiny round light bulbs hanging just BELOW it at even intervals, repeating amber, pink, sky blue and mint, nothing on top of the rope, (4) a slim dark colonial lamppost (#2A1F3D) standing perfectly vertical, with a small four-sided lantern glowing warm yellow (#FFB84D) at the top.
Row 3: (1) a weather vane on a short dark pole: a horizontal arrow pointing RIGHT with a triangular tail, no rooster, no letters, (2) a crescent moon, soft glowing cream (#FFF3D6), with gentle soft craters, no face, (3) a giant cream mug of hot chocolate (#F2E3C2, chocolate #6B3A2A) with two white marshmallows floating, its handle on the RIGHT, (4) a decorative arch made of two half-timbered pillars (cream #D9C7A8 with dark beams #4A2E1B) joined at the top by a crossbeam carrying a small snowy roof of clay tiles.
```

### 5.6 Imagem #5 — FAIXA DA MANTA: neve + telha (21:9, chroma verde em cima)

```
A wide panoramic image, aspect ratio 21:9: a straight side cross-section of a snowy village roof, like a slice of cake seen exactly from the side, used as a repeating ground texture in a side-scrolling game.
The top 70% of the image is one single flat solid pure green #00FF00, completely empty: no faded copy of the slab, no reflection, no haze band. The green stays perfectly flat and pure.
The slab fills only the lower 30% of the image, from edge to edge. From top to bottom: a fluffy layer of snow (#EAF0FF) with a soft rounded top edge catching pale lavender moonlight from the upper LEFT and a gentle violet-blue shade underneath (about 40% of the slab height); one row of rounded clay roof tiles seen from the side, all the same size, overlapping like fish scales, terracotta (#8A3B2E) with a darker shade (#5E2620) at the bottom of each tile; then cool periwinkle snow in shade (#8F9BD1) down to the bottom edge.
The top edge of the snow is one straight horizontal line across the whole width, with only tiny soft bumps. All bands are perfectly horizontal and parallel and run past the left and right edges.
It must repeat sideways: the left edge and the right edge are identical in height and color.
No objects, no ground shadow, no sky.
```

### 5.7 Imagem #6 — FOLHA DE TEXTURAS (1:1, opaca)

```
A square image, aspect ratio 1:1, divided into 4 equal square texture swatches in a 2 by 2 grid, each swatch completely filled edge to edge with one flat, evenly lit material seen straight on, with no objects, no horizon, no perspective and no shadows from outside. No gaps, borders or lines between the swatches.
Top left: cool periwinkle snow in shade (#8F9BD1) with a very subtle soft powdery grain.
Top right: rounded clay roof tiles in an even fish-scale pattern, terracotta (#8A3B2E) with a darker shade (#5E2620) at the bottom of each tile and a little snow caught in the gaps, all tiles the same size.
Bottom left: a half-timbered wall: cream plaster (#D9C7A8) divided by dark brown wooden beams (#4A2E1B) in an even grid of vertical posts with one X brace between every pair, no windows.
Bottom right: fresh snow in evening light (#EAF0FF) with a very subtle soft powdery grain.
Each swatch is even and uniform from edge to edge, with no strong single highlight, so it can repeat as a tiling texture.
```

### 5.8 Objeto → arquivo → tipo (Vila)

R1C1 `obj-chamine` (`pedra` v0) · R1C2 `obj-barril` (`pedra` v1) · R1C3 `obj-treno` (`tronco`) · R1C4
`obj-pinheiro-luzinhas` (`pinheiro`) · R2C1 `obj-boneco-gorro` (`boneco-de-neve`) · R2C2 `obj-marshmallow` (`floco`) ·
R2C3 `obj-varal` (trilho: fio de grind; **o meio repete em vez de esticar**, senão as lâmpadas esticam) · R2C4
`obj-lampiao` (trilho: os postes, a cada ≤ 6 m; também `bandeira` sem física a 0,8) · R3C1 `obj-cata-vento` (adereço da
SUBIDA; na 2ª rampa do `kicker-duplo`, o mesmo tingido de âmbar no boot, `source-atop`) · R3C2 `obj-lua` (lua fixa,
camada 1b) · R3C3 `obj-caneca` (`placa`) · R3C4 `obj-portico-enxaimel` (`portico`).

Texturas: `tex-corpo` (TL) · `tex-telha` (TR, SUBIDA) · `tex-enxaimel` (BL, QUEDA) · `tex-neve` (BR). A **janela acesa**
da parede enxaimel e as janelas do corpo continuam por código (ficha §2.2-5 e §2.3), com o sprite de brilho: textura
repetida com janela mostraria a repetição.

**Curadoria específica:** casas virando borrão roxo (as janelas acesas desenham a vila: ≥ 12 acesas visíveis na tela,
ficha §2.3); telhado de duas águas baixo (lê "praia", não "serra"); fumaça translúcida (R3); igreja, capela ou torre de
sino em qualquer lugar (L5); gato ou boneco grandes demais.

---

## 6. VULCÃO PÉ-GELADO (`vulcao-pe-gelado`, tema `vulcao`) — casa da Professora Bandeira

Gelo azul por fora, magma só nas rachaduras. Colunas de basalto hexagonais, gêiseres, estação de medição com
termômetro gigante. Perigo de mentirinha (L2). Paleta da ficha §3.1. **O gelo azul domina; o laranja é tempero.**

### 6.1 BLOCO S da pista

```
Blue glacier ice and icy snow, dark matte basalt rock, glowing orange magma only inside thin cracks, warm sandy geyser crust. Cold TWILIGHT with two lights, the classic look of animated films: soft cool moonlight from the upper LEFT is the key light and leaves a pale icy rim on the left and top edges; a warm orange glow from the magma comes from BELOW RIGHT as a second, thinner rim light. Soft colored shadows that are deep blue-violet, never gray and never black. Cool saturated colors: icy blue dominates, orange is only a small accent.
World theme: a funny cartoon volcano that cannot decide if it is hot or cold: blue ice and snow outside, glowing magma only inside thin cracks; tall hexagonal basalt columns like the columnar basalt cliffs of the canyons of southern Brazil; steaming geysers with terraced crust; a tiny science field station with a giant thermometer. Photogenic and playful, never scary: no fire, no flames, no explosions, no dark smoke, no lava lakes.
```

### 6.2 Imagem #1 — SILHUETAS (21:9, chroma verde)

```
A wide panoramic strip, aspect ratio 21:9: the NEAR BACKGROUND layer of a parallax background, seen exactly from the side.
A gentle, softly rolling hill of dark volcanic ground dusted with snow crosses the whole image from the left edge to the right edge: deep dark violet (#2A2638) with a thin icy frost (#DDEBFA) along its top edge. The top of the hill sits between 50% and 56% of the image height measured from the top, and the hill fills everything below it down to the bottom edge.
Standing on top of the hill, spaced out with clear gaps between them, all at the same distance from the camera and all seen straight from the side:
- five groups of tall hexagonal basalt columns, each group with four to six straight columns of different heights standing side by side, dark basalt (#1E1C26) with flat tops (#3A3646), a cap of icy snow on about half of the flat tops and a pale icy rim of moonlight on their left edges;
- two small geysers: a low mound of terraced sandy crust (#A8946E and #D8C9A3) with a tall column of steam above it;
- one tiny square science field station: a little cabin with a thin antenna, a spinning cup anemometer on a pole, one glowing window, and planted beside it a giant thermometer taller than the cabin (a white tube #F7FBFF, a round red bulb #C7301C at the bottom, the liquid inside red in the lower half and icy blue #9FE3FF in the upper half);
- one steel kettle (#B8C4DA) sitting on top of a small glowing magma crack in the ground, with a little steam coming out of its spout.
The tallest column reaches up to about 30% of the image height from the top. Every object stands firmly on the hill.
There is only ONE row of objects. Nothing stands behind them: no second row, no faded or transparent copies, no distant scenery, no reflections.
Smoke and steam are small, fully opaque, puffy cartoon balls like cotton (#CFC8E3), never transparent or wispy.
Glowing parts (magma, window) glow only inside their own shapes: no light halo, no bloom and no glow spilling onto the green.
This layer sits behind the gameplay: slightly softer contrast than a hero object, but crisp clean silhouette edges.
It must repeat sideways: at the left edge and at the right edge there is only bare hill, at exactly the same height, and no object is closer than 6% of the image width to either edge.
Everything above the hill and around the objects is one single flat solid pure green #00FF00, completely empty: no sky, no clouds, no haze, no gradient, no glow and no shadow on the green. The green stays perfectly flat and pure.
```

### 6.3 Imagem #2 — MONTANHAS MÉDIAS (16:9, chroma verde)

```
A wide strip, aspect ratio 16:9: the MIDDLE layer of a parallax background, seen exactly from the side.
One continuous range of dark volcanic mountains (#2B2E45), built from big flat angular facets like a low-poly sculpture with slightly softened edges; the facets facing LEFT catch the moonlight and are lighter (#3E4366). The peaks sit between 28% and 45% of the image height measured from the top, with uneven heights, and the mountains fill everything below them down to the bottom edge.
Each peak wears a thick cap of pale blue glacier ice and snow (#A9BCE0) running down the slope in two or three rounded tongues, never symmetric.
Four thin glowing orange magma cracks (#FF6A1F with a yellow core #FFD23F) run down from four of the ridges, thin as threads, glowing only inside their own lines.
This range is in the middle distance: lower contrast than the near layer.
It must repeat sideways: the left edge and the right edge both cut through the same low valley at exactly the same height.
Everything above the mountains is one single flat solid pure green #00FF00, completely empty: no sky, no clouds, no haze, no gradient, no glow. The green stays perfectly flat and pure.
```

### 6.4 Imagem #3 — FUNDO: céu do crepúsculo + o vulcão (16:9, opaca)

```
A wide image, aspect ratio 16:9, that fills the whole frame: the FAR BACKGROUND layer of a parallax background, seen exactly from the side.
Sky: a smooth vertical gradient from deep twilight blue (#1F2A55) at the top to dusty violet (#7A5A8A) at the horizon. About twelve tiny faint round stars, only in the top third. No sun disc and no moon in the sky.
Far away, a long, low and wide mountain range in dark blue-violet (#3A3F66), the faces turned to the LEFT lit lighter (#50578A), with soft caps of pale icy snow (#BCCBE8). The tops sit between 34% and 46% of the image height measured from the top.
Exactly in the middle of the image, between 42% and 62% of the image width, rises ONE volcano: a broad cone with a flat top, its left side lit, snow on its shoulders but never in the crater. Its crater rim is at about 22% of the image height from the top and glows orange (#FF6A1F) with a bright yellow-orange edge (#FFB23F), with a soft warm orange glow in the sky just above the crater. Three thin glowing lava rivers zigzag gently down the cone. A soft plume of pale steam (#8C86A8) rises from the crater and drifts to the RIGHT.
Strong atmospheric haze: everything far away is soft and low in contrast, melting into a violet haze toward the bottom of the image. Icy blue dominates the image; the orange is only on the volcano.
It must repeat sideways: the left edge and the right edge both cut through the same low valley at exactly the same height, and the volcano and its plume stay far from both edges.
```

### 6.5 Imagem #4 — FOLHA DE OBJETOS (4:3, chroma verde)

```
Game object sprite sheet, landscape image, aspect ratio 4:3.
Exactly 12 separate objects in an invisible grid of 4 columns and 3 rows, one object centered in each cell. Each object is only about 70% of the height of its row and 75% of the width of its column, with an empty band of plain background at least 8% of the image height between rows and along every edge. No object touches another object or the image border. Nothing is cut off. No captions, no labels and no names under the objects.
Every object is seen straight from the side, like in a side-scrolling game, and rests on the same invisible baseline at the bottom of its row. Twilight light: cool icy moonlight from the upper LEFT and a thin warm orange rim from BELOW RIGHT. The objects are clearly lit and readable, not dark.
These objects are shown very small in the game: chunky, simple, bold shapes with saturated colors and a few big readable details, no tiny clutter.
Glowing parts glow only inside their own shapes: no light halo and no glow on the background. Steam, where asked, is fully opaque puffy cartoon balls like cotton.
Background: one single flat solid pure green #00FF00 filling the whole image. No ground, no snow surface, no ground line, no ground shadow, no contact shadow, no gradient.
Row 1: (1) one short hexagonal basalt column standing upright, turned just a little so a narrow lit LEFT face (#4A4658), a wide front face (#2E2A38) and a flat hexagonal top (#5C5870) with a cap of icy snow are visible, one thin glowing magma crack on the front face, (2) a lumpy round volcanic bomb rock (#2E2A38) with three thin glowing orange cracks and a melting cap of snow on top with two drips, (3) a fallen hexagonal basalt column lying perfectly horizontal, much longer than tall, its hexagonal end on the LEFT lit by the moon, thin joints across it at even intervals, snow along its top, (4) three tall hexagonal basalt columns standing together, of different heights, a small opaque puff of white steam on top of the tallest, taller than wide.
Row 2: (1) a friendly snowman made of only two snowballs sitting inside a round aluminum washtub (#B8C4DA) full of warm water, a pink towel (#FF5C8A) wrapped around its head like after a bath, eyes closed in happy relief, carrot nose pointing RIGHT, no steam, (2) a chunky icy blue crystal gem (#9FE3FF) shaped like a rounded hexagon, with a white shine on its upper left and a small warm orange reflection on its lower right, a collectible toy-like object, (3) one long flat stone bridge lying perfectly horizontal, about ten times longer than it is thick, made of four rectangular gray-violet stone slabs (#6A6680, the top third lighter #8A86A0) joined end to end with thin dark joints (#2E2A38), a thin white frost line (#DDEBFA) along its whole top edge, (4) a steel kettle (#B8C4DA) with a curved spout pointing RIGHT and a handle on top, a little opaque puff of steam at the spout.
Row 3: (1) a puff of geyser steam made of four or five fully opaque round cartoon puffs (#CFC8E3) stacked in a short column, (2) a full moon, pale icy blue-white (#DDEBFA), with gentle soft craters, no face, (3) a giant thermometer standing upright: a white tube (#F7FBFF), a round red bulb (#C7301C) at the bottom, the liquid inside red in the lower half and icy blue (#9FE3FF) in the upper half, no numbers, (4) a decorative arch made of two hexagonal basalt columns joined at the top by a flat basalt slab with a cap of snow.
```

### 6.6 Imagem #5 — FAIXA DA MANTA: neve-gelo (21:9, chroma verde em cima)

```
A wide panoramic image, aspect ratio 21:9: a straight side cross-section of a thick slab of icy snow over glacier ice, like a slice of cake seen exactly from the side, used as a repeating ground texture in a side-scrolling game.
The top 70% of the image is one single flat solid pure green #00FF00, completely empty: no faded copy of the slab, no reflection, no haze band. The green stays perfectly flat and pure.
The slab fills only the lower 30% of the image, from edge to edge. From top to bottom: a layer of firm icy snow (#DDEBFA) with a soft rounded top edge catching pale moonlight from the upper LEFT and a cool blue shade underneath (about one third of the slab height); a band of clear blue glacier ice (#A9C3E6) with a few tiny trapped air bubbles; then cold blue ice (#7FA0C8) down to the bottom edge. No magma, no cracks and no orange anywhere in this slab: the landing surface is always ice.
The top edge of the snow is one straight horizontal line across the whole width, with only tiny soft bumps. All bands are perfectly horizontal and parallel and run past the left and right edges.
It must repeat sideways: the left edge and the right edge are identical in height and color.
No objects, no ground shadow, no sky.
```

### 6.7 Imagem #6 — FOLHA DE TEXTURAS (1:1, opaca)

```
A square image, aspect ratio 1:1, divided into 4 equal square texture swatches in a 2 by 2 grid, each swatch completely filled edge to edge with one flat, evenly lit material seen straight on, with no objects, no horizon, no perspective and no shadows from outside. No gaps, borders or lines between the swatches.
Top left: cold blue glacier ice (#7FA0C8) with a very subtle frosted grain and faint pale inner streaks, no cracks.
Top right: terraced geyser crust (#D8C9A3) like travertine: small even rounded terrace ledges with darker edges (#A8946E), all the same size.
Bottom left: a wall of basalt columns seen from the side: even vertical columns of dark basalt (#2E2A38) separated by thin darker joints (#1E1C26), all the same width, with subtle horizontal cracks across them, no magma.
Bottom right: firm icy snow (#DDEBFA) with a very subtle soft grain.
Each swatch is even and uniform from edge to edge, with no strong single highlight, so it can repeat as a tiling texture.
```

### 6.8 Objeto → arquivo → tipo (Vulcão)

R1C1 `obj-prisma-basalto` (`pedra` v0; também o **pilar da ponte**, desenhado com altura explícita) · R1C2
`obj-bomba-vulcanica` (`pedra` v1) · R1C3 `obj-coluna-tombada` (`tronco`) · R1C4 `obj-fumarola` (`pinheiro`) · R2C1
`obj-boneco-escalda-pes` (`boneco-de-neve`) · R2C2 `obj-cristal-gelo` (`floco`) · R2C3 `obj-ponte-basalto` (trilho;
**o meio repete laje a laje, não estica**, senão as juntas deformam) · R2C4 `obj-chaleira` (`bandeira`) · R3C1
`obj-baforada` (adereço da SUBIDA; reaproveitável como vapor de gêiser e fumarola) · R3C2 `obj-lua` (lua fixa, camada
1b) · R3C3 `obj-termometro` (`placa`) · R3C4 `obj-portico-basalto` (`portico`).

Texturas: `tex-corpo` (TL) · `tex-crosta` (TR, SUBIDA) · `tex-basalto` (BL, QUEDA) · `tex-neve` (BR). As **rachaduras de
magma** do corpo e da parede continuam por código (ficha §3.2-5 e §3.3): é o código que garante que nenhuma encosta na
manta (L2) e que a pista não passa de ~15% de brilho. Textura repetida com rachadura também mostraria o padrão.

**Curadoria específica:** basalto sem aro sumindo na colina (1,05, o caso mais crítico das 4 pistas: o contorno duplo
pré-assado é obrigatório); laranja dominando qualquer imagem (a pista vira "inferno" e perde o "pé-gelado"); magma na
manta ou no topo de qualquer chão; vapor translúcido nas imagens com chroma (R3); vulcão perto da borda do `fundo`.

---

## 7. CUME DA VENTANIA (`cume-da-ventania`, tema `cume`) — casa do Quequé e do Tio Beto

O final. Topo do mundo de madrugada, acima de um mar de nuvens, aurora no céu, o minuano soprando da esquerda para a
direita: tudo inclinado para a direita. Épico e cômico. Paleta da ficha §4.1.

**A camada 1b (mar de nuvens, fator 0,06) entra no `fundo` (0,04).** A ficha tem 4 camadas de fundo; o método tem 3
imagens de fundo. Nuvem é névoa: pela A1 do piloto ela não pode ir para chroma. Juntá-la ao céu custa 0,02 de diferença
de parallax entre nuvem e serra, que ninguém vê; separar custaria 6 créditos que não existem.

**Correção da ficha §4.3 (rocha de gelo):** a ficha manda o capuz de neve "deslocado para a esquerda (o vento empurrou)",
mas o vento sopra da esquerda para a direita e a mesma ficha põe as cornijas e o cachecol para a direita. Neve
empurrada pelo vento acumula a sotavento: **direita**. Os prompts abaixo usam direita.

### 7.1 BLOCO S da pista

```
Wind-sculpted snow, clear blue glacier ice, dark blue rock, weathered wood and rope. Pre-dawn NIGHT high above the clouds: a bright full moon from the upper LEFT is the key light and leaves a crisp pale-blue rim on the left and top edges of every shape; a soft mint-green and violet glow from an aurora is the fill. Soft colored shadows that are deep blue, never gray and never black. Epic, crisp and cold, yet playful.
World theme: the windy summit at the top of the world, above a sea of clouds, under a green aurora. A strong cold wind blows from LEFT to RIGHT and bends everything to the RIGHT: wind socks stretched flat, twisted pine trees leaning right, snow cornices curling over to the right. A stopped cable car, a rope bridge over an ice crevasse, a small stone-and-wood mountain hut. Epic and funny at the same time. No famous real mountain.
```

### 7.2 Imagem #1 — SILHUETAS (21:9, chroma verde)

```
A wide panoramic strip, aspect ratio 21:9: the NEAR BACKGROUND layer of a parallax background, seen exactly from the side.
An irregular, angular rocky ridge crosses the whole image from the left edge to the right edge: dark blue rock (#1A2040) with patches of wind-packed snow and a crisp pale moonlit rim (#E8F1FF) along its top edge. The top of the ridge sits between 50% and 56% of the image height measured from the top, and the ridge fills everything below it down to the bottom edge.
Standing on top of the ridge, spaced out with clear gaps between them, all at the same distance from the camera and all seen straight from the side:
- a stopped cable car: two tall narrow lattice steel towers (#3B4C86) far apart, a cable sagging in a gentle curve between their tops, and one small red gondola (#C7301C) with a glowing yellow window (#FFD23F) hanging still in the middle, tilted a little to the right by the wind;
- one small mountain hut of stone and dark wood (#4A2E1B), low, with a thick snowy roof whose snow curls over the right edge, one glowing yellow window, and a chimney whose smoke puffs fly out flat to the RIGHT;
- four twisted pine trees leaning to the RIGHT, their tiers shifted to the right one above the other, snow on every tier;
- one wind sock on a thin pale mast (#B8C4DA), its cone striped orange and white (#FF8A1F and #F7FBFF), stretched perfectly flat and horizontal to the RIGHT;
- one small snowman clinging with both twig arms to a short wooden post, its body leaning to the right in the wind, its red scarf (#C7301C) stretched straight out horizontally to the right, and its black top hat flying away to the right a short distance from its head.
The tallest tower reaches up to about 30% of the image height from the top. Every object stands firmly on the ridge.
There is only ONE row of objects. Nothing stands behind them: no second row, no faded or transparent copies, no distant scenery, no reflections.
Smoke is small, fully opaque, puffy cartoon balls like cotton, never transparent or wispy.
Glowing parts (windows) glow only inside their own shapes: no light halo, no bloom and no glow spilling onto the green.
This layer sits behind the gameplay: slightly softer contrast than a hero object, but crisp clean silhouette edges.
It must repeat sideways: at the left edge and at the right edge there is only bare ridge, at exactly the same height, and no object, cable or smoke is closer than 6% of the image width to either edge.
Everything above the ridge and around the objects is one single flat solid pure green #00FF00, completely empty: no sky, no clouds, no haze, no aurora, no gradient, no glow and no shadow on the green. The green stays perfectly flat and pure.
```

### 7.3 Imagem #2 — MONTANHAS MÉDIAS (16:9, chroma verde)

```
A wide strip, aspect ratio 16:9: the MIDDLE layer of a parallax background, seen exactly from the side.
One continuous range of sharp, jagged mountain crests in deep night blue (#27325E), built from many big flat angular facets like a low-poly sculpture with slightly softened edges, serrated with many small spikes along the crests; the facets facing LEFT catch the moonlight and are lighter (#3A4A82). The peaks sit between 28% and 45% of the image height measured from the top, with uneven heights, and the mountains fill everything below them down to the bottom edge.
Each peak wears a cap of wind-packed snow (#B7C7EC). On three of the crests the snow overhangs to the RIGHT as a cornice: a thick wave of snow that curls over the crest and hangs down on its right side.
This range is in the middle distance: lower contrast than the near layer.
It must repeat sideways: the left edge and the right edge both cut through the same low valley at exactly the same height.
Everything above the mountains is one single flat solid pure green #00FF00, completely empty: no sky, no clouds, no aurora, no haze, no gradient, no glow. The green stays perfectly flat and pure.
```

### 7.4 Imagem #3 — FUNDO: céu com aurora + serra abaixo + mar de nuvens (16:9, opaca)

```
A wide image, aspect ratio 16:9, that fills the whole frame: the FAR BACKGROUND layer of a parallax background, seen exactly from the side, from the top of a mountain, above the clouds.
Sky: a smooth vertical gradient from deep navy (#0C1230) at the top to night blue (#2C3E7A) at the horizon. About forty tiny calm round stars (#E8F1FF), only in the top quarter. No sun disc and no moon in the sky.
Aurora: two soft wavy ribbons of light cross the whole width from the left edge to the right edge, each one bright at its lower edge and fading to transparent upward: a wider mint-green ribbon (#5CF2C2) lower, a thinner violet ribbon (#8A6CFF) above it. The aurora stays between 25% and 48% of the image height measured from the top, and both ribbons cross the left and right edges at the same height.
Far away and BELOW eye level, a range of sharp, low mountain peaks in blue (#3B4C86), the faces turned to the LEFT lit lighter (#5468A6), with long caps of snow (#C9D8F5). The tips of the peaks sit between 42% and 54% of the image height measured from the top.
In front of them, a sea of clouds covers the base of the mountains from about 58% of the image height down to the bottom edge: big soft rolling cloud tops (#7F8FC4) over a darker cloud body (#5D6FA8), each roll lit by the moon on its upper LEFT edge (#A3B2DE).
Strong atmospheric haze on the mountains: soft and low in contrast.
It must repeat sideways: the left edge and the right edge are identical: the same valley between peaks at the same height, the cloud sea at the same height, the aurora ribbons at the same height.
```

### 7.5 Imagem #4 — FOLHA DE OBJETOS (4:3, chroma verde)

```
Game object sprite sheet, landscape image, aspect ratio 4:3.
Exactly 12 separate objects in an invisible grid of 4 columns and 3 rows, one object centered in each cell. Each object is only about 70% of the height of its row and 75% of the width of its column, with an empty band of plain background at least 8% of the image height between rows and along every edge. No object touches another object or the image border. Nothing is cut off. No captions, no labels and no names under the objects.
Every object is seen straight from the side, like in a side-scrolling game, and rests on the same invisible baseline at the bottom of its row. Night light: crisp pale-blue moonlight from the upper LEFT and a soft mint fill. The objects are clearly lit and readable, not dark. Where there is wind, it blows to the RIGHT.
These objects are shown very small in the game: chunky, simple, bold shapes with saturated colors and a few big readable details, no tiny clutter.
Background: one single flat solid pure green #00FF00 filling the whole image. No ground, no snow surface, no ground line, no ground shadow, no contact shadow, no gradient.
Row 1: (1) an angular faceted ice rock made of three big facets, light blue on the left (#B7D3FF), medium blue in the middle (#7E9BD8), dark blue on the right (#4E6BB0), with a cap of snow swept toward its RIGHT side, wider than tall, (2) a big cube-shaped block of clear ice, its front face light icy blue (#9FE3FF), its right side darker (#5FB8E6), its top lighter, two diagonal white reflection streaks (#F7FBFF) on the front, (3) a fallen slab of wind-packed snow lying perfectly horizontal, much longer than tall, pale blue (#BFD0EE), its LEFT end shaped like a curling half wave, (4) a twisted pine tree leaning to the RIGHT, its three tiers shifted to the right one above the other, snow on every tier, taller than wide.
Row 2: (1) a friendly snowman made of three snowballs, its body leaning a little to the right, a long red scarf (#C7301C) with a fringe stretched straight out horizontally to the right, one twig arm holding its black top hat firmly on its head, coal eyes and a determined smile, carrot nose pointing RIGHT, (2) a chunky six-pointed snowflake crystal, pale icy white-blue (#E8F1FF) with a soft mint reflection (#5CF2C2) on its lower edge and a white shine on its upper left, a collectible toy-like object, (3) one long straight braided rope (#C9A46A) lying perfectly horizontal, about ten times longer than it is thick, with short diagonal braid marks (#8A6A3A) along its whole length, (4) one short wooden post (#4A2E1B) standing perfectly vertical, with a rope lashed around its top in an X and a small cap of snow, about four times taller than wide.
Row 3: (1) one tall narrow lattice steel tower (#3B4C86) for a cable car, a tapering frame with X braces and a small wheel at the top, about four times taller than wide, (2) a small wind sock on a thin pale mast (#B8C4DA), its cone striped orange and white (#FF8A1F and #F7FBFF) stretched perfectly flat and horizontal to the RIGHT, (3) a full moon, pale blue-white (#E8F1FF), with gentle soft craters, no face, (4) a diamond-shaped yellow warning sign (#FFD23F) on a short post, with only three curved wind lines drawn on it, no letters.
```

### 7.6 Imagem #5 — FAIXA DA MANTA: neve de vento + gelo (21:9, chroma verde em cima)

```
A wide panoramic image, aspect ratio 21:9: a straight side cross-section of a thick slab of wind-packed snow over glacier ice, like a slice of cake seen exactly from the side, used as a repeating ground texture in a side-scrolling game.
The top 70% of the image is one single flat solid pure green #00FF00, completely empty: no faded copy of the slab, no reflection, no haze band. The green stays perfectly flat and pure.
The slab fills only the lower 30% of the image, from edge to edge. From top to bottom: a layer of wind-packed snow (#E8F1FF) with a crisp top edge catching pale moonlight from the upper LEFT, small wind-carved ripples on its surface, and a cool blue shade underneath (about one third of the slab height); a band of blue glacier ice (#8FA3D8) with a few faceted crystals catching the light; then deep cold blue ice (#5D6FA8) down to the bottom edge.
The top edge of the snow is one straight horizontal line across the whole width, with only tiny soft bumps. All bands are perfectly horizontal and parallel and run past the left and right edges.
It must repeat sideways: the left edge and the right edge are identical in height and color.
No objects, no ground shadow, no sky.
```

### 7.7 Imagem #6 — FOLHA DE TEXTURAS (1:1, opaca)

```
A square image, aspect ratio 1:1, divided into 4 equal square texture swatches in a 2 by 2 grid, each swatch completely filled edge to edge with one flat, evenly lit material seen straight on, with no objects, no horizon, no perspective and no shadows from outside. No gaps, borders or lines between the swatches.
Top left: deep blue glacier ice (#5D6FA8) with small faceted lighter crystals (#8FA3D8 and #B7C7EC) scattered evenly inside.
Top right: wind-packed snow (#E8F1FF) with soft wavy wind-carved ripples in pale blue shade (#BFD0EE), evenly spaced.
Bottom left: layered crevasse ice: even horizontal strata of deep blue ice from dark (#2C3E7A) to medium (#5D6FA8), with thin lighter lines (#8FA3D8) between the layers.
Bottom right: fresh snow in moonlight (#E8F1FF) with a very subtle soft grain.
Each swatch is even and uniform from edge to edge, with no strong single highlight, so it can repeat as a tiling texture.
```

### 7.8 Objeto → arquivo → tipo (Cume)

R1C1 `obj-rocha-gelo` (`pedra` v0) · R1C2 `obj-bloco-gelo` (`pedra` v1) · R1C3 `obj-laje-cornija` (`tronco`) · R1C4
`obj-pinheiro-torto` (`pinheiro`) · R2C1 `obj-boneco-cachecol` (`boneco-de-neve`) · R2C2 `obj-cristal-floco` (`floco`) ·
R2C3 `obj-corda` (trilho de altura < 1 m: fio de grind; o meio repete, não estica, senão a trança deforma) · R2C4
`obj-poste-corda` (pés da corda, a cada ≤ 5 m) · R3C1 `obj-torre-trelica` (pontas do trilho ≥ 1 m; o **cabo** de aço é
linha por código: 3 px `#B8C4DA` + fio `#F7FBFF`, como na ficha) · R3C2 `obj-biruta` (adereço da SUBIDA e `bandeira`) ·
R3C3 `obj-lua` (lua fixa, camada 1b) · R3C4 `obj-placa-vento` (`placa`). **Pórtico de gelo** (`portico`) = montado por
código: 2 × `obj-bloco-gelo` + `obj-laje-cornija` por cima (não coube célula). **Gôndola decorativa** do trecho
`teleferico`: não coube; fica a da silhueta (pendência).

Texturas: `tex-corpo` (TL) · `tex-cornija` (TR, SUBIDA) · `tex-fenda` (BL, QUEDA) · `tex-neve` (BR). Os **pingentes**
na borda da fenda e os **estilhaços** de gelo no corpo continuam por código (ficha §4.2-6 e §4.3).

**Curadoria específica:** Quequé e Beto na montagem do portão (macacão **2,38**, bermuda **1,71** sobre a colina
`#1A2040`): se a silhueta não ler, **clarear a colina por curva de níveis no pós** (grátis), não regerar e não pôr halo
(§0.6); aurora acima de 25% da altura (briga com o HUD); qualquer coisa inclinada para a ESQUERDA (o vento é um só);
bandeira de oração ou símbolo religioso (L5).

---

## 8. Pós-processamento (delta sobre o §5 do piloto)

Base: copiar `arte-fonte/ferramentas-curadoria/cenario-pico-do-picole.py` para um `cenario-<pista>.py` por pista (ou
parametrizar pista, chave e nomes). Fonte em `arte-fonte/cenarios/<pista>/` (`-v1`, `-v2`, nunca sobrescreve); saída em
`public/assets/cenarios/<pista>/` (webp). Tamanhos e emenda: **iguais ao piloto** (tabela do §5).

1. **Chave e despill por pista:** Morro = `MAGENTA = [255, 0, 255]` + despill magenta da §1.1; as outras = o do piloto.
2. **`corte_topo_frac` só se aparecer fantasma, e medido em cada imagem**, nunca copiado do Picolé (0,31 era daquela
   imagem). Se o fantasma ficar **entre** os objetos (o corte não resolve), é reprovação, não ajuste.
3. **Manta:** recortar do topo da neve até o fim da **segunda** faixa + 10% (Morro: neve batida; Vila: telha; Vulcão:
   gelo de geleira; Cume: gelo de geleira), altura 128 px.
4. **Folha de objetos:** fatiar 4 × 3 e ficar só com o maior componente conexo, como no piloto. **Exceções** (têm partes
   soltas de propósito, o maior componente perderia o resto): `obj-baforada` (puffs podem não se tocar), `obj-varal`
   (lâmpadas penduradas), `obj-chaleira` (vapor). Nelas: manter todos os componentes com área ≥ 2% da célula.
5. **`obj-lua`:** sem contorno, sem sombra de contato; altura final pela ficha (raio 16 lógicos na Vila, 14 no Vulcão,
   18 no Cume).
6. **Cume, colina escura:** se o portão reprovar a leitura do Quequé/Beto, levantar os tons escuros das `silhuetas` por
   curva (pretos de `#1A2040` para ~`#2A3366`, ficha §4) só nos pixels de alfa 255. Grátis.

Memória por tema: igual ao Picolé (~30 MB, um tema por vez).

## 9. Composição (delta para a Lyra sobre o §6 do piloto)

Um pintor raster por tema (`bosqueRaster`, `vilaRaster`, `vulcaoRaster`, `cumeRaster`), mesmo `PintorTema`, mesmo
carregamento antes de montar, fallback para o vetorial de cada tema. O que muda:

- **Camada 1b nas noturnas:** depois do `fundo`, por código e em posição fixa: brilho do poente (Vila, radial da ficha
  §2.1) e/ou a **lua** (`obj-lua` + halo radial pré-desenhado da ficha: Vila 16% × 13%, Vulcão 16% × 12% com halo 60,
  Cume 14% × 11% com halo 70). No Cume, a pulsação opcional da aurora (`globalAlpha` 0,85 a 1, ciclo de 6 s) passa a
  valer para o `fundo` inteiro: testar se incomoda; se incomodar, desligar.
- **Contorno duplo pré-assado (L1 nas noturnas), no boot, sem custo por quadro:** cópias do sprite pintadas por
  `source-in` na ordem: aro claro deslocado (−2, 0), (0, −2), (−2, −2) → escuro `#0B1630` nas 8 direções a raio 1 →
  sprite. Aro claro: Vila `#FFD9A0`, Vulcão `#BFD0EA`, Cume `#E8F1FF`. **Vulcão** soma o aro quente `#FF6A1F` em (+2, 0),
  (0, +2), (+2, +2), desenhado junto com o claro. Boneco: contorno claro simples da ficha. Decor, lua, adereços: sem
  contorno. Morro: contorno simples `#1B2733` como o Picolé; boneco `#BDD5EA`.
- **Brilhos por sprite radial pré-desenhado** (as fichas já definem): lanterna, janela da parede enxaimel e do corpo
  (Vila), magma sob a ponte e nas rachaduras (Vulcão), janela do refúgio não (é decor de silhueta, sem halo).
- **Trilhos com padrão** (varal, ponte, corda): o meio é **repetido** em ladrilho ao longo do trecho, não esticado
  (difere do palito, cujo veio aguenta esticar). Fio claro L3 e contorno escuro embaixo por código, como no piloto.
- **Feições:** textura da SUBIDA e da QUEDA por `createPattern` ancorado no mundo, como o waffle e a calda. No Morro,
  só se o dono aprovar (§4).

A Lyra prova com a skill `medir-antes-de-afirmar`, nos mesmos pontos do piloto §6, mais: lua parada em 3 posições de
câmera; contorno duplo visível a 100% no WebKit sobre a colina escura.

## 10. Curadoria comum (soma à §7 do piloto)

- Fantasma (fileira esmaecida, faixa-eco) em qualquer imagem com chroma: medir se o corte resolve; se não, reprova.
- Halo, bloom ou fumaça translúcida sobre a chave: reprova a imagem se o despill deixar borda cinza visível a 100%.
- Lua, sol ou estrela-cruz pintados no `fundo`: corrigir com o prompt de edição abaixo (gasta reserva).
- Paleta do Picolé (pastel, rosa, granulado) vazando na #1 de uma noturna: plano B da R5 (mestra da casa).
- Escada de contraste (A11) nas noturnas: o `fundo` é o mais apagado; a colina das silhuetas é escura, mas a manta é
  o mais claro da tela; os obstáculos são os únicos com contorno.

Prompts de correção: os do piloto §3.10 valem, trocando `#00FF00`/"green" por `#FF00FF`/"magenta" no Morro. Dois novos:

| Defeito | Prompt |
|---|---|
| Fileira fantasma no chroma | `Edit this image: remove the faded, transparent copies of the objects in the background area. That area must be one flat solid pure <green #00FF00 / magenta #FF00FF>. Do not change the hill or the front row of objects.` |
| Lua, sol ou estrela grande no céu do `fundo` | `Edit this image: remove the moon (or sun) from the sky and fill its place with the same smooth sky gradient around it. Keep everything else exactly the same.` |
