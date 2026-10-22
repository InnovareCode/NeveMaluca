# src/render/

**Dono:** Lyra. **Estado no M0:** vazio.

**Responsabilidade (plano §3.6, risco R4):** câmera, terreno, cenário procedural em camadas (parallax), personagem,
objetos, partículas (`rngVisual`), HUD, textos de manobra e efeitos de velocidade. Só lê o estado do motor, nunca o altera.

**Importa de:** `core/`, `data/`, `assets/`.

**Regras de desempenho (o portão é o iPhone):** camadas pré-desenhadas em canvas fora da tela; sem `shadowBlur` nem
`filter`; teto de partículas. Esta camada fica isolada para poder ser trocada por PixiJS se o fps não passar.
