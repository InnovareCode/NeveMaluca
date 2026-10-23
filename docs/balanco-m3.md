# Balanço M3 (plano §A.4, F2)

Relatório versionado do `npm run balanco`: uma seção por rodada, mais recente no topo. Medição, nunca ajuste — quem muda `MAPA_ATRIBUTOS` é o Atlas/dono, a partir do veredito de cada rodada.

## Rodada 2026-10-23 — pista "morro-do-pinhao", 100 sementes (base 1), ousadias [0, 1, 2], mediana do elenco 23269 pontos

| personagem | conclui% | média | p50 | p90 | min..max | desvio vs mediana | status |
|---|---|---|---|---|---|---|---|
| Capi Barbosa | 100% | 19304 | 19405 | 22712 | 14026..26380 | -17.0% | FORA (>10%) |
| Professora Bandeira | 100% | 24274 | 23990 | 29636 | 17375..37559 | +4.3% | ok |
| Vó Cidinha | 100% | 20736 | 20713 | 23624 | 16088..24657 | -10.9% | FORA (>10%) |
| Tio Beto | 100% | 25404 | 25682 | 29056 | 17017..32230 | +9.2% | ok |
| Quequé | 100% | 22264 | 22003 | 25587 | 17227..28406 | -4.3% | ok |
| Bia Pipoca | 100% | 24882 | 24593 | 29557 | 19213..31914 | +6.9% | ok |

**Veredito D5 (±10% da mediana):** Capi Barbosa (capi): ABAIXO em 17.0% (média 19304 vs mediana 23269). TODOS os outros 5 têm "giro" maior que a Capi (vantagem mínima garantida: 5 pontos de ficha) — desnível estrutural do elenco inteiro, coerente com o plano M3 §A.1 ("a Capi é a de iniciante"). A Capi NUNCA é ajustada: o candidato a mexer é o ganho de "giro" em MAPA_ATRIBUTOS (encolhe a vantagem dos outros 5 por igual). Vó Cidinha (cidinha): ABAIXO em 10.9% (média 20736 vs mediana 23269). Atributo mais desviante da Capi: "giro" (diferença de 20 pontos de ficha) — candidato a levar o ajuste de ganho em MAPA_ATRIBUTOS (nunca a Capi).

**Ganhos em vigor (`MAPA_ATRIBUTOS`, `src/descida/atributos.ts`) nesta rodada:**
  - velocidade: velocidadeMaxMs (sentido 1, ganho 0.6)
  - aceleracao: fatorEmbalo (sentido 1, ganho 0.8); velocidadeRespawnMs (sentido 1, ganho 1.5)
  - giro: giroVelMaxGrausPorTick (sentido 1, ganho 0.1); giroAcelGrausPorTick2 (sentido 1, ganho 0.1)
  - equilibrio: limiarPerfeitoGraus (sentido 1, ganho 1); limiarBomGraus (sentido 1, ganho 1); limiarTortoGraus (sentido 1, ganho 1)
  - pulo: impulsoPuloMs (sentido 1, ganho 1)

## Rodada 2026-10-23 — pista "morro-do-pinhao", 100 sementes (base 1), ousadias [0, 1, 2], mediana do elenco 23013 pontos

| personagem | conclui% | média | p50 | p90 | min..max | desvio vs mediana | status |
|---|---|---|---|---|---|---|---|
| Capi Barbosa | 100% | 19304 | 19405 | 22712 | 14026..26380 | -16.1% | FORA (>10%) |
| Professora Bandeira | 100% | 23117 | 22769 | 27698 | 16371..32810 | +0.5% | ok |
| Vó Cidinha | 100% | 22908 | 22524 | 27189 | 17623..30070 | -0.5% | ok |
| Tio Beto | 100% | 25469 | 25565 | 29623 | 17017..32230 | +10.7% | FORA (>10%) |
| Quequé | 100% | 21825 | 21574 | 25114 | 17122..28197 | -5.2% | ok |
| Bia Pipoca | 100% | 25077 | 24727 | 29557 | 17866..31914 | +9.0% | ok |

**Veredito D5 (±10% da mediana):** Capi Barbosa (capi): ABAIXO em 16.1% (média 19304 vs mediana 23013). TODOS os outros 5 têm "giro" maior que a Capi (vantagem mínima garantida: 5 pontos de ficha) — desnível estrutural do elenco inteiro, coerente com o plano M3 §A.1 ("a Capi é a de iniciante"). A Capi NUNCA é ajustada: o candidato a mexer é o ganho de "giro" em MAPA_ATRIBUTOS (encolhe a vantagem dos outros 5 por igual). Tio Beto (beto): ACIMA em 10.7% (média 25469 vs mediana 23013). Atributo mais desviante da Capi: "equilibrio" (diferença de 20 pontos de ficha) — candidato a levar o ajuste de ganho em MAPA_ATRIBUTOS (nunca a Capi).

**Ganhos em vigor (`MAPA_ATRIBUTOS`, `src/descida/atributos.ts`) nesta rodada:**
  - velocidade: velocidadeMaxMs (sentido 1, ganho 0.6)
  - aceleracao: fatorEmbalo (sentido 1, ganho 0.8); velocidadeRespawnMs (sentido 1, ganho 1.5)
  - giro: giroVelMaxGrausPorTick (sentido 1, ganho 0.2); giroAcelGrausPorTick2 (sentido 1, ganho 0.2)
  - equilibrio: limiarPerfeitoGraus (sentido 1, ganho 1); limiarBomGraus (sentido 1, ganho 1); limiarTortoGraus (sentido 1, ganho 1)
  - pulo: impulsoPuloMs (sentido 1, ganho 1)

## Rodada 2026-10-23 — pista "morro-do-pinhao", 100 sementes (base 1), ousadias [0, 1, 2], mediana do elenco 23594 pontos

| personagem | conclui% | média | p50 | p90 | min..max | desvio vs mediana | status |
|---|---|---|---|---|---|---|---|
| Capi Barbosa | 100% | 19304 | 19405 | 22712 | 14026..26380 | -18.2% | FORA (>10%) |
| Professora Bandeira | 100% | 22801 | 22707 | 26259 | 17120..30408 | -3.4% | ok |
| Vó Cidinha | 100% | 23704 | 23705 | 27865 | 17128..32751 | +0.5% | ok |
| Tio Beto | 100% | 26038 | 26301 | 30298 | 19053..35735 | +10.4% | FORA (>10%) |
| Quequé | 100% | 23485 | 23190 | 27494 | 17807..29660 | -0.5% | ok |
| Bia Pipoca | 100% | 25226 | 24901 | 29245 | 18602..34647 | +6.9% | ok |

**Veredito D5 (±10% da mediana):** Capi Barbosa (capi): ABAIXO em 18.2% (média 19304 vs mediana 23594). TODOS os outros 5 têm "giro" maior que a Capi (vantagem mínima garantida: 5 pontos de ficha) — desnível estrutural do elenco inteiro, coerente com o plano M3 §A.1 ("a Capi é a de iniciante"). A Capi NUNCA é ajustada: o candidato a mexer é o ganho de "giro" em MAPA_ATRIBUTOS (encolhe a vantagem dos outros 5 por igual). Tio Beto (beto): ACIMA em 10.4% (média 26038 vs mediana 23594). Atributo mais desviante da Capi: "equilibrio" (diferença de 20 pontos de ficha) — candidato a levar o ajuste de ganho em MAPA_ATRIBUTOS (nunca a Capi).

**Ganhos em vigor (`MAPA_ATRIBUTOS`, `src/descida/atributos.ts`) nesta rodada:**
  - velocidade: velocidadeMaxMs (sentido 1, ganho 0.6)
  - aceleracao: fatorEmbalo (sentido 1, ganho 0.8); velocidadeRespawnMs (sentido 1, ganho 1.5)
  - giro: giroVelMaxGrausPorTick (sentido 1, ganho 0.8); giroAcelGrausPorTick2 (sentido 1, ganho 0.8)
  - equilibrio: limiarPerfeitoGraus (sentido 1, ganho 1); limiarBomGraus (sentido 1, ganho 1); limiarTortoGraus (sentido 1, ganho 1)
  - pulo: impulsoPuloMs (sentido 1, ganho 1)

## Rodada 2026-10-23 — pista "morro-do-pinhao", 100 sementes (base 1), ousadias [0, 1, 2], mediana do elenco 23413 pontos

| personagem | conclui% | média | p50 | p90 | min..max | desvio vs mediana | status |
|---|---|---|---|---|---|---|---|
| Capi Barbosa | 100% | 19304 | 19405 | 22712 | 14026..26380 | -17.6% | FORA (>10%) |
| Professora Bandeira | 100% | 24033 | 23144 | 28532 | 17293..37559 | +2.6% | ok |
| Vó Cidinha | 100% | 22218 | 21754 | 26373 | 16834..29716 | -5.1% | ok |
| Tio Beto | 100% | 25313 | 25276 | 29232 | 17017..32858 | +8.1% | ok |
| Quequé | 100% | 22793 | 22723 | 26404 | 16408..30448 | -2.6% | ok |
| Bia Pipoca | 100% | 24985 | 24644 | 29332 | 18967..32305 | +6.7% | ok |

**Veredito D5 (±10% da mediana):** Capi Barbosa (capi): ABAIXO em 17.6% (média 19304 vs mediana 23413). TODOS os outros 5 têm "giro" maior que a Capi (vantagem mínima garantida: 5 pontos de ficha) — desnível estrutural do elenco inteiro, coerente com o plano M3 §A.1 ("a Capi é a de iniciante"). A Capi NUNCA é ajustada: o candidato a mexer é o ganho de "giro" em MAPA_ATRIBUTOS (encolhe a vantagem dos outros 5 por igual).

**Ganhos em vigor (`MAPA_ATRIBUTOS`, `src/descida/atributos.ts`) nesta rodada:**
  - velocidade: velocidadeMaxMs (sentido 1, ganho 0.6)
  - aceleracao: fatorEmbalo (sentido 1, ganho 0.8); velocidadeRespawnMs (sentido 1, ganho 1.5)
  - giro: giroVelMaxGrausPorTick (sentido 1, ganho 0); giroAcelGrausPorTick2 (sentido 1, ganho 0)
  - equilibrio: limiarPerfeitoGraus (sentido 1, ganho 1); limiarBomGraus (sentido 1, ganho 1); limiarTortoGraus (sentido 1, ganho 1)
  - pulo: impulsoPuloMs (sentido 1, ganho 1)

## Rodada 2026-10-23 — pista "morro-do-pinhao", 100 sementes (base 1), ousadias [0, 1, 2], mediana do elenco 23426 pontos

| personagem | conclui% | média | p50 | p90 | min..max | desvio vs mediana | status |
|---|---|---|---|---|---|---|---|
| Capi Barbosa | 100% | 19304 | 19405 | 22712 | 14026..26380 | -17.6% | FORA (>10%) |
| Professora Bandeira | 100% | 22532 | 22520 | 26418 | 17120..30276 | -3.8% | ok |
| Vó Cidinha | 100% | 23462 | 23423 | 26991 | 17406..31940 | +0.2% | ok |
| Tio Beto | 100% | 25878 | 26169 | 29243 | 19053..31795 | +10.5% | FORA (>10%) |
| Quequé | 100% | 23391 | 23479 | 26763 | 18355..31387 | -0.2% | ok |
| Bia Pipoca | 100% | 25313 | 24894 | 29557 | 18602..32486 | +8.1% | ok |

**Veredito D5 (±10% da mediana):** Capi Barbosa (capi): ABAIXO em 17.6% (média 19304 vs mediana 23426). TODOS os outros 5 têm "giro" maior que a Capi (vantagem mínima garantida: 5 pontos de ficha) — desnível estrutural do elenco inteiro, coerente com o plano M3 §A.1 ("a Capi é a de iniciante"). A Capi NUNCA é ajustada: o candidato a mexer é o ganho de "giro" em MAPA_ATRIBUTOS (encolhe a vantagem dos outros 5 por igual). Tio Beto (beto): ACIMA em 10.5% (média 25878 vs mediana 23426). Atributo mais desviante da Capi: "equilibrio" (diferença de 20 pontos de ficha) — candidato a levar o ajuste de ganho em MAPA_ATRIBUTOS (nunca a Capi).

**Ganhos em vigor (`MAPA_ATRIBUTOS`, `src/descida/atributos.ts`) nesta rodada:**
  - velocidade: velocidadeMaxMs (sentido 1, ganho 0.6)
  - aceleracao: fatorEmbalo (sentido 1, ganho 0.8); velocidadeRespawnMs (sentido 1, ganho 1.5)
  - giro: giroVelMaxGrausPorTick (sentido 1, ganho 0.5); giroAcelGrausPorTick2 (sentido 1, ganho 0.5)
  - equilibrio: limiarPerfeitoGraus (sentido 1, ganho 1); limiarBomGraus (sentido 1, ganho 1); limiarTortoGraus (sentido 1, ganho 1)
  - pulo: impulsoPuloMs (sentido 1, ganho 1)

## Rodada 2026-10-23 — pista "morro-do-pinhao", 100 sementes (base 1), ousadias [0, 1, 2], mediana do elenco 23855 pontos

| personagem | conclui% | média | p50 | p90 | min..max | desvio vs mediana | status |
|---|---|---|---|---|---|---|---|
| Capi Barbosa | 100% | 19304 | 19405 | 22712 | 14026..26380 | -19.1% | FORA (>10%) |
| Professora Bandeira | 100% | 23589 | 23646 | 27621 | 17120..30984 | -1.1% | ok |
| Vó Cidinha | 100% | 24121 | 23728 | 27939 | 18139..34276 | +1.1% | ok |
| Tio Beto | 100% | 25935 | 26138 | 30298 | 19122..35735 | +8.7% | ok |
| Quequé | 100% | 23500 | 23110 | 27318 | 17807..29933 | -1.5% | ok |
| Bia Pipoca | 100% | 25317 | 25006 | 29499 | 18766..31896 | +6.1% | ok |

**Veredito D5 (±10% da mediana):** Capi Barbosa (capi): ABAIXO em 19.1% (média 19304 vs mediana 23855). TODOS os outros 5 têm "giro" maior que a Capi (vantagem mínima garantida: 5 pontos de ficha) — desnível estrutural do elenco inteiro, coerente com o plano M3 §A.1 ("a Capi é a de iniciante"). A Capi NUNCA é ajustada: o candidato a mexer é o ganho de "giro" em MAPA_ATRIBUTOS (encolhe a vantagem dos outros 5 por igual).

**Ganhos em vigor (`MAPA_ATRIBUTOS`, `src/descida/atributos.ts`) nesta rodada:**
  - velocidade: velocidadeMaxMs (sentido 1, ganho 0.6)
  - aceleracao: fatorEmbalo (sentido 1, ganho 0.8); velocidadeRespawnMs (sentido 1, ganho 1.5)
  - giro: giroVelMaxGrausPorTick (sentido 1, ganho 1); giroAcelGrausPorTick2 (sentido 1, ganho 1)
  - equilibrio: limiarPerfeitoGraus (sentido 1, ganho 1); limiarBomGraus (sentido 1, ganho 1); limiarTortoGraus (sentido 1, ganho 1)
  - pulo: impulsoPuloMs (sentido 1, ganho 1)

## Rodada 2026-10-23 — pista "morro-do-pinhao", 30 sementes (base 1), ousadias [0, 1, 2], mediana do elenco 23783 pontos

| personagem | conclui% | média | p50 | p90 | min..max | desvio vs mediana | status |
|---|---|---|---|---|---|---|---|
| Capi Barbosa | 100% | 19252 | 19579 | 23204 | 14098..25699 | -19.1% | FORA (>10%) |
| Professora Bandeira | 100% | 23656 | 22992 | 26813 | 19167..30984 | -0.5% | ok |
| Vó Cidinha | 100% | 23911 | 23411 | 27939 | 19183..28737 | +0.5% | ok |
| Tio Beto | 100% | 25629 | 26060 | 30096 | 19122..32091 | +7.8% | ok |
| Quequé | 100% | 23519 | 23040 | 27692 | 18497..28952 | -1.1% | ok |
| Bia Pipoca | 100% | 24975 | 24396 | 30631 | 18766..31896 | +5.0% | ok |

**Veredito D5 (±10% da mediana):** Capi Barbosa (capi): ABAIXO em 19.1% (média 19252 vs mediana 23783). TODOS os outros 5 têm "giro" maior que a Capi (vantagem mínima garantida: 5 pontos de ficha) — desnível estrutural do elenco inteiro, coerente com o plano M3 §A.1 ("a Capi é a de iniciante"). A Capi NUNCA é ajustada: o candidato a mexer é o ganho de "giro" em MAPA_ATRIBUTOS (encolhe a vantagem dos outros 5 por igual).

**Ganhos em vigor (`MAPA_ATRIBUTOS`, `src/descida/atributos.ts`) nesta rodada:**
  - velocidade: velocidadeMaxMs (sentido 1, ganho 0.6)
  - aceleracao: fatorEmbalo (sentido 1, ganho 0.8); velocidadeRespawnMs (sentido 1, ganho 1.5)
  - giro: giroVelMaxGrausPorTick (sentido 1, ganho 1); giroAcelGrausPorTick2 (sentido 1, ganho 1)
  - equilibrio: limiarPerfeitoGraus (sentido 1, ganho 1); limiarBomGraus (sentido 1, ganho 1); limiarTortoGraus (sentido 1, ganho 1)
  - pulo: impulsoPuloMs (sentido 1, ganho 1)
