# src/pista/

**Dono:** Vega. **Estado no M1a:** gerador pronto (`catalogo.ts` com 8 trechos, `gerador.ts`, `consulta.ts`). Ver
`docs/handoff-vega-m1a.md` para a API e as decisões de física/geração tomadas.

**M3 F3:** `catalogo.ts` ganhou 4 trechos-assinatura do Pico do Picolé (`kicker-duplo`, `palito-longo`, `vao-calda`,
`carrinhos`), acrescentados ao FIM do array (regra do F0: nunca reordenar nem editar um trecho existente — o hash
do Morro continua travado em `tests/unit/pista-gerador.test.ts`).

**Responsabilidade (plano §3.4, contrato C5):** gerador **puro** da pista. Semente + `DefPista` = `PistaGerada`
(perfil de altura a cada 0,5 m em `Float64Array`, objetos, trilhos, checkpoints, chegada e hash).

**Importa de:** `core/`, `data/`.

**Regras:** determinístico. Sem `Math.random`, `Date`, `performance`, nem `Math.sin/cos/atan2/pow/exp` (usar
`core/trig.ts`). Um teste de varredura (Vega) guarda isso. Mudança proposital do gerador muda os hashes fixos.
