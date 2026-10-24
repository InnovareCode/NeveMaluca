# NEVE MALUCA — Plano: Itens/Poderes na Corrida (estilo Snowboard Kids 2 / Mario Kart)

Aprovado pelo dono em 2026-10-24 ("pode construir", travadas as recomendações da Nova; casco azul = SIM, raro e
defensável). Referência dada pelo dono: vídeo de Snowboard Kids 2. Plano da Nova encaixado na corrida que já está no
ar. **Tamanho honesto: ~9-10 entregas de agente, ~60% do marco do campeonato.** Fonte: memória da Nova
`itens-corrida-determinismo`.

## Dois achados no código atual (mudam o plano)
1. **No iPhone hoje NÃO dá pra agachar:** `input/toque.ts` devolve `agachar:false` sempre e lê 1 dedo só. Então o galho
   da C4 não passa no toque, e o botão de item precisaria de multi-toque. **Multi-toque vira pré-requisito** — e
   conserta o agachar de uma vez.
2. **A trava anti-travamento da IA conta quedas por checkpoint** (`corrida/ia.ts`): acerto de item NÃO pode contar como
   queda (evento próprio `atingido`), senão 2 acertos travam o rival no modo cuidadoso até o fim.
3. (menor) A cena de corrida ainda não grava `ReplayV2` — a Íris vai precisar de um replay de teste pra provar o
   determinismo com itens.

## Conjunto de itens (nomes cômicos + pele por tema: Apolo depois)
| Item | Tipo | Efeito | Defesa |
|---|---|---|---|
| Bola de Neve | ofensivo projétil | rola e acerta o 1º rival à frente no chão | pular por cima ou escudo |
| Poça de Calda (pele por tema) | ofensivo armadilha | fica atrás; quem passa no chão freia forte | pular por cima ou escudo |
| Nuvem de Granizo (raro, "casco azul") | ofensivo mira 1º | com ~2s de aviso, acerta o líder | só escudo |
| Chocolate Quente | próprio turbo | impulso ~2s (mesmo turbo do pouso → 1 calibragem só) | — |
| Bolha de Gelo | próprio escudo | absorve 1 acerto, ~8s | — |
| Ímã de Flocos | próprio economia | puxa coletáveis próximos ~6s | — |

- **Acerto = `trombada`:** velocidade cai a ~30%, controle trava ~40 ticks, perde o combo. **NÃO volta ao checkpoint**
  (voltar seria castigo demais numa corrida; checkpoint fica só pra queda por erro próprio).
- **Economia:** item é de graça (pega na pista), NUNCA se compra com flocos (sem pay-to-win). Acertar rival dá +5 flocos
  e pode entrar em objetivos ("acerte 3 bolas").

## Decisões travadas (recomendações da Nova + dono)
- **I-D1 catch-up:** LEVE e simétrico — só os 2 últimos ganham peso maior de turbo, mesma regra pro jogador e pra IA,
  sem trapaça. (Mantém o espírito do "sem rubber-band" da C-D5.)
- **I-D2 casco azul (Nuvem de Granizo):** ENTRA — raro, só o escudo defende. (Dono aprovou.)
- **I-D3 input no celular:** botão ITEM na tela (canto inferior, área segura, ≥24px da borda) + multi-toque; agachar no
  toque = 2 dedos. Teclado E/Shift; controle: botão de ombro. REABRE a D10 (botão vira padrão na corrida).
- **I-D4:** 1 espaço de item por corredor.
- **I-D5:** caixa POR corredor (cada um pega cada caixa 1x; a já pega aparece apagada).
- **I-D6:** acertar rival dá +5 flocos e entra em objetivos. Item nunca custa flocos.
- **I-D7:** trombada SEM voltar ao checkpoint.
- **I-D8:** Treino SEM itens (recorde/fantasma comparáveis).
- **I-D9:** itens nas 5 pistas; IA das pistas 1-2 usa itens com menos agressividade (dificuldade crescente).

## Determinismo (o ponto crítico) — C-D2 reabre SÓ em parte
Corpos continuam se atravessando (sem colisão física); a ÚNICA interação é por item, sempre pelo orquestrador.
- **Tick em 2 fases dentro de `corrida/`:** (1) cada corredor decide comando + uso de item lendo o RETRATO do tick
  anterior (jogador pela entrada, IA pela regra); (2) o orquestrador resolve caixas/armadilhas/projéteis/escudo/acertos
  e produz os `efeitos` de cada motor; (3) cada motor processa seu tick com os efeitos recebidos. Na fase 3 nenhum motor
  lê outro → a ORDEM dos participantes não muda o resultado (Íris prova permutando a ordem).
- **`motor.processar(cmd, efeitos?)`** — `efeitos` opcional entra no `hashEstado`; omitido = idêntico por construção →
  **golden da Capi + Treino intactos** (mesmo padrão do `OpcoesDescida`).
- **Uso de item NÃO entra no comando da descida:** `ComandoCorrida { descida, usarItem }`; no replay ocupa o **bit 7**
  (hoje reservado), só no `ReplayV2`.
- **Sorteio sem estado:** item da caixa = hash(semente, id, índice da caixa); decisão da IA = hash(semente, id, tick).
  Sem fila compartilhada → "quem pegou primeiro" não muda o que os outros tiram.
- `Corrida` ganha `hashEstado()` (6 motores + projéteis + slots + escudos + caixas pegas). `finalizar()` roda os rivais
  até o fim COM itens (senão o pódio entre rivais sairia diferente do ao vivo).

## Contratos (Vega fixa na I0, só tipos)
`TipoItem='bola'|'poca'|'nuvem'|'turbo'|'escudo'|'ima'`; `CamadaJogo.caixas: {x,y,raio}[]` (versão da camada sobe);
`ComandoCorrida{descida:ComandoDescida, usarItem:boolean}` e `Corrida.processar(cmd:ComandoCorrida)`;
`EfeitoExterno = {tipo:'trombada'} | {tipo:'freada',fator,ticks} | {tipo:'turbo',ms,ticks} | {tipo:'ima',raioM,ticks}`;
`motor.processar(cmd, efeitos?)`; `EventoDescida{tipo:'atingido',item}` (separado de `tombo`);
`EventoCorrida`: item-pego/item-usado/acerto{de,em,item}/bloqueado/desviou; `LeituraCorrida` ganha `itemJogador`,
`roleta`, `entidades:{id,tipo,x,y}[]`, `alvoNoJogador?`, e por rival `item?`/`escudo`/`atordoado`, `eventosCorrida`;
`ResultadoCorrida.itens:{acertosDados,acertosSofridos}`; `ReplayV2`: bit 7 = `usarItem` + `versaoItens`.
Novos arquivos: `data/itens.ts` (Cronos: números/pesos por faixa de posição), `corrida/itens.ts` (Vega: sorteio,
projéteis, acertos), `corrida/ia-itens.ts` (Vega).

## Fases
| Fase | O quê | Quem | Depende |
|---|---|---|---|
| I0 | Decisões (feito) + tipos acima | Atlas, Vega | — |
| I1 | Efeitos externos no motor + evento `atingido` (sem efeitos = idêntico) | Vega | I0 |
| I2 | Núcleo: caixas, slot, sorteio sem estado, projéteis/armadilhas, tick 2 fases, hashEstado da corrida, replay de teste | Vega | I1 |
| I2 teste | Determinismo em 2 navegadores + ordem permutada | Íris | I2 |
| I3 | IA de itens + desvio + trava que ignora acerto + harness de caos | Vega | I2 |
| I4 | Multi-toque, botão ITEM, agachar no toque, teclado e controle | Lyra | I0 (contrato); paralelo com I1-I3 |
| I5 | Render/HUD/som: caixa, roleta, bola, poça, nuvem, bolha (código, zero crédito), aviso de alvo, sons | Lyra; Apolo (nomes/ficha); Vega (áudio) | LeituraCorrida de mentira após I0, integra após I2 |
| I6 | Calibragem dos itens + recalibrar a curva do campeonato; **portão do dono no iPhone** | Vega, Íris, dono | I3, I4, I5 |
| I7 | Revisão save/stats; documentação | Órion, Alexandria | tudo |

Gargalo: Vega (I1→I3 em sequência). Lyra em paralelo na I4/I5.

## Riscos (ordem)
1. Determinismo com interação (1ª vez que um corredor afeta outro) → tick 2 fases + sorteio sem estado + ordem
   permutada + hashEstado + prova em 2 navegadores.
2. Multi-toque no iPhone (conflito com gestos de borda R6, toque preso, botão sobre o giro) — só se prova no aparelho.
3. Caos desequilibra o campeonato (vitória exige somar mais que os 5) → recalibrar a curva na I6.
4. IA com itens injusta/burra → harness de caos com metas + personalidade com sorteio.
5. Legibilidade (projétil/alvo na "faixa de trás" visual).
6. Desempenho (projéteis + 6 sprites) — não medido no iPhone.
