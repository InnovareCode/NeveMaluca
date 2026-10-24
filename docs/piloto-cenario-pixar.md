# NEVE MALUCA — piloto do cenário em raster "Pixar" (Pico do Picolé)

Apolo, 2026-10-23. Projeto, não geração: quem gera é o Atlas, com os prompts daqui. Escopo: **só o Pico do Picolé**
(tema `parque`). Se o dono aprovar o piloto, o mesmo método vale para as outras 4 pistas e depois para a UI.

**O problema.** Os personagens são render 3D (sprite raster, BLOCO A da §4.5 da direção de arte); o cenário de hoje é
vetor chapado desenhado em Canvas (`src/render/temas/parque.ts`). O piloto troca **a pele** por imagem gerada e mantém
**a forma e a física** em código: a pista continua procedural, o hash não muda, `PintorTema` continua o contrato.

**O que NÃO muda:** geometria do terreno, objetos, trilhos, colisão, `DefTema`, ordem de desenho, fatores de parallax,
regras L1 a L5 de `docs/temas-pistas-m3.md` §0.2 e luz do alto à esquerda (§0.1-1). O pintor vetorial `parque.ts`
**fica** como fallback (asset não carregou) e como comparação lado a lado no portão.

---

## 1. Decisões de abordagem (e por quê)

| # | Decisão | Por quê |
|---|---|---|
| A1 | **Céu + montanhas distantes numa imagem só, opaca** (sem chroma). | Montanha distante é névoa; névoa recortada por chroma deixa franja verde. Junta com o céu e o problema some. |
| A2 | **Médias e silhuetas: imagem com fundo chroma, recortada.** | São as camadas com borda nítida contra o céu: recortam bem. |
| A3 | **Chroma: verde puro `#00FF00` em tudo do Picolé.** | Conta (distância RGB euclidiana, a mesma de `alfa_chave` em `arte-fonte/ferramentas-curadoria/comum.py`; opaco a partir de 118): a menor distância da paleta ao verde é **167** (granulado verde `#3DDC97`); ao magenta seria **149** (granulado rosa) e **152** (morango forte), num tema cheio de rosa. Verde tem margem maior. Aritmética sobre os hex da ficha, não sobre a imagem gerada: a curadoria confere. |
| A4 | **Silhuetas em 21:9** (tile de 1260 px lógicos em vez de 960). | É a camada mais rápida (0,22) e a que mais denuncia repetição. Custa o mesmo crédito. Se o gerador não oferecer 21:9, cai para 16:9 e tile de 960 (como hoje). |
| A5 | **Terreno = faixa raster colada na superfície por cisalhamento**, não textura solta nem imagem da rampa. | A rampa é procedural: nenhuma imagem pronta casa com ela. A faixa (manta de baunilha + napolitano) é horizontalmente emendável e é desenhada em colunas de 1 amostra (0,5 m), cada coluna cisalhada na vertical para o topo seguir o segmento. As listras ficam paralelas à superfície de graça. É a técnica clássica de terreno 2D com pele (Tiny Wings, Alto). |
| A6 | **Corpo do terreno, waffle da rampa e calda da queda = textura (`createPattern`) ancorada no mundo.** | Preenchem polígonos que já existem (corpo, faixa da SUBIDA, cunha da QUEDA, §0.4). Ancorada no mundo = a textura não "escorrega" com a câmera. |
| A7 | **Contorno L1 é aplicado por código, uma vez, no boot** (não pedido ao gerador). | O gerador desenha contorno torto ou nenhum. Contorno é física (L1): tem de ser exato. Pré-bake: desenha o sprite 8 vezes deslocado (raio 1 px lógico), pinta com `source-in` na cor do contorno, desenha o sprite por cima. Zero custo por quadro, sem `filter`/`shadowBlur` (§0.1-5). |
| A8 | **Sem chão nem sombra nas imagens de objeto; sombra de contato por código** (elipse radial rosada pré-desenhada, `drawImage`). | Mesma regra dos personagens (§4.4-12). A sombra rosada é o que "assenta" o objeto raster na neve. |
| A9 | **Emenda horizontal: primeiro de graça, depois com crédito.** | (1) O prompt manda as duas bordas terminarem no mesmo elemento vazio, na mesma altura. (2) Script: mistura cruzada dos últimos 6% sobre os primeiros 6% (o tile encolhe 6%). (3) Só se ainda aparecer costura: imagem deslocada 50% (a costura vai para o meio) + edição "repair the seam" (reserva). |
| A10 | **Primeira imagem anexa a mestra da Bia como referência de estilo; as seguintes anexam a primeira aprovada.** | Uma imagem anexada por pedido (§4.4-1). A mestra é o que garante "mesmo render dos personagens"; depois, o cenário aprovado ancora o resto. Risco: a Bia aparecer na cena (eco). Se aparecer, refazer sem anexo (reserva R4). |
| A11 | **Profundidade por névoa, não por desfoque.** Distante: baixo contraste, puxado para o horizonte. Médias: médio. Silhuetas: cor plena mas um pouco mais suave que o jogo. Personagem e obstáculo: os mais saturados e os únicos com contorno. | O raster é mais rico que o vetor; sem a escada de contraste, o fundo compete com a Bia (a jaqueta `#FFD23F` já dá **1,03** contra o céu claro, ficha §1). |

---

## 2. Lista de imagens e créditos (Nano Banana a 2K = 6 créditos por imagem; saldo grátis: 206)

| # | Imagem | Formato | Recorte | Emenda | Anexo | Créd. | Acum. |
|---|---|---|---|---|---|---|---|
| **1** | **Silhuetas**: colina rosa + casquinhas, picolés, carrinho, bandeirolas, boneco-gag | 21:9 2K | chroma verde | horizontal | mestra da Bia | 6 | 6 |
| **2** | **Montanhas médias**: facetadas menta, cobertura de baunilha, granulado | 16:9 2K | chroma verde | horizontal | #1 aprovada | 6 | 12 |
| **3** | **Fundo**: céu + cúpulas de sorvete distantes, com névoa | 16:9 2K | opaca | horizontal | #1 | 6 | 18 |
| — | **PORTÃO 1 do dono** (montagem gratuita por script, §4) | — | — | — | — | 0 | 18 |
| **4** | **Folha de objetos** (12 células) | 4:3 2K | chroma verde | — | #1 | 6 | 24 |
| **5** | **Faixa da manta** (corte lateral: baunilha + napolitano) | 21:9 2K | chroma verde em cima | horizontal | #1 | 6 | 30 |
| **6** | **Folha de texturas** 2 × 2 (sorbet, waffle, calda, neve) | 1:1 2K | opaca | por espelho (script) | #1 | 6 | **36 (plano)** |
| — | **PORTÃO 2 do dono** (no jogo, Lyra integrada) | — | — | — | — | 0 | 36 |
| R1 | Reparo de costura (deslocada 50%) de #1 | 21:9 | | | a própria | 6 | 42 |
| R2 | Reparo de costura de #2 ou #5 | | | | | 6 | 48 |
| R3 | Reparo de costura de #3 ou #5 | | | | | 6 | 54 |
| R4 | Refazer uma imagem reprovada (ex.: a Bia apareceu em #1) | | | | | 6 | 60 |
| R5 | Refazer outra imagem reprovada | | | | | 6 | 66 |
| R6 | Correção pontual da folha de objetos (uma célula/defeito) | | | | | 6 | **72 (teto)** |

- **Plano: 6 imagens, 36 créditos. Teto: 12 imagens, 72 créditos.** Sobram de **134 a 170** dos 206.
- Depois de 2 falhas na mesma imagem: aceitar e ajustar no jogo (lição do BAATAR, §4.13).
- Conferir o saldo antes de cada imagem; parar antes de passar do teto e avisar o dono.
- **Conta do rollout (para o dono saber já):** cada uma das outras 4 pistas custa as mesmas 6 imagens (sem a reserva
  de estilo, que o Picolé já resolve) = **24 imagens, 144 créditos**. Cabe se o piloto gastar até **62** (206 − 144).
  Se o piloto bater no teto (72), faltam 10 créditos para as pistas e **não sobra nada para a UI**. Ver Pendências.

Resolução de saída esperada (conferir na primeira imagem, varia por gerador): 21:9 ≈ 3168 × 1344; 16:9 ≈ 2752 × 1536;
4:3 = 2400 × 1792 (medido na mestra da Bia); 1:1 ≈ 2048 × 2048. Tudo acima do buffer de 1920 × 1080 do jogo.

---

## 3. Prompts (cole na ordem: BLOCO S, linha em branco, REF se houver anexo, linha em branco, o bloco da imagem, linha em branco, BLOCO P)

### 3.1 BLOCO S — estilo do cenário (início de toda imagem)

```
Stylized 3D animated family-movie environment art for a comic side-scrolling snowboarding video game, matching the look of the game's characters: appealing cartoon shapes, soft rounded forms, smooth high-quality CG render, soft creamy ice cream materials with gentle subsurface glow, soft warm key light from the upper LEFT and a soft cool fill light, gentle ambient occlusion, soft colored shadows that are pink, never gray. Bright saturated midday colors.
World theme: a snowy mountain that turned into a giant dessert: vanilla snow, strawberry and mint ice cream, crunchy waffle cones, popsicles on wooden sticks, colorful sprinkles. A cheerful ice cream park for kids.
CAMERA: a straight side view like a side-scrolling game, flat orthographic look, level horizon, no perspective vanishing point, no tilt, everything seen exactly from the side.
```

### 3.2 REF — quando houver imagem anexada

Imagem #1 (anexo: `arte-fonte/personagens/bia/modelo/mestra-v1.png`):
```
Use the attached image ONLY as a reference for rendering style, material quality and lighting. Do NOT include the character from the attached image, do not copy its pose, its colors or its magenta background. No people and no characters in this image.
```
Imagens #2 a #6 (anexo: a #1 aprovada, a original 21:9, antes do recorte):
```
Use the attached image ONLY as a reference for rendering style, materials, palette and lighting: this new image must look like it belongs to the same game world. Do NOT copy its composition or its objects unless they are described below.
```

### 3.3 BLOCO P — proibições (fim de toda imagem)

```
Absolutely NO text, letters, numbers, logos, brand names, labels, signs with words, flags of countries, captions, grid lines, borders or frames. NO people, NO characters, NO animals, NO snowboarders. NO visual effects: no falling snowflakes, no sparkles, no glitter particles, no lens flare, no sun disc, no light rays, no motion blur, no depth-of-field blur, no vignette.
```

### 3.4 Imagem #1 — SILHUETAS (21:9, chroma verde)

```
A wide panoramic strip, aspect ratio 21:9: the NEAR BACKGROUND layer of a parallax background, seen exactly from the side.
A gentle, softly rolling hill of pale strawberry-pink snow (#EFC3D3) crosses the whole image from the left edge to the right edge. The top of the hill sits between 50% and 56% of the image height measured from the top, and the hill fills everything below it down to the bottom edge. Colorful sprinkles (pink, yellow, sky blue, mint green, orange) are scattered sparsely on the hill.
Standing on top of the hill, spaced out with clear empty gaps between them, all at the same distance from the camera and all seen straight from the side:
- four giant crunchy waffle ice cream cones (#E9C27A with a diagonal waffle grid #C9973F) stuck point-down into the snow, each topped with one big round scoop: strawberry pink, mint, vanilla, strawberry pink; one drip of melted cream running down each cone;
- five giant popsicles stuck upright into the snow by their short wooden sticks, rounded rectangle shapes in strawberry pink, mint and vanilla, each with one round bite missing from the top right corner and a soft light edge on the left side;
- one small ice cream cart with two wheels, a mint-green box and a pink-and-white striped parasol;
- one string of colorful triangular party bunting hanging in a gentle curve between the tops of two neighboring cones;
- one small friendly snowman made of three snowballs, holding a strawberry popsicle against its mouth with a twig arm, eyes squeezed shut from brain freeze.
The tallest object reaches up to about 30% of the image height from the top. Every object stands firmly on the hill.
This layer sits behind the gameplay: slightly softer contrast than a hero object, with a very light warm atmospheric haze on the objects, but crisp clean silhouette edges.
It must repeat sideways: at the left edge and at the right edge there is only bare hill, at exactly the same height, and no object is closer than 6% of the image width to either edge.
Everything above the hill and around the objects is one single flat solid pure green #00FF00: no sky, no clouds, no sun, no gradient, no haze and no shadow on the green. The green stays perfectly flat and pure.
```

### 3.5 Imagem #2 — MONTANHAS MÉDIAS (16:9, chroma verde)

```
A wide strip, aspect ratio 16:9: the MIDDLE layer of a parallax background, seen exactly from the side.
One continuous range of mountains made of mint ice cream (#B9E8D6), built from big flat angular facets like a low-poly sculpture with slightly softened edges; the facets facing LEFT are lit lighter (#D4F4E7). The peaks sit between 28% and 45% of the image height measured from the top, with uneven heights, and the mountains fill everything below them down to the bottom edge.
Each peak wears a thick cap of vanilla cream frosting (#FFF4F8) with two or three rounded drips hanging down the slope, never symmetric, and a few colorful sprinkles on the frosting (pink, yellow, sky blue, mint green, orange).
Atmospheric perspective: this range is in the middle distance, so its colors are lighter and lower in contrast, with a soft bluish haze toward the bottom.
It must repeat sideways: the left edge and the right edge both cut through the same low valley at exactly the same height.
Everything above the mountains is one single flat solid pure green #00FF00: no sky, no clouds, no sun, no gradient. The green stays perfectly flat and pure.
```

### 3.6 Imagem #3 — FUNDO: céu + cúpulas distantes (16:9, opaca)

```
A wide image, aspect ratio 16:9, that fills the whole frame: the FAR BACKGROUND layer of a parallax background, seen exactly from the side.
Sky: a smooth vertical gradient from clear saturated blue (#5BB8FF) at the top to pale icy blue (#D9F1FF) at the horizon. Three small soft whipped-cream clouds in the upper half, simple and rounded.
Far away, a range of distant mountains shaped like giant round scoops of ice cream: smooth rounded domes, not pointy, in pale strawberry pink (#F2C6D8) with the left half of each dome lit lighter (#FBE0EA). Each dome wears a cap of vanilla cream with irregular rounded drips. The tops of the domes sit between 14% and 32% of the image height measured from the top, and the domes fill everything below them down to the bottom edge.
Strong atmospheric haze: the domes are very soft and low in contrast, melting into a pale pinkish-blue haze toward the bottom of the image.
It must repeat sideways: the left edge and the right edge both cut through the same valley between two domes at exactly the same height, and the clouds stay away from both edges.
```

### 3.7 Imagem #4 — FOLHA DE OBJETOS (4:3, chroma verde)

```
Game object sprite sheet, landscape image, aspect ratio 4:3.
Exactly 12 separate objects in an invisible grid of 4 columns and 3 rows, one object centered in each cell. Each object is only about 70% of the height of its row and 75% of the width of its column, with an empty band of plain background at least 8% of the image height between rows and along every edge. No object touches another object or the image border. Nothing is cut off. No captions, no labels and no names under the objects.
Every object is seen straight from the side, like in a side-scrolling game, and rests on the same invisible baseline at the bottom of its row.
These objects are shown very small in the game: chunky, simple, bold shapes with saturated colors and a few big readable details, no tiny clutter.
Background: one single flat solid pure green #00FF00 filling the whole image. No ground, no snow surface, no ground line, no ground shadow, no contact shadow, no gradient.
Row 1: (1) a big strawberry popsicle (#E8457A) lying on its side on the ground, tilted slightly, a round bite missing from its right end, its wooden stick (#E9C27A) sticking out to the left, a soft light band along its top, (2) a big scoop of mint ice cream (#7FE0C4) fallen on the ground, squashed flat at the bottom with three melting drips at its base and a few sprinkles on top, (3) a big scoop of chocolate ice cream (#8A5236) fallen on the ground, squashed flat at the bottom with three melting drips at its base and a few sprinkles on top, (4) a giant waffle cone (#C98A3A with a darker waffle grid #8F5E22) lying on its side, its point to the RIGHT, its open end on the LEFT with a vanilla scoop half spilling out.
Row 2: (1) a giant strawberry popsicle standing upright, stuck into the ground by its wooden stick, a round bite missing from its top right corner, taller than wide, (2) a friendly snowman made of three scoops of ice cream stacked up: vanilla at the bottom, strawberry in the middle, mint on top, a red cherry with a little stem on its head instead of a hat, chocolate-chip eyes, a small waffle-cone nose pointing RIGHT, no arms, (3) a glossy mint-green candy gem shaped like a drop, with a white shine on its upper left, a collectible toy-like object, (4) a small ice cream cart seen from the side, a mint-green box on two wheels with a pink-and-white striped parasol on top.
Row 3: (1) a pennant flag on a thin wooden pole: a triangle pointing RIGHT with three stripes, mint, pink, mint, (2) the same pennant flag on a thin wooden pole, all mint green, (3) one long flat wooden popsicle stick lying perfectly horizontal, rounded at both ends, light wood with two faint grain lines along its length, about ten times longer than it is thick, (4) a decorative arch made of two giant waffle cones standing upside down, points up, joined at the top by a thick band of dripping strawberry syrup.
```

### 3.8 Imagem #5 — FAIXA DA MANTA (21:9, chroma verde em cima)

```
A wide panoramic image, aspect ratio 21:9: a straight side cross-section of a layered ice cream snow slab, like a slice of cake seen exactly from the side, used as a repeating ground texture in a side-scrolling game.
The top 70% of the image is one single flat solid pure green #00FF00, perfectly flat and pure.
The slab fills only the lower 30% of the image, from edge to edge. From top to bottom: a fluffy layer of vanilla-white snow (#FFF4F8) with a soft rounded top edge catching warm sunlight from the upper LEFT and a gentle pink shade underneath (about one third of the slab height); a thin band of pale pink cream (#F2D3E0); a band of strawberry ice cream (#F4B3CB); a band of pale pink cream; a band of mint ice cream (#A8E4CF); then pale pink cream (#F2D3E0) down to the bottom edge.
The top edge of the snow is one straight horizontal line across the whole width, with only tiny soft bumps. All bands are perfectly horizontal and parallel and run past the left and right edges.
It must repeat sideways: the left edge and the right edge are identical in height and color.
A few tiny colorful sprinkles resting on the snow top only. No objects, no ground shadow, no sky.
```

### 3.9 Imagem #6 — FOLHA DE TEXTURAS (1:1, opaca)

```
A square image, aspect ratio 1:1, divided into 4 equal square texture swatches in a 2 by 2 grid, each swatch completely filled edge to edge with one flat, evenly lit material seen straight on, with no objects, no horizon, no perspective and no shadows from outside. No gaps, borders or lines between the swatches.
Top left: smooth pale strawberry sorbet (#F2D3E0) with a very subtle creamy grain and a few tiny frozen fruit flecks.
Top right: crunchy waffle cone surface (#E9C27A) with an even diagonal diamond grid of raised ridges (#C9973F), all diamonds the same size.
Bottom left: glossy frozen chocolate syrup (#6B3A2A) with soft smooth ripples and a few lighter highlights (#A0644A).
Bottom right: fresh vanilla-white snow (#FFF4F8) with a very subtle soft powdery grain.
Each swatch is even and uniform from edge to edge, with no strong single highlight, so it can repeat as a tiling texture.
```

### 3.10 Correções (anexar a imagem com defeito; um defeito por vez, §4.11)

| Defeito | Prompt |
|---|---|
| Costura visível (imagem já deslocada 50% pelo script, a costura no meio) | `Edit this image: there is a visible vertical seam exactly in the horizontal center. Blend and repair the area around the center so the landscape is continuous and natural. Do not change anything within 15% of the left and right edges.` |
| Céu, nuvem ou névoa sobre o verde | `Edit this image: everything that is not hill, mountain or object must be one flat solid pure green #00FF00. Remove the sky, clouds, haze and gradient from the green area. Do not change the hill, mountains or objects.` |
| Personagem da referência apareceu | não editar: refazer sem anexo (reserva R4) |
| Chão ou sombra sob os objetos | `Edit this image: remove all ground, snow surface, ground lines and shadows under the objects. Fill those areas with flat pure green #00FF00. Do not change the objects.` |
| Texto, letreiro ou bandeira | `Edit this image: remove all text, letters, numbers, labels and flags. Keep everything else exactly the same.` |
| Perspectiva (vista de cima ou de três quartos) | `Generate again seen exactly from the side, straight orthographic side view, level horizon, like a side-scrolling game.` |
| Virou 2D chapado ou foto | `Keep exactly the same stylized 3D animated family-movie CG look as the attached reference image. Not flat 2D vector, not a photo.` |

---

## 4. Portão 1 do dono (grátis, antes de gastar o lote 2)

Depois das imagens #1 a #3, o Atlas monta **por script** (Python/PIL, sem crédito) uma prévia 1920 × 1080:
fundo → brilho do sol → médias → silhuetas → uma faixa de neve simples descendo da esquerda para a direita → o
recorte `bia-ride0.png` (`public/assets/personagens/bia/recortes/`) em escala de jogo (1,85 m × 40 px/m = **74 px
lógicos = 148 px** no buffer), com o `contato` na superfície. Mostrar ao dono **lado a lado com o screenshot atual do
Picolé vetorial**. A pergunta do portão é uma só: "a Bia parece estar DENTRO deste mundo?".

---

## 5. Pós-processamento (script; o Atlas ou a Vega roda, antes da Lyra integrar)

Fonte em `arte-fonte/cenarios/pico-do-picole/` (fora do git, `-v1`, `-v2`, nunca sobrescreve, §4.14). Saída em
`public/assets/cenarios/pico-do-picole/` (webp).

1. **Recorte por chroma** com `alfa_chave` (tol 48, suav 70) e **despill**: nos pixels de alfa < 255, limitar o canal
   G a `max(R, B)` (tira a franja verde da borda rosa). Sem despill, a borda do sorvete fica esverdeada.
2. **Emenda** (A9): mistura cruzada linear de 6% da largura nas pontas; conferir na imagem deslocada 50%.
3. **Escala para o buffer** (1 px lógico = 2 px do buffer):

| Arquivo | Origem | Tamanho final | Alfa | Uso |
|---|---|---|---|---|
| `fundo.webp` | #3 | 1920 × 1080 | não | tile 960 × 540 lógicos |
| `medias.webp` | #2 | 1920 × 1080 | sim | tile 960 × 540 |
| `silhuetas.webp` | #1 | 2520 × 1080 (ou 1920 × 1080 se 16:9) | sim | tile 1260 × 540 |
| `manta.webp` | #5 | faixa recortada do topo da neve até o fim da faixa menta + 10%, altura **128 px** (64 lógicos), largura proporcional | sim | faixa do terreno |
| `tex-sorbet/waffle/calda/neve.webp` | #6 | cada quadrante 512 × 512, **espelhado 2 × 2 e reduzido de volta a 512** (emenda garantida) | não | `createPattern` |
| `obj-<nome>.webp` | #4 | cada célula recortada à caixa do alfa, altura máxima 256 px | sim | sprites |

Nomes dos objetos (célula → arquivo → tipo): R1C1 `obj-picole-caido` (`pedra` v0) · R1C2 `obj-bola-menta` (`pedra` v1)
· R1C3 `obj-bola-chocolate` (alternativa de `pedra` v1; o dono escolhe uma no portão 2) · R1C4 `obj-casquinha-tombada`
(`tronco`) · R2C1 `obj-picole-fincado` (`pinheiro`) · R2C2 `obj-boneco-sorvete` (`boneco-de-neve`) · R2C3 `obj-gota-menta`
(`floco`) · R2C4 `obj-carrinho` (decor) · R3C1 `obj-bandeirola-listrada` (adereço da SUBIDA) · R3C2 `obj-bandeirola-menta`
(2ª rampa do `kicker-duplo`) · R3C3 `obj-palito` (trilho, 3 fatias) · R3C4 `obj-portico` (decor).

Memória: 2 × 8,3 MB (fundo, médias) + 10,9 MB (silhuetas) + < 2 MB do resto ≈ **30 MB**, um tema por vez (B.3).
Hoje são ~6 MB. Medir no iPhone no portão 2; se pesar, o `fundo` desce para 1280 × 720 (é névoa, aguenta).

---

## 6. Plano de composição (para a Lyra)

Um pintor novo `parqueRaster` implementa o mesmo `PintorTema` (`src/render/temas/tipos.ts`). As imagens são
carregadas e decodificadas **antes** de montar o tema (na tela de seleção de pista, que já existe), porque
`construirCamadas` é síncrono. Se qualquer asset falhar, monta o `parque.ts` vetorial (fallback e comparação).

| Ordem | Camada | Fonte | Fator | Como desenha |
|---|---|---|---|---|
| 0 | céu de reserva | código (gradiente atual) | — | só enquanto o `fundo` não existe |
| 1 | **fundo** (céu + cúpulas) | `fundo.webp` | 0,04 | tile opaco, `y` fixo 0 a 540 |
| 1b | brilho do sol | código (radial atual, 24% × 8%) | fixo | **depois** do fundo, para não ser coberto |
| 2 | **médias** | `medias.webp` | 0,10 | tile com alfa |
| 3 | **silhuetas** | `silhuetas.webp` | 0,22 | tile com alfa, largura 1260 |
| 3b | flocos de profundidade | código atual | — | sem mudança |
| 4a | **corpo do terreno** | `tex-sorbet` | 1 | polígono atual do corpo, `fill` com `createPattern`; `pattern.setTransform` com translação = −(câmera em px) para ancorar no mundo |
| 4b | **manta + napolitano** | `manta.webp` | 1 | faixa cisalhada (abaixo) sobre a superfície |
| 4c | SUBIDA | `tex-waffle` + `obj-bandeirola-*` | 1 | faixa da subida (altura 2 E, §0.4) preenchida com o padrão waffle; bandeirola na borda `x1` |
| 4d | QUEDA | `tex-calda` | 1 | cunha da §0.4 preenchida com o padrão calda; a manta não é desenhada na face (fica o fio de 2 px) |
| 4e | fio da superfície | código | 1 | traço claro `#FFE6EF` 1,5 px por cima, limpa o serrilhado da borda raster |
| 5a | sombra de contato | sprite radial rosado (pré-desenhado no boot) | 1 | elipse sob cada objeto, largura = largura do objeto |
| 5b | **objetos** | `obj-*.webp` pré-contornados (A7) | 1 | base no `(xTela, yTela)`; escala pela largura/altura do `ObjetoPista`, mantendo a proporção do sprite (ajuste pela altura) |
| 5c | **trilho** | `obj-palito` em 3 fatias + pé | 1 | abaixo |
| 6 | piloto | sem mudança | | |
| 7 | partículas `confeito` | sem mudança | | |

**Parallax com tile de largura ≠ 960.** Hoje o deslocamento é `% largura` e desenha 2 cópias. Com tile de largura `L`:
`desloc = ((cameraXm × fator × 8) % L + L) % L` e desenhar `ceil(960 / L) + 1` cópias a partir de `−desloc`. A conta
do fator (`× 8`) não muda.

**Faixa cisalhada (4b), por quadro:** para cada par de pontos consecutivos da `superficie` (já vem pronta do
`terreno.ts`), com `w = x1 − x0` e `s = (y1 − y0) / w`: `ctx.setTransform` com cisalhamento vertical `s` e origem em
`(x0, y0)` (compondo com a transformação do buffer que já estiver ativa), e `drawImage` de uma coluna da faixa com
largura de origem correspondente a `w`, altura destino = `64 × (escala / PX_POR_METRO)` px lógicos. A coluna de origem
sai da posição **no mundo** (`xm × pxPorMetro`, módulo a largura da faixa), para a textura não escorregar. Sobrepor
0,5 px entre colunas (senão aparece fresta antisserrilhada). ~60 `drawImage` por quadro com zoom 0,8. Nas faces muito
íngremes a faixa afina por `cos(ângulo)`; nas QUEDAS ela nem é desenhada (§0.4), então o caso ruim não aparece.

**Trilho (5c):** o palito é cortado em 3 fatias: ponta esquerda e ponta direita (largura = espessura do palito) e o
meio. O meio **pode ser esticado** na horizontal (o veio corre ao longo do palito, esticar não deforma). Ao longo do
trilho, amostrar o terreno como hoje (`desenharTrilhoPalito`) e desenhar o meio em segmentos girados pelo ângulo de cada
trecho; pés = o próprio palito girado 90° e encurtado, a cada ≤ 4 m. Mantém a regra L3: fio claro `#FFFFFF` alfa 0,8
de 2 px no topo e contorno escuro embaixo, por código, por cima do sprite. Espessura atual (9 px lógicos) não muda: é
o que o jogador já lê como "dá para grindar".

**Contorno (A7):** `pedra`, `tronco`, `pinheiro` e o palito: `#1B2733`, 1 px lógico (2 px no buffer). Boneco de
sorvete: claro `#FFE6EF`. Gota, carrinho, bandeirolas, pórtico: sem contorno. Decor segue a §0.5: escala ≤ 0,8 e base
afundada 30% na manta; a "mistura de 25% com o horizonte" vira pré-bake (`source-atop` com `#D9F1FF` alfa 0,25 no boot).

**O que a Lyra prova (skill `medir-antes-de-afirmar`):** screenshot no Chromium e no WebKit em 3 posições de câmera
(início, meio com rampa, vão de calda); emenda dos 3 tiles sem costura no ponto de repetição (screenshot exatamente no
`desloc = 0`); faixa da manta sem fresta entre colunas a 200% de zoom; `drawImage` por quadro e tempo de quadro contra
o `parque.ts` vetorial; memória do tema medida.

---

## 7. Curadoria (o que eu reprovo)

- Perspectiva que não é lateral (casquinha vista de cima, colina com ponto de fuga): reprova, refaz.
- Fundo mais saturado ou mais contrastado que a camada da frente: quebra a escada da A11.
- Obstáculo que não lê a 1 m do celular **mesmo com o contorno**: sobe saturação no pós, não regera.
- Bia sumindo no céu: o primeiro ponto do portão 1 (jaqueta × céu claro, ficha §1).
- Objetos da silhueta grandes demais: se passarem de 30% do alto da tela, competem com o personagem; recortar a
  camada mais para baixo antes de regerar.
- Franja verde em qualquer borda: despill não rodou.
