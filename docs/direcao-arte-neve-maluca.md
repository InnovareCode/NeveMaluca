# NEVE MALUCA — direção de arte, marca, mundo, elenco e geração de imagens

Autor: Apolo (direção de arte) · 2026-10-22 · **versão 2** (câmera lateral), para aprovação do dono
Irmão do InnoFighters (InnovareCode). Nada aqui foi gerado: este documento é a especificação. Nenhum crédito foi gasto.
Base técnica: `docs/plano-neve-maluca.md` da Nova (opção A, contratos C1 a C3, seção 6).

**Como ler:** as explicações estão em português. Os blocos de código em inglês são prompts para colar no gerador
(Runway, Nano Banana 2.1) sem mudar nada, exceto o que estiver entre colchetes.

### O que mudou da v1 para a v2

| Seção | v1 | v2 |
|---|---|---|
| §0 | hipótese H1: câmera atrás do personagem | **decisão do dono D1 = 2,5D lateral (opção A), D2 = paisagem**; H1 e H4 caem |
| §1.4 | licenças "a conferir" | **licenças conferidas no METADATA oficial do Google Fonts**; nota de Nome Reservado da Lilita One e da Titan One; acentos: o que ainda pede download |
| §2 | obstáculos para câmera atrás | obstáculos de rolagem lateral (rampa, trilho, vão, degrau) e **camadas de parallax por pista** |
| §3.1 | silhueta vista de trás | silhueta na vista lateral (corpo de frente para a tela, prancha de perfil) |
| §4 | 3 folhas para câmera atrás, giro em 4 vistas, curvas E/D | **refeita**: vista lateral, 3 folhas reorganizadas (F1 joga sozinha no M1), mortal por rotação do sprite, 4 grabs do C2, inclinação no lugar de curva, regras de `contato` e `pivo` do C1, mestra em 4 vistas, cenário lateral |
| §4.12 | orçamento para câmera atrás | mesmo teto (plano 36, teto 54), itens novos |
| §5 | HUD com corrida de posições e direção por almofadas | HUD da descida solo, contador de voltas, gestos como padrão (D10 da Nova), botões opcionais, cálculo de entalhe dentro da faixa preta |
| §6 | boneco de neve proibido | boneco de neve permitido com regras (o plano da Nova usa um) |
| §7 | decisões da câmera traseira | decisões alinhadas à lateral, incluindo a divergência de elenco com o plano da Nova |

---

## 0. Decisões e hipóteses

| # | Item | Estado |
|---|---|---|
| D1 | **2,5D lateral, Canvas 2D, personagem em sprite** (opção A da Nova). O personagem desce da **esquerda para a direita**; o terreno é uma curva gerada por semente; a profundidade vem do parallax. | **decidido pelo dono** (2026-10-22) |
| D2 | **Paisagem**, base lógica 960×540; celular de referência 844×390 com entalhe de 47 px. | **decidido pelo dono** |
| H2 | Personagens são sprites recortados de imagens no estilo de animação 3D, não modelos 3D. | segue o plano |
| H3 | Base **regular** (pé esquerdo à frente) para todo o elenco: indo para a direita, o pé esquerdo fica na metade direita da prancha e o **peito fica virado para a tela**. É a vista que mostra o rosto inteiro, boa para o humor. | hipótese do Apolo |

**Estilo, não personagem.** O dono pediu o *estilo* das animações 3D de longa (proporções exageradas, olhos grandes,
cores quentes, expressão forte). **Nenhum prompt cita estúdio, filme ou personagem**; o estilo é descrito pelas
qualidades (§4.4). O que evitar por semelhança está em §6.

---

## 1. Marca

### 1.1 Conceito

**NEVE MALUCA é a ladeira mais divertida do mundo: ninguém desce com juízo, e todo tombo vale uma risada.**

- **Promessa:** velocidade com riso. Cair não é castigo, é parte do show (o tombo tem animação própria e nome; perde o combo, nunca a corrida).
- **Público:** família. Criança de 8 anos e o pai jogam no mesmo celular.
- **Três palavras de marca:** *ligeiro, quente, travesso*. "Quente" é proposital: o jogo se passa na neve, mas a paleta e o
  humor são calorosos. É o contraste que separa a marca dos jogos de inverno frios e azuis.

Taglines candidatas:
1. **"Desce rindo."** (recomendada: duas palavras, cabe no ícone da loja e no trailer)
2. "Ladeira abaixo, juízo nenhum."
3. "A montanha mais doida do mundo."

### 1.2 Tom de voz

| Faz | Não faz |
|---|---|
| Exagero carinhoso: "ESTABACOU COM ESTILO!" | Humilhar o jogador: nada de "perdedor", "ruim", "fracassado" |
| Gíria brasileira leve e regional, com o jeito de cada personagem ("Bah!", "netinho") | Palavrão, duplo sentido, piada com corpo, etnia ou idade usada como deboche |
| Frases curtas de grito de torcida, caixa alta nos callouts | Explicação longa no meio da descida |
| Tombo celebrado: o jogo ri **com** o jogador | Sangue, dor, machucado. Tombo é sempre "atordoado e rindo" |
| Números claros (km/h, pontos, voltas) em fonte séria | Piada nos números: o HUD é preciso, o texto é que brinca |

Microtextos de exemplo: carregamento "Passando parafina na prancha…", "Acordando a montanha…"; queda "ESTABACOU!",
"Beijou a neve!"; recorde "NOVO RECORDE MALUCO!"; pausa "Respira, toma um chocolate quente."

### 1.3 Wordmark conceitual (vale para as três direções)

Logotipo em duas linhas: **NEVE** menor em cima, **MALUCA** grande embaixo, o conjunto inclinado **8° para a direita**
(o ângulo da velocidade, o mesmo do itálico do HUD). Três recursos de desenho, todos vetoriais (a fonte é só o esqueleto):

1. **O "U" de MALUCA é um halfpipe** visto de frente, com uma bolinha (o personagem) no alto da borda esquerda. Sobrevive
   em tamanho pequeno e pode virar o ícone sozinho.
2. **Tampa de neve**: neve acumulada no topo das letras, escorrendo de leve em 2 ou 3 letras (nunca em todas).
3. **Uma letra fora do lugar**: o último **A** de MALUCA tombado 12° e quicando, como quem perdeu o equilíbrio.

Regras de uso, herdadas do logo do InnoFighters:
- **Contorno duplo obrigatório:** contorno escuro `--nm-tinta` (8% da altura da letra) **e** aro externo claro `--nm-neve`
  (3%). Só o escuro some no céu noturno; só o claro some na neve.
- Área de respiro: a altura do "N" em volta do logo inteiro.
- Tamanho mínimo: 120 px de largura para o logo completo; abaixo disso, só o "U-halfpipe".

### 1.4 Três direções

| | **A — Sorvete de Montanha** (recomendada) | **B — Placa de Pista** | **C — Bola de Neve Quicando** |
|---|---|---|---|
| Ideia | Letras gordas e redondas, tampa de neve grossa como cobertura de sorvete, sombra extrudada azul. Quente, familiar. | Letreiro esportivo sobre placa azul de estação de esqui, com os símbolos de dificuldade (círculo verde, quadrado azul, losango preto) como pontuação. | Letras de MALUCA quicando em alturas diferentes; NEVE em gelo translúcido; MALUCA em rosa-chiclete. |
| Fonte do título (esqueleto) | **Lilita One**. Alternativa: **Fredoka** (da designer brasileira Milena Brandão) | **Barlow Condensed 900 itálico** (família do InnoFighters) | **Titan One** |
| Fonte de UI | Barlow Condensed 800 itálico (números e rótulos) + Barlow 600 (menus) + Bangers (callouts e balões) | a mesma | a mesma |
| Corpo da letra | `--nm-tangerina` `#FF8A1F` | `--nm-neve` sobre placa `--nm-glaciar` `#1659B8` | NEVE `--nm-gelo` `#9FE3FF`; MALUCA `--nm-chiclete` `#FF5C8A` |
| Tampa / destaque | tampa `--nm-neve` | faixa `--nm-sinal` `#C7301C`; símbolos verde `#2FA65A`, azul, preto | brilho branco no gelo |
| Contorno / sombra | contorno `--nm-tinta` `#0B1630`; extrusão `--nm-glaciar` | contorno `--nm-tinta` | contorno `--nm-tinta`; aro `--nm-neve` |
| Contraste principal | tinta × tangerina **7,60:1** | neve × glaciar **6,40:1**; neve × sinal **5,22:1** | tinta × gelo **12,72:1**; tinta × chiclete **6,10:1** |
| Ponto forte | conversa com "quente, família"; lê bem no ícone | coerência imediata com o InnoFighters; símbolos viram sistema de dificuldade | a mais engraçada |
| Risco | parecer sorveteria se a tampa escorrer demais | séria demais, pouco cômica | infantil demais para o PC; o rosa colide com a Vó Cidinha |

**Recomendação: A**, roubando de B os **símbolos de pista** (círculo verde = fácil, quadrado azul = médio, losango
preto = difícil, dois losangos = maluca) para marcar a dificuldade das 5 pistas no menu. O plano da Nova (D9) prevê
logo tipográfico provisório até o M4: a direção A serve de provisório já, montada com a fonte e sem a tampa desenhada.

#### Licenças e acentos (conferido em 2026-10-22, sem baixar arquivo de fonte)

Fonte de verdade: o `METADATA.pb` de cada família no repositório oficial `github.com/google/fonts` (pasta `ofl/`).

| Fonte | Licença | Copyright (como consta) | Nome Reservado | Subconjuntos declarados | Acentos do pt-BR provados? |
|---|---|---|---|---|---|
| Lilita One | OFL | 2011 Juan Montoreano | **sim: "Lilita One"** | latin, latin-ext | não: falta abrir o arquivo |
| Titan One | OFL | 2011 Rodrigo Fuenzalida | **sim: "Titan One"** | latin, latin-ext | não: falta abrir o arquivo |
| Fredoka | OFL | 2016 The Fredoka Project Authors (Milena Brandão, Hafontia) | não consta na linha de copyright | latin, latin-ext, hebrew | não: falta abrir o arquivo |
| Barlow Condensed (100 a 900, com itálico) | OFL | 2017 The Barlow Project Authors | não | latin, latin-ext, vietnamese | **sim**, já usada com acentos no InnoFighters (800 itálico); o **900 itálico** da direção B ainda não foi aberto |
| Barlow | OFL | 2017 The Barlow Project Authors | não | latin, latin-ext, vietnamese | **sim** (InnoFighters) |
| Bangers | OFL | 2010 The Bangers Project Authors | não | latin, latin-ext, vietnamese | **sim** (InnoFighters, `docs/direcao-arte-baloes.md`) |
| Baloo 2 (reserva) | OFL | 2019 The Baloo 2 Project Authors | não | latin, latin-ext, devanagari, vietnamese | não |

O que isso significa na prática:
- Todas as candidatas são OFL: podem ir para o jogo e para o logo.
- **Nome Reservado (Lilita One, Titan One):** a OFL proíbe distribuir uma versão *modificada* da fonte com o nome
  reservado, e cortar subconjunto de glifos conta como modificação. Por isso, se a fonte do título for **embarcada**
  (para escrever texto na tela), o arquivo cortado precisa de outro nome de família (ex.: `NM Titulo`). Se ela servir só
  para o **logo convertido em desenho** (vetor ou imagem), a regra não se aplica: a arte feita com a fonte não é a fonte.
  Recomendo o segundo caminho: o título vira desenho, e a fonte não vai para `public/`.
- "Subconjunto latin declarado" é a promessa do catálogo, não a prova glifo a glifo. A prova (abrir o arquivo e conferir
  `Ã Õ Ç É Ê Í Ó Ú À Â Ô ã õ ç é ê í ó ú à â ô`) exige baixar.

**Downloads que precisam de autorização** (não baixei nada): o arquivo da fonte escolhida para o título (Lilita One,
Fredoka ou Titan One, conforme a direção) e, se for a direção B, o Barlow Condensed 900 itálico. Canal sugerido: o mesmo
do InnoFighters (`@fontsource/<família>`, subconjunto latin), com o `OFL.txt` junto.

### 1.5 Tokens de cor (marca e UI)

| Token | Hex | Papel |
|---|---|---|
| `--nm-tinta` | `#0B1630` | contorno de tudo, miolo do HUD, texto sobre cor clara |
| `--nm-neve` | `#F7FBFF` | texto sobre fundo escuro, aro externo, tampa de neve |
| `--nm-neve-sombra` | `#DCEBF7` | sombra da neve na UI, painéis claros secundários |
| `--nm-gelo` | `#9FE3FF` | função AGACHAR, velocidade baixa, nota BOA |
| `--nm-glaciar` | `#1659B8` | extrusão do logo, botões secundários, placa de pista |
| `--nm-tangerina` | `#FF8A1F` | cor da marca (corpo do logo), botão principal de menu |
| `--nm-sol` | `#FFD23F` | função PULAR, combo, pontos ganhos |
| `--nm-chiclete` | `#FF5C8A` | função GIRO/GRAB, nota MALUCA |
| `--nm-menta` | `#3DDC97` | pouso perfeito, desbloqueio |
| `--nm-sinal` | `#C7301C` | tombo, alerta, "ESTABACOU!" (texto branco sobre ele) |
| `--nm-uva` | `#5B3FE0` | raridade lendária das pranchas |
| `--nm-aco` | `#B8C4DA` | pausa, elementos neutros |

**Contraste** (fórmula WCAG 2.x calculada por script sobre os hex; é aritmética das cores chapadas, não medição em tela):

| Texto × fundo | Razão | AA texto normal (4,5) |
|---|---|---|
| neve × tinta | 17,24 | passa (AAA) |
| tinta × gelo | 12,72 | passa (AAA) |
| tinta × sol | 12,41 | passa (AAA) |
| tinta × aço | 10,20 | passa (AAA) |
| tinta × menta | 10,14 | passa (AAA) |
| tinta × tangerina | 7,60 | passa (AAA) |
| neve × glaciar | 6,40 | passa |
| neve × uva | 6,25 | passa |
| tinta × chiclete | 6,10 | passa |
| neve × sinal | 5,22 | passa |
| **neve × tangerina** | **2,27** | **reprova: texto branco sobre laranja é proibido** |
| neve × verde-pista `#2FA65A` | 3,00 | reprova para texto (só símbolo gráfico, ≥ 3:1) |
| tinta × vermelho `#E8432E` | 4,50 | no limite: não usar; usar `--nm-sinal` com texto branco |

Regra prática: **cores quentes e claras levam texto `--nm-tinta`; azul, uva e sinal levam texto `--nm-neve`.**

### 1.6 Mascote opcional: JUIZ APITO

Uma **marmota juíza de manobras**: camisa listrada de árbitro, apito, prancheta, bigodinho. Ela brota de buracos na
neve à beira da pista para dar a nota ("NOTA DEZ!", "VALEU A INTENÇÃO!") e some. Função: **locutora** dos callouts e da
tela de carregamento, um rosto para o sistema de pontos sem competir com o elenco jogável. Na vista lateral ela sai do
chão de perfil, só da cintura para cima. Paleta: pelo `#8A5A35`, camisa listrada tinta e neve. Opcional: custa 1 folha
(6 créditos) quando for feita. Não confundir com o **mascote do M1** do plano da Nova, que é o primeiro personagem jogável (§7).

---

## 2. Mundo: 5 pistas

Cada pista tem **hora do dia própria** (o jogador reconhece pela luz antes de ler o nome) e corresponde a um tema do M3
da Nova (bosque, parque de manobras, noite com lanternas, cidade de neve, avalanche cômica).

| # | Pista | Tema do plano | Hora / clima | Dificuldade | Casa de |
|---|---|---|---|---|---|
| 1 | **Morro do Pinhão** | bosque | manhã, sol limpo, neve fofa | círculo verde | a capivara |
| 2 | **Pico do Picolé** | parque de manobras | meio-dia, sol forte, neve em camadas coloridas | quadrado azul | Bia Bolota |
| 3 | **Vila do Chocolate Quente** | noite com lanternas + cidade de neve | fim de tarde virando noite | quadrado azul | a avó |
| 4 | **Vulcão Pé-Gelado** | (novo) | crepúsculo, vapor, gelo azul e magma | losango preto | Prof. Bandeira |
| 5 | **Cume da Ventania** | avalanche cômica | madrugada com aurora, vento forte | dois losangos | Quequé e Brunão |

### 2.1 Camadas de parallax (desenhadas em código pela Lyra, sem gasto de geração)

Ordem de trás para a frente: **céu** (degradê de 2 paradas) → **montanhas distantes** → **montanhas médias** →
**floresta/silhuetas** → **terreno** (a pista procedural: topo de neve iluminado, corpo em sombra) → personagem e
objetos. Perspectiva atmosférica: cada camada mais distante mistura-se com a cor do horizonte do céu (distante 60%,
média 40%, floresta 20%). A luz do personagem nas folhas vem **do alto à esquerda**; o filete de luz na crista do
terreno e das montanhas também fica do lado esquerdo, para o sprite "3D" não destoar do cenário plano (risco R3 da Nova).

| Pista | Céu topo → horizonte | Montanha distante | Montanha média | Floresta / silhuetas | Neve luz · sombra | Destaque |
|---|---|---|---|---|---|---|
| Morro do Pinhão | `#4FA8F0` → `#BFE6FF` | `#A9C7E6` | `#7FA3C9` | araucárias `#2E6B3A` | `#F7FBFF` · `#BFD9EE` | celeiro `#B83A2B` |
| Pico do Picolé | `#5BB8FF` → `#D9F1FF` | `#F2C6D8` | `#B9E8D6` | casquinhas e palitos `#E9C27A` | `#FFF4F8` · `#F2D3E0` | menta `#7FE0C4` |
| Vila do Chocolate Quente | `#2A2257` → `#E88A5A` | `#5B4A8A` | `#3F3570` | chalés `#2A1F3D` com janelas `#FFB84D` | `#EAF0FF` · `#8F9BD1` | lanternas `#FFB84D` |
| Vulcão Pé-Gelado | `#1F2A55` → `#7A5A8A` | `#3A3F66` | `#2B2E45` | basalto `#1E1C26` | `#DDEBFA` · `#7FA0C8` | magma `#FF6A1F` |
| Cume da Ventania | `#0C1230` → `#2C3E7A` | `#3B4C86` | `#27325E` | rochas `#1A2040` | `#E8F1FF` · `#5D6FA8` | aurora `#5CF2C2` |

### 2.2 Morro do Pinhão (pista 1, tutorial)
Serra fria do sul do Brasil num inverno raro: **araucárias** nevadas, cercas de fazenda, celeiro vermelho ao longe.
Objetos: araucária grande e pinheiro nevado (fundo e beira), pedra pequena e grande, tronco caído (pular por cima),
**rampa de neve**, **trilho de madeira de cerca** (grind), boneco de neve, **vaca malhada sentada** como gag de fundo.
Som: vanerão eletrônico acelerado com gaita (acordeão) e sinos de vaca no tempo forte; vento leve.

### 2.3 Pico do Picolé (pista 2, parque de manobras)
A montanha mais fantasiosa: a neve tem **faixas de cor em camadas** (baunilha, morango, menta). É o parque: **trilhos
em forma de palito de picolé**, rampas em casquinha, **vãos** sobre calda congelada, carrinhos de sorvete como degraus.
Som: pop chiclete com sintetizador, palmas e o sininho do carrinho de sorvete.

### 2.4 Vila do Chocolate Quente (pista 3)
Vila de chalés na hora em que as luzes acendem: a descida passa **por cima dos telhados** (degraus e vãos entre casas)
e por **varais de luzinhas** (trilho natural). Objetos: chaminés, trenós estacionados, barris, canecas gigantes
fumegantes na praça (o vapor é partícula do jogo, não da arte), gatos de vila que pulam na hora errada.
Som: swing de big band com sinos de trenó e contrabaixo caminhando.

### 2.5 Vulcão Pé-Gelado (pista 4)
Gelo azul por fora, magma brilhando nas rachaduras. **Gêiseres** lançam para o alto (rampa natural com tempo certo),
**poças termais** (desaceleram), pedras de basalto, **vãos** sobre o magma com pontes de pedra.
Som: surf rock com bateria tribal e baixo distorcido; borbulhar e vapor.

### 2.6 Cume da Ventania (pista 5, final)
Cume de madrugada, aurora no céu, **vento** que empurra no ar, fendas com pontes de corda (trilho), teleférico parado e,
no trecho final, a **avalanche cômica** que vem atrás pela esquerda da tela (bola de neve gigante, sem olhos nem boca:
ameaça, não personagem). Sem bandeiras de oração nem símbolos religiosos de montanhas reais.
Som: marcha épica cômica com metais e tuba, coral fazendo "uuuh" nos saltos, vento uivando.

---

## 3. Elenco: 6 personagens originais (proposta do Apolo)

> **Divergência com o plano da Nova (§6.2 dela):** a Nova propôs outro elenco (KAKÁ capivara, TIO BETO, VOVÓ TURBINA,
> MADAME FONDUE, FRIGOBOT, ZECA). Os dois têm uma capivara e uma avó. A escolha final é do dono (D3); §7 traz a lista
> unida e uma recomendação. As fichas abaixo valem para qualquer nome escolhido.

### 3.1 Silhueta na vista lateral (o teste dos 64 px)

Na rolagem lateral com base regular, **o corpo fica de frente para a tela e a prancha fica de perfil**; a cabeça vira
para a direita, para onde o personagem vai. Cada personagem tem uma forma dominante e um "detalhe-antena" que salta
para fora dela, e as duas coisas aparecem nessa vista:

| Personagem | Forma dominante (corpo de frente) | Detalhe-antena (lateral) | Matiz dominante | Altura relativa |
|---|---|---|---|---|
| Capi Barbosa | barril largo + sino do poncho | aba reta do chapéu; cuia na mão | vermelho-tijolo (~6°) | 0,80 |
| Prof. Bandeira | corpo médio | **focinho comprido apontando para a direita e cauda-leque para a esquerda**: a silhueta mais larga | verde-azulado (~179°) | 0,90 |
| Vó Cidinha | corpinho curvado e baixo | **pompom maior que a cabeça** | rosa-goiaba (~340°) + lavanda | 0,62 |
| Brunão | **triângulo invertido** extremo | prancha minúscula sob os pés | tangerina (~28°) | 1,00 (referência) |
| Quequé | varapau: pernas finas e compridas | **penacho espetado para a esquerda** | azul-royal (~215°) | 0,88 |
| Bia Bolota | **círculo** | câmera no topo do capacete | amarelo-sol (~46°) | 0,60 |

Critério medível proposto para a curadoria: máscara de `ride0` de cada um, normalizada pela altura, sobreposição (IoU)
par a par **≤ 0,75**. Se dois passarem disso, o detalhe-antena precisa crescer.

Regras de cor para todo o elenco, por causa da neve e do pipeline:
- **Nada de branco ou azul-claro em área grande do traje**: some na neve. Branco só em detalhe.
- **A cor da prancha não aparece em nenhum outro lugar do personagem.** Serve duas vezes: as variações de prancha saem
  por troca de cor em código, e o pipeline acha a prancha pela cor para calcular o `contato` (§4.3).
- Diversidade: 3 femininos e 3 masculinos; 3 bichos e 3 humanos.

### 3.2 Fichas

#### CAPI BARBOSA — capivara gaúcha (id `capi`)
- **Personalidade:** o ser mais tranquilo da montanha. Nunca se apressa e mesmo assim chega; recebe todo mundo com
  chimarrão; entra em toda poça termal.
- **Assinatura — Roda de Chimarrão:** no ar, encolhido e de olhos fechados, sorvendo a cuia; nem uma gota cai (no jogo, o sprite gira em mortal).
- **Silhueta:** barril, cabeça de bloco com focinho quadrado, orelhas minúsculas, poncho em sino, chapéu de aba reta, cuia na mão.
- **Paleta:** pelo caramelo `#A0673A`; poncho vermelho-tijolo `#B83A2B` com listras creme `#F2E3C2` e pretas; chapéu
  preto; botas marrons; **prancha mostarda `#E0A526`** com faixas vermelhas.
- **Bordão:** "Bah, que lomba!" · **Pranchas:** Mostarda Pampa · Erva-Mate · Pôr do Sol no Guaíba (lendária).
- **Fundo da folha:** verde `#00FF00` (no magenta, o vermelho do poncho ganha borda rosa no recorte, como na NILA).

#### PROFESSORA BANDEIRA — tamanduá-bandeira (id `bandeira`)
- **Personalidade:** cientista da neve; mede tudo, calcula em voz alta, erra por pouco, sempre otimista.
- **Assinatura — Cauda-Vela:** no ar, cauda erguida e aberta atrás como uma vela, braços abertos, planando.
- **Silhueta:** focinho em tubo para a direita, cauda-leque para a esquerda e para cima, óculos redondos com óculos de esqui na testa.
- **Paleta:** pelo cinza `#8C8C8C` com a faixa diagonal preta contornada de branco nos ombros; colete de esqui
  verde-azulado `#14A3A0` cheio de bolsos; cachecol amarelo-sol; **prancha laranja `#FF8A1F`** com linhas de planta técnica.
- **Bordão:** "Pelas minhas contas… vai dar bom!" · **Pranchas:** Planta Técnica · Tabela Periódica (só cores) · Formigueiro de Ouro.
- **Fundo da folha:** magenta `#FF00FF` (o verde-azulado seria apagado no verde).

#### VÓ CIDINHA — avó humana, 78 anos (id `cidinha`)
- **Personalidade:** doce na cozinha, terrível na pista; chama todo mundo de "netinho"; não admite perder para "essa juventude".
- **Assinatura — Novelo Supersônico:** encolhe numa bolinha de lã com as agulhas de tricô espetadas.
- **Silhueta:** baixinha e curvada; gorro com pompom maior que a cabeça; coque com duas agulhas; óculos **retangulares** grossos.
- **Paleta:** gorro rosa-goiaba `#E85D8A` com pompom creme; cardigã lavanda `#9B7FD4`; saia xadrez vinho `#7A2E3A`;
  meia-calça marrom; **prancha azul-retrô `#7FA6D9`** com flores.
- **Bordão:** "Sai da frente, netinho!" · **Pranchas:** Azul-Retrô · Toalhinha de Crochê · Porcelana de Domingo.
- **Fundo da folha:** verde `#00FF00` (rosa e lavanda colidem com o magenta).

#### BRUNÃO — fisiculturista humano, 29 anos (id `brunao`)
- **Personalidade:** grandalhão de coração mole; jura que "frio é psicológico" e treme de regata; chora no pódio. O humor é a teimosia, nunca o corpo.
- **Assinatura — Duplo Bíceps Voador:** no ar, pose de fisiculturista com os dois braços, sorrisão.
- **Silhueta:** ombros enormes, cintura fina, pernas curtas, cabeça pequena com faixa; **prancha pequena demais**, de criança.
- **Paleta:** pele morena `#8D5A3B`; regata tangerina `#FF8A1F`; calça de esqui uva `#5B3FE0`; faixa amarela;
  **prancha rosa-chiclete `#FF5C8A`** com corações (era da irmã caçula).
- **Bordão:** "Frio é psicológico!" · **Pranchas:** Da Maninha · Halter · Ouro Olímpico.
- **Fundo da folha:** verde `#00FF00` (rosa e uva colidem com o magenta).

#### QUEQUÉ — quero-quero (id `queque`)
- **Personalidade:** competitivo, territorial e escandaloso; acha que toda pista é dele.
- **Assinatura — Voo Rasante:** asas abertas, corpo esticado para a frente, planando baixo.
- **Silhueta:** varapau de pernas finas, penacho preto espetado para trás (para a esquerda), asas que funcionam como braços.
- **Paleta:** costas cinza-pardo `#8A7F70`; rosto branco com faixa preta; peito preto; olhos vermelhos `#D7263D`;
  macacão de corrida azul-royal `#1659B8` com faixa amarela; **prancha vermelha `#E8432E`** com asas pretas.
- **Bordão:** "Quero! Quero! Quero ganhar!" · **Pranchas:** Asa Rubra · Campo Verde (cor só no jogo) · Ovo de Ouro.
- **Fundo da folha:** verde `#00FF00`.

#### BIA BOLOTA — menina humana, 9 anos (id `bia`)
- **Personalidade:** destemida e tagarela; narra a própria descida como locutora ("E ELA VAI!") com a câmera do capacete.
- **Assinatura — Bolota Total:** fecha a jaqueta até a cabeça sumir e vira uma bola.
- **Silhueta:** jaqueta acolchoada que faz dela um círculo, perninhas, capacete com câmera, dois pompons de cabelo cacheado.
- **Paleta:** jaqueta amarelo-sol `#FFD23F`; capacete azul-marinho `#22336B`; luvas verde-limão `#9BE33A`; calça
  azul-marinho; **prancha turquesa `#19B5A5`** com estrelas.
- **Bordão:** "Tá gravando? Então olha essa!" · **Pranchas:** Turquesa Estrelada · Arco-Íris de Adesivos · Câmera Lenta.
- **Fundo da folha:** magenta `#FF00FF` (a turquesa seria apagada no verde).

### 3.3 Variações de prancha
Mesma forma, só desenho e cor, aplicados por código sobre a área da cor-base da prancha. Prancha de **forma diferente**
exige folhas novas e fica para depois do protótipo.

---

## 4. Poses e geração de imagens consistente (refeita para a vista lateral)

### 4.1 Câmera e convenções

- **Vista lateral reta**, como num jogo de rolagem. O personagem anda para a **DIREITA**.
- **Prancha de perfil**, na horizontal, bico para a direita, vista **levemente de cima** para mostrar uma faixa fina
  do desenho do tampo (é o que identifica a prancha e a cor dela).
- **Corpo de frente para a tela** (base regular): pé esquerdo na metade direita da prancha, joelhos levemente dobrados,
  **cabeça virada para a direita**, rosto em três-quartos para a expressão ser lida.
- **Nos quadros no chão, a prancha fica perfeitamente horizontal**, com a base na linha invisível da fileira. Quem inclina
  o sprite para acompanhar o terreno é o jogo, girando em volta do `contato` (C1). Prancha torta na arte vira prancha
  torta em dobro no jogo.
- **Mortal = rotação do sprite** em volta do `pivo` (C1), nas duas direções (C2: `giro` −1 e +1). A arte só precisa
  das poses encolhidas; a contagem de voltas é do HUD (§5.5).
- **"Curva" na vista lateral = mudança de inclinação do corpo**, não de direção (o C2 não tem direção): `leanBack`
  (peso atrás, segurando na descida íngreme) e `leanFwd` (peso à frente, atacando na compressão e no topo de rampa).
  A Lyra escolhe pela variação de `anguloTerreno`.
- **Grabs = os 4 do C2:** `cima`, `baixo`, `frente`, `tras` (§4.2).
- Espelhar só é permitido para corrigir um quadro de queda com a cabeça do lado errado; nunca para criar pose
  (espelhar inverte a base e põe o peito para trás).

### 4.2 Poses: 3 folhas de 12 (36 poses), em ordem de marco

A F1 sozinha **joga o M1** (é a "folha A" da §6.5 da Nova, pose por pose). A F2 é a "folha B" do M2. A F3 cobre telas e
extras (M3/M4) e **pode ser adiada** se o dono preferir guardar crédito para outros personagens (D5 da Nova).

| Folha | Linha 1 | Linha 2 | Linha 3 |
|---|---|---|---|
| **F1 descida (M1)** | `ride0` deslizando · `tuck0` agachado ganhando velocidade · `jload` preparando o pulo · `takeoff` decolando | `air` no ar neutro · `flip0` encolhido (mortal) · `land` pousando (compressão) · `wobble` desequilibrado | `fall0` tropeça · `fall1` rola · `fall2` cara na neve · `celeb` comemorando |
| **F2 manobras (M2)** | `grabUp` (cima) · `grabDown` (baixo) · `grabFront` (frente) · `grabBack` (trás) | `rail` no trilho · `star` estrela · `panic` susto · `sig` assinatura | `ride1` deslizando 2 · `tuck1` agachado 2 · `leanBack` peso atrás · `leanFwd` peso à frente |
| **F3 festa e telas (M3/M4)** | `dizzy` sentado tonto · `getup` levantando · `start` largada · `look` provoca | `flip1` encolhido 2 · `open` abrindo para pousar · `boneco` atravessando boneco de neve · `coleta` pegando floco | **de frente, fora da prancha:** `win0` vitória · `win1` vitória com bordão · `lose` derrota cômica · `select` seleção e retrato |

### 4.3 `contato` e `pivo` (contrato C1) — o que a arte precisa garantir

| Tipo do quadro | Poses | `contato` | `pivo` |
|---|---|---|---|
| Prancha no chão | `ride*` `tuck*` `jload` `land` `wobble` `celeb` `rail` `lean*` `start` `look` `fall0` | meio da base da prancha (centro em x da última linha de pixels da prancha) | centro da massa (opcional) |
| Corpo no chão | `fall2` `dizzy` `getup` `lose` | ponto mais baixo do corpo | — |
| No ar | `takeoff` `air` `flip*` `open` `grab*` `star` `panic` `sig` `fall1` `boneco` `coleta` | — | **centroide da máscara inteira** (prancha incluída); nos `flip*` a figura é compacta e quase redonda, então o centroide é estável na rotação |
| Telas (de frente) | `win*` `select` | base dos pés | — |

Regras de arte que tornam isso medível pelo pipeline (`npm run sprites`, adaptado pela Vega):
1. A prancha tem **cor exclusiva** no personagem: a máscara da prancha sai por matiz, e o `contato` sai dela.
2. Nos quadros de prancha no chão, **a base da prancha é reta e horizontal**; nada (mão, cauda, poncho) passa abaixo dela.
3. Nos quadros encolhidos (`flip*`), **nada se estica para fora** (nem mão, nem cauda, nem pompom solto): a rotação de
   uma figura compacta não "balança" em volta do pivô.
4. O quadro no atlas precisa de **margem para girar**: a caixa do `flip*` deve caber num quadrado do tamanho da diagonal
   da figura, senão o sprite corta ao girar (nota para a Vega no empacotamento).

### 4.4 Regras herdadas do InnoFighters (todas vieram de defeito medido)

1. **Uma só imagem anexada por pedido** (a mestra aprovada). Com duas, o modelo devolve uma delas.
2. **Eco da referência:** pose parecida com a anexada volta como a própria referência. A mestra é uma folha de modelo
   **em pé, fora da prancha** (§4.6), longe das poses de descida. Na curadoria, comparar cada célula com a mestra
   (`difcruz`): diferença menor que a de `ride0` × `ride1` = eco, reprova.
3. **O bloco CHARACTER descreve corpo, rosto, roupa e prancha, nunca postura** (lição NILA f5).
4. **IMPORTANT SPACING** em toda folha (70% da altura e, na lateral, 75% da largura da célula, por causa da prancha comprida).
5. **Nada de "fundo transparente"** (vira xadrez). Fundo chapado na cor da ficha.
6. **Verbo que implica partícula vira efeito.** Na neve: não usar *carving*, *spray*, *powder*, *skid*, *dust*,
   *crashing into snow*. Descrever a postura, não o efeito. O rastro de neve é partícula do jogo.
7. **Linha de chão:** a IA desenha chão mesmo pedindo que não; na neve, desenha neve sob a prancha. O bloco A proíbe;
   na curadoria, contagem de componentes menor que 12 denuncia a linha.
8. **Agachado sai em pé** (BAATAR: 98% da altura). O `tuck0` pede a altura em proporção e a curadoria mede `tuck0`/`ride0` ≤ 0,70.
9. **Lado ambíguo:** dizer "the hand nearest the viewer" / "the hand farther from the viewer", não "right hand".
10. **Mão em objeto invisível** vira mão na própria roupa: no `rail` o trilho não é desenhado, então as mãos ficam
    abertas no ar, nunca "segurando" nada.
11. **Cabeça na queda:** `fall2` com a cabeça do lado errado é espelhado por código; não peça correção ao gerador.
12. **Sem sombra no chão** (o jogo projeta a sombra no terreno e é ela que mostra a altura do salto; regra da Nova).
13. Correção pontual, um defeito por vez; se a edição trocar o rosto, descarte e volte à versão anterior.
14. Baixar só para a pasta temporária, medir, mostrar ao dono, e só então copiar para `arte-fonte/`.

### 4.5 BLOCO A — regras gerais das folhas (cole no início de toda folha)

```
Stylized 3D animated family-movie character sprite sheet for a comic side-scrolling snowboarding video game: appealing cartoon proportions, big expressive eyes, soft rounded shapes, smooth high-quality CG render, soft warm key light from the upper left and a soft cool fill light. Clean, crisp silhouette edges. Landscape image, aspect ratio 4:3.
Exactly 12 poses arranged in an invisible grid of 4 columns and 3 rows. Every cell has the same size. One full-body figure with its snowboard centered in each cell with clear empty space around it. No figure touches another figure or the image border. Nothing is cut off.
CAMERA: a straight side view, like a side-scrolling game. The rider travels to the RIGHT. The snowboard is seen from the side, horizontal, its front tip pointing RIGHT, seen very slightly from above so a thin strip of its top graphic shows. The rider stands sideways on the board with the body and chest facing the viewer, the left foot on the right half of the board and the right foot on the left half, and the head turned to look RIGHT, the face in three-quarter view so the expression is easy to read. This applies to every cell unless the cell says otherwise.
In every cell where the rider is on the ground, the snowboard is perfectly horizontal and level, and the bottom of the board rests on the same invisible baseline near the bottom of the row. Nothing hangs below the bottom of the board.
Same character, same outfit, same face, same proportions, same snowboard and same size in every cell. Both feet stay strapped to the snowboard in every cell unless the cell says otherwise.
IMPORTANT SPACING: each figure, snowboard included, is only about 70% of the height of its row and about 75% of the width of its column, never bigger. Leave an empty band of plain background at least 8% of the image height between rows, above the top row and below the bottom row. Ears, hair, tails, hands, feet and both tips of the snowboard NEVER touch the image border, the next row or the next column. The snowboard is never cut off.
Background: one single flat solid color (given in the character description) filling the whole image. The figures float on the flat color: no snow, no ground, no slope, no ground line, no ground shadow, no contact shadow, no cast shadow, no gradient, no vignette, no colored reflections of the background on the character.
Absolutely NO text, letters, numbers, logos, labels, arrows, grid lines, borders or frames.
NO visual effects of any kind: no snow spray, no powder, no snowflakes, no sparkles, no speed lines, no motion trails, no blur, no dizzy stars, no sweat drops, no glow.
Only this one character. No other people or animals, no props unless a cell says so.
```

### 4.6 Imagem-mestra (folha de modelo; primeira imagem de cada personagem)

Formato **paisagem 4:3, 2K**, sem imagem anexada. Cole este bloco e, depois, o bloco CHARACTER **sem** a frase
"Match the attached reference image exactly.".

```
Character model sheet for a comic side-scrolling snowboarding video game. Stylized 3D animated family-movie look: appealing cartoon proportions, big expressive eyes, soft rounded shapes, smooth high-quality CG render, soft warm key light from the upper left and a soft cool fill light. Clean, crisp silhouette edges. Landscape image, aspect ratio 4:3.
Exactly 4 items in one row with wide empty space between them, all at the same scale, on the same invisible baseline: (1) the character in a front view facing the viewer, (2) the character in a side profile facing RIGHT, (3) the character in a back view seen from behind, (4) the character's snowboard alone, lying flat and seen from the side and slightly from above, its front tip pointing RIGHT, so its side and a strip of its top graphic both show. In views 1 to 3 the character stands relaxed and neutral wearing snowboard boots, arms slightly away from the body, friendly expression, NOT on the snowboard.
IMPORTANT SPACING: each item is only about 70% of the image height, with empty background above and below. Nothing touches the image border or another item.
Background: one single flat solid color (given below) filling the whole image. No floor, no snow, no shadow, no gradient. NO text, letters, numbers, labels or effects.
```

Por que 4 vistas e não só o perfil: as folhas mostram o corpo de frente com a cabeça virada (§4.1), as costas aparecem
no tombo que rola e a prancha precisa de referência própria. Por que fora da prancha: evita o eco da referência (§4.4, regra 2).

### 4.7 Blocos CHARACTER (sem postura, de propósito)

```
CHARACTER — CAPI BARBOSA: a chubby adult capybara with a barrel-shaped body, a big blocky head with a square muzzle, tiny round ears, small calm half-closed eyes and a serene smile. Short warm caramel-brown fur #A0673A. He wears a brick-red wool poncho #B83A2B with cream #F2E3C2 and black horizontal stripes that flares like a bell, a flat-brimmed black gaucho hat tied under the chin with a thin cord, brown wool gloves and brown snowboard boots. He always holds a small brown gourd cup with a silver metal straw in the hand farther from the viewer. Snowboard: mustard yellow #E0A526 with two red stripes along it. BODY PROPORTIONS: the head is about one third of his total height; short stubby legs. Match the attached reference image exactly. Background color: solid flat pure green #00FF00.
```

```
CHARACTER — PROFESSORA BANDEIRA: an adult female giant anteater with a long thin tube-shaped snout, a huge bushy fan-shaped tail, gray fur #8C8C8C and the species' diagonal black stripe bordered with white running over each shoulder. Thick round glasses on the snout and ski goggles pushed up on her forehead. She wears a teal ski vest #14A3A0 covered with many small pockets, a sunny yellow scarf #FFD23F and gray snowboard boots. A small tape measure clipped to the vest. Snowboard: orange #FF8A1F with thin navy-blue technical blueprint lines (lines only, no letters, no numbers). BODY PROPORTIONS: the snout is as long as her head; the tail is as big as her whole torso and always stays inside the cell. Match the attached reference image exactly. Background color: solid flat pure magenta #FF00FF.
```

```
CHARACTER — VO CIDINHA: a tiny elderly grandmother, about 78 years old, short and slightly hunched, with a kind wrinkled face, rosy cheeks, a mischievous grin and thick rectangular glasses. Gray hair in a bun with two knitting needles stuck through it, visible under a guava-pink knitted beanie #E85D8A topped with a cream pompom bigger than her head. She wears a lavender knitted cardigan #9B7FD4, a wine-red plaid skirt #7A2E3A over thick brown thermal tights, small brown snowboard boots and a small crossbody purse. Snowboard: retro powder blue #7FA6D9 with simple stylized flowers. BODY PROPORTIONS: very small, the head is about one quarter of her height without the beanie. Match the attached reference image exactly. Background color: solid flat pure green #00FF00.
```

```
CHARACTER — BRUNAO: a friendly giant bodybuilder man, about 29 years old, warm brown skin #8D5A3B, a small head with a big kind smile and a short buzz cut, a yellow sweatband on his forehead. Extremely wide shoulders and huge arms, a narrow waist and short legs: an exaggerated inverted triangle shape. He wears a tangerine sleeveless tank top #FF8A1F, grape-purple ski pants #5B3FE0, yellow wristbands and big black snowboard boots. Snowboard: much too small for him, a child-size bubblegum-pink board #FF5C8A with little hearts. BODY PROPORTIONS: the head is about one seventh of his height; the shoulders are three times as wide as the head. Match the attached reference image exactly. Background color: solid flat pure green #00FF00.
```

```
CHARACTER — QUEQUE: a young southern lapwing bird, cartoon style, tall and skinny, with long thin pinkish legs, a short dark beak, bright red eyes #D7263D, a white face with a black stripe, a black chest bib, gray-brown back feathers #8A7F70 and a long thin black crest sticking straight back from the back of his head. His wings work like arms, with feather fingers. He wears a royal-blue racing suit #1659B8 with a yellow side stripe, a small blue helmet with a hole that the crest comes out of, small ski goggles and black snowboard boots. Snowboard: bright red #E8432E with black wing shapes. BODY PROPORTIONS: the legs are as long as his body; a small head. Match the attached reference image exactly. Background color: solid flat pure green #00FF00.
```

```
CHARACTER — BIA BOLOTA: a fearless 9-year-old girl wearing a giant puffy sun-yellow down jacket #FFD23F so big that her body looks like a ball, short legs in navy-blue snow pants, a navy-blue helmet #22336B with a small black action camera on top, two curly dark-brown hair puffs sticking out under the helmet, big bright eyes, freckles and a huge confident grin. Lime-green mittens #9BE33A hang from a cord. Small navy snowboard boots. Snowboard: turquoise #19B5A5 with small star stickers. BODY PROPORTIONS: the jacket is almost a perfect circle; the head is about one third of her height. Match the attached reference image exactly. Background color: solid flat pure magenta #FF00FF.
```

Nomes sem acento de propósito: se o modelo escrever o nome na imagem por engano, o texto é mais fácil de achar e apagar.

### 4.8 BLOCO C das folhas (iguais para todos; muda só `[ASSINATURA]` e `[GESTO]`)

**Folha 1 — descida (M1)**
```
SHEET 1 — RIDING.
Row 1: (1) riding: knees softly bent, arms slightly out for balance, relaxed face, (2) speed tuck: crouched very low, knees deeply bent, chest close to the knees, arms tucked in front, determined face; the figure is only about 60% as tall as in cell 1, (3) ready to jump: knees bent deep, arms swung back, focused face, (4) taking off: legs pushing straight, arms swinging up, the back of the board just leaving the baseline.
Row 2: cells 1 and 2 are in the air, with a clear gap of plain background under the board; cells 3 and 4 are on the baseline: (1) neutral in the air: knees a little bent, arms out, happy face, (2) tucked for a flip: knees pulled tight to the chest, both hands holding the shins, a compact round shape with nothing sticking out, (3) landing: knees bent deep absorbing the impact, arms out wide, the board level on the baseline, (4) losing balance on the baseline: leaning back, arms windmilling, worried face.
Row 3: (1) tripping: pitching forward to the RIGHT over the front of the board, arms flung forward, shocked face, (2) tumbling in mid-air: curled sideways and upside down, the board above the body, (3) face-down: lying flat on the stomach on the baseline, head at the RIGHT end of the body, the board still on the feet and pointing up to the sky at the LEFT end, funny defeated face, (4) celebrating while riding: on the baseline, one fist raised high, big open-mouth grin.
```

**Folha 2 — manobras (M2)**
```
SHEET 2 — TRICKS.
Row 1: all four in the air, with a clear gap of plain background under the board: (1) grab UP: knees bent, the board pulled up high behind the back, the hand farther from the viewer holding the edge of the board behind, body arched, (2) grab DOWN: knees tucked, the hand nearest the viewer grabbing the board edge between the feet, happy face, (3) grab FRONT: the front leg stretched, the front hand grabbing the front tip of the board on the right, proud face, (4) grab BACK: the back leg stretched, the back hand reaching back to grab the rear tip of the board on the left, cheeky face.
Row 2: (1) balancing on a rail: on the baseline, the board level, arms spread wide, tongue out in concentration, nothing in the hands, (2) star jump in the air: arms and the free leg spread wide like a star, (3) scared in the air: arms and legs flailing, eyes wide, mouth open shouting, (4) [ASSINATURA].
Row 3: on the baseline: (1) riding, a second frame: same as a relaxed ride but arms a little higher and the head bobbing up, (2) speed tuck, a second frame: same very low tuck, head a little lower, (3) leaning back: weight on the back foot, body leaning to the LEFT, arms forward for balance, (4) leaning forward: weight on the front foot, body leaning to the RIGHT, knees pushed forward, eager face.
```

> **NOTA PARA O DONO (Apolo, 2026-10-22, curadoria da F2 da Capi; os blocos acima não foram alterados).**
> Na F1 a IA escreveu os nomes das poses como legenda (124 letras), apesar do "Absolutely NO text" do BLOCO A. Na F2
> **não saiu nenhum texto** (12 componentes, nenhum pequeno). O que mudou foi o lugar e a forma da proibição: o Atlas
> repetiu `no pose names, no captions, no labels under the figures` **dentro do BLOCO A, antes da lista de poses**, e
> não no fim do prompt, como a curadoria da F1 tinha sugerido. Lição: dizer o objeto exato que a IA tende a desenhar
> (nome de pose, legenda, rótulo sob a figura), e não só "no text", **antes** da lista numerada. Vale para a F3 e para
> todos os personagens. Outras lições da F2, com os prompts de reposição, em `docs/relatorio-curadoria-capi-f2.md` §6:
> não pedir para a mão da cuia agarrar a prancha (chamar de "the free hand, the one without the gourd cup"), não pedir
> perna livre com os dois pés presos, e descrever a inclinação para trás pela posição do chapéu em relação à bota.

`[ASSINATURA]` (é no ar; mesmo bloco de "gap under the board"):
- **CAPI:** `signature trick in the air: tucked and calm, eyes peacefully closed, sipping from the gourd cup with the silver straw, the other hand resting on his belly`
- **BANDEIRA:** `signature trick in the air: gliding, the huge tail raised and fanned out high behind her like a sail, arms spread wide, snout pointing RIGHT, delighted face`
- **CIDINHA:** `signature trick in the air: curled into a tight little ball hugging her knees, only the beanie, the knitting needles, the glasses and the board visible, a fierce happy face`
- **BRUNAO:** `signature trick in the air: a double-biceps bodybuilder pose, both arms raised and flexed, huge grin`
- **QUEQUE:** `signature trick in the air: gliding low, both wings spread wide, body stretched forward to the RIGHT, crest flat back, beak open shouting`
- **BIA:** `signature trick in the air: the jacket zipped all the way up so she is a perfect round ball, only the top of the helmet with the camera, the mittens and the board sticking out`

**Folha 3 — festa e telas (M3/M4)**
```
SHEET 3 — CELEBRATIONS AND SCREENS.
Row 1: (1) sitting on the baseline with the board in front, dizzy face with swirly eyes, head wobbling, no stars, (2) getting up: kneeling on the board, pushing up with both hands on the knees, (3) ready at the start: on the baseline, bouncing on the board, both fists up, excited face, (4) teasing: on the baseline, head turned back over the shoulder to the LEFT, cheeky grin, the hand nearest the viewer waving.
Row 2: (1) tucked for a flip, a second frame: even tighter, eyes squeezed shut, nothing sticking out, (2) opening up to land in the air: legs extending down, arms out, eyes open wide, (3) bursting through something soft in the air: eyes squeezed shut, cheeks puffed, arms up in front of the face, no snow drawn, (4) catching a prize in the air: one hand reaching up high, the other arm out, delighted face, nothing in the hand.
Row 3: this row only is a FRONT VIEW, the character facing the camera, standing on the baseline, OFF the board: (1) victory: holding the snowboard high above the head with both hands, shouting with joy, (2) victory catchphrase: [GESTO], (3) comic defeat: sitting on the snowboard, arms crossed, pouting, (4) character select pose: standing, the snowboard upright on its tail beside the character, one hand resting on top of it, confident smile.
```

`[GESTO]`: CAPI `raising the gourd cup in a toast, eyes closed, calm smile` · BANDEIRA `pushing her glasses up the snout with one finger, the other hand giving a thumbs up` · CIDINHA `shaking a tiny fist in the air, laughing` · BRUNAO `happy tears streaming, hugging the tiny snowboard` · QUEQUE `chest puffed out, wings on the hips, beak up, shouting` · BIA `pointing at the camera on her helmet with both hands, winking`.

### 4.9 Exemplo montado por inteiro (CAPI, folha 1)

Anexe **só** a mestra aprovada da Capi e cole na ordem: o **BLOCO A** (§4.5) inteiro, uma linha em branco, o bloco
**CHARACTER — CAPI BARBOSA** (§4.7), uma linha em branco, o **SHEET 1 — RIDING** (§4.8). Os três blocos são cópia exata;
nada entre colchetes na F1. (Na v1 o exemplo vinha transcrito; na v2 os três blocos são a fonte única, para não haver
duas cópias que divergem, como aconteceu entre `docs/prompts/` e `prompts-arte.md` no InnoFighters.)

### 4.10 Cenário de teste (Morro do Pinhão)

Na lateral, **céu, montanhas, floresta e terreno são código** (§2.1, plano da Nova §6.5). O que vem do gerador:

1. **Folha de objetos** (obrigatória): os sprites que o jogo põe sobre o terreno.
2. **Faixa de montanhas distantes** (recomendada): uma camada pintada no mesmo acabamento "3D" dos personagens, usada
   como camada real de parallax **ou** só como referência de cor e luz para a Lyra. É o teste mais barato do risco R3
   (personagem "3D" sobre cenário plano): se ela não combinar com a Capi, o cenário inteiro fica em código.

**Folha de objetos** — paisagem 4:3, 2K, sem imagem anexada:
```
Game object sprite sheet for a comic side-scrolling snowboarding video game. Stylized 3D animated family-movie look, smooth CG render, soft warm key light from the upper left. Landscape image, aspect ratio 4:3.
Exactly 12 separate objects in an invisible grid of 4 columns and 3 rows, one object centered in each cell, each object only about 70% of the height of its row and 75% of the width of its column, with an empty band of plain background at least 8% of the image height between rows and along every edge. No object touches another object or the border. Every object is seen straight from the side, like in a side-scrolling game, and stands on the same invisible baseline at the bottom of its row. Snow resting on top of an object is part of the object.
Background: one single flat solid pure magenta #FF00FF filling the whole image. No ground, no snow surface, no ground line, no shadows, no gradient.
NO text, letters, numbers, logos, labels, grid lines, borders, frames or effects.
Row 1: (1) a tall araucaria pine tree with a flat umbrella-shaped crown carrying snow, (2) a snowy conical fir tree, (3) a small round gray rock with a cap of snow, (4) a big gray rock with snow on top.
Row 2: (1) a fallen log lying horizontally with snow on top, (2) a snow ramp: a smooth wedge of packed snow rising from left to right, (3) a rustic wooden fence rail on two short posts, long and horizontal, for sliding on, (4) a snowman made of three snowballs with a small tin bucket as a hat, two dark pebble eyes, a pine-nut nose, a smile of pebbles and no arms.
Row 3: (1) a checkpoint flag: a red pennant on a thin pole, (2) a finish arch made of two wooden poles and a checkered black-and-white banner with no words, (3) a big shiny ice-blue snowflake crystal, a collectible toy-like object, (4) a wooden trail sign on a post showing only a simple picture of a capybara sliding, no words.
```
Fundo magenta porque o verde das árvores seria apagado no verde.

**Faixa de montanhas distantes** — paisagem 16:9, 2K, sem imagem anexada:
```
A wide side-view layer of distant snowy mountains for the parallax background of a side-scrolling snowboarding video game. Stylized 3D animated family-movie look, soft warm morning light from the left, soft atmospheric haze, simple appealing rounded shapes. Landscape image, aspect ratio 16:9.
One continuous range of rounded snowy mountains seen straight from the side, filling the lower 60% of the image, with a few small dark-green araucaria pine silhouettes on the lower slopes. The mountains continue past the bottom edge of the image. The left and right ends of the range are at about the same height so the layer can repeat sideways.
Everything above the mountains is one single flat solid pure green #00FF00: no sky, no clouds, no sun, no gradient.
NO text, logos, people, animals, buildings or effects.
```
Fundo verde porque as montanhas são azul-claro, branco e lavanda (o lavanda colide com o magenta). A emenda lateral
quase nunca sai perfeita do gerador: a Lyra fecha por código (espelho com mistura nas pontas).

### 4.11 Prompts de correção (anexar a imagem com defeito, um defeito por vez)

| Defeito | Prompt |
|---|---|
| Neve, chão ou sombra sob a prancha | `Edit this image: remove all snow, ground, ground lines and shadows under the figures. Fill those areas with the flat [COR] background. Do not change the figures.` |
| Spray, traços de velocidade, estrelinhas | `Edit this image: remove every visual effect (snow spray, powder, snowflakes, speed lines, motion trails, stars, sparkles). Fill those areas with the flat [COR] background. Keep the poses and the character exactly the same.` |
| Prancha torta num quadro de chão | `Edit this image: in row [R], column [C], make the snowboard perfectly horizontal and level on the baseline. Do not change the character.` |
| Texto, números, moldura | `Edit this image: remove all text, numbers, labels, grid lines, borders and frames. Keep everything else exactly the same.` |
| Prancha mudou de cor ou desenho | `Edit this image: in row [R], column [C], the snowboard must be exactly like the attached reference: [descreva]. Do not change the pose.` |
| Figuras grandes demais ou cortadas | `Generate again with more spacing. IMPORTANT SPACING: each figure, snowboard included, is only about 70% of the height of its row and 75% of the width of its column, with an empty band of plain background at least 8% of the image height between rows and along every edge. Nothing touches the border.` |
| Virou 2D/anime ou foto | `Keep exactly the same stylized 3D animated family-movie CG look as the attached reference image. Not 2D, not anime, not a photo.` |
| Agachado saiu em pé | não corrigir por edição: levar a célula para a folha de reposição (reserva R1) |

### 4.12 Checklist de aceite da folha

- [ ] 12 componentes conexos (contagem menor = linha de chão, neve ou figura encostando; recortar os 2 px de ruído da última linha antes).
- [ ] Faixa vazia entre fileiras, colunas e bordas; nenhuma ponta de prancha, orelha, cauda ou pompom cortado.
- [ ] Fundo de uma cor só; nenhuma neve, sombra, spray, traço ou estrela.
- [ ] Vista lateral, para a **direita**, corpo de frente para a tela, em todas as células menos a fileira 3 da F3.
- [ ] Prancha **horizontal** e na linha de base em todo quadro de chão; nada abaixo da base da prancha.
- [ ] Quadros `flip*` compactos (razão largura/altura da caixa entre 0,8 e 1,25), nada esticado para fora.
- [ ] `tuck0`/`ride0` ≤ 0,70 de altura; `fall2` com a cabeça à direita (se não, espelhar por código).
- [ ] Mesmo rosto, roupa e **mesma prancha** em todas as células (a IA troca a prancha dentro da folha).
- [ ] Nenhuma célula é eco da mestra (`difcruz` contra a mestra maior que `ride0` × `ride1`).
- [ ] Mãos com dedos certos (asas do Quequé: penas-dedos), nenhum membro a mais.

### 4.13 Orçamento de créditos (conta grátis, ~68 créditos; Nano Banana 2.1 a 2K = 6 por imagem)

Primeiro personagem: **a capivara** (Capi Barbosa ou KAKÁ, conforme o nome escolhido em D3; ficha da §3.2).

| Ordem | Imagem | Formato | Créditos | Acumulado | Portão |
|---|---|---|---|---|---|
| 1 | Mestra da capivara (4 vistas) | 4:3 2K | 6 | 6 | **mostrar ao dono e esperar OK** |
| 2 | F1 descida (anexa a mestra) | 4:3 2K | 6 | 12 | **mostrar ao dono e esperar OK** |
| 3 | F2 manobras | 4:3 2K | 6 | 18 | curadoria |
| 4 | F3 festa e telas (adiável, ver D7) | 4:3 2K | 6 | 24 | curadoria |
| 5 | Objetos do Morro do Pinhão | 4:3 2K | 6 | 30 | curadoria |
| 6 | Faixa de montanhas distantes | 16:9 2K | 6 | **36 (plano)** | dono compara com a Capi (R3) |
| R1 | Reserva: segunda mestra **ou** folha de reposição com os defeitos de F1 a F3 juntos | 4:3 2K | 6 | 42 | |
| R2 | Reserva: uma folha que falhar no aceite | 4:3 2K | 6 | 48 | |
| R3 | Reserva do cenário | 2K | 6 | **54 (teto)** | |

- **Plano 36, teto 54; sobram pelo menos 14** (2 gerações) que **não** devem ser gastos neste lote.
- Ordem: mestra → dono → F1 → OK → F2 e F3 → cenário. Se a F3 for adiada, o plano cai para 30 e a sobra sobe para 20.
- Depois de 2 falhas na mesma célula, aceitar e ajustar no jogo (lição do BAATAR).
- **Divergência com a Nova (§6.3 e §6.4 dela): ela orça a mestra em 1K (4 créditos).** Recomendo 2K: a mestra é a
  referência de todas as folhas, e referência em baixa resolução empobrece o rosto e a prancha nas 36 poses. Diferença: 2 créditos.
- Conferir o saldo antes de cada imagem, informar ao dono a cada lote e parar antes de zerar.

### 4.14 Arquivos e pastas (tudo em `arte-fonte/`, fora do git)

- `arte-fonte/personagens/<id>/modelo/<id>-mestra-v1.png`
- `arte-fonte/personagens/<id>/folhas/<id>-f1-descida-v1.png`, `<id>-f2-manobras-v1.png`, `<id>-f3-festa-v1.png`
- `arte-fonte/objetos/morro-do-pinhao/objetos-v1.png`, `montanhas-distantes-v1.png`
- Versão nova nunca sobrescreve a anterior (`-v2`, `-v3`). Pastas no padrão da §5 do plano da Nova.

---

## 5. UI e HUD premium (paisagem, descida solo)

### 5.1 Linguagem (herdada do InnoFighters)

- **Três vozes tipográficas:** Barlow Condensed 800 itálico (números e rótulos), Barlow 600 (menus), **Bangers**
  (callouts e balões, caixa alta, +1 px). A fonte do título só no logo (§1.4).
- **Material:** miolo opaco `--nm-tinta` a 90%, filete `--nm-neve` de 2 px por dentro, contorno `--nm-tinta` por fora (o
  par fio claro + contorno que segurou ≥ 3:1 sobre qualquer cenário no InnoFighters). Na neve, painel translúcido some:
  **todo painel do HUD é opaco**.
- **Cor = função:** PULAR `--nm-sol`; GIRO e GRAB `--nm-chiclete`; AGACHAR `--nm-gelo`; pausa `--nm-aco`.
- Cantos chanfrados de 6 px, inclinação de 8° nos selos (a geometria do logo). Números com algarismos tabulares
  (recurso `tnum`; conferir na Barlow ao embarcar).

### 5.2 Grade e áreas seguras

Base lógica 960×540. No celular de referência 844×390 com letterbox, a escala é 390/540 = **0,722**: o jogo ocupa
693×390 CSS e sobram **75 px de faixa preta de cada lado**, mais que os 47 px do entalhe (aritmética, a confirmar no
aparelho). Ou seja: **com letterbox, o entalhe cai na faixa preta e o HUD dentro do canvas fica livre dele.** Se a
Lyra trocar o letterbox por "preencher a tela", o HUD passa a respeitar `env(safe-area-inset-left/right)` e uma margem
lógica de 56 px nas laterais.

Tamanhos convertidos (lógico → CSS no 844×390): 34 px → 24,5; 30 → 21,7; 28 → 20,2; 24 → 17,3 (o mesmo corpo do balão
aprovado no InnoFighters); 16 → 11,6 (mínimo para rótulo; nada de texto abaixo disso). Alvo de toque mínimo: 62 px
lógicos (= 44 px CSS).

O personagem fica por volta de 30 a 40% da largura (a câmera olha à frente) e entre 45% e 80% da altura. **Nada do HUD
entra no retângulo à frente dele** (40% a 100% da largura, 35% a 85% da altura): é por onde vêm rampa, vão e pedra.

| Zona (lógica) | Elemento |
|---|---|
| topo-esquerda (x 16, y 14) | barra de progresso da pista com bandeirinhas de checkpoint e a chegada |
| topo-centro | pausa (botão pequeno, 62 px). **Diverge do plano da Nova ("II no canto")**: no InnoFighters o canto superior colidiu com o entalhe; com letterbox o risco cai, mas o centro funciona com e sem letterbox |
| topo-direita (x 944, y 14, alinhado à direita) | pontos |
| centro-alto, faixa de 14% a 32% da altura | callout da manobra e combo |
| junto ao personagem, acima da cabeça | contador de voltas (só durante o mortal) |
| base-esquerda (x 16, y 524) | velocímetro |

### 5.3 Velocímetro — "Arco de Gelo"
Arco de 220° com 12 segmentos chanfrados, 96 px lógicos. Segmentos em `--nm-gelo` até 60% do teto do personagem,
`--nm-sol` de 60% a 90% e `--nm-chiclete` acima. Número em Barlow Condensed 800 itálico 34 px `--nm-neve`, "km/h" em
Barlow 600 16 px `--nm-aco`. Acima de 90%: estado **MALUCO** (rachaduras desenhadas na borda e tremor de 1 px; sem
tremor com movimento reduzido). Lê `piloto.velocidade` do C3.

### 5.4 Pontos e progresso
Pontos em Barlow Condensed 800 itálico 28 px `--nm-neve` sobre placa `--nm-tinta`, contando (não salta). Ganho recente
em `--nm-sol` 24 px ("+1.250") acima, subindo 12 px enquanto some. Progresso: trilho fino `--nm-aco` com a bolinha do
personagem na cor dominante dele, bandeirinhas nos `checkpoints` e o pórtico na `chegadaX` (C5).

### 5.5 Contador de voltas (mortal)
Durante `giro`, um anel de 36 px acima da cabeça do personagem enche em `--nm-chiclete` a cada 360° de
`anguloAcumulado`; ao fechar a volta, o número salta ao lado em Bangers 30 px (**"1!"**, **"2!"**, **"3!"**), escala 1,3 → 1
em 150 ms. Meia volta não conta (regra da Nova), então o anel só mostra número na volta completa. Se o pouso vier torto,
o anel fica `--nm-aco` e some.

### 5.6 Combo
Selo "x3" em Bangers 40 px `--nm-sol` com contorno `--nm-tinta` e aro `--nm-neve`; embaixo, as manobras do combo
unidas por "+" em Barlow Condensed 800 itálico 16 px; embaixo, barra da `janela` em `--nm-gelo` que esvazia. Combo
fechado (`combo-fechado`): o selo pulsa 1,25 → 1 em 180 ms e o total voa até os pontos. Combo perdido
(`combo-perdido`): o selo fica `--nm-aco`, racha e some em 300 ms, com "ESTABACOU!" em `--nm-sinal`.

### 5.7 Callout de manobra (voz do Juiz Apito, se ele entrar)
Tarja inclinada 8° (a "Tarja de Impacto" do InnoFighters), nome da manobra em Bangers 30 px caixa alta, texto sempre
`--nm-tinta`. Cor da tarja pela qualidade do pouso (C3 `pouso.qualidade`): **perfeito** `--nm-menta` ("CRAVOU!") ·
**bom** `--nm-sol` ("BOA!") · **torto** `--nm-gelo` ("QUASE!") · tombo `--nm-sinal` com texto `--nm-neve` ("ESTABACOU!").
Nomes de exemplo: "MORTAL DUPLO", "RODA DE CHIMARRÃO", "GRAB NO BICO + MORTAL" (os nomes finais saem do `data/textos.pt-BR.ts`).

### 5.8 Entrada: gestos como padrão, botões em Opções (D10 da Nova)
**Gestos (padrão):** tocar = pular; segurar a metade esquerda/direita no ar = mortal para trás/para frente; deslizar no
ar = grab (4 direções). O HUD não desenha botões nesse modo, só **retorno visual**:
- toque: anel `--nm-sol` de 40 px que abre e some em 200 ms no ponto do dedo;
- segurar: a borda daquele lado da tela ganha uma faixa vertical `--nm-chiclete` de 6 px com a seta ↺ ou ↻;
- deslizar: um traço curto `--nm-chiclete` seguindo o dedo e o nome do grab na tarja;
- **nas 2 primeiras descidas**, dicas fantasmas (mão desenhada, 60% de opacidade) mostram cada gesto uma vez.

**Botões (acessibilidade, em Opções):** à direita, PULAR 88 px `--nm-sol`; acima dele, a cruz de GRAB (4 botões de
62 px, `--nm-chiclete`, com seta). À esquerda, GIRO ↺ e GIRO ↻ (76 px, `--nm-chiclete`) e AGACHAR (62 px, `--nm-gelo`).
Ícone desenhado **e** rótulo curto em Barlow Condensed 800 itálico na plaquinha `--nm-tinta`; nunca só cor. Opacidade
0,9 e o par fio claro + contorno, como no InnoFighters. Opção "mão esquerda" espelha os lados (C4 `maoEsquerda`).
**PC:** Espaço/↑ pular, ← → mortal, Z X C V grabs, ↓ agachar, Esc/P pausa; a dica de tecla usa a mesma plaquinha.

### 5.9 Balões
Reaproveitar a **Tarja de Impacto** (Bangers 24, caixa alta, +1 px, sombra e brilho por dentro da caixa), com uma
diferença obrigatória: **painel `--nm-tinta` com texto `--nm-neve` (17,24:1)**, porque balão claro some na neve. A ênfase
(última palavra) muda só a cor, para a cor dominante do personagem. No máximo **1 balão, 1,6 s**, ancorado **atrás** do
personagem (à esquerda e acima dele), nunca no retângulo à frente (§5.2). As falas são "blablablá" sintetizado (plano da
Nova); o balão mostra o bordão ou a provocação em texto.

### 5.10 Telas
- **Título:** montanhas da pista 1 em parallax lento, logo no terço superior, a capivara descendo em loop, "Desce rindo." em Barlow 600.
- **Seleção:** cartões com a pose `select`; bloqueados aparecem **só em silhueta preta** (o teste dos 64 px vira mecânica);
  prancha da vez e os 5 atributos do `DefPersonagem` (velocidade, aceleração, giro, equilíbrio, pulo).
- **Resultado:** pódio cômico, `win0`/`win1` para recorde, `lose` quando não bate o próprio fantasma, pontos rolando, "DE NOVO" em 1 toque.

---

## 6. Originalidade: o que evitar

- **Fora do elenco:** pinguim, urso-polar, abominável/iéti, mamute, preguiça, tigre-dentes-de-sabre, rena, esquilo com
  bolota, lhama, bode, panda, raposa, coelho, arara, tucano, caracol, tatu-bola (já foi mascote oficial de Copa).
- **Boneco de neve** (o plano da Nova usa um como obstáculo): permitido como objeto genérico de três bolas, **sem nariz
  de cenoura, sem braços de galho, sem dentes, sem fala, sem nome**. Ele é obstáculo, nunca personagem.
- **Avó:** óculos retangulares, nenhum corte chanel: evita a estilista famosa de uma animação.
- **Avalanche** sem olhos nem boca.
- **Pistas:** nenhum castelo de gelo, nenhum reino congelado com princesa.
- **Prompts:** nunca citar estúdio, filme ou personagem. Também não citar jogos de referência (o plano cita um jogo
  lateral famoso como família de gênero; isso é para a equipe, nunca para o prompt).

---

## 7. Decisões para o dono (alinhadas à câmera lateral)

| # | Decisão | Opções | Recomendação do Apolo |
|---|---|---|---|
| 1 | **Elenco (D3 da Nova)** — há dois elencos propostos | Apolo: Capi Barbosa, Prof. Bandeira, Vó Cidinha, Brunão, Quequé, Bia Bolota · Nova: KAKÁ (capivara), TIO BETO, VOVÓ TURBINA, MADAME FONDUE, FRIGOBOT, ZECA | Os 4 do M3: **capivara** (mascote do M1 nos dois planos; nome à escolha: Capi Barbosa ou KAKÁ), **a avó** (ficha da Vó Cidinha, nome à escolha), **TIO BETO** (da Nova: o brasileiro de bermuda vendo neve pela primeira vez é a piada mais forte do conjunto) e **Bia Bolota** (criança, silhueta de círculo). Fichas novas do Tio Beto ficam comigo depois da escolha |
| 2 | Direção do logo | A, B ou C (§1.4) | **A**, com os símbolos de pista da B |
| 3 | Tagline | "Desce rindo." / "Ladeira abaixo, juízo nenhum." / "A montanha mais doida do mundo." | **"Desce rindo."** |
| 4 | Mascote Juiz Apito (locutor, não jogável) | agora / depois / não | **depois do M2** (custa 6 créditos) |
| 5 | Resolução da mestra | 2K (6 créditos, Apolo) / 1K (4 créditos, Nova) | **2K** |
| 6 | Fundo de recorte | por personagem, verde ou magenta conforme o traje (Apolo, provado no InnoFighters) / magenta para todos com rosa e magenta proibidos no traje (Nova) | **por personagem**: com magenta para todos, Brunão (prancha rosa) e a avó (gorro rosa) teriam de mudar de cor |
| 7 | F3 (festa e telas) neste lote | gerar agora (plano 36) / adiar para o M3 (plano 30, sobra 20) | **adiar** se o dono quiser mais um personagem no M3 sem plano pago |
| 8 | Pausa | topo-centro (Apolo) / canto (Nova) | **topo-centro**: funciona com e sem letterbox |

Nada aqui gasta crédito. A ordem de geração (§4.13) só começa depois do OK do dono no item 1 (quem é a capivara) e no item 5.
