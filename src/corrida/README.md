# src/corrida/

**Dono:** Vega. **Estado (C2a, marco corrida em campeonato):** núcleo da corrida pronto (`corrida.ts`), IA com
perfil por personagem + trava anti-travamento pronta (`ia.ts`), resumo do jogador acumulado durante a corrida
(`resumo.ts`, EXCEÇÃO DE DONO temporária até `descida/resumo.ts` existir — ver comentário no arquivo).

**Responsabilidade (`docs/plano-corrida-campeonato.md` §Arquitetura, C2a):** `criarCorrida({pista, camada?,
semente, participantes})` cria N motores de `descida/` INDEPENDENTES (plano C-D2: sem colisão) rodando a mesma
pista; `processar(cmdJogador)` avança um tick (o jogador pela entrada, cada rival pela própria IA) e devolve a
`LeituraCorrida`; `finalizar()` deixa os rivais que faltam correrem com a própria IA até o fim (ou um teto de
segurança) e fecha o `ResultadoCorrida` (pódio) na hora.

Puro e determinístico: mesma semente + mesma sequência de comandos do jogador => sempre o mesmo resultado. O único
sorteio é na CRIAÇÃO do piloto de IA de cada rival (canal `ia-<id>` da semente, `ia.ts`), nunca dentro do laço de
decisão por tick.

**Importa de:** `core/`, `data/`, `pista/`, `descida/`.

**Proibido aqui:** os mesmos de `descida/` (DOM, áudio, render, `Math.random`, `Date`, `performance`,
`Math.sin/cos/atan2/pow/exp` — usar `core/trig.ts`).

**Prova (fora do `npm run verificar`):** `ferramentas/harness-corrida/cli.mjs` roda os 6 personagens nas 5 pistas
em N sementes e confere que todos chegam (inclusive o caso que travava antes: Beto no Vulcão Pé-Gelado, manobreiro
ousadia 2) e que a mesma semente + os mesmos comandos do jogador dão sempre o mesmo `ResultadoCorrida`.
