# src/core/

**Dono:** Vega. **Estado no M0:** entregue (RNG, trig tabelado, hash, constantes, contratos C2/C3/C5/C6, replay, laço de passo fixo, validação do boot).
O armazenamento C4 (`neve-maluca-v1`) ficou em `src/meta/storage.ts` (Cronos), não aqui. API pública e decisões: `docs/handoff-vega-m0.md`.

**Responsabilidade (plano §3.1):** a base de todas as camadas. Nada daqui importa de fora de `core/`.

| Arquivo | O que tem |
|---|---|
| `constantes.ts` | 960x540 lógico, buffer 2x, 60 Hz, acumulador 100 ms, `DX_PISTA_M`, canais de RNG, tetos de dado externo, `FORMA_ID` |
| `rng.ts` | `criarRng` (mulberry32, `estado()` serializável), `rngDoCanal`, `sementeAleatoria(fonte)` |
| `trig.ts` + `trig-tabelas.ts` | `seno`, `cosseno`, `atan2` em GRAUS por tabela com interpolação inteira; hash das tabelas conferido no import |
| `hash.ts` | FNV-1a 64 bits: `criarHasher`, `hashDeTexto`, `hashDeFloat64s`, `hashDeValor`, `exigirHashIgual` |
| `contratos.ts` | tipos C2 (`ComandoDescida`, `InputFrame`), C3 (`LeituraDescida`, `EventoDescida`), C5 (`DefPista`, `PistaGerada`), C6 (`ReplayV1`) |
| `comandos.ts` | comando neutro, `derivarComando` (borda do pulo), byte do comando, validação de comando/InputFrame |
| `replay.ts` | `codificarComandos`/`decodificarComandos` (RLE + base64, estrito), `validarReplayV1` |
| `laco.ts` | `criarLaco`: passo fixo com acumulador; o relógio entra por parâmetro |
| `erros.ts`, `validacao.ts` | `Resultado`, `ErroDeContrato`, `exigirCoreValido` (boot) |

**Regras (guardadas por `tests/unit/arquitetura.test.ts`):** sem DOM, sem `Math.random`, `Date`, `performance`, timers nem `crypto` global.
No motor, no gerador e aqui: nada de `Math.sin/cos/atan2/pow/exp/log/hypot` nem do operador `**` (use `core/trig.ts`).
`Math.sqrt`, `abs`, `floor`, `round`, `min`, `max`, `imul` são permitidos (exatos pelo padrão).

**Ligação no app (integração do M0):** `main.ts` importa `./core` (o barril), que roda `exigirCoreValido()` no import; `platform/constantes.ts` re-exporta
`core/constantes` (`LARGURA`, `ALTURA`, `RS`, `LARGURA_BUFFER`, `ALTURA_BUFFER`, `PASSO_MS`, `ACUMULADOR_MAXIMO_MS`). O `criarLaco` daqui ainda não é usado pelo app
(entra com `descida/` no M1); a `platform/laco.ts` é o laço de rAF (ver `src/platform/README.md`).
