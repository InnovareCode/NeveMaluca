# src/audio/

**Dono:** Vega. **Estado no M2:** destrave (M0) + som das manobras/combo sintetizado. Vento/pulo/pouso/tombo/vozes
e música adaptativa ainda não entraram (plano §3.8, resto do backlog).

**Responsabilidade (plano §3.8):** áudio 100% sintetizado (sem arquivo — a CSP só libera `self`/`blob:`), música por
pista e eventos para som. Base: `AudioSys` do InnoFighters, copiado e adaptado.

**Importa de:** `core/`, `data/`.

| Arquivo | O que faz | Origem |
|---|---|---|
| `audio-destravavel.ts` | `AudioDestravavel`: `ctx` (nulo até o 1º gesto), `init()` (cria o `AudioContext`, uma vez), `resume()` (religa `suspended`/`interrupted`; engole a rejeição da promessa) | adaptado de `AudioSys` (`init`, `resume`, `contextoDoNavegador`) do InnoFighters |
| `sintese.ts` | Primitivas puras `tom`/`ruido` (oscilador/ruído branco + envelope + filtro opcional) e `criarBufferRuido`; `ContextoSintese` é o subconjunto PRÓPRIO de `AudioContext` que elas usam (testável em Node, sem `AudioContext` de verdade) | adaptado de `AudioSys.tone`/`AudioSys.noise` do InnoFighters, sem estado de instância |
| `som-manobras.ts` | `criarSomManobras(audio, rng, opcoes)`: `aoEvento(evento)`/`atualizar({eventos})` tocam o som de `manobra` (ar/mortal/grab/trilho, cada um com timbre próprio), a "escada" de `combo-fechado` (uma nota por nível de `mult`, subindo) e o som de `combo-perdido` | novo (M2) |

**Como se liga:** `main.ts` faz `desbloquearAudio(window, new AudioDestravavel())` (`platform/audio-desbloqueio.ts`). O contexto só nasce
dentro de `touchend`/`pointerup`/`mouseup`/`click`/`keydown` (o iOS ignora `touchstart`). `platform/` define a interface `AudioDestravavel`
(`ctx`, `init`, `resume`); a classe daqui a satisfaz por estrutura, sem importar `platform/` (a camada `audio` só importa `core` e `data`).
Aparelho sem Web Audio: `ctx` fica nulo e nada quebra.

`criarSomManobras` É QUEM TOCA o som dos eventos de `LeituraDescida` (contrato C3, `core/contratos.ts`) — ver a
seção "Como instanciar" no handoff do M2 (`docs/` ou o handoff da Vega) para o ponto exato em `ui/cenas/descida.ts`.
Em resumo: `const somManobras = criarSomManobras(audio, rngDoCanal(pista.semente, 'audio'), { obterVolumeSom: () => save.cfg.som });`
uma vez por corrida (mesmo `audio` do destrave), e a cada tick `somManobras.atualizar(leitura)` (ou `aoEvento` por
evento, se o chamador já itera `leitura.eventos` para outra coisa, tipo o `render/manobra.ts`).

**Regras:** sem `Math.random` (use `rng`/`rngDoCanal(semente, 'audio')`), `Date`, `performance` nem timers (varredura em
`tests/unit/arquitetura.test.ts`) — por isso a síntese agenda tudo pelo relógio do próprio `AudioContext`
(`ctx.currentTime` + offsets), nunca `setTimeout`/`setInterval`. O `AudioContext` só destrava no primeiro toque
(iPhone). A CSP libera `media-src blob:` e nenhum áudio externo.
