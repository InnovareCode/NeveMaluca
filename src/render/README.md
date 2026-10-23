# src/render/

**Dono:** Lyra. **Estado na Fase 2:** entregue com cenários e iluminação estilo animação 3D / Pixar para o Morro do Pinhão (docs/direcao-arte-neve-maluca.md §2.1 e §2.2).

**Responsabilidade (plano §3.6, §7, risco R4):** câmera, terreno, cenário procedural em camadas (parallax), partículas e rastro, piloto, objetos, HUD. Só lê o estado do motor (`PilotoLeitura`/`EstadoCamera`), nunca o altera.

**Importa de:** `core/` (e `data/`, `assets/`).

| Arquivo | O que faz |
|---|---|
| `mundo.ts` | `mundoParaTela`: metros (y para cima) -> px lógicos (y para baixo), com a câmera e o zoom aplicados |
| `camera.ts` | `criarCamera`: mola com amortecimento crítico (olhar à frente por `vx`), zoom por velocidade, tremida no pouso/tombo via `rngVisual` |
| `terreno.ts` | `desenharTerreno`/`alturaDoTerreno`: neve volumosa com manta superior iluminada (#F7FBFF) e corpo em sombra (#BFD9EE), acabamento limpo sem artefatos de stroke no WebKit |
| `parallax.ts` | `criarParallax`: céu degradê (#4FA8F0 -> #BFE6FF) com sol alto à esquerda, montanhas distantes e médias facetadas, floresta com araucárias e pinheiros nevados (#2E6B3A + branco) e celeiro alpino vermelho (#B83A2B) |
| `particulas.ts` | `criarSistemaParticulas`: flocos de neve em camadas de profundidade (fundo e frente) e spray de neve saindo da prancha no chão em pool circular pré-alocado |
| `objetos.ts` | `desenharObjetos`/`desenharTrilhos`: `ObjetoPista` e `Trilho` (grind) apoiados no terreno, pela pele do tema (`PintorTema`, default bosque) |
| `temas/tipos.ts` | `PintorTema` (plano M3 §B.3): contrato do DESENHO de um tema — `construirCamadas`/`desenharObjeto`/`desenharTrilho` |
| `temas/bosque.ts` | Pele do Morro do Pinhão (tema `bosque`), extraída de `parallax.ts`/`objetos.ts` sem mudar pixel (M3-F4). `TEMA_BOSQUE` (`DefTema`) + `pintorBosque` (`PintorTema`). Novos temas do M3 (parque/vila/vulcao/cume) entram aqui do lado, um arquivo por tema |
| `piloto.ts` | `desenharPiloto`: renderiza sprite com ancoragem de contato/pivô ou cápsula de fallback |
| `hud.ts` | `desenharHud`: velocidade (km/h), pontos e a barra de combo (xMULT + soma, janela de ligação como barra que esvazia); aviso "PREPARA..." na contagem |
| `manobra.ts` | `criarSistemaPopupsManobra` (M2): popups de texto que sobem e somem a cada evento `manobra`/`combo-fechado`/`combo-perdido`, mesmo padrão de pool fixo do `particulas.ts`. Nomes de exibição são PROVISÓRIOS — ver TODO no arquivo (definitivos são do Apolo) |

**Regras de desempenho (o portão é o iPhone):** camadas de montanha e floresta pré-desenhadas em canvas fora da tela (uma vez, não a cada quadro — lição do boot.ts); sem `shadowBlur` nem `filter`. Sistema de partículas em pool circular de 128 instâncias reutilizadas, zero alocação de objetos por quadro.

**Regra de determinismo que vale aqui também:** `Math.random` é proibido em TODA `src/` (varredura de `tests/unit/arquitetura.test.ts`); qualquer aleatoriedade visual usa `criarRng`/`rngDoCanal` do canal `visual` (plano §3.3). `Math.sin/cos/atan2/pow` SÃO permitidos em `render/` (a regra de trig tabelada só vale em `core/pista/descida`, o núcleo determinístico do replay).
