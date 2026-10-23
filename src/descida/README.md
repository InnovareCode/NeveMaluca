# src/descida/

**Dono:** Vega. **Estado no M1a:** motor de física/colisão/tombo/checkpoint/chegada e bot "cuidadoso" prontos
(`motor.ts`, `bot.ts`, `constantes.ts`). Manobras pontuadas, combo e multiplicador são M2 (`combo`/`pontos` em
`LeituraDescida`, ver `docs/handoff-vega-m1a.md`).

**Replay/fantasma (C6, M2):** `replay.ts` tem `criarReprodutorFantasma(replay, pista)` — roda um 2º `criarDescida`
alimentado pelos comandos decodificados do `ReplayV1` (`core/replay.ts`), tick a tick, devolvendo só a
`PilotoLeitura` (`avancar()`, `null` quando acaba). Quem GRAVA o replay é `ui/cenas/descida.ts` (acumula os
`ComandoDescida` e monta o `ReplayV1` na chegada); quem PERSISTE (recorde + fantasma, 1 por pista, só quando bate o
\#1) é `ui/cenas/gerenciador.ts` (`inserirRecorde`/`inserirFantasma` de `meta/storage.ts`). `VERSAO_MOTOR`
(`constantes.ts`) identifica qual física gravou o replay — bump ao mudar algo que muda o resultado de uma corrida
já gravada.

**Responsabilidade (plano §3.3, §3.5, contratos C2/C3/C6):** o motor puro da descida: física, colisão, reconhecimento
de manobras, combo, pontuação, bot e replay. Consome `ComandoDescida` (um por tick), produz `LeituraDescida` e eventos.

**Importa de:** `core/`, `data/`, `pista/`.

**Proibido aqui:** DOM, áudio, render, `Math.random`, `Date`, `performance`, `Math.sin/cos/atan2/pow/exp`
(usar `core/trig.ts`; `+ - * /` e `Math.sqrt` são exatos e podem). O motor emite evento, não toca som nem cria partícula.
