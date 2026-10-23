# NEVE MALUCA — Progresso

Atualizado em 2026-10-23. Repositório git local + remoto `origin` (GitHub) + **Pages publicado e jogável**. M0, M1a e a primeira leva de arte/UI (Capi + splash/menu/cenários Pixar) concluídos, commitados e no ar.

## Estado em 2026-10-23 — o mais novo
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
- **D8** repositório remoto + site de teste: **ATIVADO** (dono, 2026-10-22). `origin` = `https://github.com/InnovareCode/NeveMaluca.git`, baseline empurrado. **GitHub Pages pendente** (Vulcano: workflow de deploy + `base` do Vite; dono habilita Source "GitHub Actions" nas Settings).
- **D9** logotipo: **tipográfico provisório até o M4**.
- **D10** toque: **gestos por padrão, botões em Opções**; agachar por toque só se o M1a mostrar falta.

## Decisões em aberto
Detalhes, opções e recomendação na seção 9 de `docs/plano-neve-maluca.md`.

- **D5 (orçamento de arte)** — com 6 personagens decididos, o custo da Runway passa da cota gratuita (plano §6.4).
  Decidir ao **fim do M2**, com a qualidade das folhas na mão: plano pago, ou gerar o elenco em etapas ao longo dos
  marcos. As gerações gratuitas cobrem o M1 e o M2.

## Marcos
| Marco | Conteúdo | Estado |
|---|---|---|
| M0 | fundação e CI | pronto, commitado e empurrado no remoto |
| M1a | protótipo de descida cinza (motor real + render + cenas + Pages) | concluído, commitado e empurrado |
| Fase 1 (UI) | Apresentação (Splash animado), Menu Principal estilizado e Opções funcionais | concluído pela Lyra, 100% verificado (411 unit, 18 build, 109 e2e), commitado |
| Fase 2 (Cenários) | Morro do Pinhão estilo Pixar (araucárias, pinheiros, celeiro vermelho, montanhas facetadas, partículas de spray e neve volumosa) | concluído, commitado e empurrado |
| Fase 3 (Obstáculos & Gameplay) | Estilização vetorial rica 3D/Pixar (pedras facetadas, troncos com casca/anéis, boneco de neve, cerca/trilho para grind, rampas com bandeira e pinhão dourado) | concluído e testado unitariamente |
| M2 | manobras, combos, replay e fantasma | não iniciado |
| M3 | 5 pistas e 4 personagens | não iniciado |
| M4 | polimento mobile | não iniciado |
| M5 | segurança e deploy | não iniciado |
