# Curadoria da CAPI BARBOSA, folha 1 (descida), v1

Apolo, 2026-10-22. Fonte: `arte-fonte/personagens/capi/folhas/capi-f1-descida-v1.png` (2400x1792, fundo verde),
aprovada pelo dono junto com a mestra `capi-mestra-v1.png`. Critérios: `docs/direcao-arte-neve-maluca.md` §4.3,
§4.4 e §4.12. Os originais não foram alterados.

**Veredito da folha: APROVADA para o M1, sem nenhuma regeração obrigatória.** As 12 figuras saem limpas por
componente conexo e os rótulos de texto desenhados pela IA caem fora por código. 8 células estão aprovadas e 4
ficam no LIMITE (`tuck0`, `jload`, `land` e `wobble`): são poses certas, mas fracas, e o jogo usa as quatro assim.
O conserto delas é por código no M1. Se o dono quiser, elas entram depois numa folha de reposição, junto com os
defeitos da F2 (6 créditos, §6).

Tudo foi medido em pixel por script (numpy + Pillow). Os scripts estão em `arte-fonte/ferramentas-curadoria/`
(`passo1` a `passo6`; o caminho da folha fica em `comum.py`). Coordenadas em px da folha, salvo indicação contrária.

---

## 1. Componentes, texto e espaço

| Medida | Valor | Leitura |
|---|---|---|
| Fundo (mediana da faixa da borda) | RGB (10, 236, 3), desvio ≤ 2 | Chapado, sem gradiente. A última linha e a última coluna têm ruído de até 39,5 de distância: corto 2 px de borda antes da chave. |
| Chave | distância ao fundo, tolerância 48 + rampa 70, miolo com alfa ≥ 64 | Mesma chave do pipeline do InnoFighters |
| Componentes conexos (8-vizinhos) | **136 = 12 figuras + 124 letras** | 12 figuras: nenhuma linha de chão, nenhuma neve, nenhuma figura encostando em outra |
| Figuras | área de 82.827 a 109.468 px | |
| Letras | área ≤ 1.183 px (70 vezes menor que a menor figura), cor média preta (luminância ~17), todas em 3 faixas: y 571-607, 1165-1201 e 1718-1754 | Descartadas por **tamanho e posição**. Nenhum componente pequeno fora dessas faixas: não há traço, estrela, gota nem respingo. |
| Folga entre a prancha e o rótulo da mesma coluna | 18 a 19 px | O texto nunca toca a figura, então nada precisa de edição |
| Sombra ou algo abaixo da base da prancha | 0 px em todos os quadros de chão | Sem sombra de contato |
| Margem até a borda da imagem | topo ≥ 52 (`takeoff`), esquerda ≥ 68 (`fall0`), direita ≥ 78, base ≥ 92 | Nada cortado |
| Folga entre fileiras | 77 px (1→2) e 88 px (2→3): 4,3% e 4,9% da altura | O pedido era 8%. Não atrapalha, porque o recorte é por componente. |
| Folga entre colunas | mínima de 63 px (`fall0` → `fall1`) | |
| Tamanho das figuras | `ride0` = 478 px = 80% da fileira e 83% da coluna | Maior que os 70%/75% pedidos (o Runway sempre infla), sem tocar em nada |

**Por que o texto apareceu:** o BLOCO C numera as poses com nomes em inglês ("(1) riding: ..."), e o modelo
escreveu esses nomes como legenda, mesmo com "Absolutely NO text" no BLOCO A. Pela distância, o BLOCO A, que fica no
início do prompt, perde para a lista, que fica no fim. Conserto de prompt para a F2 está no §6.3.

## 2. Escala (régua para as próximas folhas)

| Régua | F1 (mediana) | Variação dentro da F1 | Mestra | F1 / mestra |
|---|---|---|---|---|
| Largura da aba do chapéu (quadros em pé) | **200 px** | 191 a 204 (±3,5%) | 391 (vista de frente) | 0,512 |
| Comprimento da prancha (quadros de chão, vista lateral) | **497 px** | 489 a 498 (±1%) | 838 (vista de cima, peça 4) | 0,593 |
| Altura de `ride0` (topo do chapéu até a base da prancha) | 478 px | | | |

- A folha tem **uma escala só**. Não precisa normalizar quadro a quadro. **`fatorFolha` da F1 = 1,0**: ela é a
  folha de referência. Para a F2 e a F3, `fatorFolha = 497 / prancha da folha`, conferido com `200 / chapéu`.
- **Divergência de proporção da prancha:** em relação ao corpo, a prancha da F1 está ~16% mais comprida que a da
  mestra (0,593 contra 0,512). Dentro da F1 ela é estável. A prancha é o objeto rígido mais limpo em vista lateral,
  por isso **use a prancha como régua principal entre folhas de descida** e o chapéu como segunda régua. Só
  comparar com a mestra pela aba do chapéu. Para o jogo não faz diferença.
- Topo da cabeça até o queixo não dá para medir: o chapéu cobre o topo. Por isso a régua é a aba.

## 3. Medidas por célula

Ângulo da prancha: positivo = bico (direita) para cima. Medido de dois jeitos que concordam: eixo principal (PCA) da
máscara da prancha e regressão da linha de base no miolo (20%-80%) da prancha. A máscara da prancha sai pela cor
(matiz 31-58°, S ≥ 0,5, V ≥ 0,5) e fica com o maior componente dentro da figura, dilatado 3 px para juntar as listras
vermelhas. Conferi a máscara a olho na sobreposição. Base da fileira = base comum das pranchas de chão: y 551, 1146 e
1699. "Inclinação" = x médio dos 30% de cima do corpo menos o x do `contato` (positivo = corpo para a direita, à
frente).

| Célula | Pose do jogo | Caixa w×h | h / `ride0` | Prancha | Base da prancha | Folga até a base | Inclinação | Razão w/h |
|---|---|---|---|---|---|---|---|---|
| L1 C1 | `ride0` | 498×478 | 1,00 | **0,02°** | 551 | 0 | +14 | 1,04 |
| L1 C2 | `tuck0` | 497×379 | **0,79** | **0,03°** | 551 | 0 | +70 | 1,31 |
| L1 C3 | `jload` | 498×430 | 0,90 | **0,03°** | 551 | 0 | +43 | 1,16 |
| L1 C4 | `takeoff` | 489×502 | 1,05 | 10,7° (no ar, cauda na base) | 553 | −2 | +184 | 0,97 |
| L2 C1 | `air` | 483×492 | 1,03 | 6,3° (no ar) | 1121 | **25** | +175 | 0,98 |
| L2 C2 | `flip0` | 353×417 | 0,87 | 22-26° (gira de qualquer jeito) | 1068 | 78 | +23 | **0,847** |
| L2 C3 | `land` | 499×438 | 0,92 | **0,04°** | 1145 | 1 | +23 | 1,14 |
| L2 C4 | `wobble` | 499×467 | 0,98 | **0,06°** | 1146 | 0 | **+30** | 1,07 |
| L3 C1 | `fall0` | 536×416 | 0,87 | **0,02°** | 1699 | 0 | **+92** | 1,29 |
| L3 C2 | `fall1` | 478×414 | 0,87 | 18,6°, de cabeça para baixo, prancha por cima | 1383 (prancha no alto) | 50 (do corpo) | | 1,15 |
| L3 C3 | `fall2` | 521×406 | 0,85 | 61-63° (de pé, à ESQUERDA) | corpo em 1697, cauda em 1699 | 0 | | 1,28 |
| L3 C4 | `celeb` | 490×466 | 0,97 | **0,05°** | 1699 | 0 | +37 | 1,05 |

Nos 7 quadros de chão, o resíduo da linha de base ficou entre 1,1 e 2,1 px: base reta.

### 3.1 Contrato C1 (`contato` e `pivo`) por quadro

Em px **do recorte** (`recortes-v1/capi-<pose>.png`, com margem de 8 px). Os valores também estão em
`recortes-v1/capi-f1-medidas-v1.json`, junto com a origem de cada recorte na folha. `contato` = x médio dos pixels da
prancha nas 3 últimas linhas e y da última linha com ≥ 5 px de prancha. `pivo` = centroide da máscara inteira,
ponderado pelo alfa, com a prancha incluída. Raio de giro = metade da diagonal da caixa (nota para a Vega: o quadro no
atlas precisa caber num quadrado de 2× esse raio).

| Pose | Tipo (§4.3) | Recorte w×h | `contato` | `pivo` | Raio de giro |
|---|---|---|---|---|---|
| `ride0` | prancha no chão | 514×494 | [252.7, 485] | [250.9, 266.9] | 345 |
| `tuck0` | prancha no chão | 513×395 | [252.5, 386] | [269.9, 216.7] | 313 |
| `jload` | prancha no chão | 514×446 | [252.2, 437] | [255.5, 243.0] | 329 |
| `takeoff` | no ar | 505×518 | — | [233.0, 256.7] | 350 |
| `air` | no ar | 499×508 | — | [235.1, 262.2] | 345 |
| `flip0` | no ar | 369×433 | — | [163.3, 226.5] | **273** |
| `land` | prancha no chão | 515×454 | [252.2, 445] | [256.2, 250.5] | 332 |
| `wobble` | prancha no chão | 515×483 | [244.7, 474] | [248.5, 256.5] | 342 |
| `fall0` | prancha no chão | 552×432 | [248.8, 423] | [298.0, 231.9] | 339 |
| `fall1` | no ar | 494×430 | — | [274.6, 223.4] | 316 |
| `fall2` | corpo no chão | 537×422 | [204.6, 413] (ponto mais baixo do corpo, y na base da fileira) | [257.5, 290.0] | 330 |
| `celeb` | prancha no chão | 506×482 | [247.0, 473] | [252.3, 252.2] | 338 |

O `contato` dos quadros de chão cai no centro da prancha (x de 245 a 253 num recorte de ~514). Isso é coerente: a
prancha está centrada e reta. No `fall2`, a cauda da prancha também toca a base (y 1699, 2 px abaixo do corpo). Usei o
corpo, como manda a §4.3.

## 4. Silhueta, eco e consistência

- **Pares mais parecidos dentro da folha** (área do XOR ÷ área da união, alinhando pelo `contato`; o alinhamento dos
  quadros no ar é pelo meio da base da caixa): `jload`×`land` 0,158 (IoU 0,84), `ride0`×`wobble` 0,197,
  `ride0`×`celeb` 0,215, `ride0`×`land` 0,216. Nenhum par fica perto de "mesmo desenho" (<0,03), então não há quadro
  duplicado. Mas `jload` e `land` são quase a mesma silhueta, e é isso que deixa as duas no LIMITE.
- **Eco da mestra (`difcruz`)**: o corpo da célula, sem a prancha, contra as vistas de frente e de perfil da mestra,
  escaladas por 0,512 e alinhadas pela base das botas. O menor valor é `ride0`×frente, 0,299, maior que o par mais
  parecido da folha (0,158). Uso esse par como proxy da régua `ride0`×`ride1`, porque `ride1` só sai na F2. Leitura:
  **nenhuma célula é eco da referência**. A mestra fora da prancha cumpriu o papel dela.
- **Personagem**: mesmo rosto, chapéu com cordão, poncho tijolo com listras creme e preta, luvas de dedão e botas
  marrons em todas as células. A prancha é mostarda nas 12, e as listras vermelhas aparecem na sola quando ela é vista
  de baixo (`flip0`, `fall1`, `fall2`). Nenhum membro a mais.
- **Cuia (limite global, sem conserto)**: aparece em `ride0`, `jload` e `flip0` e some nas outras 9. O CHARACTER pede
  "always holds". No jogo, a cuia tem uns 10 px de tela e "pisca" entre `ride0` e `land`/`celeb`. É aceitável num
  personagem cômico. Não vale crédito.
- **Vazamento de verde no personagem**: só na franja de 1 px da silhueta. No miolo da figura não há reflexo verde.

## 5. Veredito por célula

| Pose | Pose do jogo (nome final do quadro) | Veredito | Causa medida | Conserto mínimo |
|---|---|---|---|---|
| `ride0` | descida | **APROVADA** | prancha a 0,02°, base 551, nada abaixo | — |
| `tuck0` | agachado (ganhando velocidade) | **LIMITE** | `tuck0`/`ride0` = **0,79** (régua ≤ 0,70). Medindo só o corpo, do topo do chapéu ao topo da prancha: 0,78. Peito bem à frente (inclinação +70) e silhueta claramente diferente da `ride0` | M1: aceitar; no jogo, a leitura vem do peito à frente. Achatar por escala distorceria o rosto, então não faço. Reposição opcional (§6.2) |
| `jload` | pré-salto | **LIMITE** | só 10% mais baixa que a `ride0`. Os braços não foram para trás (a mão de longe segura a cuia à frente). Silhueta quase igual à `land` (IoU 0,84) | M1: aceitar; o código faz a antecipação com squash vertical de 0,92 sobre o `contato` por 2-3 ticks. Reposição opcional |
| `takeoff` | decolagem | **APROVADA** | prancha a 10,7° com a cauda na base (como pedido), braço subindo | — |
| `air` | ar neutro | **APROVADA** | pose certa. A folga sob a prancha é de só 25 px, o que não importa: o quadro no ar é posicionado pelo `pivo`, não pela base. Prancha a 6,3° com o bico para cima | Opcional: a Lyra gira −6° no `pivo` se o jogo quiser ângulo 0 = prancha nivelada. Na subida, bico para cima lê bem |
| `flip0` | ar encolhido (mortal) | **APROVADA** | razão 0,847 (faixa 0,8-1,25), nada esticado para fora. Uma mão segura a cuia em vez de as duas segurarem a canela (diferença sem efeito no giro) | Vega: quadro no atlas de pelo menos 546 px de lado (2 × raio 273) |
| `land` | aterrissagem | **LIMITE** | compressão fraca: 0,92 da `ride0`, inclinação igual. Braços abertos como pedido | M1: squash de 0,90-0,94 no `contato` nos primeiros ticks do pouso (squash-and-stretch padrão). Reposição opcional |
| `wobble` | perda de equilíbrio | **LIMITE** | o rosto preocupado e os braços abertos estão certos, mas o corpo **não** inclina para trás: a inclinação é +30, levemente para a frente (pedido: negativa) | M1: oscilação de ±5° em volta do `contato` por código, que é a animação natural do desequilíbrio. Reposição opcional |
| `fall0` | tropeço | **APROVADA** | inclinação +92, a maior entre os quadros de chão: tomba para a direita, braços à frente, cara de susto. Prancha a 0,02° | — |
| `fall1` | tombo no ar | **APROVADA** | de cabeça para baixo, com a prancha por cima (como pedido) | — |
| `fall2` | de bruços | **APROVADA** | cabeça à **direita**, prancha nos pés apontando para cima à esquerda. Não precisa espelhar | `contato` = corpo (§3.1) |
| `celeb` | comemoração | **APROVADA** | punho erguido, sorriso aberto, prancha a 0,05° na base | — |

Contagem: **8 APROVADAS, 4 LIMITE, 0 REPROVADAS.** Nenhuma célula precisa ser regerada para o M1.

## 6. O que regerar, com qual prompt e quanto custa

### 6.1 Obrigatório: nada (0 créditos)

- **Rótulos de texto**: removidos por código, porque os 124 componentes de letra não tocam nenhuma figura. **Não**
  usar o prompt de correção "Texto, números, moldura" da §4.11 (6 créditos à toa, e a edição pode mexer no rosto).
- Linha de chão, neve, sombra, spray: não há. Prancha torta em quadro de chão: não há (os 7 ficaram entre 0,02° e 0,06°).

### 6.2 Opcional: reposição das 4 células no LIMITE (1 folha 2K = 6 créditos)

Recomendação: **não gastar agora.** Esperar a curadoria da F2 e juntar estas 4 com os defeitos dela numa só folha de
reposição (reserva R1 da §4.13). Regras do lote: anexar **só a mestra** (anexar a F1 traria de volta as mesmas poses,
por eco), uma geração, e depois de 2 falhas na mesma célula, aceitar. Com o saldo informado de ~482 créditos, o custo
é irrelevante. O motivo para esperar é o risco de escala e de rosto numa folha nova, não o preço.

Texto, se o dono quiser rodar já. Anexe só `capi-mestra-v1.png`, paisagem 4:3, 2K, e cole na ordem: o BLOCO A da §4.5
com as **duas primeiras frases da grade trocadas** pelas abaixo, o CHARACTER da CAPI da §4.7 e esta linha de folha:

```
Exactly 4 poses arranged in an invisible grid of 2 columns and 2 rows. Every cell has the same size.
```
```
REPLACEMENT SHEET — RIDING. All four on the baseline, the snowboard perfectly horizontal.
Row 1: (1) speed tuck: crouched very low, knees deeply bent, chest close to the knees, both arms tucked in front, determined face; the figure is only about 60% as tall as a relaxed standing rider, the top of the hat at the middle of the row, (2) ready to jump: knees bent very deep, the whole figure about 80% as tall as a relaxed rider, both arms swung far back behind the body to the LEFT, focused face, the gourd cup held in the hand farther from the viewer, also swung back.
Row 2: (1) landing: knees bent very deep absorbing the impact, the figure about 80% as tall as a relaxed rider, arms out wide, eyes squeezed, (2) losing balance: the whole upper body leaning far back to the LEFT, the head behind the back foot, arms windmilling, worried face.
Do not write any pose name, caption, number or label anywhere in the image.
```

Critérios de aceite da reposição: `tuck` ≤ 0,70 da `ride0` escalada pela prancha (497 px); `jload` e `land` ≤ 0,85;
`wobble` com inclinação negativa; prancha < 1° nas 4; IoU `jload`×`land` < 0,80; cada célula comparada à mestra
(`difcruz`) e à F1.

### 6.3 Antes da F2: uma linha no prompt (0 créditos)

Acrescentar ao **fim** do BLOCO C de cada folha (depois da Row 3), porque o fim do prompt é o que o modelo obedece:

```
Do not write any pose name, caption, number or label anywhere in the image.
```

Não alterei a §4.8, que é cópia exata aprovada. A decisão é do Atlas/dono. Se a linha não entrar, a F2 vai sair com
rótulos de novo. Eles saem por código como aqui, mas só se não encostarem em nenhuma figura: na F2, os grabs são no ar,
com a prancha baixa, e o rótulo pode encostar nela.

### 6.4 Saldo

A §4.13 orça a conta grátis em ~68 créditos. O Atlas informa um saldo de ~482. Esta curadoria não gastou nada.
Atualizar a §4.13 com o saldo real é com o Atlas.

## 7. Recortes de teste

Pasta `arte-fonte/personagens/capi/recortes-v1/`:

- `capi-<pose>.png` × 12 (RGBA, margem de 8 px, nome = pose do jogo). Só o componente da figura mais 3 px de franja;
  as letras e as outras figuras ficam fora.
- `capi-f1-contato-v1.png`: folha de contato 4×3 em escala de 0,5. Metade sobre xadrez, metade sobre neve clara, que é
  onde o halo verde apareceria. Cruz vermelha = `contato` (só em quadros de chão e de corpo), círculo ciano = `pivo`,
  linha laranja = base.
- `capi-f1-medidas-v1.json`: tipo, tamanho, origem na folha, `contato`, `pivo`, raio de giro e halo antes/depois.

Tratamento da borda, em duas partes:

1. **Alfa**: pela chave de distância (48 + 70). Na faixa de 3 px da borda, o alfa é refeito projetando a cor do pixel
   na reta fundo→cor de referência. A referência é a cor do miolo limpo, propagada para fora por até 8 px.
2. **Cor da franja**: tirada da mistura com o verde, por (C − (1−α)·fundo)/α. Duas travas: o excesso de verde fica
   limitado ao da própria referência, e um piso impede a supercorreção para roxo. Fios finos, longe do miolo (canudo
   da cuia, ponta do cordão), recebem o despill clássico (G ≤ máx(R, B)) e o alfa da chave.

Resultado medido: em todos os 12 recortes, a fração dos pixels de borda com vazamento verde > 8 caiu de 70-75% para
**0%**, sem nenhum pixel roxo (> 25). Os pixels com alfa 0 têm RGB = 0. Conferi com zoom de 3× sobre branco e sobre
quase preto (aba do chapéu, focinho, luva, canudo): borda sem franja.

**Sobre "premultiplicado"**: o PNG guarda alfa **direto**, que é o que a especificação do PNG e o canvas do navegador
esperam. Gravar a cor já multiplicada escureceria as bordas no jogo. O que o recorte garante é ser **seguro para
premultiplicar**: RGB 0 onde o alfa é 0 e franja sem verde, de modo que a reamostragem premultiplicada (a do
empacotador, com `RGBa` do Pillow ou sharp/libvips) não puxa cor de fundo. A folha de contato foi reduzida assim. Se a
Vega quiser os bytes já multiplicados no atlas, isso é uma linha no empacotador, e o C1 precisa dizer.

## 8. Para a Vega (pipeline `npm run sprites`)

- Recortar por componente conexo, nunca por grade. O que separa letra de figura é o tamanho (a letra tem menos de
  1/70 da área) mais a faixa abaixo da base. O filtro do InnoFighters (área mínima) já resolve.
- Máscara da prancha da CAPI: matiz 31-58°, S ≥ 0,5, V ≥ 0,5, maior componente dentro da figura com dilatação de 3 px.
  Sem a dilatação, as listras vermelhas partem a prancha vista de baixo.
- `contato` e `pivo` acima são a referência para o teste do pipeline: o valor medido pelo pipeline deve bater com esta
  tabela com tolerância de ±2 px.
- Quadros no ar: quadrado de 2 × raio de giro no atlas (`flip0` = 546 px na escala da folha, antes do fator do atlas).
