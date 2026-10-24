# NEVE MALUCA — Plano: Corrida em Campeonato

Aprovado pelo dono em 2026-10-24 ("pode começar"; travadas as recomendações da Nova nas 10 decisões).
Plano arquitetado pela Nova a partir de medições reais do motor. **Tamanho honesto: ~15 entregas de agente, ~2× o
marco anterior, do porte do M3 inteiro.** Fonte detalhada: memória da Nova `corrida-campeonato-plano`.

## O jogo (visão do dono)
Campeonato de corrida: os **6 personagens correm juntos, ao vivo, na mesma pista**. Vence a corrida quem cruza a
chegada na frente. **Pódio dá pontos** (10/8/6 + 4/2/1); os pontos **somam pelas 5 pistas**. O jogo é vencido se, ao
fim das 5, o jogador tiver mais pontos que **todos** os 5 adversários. Os pontos de manobra/bônus viram **flocos** que
**evoluem o personagem** (velocidade, equilíbrio, força). Mantém a alma: manobras, bônus e obstáculos nas pistas,
dificuldade subindo nas pistas avançadas.

## Medições que guiam o desenho (Nova, motor real via Vite SSR)
- A corrida já nasce apertada: os 6 chegam com **3 a 8 s** de diferença.
- **Manobrar custa 15-25% de tempo** → no modo corrida a manobra precisa virar velocidade (ver C-D7, turbo no pouso).
- **Travamento real:** Beto (manobreiro ousadia 2) caiu 35× no Vulcão e nunca chegou → a IA precisa de trava.
- Os bots atuais são previsíveis (funções puras da leitura, sem sorteio) → precisam de variação por semente.
- Custo ~3 µs/tick em Node (5 adversários são baratos). **Não medido no iPhone** (memória/fps com 6 sprites = risco).

## Decisões travadas (recomendações da Nova, aprovadas)
- **C-D1 Pontos:** 10/8/6/4/2/1. Vence quem tiver total > cada um dos 5. Desempate: mais vitórias, depois melhor
  posição na última pista.
- **C-D2 Colisão:** NÃO. Cada corredor é um motor independente, se atravessam (mantém determinismo e IA simples).
  Adversários numa "faixa de trás" visual (menores/mais altos), anel colorido + nome.
- **C-D3 Upgrade × invariante (U1):** evolução é CAMADA por cima da ficha: atributo efetivo = ficha + nível×passo
  (~+3/nível, até 5), pela conversão relativa que já existe. **No nível 0 é idêntico por construção** → o golden da
  Capi, o modo Treino e os fantasmas continuam valendo. Regras de corrida (turbo) só no modo corrida. Replay ganha
  níveis+modo. Critério de equilíbrio entre personagens passa de "pontos ±10%" para **"tempo de chegada ±5%"**.
- **C-D4 Atributos:** Velocidade, Equilíbrio, Força (pulo+embalo). Giro fora (tela simples). Carteira única de flocos;
  níveis por personagem. Evolução **fica entre campeonatos** (perdeu → recomeça mais forte → todos um dia vencem).
- **C-D5 Adversários:** sobem num nível **roteirizado por pista** (pista 1 ~nível 0, pista 5 ~+12). SEM rubber-band,
  sem copiar o jogador. Cada um com personalidade (Bia arrisca mortais, Capi constante, Beto ousado); variação por
  semente da corrida.
- **C-D6 Repetir:** reinicia pela pausa antes de cruzar; depois de cruzar, trava (como Mario Kart).
- **C-D7 Manobra→velocidade:** **turbo automático no pouso**, proporcional aos pontos do voo (sem botão novo). Meta de
  calibragem: manobreiro competente chega ~5% antes do cuidadoso; cair continua custando caro.
- **C-D8 Modo atual:** descida solo + fantasma + recorde vira **Treino** (botão MODOS, que hoje não faz nada).
- **C-D9 Personagens:** todos liberados. Vencer o campeonato com cada um dá um troféu. Desbloqueio por estrelas (M3-D1)
  fica obsoleto.
- **C-D10 (do plano anterior):** autorizar o corte de versão (recordes atuais → `recordesAntigos`); agachar por toque
  (reabre D10, só prova no iPhone); plano pago da Runway p/ arte-chave fica pra depois (hero é grátis por montagem).

## Arquitetura
- **`src/corrida/` (novo, puro, determinístico):** `criarCorrida({pista, camada, semente, participantes})`;
  `processar(cmdJogador)` → `LeituraCorrida`; `finalizar()` (adversários restantes correm em máx. até o fim, pódio na
  hora). `corrida/ia.ts`: perfil por personagem + sorteio pelo canal `ia-<id>` + trava (2 quedas no mesmo checkpoint →
  modo cuidadoso). Determinístico: mesma semente + mesmos comandos = mesma corrida.
- **Tela:** câmera no jogador; adversários aparecem na tela com anel+nome, seta na borda com rosto+distância fora dela;
  "2º/6" no HUD; **barra de progresso linear com os 6 rostos** (serve de minimapa + barra da antiga J1); aviso de chegada.
- **`meta/campeonato.ts` (puro):** `pontosDaPosicao`, `classificacao`, `situacao` (andamento/vencido/perdido),
  `desempate`. No save: `campeonato?{semente, personagem, etapa 0-5, pistasConcluidas[{pista, ordem, ticks}]}`,
  `trofeus?`, `evolucao?{flocos, niveis por personagem}`. Classificação **sempre derivada da `ordem` gravada**. Salva
  após cada pista. Órion valida limites.
- **Upgrade (U1):** `aplicarEvolucao(config, def, niveis)` em `descida/atributos.ts` (nível 0 = identidade, com teste).
  Flocos vêm de: coletáveis, pontos de manobra convertidos, os 3 objetivos/pista (viram missões pagas em flocos — a
  "alma"), e o pódio. Custos em `data/evolucao.ts` (Cronos). Teste de geometria: no nível MÁX os 6 concluem as 5 sem
  travar (matriz só com nível 0 e máx).

## Contratos (Vega fixa em `core/contratos.ts` na C0)
- `ModoDescida = 'treino' | 'corrida'`.
- `criarDescida(pista, config, opcoes?: { camada?, modo? })` — padrão sem camada, modo treino (mantém golden da Capi).
- `ParticipanteCorrida { id, config, piloto: {tipo:'jogador'} | {tipo:'ia', perfil, nivel} }`.
- `LeituraCorrida { tick, jogador: LeituraDescida, rivais: {id,piloto,fase,distancia}[], posicoes: IdPersonagem[], chegadas: {id,tick}[] }`.
- `ResultadoCorrida { pista, ordem: IdPersonagem[], ticks: Record<IdPersonagem,number>, resumoJogador: ResumoDescida, flocosGanhos }`.
- `EstadoCampeonato`, `Evolucao` no save (opcionais, padrão na UI). `ReplayV2` = ReplayV1 + `modo` + `niveis` + `corrida?{semente, rivais}`. `CamadaJogo` (coletáveis/kickers/obstáculos altos/pórtico) como no plano anterior.

## Reaproveita do plano de jogabilidade (diagnóstico da Nova)
- **Fica:** chegada visível + contagem 3-2-1 + comemoração + poses (C1); camada de jogo (terreno do Morro intocado),
  coletáveis e kickers (kicker também vira turbo) (C3); obstáculo alto + agachar (C4); `resumo.ts`; corrigir o ×6
  impossível do Cume e escrever os objetivos do Morro; o visual Pixar.
- **Muda:** estrelas/desbloqueio por estrelas saem (entra o campeonato); pontos/combo/recorde/fantasma saem do centro
  (viram flocos+turbo; recorde e fantasma ficam só no Treino); equilíbrio por tempo, não por pontos.

## Fases e ordem
| Fase | O quê | Quem | Depende |
|---|---|---|---|
| C0 | Decisões (feito) + fixar contratos (tipos) | Atlas, Vega | — |
| C1 | Chegada, contagem, comemoração, poses, barra de 6 rostos | Lyra | — |
| C2a | Núcleo `corrida/` + IA + trava anti-travamento | Vega | C0 |
| C2a teste | Harness: os 6 chegam nas 5 pistas em N sementes; corrida determinística | Íris | C2a |
| C2b | Desenhar os 6, setas, posição, barra de rostos, pódio da pista | Lyra | C2a, C1 |
| C3 | Camada de jogo: kickers, coletáveis (flocos), turbo de pouso | Vega + Lyra | C2a |
| C4 | Obstáculo alto + agachar por toque | Vega, Lyra | C3 |
| C5a | `campeonato.ts`, save, `data/evolucao.ts`, objetivos refeitos | Cronos | C0 |
| C5b | Telas do campeonato | Lyra | C2b, C5a |
| C6 | Evolução: `aplicarEvolucao`, oficina, `ReplayV2`, teste de geometria | Vega, Lyra | C3, C5a |
| C7 | Calibrar curva do campeonato; portão do dono (jogar um campeonato no iPhone) | Vega, Íris, dono | C6 |
| C8a | Tela principal Pixar + menu Campeonato/Treino/Personagem/Opções (zero crédito) | Lyra | — |
| C8b | Pódio, classificação, tela final Pixar | Lyra | com C5b |
| C9 | Revisão save/economia; docs; matriz de aparelhos; memória/fps no iPhone | Órion, Alexandria, Íris | tudo |

**Gargalo: Vega** (C2a, C3, C4, C6, C7). Lyra (C1, C8a) e Cronos (C5a) vão na frente.

## Riscos (ordem)
1. IA ruim mata a corrida (previsível/burra/trava) → perfil + sorteio + trava + harness N sementes.
2. Manobra × corrida: se o turbo não compensar, o jogador para de manobrar (calibragem delicada).
3. Upgrades quebram a geometria ou trivializam → testar nível 0 e máx.
4. Memória/fps no iPhone com 6 sprites (não medido).
5. Legibilidade de 6 na visão lateral → faixa de trás + anéis.
6. Save com campeonato em andamento (corrupção/retomada/validação).
7. Escopo (~2×). Power-ups e Desafio do dia ficam fora.

## Dívida técnica achada
- `poseDe` usa `CONFIG_PADRAO.ticksTombo` em vez do config do personagem (inofensivo hoje).
- Objetivo "Combo ×6" do Cume é impossível (combo trava em ×5 hoje); o Morro não tem objetivos.
