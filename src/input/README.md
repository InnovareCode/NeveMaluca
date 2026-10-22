# src/input/

**Dono:** Lyra. **Estado no M0:** vazio.

**Responsabilidade (plano §3.7, contrato C2):** teclado, gamepad e toque com reconhecimento de gestos. Tudo vira
`ComandoDescida`; o motor nunca vê tecla nem toque. O canvas e o `body` já têm `touch-action: none` e
`overscroll-behavior: none` em `src/estilo.css` (risco R6); gestos precisam de margem nas bordas.

**Importa de:** `core/`.
