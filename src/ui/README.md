# src/ui/

**Dono:** Lyra. **Estado pós-integração do M1a:** `tipos.ts` (interface `Cena`), `cenas/boot.ts` (M0, sem uso em
produção desde a integração — `main.ts` agora monta `criarCenaJogo`) e `cenas/{descida,resultado,jogo}.ts`
(descida jogável com o motor/pista REAIS da Vega, resultado, e a composta que liga as duas). Atlas já plugou
`criarCenaJogo` em `main.ts` no lugar de `criarCenaBoot`.

**C2b/C5b/C8b (plano "corrida em campeonato"):** `cenas/{corrida,podio,campeonato}.ts` -- mesmo padrão de
`{descida,resultado,jogo}.ts`, mas dirigindo `corrida/criarCorrida` (jogador + 5 rivais de IA) em vez do motor
solo. `cenas/contagem.ts` tem a contagem "3-2-1-JÁ" compartilhada pelas duas descidas (solo e corrida). O botão
CAMPEONATO do menu (`gerenciador.ts`: `aoModos`) liga em `criarCenaCampeonato`, que agora orquestra o
**campeonato COMPLETO**: abertura (`abertura-campeonato.ts`) -> (corrida -> pódio -> standings
(`standings-campeonato.ts`) -> oficina (`oficina-campeonato.ts`)) × 4 -> corrida -> pódio -> standings -> final
(`final-campeonato.ts`), acumulando via `meta/campeonato.ts` (`registrarResultado`/`classificacao`/`situacao`).
Quem PERSISTE (campeonato em andamento, flocos, troféu, evolução) é sempre `gerenciador.ts`
(`aoIniciarCampeonato`/`aoRegistrarResultadoCampeonato`/`aoComprarUpgrade`), nunca `campeonato.ts` direto -- mesma
convenção de "um único ponto de escrita" do resto do arquivo. As 4 telas novas usam fundo Pixar raster reaproveitado
(`fundo-campeonato.ts`, zero crédito Runway novo) -- ver memória `campeonato-telas-reusam-fundo-pixar-sem-credito`.

**Responsabilidade (plano §3.1):** cenas (`ui/cenas/*`: título, descida, resultado), menus e a persistência de
interface. É a camada que junta o resto.

**`motor-teste.ts` e `pista-teste.ts` são um DUBLÊ órfão (sem uso em produção):** serviram para a Lyra desenvolver
render/câmera/entrada em paralelo com o motor real, antes da integração. `criarCenaDescida` não usa mais nenhum
dos dois (troca feita por Atlas para `src/descida/criarDescida` + `src/pista/exigirPistaValida`); os dois arquivos
continuam no repo só porque `tests/unit/ui-motor-teste.test.ts` ainda os exercita — considerar remover os três
juntos numa limpeza futura, se não houver mais uso.

**Importa de:** todas as camadas (`core`, `data`, `pista`, `descida`, `meta`, `render`, `audio`, `input`, `assets`, `platform`).

**Contrato da cena:** `atualizar()` por tick de passo fixo (sem relógio de parede), `desenhar(ctx, alpha)` por quadro em coordenadas lógicas 960x540
(o `main.ts` já aplicou `usarEspacoLogico`). Fundo estático vai numa camada `drawImage` (ver `boot.ts`: o degradê e o `strokeText` redesenhados
todo quadro custavam ~65 ms num canvas por software).

**Regra:** sem `<style>` nem `style="..."` em HTML gerado como string no build; use classes de `src/*.css`
(a CSP do build é `style-src 'self'`). Ajustar `elemento.style.x` por script é permitido.
