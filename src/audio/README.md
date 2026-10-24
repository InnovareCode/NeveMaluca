# src/audio/

**Dono:** Vega. **Estado:** destrave (M0) + game feel completo 100% sintetizado — manobras/combo (M2), música
adaptativa (M2), pulo/pouso/tombo/coleta/chegada (descida), itens da corrida e contagem 3-2-1. Vozes ainda não
entraram (plano §3.8, resto do backlog).

**Responsabilidade (plano §3.8):** áudio 100% sintetizado (sem arquivo — a CSP só libera `self`/`blob:`), música por
pista e eventos para som. Base: `AudioSys` do InnoFighters, copiado e adaptado.

**Importa de:** `core/`, `data/`.

| Arquivo | O que faz | Origem |
|---|---|---|
| `audio-destravavel.ts` | `AudioDestravavel`: `ctx` (nulo até o 1º gesto), `init()` (cria o `AudioContext`, uma vez), `resume()` (religa `suspended`/`interrupted`; engole a rejeição da promessa) | adaptado de `AudioSys` (`init`, `resume`, `contextoDoNavegador`) do InnoFighters |
| `sintese.ts` | Primitivas puras `tom`/`ruido` (oscilador/ruído branco + envelope + filtro opcional) e `criarBufferRuido`; `ContextoSintese` é o subconjunto PRÓPRIO de `AudioContext` que elas usam (testável em Node, sem `AudioContext` de verdade) | adaptado de `AudioSys.tone`/`AudioSys.noise` do InnoFighters, sem estado de instância |
| `som-manobras.ts` | `criarSomManobras(audio, rng, opcoes)`: `aoEvento(evento)`/`atualizar({eventos})` tocam o som de `manobra` (ar/mortal/grab/trilho, cada um com timbre próprio), a "escada" de `combo-fechado` (uma nota por nível de `mult`, subindo) e o som de `combo-perdido` | M2 |
| `musica-adaptativa.ts` | `criarMusicaAdaptativa(audio, rng, opcoes)`: trilha de fundo que reage a velocidade/combo (4 níveis de intensidade) | M2 |
| `som-descida.ts` | `criarSomDescida(audio, rng, opcoes)`: `aoEvento`/`atualizar({eventos})` tocam `pulo` (whoosh proporcional à força; kicker ganha uma 2ª camada acima de `LIMIAR_IMPULSO_KICKER`), `pouso` (perfeito/bom/torto, 3 timbres), `tombo`, `coleta` (floco/dourado) e `chegada` (fanfarra); `atingido` (acerto SOFRIDO por item) também mora aqui — é o próprio motor do corredor que emite | game feel 2026-10-24 |
| `som-itens.ts` | `criarSomItens(audio, rng, idJogador, opcoes)`: `aoEvento`/`atualizar(eventos)` sobre `EventoCorrida`, filtrado por `idJogador` (só o que ele faz/sofre toca som) — caixa pega + roleta cosmética, uso de cada item (6 timbres, um por `TipoItem`), acerto DADO, bloqueio do escudo e desvio | game feel 2026-10-24 |
| `som-contagem.ts` | `criarSomContagem(audio, opcoes)`: `atualizar(ticksContagem)` toca um beep por número da contagem "3-2-1-JÁ" (ver `ui/cenas/contagem.ts`) — não reage a evento nenhum, só ao contador de ticks da cena | game feel 2026-10-24 |

**Como se liga:** `main.ts` faz `desbloquearAudio(window, new AudioDestravavel())` (`platform/audio-desbloqueio.ts`). O contexto só nasce
dentro de `touchend`/`pointerup`/`mouseup`/`click`/`keydown` (o iOS ignora `touchstart`). `platform/` define a interface `AudioDestravavel`
(`ctx`, `init`, `resume`); a classe daqui a satisfaz por estrutura, sem importar `platform/` (a camada `audio` só importa `core` e `data`).
Aparelho sem Web Audio: `ctx` fica nulo e nada quebra.

`criarSomManobras`/`criarSomDescida`/`criarMusicaAdaptativa` TOCAM o som dos eventos de `LeituraDescida` (contrato
C3) — ver `ui/cenas/descida.ts`/`corrida.ts` para o ponto exato de ligação. Os 3 compartilham o MESMO
`rngDoCanal(pista.semente, 'audio')` (consumido em ordem fixa a cada tick: manobras -> descida -> música -> itens).
Em resumo, uma vez por corrida:
```
const rngAudio = rngDoCanal(pista.semente, 'audio');
const somManobras = criarSomManobras(audio, rngAudio, { obterVolumeSom: () => save.cfg.som });
const somDescida = criarSomDescida(audio, rngAudio, { obterVolumeSom: () => save.cfg.som });
const musicaAdaptativa = criarMusicaAdaptativa(audio, rngAudio, { obterVolumeMusica: () => save.cfg.musica });
const somContagem = criarSomContagem(audio, { obterVolumeSom: () => save.cfg.som });
// só em ui/cenas/corrida.ts (EventoCorrida só existe lá):
const somItens = criarSomItens(audio, rngAudio, idJogador, { obterVolumeSom: () => save.cfg.som });
```
e a cada tick `somManobras.atualizar(leitura)` / `somDescida.atualizar(leitura)` / `musicaAdaptativa.atualizar(leitura)`
/ `somItens?.atualizar(leitura.eventosCorrida ?? [])`; `somContagem.atualizar(ticksContagem)` só durante a janela da
contagem (ver `ui/cenas/contagem.ts`). Todos aceitam `aoEvento` por evento, se o chamador já itera
`leitura.eventos` para outra coisa (tipo `render/manobra.ts`).

**Regras:** sem `Math.random` (use `rng`/`rngDoCanal(semente, 'audio')`), `Date`, `performance` nem timers (varredura em
`tests/unit/arquitetura.test.ts`) — por isso a síntese agenda tudo pelo relógio do próprio `AudioContext`
(`ctx.currentTime` + offsets), nunca `setTimeout`/`setInterval`. O `AudioContext` só destrava no primeiro toque
(iPhone). A CSP libera `media-src blob:` e nenhum áudio externo.
