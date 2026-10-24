# NEVE MALUCA — Progresso

Atualizado em 2026-10-23. Repositório git local + remoto `origin` (GitHub) + **Pages publicado e jogável**. M0, M1a e a primeira leva de arte/UI (Capi + splash/menu/cenários Pixar) concluídos, commitados e no ar. **Elenco completo (6/6) com arte pronta E jogável** — ainda NÃO commitado (ver "Estado").

## Estado em 2026-10-24 — o mais novo
- **CENÁRIOS EM ESTILO PIXAR RASTER — AS 5 PISTAS CONCLUÍDAS, COMMITADAS E NO AR:** o dono pediu que os cenários/pistas/menus também fossem gerados em estilo Pixar (não mais 2D vetorial), pra casar com os personagens 3D. Feito o **piloto (Pico do Picolé)** e o **rollout das outras 4** (Morro do Pinhão, Vila do Chocolate Quente, Vulcão Pé-Gelado, Cume da Ventania). Cada pista = **6 imagens** (3 camadas de parallax + manta + folha de objetos + folha de texturas) geradas por IA (Runway nano-banana-2.1, 2K) com fundo chroma (verde; **magenta só no Morro**, tema cheio de verde) e recortadas. Técnica: *a pele vira imagem, a forma/física continua no código* — parallax raster, manta cisalhada, objetos pré-contornados. **Custo: 24 img × 6 = 144 dos 170 créditos grátis; 26 de reserva intactos.**
  - **Pipeline VERSIONADO:** `ferramentas/cenario-raster.py` (generalizado do piloto, não depende mais de `arte-fonte/` gitignored): chroma verde/magenta + despill, config por pista (manta, texturas, objetos, chave forte pra `obj-lua`). Resolve a pendência do script de recorte. Scripts de prova por pista em `ferramentas/medir/cenario-raster-<tema>.mjs`.
  - **Pintores raster** (um por tema, `PintorTema`, fallback vetorial): `parque-raster` (Picolé), `bosque-raster` (Morro), `vila-raster`, `vulcao-raster`, `cume-raster` em `src/render/temas/`; `catalogo.ts` mapeia tema→raster + preload disparado na seleção de pista. Receita da NOITE (Vila/Vulcão/Cume): contorno duplo pré-assado (TRIPLO no Vulcão, 2 luzes), lua + brilho fixos na camada 1b, janelas/magma por código, trilhos ladrilhados, pórtico de gelo montado por código.
  - **`npm run verificar` VERDE** (625 unit + 18 build + 118 e2e, **Chromium E WebKit**). Provado em jogo (Lyra, navegador real) nas 4 pistas. Commits `8dd5c4b` (Morro + pipeline), `1096c67` (Vila), `a4b922b` (Vulcão+Cume) + `8729926` (piloto Picolé) — **empurrados em 2026-10-24, deploy Pages automático.**
  - **Decisões da Lyra (não-bloqueantes, revisáveis):** aurora do Cume sem pulsação (ficha marcava "testar se incomoda"); sem variante âmbar da biruta no Vulcão/Cume (só a Vila tinha).
  - **Falta (fora do rollout, adiado pelo dono):** menus/telas/HUD em Pixar (precisa do plano pago Runway — os 26 de reserva não cobrem); plano/prompts em `docs/rollout-cenarios-pixar.md`.
- **M3 — FÍSICA POR PERSONAGEM e as 5 PISTAS prontas e commitadas:** cada um dos 6 tem sua `ConfigDescida` (atributos elenco-m3 §4 → motor, relativo à Capi); a **Capi fica IDÊNTICA** (golden `m3-congelamento-capi` trava). As 5 pistas jogáveis + tela de seleção de pista. **D5 (revisto pelo dono): a Capi é a personagem SEGURA — equilíbrio 110 → pontua ~18% menos DE PROPÓSITO.** Plano: `docs/plano-m3.md`; temas: `docs/temas-pistas-m3.md`.

## Estado em 2026-10-23
- **M3 — FÍSICA POR PERSONAGEM pronta e commitada:** cada um dos 6 tem sua `ConfigDescida` (atributos elenco-m3 §4 → motor, relativo à Capi); a **Capi fica IDÊNTICA** (golden `m3-congelamento-capi` trava). Contratos novos (`DefPersonagem`/`DefPista`/`DefObjetivo`/`fatorEmbalo`), `VERSAO_MOTOR='2'` (replay v1 só pra Capi). Harness `npm run balanco` (bot manobreiro) mede o equilíbrio. **D5 (revisto pelo dono): a Capi é a personagem SEGURA — equilíbrio 110 → pontua ~18% menos DE PROPÓSITO; critério afrouxado pra não homogeneizar o elenco (provado que giro não fecha isso).** Plano: `docs/plano-m3.md`; temas: `docs/temas-pistas-m3.md`. Falta: as 5 pistas (geração por tema).
- **ELENCO COMPLETO E JOGÁVEL (ainda NÃO commitado, sem build/deploy):** os 6 personagens (Capi, Prof. Bandeira, Vó Cidinha, Tio Beto, Quequé, Bia Pipoca) têm arte pronta (mestra+F1+F2, aprovada pelo dono) e estão **jogáveis**:
  - **Arte:** 120 sprites (5 novos × 24 poses) recortados e empacotados em `public/assets/personagens/<id>/` (manifesto + recortes), schema igual ao da Capi. Pipeline generalizada em `arte-fonte/ferramentas-curadoria/gerar_personagem.py` (Vega). Fontes em `arte-fonte/personagens/<id>/` (gitignored? conferir). Custo: ~198 dos 500 créditos Runway (D5 cota gratuita).
  - **Jogo:** tela de **seleção de personagem** nova (`src/ui/cenas/selecao.ts`, botão PERSONAGEM no menu, tecla P), escolha persistida no save (`personagemAtivo` em `meta/`), id threadado até o loader; os 2 `'capi'` fixos trocados. Gating de desbloqueio é M3-futuro (todos liberados por ora). `npm run verificar` VERDE (488 unit, 18 build, 112 e2e) + e2e novo da seleção (Lyra).
  - **Provado em jogo** (Atlas, navegador real): menu→seleção→escolhe Tio Beto→persiste no F5→desce o Morro do Pinhão com o sprite real; console limpo.
  - **Pendências:** `brunao`→`beto` feito no catálogo; física por personagem (atributos elenco-m3 §4) é M3-futuro (todos usam `CONFIG_PADRAO`); doc `direcao-arte` §2/§7 ainda cita "Brunão"; `CONTEXTO-SESSAO.md` a atualizar.
- **AO VIVO e jogável:** https://innovarecode.github.io/NeveMaluca/ (GitHub Pages; deploy por `.github/workflows/pages.yml`). Fluxo: splash → menu (JOGAR/MODOS/OPÇÕES) → descida com a Capi → resultado.
- **`npm run verificar` VERDE** no main (2026-10-23): **436 unit, 18 e2e de build, 109 e2e** (2 skipped).
- **Concluído, commitado e no remoto:**
  - **M0** — fundação, core, save, CI, CSP.
  - **M1a** — descida com o **motor real da Vega** (física/pista/bot) ligado ao render da Lyra. `src/ui/cenas/gerenciador.ts` é o diretor de cenas (com `destruir()` pra limpar eventos); `main.ts` boota nele, não mais na cena vazia.
  - **M1b (1º personagem)** — **Capi Barbosa** no piloto (11 recortes de sprite; poses `ride/tuck/air/flip/land/fall/rail/celeb`).
  - **UI (Fase 1)** — splash, menu principal, opções (controles/áudio/tela cheia gravados no save, um ponto de escrita no gerenciador).
  - **Arte (Fases 2 e 3)** — Morro do Pinhão estilo Pixar (araucárias, pinheiros, celeiro, montanhas facetadas, spray/neve) e obstáculos/trilhos/rampas/coletáveis estilizados.
- **Decisão do laço (ainda vale):** `src/core/laco.ts` é a **única fonte de ticks por quadro**; `platform/laco.ts` só agenda o rAF, pausa por motivo e para no erro.
- **O que NÃO está provado (precisa do dono, no iPhone real):** o **portão de "feel" do M1a** (*"a sensação de descer está boa?"*) nunca foi dado formalmente — agora dá, pela URL; safe-area/entalhe; destrave de áudio no WebKit do iOS; fps real no aparelho; tela cheia "Adicionar à Tela de Início".
- **Próximo passo:** **M2** — manobras, combos, replay e pontuação (hoje o placar fica `000000`). É o que falta pro jogo ser *divertido*, não só bonito. Detalhes do M0 original em `docs/handoff-vega-m0-integracao.md`.

### Decisões da integração do M0 (Vega, 2026-10-22)
- `platform/constantes.ts` é só re-export de `core/constantes` (uma fonte de verdade). Os dois laços ficam: `platform/laco.ts` (rAF, pausa por motivo) e `core/laco.ts` (puro).
  ~~Divergem no teto de 100 ms; não alinhado~~ **SUPERADO no pós-QA:** a platform agora delega a conta ao core (ver "Decisão do laço" acima).
- `main.ts` importa `./platform/erros-no-carregamento` PRIMEIRO, para falha de validação do `core/` no import aparecer na `#err` (antes seria tela em branco).
- Aviso "Progresso não salvo neste aparelho" quando `save.avisar` **ou** `!armazenamento.persistente` (modo privado não gera `indisponivel` com o armazenamento resiliente).
- `data/regras-save.ts`: ids provisórios (6 personagens, 5 pistas, 3 objetivos por pista, iniciais `capi` e `morro-do-pinhao`); `versaoPista` = `"provisoria"`.

## Decididas
1. **Nome: NEVE MALUCA** (dono, 2026-10-22).
2. Personagens originais e cômicos com estilo de animação 3D; só o estilo, nenhum personagem de estúdio (dono).
3. Aparelho principal: iPhone com Chrome (WebKit); também PC com teclado e controle (dono).
4. Projeto irmão do InnoFighters: reaproveitar padrões e ferramentas copiando e adaptando, sem copiar o jogo.
5. **D1 — câmera/caminho técnico: Opção A** (2,5D lateral, Canvas 2D, personagens em sprite) (dono, 2026-10-22).
6. **D2 — orientação: paisagem** (dono, 2026-10-22).
7. **D3 (elenco) — serão 6 personagens no total, inicialmente** (dono, 2026-10-22), e não 4 como o plano §9 recomendava.
   A Capi Barbosa já está em produção (arte F1/F2 aprovadas); os outros 5 da tabela 6.2 do plano (Professora Bandeira,
   Vó Cidinha, Brunão, Quequé, Bia Bolota) entram na sequência. Mascote KAKÁ (recomendação do plano) a confirmar com o dono.
   **Consequência:** muda D5 (orçamento) — 6 personagens não cabem na cota gratuita da Runway (ver D5 em aberto).

### Decisões D3b–D10 (dono delegou ao Atlas e aprovou pendências em 2026-10-22; adotadas as recomendações do plano §9, salvo onde o próprio plano manda esperar)
- **D3b** medidor de maluquice: depois do M2.
- **D4** ranking: **só local** (o formato de replay C6 já prepara um online futuro).
- **D6** idioma: **pt-BR** (textos já em tabela; inglês fica como possível M4+).
- **D7** desafio do dia: **sim** (semente derivada da data UTC).
- **D8** repositório remoto + site de teste: **ATIVADO e NO AR** (dono, 2026-10-22/23). `origin` no GitHub; **GitHub Pages publicado e jogável** em https://innovarecode.github.io/NeveMaluca/ (`.github/workflows/pages.yml`, deploy automático a cada push).
- **D9** logotipo: **tipográfico provisório até o M4**.
- **D10** toque: **gestos por padrão, botões em Opções**; agachar por toque só se o M1a mostrar falta.
- **D5 (orçamento de arte) — DECIDIDO: cota GRATUITA, em etapas** (dono, 2026-10-23). Gerar os 5 personagens restantes + objetos por tema em LOTES, dentro dos ~404 créditos + 500/mês da Runway Free (Nano Banana 2K = 6 créd/img; M3 estimado em ~150-200 créd → cabe). Custo R$0. Fallback: Standard 1 mês (~$12-15, 625 créd) se bater o teto mensal num pico de refação.

## Decisões em aberto
Nenhuma formal no momento. Pontos menores a fechar na hora de gerar: os nomes finais dos 5 personagens (o plano §6.2 e os handoffs divergem) e a confirmação do mascote (recomendação do plano: KAKÁ, a capivara).

## Marcos
| Marco | Conteúdo | Estado |
|---|---|---|
| M0 | fundação e CI | pronto, commitado e empurrado no remoto |
| M1a | protótipo de descida cinza (motor real + render + cenas + Pages) | concluído, commitado e empurrado |
| Fase 1 (UI) | Apresentação (Splash animado), Menu Principal estilizado e Opções funcionais | concluído pela Lyra, 100% verificado (411 unit, 18 build, 109 e2e), commitado |
| Fase 2 (Cenários) | Morro do Pinhão estilo Pixar (araucárias, pinheiros, celeiro vermelho, montanhas facetadas, partículas de spray e neve volumosa) | concluído, commitado e empurrado |
| Fase 3 (Obstáculos & Gameplay) | Estilização vetorial rica 3D/Pixar (pedras facetadas, troncos com casca/anéis, boneco de neve, cerca/trilho para grind, rampas com bandeira e pinhão dourado) | concluído e testado unitariamente |
| M2 | manobras, combos, replay e fantasma | **núcleo concluído e APROVADO pela Íris** (manobras pontuadas, combo, pontuação, nomes cômicos, popup + barra de combo, áudio sintetizado; commit 17c5080; `verificar` verde). **Replay/fantasma ✅** (grava o run, persiste recorde+fantasma — que nem salvavam —, corre contra o fantasma translúcido; provado por mutação + e2e de navegador que instrumenta o globalAlpha) e **testes de render ✅** (popup de manobra + barra de combo). **Música adaptativa ✅** (trilha procedural sintetizada que reage ao combo/velocidade, sem assets). **M2 restante CONCLUÍDA.** |
| M3 | 5 pistas e os 5 personagens restantes | **arte do elenco 6/6 pronta e aprovada; os 5 novos JOGÁVEIS (recorte + seleção), `verificar` verde — a commitar.** Faltam: as 5 pistas, física por personagem (atributos), e F3/objetos de arte (adiáveis) |
| M4 | polimento mobile | não iniciado |
| M5 | segurança e deploy | não iniciado |
