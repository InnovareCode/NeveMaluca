# Curadoria da CAPI BARBOSA, folha 2 (manobras), v1

Apolo, 2026-10-22. Fonte: `arte-fonte/personagens/capi/folhas/capi-f2-manobras-v1.png` (2400x1792, fundo verde),
gerada pelo Atlas. Critérios: `docs/direcao-arte-neve-maluca.md` §4.1, §4.3, §4.4, §4.8 e §4.12. Régua: o
relatório da F1 (`docs/relatorio-curadoria-capi-f1.md`), com `fatorFolha` da F1 = 1,0. Os originais não foram
alterados.

**Veredito da folha: APROVADA para o M2, com 1 célula reprovada (`grabUp`) e 1 reprovada com conserto por código
(`leanBack`).** Desta vez não há nenhum texto na imagem. As 12 figuras saem limpas por componente conexo, e o trilho
desenhado pela IA sai por cor e geometria sem cortar a Capi. Contagem: **6 APROVADAS, 4 LIMITE, 2 REPROVADAS**.
`grabUp` é o `grabBack` girado 25° (mesma mão na mesma ponta da prancha), então "cima" e "trás" ficariam iguais no
jogo. `leanBack` não inclina para trás: é o mesmo defeito do `wobble` da F1. Uma folha de reposição de 6 células junta
estas duas com os 4 LIMITE da F1 (6 créditos, §6).

Tudo foi medido em pixel por script (numpy + Pillow). Os scripts estão em `arte-fonte/ferramentas-curadoria/`
(`f2_passo1`, `f2_passo2`, `f2_passo4`, `f2_passo5`, `f2_passo6`; recebem a pasta de trabalho como argumento, e o
caminho da F2 fica em `comum.py`, constante `FOLHA_F2`). Coordenadas em px da folha, salvo indicação contrária.
Ângulo da prancha: positivo = bico (ponta da direita) para cima.

---

## 1. Componentes, texto, espaço e o trilho

| Medida | Valor | Leitura |
|---|---|---|
| Fundo (mediana da faixa da borda) | RGB (7, 247, 3), desvio de 6 a 9 | Chapado. A última linha e a última coluna têm ruído de até 49 de distância: corto 2 px, menos na borda esquerda (ali está o trilho). |
| Chave | distância ao fundo, tolerância 48 + rampa 70, alfa ≥ 64 | A mesma da F1 |
| Componentes conexos (8-vizinhos) | **12, nenhum pequeno** | **Zero letras, zero rótulos.** Também não há linha de chão, neve, sombra, spray nem estrela. |
| Figuras | área de 98.855 a 130.116 px (a maior é `rail` com o trilho) | |
| Margem até a borda | topo ≥ 50 (`grabFront`), base 69 (linha 3), direita ≥ 66 (`leanFwd`); esquerda 73 na figura do `rail`, mas **o trilho encosta na borda (coluna 0)** | Nenhuma figura cortada. O único objeto cortado é o trilho. |
| Folga entre fileiras (mesma coluna) | mínima de 52 px (`grabFront` → `scared`) e 48 px (trilho do `rail` → `ride1`) | Menor que os 8% pedidos, como na F1. O recorte é por componente, então não atrapalha. |
| Folga entre colunas | **12 px** (ponta do trilho → mão do `star`) e **20 px** (`scared` → `sig`) | Apertado, mas separa. Sem o trilho, `rail` → `star` = 80 px. |
| Tamanho | `ride1` = 507 px = 85% da fileira; `star` e `scared` = 541 px = 91% | O Runway infla de novo (pedido: 70%). Nada encosta. |

### 1.1 O trilho (célula L2 C1)

A IA desenhou um trilho de metal sob a prancha. Ele é um único componente conexo junto com a Capi. Separei por cor e
geometria (`f2_passo2.py`):

1. **Prancha**: máscara por matiz (31-58°, S ≥ 0,5, V ≥ 0,5), maior componente dilatado 3 px: x 85-561, base em y 1089.
2. **Metal**: tudo o que é azulado ou neutro (B ≥ R − 15) abaixo do topo da prancha e fora dela, mais tudo o que fica
   fora da largura da prancha a partir de y 1070, mais tudo abaixo da base da prancha.
3. **Sombra da prancha no trilho**: escura e não azulada, por isso escapava do passo 2. Por coluna, tiro da figura o
   que fica 2 px abaixo da última linha com cor de prancha (834 px).

**Resultado: a figura da Capi saiu inteira.** Caixa x 73-577, y 625-1088. As duas mãos, as duas botas, o chapéu e as
duas pontas da prancha estão dentro da caixa e longe da borda. A prancha tem o rocker (as pontas curvam para cima) e
fica nivelada: base a 0,01° com resíduo de 1,8 px. Nada fica abaixo da base. Conferi com zoom de 3× sobre neve
clara: sem franja cinza e sem a sombra do trilho. A base da prancha, onde ela encostava no metal, fica com borda dura
de 1 px (não há verde para desmisturar ali), o que não aparece na escala do jogo.

**O trilho: descartar como sprite e guardar como referência de objeto.**
- Ele está cortado na borda esquerda (31 px na coluna 0). A ponta direita (x 645) é uma tampa arredondada inteira.
- Barra: tubo de **29 px de diâmetro** (y 1077-1107), com 3 postes de 24-25 px de largura em x 79-103, 308-331 e
  536-560 (**passo de 229 px**, uns 46% do comprimento da prancha). Na escala da folha (= F1), o diâmetro do tubo é
  0,76 da espessura da prancha (38 px).
- Cor do metal, de cima para baixo: `#8291A8` (topo azulado), brilho `#B6B0AF`, meio `#7A8C9F`, sombra `#444549`,
  base `#41333F`. Postes `#6D7276` a `#777C80`.
- Uso: a Lyra desenha o trilho do jogo por código com essas proporções e essa paleta, para combinar com o acabamento
  da Capi. Como sprite ele não serve: está cortado, a perspectiva é fixa e o trilho do jogo tem comprimento variável.

## 2. Escala (régua contra a F1)

| Régua | F2 | F1 | F2 / F1 |
|---|---|---|---|
| Prancha nos quadros de chão da linha 3 (`ride1`, `tuck1`, `leanBack`, `leanFwd`) | **499 px** nos 4 (498 a 499) | 497 | 1,004 |
| Aba do chapéu (largura horizontal, mediana das 12) | **204 px** | 200 | 1,02 |

**`fatorFolha` da F2 = 497 / 499 = 0,996**, dentro de ±1%. Para o jogo: **1,0, sem normalizar.** O chapéu confirma
(+2%, dentro da faixa de ±3,5% da F1).

Exceções, todas medidas:
- **`sig`**: chapéu de **233 px (+14%)** com prancha de 471 px (−5%). A cabeça está de frente e maior: a Capi ficou
  uns 20% maior em relação à prancha. Escala não conserta isso, porque é proporção e não tamanho. Com 0,95 o chapéu
  fica +6% e a prancha −10%, e o desvio total continua igual. Por isso deixo a escala em 1,0 (§5).
- **`rail`**: prancha de 476 px (−4,4%) com chapéu de 209 px (+2,5%). A prancha foi desenhada um pouco mais curta e
  com as pontas mais curvas. Para o `contato` não faz diferença. Fica na tolerância de uma pose de chão.
- Quadros no ar: prancha de 403 (`grabDown`) a 475 px (`grabFront`). É escorço (a prancha aponta para a câmera), não
  mudança de escala. O chapéu nesses quadros fica entre 202 e 204, igual à F1.
- `scared`: aba de 190 px na horizontal, mas o chapéu está inclinado. Medido no eixo da aba, dá 212, normal.

## 3. Medidas por célula

Máscara da prancha: nos quadros de chão, a mesma da F1. No ar, a sola fica na sombra (matiz 26-33°, V ~0,5), então
relaxei para matiz 26-60°, S ≥ 0,65, V ≥ 0,42, e fiquei com o maior componente dilatado 3 px. O pelo do rosto também
cai nessa faixa, mas forma outro componente. Conferi a máscara a olho na sobreposição. "Inclinação" = x médio dos 30%
de cima do corpo menos o x do `contato` (positivo = corpo para a direita, à frente). Na F1: `ride0` +14, `tuck0` +70,
`wobble` +30.

| Célula | Quadro | Caixa w×h | h / `ride1` | h / `ride0` F1 | Prancha | Chapéu | Inclinação | Razão w/h |
|---|---|---|---|---|---|---|---|---|
| L1 C1 | `grabUp` | 465×507 | 1,00 | 1,06 | **−58,3°** (bico para baixo, quase de pé) | 202 | no ar | 0,92 |
| L1 C2 | `grabDown` | 385×461 | 0,91 | 0,96 | **+18,8°** | 202 | no ar | 0,84 |
| L1 C3 | `grabFront` | 494×526 | 1,04 | 1,10 | **+28,6°** | 203 | no ar | 0,94 |
| L1 C4 | `grabBack` | 481×513 | 1,01 | 1,07 | **−30,8°** | 204 | no ar | 0,94 |
| L2 C1 | `rail` (sem o trilho) | 505×464 | 0,92 | 0,97 | **0,01°** na base (resíduo 1,8 px) | 209 | +9 | 1,09 |
| L2 C2 | `star` | 557×541 | 1,07 | 1,13 | +33,2° | 204 | no ar | 1,03 |
| L2 C3 | `scared` | 577×541 | 1,07 | 1,13 | +28,8° | 190 (eixo 212) | no ar | 1,07 |
| L2 C4 | `sig` | 472×458 | 0,90 | 0,96 | 0,0° (no ar, nivelada) | **233** | no ar | 1,03 |
| L3 C1 | `ride1` | 499×507 | 1,00 | 1,06 | **−0,01°** | 210 | +18 | 0,98 |
| L3 C2 | `tuck1` | 500×421 | **0,83** | 0,88 | **0,01°** | 216 | +69 | 1,19 |
| L3 C3 | `leanBack` | 554×493 | 0,97 | 1,03 | **−0,04°** | 200 | **+52** | 1,12 |
| L3 C4 | `leanFwd` | 500×455 | 0,90 | 0,95 | **−0,04°** | 214 | +69 | 1,10 |

Nos 5 quadros de chão, a base fica reta (resíduo de 1,3 a 2,2 px) e nada passa abaixo dela (0 px). A base da linha 3
é comum: y 1722 nos 4.

### 3.1 Grabs: a mão, o lado e se segura de verdade

Convenção que a IA usou nesta folha: a cuia está na mão do lado direito da imagem (a mão da frente) em 6 células. O
CHARACTER chama essa mão de "farther from the viewer". Então, para o modelo, **"farther" = mão da frente (direita da
imagem) e "nearest" = mão de trás (esquerda)**. A luva foi medida dentro de uma caixa marcada a olho, separando
pixels escuros que não são da prancha. "Fronteira" = pixels da luva a até 2 px da prancha.

| Quadro | Pedido | Mão que agarra | Onde | Fronteira luva-prancha | Segura de verdade? | Rosto |
|---|---|---|---|---|---|---|
| `grabUp` | mão **de longe** segura a borda atrás; prancha alta atrás das costas; corpo arqueado | **a de perto** (esquerda). A de longe ficou com a cuia | ponta de cima/esquerda, que é a **cauda**: a 89 px dela (20% do comprimento) | 116 px | **Fraco.** A luva passa **por trás** da prancha e só o punho aparece, sem dedo sobre a borda. A prancha não está atrás das costas, está ao lado do corpo, e o corpo não arqueia. | calmo, olhando à frente |
| `grabDown` | mão de perto segura a borda entre os pés; joelhos encolhidos | **de perto** (esquerda) ✓ | **meio** da prancha, entre as botas (201 e 211 px das pontas) ✓ | 250 px | **Sim.** Os dedos da luva fecham sobre a borda da frente. | feliz, boca aberta ✓ |
| `grabFront` | mão da frente no bico, à direita; perna da frente esticada | **da frente** (direita) ✓ | a **65 px do bico** (14%) ✓ | 182 px | **Sim.** A luva abraça a borda junto do bico. | orgulhoso, olhos semicerrados ✓ |
| `grabBack` | mão de trás na cauda, à esquerda; perna de trás esticada | **de trás** (esquerda) ✓ | a **88 px da cauda** (20%) ✓ | 282 px | **Sim.** A luva fecha sobre a borda junto da cauda. | sorriso malandro, dentes ✓ |

- **Pernas**: em `grabFront` e `grabBack` a IA dobrou a perna do lado da mão e esticou a outra (o pedido era o
  contrário). É o que o corpo faz para alcançar a ponta e lê bem. Não conto como defeito.
- **Cuia**: aparece em `grabUp`, `grabDown`, `grabBack`, `sig`, `tuck1` e `leanFwd`. Some em `grabFront` (a mão de
  trás ficou aberta), `star`, `scared`, `ride1` e `leanBack`, e no `rail`, onde as mãos vazias foram pedidas (regra
  10). É o mesmo limite global da F1 e não tem conserto.
- **Por que o `grabUp` saiu com a mão errada**: o prompt se contradiz. O CHARACTER diz que a mão de longe **sempre**
  segura a cuia, e o `grabUp` pede que a mão de longe segure a prancha. O modelo manteve a cuia e trocou de mão. Fica
  como lição de prompt (§6.3).

### 3.2 Contrato C1 (`contato` e `pivo`) por quadro

Em px **do recorte** (`recortes-v1/capi-<pose>.png`, margem de 8 px), iguais aos de
`recortes-v1/capi-f2-medidas-v1.json`. As definições são as da F1: `contato` = x médio da prancha nas 3 últimas linhas
e y da última linha com ≥ 5 px de prancha; `pivo` = centroide da máscara inteira ponderado pelo alfa, prancha
incluída; raio de giro = metade da diagonal da caixa. **Novo no JSON: `angulo_prancha`** (graus, + = bico para
cima), o ângulo que já vem desenhado na arte (§7).

| Quadro | Tipo (§4.3) | Recorte w×h | `contato` | `pivo` | Raio de giro | `angulo_prancha` |
|---|---|---|---|---|---|---|
| `grabUp` | no ar | 481×523 | — | [244.5, 236.5] | 344 | −58,3 |
| `grabDown` | no ar | 401×477 | — | [181.8, 248.7] | 300 | +18,8 |
| `grabFront` | no ar | 510×542 | — | [259.0, 268.5] | 361 | +28,6 |
| `grabBack` | no ar | 497×529 | — | [255.7, 259.8] | 352 | −30,8 |
| `rail` | prancha no chão (no trilho) | 521×480 | [260.7, 471] | [259.5, 255.7] | 343 | 0,0 |
| `star` | no ar | 573×557 | — | [286.4, 250.9] | 388 | +33,2 |
| `scared` | no ar | 593×557 | — | [284.0, 260.0] | **396** | +28,8 |
| `sig` | no ar | 488×474 | — | [242.5, 282.8] | 329 | 0,0 |
| `ride1` | prancha no chão | 515×523 | [256.5, 514] | [258.9, 285.0] | 356 | 0,0 |
| `tuck1` | prancha no chão | 516×437 | [258.4, 428] | [275.4, 237.3] | 327 | 0,0 |
| `leanBack` | prancha no chão | 570×509 | [265.1, 500] | [290.9, 272.2] | 371 | 0,0 |
| `leanFwd` | prancha no chão | 516×471 | [263.6, 462] | [283.6, 258.6] | 338 | 0,0 |

O `contato` dos 5 quadros de chão cai no centro da prancha (x de 256 a 265 num recorte de ~516 px). No `rail`, o
`contato` é a base da prancha **sem** o trilho: o jogo põe esse ponto sobre o trilho desenhado por código.

## 4. Silhueta, eco e consistência

Área do XOR ÷ área da união (menor = mais parecido). Alinhamento pelo `contato` nos quadros de chão e pelo `pivo` no
ar. **Régua de eco da §4.4 regra 2: `ride0` (F1) × `ride1` (F2) = 0,190.** Agora que o `ride1` existe, ela é medida
de verdade, e não mais por aproximação.

- **Eco da mestra (`difcruz`)**: o corpo sem a prancha contra as vistas de frente e de perfil da mestra, escaladas por
  0,512 × 204/200. O menor valor é `ride1` × frente = 0,273, maior que 0,190. **Nenhuma célula é eco da referência.**
- **`ride1` × `ride0` = 0,190 (IoU 0,81)**: é o segundo quadro certo. Diferente o bastante para não ser duplicata
  (< 0,03), parecido o bastante para um ciclo.
- **Mesma pose girada** (giro de A em volta do `pivo`, buscando o melhor ângulo em ±10° da diferença das pranchas):
  - **`grabUp` girado 24,6° = `grabBack`: 0,157 (IoU 0,84)**, abaixo da régua de eco (0,190). É a mesma pose: a
    mesma mão de trás na mesma cauda, só que mais inclinada. Como o jogo gira o sprite no ar, os dois grabs ficam
    indistinguíveis. **Por isso o `grabUp` é reprovado.**
  - Os outros pares de grab ficam entre 0,316 (`grabDown`×`grabFront`) e 0,402: são distintos.
  - `star` × `scared`: 0,290 sem giro e 0,248 com giro de 5,6°. São distintos, mas próximos (mesmos braços abertos,
    prancha a ~30°). O que separa as duas é o rosto.
- **Pares de chão dentro da F2**: `tuck1` × `leanFwd` = **0,192** (IoU 0,81), praticamente na régua. `rail` × `ride1`
  = 0,263, `rail` × `leanBack` = 0,265, `ride1` × `leanBack` = 0,286.
- **Contra a F1**: `tuck1` × `tuck0` = 0,246, mas o `tuck1` é **11% mais alto** (421 contra 379 px). `leanBack` ×
  `wobble` = 0,325.
- **Personagem**: mesmo rosto, chapéu com cordão, poncho tijolo com listras creme e preta, luvas de dedão, botas e
  prancha mostarda com 2 listras vermelhas nas 12. Nenhum membro a mais. Uma diferença: no `sig` a **cabeça está de
  frente** para a câmera (§4.1 pede virada para a direita). Num quadro de assinatura isso funciona como "pose para a
  foto". Não reprovo.
- **Verde**: no miolo da figura (mais de 4 px da borda), 80 px com excesso de verde > 10. Estão todos no canudo
  prateado do `sig`, que reflete o fundo e fica levemente menta. Só 5 px passam de 20. Não se vê na escala do jogo.

## 5. Veredito por célula, nome final e comando

**Nomes finais dos quadros** (usados nos recortes e no JSON): `grabUp`, `grabDown`, `grabFront`, `grabBack`, `rail`,
`star`, `scared`, `sig`, `ride1`, `tuck1`, `leanBack`, `leanFwd`. Atenção: a §4.2 chama a célula L2 C3 de `panic`, e
o BLOCO C e este relatório chamam de `scared`. **O Atlas precisa escolher um nome só** antes de a Vega fixar o
`IdPose`. Minha sugestão é `scared`, que é o nome dos arquivos.

### 5.1 Mapeamento aos comandos C2 (`ComandoDescida`: `pulo`, `giro`, `grab`, `agachar`)

| Quadro | Quando aparece | Origem |
|---|---|---|
| `grabUp` | no ar, com `grab = 'cima'` ativo | C2 `grab` |
| `grabDown` | no ar, com `grab = 'baixo'` | C2 `grab` |
| `grabFront` | no ar, com `grab = 'frente'` | C2 `grab` |
| `grabBack` | no ar, com `grab = 'tras'` | C2 `grab` |
| `tuck1` | no chão, `agachar` segurado: quadro de **transição** `ride` → `tuck1` → `tuck0` (ver veredito) | C2 `agachar` |
| `rail` | `modo = 'trilho'` (o motor prende no trilho; `pulo` solta) | estado do motor |
| `ride1` | no chão, segundo quadro da descida | estado |
| `leanBack` / `leanFwd` | no chão, pela variação de `anguloTerreno` (§4.1: a Lyra escolhe) | estado |
| `star` | **proposta**: no ar sem nenhum comando por mais de N ticks em salto alto (ar "de estilo") | estado (decisão da Nova) |
| `scared` | **proposta**: no ar, quando o ângulo está fora da `janelaBoa` e o pouso está perto (aviso de tombo) | estado (decisão da Nova) |
| `sig` | **proposta**: `agachar` segurado **no ar**, que hoje não tem uso. No toque, como agachar só entra se o M1a pedir (D10), a alternativa é segurar o mesmo grab por ≥ 1 s | decisão da Nova/dono |

`pulo` e `giro` não têm quadro na F2: usam `jload`/`takeoff` e `flip0` da F1 (e `flip1` da F3). Mortal com grab = o
quadro de grab girando no `pivo`, e é por isso que os grabs também precisam da margem de giro no atlas (§7).

### 5.2 Veredito

| Quadro | Veredito | Causa medida | Conserto mínimo |
|---|---|---|---|
| `grabUp` | **REPROVADA** | Girado 24,6°, é o `grabBack` (XOR 0,157 < régua 0,190): a mesma mão de trás na mesma cauda. A mão é a de perto (o pedido era a de longe, que ficou com a cuia), a luva fica escondida atrás da prancha e não há prancha atrás das costas nem corpo arqueado | **Por código, provisório no M2**: usar como está. A prancha a −58° é a única silhueta "de pé" entre os grabs, e o callout de texto diz "cima". **Refação**: célula 1 da reposição (§6.2), com o grab "cima" redefinido |
| `grabDown` | **APROVADA** | mão de perto entre as botas, dedos sobre a borda, joelhos encolhidos, rosto feliz | — |
| `grabFront` | **APROVADA** | mão da frente a 65 px do bico, segurando de verdade, rosto orgulhoso | — (sem cuia nesta pose) |
| `grabBack` | **APROVADA** | mão de trás a 88 px da cauda, segurando de verdade, sorriso malandro, cuia na outra mão | — |
| `rail` | **APROVADA** | prancha a 0,01°, braços abertos, língua de fora, mãos vazias, figura inteira depois de tirar o trilho | o trilho do jogo é código (§1.1) |
| `star` | **LIMITE** | braços abertos e rosto feliz, mas sem "estrela": as pernas não abrem, porque o BLOCO A manda os dois pés presos e a célula pedia "free leg" (contradição do prompt). Silhueta a 0,29 do `scared` | Nenhum. Funciona como "ar de estilo"; quem nomeia a manobra é o callout. Refação só se o dono quiser a estrela de verdade (não incluí na reposição) |
| `scared` | **APROVADA** | olhos arregalados, boca aberta gritando, braços se debatendo, poncho voando | Vega: quadro de **791 px** de lado no atlas (2 × 395,5), o maior da F2 |
| `sig` | **LIMITE** | cuia **na boca** (o canudo entra nos lábios) ✓, olhos fechados ✓, outra mão na barriga ✓, encolhido e calmo ✓. Mas a cabeça está de frente e **20% maior em relação à prancha** (chapéu 233 contra 204) | Escala 1,0 (escala não corrige proporção, §2). Se o "pulo" de tamanho ao entrar no `sig` incomodar no jogo, a Lyra testa 0,95 no `pivo` e o dono decide |
| `ride1` | **LIMITE** | pose certa e bom segundo quadro (XOR 0,190 contra `ride0`), mas **sem cuia**, enquanto o `ride0` tem cuia: alternando os dois a cada quadro, a cuia pisca | **Código**: não alternar `ride0`/`ride1` em ciclo curto. Usar o `ride1` como variação lenta (um "respiro" a cada 1-2 s) ou como ciclo com bob vertical de 1-2% no `contato` |
| `tuck1` | **LIMITE** | 0,83 da `ride1` (régua ≤ 0,70) e **11% mais alto que o `tuck0`**; silhueta a 0,192 do `leanFwd` | **Código**: não fazer loop `tuck0`/`tuck1` (pularia 11% de altura). Usar `tuck1` só como transição `ride` → `tuck0` (2-4 ticks). Refação: a reposição da F1 já traz um tuck baixo (§6.2) |
| `leanBack` | **REPROVADA** | inclinação **+52** (o corpo vai para a FRENTE; o `ride1` está em +18). O pedido era negativa. Mesmo defeito do `wobble` da F1: a IA não inclina o corpo para trás na vista lateral | **Código, já testado**: cisalhar o quadro em volta do `contato` com fator horizontal **0,20**, o topo indo para a esquerda (canvas: `transform(1, 0, 0.20, 1, -0.20 * contatoY, 0)`, que dá x' = x − 0,20·(contatoY − y) no espaço do recorte). A inclinação medida passa de +52 para **−30**, sem deformação visível do rosto, e a prancha ganha ~8 px de inclinação nas bordas, o que não se nota. **Refação**: célula 2 da reposição |
| `leanFwd` | **APROVADA** | inclinação +69, peso à frente, cuia na mão. O rosto é de olhos semicerrados, não "eager" | — (fica a 0,192 do `tuck1`, mas o defeito é do `tuck1`, que não abaixou) |

Contagem: **6 APROVADAS** (`grabDown`, `grabFront`, `grabBack`, `rail`, `scared`, `leanFwd`), **4 LIMITE** (`star`,
`sig`, `ride1`, `tuck1`), **2 REPROVADAS** (`grabUp`, `leanBack`; esta com conserto por código pronto). O M2 joga
com a folha como está.

## 6. O que regerar, com qual prompt e quanto custa

### 6.1 Obrigatório agora: nada (0 créditos)

O M2 roda com a F2 como está: `grabUp` provisório e `leanBack` cisalhado por código. Texto, linha de chão, neve,
sombra: não há. O trilho sai por código.

### 6.2 Recomendado: uma folha de reposição de 6 células (1 folha 2K = 6 créditos)

A reposição junta as 2 reprovadas da F2 com os 4 LIMITE da F1 (`tuck0`, `jload`, `land`, `wobble`). Anexe **só**
`capi-mestra-v1.png`, paisagem 4:3, 2K. Cole na ordem:

1. O BLOCO A da §4.5, com as **duas primeiras frases da grade** trocadas pelo bloco abaixo. A proibição de texto vai
   aqui, **antes** da lista (a lição da F2).
2. O CHARACTER da CAPI da §4.7.
3. A lista de células.

```
Exactly 6 poses arranged in an invisible grid of 3 columns and 2 rows. Every cell has the same size. Do not write any pose name, caption, number or label under or near the figures: no pose names, no captions, no labels under the figures.
```
```
REPLACEMENT SHEET — TRICKS AND RIDING.
Row 1: (1) grab UP in the air, with a clear gap of plain background under the board: both knees pulled up as high as they go so the snowboard is lifted up level in front of the belly, higher than the hips; the free hand, the one without the gourd cup, holds the middle of the board's near edge with the fingers over the edge; the hand with the gourd cup is raised high above the hat; back straight, excited open-mouth face, (2) leaning back on the baseline, the board perfectly horizontal: the whole body tilted back to the LEFT like a leaning tower, the hat is above the LEFT end of the board, farther LEFT than the back boot; both arms reach forward to the RIGHT for balance; worried face, (3) speed tuck on the baseline, the board perfectly horizontal: crouched very low, knees deeply bent, chest close to the knees, both arms tucked in front, determined face; the top of the hat is only at the middle of the row; the figure is only about 60% as tall as a relaxed standing rider.
Row 2: all three on the baseline, the board perfectly horizontal: (1) ready to jump: knees bent very deep, the figure about 80% as tall as a relaxed rider, both arms swung far back behind the body to the LEFT, focused face, (2) landing: knees bent very deep absorbing the impact, the figure about 80% as tall as a relaxed rider, arms out wide, eyes squeezed, (3) losing balance: the whole upper body tilted far back to the LEFT, the hat farther LEFT than the back boot, arms windmilling, worried face.
```

Critérios de aceite, medidos com os mesmos scripts:
- **`grabUp` novo**: XOR com o `grabBack` e com o `grabDown`, no melhor giro, **> 0,25**; luva com fronteira > 100 px
  na borda da prancha, no meio dela; nada abaixo da prancha além das botas.
- **`leanBack` e `wobble`**: inclinação **negativa** (o x do topo do corpo à esquerda do `contato`); prancha < 1°.
- **tuck**: altura ≤ 0,70 da `ride0`, escalada pela prancha (497 px).
- **`jload` e `land`**: ≤ 0,85 da `ride0`, IoU entre os dois < 0,80.
- **Todas**: `difcruz` contra a mestra > 0,190; prancha de 497 ± 5 px nos quadros de chão; chapéu de 200 ± 7 px.

Regra do lote (a mesma da F1): uma geração; depois de 2 falhas na mesma célula, aceitar o conserto por código. Com o
saldo informado de ~482 créditos, o custo não pesa. O motivo para fazer a reposição numa folha só é o risco de escala
e de rosto a cada folha nova, não o preço.

### 6.3 Lições de prompt (para a F3 e para os outros personagens)

1. **Texto**: funcionou repetir `no pose names, no captions, no labels under the figures` dentro do BLOCO A, antes
   da lista (nota na §4.8).
2. **Mão da cuia**: nunca peça que "the hand farther from the viewer" agarre algo, porque o CHARACTER já prende a cuia
   nessa mão. Diga **"the free hand, the one without the gourd cup"**. Para os outros personagens, vale o mesmo para
   qualquer objeto fixo da ficha (a trena da Bandeira, a bolsa da Cidinha).
3. **Contradição de pés**: o BLOCO A prende os dois pés. Não peça "free leg" (como no `star`). Descreva o que dá para
   abrir com os pés presos: braços e joelhos.
4. **Inclinar para trás falhou 2 vezes** (`wobble` na F1, `leanBack` na F2). "Leaning to the LEFT" não basta.
   Descreva pela geometria que a IA consegue obedecer: "the hat is farther LEFT than the back boot".
5. **Agachar falhou 2 vezes** (`tuck0` 0,79, `tuck1` 0,83). "Same very low tuck" sem número não abaixa. Dê a âncora
   visual: "the top of the hat only at the middle of the row".
6. **Objetos que o jogo desenha** (trilho): se a célula não disser "nothing under the board", a IA desenha o objeto.
   O pedido "balancing on a rail" trouxe o trilho, apesar do "no props". Para o `rail`, escrever "the rail itself is
   NOT drawn, plain background under the board". Desta vez saiu barato, porque o trilho se separa por cor.

## 7. Recortes de teste e notas para a Vega e a Lyra

Pasta `arte-fonte/personagens/capi/recortes-v1/` (ao lado dos da F1):

- `capi-<pose>.png` × 12 (RGBA, margem de 8 px, nomes finais da §5). Mesmo tratamento de borda da F1: desmistura com
  a cor do miolo propagada, piso contra o roxo e despill clássico só em fio fino. Medido: a fração de pixels de borda
  com vazamento verde > 8 caiu de 63-76% para **0%** nos 12, sem nenhum pixel roxo (> 25). Os pixels com alfa 0 têm
  RGB 0, seguro para reamostragem premultiplicada.
- `capi-rail.png` **não tem o trilho**. A sombra da prancha sobre o metal também foi tirada.
- `capi-f2-contato-v1.png`: folha de contato 4×3 em escala de 0,5. Metade sobre xadrez, metade sobre neve clara. Cruz
  vermelha = `contato`, círculo ciano = `pivo`, linha laranja = base.
- `capi-f2-medidas-v1.json`: tipo, tamanho, origem na folha, `contato`, `pivo`, raio de giro, **`angulo_prancha`**,
  halo antes/depois e `fatorFolha` = 0,996.

Para a Vega (pipeline `npm run sprites`):
- Recortar por componente conexo. Na F2 não há letras. A célula do trilho precisa da separação do §1.1 (ou de uma
  regra mais simples: na pose `rail`, descartar todo pixel azulado ou neutro abaixo do topo da prancha). O teste do
  pipeline deve bater com a tabela do §3.2 com tolerância de ±2 px.
- Margem de giro no atlas: os grabs também giram (mortal com grab). Quadrados de 2 × raio: `scared` 791, `star` 776,
  `leanBack` 742 (só se girar), `grabFront` 722, `grabBack` 703, `grabUp` 688 px, na escala da folha e antes do fator
  do atlas.

Para a Lyra:
- `angulo_prancha` dos quadros no ar é o ângulo que já vem desenhado. Ao trocar de `air` (+6,3°, F1) para `grabBack`
  (−30,8°), a prancha "pula" 37° num tick. Se isso incomodar, girar o sprite de grab por (`angulo_prancha` do quadro
  anterior − `angulo_prancha` do grab) e soltar em 3-4 ticks. É uma interpolação de ângulo, não muda a física.
- `leanBack`: cisalhamento de 0,20 do §5.2 até a reposição chegar.
- `ride1` e `tuck1`: não usar em loop de 2 quadros com `ride0`/`tuck0` (§5.2).
