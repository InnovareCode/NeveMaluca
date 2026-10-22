# src/audio/

**Dono:** Vega. **Estado no M0:** só o destrave (`audio-destravavel.ts`); nenhum som ainda.

**Responsabilidade (plano §3.8):** áudio sintetizado (vento pela velocidade, pulo, pouso, tombo, vozes "blablablá"),
música por pista e eventos para som. Base: `AudioSys` do InnoFighters, copiado e adaptado.

**Importa de:** `core/`, `data/`.

| Arquivo | O que faz | Origem |
|---|---|---|
| `audio-destravavel.ts` | `AudioDestravavel`: `ctx` (nulo até o 1º gesto), `init()` (cria o `AudioContext`, uma vez), `resume()` (religa `suspended`/`interrupted`; engole a rejeição da promessa) | adaptado de `AudioSys` (`init`, `resume`, `contextoDoNavegador`) do InnoFighters |

**Como se liga:** `main.ts` faz `desbloquearAudio(window, new AudioDestravavel())` (`platform/audio-desbloqueio.ts`). O contexto só nasce
dentro de `touchend`/`pointerup`/`mouseup`/`click`/`keydown` (o iOS ignora `touchstart`). `platform/` define a interface `AudioDestravavel`
(`ctx`, `init`, `resume`); a classe daqui a satisfaz por estrutura, sem importar `platform/` (a camada `audio` só importa `core` e `data`).
Aparelho sem Web Audio: `ctx` fica nulo e nada quebra. Quando entrarem os sons, o grafo de ganho nasce no `init()` (como no `AudioSys`).

**Regras:** sem `Math.random`, `Date`, `performance` nem timers (varredura em `tests/unit/arquitetura.test.ts`). O `AudioContext` só destrava no
primeiro toque (iPhone). A CSP libera `media-src blob:` e nenhum áudio externo.
