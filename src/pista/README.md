# src/pista/

**Dono:** Vega. **Estado no M1a:** gerador pronto (`catalogo.ts` com 8 trechos, `gerador.ts`, `consulta.ts`). Ver
`docs/handoff-vega-m1a.md` para a API e as decisões de física/geração tomadas.

**Responsabilidade (plano §3.4, contrato C5):** gerador **puro** da pista. Semente + `DefPista` = `PistaGerada`
(perfil de altura a cada 0,5 m em `Float64Array`, objetos, trilhos, checkpoints, chegada e hash).

**Importa de:** `core/`, `data/`.

**Regras:** determinístico. Sem `Math.random`, `Date`, `performance`, nem `Math.sin/cos/atan2/pow/exp` (usar
`core/trig.ts`). Um teste de varredura (Vega) guarda isso. Mudança proposital do gerador muda os hashes fixos.
