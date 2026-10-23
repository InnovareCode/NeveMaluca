# M2 — Manobras, combos e pontuação — plano de implementação

> Escrito pelo Atlas em 2026-10-23 (design de jogo detalhado: `docs/plano-neve-maluca.md` §3.5; critérios §8; fase §7 M2).
> **Contratos já definidos** em `src/core/contratos.ts` — C3 (`LeituraDescida.combo/pontos/eventos`) e C6 (`ReplayV1`).
> Nenhuma mudança de contrato é necessária, então Vega e Lyra trabalham em paralelo.
> Implementação depende da squad (subagentes sonnet) com o limite semanal resetado; este doc fica pronto pra delegar.

## 1. Onde o M1a já chegou (base pronta — não refazer)
O motor (`src/descida/motor.ts`) já calcula e expõe, sem pontuar:
- `anguloAcumulado` → `voltas` (`Math.floor(|anguloAcumulado|/360)`): a contagem de mortais já existe.
- `ticksNoAr` (tempo de ar) e a qualidade de pouso (`perfeito`/`bom`/`torto`, por `limiarPerfeito/limiarTorto`).
- **Modo `trilho` completo** (grind): detecta pouso no trilho, entra/sai, emite `EventoDescida {tipo:'trilho', etapa:'inicio'|'fim'}`.
- `pose`, `modo` (chao/ar/trilho/tombo), e os eventos de M1a: `pulo`, `pouso`, `tombo`, `trilho`, `checkpoint`, `chegada`.

**Placeholders estáveis (o que o M2 torna real):**
- `combo: COMBO_VAZIO` (sempre vazio) e `pontos: 0` / `coletados: 0` em toda leitura.
- Eventos `manobra`, `combo-fechado`, `combo-perdido`, `coleta` **não são emitidos**.
- `chegada.pontos = 0`.
- `est.semente` está **reservada** para os canais de RNG de manobra (não usada no M1a).
- `src/data/` só tem `regras-save.ts` e `pistas.ts` — faltam `manobras.ts` e `textos.pt-BR.ts`.
- `src/input/` (toque/teclado) já produz `ComandoDescida` com `grab` (deslize ≤150ms) e `giro` (segurar) — a entrada de manobra **já flui** pelo C2; o M2 consome e dá feedback.

## 2. Trabalho por especialista

### Vega — motor + dados + replay (o coração do M2)
Arquivos: `src/descida/motor.ts`, `src/descida/combo.ts` (novo, puro), `src/data/manobras.ts` (novo), `src/descida/bot.ts`, `ferramentas/harness/`.
- **Detecção de manobra** (emitir `EventoDescida {tipo:'manobra', id, pontos}`), números de partida da tabela §3.5:
  - **Ar:** 10 a cada 0,1 s acima de 0,5 s de `ticksNoAr`.
  - **Mortal:** por volta completa de `anguloAcumulado` (meia volta não conta) — 1/2/3 voltas = 500/1200/2500.
  - **Grab:** `cmd.grab` no ar (4 direções) — 150 + 50 a cada 0,25 s segurando.
  - **Trilho:** 20 por 0,1 s deslizando (o modo já existe; falta pontuar).
  - **Estilo (bônus +25%):** pouso perfeito, "por um fio", mortal+grab.
- **Combo** (`src/descida/combo.ts`, puro/determinístico): abre na 1ª manobra; continua enquanto o piloto pular de novo até `JANELA_LIGACAO` (60 ticks) após um pouso; `mult = 1 + manobras distintas` (teto 10); repetir a mesma vale 50%, depois 25%; **fecha** após pouso bom (emite `combo-fechado {soma, mult, total}` e soma à pontuação); **perde tudo** no tombo (`combo-perdido {soma}`). Preencher `LeituraDescida.combo` e `pontos` de verdade; `chegada.pontos` = total real.
- **`src/data/manobras.ts`:** tabela dirigida por dados (famílias + pontos de partida §3.5), pra afinar no harness sem mexer no motor.
- **RNG:** usar `est.semente` nos canais de manobra (efeitos determinísticos; efeito visual usa `rngVisual`, nunca o RNG da lógica).
- **Replay C6:** `core/replay.ts` (codificar/decodificar comandos) já existe; gravar `ReplayV1` da corrida e o **fantasma** (correr contra o melhor replay salvo, C4 `fantasmas`).
- **Determinismo:** incluir manobras/combo/pontos no `hashEstado()`; estender o teste de 5400 ticks pra cobrir pontos (mesma semente + comandos → mesmo hash e mesma pontuação, 2 navegadores).
- **Harness:** bot "ousado" (tenta manobras) além do "cuidadoso" atual.
- **DoD:** `npm run typecheck` + `npm test` verdes; determinismo com pontos; toda manobra reproduzível por replay gravado. **Não** rodar a suíte e2e (portas 5273/4273 em uso pela Lyra).

### Lyra — render e UI das manobras
Arquivos: `src/render/manobra.ts` (novo, popups de nome), barra/medidor de combo em `src/render/hud.ts`, tela de objetivos em `src/ui/cenas/`, ajuste fino de gestos em `src/input/` se o M2 pedir.
- Ler `LeituraDescida.combo` (ativo/manobras/soma/mult/janela) e os eventos `manobra`/`combo-fechado`/`combo-perdido` → desenhar: o **nome cômico** da manobra subindo e sumindo, a **barra do combo** com o multiplicador, o "+pontos" ao fechar.
- **Tela/painel de objetivos** (3 por pista) no resultado e/ou menu.
- Medir no navegador (skill `medir-antes-de-afirmar`). **DoD:** `npm run verificar` verde; gesto de grab reconhecido em ≥95% dos casos sintéticos (com a Íris).

### Apolo — nomes e arte
- `src/data/textos.pt-BR.ts`: nomes cômicos por manobra e por combinação (ex.: mortal + grab de nariz) — junto com a Lyra.
- Folha B do mascote (poses de manobra) — **depende de D5** (orçamento) se exigir geração nova.

### Vega (áudio) — depois do core
- Sons de manobra, "escada" sonora do multiplicador, música adaptativa da pista 1 (vozes por formante, como no InnoFighters).

### Íris — validação (pode reprovar)
- Cada manobra disparada por **comandos gravados** (replay determinístico); **gestos sintéticos** no e2e; determinismo com pontos; harness do bot ousado verde (conclui e pontua).

## 3. Sequência e dependências
1. **Vega (base):** `combo.ts` + `data/manobras.ts` + detecção no motor + pontos reais. É o "contrato de verdade" que os eventos passam a carregar.
2. **Em paralelo** (C3/C6 já existem): **Lyra** pode começar o render/UI contra o C3 usando um replay/estado de teste, e integrar quando o motor do M2 emitir os eventos reais; **Apolo** escreve os textos.
3. **Vega (áudio)** + **Íris (validação)** depois do core.
4. **D3b (medidor de maluquice):** OPCIONAL, **depois** do core do M2 (recomendação do plano §3.5/§9).

## 4. Pronto quando (plano §7 M2)
- Todas as manobras **executáveis por replay gravado**.
- Gesto reconhecido em **≥95%** dos casos sintéticos.
- **Portão do dono:** o dono faz um mortal nos primeiros 30 s **sem explicação** (teste de olho, relatado por ele).
- (+ determinismo com pontos; harness do bot ousado verde.)

## 5. Decisões em aberto que o M2 toca
- **D3b** medidor de maluquice: no M2 ou depois? Recomendação: core do M2 primeiro, medidor depois.
- **D5** orçamento de arte: decidir **ao fim do M2** (folha B do mascote + o elenco de 6 para o M3).

## 6. Capacidade
O design (este doc) está pronto. A **implementação aguarda o reset do limite semanal da squad** (Vega/Lyra/Apolo/Íris são sonnet) ou o Atlas (opus) tocar partes diretas. Ao delegar, seguir a sequência da seção 3 e repassar o "PARA O PRÓXIMO" entre os agentes.
