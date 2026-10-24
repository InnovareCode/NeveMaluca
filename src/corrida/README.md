# src/corrida/

**Dono:** Vega. **Estado (C2a+C3 + itens-corrida I2, marco corrida em campeonato):** núcleo da corrida pronto
(`corrida.ts`), itens prontos (`itens.ts`: caixas reais, slot, sorteio sem estado, projétil/armadilha/escudo/casco
azul, codec do `ComandoCorrida` pro replay), IA com perfil por personagem + trava anti-travamento pronta (`ia.ts`,
ainda sem usar item — I3), resumo do jogador acumulado durante a corrida (`resumo.ts`, EXCEÇÃO DE DONO temporária
até `descida/resumo.ts` existir — ver comentário no arquivo). C3 (camada de jogo: kickers/coletáveis/turbo de
pouso/caixas) está em `pista/camada-jogo.ts` + `descida/motor.ts`, não aqui — esta camada só liga os dois: gera a
camada automaticamente (`gerarCamadaJogo`) quando `OpcoesCorrida.def` vem preenchido e `camada` não vem, e já
converte o resultado em flocos (`data/evolucao.ts`, `flocosGanhos`, incluindo o bônus de acerto de item).

**Responsabilidade (`docs/plano-corrida-campeonato.md` §Arquitetura, C2a/C3; `docs/plano-itens-corrida.md`
§Núcleo, I2): `criarCorrida({pista, def?, camada?, semente, participantes})` cria N motores de `descida/`
INDEPENDENTES (plano C-D2: sem colisão física — a única interação é por item) rodando a mesma pista, com a camada
de jogo (coletáveis/kickers/turbo/caixas); `processar(cmd: ComandoCorrida)` avança UM tick em 2 fases (decide
`descida`/`usarItem` sobre o retrato anterior → `itens.ts` resolve e produz `EfeitoExterno[]` → cada motor
processa) e devolve a `LeituraCorrida`; `finalizar()` deixa os rivais que faltam correrem em LOCKSTEP (própria IA,
COM itens) até o fim (ou um teto de segurança) e fecha o `ResultadoCorrida` (pódio, flocos, `itens`) na hora;
`hashEstado()` prova determinismo com a ORDEM dos participantes permutada.

Puro e determinístico: mesma semente + mesma sequência de comandos do jogador (em QUALQUER ordem de
`participantes`) => sempre o mesmo resultado. Os únicos sorteios são: a CRIAÇÃO do piloto de IA de cada rival
(canal `ia-<id>` da semente, `ia.ts`) e o item de cada caixa (`hash(semente, id, índice-da-caixa)`, `data/itens.ts`
→ `itens.ts`) — nenhum dos dois guarda estado entre chamadas.

**Importa de:** `core/`, `data/`, `pista/`, `descida/`.

**Proibido aqui:** os mesmos de `descida/` (DOM, áudio, render, `Math.random`, `Date`, `performance`,
`Math.sin/cos/atan2/pow/exp` — usar `core/trig.ts`).

**Prova (fora do `npm run verificar`):** `ferramentas/harness-corrida/cli.mjs` roda os 6 personagens nas 5 pistas
em N sementes e confere que todos chegam (inclusive o caso que travava antes: Beto no Vulcão Pé-Gelado, manobreiro
ousadia 2) e que a mesma semente + os mesmos comandos do jogador dão sempre o mesmo `ResultadoCorrida`. Também mede
C3 (agregado nas 5 pistas oficiais, não piso por pista — o Morro só tem 1 ponto de lançamento na geometria
congelada): manobreiro (Capi, ousadia 2) faz em média >= 3 mortais/pista, >= 30% dos pulos dentro de um kicker
cabem 1 mortal, e o tempo total dele fica <= ~2% mais lento que o cuidadoso (turbo de pouso compensando).
