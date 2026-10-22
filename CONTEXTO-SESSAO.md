# CONTEXTO DA SESSÃO — Neve Maluca (handoff para troca de conta)

> **Para que serve este arquivo:** o dono vai trocar de conta do Claude (limite de uso). Na conta nova,
> a primeira coisa a fazer é **ler este arquivo + `CLAUDE.md` (global) + `PROGRESSO.md` + os handoffs em `docs/`**.
> Com isso o novo Atlas retoma exatamente de onde paramos, sem reconstruir nada do zero.
> Escrito pelo Atlas em 2026-10-22. Mantenha atualizado ao fim de cada marco.

---

## 0. Como retomar (faça nesta ordem)

1. Leia `CLAUDE.md` (global, define a squad e os protocolos: painel, memória, handoff, economia de tokens).
2. Leia este arquivo inteiro.
3. Leia `PROGRESSO.md` (estado oficial + decisões D1–D10) e, na pasta `docs/`, nesta ordem:
   `plano-neve-maluca.md` (Nova), `direcao-arte-neve-maluca.md` (Apolo), `HANDOFF-SESSAO-DEDICADA.md`,
   depois os `handoff-*-m0.md`.
4. Confira o estado real: `git log --oneline`, `git status`, e o quadro do painel (comando na seção 3).
5. Retome pelo **PRÓXIMO PASSO IMEDIATO** (seção 7): lançar o M1a (Vega + Lyra em paralelo).

---

## 1. O que é o Neve Maluca

Jogo de **descida na neve, 2,5D lateral estilo *Alto's Adventure*, em Canvas 2D**. Alvo principal: **iPhone com
Chrome (WebKit)**; também PC com teclado/controle. Personagens cômicos originais em estilo de animação 3D (só o
estilo). Projeto irmão do **InnoFighters** (`C:\Projetos\Web\InnoGames\InnoFighters`): reaproveita padrões e
ferramentas copiando e adaptando, sem copiar o jogo.

Pasta: `C:\Projetos\Web\InnoGames\NeveMaluca`.

## 2. Estado atual (2026-10-22)

- **M0 (fundação) FECHADO e COMMITADO localmente.** Dois commits na branch `main`:
  - `0ee905e` — M0: fundação (`src/` com as 11 camadas, testes, CI/CSP, docs de plano e handoffs, `PROGRESSO.md`).
  - `765a70f` — relatórios de arte da Capi (separados porque citam `arte-fonte/`, que é gitignored).
- `npm run verificar` **verde provado nesta sessão**: 343 unit + 18 e2e de build + 91 e2e (2 skipped). Bundle JS ~12,3 KB gzip.
- **Identidade git local** deste repo: `InnovareCode Squad <dev@innovarecode.com.br>` (espelhada do InnoFighters).
- **Decisões D1–D10 resolvidas** e gravadas no `PROGRESSO.md` (resumo na seção 4 abaixo).
- Working tree limpo no momento deste handoff (fora as edições de contexto/repo deste turno).

## 3. Painel de tarefas (JÁ INTEGRADO)

- Projeto **cadastrado** no painel: `https://painel.innovarecode.com.br/`. Prefixo **`NEVEMALUCA`**, slug **`nevemaluca`**,
  id público **PM-AVMX**. O par `NEVEMALUCA_PROJECT_ID`/`NEVEMALUCA_API_KEY` já está em
  `C:\Projetos\App\innovarecode-missoes\.env.integration` (a chave NÃO é repetida aqui de propósito — está no
  `.env.integration`, que é gitignored; não comite chave).
- A descoberta é automática; os hooks globais publicam a telemetria dos agentes.
- Comandos (rodar de dentro da pasta do projeto):
  ```
  node C:/Projetos/App/innovarecode-missoes/scripts/quadro.mjs                                   # ver o quadro
  node .../quadro.mjs abrir "titulo" <agente|-> "escopo" --projeto=nevemaluca                     # 1a missao sem .missao-atual
  node .../quadro.mjs fechar <id> "entrega"
  node .../quadro.mjs dono <id> <agente> "o que vai fazer"
  ```
- ⚠ `abrir`/`fechar` **mutam produção** e sobrescrevem `.missao-atual` sem backup. Leia o cabeçalho do `quadro.mjs`
  antes de usar. No momento deste handoff **não há missão aberta** e `.missao-atual` não existe (estado limpo).

## 4. Decisões (resumo; detalhe completo no PROGRESSO.md)

- **D1** câmera: **A — 2,5D lateral, Canvas 2D, sprites** (dono). **D2** orientação: **paisagem** (dono).
- **D3** elenco: **6 personagens no total, inicialmente** (dono — NÃO os 4 do plano). Capi Barbosa já em produção;
  faltam Professora Bandeira, Vó Cidinha, Brunão, Quequé, Bia Bolota. Mascote KAKÁ a confirmar.
- **D3b** medidor de maluquice: depois do M2. **D4** ranking: **só local**. **D6** idioma: **pt-BR**.
  **D7** desafio do dia: **sim**. **D9** logotipo: tipográfico provisório até M4.
  **D10** toque: **gestos padrão, botões em Opções**.
- **D8** remoto + site de teste: **ATIVADO AGORA** pelo dono (ver seção 5).
- **D5 (EM ABERTO DE PROPÓSITO)** orçamento de arte: com 6 personagens, passa da cota gratuita da Runway.
  Decidir ao **fim do M2** (plano pago vs. gerar o elenco em etapas). Grátis cobre M1 e M2.
- Todas as D3b–D10 foram adotadas das recomendações do plano §9 porque o dono delegou ao Atlas e aprovou pendências.

## 5. Repositório remoto + GitHub Pages (D8, ativado pelo dono em 2026-10-22)

- **URL do remoto:** `https://github.com/InnovareCode/NeveMaluca.git`
- **Usar GitHub Pages** para o site de teste (jogar no iPhone real).
- **Estado neste handoff:** ver a seção "ATUALIZAÇÃO DO TURNO" no fim do arquivo (push e Pages podem já ter sido
  feitos ou ficado como próximo passo, dependendo de onde o turno parou).
- Pendente de DevOps (**Vulcano**): workflow de deploy do Pages para app Vite (build → publicar `dist/`), e conferir
  CSP em cabeçalho/meta no ambiente do Pages. O projeto já tem CI em `.github/` pronto pra quando houver remoto.
- Regra: **nunca** `git push --force` nem mexer em histórico sem OK do dono.

## 6. Arte pendente (Capi Barbosa, primeiro personagem)

- Tudo em `arte-fonte/personagens/capi/` (gitignored; nunca sobrescrever, nova versão = novo nome no arquivo).
- F1 (descida) e F2 (manobras): **aprovadas** pelo dono e curadas (relatórios em `docs/relatorio-curadoria-capi-f*.md`).
- F3 (festa/telas) e folha de reposição (6 células): **GERADAS, ainda não curadas nem mostradas ao dono**.
  O dono **já aprovou** tudo que estava pendente de aprovação (2026-10-22). Próximo: **Apolo cura** F3 + reposição
  (ferramentas em `arte-fonte/ferramentas-curadoria/`), depois a Vega adapta o pipeline de sprites (contato/pivô, C1).
- Só o Atlas alcança o MCP da Runway. Conta: workspace "InnovareCodeDesenvolvimento", plano Free (~470 créditos).

## 7. PRÓXIMO PASSO IMEDIATO — M1a (protótipo cinza da descida)

O dono escolheu começar o **M1a**: protótipo cinza, **sem arte**, até o portão do dono *"a sensação de descer está boa?"*.
O contrato entre camadas **já está 100% pronto** em `src/core/contratos.ts` (C2 ComandoDescida/InputFrame, C3
LeituraDescida/EventoDescida, C5 DefPista/PistaGerada, C6 ReplayV1 — dono do arquivo é a Vega; Lyra só lê). Os stubs
`src/descida/`, `src/pista/`, `src/render/`, `src/input/` existem. Por isso **Vega e Lyra podem rodar EM PARALELO**.

**Abrir UMA missão no painel** (`abrir "M1a: prototipo cinza da descida" atlas "..." --projeto=nevemaluca`) e então
delegar os dois briefings abaixo (Agent tool, em paralelo). Depois: integração (ligar render ao motor na cena de
descida + `main.ts`) e **Íris** (determinismo, e2e de toque, portão de fps), e então o portão do dono.

### Briefing pronto — VEGA (motor + pista + bot)
> M1a (protótipo cinza, sem arte) — lado Vega. Implemente o MOTOR e o GERADOR de pista conforme o plano
> `docs/plano-neve-maluca.md` §3.3 (física/determinismo), §3.4 (gerador por semente) e §7 (M1a), contra o contrato
> JÁ PRONTO em `src/core/contratos.ts` (C2/C3/C5/C6 — não altere sem passar pelo Atlas).
> SEUS arquivos: `src/descida/` (motor: consome ComandoDescida, emite LeituraDescida+EventoDescida; pontuação aqui
> dentro), `src/pista/` (gerador C5: catálogo de trechos, Hermite, alturas Float64Array a cada 0,5 m, hashEsperado),
> `src/data/` (pista inicial `morro-do-pinhao`), `ferramentas/harness/` (bot que desce a pista), testes unit.
> Regras: `core/laco.ts` é a ÚNICA fonte de ticks (guarde o contador no estado; replay independe do laço); proibido
> `Math.sin/cos/atan2/pow/exp` em `descida/` e `pista/` (use `core/trig.ts`); use `core/rng.ts`, `core/comandos.ts`
> (`derivarComando`), `core/hash.ts`, `core/replay.ts`.
> NÃO toque: `src/render/`, `src/input/`, `src/ui/cenas/`, `src/main.ts`.
> DoD: `npm run verificar` verde; determinismo (mesma semente+comandos → mesmo hash após 5400 ticks); bot conclui
> 100/100 sementes. Memória antes do disco: `memoria.mjs buscar "motor deterministico descida" --agente=vega`
> (e "trig tabelado", "gerador de pista semente"). Skills: `handoff-da-equipe`, `quem-valida-o-que`. Devolva no
> formato de handoff, e no PARA O PRÓXIMO diga à Lyra como instanciar o motor e alimentar/ler o contrato.

### Briefing pronto — LYRA (render + input + câmera + HUD + cenas)
> M1a (protótipo cinza, sem arte) — lado Lyra. Implemente render, entrada, câmera e cenas conforme o plano
> `docs/plano-neve-maluca.md` §3.6 (câmera), §3.7 (entrada) e §7 (M1a), contra o contrato JÁ PRONTO em
> `src/core/contratos.ts` (lê LeituraDescida C3; produz InputFrame/ComandoDescida C2 — só leitura do contrato).
> Convenções do contrato: posições em METROS, ângulos em GRAUS (0 = +x, anti-horário).
> SEUS arquivos: `src/render/` (terreno cinza a partir de `PistaGerada.alturas`, parallax procedural, piloto como
> CÁPSULA, câmera mola+zoom §3.6, HUD de velocidade e pontos), `src/input/` (gestos de toque + teclado →
> ComandoDescida; no iPhone/Chrome: `touch-action:none`, `overscroll-behavior:none`, margem nas bordas pra não
> voltar a página), `src/ui/cenas/` (cena de descida + cena de resultado).
> Enquanto o motor da Vega não chega, desenvolva contra um gerador de `LeituraDescida` de teste (descida roteirizada)
> e um `PistaGerada` de teste — a integração com o motor real é um passo posterior.
> NÃO toque: `src/descida/`, `src/pista/`, `src/core/contratos.ts`, `src/main.ts`.
> DoD: `npm run verificar` verde; a cena de descida renderiza e responde a toque/teclado MEDIDO NO NAVEGADOR (não
> deduzido). Reutilize a escala/letterbox que já existe em `platform/`. Memória antes do disco:
> `memoria.mjs buscar "render canvas parallax" --agente=lyra` (e "input gestos toque iphone", "escala letterbox").
> Skills OBRIGATÓRIAS: `medir-antes-de-afirmar`, `handoff-da-equipe`, `quem-valida-o-que`. Devolva no formato de handoff.

## 8. Convenções e armadilhas (não repetir erros já pagos)

- **Windows:** nunca `rm -rf` / `Remove-Item` em pasta com junção para `node_modules` (já apagou o node_modules real
  uma vez no InnoFighters). Heredoc do bash quebra com apóstrofo/crase: use a ferramenta Write para arquivos.
- **Rodar:** `npm ci` e `npm run verificar` (typecheck → unit → e2e build → e2e). Portas FIXAS 5273 (dev) e 4273 (preview).
- **Determinismo:** nada de `Math.sin/cos/atan2/pow/exp` em `descida/` e `pista/` — `core/trig.ts`. `+ − × ÷` e `sqrt` ok.
- **Laço:** `core/laco.ts` é a única fonte de ticks por quadro; `platform/laco.ts` só agenda rAF/pausa.
- **Contrato:** mudança em `src/core/contratos.ts` passa pelo Atlas (Lyra/Cronos só leem).
- **Economia de tokens (CLAUDE.md):** briefing < 15 linhas, aponte o plano/arquivo em vez de transcrever, passe
  ASSUNTO/slug de memória (nunca caminho de `agent-memory/`), e agrupe trabalho da mesma área num agente só.

## 9. Marcos
M0 ✅ (fechado, commitado). **M1a → EM ANDAMENTO (próximo a disparar).** M1b (arte) após o portão do M1a.
M2 manobras/combos/replay/fantasma. M3 5 pistas + 4 personagens. M4 polimento mobile. M5 segurança/deploy.

---

## ATUALIZAÇÃO DO TURNO (2026-10-22) — onde este turno parou
<!-- Atualizar esta seção ao fim do turno: o que foi feito do remoto/Pages e se o M1a já foi disparado. -->
- Arquivo de contexto criado, commitado e empurrado.
- **Remoto ATIVADO:** `origin` = `https://github.com/InnovareCode/NeveMaluca.git`; `git push -u origin main` feito
  (commits `0ee905e` + `765a70f` no GitHub, `main` rastreando `origin/main`). Credencial via Git Credential Manager
  (helper `manager`), já na máquina — não precisa de `gh`.
- **GitHub Pages: PENDENTE (próximo passo do Vulcano).** Falta criar `.github/workflows/pages.yml` (build Vite →
  `actions/deploy-pages`) e pôr `base: '/NeveMaluca/'` no Vite só no build. **O DONO precisa habilitar** em
  Settings → Pages → Source: "GitHub Actions" (não dá por CLI sem `gh`/PAT exposto).
- M1a: briefings prontos na seção 7; **lançar na conta nova** (ou quando o dono confirmar que não vai trocar agora).
