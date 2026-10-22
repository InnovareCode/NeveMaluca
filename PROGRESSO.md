# NEVE MALUCA — Progresso

Atualizado em 2026-10-22 (Nova; pós-QA do M0 por Vega; Atlas assumiu a sessão dedicada, cadastrou o projeto no painel e resolveu D1–D10). Repositório git local; commit inicial local em preparação nesta sessão (gate: `npm run verificar` verde), sem remoto.

## Estado em 2026-10-22 — o mais novo
- **M0 pronto no código** (fundação, core, plataforma, save e a costura das três partes). `npm run verificar` verde. Sem commit e sem remoto (Atlas decide).
- **QA do M0: APROVADO pela Íris com ressalvas** (3 achados de baixo risco + sujeira); todas corrigidas pela Vega no pós-QA (2026-10-22): (1) `textoDoErro` agora monta
  `Nome: mensagem` e anexa a pilha se ela não traz a mensagem (WebKit); (2) os 2 `<link rel=preload>` das fontes saíram do `index.html` (segundo a Íris, no WebKit não casam e baixam de novo;
  `carregarFontes` segue pedindo as faces antes do 1º quadro); (3) o laço da platform passou a delegar a conta de ticks ao `core/laco.ts`; (4) 9 arquivos de CRLF para LF; (5) `.gitignore` ampliado.
  `npm run verificar` verde (343 unit; 18 e2e do build; 91 e2e dev, 2 skipped que já existiam); bundle JS 12,3 KB gzip. Detalhes na seção "Pós-QA" de `docs/handoff-vega-m0-integracao.md`.
- **Decisão do laço (vale para o M1):** `src/core/laco.ts` (`criarLaco().quadro(carimbo, passo)`, `reiniciar()` na retomada) é a **única fonte de ticks por quadro**; `platform/laco.ts` só
  agenda o rAF, pausa por motivo e para no erro. Medido pela Íris antes da troca: 60 Hz exatos = platform 3599 ticks em 3600 quadros (quadros de 0 e de 2 ticks); quadros de 95 ms =
  platform 3419 x core 3300; jitter 95,1,95,1 = 130 ticks de divergência; teto de 6 ticks por quadro igual nos dois.
- **O que existe:** `src/core/` (Vega: RNG, trig tabelado, hash, contratos, replay, laço), `src/platform/` + cena de boot (Lyra), `src/meta/storage.ts` (Cronos, save
  `neve-maluca-v1`), fundação, CI e CSP (Vulcano), `src/data/regras-save.ts` (ids provisórios), `src/audio/audio-destravavel.ts` (destrave do iPhone, sem sons).
  O `main.ts` valida o núcleo no boot, lê o save, liga o destrave de áudio e roda a cena vazia. Bundle inicial: JS 12,3 KB gzip (meta <= 60 KB), CSS 1,5 KB.
- **O que NÃO está provado (precisa do dono, no iPhone real):** safe-area/entalhe, COMO ATIVAR no Chrome do iOS, destrave de áudio no WebKit do iOS (o WebKit do
  Playwright no Windows nem tem Web Audio), fps com CPU 4x em canvas por software (p95 33 ms, piso do ambiente), `localStorage` do Safari privado. O CI `ci.yml` nunca rodou (sem remoto).
- **Próximo passo:** commit inicial (Atlas) e M1a (descida cinza, `pista/` + `descida/`, com portão do dono). Antes: ver "Decisões em aberto" abaixo e o handoff
  `docs/handoff-vega-m0-integracao.md`.

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
| Fase 1 (UI) | Apresentação (Splash animado), Menu Principal estilizado e Opções funcionais | concluído pela Lyra, 100% verificado (411 unit, 18 build, 109 e2e), testado visualmente |
| M1b | 1 personagem (Capi Barbosa), arte integrada | sprites da Capi integrados na descida; próximos: cenários ricos e obstáculos estilo Pixar |
| M2 | manobras, combos, replay e fantasma | não iniciado |
| M3 | 5 pistas e 4 personagens | não iniciado |
| M4 | polimento mobile | não iniciado |
| M5 | segurança e deploy | não iniciado |
