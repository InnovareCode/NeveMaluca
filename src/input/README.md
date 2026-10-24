# src/input/

**Dono:** Lyra. **Estado no M1a:** entregue (teclado + toque; gamepad pendente, ver handoff).

**Responsabilidade (plano §3.7, contrato C2):** teclado e toque com reconhecimento de gestos, tudo virando
`ComandoDescida`. O motor nunca vê tecla nem toque. O canvas e o `body` já têm `touch-action: none` e
`overscroll-behavior: none` em `src/estilo.css` (fora desta pasta); o risco R6 (deslize na borda volta a página
no Chrome do iPhone) tem uma segunda mitigação aqui: `preventDefault` sempre + margem nas bordas sem giro.

**Importa de:** `core/` (tipos do C2 e `derivarComando`/`INPUT_NEUTRO` de `core/comandos`).

| Arquivo | O que faz |
|---|---|
| `teclado.ts` | `criarEntradaTeclado`: Espaço/↑ pulo, ←/→ giro, Z/X/C/V grab, ↓ agachar, E usar item (borda, I4b), Esc/P pausa (callback) |
| `toque.ts` | `criarEntradaToque`: Pointer Events (não `TouchEvent` — unifica dedo/mouse, mais fácil de testar). 1º dedo: tocar = pulo; segurar metade esquerda/direita = giro; deslizar (limiar em até ~150 ms) = grab; margem nas bordas sem giro (R6). 2º dedo (I4): agachar enquanto pressionado, independente do 1º. `opcoes.botaoItem` (I4b): zona lógica que intercepta QUALQUER ponteiro antes de pulo/agachar — 3º slot, só tap/borda |
| `index.ts` | `criarEntrada`: combina teclado + toque num só `Entrada.obterComando()` (já com a borda do pulo derivada) + `usarItemBorda()` (teclado E + tap do botão + botão de ombro do controle, I4b) |

**Por que Pointer Events, não `TouchEvent`:** mesma API cobre dedo, mouse e caneta (o dev no PC também consegue
testar sem emulador de toque); `new PointerEvent(...)` é construível em qualquer motor para teste sintético,
enquanto `TouchEvent`/`Touch` têm suporte mais irregular fora do Chromium.

**Testabilidade:** `AlvoTeclado`/`AlvoToque` são subconjuntos ESTRUTURAIS de `Window`/`HTMLCanvasElement` (mesma
ideia do `AlvoFoco` de `platform/foco.ts`): os testes unitários passam objetos falsos, sem precisar de jsdom
(o `vitest` deste projeto roda em `environment: 'node'`).

**Pendências (ver handoff da Lyra, M1a):**
- Gamepad (tabela do plano §3.7 tem uma coluna "Controle") não entrou no M1a: não bloqueia o portão do M1a
  ("a sensação de descer está boa?" é testado por toque/teclado) e fica para quando houver necessidade real.
- Risco R6 (deslize na borda) mitigado no código, mas o plano marca como "a confirmar no aparelho" — só o dono
  testando no iPhone de verdade fecha isso.
- Agachar no toque (I4, 2026-10-24): entrou multi-toque — 2º dedo pressionado = agachar, independente do 1º. Não
  precisou de posição/gesto (diferente do giro): é só presença/ausência do 2º ponteiro.
- Usar item (I4b, 2026-10-24): tecla E, 3º slot de ponteiro dedicado a `opcoes.botaoItem` (toque) e botão de ombro
  do controle (`navigator.getGamepads`, melhor esforço) — os três combinados em `Entrada.usarItemBorda()`
  (`index.ts`). Nunca entra em `InputFrame`/`ComandoDescida` (contrato de Vega): é lido direto por
  `ui/cenas/corrida.ts` pra montar `ComandoCorrida.usarItem`, mesmo padrão lateral de `aoPausar`.
