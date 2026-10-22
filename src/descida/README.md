# src/descida/

**Dono:** Vega. **Estado no M1a:** motor de física/colisão/tombo/checkpoint/chegada e bot "cuidadoso" prontos
(`motor.ts`, `bot.ts`, `constantes.ts`). Manobras pontuadas, combo, multiplicador e replay (C6) são M2 — `combo` e
`pontos` em `LeituraDescida` já existem no contrato mas ainda são placeholders estáveis (ver `docs/handoff-vega-m1a.md`).

**Responsabilidade (plano §3.3, §3.5, contratos C2/C3/C6):** o motor puro da descida: física, colisão, reconhecimento
de manobras, combo, pontuação, bot e replay. Consome `ComandoDescida` (um por tick), produz `LeituraDescida` e eventos.

**Importa de:** `core/`, `data/`, `pista/`.

**Proibido aqui:** DOM, áudio, render, `Math.random`, `Date`, `performance`, `Math.sin/cos/atan2/pow/exp`
(usar `core/trig.ts`; `+ - * /` e `Math.sqrt` são exatos e podem). O motor emite evento, não toca som nem cria partícula.
