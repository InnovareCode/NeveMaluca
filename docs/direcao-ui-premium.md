# NEVE MALUCA — direção de UI premium (telas fora da corrida)

Autor: Apolo (direção de arte) · 2026-10-24 · para a Lyra implementar em Canvas 2D **por código**.

**Restrição de orçamento:** não há geração de imagem nova (sobram 2 créditos, guardados). Tudo neste guia sai de
código + assets que JÁ existem: `public/assets/menu/capa.webp` (1920x1072), `logo.webp` (818x433),
`public/assets/personagens/<id>/recortes/<id>-<pose>.png` (cerca de 170 a 200 px de altura), `public/assets/itens/*.webp`
(256x256) e `public/assets/cenarios/<pista>/fundo.webp` + `silhuetas.webp` (1920x1080).

**Referência de qualidade:** a capa. A régua para aprovar qualquer tela: colocada ao lado da capa, ela parece do mesmo
jogo (cor saturada, luz de aurora, volume, brilho, nada chapado).

**Relação com outros docs:** os tokens de cor vêm de `docs/direcao-arte-neve-maluca.md` §1.5 (não mudam). Este guia
acrescenta materiais (vidro, neve, botão 3D), movimento e layout.

---

## 0. Diagnóstico: por que as telas não estão no nível da capa

Olhando `menu-desktop.png` (bom) contra `selecao-polish-desktop.png` e o código de `src/ui/cenas/`:

| # | Problema | Onde | Efeito |
|---|---|---|---|
| D1 | Fundo chapado `#0b1a33` | `resultado.ts`, `podio.ts` | tela de "programa", não de jogo |
| D2 | Véu de 72% sobre a capa borrada | `selecao.ts` | a aurora vira lama azul-acinzentada; perde a saturação que faz a capa ser a capa |
| D3 | Painel azul opaco (`#162b47`) + borda fina | opções, pausa, seleção de pista, oficina | caixa de formulário, sem material |
| D4 | Sprite ampliado 2,2x (192 lógicos = 384 px de buffer a partir de ~175 px) | palco da seleção | personagem mole/borrado, justo o herói da tela |
| D5 | Cartões com sprite minúsculo e 60% de espaço vazio | fileira da seleção, seleção de pista | parece placeholder |
| D6 | Pesos de fonte que não estão embarcados (`700 Barlow`, `italic 900`) | pódio, resultado, final, abertura | o navegador **sintetiza** o negrito: letra borrada e diferente por aparelho |
| D7 | Nenhuma animação de entrada; troca de tela é corte seco | `gerenciador.ts → trocar()` | nada "nasce", nada comemora |
| D8 | Botão sem estado pressionado nem volume | `desenho.ts` | não dá vontade de apertar |
| D9 | Texto de desenvolvedor na tela ("Todos liberados por enquanto", "Base 90-110") e emoji `❄` em texto | seleção, oficina | quebra a ilusão; emoji muda de cara por sistema |

O menu principal funciona porque é **a capa inteira, viva** (Ken Burns, flocos, logo respirando). A regra deste guia é
estender isso: **toda tela fora da corrida é uma cena iluminada com a arte que já temos, nunca uma caixa sobre fundo
escuro.**

---

## 1. Regras técnicas que este guia respeita (não negociáveis)

1. Coordenadas lógicas 960x540; buffer 1920x1080 (`RS = 2`). Todas as medidas abaixo são **lógicas**.
2. **Nada de `shadowBlur` nem `filter` por quadro.** Desfoque, sombra macia e vidro fosco são feitos UMA vez num canvas
   fora da tela (`criarCamadaEstatica`/`criarCamadaTransparente`) e depois são só `drawImage`.
3. **Desfoque sem `ctx.filter`:** reduzir a imagem para um canvas pequeno e ampliar de volta com
   `imageSmoothingQuality = 'high'` (receita em §3.1). O `selecao.ts` usa `ctx.filter = 'blur(10px)'` hoje; esse caminho
   não tem suporte garantido no WebKit do iPhone (não testei no aparelho; ver PENDÊNCIAS). O caminho por redução
   funciona em qualquer motor e sai mais barato.
4. Sem `Math.random` em `src/`: confete, brilhos e gotas de neve usam hash determinístico do índice (como
   `desenharFlocos`).
5. Sem `roundRect`: usar `caminhoArredondado`.
6. Relógio = ticks de 60 Hz. Toda duração em ms deste guia tem o equivalente em ticks (1 tick = 16,7 ms) na tabela §8.3.
7. **Teto de ampliação de sprite: 1,6x do tamanho nativo no buffer.** Com recortes de ~175 a 200 px, o personagem tem
   no máximo **~150 lógicos de altura** (300 px de buffer). Acima disso, use **retrato recortado da capa** (§6.2).
8. Fontes: só os três rostos embarcados (§5). Proibido `700`/`900`.
9. Toque: alvo mínimo 48 lógicos de altura. Texto: mínimo 14 lógicos (o iPhone em paisagem mostra 960 lógicos em
   ~844 pt).
10. Margem segura: 32 lógicos nas laterais (entalhe do iPhone), 20 em cima e embaixo.

---

## 2. Paleta e gradientes

### 2.1 Tokens (iguais a `direcao-arte` §1.5)

`tinta #0B1630` · `neve #F7FBFF` · `neve-sombra #DCEBF7` · `gelo #9FE3FF` · `glaciar #1659B8` · `tangerina #FF8A1F` ·
`sol #FFD23F` · `chiclete #FF5C8A` · `menta #3DDC97` · `sinal #C7301C` · `uva #5B3FE0` · `aço #B8C4DA`.

Regra de contraste herdada: texto branco sobre laranja/amarelo **só com contorno `tinta` de 4 px ou mais**
(é o que o botão CORRER! já faz e o que faz o logo funcionar). Sem contorno, texto `tinta`.

### 2.2 Cores novas, só de UI (derivadas da capa)

| Token | Valor | Uso |
|---|---|---|
| `aurora-ciano` | `#35E0FF` | luz de aurora, aro de luz do personagem, halo |
| `aurora-magenta` | `#C04CFF` | segunda luz de aurora (o roxo da capa) |
| `noite-profunda` | `#060E24` | véus e vinheta |
| `ouro-escuro` | `#B4560F` | extrusão de letreiro ouro, aro de moeda |
| `prata` | `#DCE6F2` → `#9AA9C2` | 2º lugar |
| `bronze` | `#FFE0C2` → `#B5652A` | 3º lugar |

### 2.3 Receitas de gradiente (paradas exatas)

| Nome | Tipo | Paradas |
|---|---|---|
| **Face gelo** (letreiro padrão) | linear vertical | 0 `#FFFFFF` · 0,45 `#D8F3FF` · 1 `#7FD0FF` |
| **Face ouro** (vitória) | linear vertical | 0 `#FFF8D6` · 0,5 `#FFD23F` · 1 `#FF9A1F` |
| **Face marca** (= MALUCA do logo) | linear vertical | 0 `#FFD36B` · 0,55 `#FF8A1F` · 1 `#F2611A` |
| **Face prata** | linear vertical | 0 `#FFFFFF` · 0,5 `#DCE6F2` · 1 `#9AA9C2` |
| **Face bronze** | linear vertical | 0 `#FFE0C2` · 0,5 `#E39A5B` · 1 `#B5652A` |
| **Neve** (tampas, pedestais) | linear vertical | 0 `#FFFFFF` · 0,6 `#E6F4FF` · 1 `#B9DDF5` |
| **Gelo sólido** (blocos do pódio) | linear vertical | 0 `#E9F7FF` · 0,25 `#9FE3FF` · 1 `#2A7DE1` |
| **Halo** | radial | 0 `rgba(255,255,255,a)` · 1 `rgba(255,255,255,0)`; para ouro, `rgba(255,210,63,a)` |
| **Vinheta** | radial, centro (480,270), r0 200, r1 620 | 0 transparente · 1 `rgba(6,14,36,0.55)` |

---

## 3. Fundos (a tela nunca começa num retângulo escuro)

### 3.1 Fundo A, "capa fosca" (seleção de personagem, opções, fallback geral)

1. Reduzir `capa.webp` para um canvas de **120x67** (1/16) e ampliar para 960x540 com `imageSmoothingEnabled = true` e
   `imageSmoothingQuality = 'high'`. Para um bokeh mais liso, duas etapas: 1920→240→120 e depois ampliar.
2. Véu vertical: 0 `rgba(6,14,36,0.30)` → 1 `rgba(6,14,36,0.55)`. **Não passar de 0,55** (o problema D2 era 0,72).
3. Vinheta (§2.3).
4. Tudo isso numa `CamadaEstatica` **compartilhada** entre telas (construir uma vez por sessão, depois que
   `assetsMenuCapaProntos` estiver ok).

### 3.2 Fundo B, "pista fosca" (pódio, classificação, oficina, final, seleção de pista, resultado)

Mesma receita sobre `cenarios/<pista>/fundo.webp`, porém com redução menor (1/8, 240x135), para a pista continuar
reconhecível, e véu de 0,25 a 0,45. Opcional e barato: desenhar `silhuetas.webp` por cima, reduzida 1/4 e com alpha 0,5
(dá a profundidade das camadas da pista). Uma camada por pista, em cache preguiçoso (até 5).

### 3.3 Fundo C, "corrida congelada" (pausa)

Na abertura da pausa: copiar o canvas principal para um canvas fora da tela, aplicar a mesma redução (1/10) e ampliar
de volta. É feito **uma vez** por pausa, porque a corrida por baixo não se mexe. Véu `rgba(5,12,26,0.45)` por cima.

### 3.4 Camadas vivas por cima do fundo (por quadro, baratas)

Ordem de desenho (de trás para a frente):

1. fundo em cache;
2. **aurora viva**: dois gradientes radiais grandes, `aurora-ciano` com alpha 0,14 (raio 420) e `aurora-magenta` com
   alpha 0,10 (raio 360). Os centros andam em Lissajous: ciano (300 + 60·sen(t·2π/14 s), 140 + 40·sen(t·2π/9 s)),
   magenta (700 + 70·sen(t·2π/19 s), 120 + 30·sen(t·2π/11 s)). Pintar com `globalCompositeOperation = 'lighter'`;
3. **flocos de fundo**: `desenharFlocos(ctx, 22, t, 0.7)` com alpha 0,55;
4. painéis e conteúdo;
5. **flocos de frente**: `desenharFlocos(ctx, 6, t·1.6, 2.2)` com alpha 0,9 (poucos, grandes e rápidos: dão
   profundidade);
6. **brilhos**: 8 estrelinhas de 4 pontas (§7.4) que piscam com período de 1200 ms e fase por hash.

---

## 4. Materiais

### 4.1 Painel Geada (substitui todo painel azul opaco)

O painel é **vidro fosco escuro com uma tampa de neve escorrendo no topo**, como as letras do logo. Todo ele é
desenhado UMA vez num canvas fora da tela, do tamanho do painel mais 24 px de folga, e depois vira só `drawImage`.

Camadas, de baixo para cima (raio **22**):

1. **Sombra dupla falsa** (sem blur): retângulo arredondado deslocado (0, +10), `rgba(3,8,24,0.40)`; outro deslocado
   (0, +18), raio 28, `rgba(3,8,24,0.18)`.
2. **Fosco:** recortar (`clip`) no caminho do painel e desenhar o fundo da tela reduzido a **1/24** (mais borrado que o
   resto). O vidro "borra o que está atrás".
3. **Base escura:** `rgba(10,24,60,0.58)`. É ela que garante contraste maior que 7:1 para texto branco. O vidro é
   **fosco escuro**, não transparente.
4. **Tinta de cor:** linear vertical 0 `rgba(140,210,255,0.22)` · 0,35 `rgba(80,140,230,0.10)` ·
   1 `rgba(20,30,90,0.20)`.
5. **Reflexos diagonais:** duas faixas (paralelogramos a 20°) no canto superior esquerdo, larguras 40 e 14, cor
   `rgba(255,255,255,0.06)`.
6. **Aro interno:** contorno de 1,5 px a 2 px para dentro, gradiente vertical `rgba(255,255,255,0.55)` →
   `rgba(255,255,255,0.05)` (luz batendo na quina de cima).
7. **Aro externo:** 2,5 px `#0B1630` com alpha 0,85.
8. **Tampa de neve** (§4.2).

Variantes:

- **Painel Geada Ouro** (vencedor, pódio, linha do jogador): aro interno troca para `rgba(255,210,63,0.8)` e tinta de
  cor 0 `rgba(255,210,63,0.18)` → 1 `rgba(180,86,15,0.12)`.
- **Cartão** (selecionável): raio 16, sem tampa quando parado e com tampa pequena (altura 8) quando selecionado.
- **Pílula** (etiquetas, contador de flocos, nome da pista): raio = altura/2, sem tampa, base escura 0,65.

### 4.2 Tampa de neve escorrendo (a assinatura visual)

Copia o tratamento das letras do logo: neve fofa por cima, gotas/pingentes descendo, contorno escuro.

Geometria, para um painel `(x, y, w)`:

- **Saliência:** a tampa passa 4 px para fora de cada lado (`x−4` até `x+w+4`).
- **Borda de cima, fofa:** sequência de arcos (montinhos) de raio 10 a 16 (hash do índice) apoiados em `y−6`. Nunca
  uma linha reta.
- **Base da tampa:** em `y+10`, com **gotas** a cada 34 a 58 px (hash). Cada gota tem largura 14 a 22 e comprimento 6 a
  18, termina em semicírculo e se liga à base por duas curvas quadráticas (formato de gota, não de retângulo). A cada
  3 ou 4 gotas, uma é longa (22 a 28): é o "pingente" que dá o charme.
- **Preenchimento:** gradiente *Neve* (§2.3).
- **Sombra de baixo:** contorno de 2 px `#8EC3E8` com alpha 0,8, só na borda de baixo (dá o volume).
- **Contorno:** 2,5 px `#0B1630` na tampa inteira, como o logo.
- **Brilhos:** de 3 a 5 elipses brancas (6–10 x 2–3) no alto dos montinhos, mais 1 ou 2 estrelinhas (§7.4) que piscam.

Em botões principais e cartões selecionados, a mesma receita em escala menor: base em `y+6`, gotas de 4 a 10, a cada 26
a 40 px.

### 4.3 Botão 3D "bala gelada" (substitui `desenharBotao` e `desenharBotaoBala`)

Um único componente. Anatomia, de baixo para cima (raio = h/2):

1. **Sombra:** cápsula deslocada (0, +8), `rgba(3,8,24,0.40)`.
2. **Lábio (extrusão):** cápsula deslocada (0, +6) na cor `lábio`. É o que faz o botão parecer uma peça física.
3. **Face:** gradiente vertical de 3 paradas (topo / meio a 0,5 / base).
4. **Brilho de cima:** elipse recortada na face, centro (cx, y + h·0,22), raios (w·0,46, h·0,40), branco com alpha 0,35.
5. **Luz de baixo:** linha de 2 px a 3 px acima da base da face, `rgba(255,255,255,0.25)` (luz rebatida, típico da capa).
6. **Contorno:** 3 px `#0B1630`.
7. **Texto:** Barlow Condensed 800 itálico; sombra do texto em `tinta` deslocada (0, +2); contorno de 5 px `tinta`;
   preenchimento `#FFFFFF`.
8. **Só no botão primário:** tampa de neve pequena (§4.2) e o brilho que atravessa (§8.6).

Cores:

| Tipo | Topo | Meio | Base | Lábio | Uso |
|---|---|---|---|---|---|
| **Primário** (tangerina) | `#FFE27A` | `#FFB020` | `#F07A12` | `#B4500C` | uma ação por tela: CORRER!, CONTINUAR, DE NOVO!, COMPRAR |
| **Secundário** (glaciar) | `#7CC4FF` | `#2A7DE1` | `#1450A0` | `#0C3270` | MENU, VOLTAR, CONFIGURAÇÕES |
| **Perigo** (sinal) | `#FF7A66` | `#E0432C` | `#B0281A` | `#7A160E` | SIM, SAIR |
| **Confirmar** (menta) | `#9BF5C8` | `#3DDC97` | `#1F9E66` | `#126B44` | interruptor ligado, NÍVEL MÁXIMO (texto `tinta`) |
| **Desativado** | `#6B7682` | `#55606A` | `#2C343B` | `#1C2227` | sem brilho, sem neve, texto com alpha 0,6 |

Tamanhos: **CTA 300x64** (texto 28) · **padrão 240x54** (texto 24) · **compacto 180x48** (texto 21) ·
**redondo 56x56** (ícone desenhado em código: seta de voltar, engrenagem).

Estados (curvas e durações em §8):

| Estado | O que muda |
|---|---|
| Parado | como acima; o primário respira (§8.6) |
| Hover / foco | escala 1,04, brilho de cima a 0,50, aro externo branco 2 px por fora do contorno; 120 ms easeOutBack s=1,7 |
| Foco de teclado | anel `sol` de 3 px a 4 px da borda, alpha pulsando entre 0,6 e 1,0 em 900 ms |
| Pressionado | a face **desce 4 px sobre o lábio** (lábio visível vai de 6 para 2), escala (1,04 ; 0,92) com pivô na base; 80 ms easeOutCubic |
| Soltou (dispara) | volta com mola (§8.2) até (1,06 ; 1,06) e assenta em 1; 260 ms. **A ação dispara no soltar**, depois de 80 ms de mola, para o toque ser visto |
| Desativado tocado | treme no eixo x ±6 px, 3 oscilações, 300 ms; sem som de clique |

### 4.4 Outros componentes

- **Medalhão** (moldura de ícone e de posição): círculo com diâmetro 1,25x o ícone. Para ícone: vidro (base escura 0,6
  + aro interno). Para posição: 1º face ouro, 2º prata, 3º bronze, 4º a 6º vidro; número em Barlow Condensed 800
  itálico, contorno `tinta` 4.
- **Retrato circular:** recorte da capa (§6.2) com `clip` em círculo, aro 2,5 `tinta` e anel interno 1,5 `gelo` com
  alpha 0,7.
- **Barra de atributo:** trilho `rgba(4,10,30,0.55)` de altura 18, raio cheio, aro 1,5 `rgba(255,255,255,0.15)`.
  Preenchimento por atributo: Velocidade 0 `#FFE27A` → 1 `#FF8A1F`; Equilíbrio 0 `#9FE3FF` → 1 `#2A7DE1`; Força
  0 `#FF9BB8` → 1 `#FF5C8A`. Brilho branco 0,35 nos 40% de cima. Trecho de bônus de evolução: `sol` com listras
  diagonais `rgba(255,255,255,0.3)` de 6 px, deslizando 20 px/s.
- **Pedestal de gelo** (embaixo do personagem herói): elipse superior 260x46 com face *Neve*; faixa lateral de 14 px em
  gradiente `#5FB4E8` → `#1659B8`; contorno `tinta` 2,5; brilho elíptico branco 0,5 na frente.
- **Monte de neve** (resultado, final): 4 ou 5 elipses brancas sobrepostas (hash), face *Neve*, sombra azulada
  `#B9DDF5` na base e contorno `tinta` 2.
- **Interruptor:** trilho-pílula 92x44 (ligado: face *Confirmar*; desligado: vidro escuro). Botão redondo de 38 que é
  uma bola de neve: radial `#FFFFFF` → `#CFE6F7`, brilho no alto à esquerda, contorno `tinta` 2.
- **Etiqueta VOCÊ:** pílula `sol` com texto `tinta` (Barlow Condensed 800 itálico 15) e uma setinha para baixo,
  balançando ±3 px em 1400 ms.
- **Balão de fala** (bordão, comemorações): elipse ou retângulo arredondado branco, contorno `tinta` 3, rabicho
  apontando para o personagem, texto em Bangers `tinta`. Regras de callout valem: caixa alta, no máximo 22 caracteres.

---

## 5. Tipografia

Só três rostos estão embarcados (`public/assets/fontes/LEIA-ME.txt`). **Qualquer outro peso é sintetizado pelo
navegador** e fica borrado (D6).

| Papel | Fonte | Tamanho lógico | Tratamento |
|---|---|---|---|
| Letreiro display (CAMPEÃO!, 1º LUGAR!) | Barlow Condensed 800 itálico | 64 | Letreiro ouro (§5.1) |
| Título de tela | Barlow Condensed 800 itálico | 40–44 | Letreiro gelo |
| Nome de personagem / pista | Barlow Condensed 800 itálico | 32–40 | branco, contorno `tinta` 5 |
| Número grande (pontos, flocos) | Barlow Condensed 800 itálico | 48–64 | face ouro em letreiro, ou `sol` com contorno |
| Botão | Barlow Condensed 800 itálico | 21–28 | §4.3 |
| Corpo / rótulo | Barlow 600 | 16–20 | `neve` sobre vidro (sem contorno); fora do vidro, contorno `tinta` 3 |
| Legenda / dica | Barlow 600 | 14–15 | `aço` |
| Comemoração, bordão, callout | Bangers 400 | 26–40 | dentro de balão ou com contorno `tinta` 6 |

Regras: títulos e botões em caixa alta; corpo em frase normal; números alinhados à direita (não há algarismo tabular).
**Nunca emoji em texto**: o floco é o ícone `floco-dourado.webp`.

### 5.1 Letreiro (título com volume, irmão do logo)

Desenhado UMA vez por texto num canvas fora da tela e guardado em cache pela string. Camadas:

1. Sombra: preenchimento `rgba(4,10,30,0.45)` em (0, +8).
2. Contorno da extrusão: `strokeText` em `tinta` com largura 10, em (0, +5).
3. Extrusão: `fillText` na cor de extrusão em (0, +1) até (0, +5), ou seja, 5 chamadas.
   Gelo `#1659B8` · ouro `#B4560F` · marca `#9E3A0B` · prata `#56657F` · bronze `#6E3814`.
4. Contorno da face: `strokeText` em `tinta`, largura 7, em (0, 0).
5. Face: `fillText` com o gradiente (§2.3) num canvas auxiliar; depois `source-atop` de uma elipse branca alpha 0,35 nos
   40% de cima (brilho de vidro) e então compor sobre o resto.
6. Display (só os de 64): 3 estrelinhas (§7.4) presas nos cantos das letras, piscando.

---

## 6. Personagens, retratos e ícones

### 6.1 Sprites (`recortes/`)

Poses úteis fora da corrida (conferidas na folha de contato): `celeb` (punho para cima), `star` (braços abertos),
`sig` (pose assinatura), `land` (de pé, pousando), `grabUp` e `flip0` (no ar), `wobble` (desequilibrado), `scared`
(susto) e `fall2` (estatelado no chão: ótimo para humor no 6º lugar).

- **Altura máxima: 150 lógicos** (regra §1.7). Escalar sempre pela altura de `ride0`, como o `selecao.ts` já faz.
- **Sombra de contato:** elipse `rgba(4,10,30,0.35)`, largura 0,7x a do sprite, altura 10, na base.
- **Aro de luz (rim light), a cara Pixar sem filtro:** uma vez por par (id, pose), gerar uma silhueta tingida num canvas
  fora da tela (desenhar o sprite e depois `source-in` com `aurora-ciano`). Por quadro, desenhar a silhueta deslocada
  (−2, −2) com alpha 0,7 **antes** do sprite. Resultado: contorno de luz fria no lado de cima e à esquerda, igual à capa.
  Para o vencedor, a silhueta é `sol`.
- **Respiração (idle):** escala Y entre 1,000 e 1,015 com pivô nos pés, período de 2800 ms (easeInOutSine).

### 6.2 Retratos recortados da capa (o herói em alta resolução, de graça)

A capa tem os 6 personagens renderizados em alta resolução. Os recortes quadrados abaixo (em px de `capa.webp`, origem
no canto superior esquerdo) foram testados num recorte de verdade e todos enquadram bem o personagem:

| id | x | y | lado | nota |
|---|---|---|---|---|
| `capi` | 800 | 190 | 540 | perfeito |
| `bandeira` | 1420 | 70 | 340 | o pompom da Vó aparece no pé do quadro (a máscara do cartão corta) |
| `cidinha` | 1580 | 360 | 280 | perfeito |
| `beto` | 140 | 660 | 320 | perfeito |
| `queque` | 1090 | 60 | 240 | um pedaço de prancha no canto superior direito |
| `bia` | 450 | 390 | 340 | perfeito |

Uso: cartões da seleção, retratos circulares nas listas (classificação, pódio 4º a 6º, final) e, em geral, sempre que o
personagem precisar aparecer acima de 150 lógicos. Para o retrato circular, usar o mesmo quadrado com zoom de 1,25 no
centro. O maior recorte útil é ~120 lógicos para `queque` e ~170 para `capi` sem ampliar. A Lyra ajusta ±20 px no olho.

### 6.3 Ícones de itens (`itens/*.webp`, 256 px)

Tamanhos permitidos: 32, 40, 48, 64, 96, 128 lógicos (até 128 fica nítido, porque 128 lógicos = 256 de buffer).

| Ícone | Uso fora da corrida |
|---|---|
| `floco-dourado` | moeda (contador de flocos, preço da oficina, moedas voando) **e o troféu do campeonato** (§7.3) |
| `turbo` (chocolate) | ícone do atributo Velocidade |
| `escudo` | ícone do atributo Equilíbrio |
| `bola` | ícone do atributo Força; "acertos dados" no pódio |
| `nuvem` | "acertos sofridos" no pódio |
| `caixa` (?) | pista ou personagem bloqueado, "EM BREVE" |
| `ima`, `poca` | não usar fora da corrida (evitar ruído) |

Tratamento: dentro de medalhão (§4.4) ou solto com sombra de contato. Flutuação ±2 px em 2400 ms, com fases diferentes
por ícone. Não recolorir os ícones.

Se o dono achar estranho reaproveitar ícone de item como ícone de atributo, a alternativa é desenhar 3 glifos simples em
código (seta, balança, punho) dentro do mesmo medalhão.

---

## 7. Luz, sombra e efeitos

### 7.1 Direção da luz

Uma fonte só, **de cima e da esquerda** (a aurora da capa). Consequências: sombras sempre para baixo (+8 a +18 em y,
nunca para o lado); brilhos na metade de cima; aro de luz ciano no lado de cima e à esquerda dos personagens; tudo que é
"chão" (pedestal, monte, bloco) tem a face de cima clara e a lateral azul escura.

### 7.2 Brilho sem `shadowBlur`

Halo = gradiente radial (§2.3) atrás do objeto, raio 1,4x o objeto, alpha 0,25–0,45. Para pulsar, variar só o alpha
(0,26 → 0,40, período de 2000 ms), como o logo do menu já faz.

### 7.3 Raios de glória (vencedor, troféu)

Doze ou dezesseis triângulos finos (abertura de 8°) saindo de um centro, **num único `path`**, preenchidos com
gradiente radial: 0 `rgba(255,210,63,0.30)` → 1 `rgba(255,210,63,0)`, raio 300 a 520. Giram a 6–8°/s. Para o gelo
(seleção), usar `rgba(159,227,255,0.18)`.

### 7.4 Estrelinha de 4 pontas (brilho)

Losango de 4 pontas (pontas de raio r, cintura de raio r·0,25), branco, mais um ponto central. Pisca com escala
0 → 1 → 0 em 1200 ms (easeInOutSine) e gira 45° durante o ciclo. Tamanhos: r 4 a 10.

### 7.5 Confete (determinístico)

Cada peça `i` tem tudo derivado de `hash(i)`: cor (uma de `sol`, `chiclete`, `gelo`, `menta`, `tangerina`), tamanho
8x5 a 12x6, velocidade inicial, giro. Física por tick: gravidade 0,25 px/tick², arrasto 0,99, balanço lateral
`sen(t·0,1 + i)·0,6`. "Cambalhota" da peça: escala Y = |cos(fase)|, o que dá o brilho que pisca. Vida de 180 ticks e
alpha caindo nos últimos 30. **Desenhar agrupado por cor: 5 `fill` por quadro, não 1 por peça.**

Canhões: dois, nos cantos de baixo (0, 540) e (960, 540), ângulo de 60° a 75° para dentro, velocidade de 9 a 13
px/tick, 40 peças cada. Chuva (final): 120 peças nascendo em y −20 com x espalhado por hash, velocidade y de 1,5 a 3.

### 7.6 Moeda girando (troféu Floco de Ouro)

`floco-dourado.webp` a 128 lógicos. Giro de moeda: escala X = cos(θ). Quando |escala X| < 0,3, desenhar por cima uma
elipse da mesma silhueta em `ouro-escuro` com alpha (0,3 − |escala X|)·2 (a borda da moeda). Brilho que atravessa: faixa
diagonal branca alpha 0,5 e 18 px de largura, composta com `source-atop` num canvas fora da tela de 256x256 (barato),
passando a cada 3 s em 500 ms.

---

## 8. Animação "estilo Pixar", com números

### 8.1 Os princípios, aplicados à UI

| Princípio | Regra numérica |
|---|---|
| **Antecipação** | antes de todo movimento grande, 80–120 ms no sentido contrário com amplitude de 6–10% (botão afunda antes de saltar; personagem agacha antes de pular: escala (1,10 ; 0,88) em 100 ms) |
| **Exagero com overshoot** | entradas normais passam 8–12% do ponto final; comemorações passam 18–25%. Assentam em no máximo 2 oscilações |
| **Estica e amassa** | volume preservado (sx·sy ≈ 1). Pouso: (1,18 ; 0,84) e volta em 220 ms com mola. Subida rápida: (0,90 ; 1,12). Pivô nos pés para personagens e no centro para UI |
| **Entrada escalonada** | irmãos de lista: 60 ms entre um e outro; cartões: 70 ms; botões: 80 ms; grupos (título, painel, botões): 120 ms. A tela inteira termina de entrar em até **700 ms** (comemorações são exceção, §9) |
| **Arcos** | nada viaja em linha reta: moedas, cartões e personagens seguem uma quadrática com o ponto de controle 80–120 px acima do meio |
| **Continuação e sobreposição** | a tampa de neve de um painel chega 40 ms depois do painel e faz um amassa (sy 0,90 → 1); a etiqueta VOCÊ chega 60 ms depois do personagem |
| **Ação secundária (idle)** | tudo respira um pouco: personagem (1,5% em 2800 ms), ícones (±2 px em 2400 ms), CTA (3% em 1600 ms), aurora, flocos. Amplitudes pequenas, fases diferentes |
| **Saída mais rápida que entrada** | a saída dura de 60% a 65% da entrada, com easeInCubic, e todos os elementos saem juntos (sem escalonar) |
| **Nunca prender o jogador** | qualquer toque durante uma animação de entrada pula para o estado final. O botão aceita toque a partir de 150 ms |

### 8.2 Curvas (p de 0 a 1)

| Nome | Fórmula | Para quê |
|---|---|---|
| `easeOutCubic` | 1 − (1−p)³ | deslizes, fades, contagem de números |
| `easeInCubic` | p³ | saídas, moeda acelerando até o contador |
| `easeInOutCubic` | p<0,5 ? 4p³ : 1 − (−2p+2)³/2 | reordenação de linhas, cortina |
| `easeInOutSine` | 0,5 − 0,5·cos(πp) | loops de idle |
| `easeOutBack(s)` | 1 + (s+1)(p−1)³ + s(p−1)² | entradas. **s = 1,70 dá 10% de overshoot; s = 2,6 dá 20%** (conferido na derivada) |
| `mola` | 1 − e^(−6p)·cos(3πp) | pouso e soltar botão: passa 13,5% em p≈0,33, volta 1,8% em p≈0,67 |
| `molaForte` | 1 − e^(−5p)·cos(3πp) | carimbos e medalhas: passa 19% e volta 3,6%. Em p=1 vale 1,007: encostar em 1 no último quadro |

Proposta de módulo único, `src/ui/animacao.ts` (puro e testável, sem estado global): as curvas acima;
`progresso(tAtual, tInicio, duracaoTicks)` limitado a [0,1]; `escalonar(indice, passoMs)`; `lerp`; `bezierQuad`. Toda
tela passa a ter `tEntrada` (ticks desde que ficou visível) e calcula a pose de cada elemento a partir disso. **Sem
tweens com estado mutável**: pose = função(t), o que mantém o determinismo e facilita testar.

### 8.3 Durações (ms → ticks)

| Evento | ms | ticks | Curva |
|---|---|---|---|
| hover / foco | 120 | 7 | easeOutBack 1,7 |
| pressionar | 80 | 5 | easeOutCubic |
| soltar | 260 | 16 | mola |
| elemento entrando (texto, linha) | 360 | 22 | easeOutBack 1,7 + fade nos primeiros 60% |
| cartão entrando | 420 | 25 | easeOutBack 1,7 |
| painel entrando | 520 | 31 | easeOutBack 1,7 (sobe 40 px, escala 0,94 → 1) |
| carimbo (letreiro, medalha) | 360 | 22 | molaForte; escala 1,8 → 1, rotação −8° → −3° |
| número pulando | 260 | 16 | 1 → 1,22 (90 ms easeOutCubic) → 1 (170 ms easeInOutSine) |
| contagem de pontos | 900–1200 | 54–72 | easeOutCubic |
| moeda voando | 520 | 31 | easeInCubic no caminho em arco |
| reordenar linha | 600 | 36 | easeInOutCubic |
| cortina de transição | 280 + 60 + 320 | 17 + 4 + 19 | §10 |
| tremida de tela | 180–250 | 11–15 | amplitude 3–4 px decaindo linearmente, direção por hash |
| idle | 1600–3200 | 96–192 | easeInOutSine |

### 8.4 Movimento reduzido

Se `matchMedia('(prefers-reduced-motion: reduce)')` estiver ativo: sem tremida, overshoot zerado (s = 0, mola vira
easeOutCubic), confete em 30%, cortina vira fade cruzado de 200 ms e idle com metade da amplitude.

### 8.5 Personagem trocando (seleção) ou comemorando

- **Sai:** antecipação, **agachando** (1,10 ; 0,88) por 80 ms; depois pula para cima e para fora (−30 x, −120 y) em
  180 ms easeInCubic, esticado (0,90 ; 1,12), com alpha → 0.
- **Entra:** cai de y −140 em 260 ms easeInCubic, esticado; no contato, amassa (1,18 ; 0,84); assenta em 220 ms com
  mola; 10 partículas de neve saem dos pés (arco para os lados, 300 ms, alpha → 0).

### 8.6 CTA vivo

O primário respira: escala 1,00 ↔ 1,03 em 1600 ms (easeInOutSine). A cada 3 s, um brilho diagonal (faixa branca alpha
0,45, 22 px de largura, inclinação de 20°) atravessa a face em 450 ms, recortado (`clip`) na cápsula.

---

## 9. Comemorações (o momento que o jogador lembra)

### 9.1 Pódio (fim de cada pista)

Linha do tempo (ms desde a revelação):

| t | Evento |
|---|---|
| 0 | cortina revela o fundo B da pista que acabou de ser corrida |
| 100 | faixa de neve do chão sobe de y 560 para 470 (360 ms, easeOutCubic) |
| 200 / 340 / 480 | blocos do pódio 3º / 2º / 1º sobem de +160 (420 ms, easeOutBack 1,7) |
| bloco + 120 | o personagem de cada bloco cai (§8.5, "entra"); o 1º faz `celeb` |
| 1100 | raios de glória (ouro) atrás do 1º: escala 0 → 1 (700 ms, easeOutBack 2,6), depois giram a 8°/s |
| 1150 | **se o jogador ficou entre os 3 primeiros:** canhões de confete (§7.5) |
| 1200 | letreiro do título: carimbo (§8.3) + tremida de 3 px |
| 1300 | linhas do 4º ao 6º entram da direita (+60 px, escalonadas a 60 ms) |
| 1500 | flocos ganhos: 8 moedas saem do personagem do jogador e voam em arco até o contador (escalonadas a 60 ms); a cada chegada, o contador soma e pulsa a 1,12 |
| 1900 | CTA CONTINUAR salta (carimbo leve, easeOutBack 1,7) e começa a respirar |
| idle | o 1º alterna `celeb` ↔ `star` a cada 1200 ms (na troca, amassa de 0,95 por 80 ms) |

Título: 1º lugar do jogador → **"1º LUGAR!"** em letreiro ouro de 64. 2º ou 3º → **"PÓDIO!"** em letreiro prata.
De 4º a 6º → **"QUASE!"** em letreiro gelo, sem confete, só brilhos.

### 9.2 Vitória do campeonato

| t | Evento |
|---|---|
| 0 | tela com véu 0,8 (escuro, suspense) |
| 200 | véu cai para 0,3 em 600 ms (as luzes acendem) |
| 300 | raios de glória em tela cheia (16 raios, ouro, alpha 0,22): escala 0 → 1 em 700 ms (easeOutBack 2,6) |
| 500 | **Floco de Ouro** cai do topo girando (§7.6): y −200 → 200 em 600 ms (easeOutBack 1,7), o giro desacelera até ficar de frente; no impacto, tremida de 4 px por 250 ms e 16 brilhos em anel |
| 900 | chuva de confete por 3 s |
| 1000 | "CAMPEÃO!" (ou "CAMPEÃ!", pelo gênero do personagem) em letreiro ouro 64, carimbo com molaForte |
| 1300 | o campeão entra (§8.5) e fica em `celeb` |
| 1600 | lista final, linhas escalonadas a 60 ms |
| 2200 | CTA |
| idle | o troféu flutua ±4 px (2400 ms); brilho atravessando a cada 3 s; halo ouro pulsando |

### 9.3 Derrota (sem humilhar, com humor)

Sem confete e sem raios. Neve mais forte (flocos de fundo 36). O personagem do jogador em `wobble`, com 2 pulinhos de
desequilíbrio (rotação ±6°, 600 ms). O campeão rival aparece menor (110 lógicos) num bloco de 1º lugar com o Floco de
Ouro em 64. O tom do texto é de convite para a revanche (§11.6).

### 9.4 Compra na oficina

| t | Evento |
|---|---|
| 0 | botão pressiona e solta (§4.3) |
| 80 | 10 moedas saem do contador de flocos e voam até o personagem (arco de 100 px, 450 ms, escalonadas a 40 ms); o contador desce contando em 400 ms |
| 520 | personagem: agacha (1,10 ; 0,88) por 120 ms → pula y −60 em 260 ms (easeOutCubic) trocando para a pose `grabUp` no ar → cai 220 ms → pousa em `land` com amassa → volta a `sig` |
| no pouso | anel de choque: círculo com contorno `gelo` de 3 px, raio 20 → 120, alpha 1 → 0, 400 ms. Mais 16 brilhos |
| no pouso | a medalha "NV 3" faz carimbo; a pip de nível acende (escala 0 → 1, molaForte) |
| no pouso + 100 | as barras crescem para o novo valor (500 ms, easeOutBack 1,7) |
| no pouso + 150 | balão em Bangers "NÍVEL 3!" sobe em cima do personagem e some depois de 1200 ms |

### 9.5 Resultado do treino

Contagem dos pontos de 0 até o total (1000 ms, easeOutCubic, com o som de tique a cada 50 ms se a Vega topar). No fim,
o número pula (§8.3) e 12 brilhos estouram em volta. Se houver recorde, um balão "NOVO RECORDE!" em Bangers,
`chiclete`, faz carimbo 400 ms depois. Isso depende de dado (ver PENDÊNCIAS).

---

## 10. Transições entre telas

### 10.1 "Nevasca" (padrão entre telas cheias)

1. **Captura:** no `trocar()`, antes de destruir a cena antiga, copiar o canvas principal para um canvas fora da tela (é
   uma única chamada de `drawImage`). Destruir a cena antiga na hora, porque os ouvintes dela não podem sobreviver.
2. **Cobrir (280 ms, easeInCubic):** uma faixa inclinada a 12° varre da esquerda para a direita por cima da foto
   congelada. Borda de ataque: gradiente de transparente para `#F7FBFF` em 120 px. Corpo da faixa: gradiente *Neve*.
   Na borda de ataque, 40 flocos grandes (raio 3 a 9, posição por hash, tremendo ±4 px).
3. **Segurar (60 ms):** tela toda de neve. Se o asset da tela nova ainda não carregou, o segurar se estende e um
   `floco-dourado` de 48 gira no centro (é o "carregando").
4. **Construir a cena nova** só agora, para que a entrada dela comece no tick 0 da revelação.
5. **Revelar (320 ms, easeOutCubic):** a faixa continua para a direita e descobre a cena nova, cuja animação de entrada
   já está rodando por baixo.
6. **Entrada bloqueada** só durante os passos 2 a 4 (~340 ms).

**Direção espacial:** ir "para a frente" (menu → seleção → corrida → pódio → classificação → oficina) varre da
esquerda para a direita. **VOLTAR/ESC varre da direita para a esquerda.** O jogador sente um mapa, não um monte de
telas soltas.

Custo por quadro: 1 `drawImage` (foto ou cena), de 2 a 3 gradientes e 1 caminho de flocos.

### 10.2 Sobreposições (pausa, confirmação)

Sem cortina. **Abrir:** foto da corrida com desfoque (§3.3) aparece em fade de 180 ms; o painel desce de y −60 com
escala 0,90 → 1 (380 ms, easeOutBack 1,7); os botões entram escalonados a 50 ms. **Fechar:** o painel vai para 0,92 de
escala com fade de 160 ms e o véu sai junto.

**Trocar o conteúdo dentro do painel** (pausa → "sair da corrida?"): virar como uma carta. Escala X 1 → 0 em 120 ms
(easeInCubic), troca o conteúdo, 0 → 1 em 180 ms (easeOutBack 1,7).

### 10.3 Para dentro da corrida

Seleção → corrida usa a Nevasca, mas no segurar aparece o nome da pista em letreiro gelo de 44 por 400 ms. É o "cartão
de título" que prepara a contagem.

---

## 11. Layout de cada tela (960x540 lógico)

Padrões comuns a todas:

- **VOLTAR é sempre o botão redondo de 56** no canto superior esquerdo, em (32, 20). Isso libera a faixa de baixo
  para o CTA.
- **Título** em letreiro gelo, centralizado em y = 52 (linha de base em ~66).
- **Uma ação primária por tela**, sempre no terço de baixo e sempre a última a entrar.
- **Dicas de teclado** (`ESC`, `←/→`) só no desktop: pílulas pequenas de vidro no canto superior direito, em
  (928, 34) alinhadas à direita, Barlow 600 14 `aço`. No toque, somem.

### 11.1 Escolha de personagem (`selecao.ts`)

- **Fundo A** (capa fosca), com aurora viva e flocos.
- **Título:** "ESCOLHA SEU PERSONAGEM". Remover o subtítulo de desenvolvedor.
- **Palco (esquerda), área 32..392 x 80..408:**
  - raios de glória gelo centrados em (212, 280), raio 230;
  - pedestal de gelo com o centro da elipse de cima em (212, 372). A base, com a faixa lateral, termina em ~y 409,
    acima dos cartões (y 416). Os cartões são desenhados **na frente** do pedestal, então o cartão 1 ou 2 selecionado
    (que sobe até ~403) cobre a borda dele sem conflito;
  - personagem em pose `star` com altura de **150**, pés em y 368, com aro de luz ciano, sombra de contato e respiração;
  - troca de personagem: §8.5 (sai/entra) e o pedestal faz um amassa de 0,95 no pouso.
- **Painel Geada (direita): x 412, y 84, w 516, h 234.**
  - Nome: Barlow Condensed 40, branco com contorno, em (444, 136).
  - Manobra: Barlow 600 18 `sol`, em (444, 166).
  - Bordão: **balão de fala** em Bangers 22, com o rabicho apontando para o palco, em (444..700, 182..214). Respeita o
    teto de 22 caracteres.
  - 3 linhas de atributo a partir de y 236, uma a cada 30: medalhão 28 com ícone (turbo, escudo, bola) + rótulo Barlow
    600 17 + barra (x 600..900, h 16).
  - Legenda do bônus: um retângulo `sol` listrado de 14x10 e o texto "evolução", Barlow 600 14 `aço`, no canto inferior
    direito do painel.
  - Ao trocar de personagem, as barras vão do valor antigo para o novo (300 ms, easeOutBack 1,7). Comparar fica
    divertido.
- **CTA "CORRER!"** primário 300x64 em (570, 334).
- **Fileira de cartões: 6 cartões de 136x108**, x0 = 42, espaço de 12, y 416.
  - A arte é o **retrato da capa** (§6.2) em sangria total, com `clip` no cartão de raio 16.
  - Faixa do nome: gradiente de baixo para cima, `rgba(6,14,36,0.85)` → 0, nos 34 px de baixo; nome em Barlow
    Condensed 18 branco.
  - Selecionado: sobe 10 px, escala 1,06, aro `sol` de 3 px, tampa de neve pequena e 1 estrelinha no canto (240 ms,
    easeOutBack 1,7).
  - Os outros ficam com alpha 0,85. Hover: sobe 4 px em 120 ms.
- **Entrada:** título (0) → palco e pedestal (120) → personagem cai (240) → painel (240) → barras enchem de 0 até o valor
  (400, escalonadas a 80 ms) → cartões como "cartas sendo dadas", de baixo, com rotação ±6° → 0 (360, escalonados a
  70 ms) → CTA (700).

### 11.2 Final de fase / resultado do treino (`resultado.ts`)

- **Fundo B** da pista corrida, véu 0,35. Fallback: fundo A.
- **Letreiro "CHEGOU!"** gelo 56 em y 70 (carimbo).
- **Esquerda:** monte de neve centrado em (240, 440); personagem em `celeb` com altura de 150, pés em y 430; raios gelo
  atrás.
- **Painel Geada: x 430, y 110, w 470, h 250.**
  - "PONTOS", Barlow 600 15 `aço`, em (462, 150);
  - número em letreiro ouro 64 em (462, 214), com contagem (§9.5);
  - "TEMPO 42,3 s", Barlow Condensed 26, em (462, 256);
  - faixa de até 4 conquistas em pílulas (maior combo, pousos perfeitos, tombos, maior giro) em y 290, **se a Vega
    expuser o `ResumoDescida` no `ResultadoDescida`** (hoje só vêm pontos e ticks).
- **CTA "DE NOVO!"** primário 300x64 em (436, 384). A dica "ESPAÇO" (desktop) fica numa pílula de 14 debaixo dele.
- **"MENU"** secundário compacto 176x48 em (752, 392), terminando em x 928 (margem segura).
- Remover o texto que pisca. Manter "tocar em qualquer lugar = de novo" (pilar "de novo em 1 toque"), mas **só depois de
  600 ms**, para o toque que vem da corrida não reiniciar sem querer.

### 11.3 Pódio (`podio.ts`)

- **Fundo B** da pista, véu 0,30, e uma faixa de chão de neve de y 470 a 540 (contorno de montinhos, como a tampa).
- **Título** conforme o resultado (§9.1), em y 62.
- **Pílula com o nome da pista** debaixo do título, centralizada em y 96.
- **Blocos de gelo** (face *Gelo sólido*, contorno `tinta`, tampa de neve no topo, número do lugar no meio):

  | Lugar | Centro x | Largura | Topo y | Base y | Número |
  |---|---|---|---|---|---|
  | 2º | 200 | 132 | 356 | 470 | "2" prata 52 |
  | 1º | 340 | 140 | 318 | 470 | "1" ouro 60 |
  | 3º | 480 | 132 | 384 | 470 | "3" bronze 48 |

- **Personagens** nos blocos: 1º `celeb` (130 de altura), 2º `star` (120), 3º `land` (115), com aro de luz (ouro no 1º)
  e sombra de contato no topo do bloco.
- **Painel Geada de 4º a 6º: x 600, y 150, w 328, h 236.** Linhas de 64: medalhão de posição 36 + **sprite pequeno de 52
  de altura** (4º `ride0`, 5º `wobble`, 6º `fall2`: o humor está aqui) + nome em Barlow Condensed 20 + tempo à direita.
- Se o jogador estiver no pódio, a etiqueta VOCÊ fica em cima da cabeça dele; se estiver na lista, a linha dele usa a
  variante Painel Geada Ouro.
- **Contador de flocos:** pílula em (760, 20, 168x48) com `floco-dourado` 36 e "+38" em Barlow Condensed 26 `sol`.
- **Itens** (se vierem): duas pílulas pequenas debaixo do contador, `bola` "3" e `nuvem` "1".
- **CTA "CONTINUAR"** primário 300x64 em (628, 456).
- Linha do tempo: §9.1.

### 11.4 Classificação do campeonato (`standings-campeonato.ts`)

- **Fundo B da PRÓXIMA pista** (como já é hoje), véu 0,45.
- **Título** "CLASSIFICAÇÃO". Debaixo dele, a pílula "Depois de Morro do Pinhão" e 5 indicadores de progresso (flocos
  de 12): pistas feitas em `sol`, a próxima em `gelo` pulsando, o resto em vidro.
- **Painel Geada: x 220, y 120, w 520, h 316.** Seis linhas de 50, a primeira em y 140: medalhão de posição 36 +
  retrato circular 40 + nome Barlow Condensed 22 + pontos à direita em Barlow Condensed 26 + pílula "+10" `menta`.
  O jogador usa o Painel Geada Ouro só na linha e a etiqueta VOCÊ.
- **A animação que dá sentido à tela (ultrapassagem):**
  1. as linhas entram na ordem **anterior** a esta pista (escalonadas a 60 ms);
  2. 500 ms depois, cada pílula "+N" voa até o total, que conta para cima (600 ms);
  3. 300 ms depois, as linhas trocam de lugar para a ordem nova (600 ms, easeInOutCubic). Quem sobe faz um arco de
     +14 px para a direita no meio do caminho (passa por fora) e ganha um ▲ `menta`; quem desce ganha um ▼ `sinal`.
     Os triângulos são desenhados em código, não com glifo de fonte;
  4. se o jogador subiu, os brilhos estouram na linha dele.

  A ordem anterior sai de `classificação atual − pontos da última pista`, sem dado novo.
- **Embaixo:** pílula "Próxima: Vila do Chocolate Quente" com miniatura de 96x54 (recorte do `fundo.webp` da próxima
  pista, raio 10) em (220, 462). CTA "CONTINUAR" primário 300x64 em (600, 456). Na última pista, o CTA vira
  "VER RESULTADO FINAL".

### 11.5 Oficina (`oficina-campeonato.ts`)

- **Fundo B** da próxima pista, véu 0,40, com uma **luz de lampião**: radial `tangerina` com alpha 0,18 centrado em
  (300, 120), raio 380, somado com `lighter`. É uma oficina: luz quente.
- **Título** "OFICINA DA MONTANHA" em letreiro **marca** (laranja, como o MALUCA do logo).
- **Carteira:** pílula em (760, 20, 168x48) com `floco-dourado` 36 + saldo em Barlow Condensed 28 `sol`.
- **Palco (esquerda):** pedestal em (230, 392); personagem em `sig`, com altura de 150; medalhão "NV 2" de 56 no ombro
  direito (290, 240); 5 pips de nível (flocos de 18, preenchidos `sol` até o nível atual e vidro no resto) em fila
  debaixo do pedestal, y 430.
- **Painel Geada: x 430, y 100, w 498, h 300.**
  - "Próximo nível (3) melhora:" Barlow 600 18;
  - 3 barras (§4.4) com **pré-visualização**: o preenchimento atual mais um trecho-fantasma listrado `sol` com alpha
    pulsando entre 0,45 e 0,9 em 1000 ms, que mostra o ganho. O texto "+4 → +6" fica à direita;
  - linha do preço: "Custa" + `floco-dourado` 32 + preço em Barlow Condensed 30;
  - CTA dentro do painel (300x64, centralizado, em y 320): "COMPRAR NÍVEL 3".
- **Hierarquia dos botões:** se dá para comprar, COMPRAR é o primário e "CONTINUAR" é secundário 220x54 em (708, 466).
  Se não dá (flocos insuficientes ou nível máximo), COMPRAR fica desativado (§4.3: tocado, treme e o preço pisca em
  `sinal`) e **CONTINUAR vira o primário**.
- No nível máximo, no lugar do preço, uma pílula `menta` "NÍVEL MÁXIMO" com carimbo.
- Compra: §9.4. Remover o `❄` do texto (usar o ícone).

### 11.6 Final do campeonato (`final-campeonato.ts`)

**Vitória:**

- Fundo B da última pista, raios em tela cheia, véu animado (§9.2).
- "CAMPEÃO!/CAMPEÃ!" letreiro ouro 64 em y 70.
- **Floco de Ouro** de 128 centrado em (380, 190), com halo e giro (§7.6). Debaixo, a pílula "Troféu de Capi Barbosa
  conquistado!" centralizada em x 380, y 290 (cerca de 230..530 de largura).
- O campeão em `celeb`, com altura de 150, sobre monte de neve, pés em (140, 440), aro de luz `sol`. A cabeça fica em
  ~y 290 e x 80..200, fora da pílula.
- **Painel Geada da classificação final: x 600, y 130, w 328, h 290**, com linhas de 44 (medalhão + retrato circular 32 +
  nome + pontos). O jogador usa a linha ouro.
- CTA "VOLTAR AO MENU" primário 300x64 em (628, 456).

**Derrota:**

- Mesmo layout, sem raios e sem confete; título "FIM DE CAMPEONATO" em letreiro gelo 48.
- No lugar do troféu: o campeão rival em `celeb` (110 de altura) num bloco de 1º lugar em miniatura, com o Floco de Ouro
  de 64 flutuando acima. A pílula diz "Campeã: Vó Cidinha".
- O jogador em `wobble` (100) ao lado, um pouco atrás.
- Texto de apoio (Barlow 600 18): "Você ficou em 3º. O Floco de Ouro te espera na revanche!"
- Mesmo CTA.

### 11.7 Opções (`opcoes.ts`)

- **Fundo A**; botão VOLTAR redondo; título "OPÇÕES".
- **Painel Geada: x 180, y 104, w 600, h 340.** Três linhas de 104, separadas por um fio (gradiente horizontal
  transparente → `rgba(159,227,255,0.25)` → transparente). Cada linha tem:
  - à esquerda, um medalhão de 52 com glifo desenhado em código, traço branco de 2,5 px: mão (controles), alto-falante
    (som), setas de expandir (tela cheia);
  - rótulo em Barlow Condensed 24 e ajuda em Barlow 600 15 `aço`;
  - à direita, o controle:
    - **Controles:** seletor segmentado "GESTOS | BOTÕES" (pílula 260x48). O segmento ativo é uma face glaciar com
      tampa de neve que **desliza** de um lado para o outro (260 ms, easeOutBack 1,7);
    - **Som:** interruptor (§4.4). A bola de neve desliza em 220 ms (easeOutBack 1,7), esticando para 1,2 em x no meio
      do caminho;
    - **Tela cheia:** botão secundário compacto "ENTRAR"/"SAIR"/"COMO ATIVAR". A dica do iPhone vira a linha de ajuda.
- **Entrada:** painel (0), linhas deslizando +24 px da direita (escalonadas a 70 ms).

### 11.8 Pausa (`pausa.ts`)

- **Fundo C** (corrida congelada e desfocada).
- **Painel Geada: w 400, h 380, centralizado.** Título "PAUSA" em letreiro gelo 44 dentro do painel, em y + 58.
- Botões de 320x56 empilhados com passo de 66, a partir de y + 96: **CONTINUAR** (primário), REINICIAR CORRIDA
  (secundário), CONFIGURAÇÕES (secundário) e VOLTAR AO MENU (perigo). O último termina em y + 350, o que deixa o
  rodapé y + 366 para a dica "ESC/P continua" (desktop).
- REINICIAR desativado (depois da chegada): não há espaço para a dica entre os botões. Quando tocado, ele treme e a dica
  "só antes da chegada" aparece numa pílula de 14 em cima dele por 1500 ms.
- **Toque Pixar:** o personagem do jogador **espia pela borda direita do painel**, em pose `scared`, altura 110, metade
  escondida atrás do painel (desenhado antes do painel), deslizando para fora 30 px em 420 ms, 200 ms depois do painel.
  Na tela "sair da corrida?", ele troca para `wobble`.
- Confirmação de saída: viragem de carta (§10.2); "SIM, SAIR" perigo e "CANCELAR" secundário.
- Entrada e saída: §10.2.

### 11.9 Escolha de pista (`selecao-pista.ts`)

- **Fundo B da pista destacada** (hover ou selecionada). Ao mudar o destaque, fade cruzado de 300 ms entre as duas
  camadas em cache: a tela inteira assume o clima da pista.
- **Título** "ESCOLHA SUA PISTA".
- **Cinco cartões-postais de 164x220**, x0 = 38, espaço de 16, y 104 (terminam em x 922).
  - Arte: `fundo.webp` em recorte de capa (o retrato central, 810x1080 de origem), mais `silhuetas.webp` por cima. No
    hover/seleção, as silhuetas deslocam ±6 px seguindo o ponteiro (paralaxe de verdade).
  - Faixa de baixo com o nome em Barlow Condensed 20 (até 2 linhas) e 1 a 5 flocos de dificuldade (= a ordem da pista).
  - Pista atual: faixa diagonal `sol` "ATUAL" no canto superior esquerdo.
  - Selecionado: escala 1,08, sobe 10 px, aro `sol`, tampa de neve; os outros com alpha 0,85.
- **Painel Geada de informação: x 160, y 344, w 640, h 92:** nome da pista em Barlow Condensed 30 + uma linha de clima
  (das fichas de `docs/temas-pistas-m3.md`) em Barlow 600 16.
- **CTA "PRONTO"** primário 300x64 centralizado em y 456. O comportamento continua o mesmo: tocar no cartão grava, e o
  CTA volta ao menu.
- **Entrada:** cartões "dados" de baixo (+80 px, rotação ±6° → 0, 420 ms, easeOutBack 1,7), de dentro para fora
  (3, 2, 4, 1, 5), escalonados a 70 ms.

### 11.10 Abertura do campeonato (não estava na lista, mesma família)

Aplicar o mesmo kit: fundo B da 1ª pista, palco com pedestal à esquerda e as 5 pistas como mini cartões-postais
(96x128) numa trilha em diagonal, ligadas por uma linha tracejada de pegadas. Feitas: carimbo `menta` ✓ desenhado em
código. Próxima: pulsando.

---

## 12. Componentes a criar uma vez (em `src/ui/desenho.ts` ou num `src/ui/kit/`)

`fundoFosco(img, reducao, veu)` · `painelGeada(retangulo, variante)` com cache · `tampaDeNeve(x, y, w, escala, semente)` ·
`botao3D(retrato, tipo, estado, tEstado)` · `letreiro(texto, tamanho, face)` com cache · `retratoDaCapa(id, forma)` ·
`medalhao(conteudo, tipo)` · `barraAtributo(valor, bonus, fantasma)` · `pedestal` · `monteDeNeve` · `raiosDeGloria` ·
`estrelinha` · `confete(semente, origem)` · `moedasVoando` · `etiquetaVoce` · `balaoDeFala` · `interruptor` ·
`seletorSegmentado` · `botaoRedondoVoltar` · `cortinaNevasca` (no gerenciador) · `animacao.ts` (§8.2).

`desenharBotao` e `desenharBotaoBala` passam a ser o `botao3D`. O menu principal migra junto, para ficar tudo igual.

---

## 13. Ordem sugerida e critério de aceite

**Fases** (cada uma termina com prints para o dono, ao lado da capa):

1. **Fundamentos:** `animacao.ts`, fundo fosco, Painel Geada + tampa, botão 3D com estados, letreiro, retratos da capa,
   medalhão, VOLTAR redondo. Aplicar em **Opções e Pausa** (as telas mais simples, para validar o material).
2. **Nevasca** no gerenciador + **Seleção de personagem** + **Seleção de pista**.
3. **Resultado + Pódio** (confete, moedas, raios).
4. **Classificação** (ultrapassagem) + **Oficina** (compra) + **Final** (troféu).

**Aceite (medido, não suposto; skill `medir-antes-de-afirmar`):**

- print de cada tela em 960x540 e em iPhone paisagem, colocado ao lado da capa;
- nenhum `shadowBlur`/`filter` no caminho por quadro (conferir com grep) e nenhuma fonte `700`/`900`;
- tempo de quadro medido (DevTools Performance) com confete no máximo: alvo de ≤ 6 ms de desenho no desktop e sem
  queda de 60 fps no iPhone;
- sprite nenhum acima de 150 lógicos;
- alvos de toque com 48 ou mais; texto com 14 ou mais;
- toque durante a entrada pula para o fim; ESC e VOLTAR varrem da direita para a esquerda;
- `prefers-reduced-motion` respeitado.
