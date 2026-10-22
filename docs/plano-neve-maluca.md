# NEVE MALUCA — plano de arquitetura e produção

Autora: Nova (arquitetura). Data: 2026-10-22. Estado: **proposta, nada implementado**.
Nenhuma dependência instalada, nenhuma imagem gerada, nenhum repositório remoto criado.

Onde este plano diz **(a medir)** ou **(a confirmar no aparelho)**, o número ou o comportamento é estimativa minha
e ainda não foi provado. As decisões que são do dono estão na seção 9 e não foram tomadas por mim.

---

## 0. Contexto e hipóteses

| Item | Hipótese declarada | Efeito na arquitetura |
|---|---|---|
| Escala | dezenas a centenas de jogadores, jogo estático, sem conta | **sem backend no MVP**; tudo roda no navegador |
| Equipe | dono solo + squad de agentes | reaproveitar ferramentas provadas no InnoFighters, sem inventar outras |
| Maturidade | MVP / protótipo jogável, depois polimento | arquitetura simples; nada de serviços, filas ou banco |
| Aparelho principal | iPhone com Chrome (motor WebKit) | o portão de desempenho é o iPhone, não o PC |
| Também | PC (teclado e controle) | mesma build; entrada abstrai o dispositivo |
| Prazo | não informado; cadência parecida com a do InnoFighters | marcos curtos com um portão do dono em cada um |
| Orçamento de arte | conta gratuita da Runway (Nano Banana): dá **cerca de 11 gerações em 2K ou 17 em 1K**; vídeo e áudio bloqueados | a arte gerada vai para os personagens; cenários em código |
| Publicação | GitHub Pages temporário para teste e EasyPanel no fim, como no InnoFighters | build estática; CSP como cabeçalho no EasyPanel |
| Ranking | **local** no MVP | o formato de replay (C6) já nasce pronto para um ranking online futuro |

**Reaproveitado do InnoFighters (padrões, não o jogo):** passo fixo de 60 ticks/s, motor puro e determinístico
com RNG de semente (mulberry32) e geradores separados por finalidade, eventos em vez de efeitos colaterais,
contratos versionados (manifesto de atlas, comando por tick, leitura do motor, armazenamento), validação de dados
no import que derruba o boot, armazenamento com saneamento e migração por chave nova, carga de arte sob demanda,
áudio sintetizado com orçamento de fontes, pipeline de folhas 4x3 para atlas, CSP só no build, harness de
simulação por semente. **Forma de reaproveitar:** copiar e adaptar, com nota de origem no cabeçalho do arquivo.
Um pacote comum entre os dois jogos é prematuro; reavaliar se surgir um terceiro jogo.

---

## 1. Visão e pilares

**Visão:** uma descida de 60 a 90 segundos em que qualquer pessoa, com um dedo, faz um mortal na primeira tentativa
e ri do tombo na segunda. Personagens originais, cômicos, com cara de filme de animação 3D. Uma pista é uma piada
curta com começo, meio e fim.

### Pilares (e como cada um vira requisito técnico)

1. **Sensação de velocidade.** Câmera que se afasta com a velocidade (zoom de 1,0 até ~0,8), olhar à frente
   proporcional à velocidade, parallax em 4 a 5 camadas, rastro de neve, linhas de velocidade acima de um limiar,
   vento sintetizado cujo filtro abre com a velocidade, tremida curta no pouso. Tudo isso é **render e áudio**:
   o motor só expõe velocidade, ângulo e eventos.
2. **Manobras fáceis no toque.** Um toque pula; segurar gira; deslizar no ar faz um grab. Nenhum botão virtual
   obrigatório. A janela de pouso é generosa e configurável por personagem. A mesma semântica vale para teclado e
   controle, para o recorde ser comparável.
3. **Humor.** Tombos com animação própria (cara na neve, prancha voando), nomes de manobra engraçados, falas em
   "blablablá" sintetizado (vozes por formante, como no InnoFighters, sem palavras reais), objetos cômicos na pista
   (boneco de neve que explode em neve, placas com piada). O tombo não pune demais: perde o combo, nunca a corrida.
4. **Sessões curtas.** Do ícone até controlar o personagem em no máximo 2 toques. "De novo" em 1 toque, sem
   recarregar nada. Cada pista tem 3 objetivos curtos (ex.: "dois mortais seguidos", "termine sem cair") que dão
   motivo para mais uma descida.

### Modos (MVP)

- **Descida**: pista fixa (semente fixa), linha de chegada, pontuação + bônus de tempo. Recorde local por pista.
- **Desafio do dia** (proposta, decisão D7): semente derivada da data UTC; mesma pista para todos naquele dia.
  É o modo natural de um ranking online futuro.
- **Livre** (pós-MVP): pista infinita por trechos, sem chegada.

---

## 2. Caminho técnico: 3 opções

Os jogos citados pelo dono (Snowboard Master 3D, Snowboard Party, Snowboard King) usam câmera atrás do
personagem em 3D. Isso pesa nas opções, e por isso a câmera é a **primeira decisão do dono (D1)**: ela muda o
motor, as poses que a arte precisa ter e o custo de cada manobra.

### Opção A — 2,5D lateral, Canvas 2D, personagens em sprite (**recomendada**)

Rolagem lateral (a família de *Alto's Adventure*): o terreno é uma curva de altura gerada por semente, a
profundidade vem do parallax, da neblina e da escala das camadas. Personagem em sprites 2D com acabamento de
animação 3D. Mortais são rotação do sprite no plano da tela: **saem de graça na arte**.

- **Desempenho no iPhone:** o melhor dos três. Um polígono de terreno, 4 a 5 camadas pré-desenhadas em canvas
  fora da tela, 1 personagem e algumas dezenas de objetos por quadro. Mesmo modelo que o InnoFighters já roda.
- **Tempo:** o menor. Stack, laço, entrada, áudio, armazenamento e pipeline de sprites vêm prontos para adaptar.
- **Custo de arte:** o menor. Uma vista só (perfil). ~24 poses por personagem em 2 folhas 4x3. Cenário desenhado
  em código (silhuetas por ruído com semente e degradês), sem gasto de geração.
- **Qualidade visual:** boa e coerente, mas **não é 3D**. Risco de o personagem "3D" destoar do cenário plano
  (R3). Rostos ficam bem visíveis de perfil, o que ajuda o humor.
- **Risco:** baixo no técnico; médio no "não se parece com as referências".
- **Física:** 1 dimensão no chão (posição ao longo da curva) e balística no ar. Simples de testar e determinística.

### Opção B — 3D com Three.js/WebGL e modelos 3D, câmera atrás

O mais parecido com as referências. Terreno em malha gerada por semente, árvores instanciadas, câmera de
perseguição, personagem como modelo 3D animado.

- **Desempenho no iPhone:** viável com pouca geometria e luz assada em textura. O visual "de filme de animação"
  pede iluminação suave, oclusão e sombras, que custam caro no celular. Riscos próprios: perda do contexto WebGL,
  travadas na compilação de shaders, teto de memória do WebKit (a medir).
- **Tempo:** cerca de 2,5 a 3 vezes o da opção A (estimativa). Quase nada do InnoFighters se aproveita no render;
  a biblioteca soma por volta de 150 a 200 KB gzip ao pacote (a medir).
- **Custo de arte:** o maior, e **fora do fluxo provado da squad**. A Runway gera imagens, não modelos 3D com
  esqueleto. Caminhos: modelos CC0 de baixa contagem de polígonos (não são originais nem cômicos), ferramentas
  pagas de imagem para 3D mais rigging automático (conta nova, qualidade variável), ou encomendar a um artista.
- **Qualidade visual:** a mais alta possível, mas só se a arte 3D for boa. Modelo 3D fraco fica pior que sprite bom.
- **Risco:** alto (arte e desempenho).

### Opção C — híbrido: mundo 3D (ou pseudo-3D estilo OutRun) com personagem em sprite

Câmera atrás, pista em 3D (Three.js) ou em segmentos projetados (pseudo-3D em Canvas 2D), personagem como
cartaz 2D virado para a câmera.

- **Desempenho no iPhone:** bom no pseudo-3D; parecido com B no Three.js.
- **Tempo:** cerca de 2 vezes o da A (estimativa).
- **Custo de arte:** alto e com o pior risco de consistência. Visto de trás, o personagem precisa de várias
  vistas por pose (costas, 3/4 para cada lado). Um giro de 360 pede 8 vistas por pose. Um mortal visto de trás é
  uma rotação **fora** do plano da tela, que o sprite não representa. Com uma referência por geração (lição do
  InnoFighters), manter o mesmo personagem em 8 ângulos é a parte que mais falha.
- **Qualidade visual:** boa no cenário, fraca nas manobras.
- **Risco:** alto. Herda o custo do 3D e o limite do sprite ao mesmo tempo.

### Comparação

| Critério (peso) | A lateral 2,5D | B Three.js 3D | C híbrido |
|---|---|---|---|
| Desempenho no iPhone (3) | ótimo | médio | bom a médio |
| Tempo até o protótipo (3) | ~1x | ~2,5-3x | ~2x |
| Custo de arte (3) | baixo (1 vista) | muito alto (3D com esqueleto) | alto (multivista) |
| Qualidade visual (2) | boa, 2D | a mais alta, se a arte vier | boa no cenário, fraca nas manobras |
| Risco (2) | baixo | alto | alto |
| Fidelidade às referências (1) | baixa | alta | média |

### Recomendação: Opção A

Ela é a única em que as três coisas mais difíceis (manobras legíveis, personagem consistente e 60 fps no iPhone)
já estão ao alcance com o que a squad sabe fazer e com o orçamento de arte que existe. O humor ganha com rostos
de perfil. A sensação de velocidade, num jogo lateral, se resolve com câmera, parallax e som (pilar 1).

**Saídas, se a A não bastar:**
- **Desempenho:** a camada `render/` fica isolada; se o portão de fps falhar, trocar só ela por PixiJS (WebGL),
  como ficou combinado no InnoFighters. Motor, dados e UI não mudam.
- **Se o dono quiser câmera atrás:** o caminho certo é a B, com orçamento próprio de arte 3D, não a C.
  Honestamente: trocar de A para B depois **refaz o motor de física e toda a arte**. Aproveitam-se manobras,
  combos, pontuação, entrada, áudio, armazenamento, metas e o gerador de pista (com outro formato de saída).
  Por isso D1 precisa de resposta **antes** de gastar qualquer geração de arte.

---

## 3. Arquitetura

### 3.1 Camadas

Mesma regra do InnoFighters: cada pasta importa só das que estão na coluna "Importa de". Um teste de arquitetura
(varredura de imports e de texto) guarda isso.

| Pasta (`src/`) | Responsabilidade | Importa de |
|---|---|---|
| `core/` | contratos (`contratos.ts`), RNG (`rng.ts`), trigonometria tabelada (`trig.ts`), hash (`hash.ts`), armazenamento (`storage.ts`), constantes | nada |
| `data/` | personagens, pistas, catálogo de trechos, manobras, objetivos, textos pt-BR; validação no import (`exigir*Validos`) | `core/` |
| `pista/` | **gerador puro** da pista: semente + `DefPista` = `PistaGerada` (perfil de altura, objetos, trilhos, checkpoints, chegada, hash) | `core/`, `data/` |
| `descida/` | **motor puro**: física, colisão, reconhecimento de manobras, combo, pontuação, bot, replay. Sem DOM, áudio, render, `Math.random`, `Date`, `performance` | `core/`, `data/`, `pista/` |
| `meta/` | progresso, recordes, objetivos, desbloqueios, semente do desafio do dia | `core/`, `data/` |
| `render/` | câmera, terreno, cenário procedural, personagem, objetos, partículas (`rngVisual`), HUD, textos de manobra, efeitos de velocidade | `core/`, `data/`, `assets/` |
| `audio/` | sistema de áudio sintetizado, vento, eventos para som, música por pista, vozes "blablablá" | `core/`, `data/` |
| `input/` | teclado, gamepad, toque com reconhecimento de gestos; tudo vira `ComandoDescida` (C2) | `core/` |
| `assets/` | manifesto C1, carregador, gerenciador de carga sob demanda | `core/`, `data/` |
| `ui/` | cenas (`ui/cenas/*`), menus, persistência | todas |
| `platform/` | escala do canvas, foco e pausa, orientação, PWA, tela acesa, erros | `core/` |
| `main.ts` | monta tudo e roda o laço | todas |

### 3.2 Laço

- Passo fixo de 1000/60 ms, acumulador limitado a 100 ms (sem salto depois de aba parada).
- A cada tick: `input` produz um `ComandoDescida`; `descida.update(cmd)` avança o motor; a cena entrega
  `LeituraDescida` (C3) ao render, ao áudio e ao HUD. A cada quadro de tela: `ui.draw()`.
- Pausa automática ao perder foco ou esconder a aba.
- Contagem regressiva, tela de resultado e repetição de tombo **não chamam** `descida.update`: congelam o motor
  sem mexer no RNG da lógica (mesma técnica da entrada do chefão no InnoFighters).

### 3.3 Motor da descida (física simples)

Unidades em metros e segundos, convertidas para pixels só no render.

**Estado do piloto:** `x, y, vx, vy, modo ('chao' | 'ar' | 'trilho' | 'tombo')`, `angulo` (corpo), `velAngular`,
`anguloAcumulado` (para contar voltas), `grab`, `ticksNoAr`, `agachado`, `carga`.

- **No chão:** a velocidade anda ao longo da tangente. Aceleração = `g·sen(inclinação) − atrito·v − arrasto·v²`.
  Agachar reduz o arrasto. O corpo se alinha à tangente. Velocidade com teto por personagem.
- **Pulo:** impulso na direção da normal do terreno, somado à velocidade atual. Rampas (kickers) somam o próprio
  ângulo: é aí que nascem os saltos grandes.
- **No ar:** balística com gravidade. `giro` segurado aplica velocidade angular até um teto; soltar amortece.
  O giro só começa depois de `ATRASO_GIRO` ticks segurando (ponto de partida 8): um toque rápido é só um pulo.
- **Pouso:** quando `y <= altura(x)`. Diferença entre ângulo do corpo e da tangente: até `janelaPerfeita`
  (ponto de partida 20°) = perfeito; até `janelaBoa` (45°) = torto (perde velocidade, fecha o combo com
  desconto); acima = tombo.
- **Trilho:** pousar com o centro sobre um trilho, dentro da janela, prende o piloto ao segmento até o fim
  dele ou até um pulo.
- **Obstáculo:** pedra, tronco e afins têm caixa ao longo de `x`. Encostar no chão = tombo. Passar por cima no
  ar = nada (ou bônus "por um fio" se a folga for pequena). Boneco de neve = atravessa, perde um pouco de
  velocidade, vira piada (evento próprio).
- **Tombo:** 90 ticks de animação cômica (o motor só marca o tempo), depois volta ao último checkpoint com
  velocidade reduzida. Perde o combo, nunca a corrida.

**Determinismo:**
- Uma semente da lógica por corrida; geradores separados para visual (`+1`), UI (`+2`), áudio (`+3`) e falas
  (`+4`), como no InnoFighters.
- **Nada de `Math.sin/cos/atan2/pow/exp` no motor e no gerador.** Motivo: o resultado dessas funções pode diferir
  no último dígito entre motores (V8 no PC e no servidor, JavaScriptCore no iPhone), e um replay feito no iPhone
  divergiria se fosse conferido em outro motor. Usar `core/trig.ts` (tabela de seno com interpolação e `atan2`
  polinomial). `+ − × ÷` e `Math.sqrt` são exatos pelo padrão IEEE 754, então podem. Teste de varredura proíbe o
  resto em `descida/` e `pista/`.
- Teste de regressão: mesma semente e mesma lista de comandos dão o mesmo hash de estado depois de 5400 ticks
  (90 s), e o bot completa a pista com o mesmo resultado em duas rodadas.

### 3.4 Geração de pista por semente

Uma pista não é ruído puro: é uma **sequência de trechos feitos à mão** (catálogo), escolhidos pelo RNG da
semente conforme uma curva de dificuldade. Isso dá variedade sem pista impossível.

- `DefTrecho`: tipo (reta, ondulado, rampa, vão, trilho, pedras, degrau, boneco de neve, colecionáveis),
  comprimento, pontos de controle relativos, objetos, dificuldade (0 a 1), velocidade mínima de entrada para ser
  vencível, regras de vizinhança (ex.: dois vãos seguidos é proibido).
- `DefPista`: semente fixa, tema, comprimento, faixa de dificuldade (início e fim), pesos dos trechos permitidos,
  música, objetivos e **`hashEsperado`**.
- O gerador une os trechos com curvas de Hermite de tangente casada (altura e inclinação contínuas), garante
  inclinação média de descida entre limites (ponto de partida −5° a −35°) e amostra a altura a cada 0,5 m em um
  `Float64Array`. Custo esperado: menos de 20 ms por pista no iPhone (a medir no M1).
- **Por que `hashEsperado`:** qualquer mudança no gerador muda todas as pistas e invalida os recordes. O hash
  fixo da pista faz o teste falhar quando isso acontece, e o recorde guarda a `versaoPista`. Mudança proposital
  do gerador = recordes daquela pista vão para "recordes antigos" (não somem).
- **Harness de pista** (`ferramentas/harness/`, mesmo espírito do `npm run balanco`): o bot desce cada pista com
  N sementes de comportamento e mede taxa de conclusão, tombos, duração e pontuação. Portão no CI:
  0 travadas, pista concluída pelo bot "cuidadoso" em 100% das rodadas, duração dentro da faixa.

### 3.5 Manobras, combos e pontos

Tudo dirigido por dados (`data/manobras.ts`), com números de partida para afinar no M2 com o harness e com o dono.

| Família | Como faz | Pontos de partida |
|---|---|---|
| Ar | tempo no ar | 10 a cada 0,1 s acima de 0,5 s |
| Mortal | giro segurado, contado por volta completa (meia volta não conta) | 1 volta 500, 2 voltas 1200, 3 voltas 2500 |
| Grab | gesto no ar (4 direções = 4 grabs) | 150 + 50 a cada 0,25 s segurando |
| Trilho | deslizar no trilho | 20 por 0,1 s |
| Estilo | pouso perfeito, "por um fio", mortal com grab | bônus de +25% sobre a manobra |

- **Combo:** abre na primeira manobra. Continua enquanto o piloto pular de novo até `JANELA_LIGACAO` ticks
  (ponto de partida 60) depois de pousar. Multiplicador = 1 + manobras **distintas** no combo (teto 10).
  Repetir a mesma manobra vale 50%, depois 25%.
- **Fecha** (soma × multiplicador vai para a pontuação) quando a janela acaba depois de um pouso bom.
  **Perde** tudo no tombo.
- **Nomes cômicos** por manobra e por combinação (ex.: mortal + grab de nariz), em `data/textos.pt-BR.ts`.
- **Medidor de maluquice** (opção do M2, decisão D3b): enche com manobras; cheio, dá uma corrida bônus com
  velocidade extra e o "jeito" cômico de cada personagem. Fica fora do M1.

A pontuação mora **dentro** de `descida/`, porque o pouso torto muda a física (perde velocidade) e porque um
replay precisa reproduzir os pontos só a partir dos comandos.

### 3.6 Câmera

Só no render; lê o estado e a câmera do quadro anterior (não toca o motor).
- Mola com amortecimento crítico seguindo um ponto à frente do piloto (olhar à frente proporcional a `vx`).
- Zoom de 1,0 parado até ~0,8 no teto de velocidade; mais aberto no ar alto, para o pouso aparecer.
- Enquadramento vertical que mantém o terreno à frente visível na descida íngreme.
- Tremida no pouso pesado e no tombo; desligada com movimento reduzido.

### 3.7 Entrada (toque, teclado, controle)

O motor só vê `ComandoDescida` (C2). Gestos, teclas e botões ficam em `input/`.

| Ação | Toque | Teclado | Controle |
|---|---|---|---|
| Pular | tocar em qualquer lugar (no chão) | Espaço ou ↑ | A |
| Mortal para trás / para frente | segurar a metade esquerda / direita da tela (no ar) | ← / → | analógico ou D-pad ← / → |
| Grab (4) | deslizar no ar para cima, baixo, frente, trás | Z, X, C, V | X, Y, B, RB |
| Agachar (mais velocidade) | opcional (decisão D10) | ↓ | ↓ |
| Pausa | botão II no canto | Esc ou P | Start |

- Reconhecimento de gesto: deslize = deslocamento acima de um limiar em até ~150 ms; segurar = sem deslize
  passado o atraso. Limiares em constantes para afinar no aparelho.
- **Armadilha conhecida a confirmar no aparelho:** no Chrome do iPhone, deslizar a partir da borda esquerda
  volta a página. Os gestos precisam de uma margem nas bordas e de `touch-action: none` e
  `overscroll-behavior: none` no canvas.
- Botões virtuais ficam como alternativa de acessibilidade em Opções, não como padrão.

### 3.8 Áudio

- **Sintetizado** (base do `AudioSys` do InnoFighters, copiada e adaptada): vento (ruído filtrado, frequência e
  volume pela velocidade) é a pista sonora principal da velocidade; raspar na neve nas curvas e no agachar;
  pulo, pouso (forte, leve, torto), trilho metálico, coleta, subida de nota a cada degrau do multiplicador
  (escala pentatônica), tombo cômico (apito descendente), vozes "blablablá" por formante (perfil vocal por
  personagem). Orçamento de fontes simultâneas, como no InnoFighters.
- **CC0** onde a síntese não convence (impactos, neve fofa): Kenney e OpenGameArt, já pesquisados e usados no
  InnoFighters; LEIA-ME de créditos no mesmo modelo.
- **Música por pista:** sequenciador por partitura (padrão dos temas do InnoFighters: laço de 10 a 21 s),
  **adaptativa**: camadas entram conforme o multiplicador sobe e saem no tombo.
- **iPhone:** o `AudioContext` só destrava no primeiro toque; a chave de silencioso do iPhone pode calar o Web
  Audio (a confirmar no aparelho; testar `navigator.audioSession` quando existir).
- Regra herdada: o motor não toca som, só emite evento; `audio/` não usa `Math.random`, `Date` nem `performance`.

### 3.9 Salvamento v1 (C4) e validação no boot

Ver o contrato C4 na seção 4. Validação no boot: `exigirPersonagensValidos`, `exigirTrechosValidos`,
`exigirPistasValidas` (gera cada pista fixa e confere o `hashEsperado`), `exigirManobrasValidas`,
`exigirTextosValidos`, chamadas no import dos módulos de `data/`. `main.ts` importa esses módulos para o
tree-shaking não removê-los (lição do InnoFighters). Dado inválido = tela de erro clara no boot, nunca um jogo
meio quebrado.

---

## 4. Contratos

Não há API HTTP no MVP. Os contratos são entre camadas, e estão aqui para Vega (motor e gerador), Lyra (render,
entrada, cenas), Cronos (dados e armazenamento) e Apolo (arte) trabalharem em paralelo sem retrabalho.
Moram em `src/core/contratos.ts`, com validação nos pontos de entrada.

### C1 — manifesto de atlas (C1 v2 do InnoFighters + pivô)

`public/assets/personagens/<id>/atlas.json`. Mesmo formato do InnoFighters (versão 2: `imagens` de 1 a 8 páginas,
`tamanho`, `alturaRef`, `quadros` com `x, y, w, h, ax, p?`, `retrato?`) com **dois campos novos por quadro**:

- `contato: [x, y]` — ponto da prancha que encosta na neve (âncora no chão; o sprite gira em volta dele para
  acompanhar a inclinação).
- `pivo: [x, y]` — centro de massa (o sprite gira em volta dele no ar).

Ambos relativos ao canto do quadro, em px do atlas. Quadro sem `pivo` usa o centro da caixa. Teto de
**2 páginas de 2048x2048 por personagem** (cerca de 32 MB decodificados; a medir).

### C2 — `ComandoDescida` (um por tick)

```ts
type Grab = 'cima' | 'baixo' | 'frente' | 'tras';
interface ComandoDescida {
  pulo: boolean;       // borda de descida: verdadeiro só no tick do aperto
  giro: -1 | 0 | 1;    // segurado: -1 mortal para trás, +1 para frente
  grab: Grab | null;   // borda: o gesto ou a tecla deste tick
  agachar: boolean;    // segurado
}
```

### C3 — `LeituraDescida` e `EventoDescida`

```ts
interface LeituraDescida {
  tick: number;
  fase: 'contagem' | 'descendo' | 'tombo' | 'chegou';
  piloto: { x: number; y: number; vx: number; vy: number; velocidade: number;
            angulo: number; anguloTerreno: number;
            modo: 'chao' | 'ar' | 'trilho' | 'tombo';
            pose: IdPose; grab: Grab | null; voltas: number; ticksNoAr: number };
  combo: { ativo: boolean; manobras: IdManobra[]; soma: number; mult: number; janela: number };
  pontos: number; distancia: number; distanciaTotal: number; coletados: number;
  eventos: EventoDescida[];
}
type EventoDescida =
  | { tipo: 'pulo'; forca: number }
  | { tipo: 'pouso'; qualidade: 'perfeito' | 'bom' | 'torto'; queda: number }
  | { tipo: 'tombo'; causa: 'angulo' | 'obstaculo' | 'trilho' }
  | { tipo: 'manobra'; id: IdManobra; pontos: number }
  | { tipo: 'combo-fechado'; soma: number; mult: number; total: number }
  | { tipo: 'combo-perdido'; soma: number }
  | { tipo: 'trilho'; etapa: 'inicio' | 'fim' }
  | { tipo: 'coleta'; item: IdItem }
  | { tipo: 'boneco'; x: number }
  | { tipo: 'checkpoint'; indice: number }
  | { tipo: 'chegada'; pontos: number; ticks: number };
```

Regras (as mesmas do C3 do InnoFighters): `eventos` é esvaziado no começo de cada tick; o motor não toca som nem
cria partícula; efeitos visuais usam `rngVisual`, nunca o RNG da lógica.

### C4 — armazenamento `neve-maluca-v1`

```ts
interface SaveV1 {
  v: 1;
  cfg: { som: number; musica: number; movimentoReduzido: boolean;
         controles: 'gestos' | 'botoes'; maoEsquerda: boolean };
  prog: { desbloqueados: IdPersonagem[]; pistas: IdPista[]; flocos: number;
          objetivos: IdObjetivo[]; desconhecidos: string[] };
  recordes: Record<IdPista, Recorde[]>;   // até 5 por pista
  fantasmas?: Record<IdPista, ReplayV1>;   // melhor corrida (C6), opcional, pós-M2
  diario?: { data: string; melhor: number };
}
interface Recorde { pontos: number; ticks: number; personagem: IdPersonagem; versaoPista: string; quando: string }
```

Saneamento (modelo do C4 do InnoFighters):
- `v > 1` (build mais novo): lê em memória, **recusa gravar**, mostra "Progresso não salvo neste aparelho".
- Texto ilegível: copia para `neve-maluca-v1-quebrada` antes de substituir.
- Ids com forma válida (`/^[a-z][a-z0-9-]{1,23}$/`) fora do elenco vão para `desconhecidos` (teto 32), não são
  usados e são regravados; id que passa a existir é promovido.
- Números com teto (`TETO_PONTOS = 99_999_999`, `flocos` até 999 999), inteiros, não negativos; listas sem
  repetição e com teto; `cfg` aceita só os valores que a UI oferece; ausente = padrão.
- Recorde com `versaoPista` diferente da atual vai para "recordes antigos" (não some, não compete).
- **Mudança de formato = chave nova** (`neve-maluca-v2`), deixando a v1 intacta para um rollback de build ainda
  conseguir ler (lição da expansão do InnoFighters).
- Gravação embrulhada em try/catch (cota cheia ou navegação privada); falha vira aviso, nunca quebra o jogo.

### C5 — pista

```ts
interface DefPista {
  id: IdPista; nome: string; tema: IdTema; semente: number; comprimentoM: number;
  dificuldade: [inicio: number, fim: number];
  trechos: Partial<Record<IdTrecho, number>>;  // pesos
  musica: IdMusica; objetivos: IdObjetivo[]; hashEsperado: string;
}
interface PistaGerada {
  id: IdPista; semente: number; versaoGerador: string; dx: 0.5;
  alturas: Float64Array; objetos: ObjetoPista[]; trilhos: Trilho[];
  checkpoints: number[]; chegadaX: number; hash: string;
}
```

### C6 — replay (registro de comandos)

```ts
interface ReplayV1 {
  v: 1; pista: IdPista; hashPista: string; semente: number;
  personagem: IdPersonagem; versaoMotor: string;
  comandos: string;   // RLE em base64: cada tick = 1 byte (pulo, giro, grab, agachar), pares [byte, repetições]
  resultado: { pontos: number; ticks: number; hashFinal: string };
}
```

Serve para três coisas: **fantasma** da melhor corrida (correr contra si mesmo), **testes** (comandos gravados
reproduzem um bug) e, no futuro, **ranking online verificável** (o servidor reexecuta o replay e só aceita se
`hashFinal` bater). Tamanho estimado: centenas de bytes por corrida de 90 s (a medir).

### Contrato futuro (fora do MVP, só esboço)

`POST /api/corridas` com `ReplayV1` → `201 { posicao }` se o replay reproduz o resultado; `422` se diverge;
`429` acima do limite. `GET /api/ranking/:pista?periodo=dia|sempre` → lista paginada. Exige backend, banco,
limite de taxa e revisão do Órion. Decisão D4.

### Contratos de dados (resumo; detalhes com Cronos no M1)

- `DefPersonagem`: id, nome, bordão, atributos (`velocidadeMax`, `aceleracao`, `giro`, `equilibrio`, `pulo`) com
  **orçamento fixo** (soma constante, cada um a no máximo ±10% da média), atlas, perfil vocal, desbloqueio.
- `DefManobra`: id, família, pontos, condição, nome cômico, pose, som.
- `DefObjetivo`: id, texto, condição sobre eventos da corrida (ex.: `{ manobra: 'mortal', seguidas: 2 }`).

---

## 5. Estrutura de pastas

```
NeveMaluca/
  index.html  package.json  tsconfig.json  vite.config.ts
  playwright.config.ts  playwright.build.config.ts
  README.md  PROGRESSO.md  CHANGELOG.md
  docs/            plano (este), arquitetura.md, prompts-arte.md, como-adicionar-um-personagem.md,
                   como-adicionar-uma-pista.md, handoffs
  arte-fonte/      (gitignored) personagens/<id>/{modelo,folhas}/, objetos/
  sprites-gerados/ (gitignored) saída do pipeline antes de ir para public/
  ferramentas/
    sprites/       pipeline de folhas 4x3 para atlas C1 (copiado do InnoFighters, com contato e pivô)
    harness/       bot descendo cada pista com N sementes (npm run harness)
    pista/         desenha o perfil de uma pista em PNG para revisar sem jogar
    medir/         fps com CPU 4x e tempo até jogar (npm run medir)
  public/assets/   personagens/<id>/, objetos/, sons/, fontes/, ui/
  src/
    core/  data/  pista/  descida/  meta/  render/  audio/  input/  assets/  ui/cenas/  platform/  main.ts
  tests/
    unit/  e2e/  e2e-build/  support/  fixtures/replays/
```

Nomes das pastas iguais aos do InnoFighters onde o papel é o mesmo, para facilitar copiar e comparar.

---

## 6. Arte

### 6.1 Direção

- Personagens **originais e cômicos**, com acabamento de filme de animação 3D (volumes arredondados, luz suave,
  olhos grandes e expressivos). Só o estilo: nada de personagem, figurino ou silhueta de estúdio.
- Checklist de originalidade do Apolo em cada personagem: não lembrar personagem conhecido; **evitar pinguim
  surfista e yeti** como protagonistas (associações fortes com filmes de animação existentes).
- Cenário: degradês e silhuetas em camadas desenhados em código, com perspectiva atmosférica e luz de borda
  combinando com a luz dos personagens, para reduzir o choque de estilos (R3).

### 6.2 Elenco proposto (o dono escolhe 4, decisão D3)

| Id | Personagem | Piada | Jeito na prancha |
|---|---|---|---|
| `capivara` | KAKÁ, a capivara zen | nada a abala, nem o tombo | equilíbrio alto, giro lento |
| `tio-beto` | TIO BETO, de bermuda e chinelo | brasileiro vendo neve pela primeira vez | velocidade alta, pouso difícil |
| `vovo-turbo` | VOVÓ TURBINA, 82 anos, capacete de tricô | mais radical que os netos | giro rápido, pulo baixo |
| `madame-fondue` | MADAME FONDUE, chef chique | desce com a panela de fondue | estilo: bônus em grabs |
| `frigobot` | FRIGOBOT, geladeira-robô | desce deitado, porta abrindo no tombo | pesado, rápido na reta |
| `zeca-entregador` | ZECA, entregador de pizza | a pizza tem de chegar quente lá embaixo | aceleração alta, pulo médio |

Mascote do M1 (proposta): **KAKÁ, a capivara** — fácil de ler de perfil, cômica, sem dono conhecido, e o
equilíbrio alto perdoa quem está começando.

### 6.3 Pipeline (Runway Nano Banana, 1 referência por geração)

1. **Ficha de modelo** do personagem (frente, perfil, costas; 1 geração em 1K). O dono aprova antes de seguir.
2. **Folhas de pose 4x3 em perfil**, olhando para a direita, usando a ficha aprovada como **única** referência
   (lição: várias referências fazem o modelo copiar a referência). Saída em 2K, 4:3.
3. **Fundo magenta chapado** para a chave de recorte, e **proibido rosa e magenta** no figurino (lição do FX
   rosa da MIN-JI). **Sem sombra no chão** na arte: a sombra é desenhada pelo jogo, projetada no terreno, e é
   ela que mostra a altura do salto.
4. Pipeline (`npm run sprites -- <id>`) recorta, mede, empacota em atlas C1 com `contato` e `pivo`, gera a
   folha de conferência (contact sheet). Apolo faz a curadoria e marca as poses a refazer.
5. Refação com `referenceImages` da geração anterior, nunca do zero.
6. PNG baixado só para pasta temporária, medido e mostrado ao dono antes de ir para `arte-fonte/`.

### 6.4 Orçamento de gerações

| Item | Gerações | Quando |
|---|---|---|
| Ficha de modelo do mascote (1K) | 1 | M1 |
| Folha A do mascote (2K) + 1 refação | 2 | M1 |
| Folha de objetos (2K) | 1 | M1 |
| Folha B do mascote (grabs) | 1 | M2 |
| 3 personagens novos: ficha (1K) + folha A + folha B | 9 | M3 |
| Objetos por tema (2 folhas) | 2 | M3 |
| **Total** | **~16, sem margem para refação no M3** | |

**Não cabe** no saldo atual (cerca de 11 em 2K). Decisão do dono (D5): plano pago a partir do M3, ou elenco de
3 no M3, ou folhas 4x4 (16 poses, uma folha só por personagem, a medir se a qualidade aguenta). O M1 e o M2 cabem.

### 6.5 Assets do protótipo mínimo (M1)

- **Mascote, folha A (12 poses):** deslizando, agachado, preparando pulo, decolando, no ar neutro, encolhido
  (mortal), pousando (compressão), desequilibrado, tombo 1 (tropeça), tombo 2 (rola), tombo 3 (cara na neve),
  comemorando.
- **Folha B (M2, 12 poses):** 4 grabs, trilho, estrela (braços e pernas abertos), susto, 2 poses cômicas
  próprias, vitória, derrota, retrato.
- **Objetos (folha 4x3):** 2 pinheiros, 2 pedras, rampa, trilho, tronco, boneco de neve, bandeira de checkpoint,
  pórtico de chegada, floco coletável, placa cômica.
- **Cenário:** procedural em código (céu, 3 camadas de montanhas, floresta, neve caindo). Zero geração.
- **UI:** tipografia (fonte OFL já usada no InnoFighters), logotipo tipográfico provisório.
- **Som:** só sintetizado no M1.

---

## 7. Plano em fases

Legenda de dependência: "← M1" = precisa do M1 entregue. O dono testa no iPhone ao fim de cada marco.

### M0 — Fundação e CI (depende de D1 e D2)
- **Vulcano:** Vite + TypeScript estrito + Vitest + Playwright (Chromium e WebKit), CSP só no build, scripts
  (`dev`, `build`, `test`, `test:e2e`, `verificar`), workflow de CI pronto para quando houver remoto.
- **Vega:** `core/` (RNG, trig tabelado, hash, contratos C2 a C6 em tipos), teste de varredura de camadas e de
  funções proibidas, laço de passo fixo.
- **Lyra:** `platform/` (escala 960x540 lógico com buffer 2x, letterbox, foco, orientação), cena vazia.
- **Cronos:** `storage.ts` v1 com saneamento e testes.
- **Íris:** valida o portão.
- **Pronto quando:** build e testes verdes; canvas vazio a 60 fps com CPU 4x; JS inicial ≤ 60 KB gzip.

### M1 — Protótipo de descida: 1 personagem, 1 pista (← M0)
- **M1a, cinza (sem arte):** Vega faz gerador de pista, física, colisão, tombo, checkpoint, chegada e bot;
  Lyra faz câmera, terreno, parallax procedural, piloto como cápsula, toque e teclado, HUD de velocidade e
  pontos, cena de resultado. **Portão do dono: a sensação de descer está boa?** Só depois disso gasta-se arte.
- **M1b, arte:** Apolo faz ficha + folha A do mascote + objetos; Vega adapta o pipeline (contato e pivô);
  Lyra integra; Vega faz vento, pulo, pouso e tombo sintetizados.
- **Cronos:** `DefPista`, catálogo inicial de ~8 trechos, `DefPersonagem`, validação no boot, recordes.
- **Íris:** determinismo (5400 ticks), gerador (hash fixo), toque em e2e, portões de desempenho.
- **Pronto quando:** descida completa de 60 a 90 s; tempo até jogar e fps dentro das metas da seção 8; bot
  conclui a pista em 100 de 100 sementes; o dono jogou no iPhone.

### M2 — Manobras e combos (← M1)
- **Vega:** mortais com contagem de voltas, grabs, trilho, janela de pouso, combo, multiplicador, pontuação,
  objetivos; replay C6 e fantasma; harness com bot "ousado".
- **Lyra:** gestos de grab e giro, textos de manobra na tela, barra do combo, tela de objetivos.
- **Apolo:** folha B do mascote; nomes cômicos das manobras com Lyra.
- **Vega (áudio):** sons das manobras, escada do multiplicador, música adaptativa da pista 1.
- **Íris:** cada manobra disparada por comandos gravados; gestos sintéticos no e2e.
- **Pronto quando:** todas as manobras executáveis por replay gravado; gesto reconhecido em ≥ 95% dos casos
  sintéticos; o dono faz um mortal nos primeiros 30 s sem explicação (teste de olho, relatado por ele).

### M3 — 5 pistas e 4 personagens (← M2, ← D3, ← D5)
- **Cronos:** 5 `DefPista` com temas (ex.: bosque, parque de manobras, noite com lanternas, avalanche
  cômica, cidade de neve), ~20 trechos no catálogo, regras de desbloqueio, flocos, objetivos por pista.
- **Apolo:** 3 personagens novos (ficha + folhas), objetos por tema, paletas por tema.
- **Vega:** obstáculos novos, orçamento de atributos validado, vozes por personagem, 5 temas musicais.
- **Lyra:** seleção de personagem e de pista, telas de desbloqueio, recordes.
- **Íris:** harness em todas as pistas e personagens.
- **Pronto quando:** cada pista com hash fixo e harness verde; nenhum personagem com vantagem acima de 10% de
  pontuação média no harness; até 2 atlas de personagem na memória ao mesmo tempo.

### M4 — Polimento mobile (← M3)
- **Lyra:** áreas seguras (entalhe da tela), paisagem forçada com aviso em retrato, manifesto de PWA para
  "Adicionar à Tela de Início" (tela cheia de verdade no iPhone; a confirmar no aparelho), tela acesa durante
  a corrida (Screen Wake Lock, quando houver), qualidade adaptativa (menos partículas e buffer 1x se o fps cair),
  movimento reduzido, botões alternativos.
- **Apolo:** "suco" visual: partículas, quadros-chave de tombo, tela de resultado.
- **Íris:** matriz de aparelhos, sessão de 30 min sem crescer memória.
- **Pronto quando:** metas da seção 8 confirmadas no iPhone real pelo dono.

### M5 — Deploy (← M4)
- **Órion:** auditoria (CSP, armazenamento, entrada de dados de save, cabeçalhos, mapa de código oculto).
- **Vulcano:** Pages temporário (se D8 permitir) e depois EasyPanel com CSP em cabeçalho HTTP e rollback.
- **Alexandria:** README, arquitetura, como adicionar personagem e pista, CHANGELOG.
- **Pronto quando:** site no ar com cabeçalhos conferidos; rollback testado.

**Contínuo:** Nova revisa o início de cada marco e os contratos; Alexandria atualiza docs ao fim de cada marco.

---

## 8. Critérios medíveis

| Métrica | Meta | Como medir |
|---|---|---|
| FPS | mediana ≥ 58 e p95 do quadro ≤ 20 ms numa descida de 60 s | Playwright Chromium com CPU 4x (CDP `Emulation.setCPUThrottlingRate`), bot rodando um replay fixo; no iPhone, sobreposição `?medir=1` que o dono lê |
| Tempo até jogar (frio) | título interativo ≤ 3 s; toque em JOGAR até o primeiro tick controlável ≤ 1 s | marcas `performance.mark` + CDP com rede simulada de 4G (9 Mbps, 170 ms) e CPU 4x |
| Toques até jogar | ≤ 2 do título; "de novo" = 1 | e2e |
| Peso até o título | ≤ 1,5 MB | relatório do build + e2e contando bytes |
| Peso até a 1ª descida | ≤ 3 MB | idem |
| JS | ≤ 150 KB gzip no M5 | relatório do build |
| Memória de imagens | ≤ 150 MB decodificados | soma de páginas carregadas (largura × altura × 4) |
| Determinismo | mesmo hash em 5400 ticks, 2 rodadas e 2 navegadores (Chromium e WebKit) | Vitest + Playwright |
| Pista | hash fixo; bot cuidadoso conclui 100%; duração 60-90 s | harness |

**Limite da medição:** CPU 4x no Chromium do PC é aproximação, não é o WebKit do iPhone. O número que vale para
o portão é o lido no aparelho do dono. Playwright WebKit no Windows serve para compatibilidade, não para fps.

---

## 9. Decisões em aberto (do dono)

| # | Decisão | Opções | Minha recomendação | Bloqueia |
|---|---|---|---|---|
| D1 | Câmera e caminho técnico | A lateral 2,5D; B 3D atrás (Three.js); C híbrido | **A** | M0 e qualquer arte |
| D2 | Orientação | paisagem; retrato; as duas | paisagem (mais pista visível à frente) | M0 |
| D3 | Elenco | escolher 4 da tabela 6.2 (e o mascote do M1) | KAKÁ como mascote | M1b, M3 |
| D3b | Medidor de maluquice | sim no M2; depois; não | depois do M2 | M2 |
| D4 | Ranking | só local; online depois do M5 (backend + anti-trapaça) | local; C6 já prepara o online | nada no MVP |
| D5 | Orçamento de arte do M3 | plano pago; 3 personagens; folhas 4x4 | decidir ao fim do M2, com a qualidade das folhas na mão | M3 |
| D6 | Idioma | só pt-BR; pt-BR + inglês | pt-BR, textos já em tabela | nada |
| D7 | Desafio do dia | sim; não | sim (barato, dá motivo para voltar) | M3 |
| D8 | Repositório remoto e site de teste | criar no M0; criar no M1 | no M1, quando houver algo para testar no celular | teste no iPhone |
| D9 | Logotipo | tipográfico provisório; Apolo desenha no M4 | provisório até o M4 | nada |
| D10 | Toque | gestos (padrão) com botões opcionais; só botões | gestos, botões em Opções; agachar no toque só se o M1a mostrar falta | M1a |

---

## 10. Riscos

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | Personagem muda de cara entre poses (geração de imagem) | alta | alto | ficha de modelo aprovada antes; 1 referência; folhas 4x3; curadoria com contact sheet; refação a partir da geração anterior |
| R2 | Gerações não bastam para o elenco | alta | médio | orçamento da 6.4; cenário em código; D5 antes do M3 |
| R3 | Personagem "3D" destoa do cenário plano | média | médio | luz e paleta comuns; perspectiva atmosférica; validar no M1b com o dono |
| R4 | Fps baixo no iPhone (camadas cheias de tela, partículas) | média | alto | camadas pré-desenhadas em canvas fora da tela; sem `shadowBlur`/`filter`; teto de partículas; qualidade adaptativa; plano B PixiJS só em `render/` |
| R5 | A física não é divertida | média | alto | M1a cinza com portão do dono antes de qualquer arte; constantes em dados; harness |
| R6 | Gesto conflita com o navegador (voltar pela borda, zoom de duplo toque) | média | alto | margem nas bordas, `touch-action`, `overscroll-behavior`, teste no aparelho no M1a |
| R7 | Áudio mudo no iPhone (destravar, chave de silencioso) | média | médio | destravar no primeiro toque; aviso discreto; testar no aparelho |
| R8 | Replay diverge entre aparelhos | baixa no MVP | alto no ranking online | trig tabelado; varredura de funções proibidas; teste Chromium x WebKit |
| R9 | Mudança no gerador invalida recordes | média | médio | `hashEsperado` + `versaoPista` no recorde |
| R10 | Escopo cresce (online, loja, 3D) | média | alto | MVP sem backend; C6 como única preparação; D4 depois do M5 |
| R11 | Sem tela cheia no iPhone pelo navegador | alta | baixo | PWA na tela inicial (a confirmar); layout que funciona com a barra visível |
| R12 | Cópias do InnoFighters divergem com o tempo | alta | baixo | nota de origem no cabeçalho; pacote comum só com um terceiro jogo |

**Dívidas conscientes:** sem ranking online; sem modo livre; cenário procedural (não pintado) no MVP; um idioma;
sem háptica (o iPhone não expõe vibração ao navegador).
