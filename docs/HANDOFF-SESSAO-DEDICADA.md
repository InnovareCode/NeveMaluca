# Neve Maluca: passagem de bastão para a sessão dedicada

Data: 2026-10-22. Escrito pelo Atlas da sessão do InnoFighters, a pedido do dono: a partir daqui o Neve Maluca é
tratado na sessão própria dele, e a sessão do InnoFighters fica só com o InnoFighters.

Leia primeiro, nesta ordem: `PROGRESSO.md`, `docs/plano-neve-maluca.md` (Nova), `docs/direcao-arte-neve-maluca.md`
(Apolo, versão 2, vista lateral), depois os handoffs `docs/handoff-*-m0.md`.

## 1. Estado do projeto

- Pasta: `C:\Projetos\Web\InnoGames\NeveMaluca`. Git LOCAL na branch `main`, SEM remoto e SEM nenhum commit ainda.
- Decisões do dono (2026-10-22): nome NEVE MALUCA; D1 = 2,5D lateral estilo Alto em Canvas 2D; D2 = paisagem;
  iPhone com Chrome é o aparelho principal. Personagens cômicos originais em estilo de animação 3D (só o estilo).
- M0 (fundação): código pronto e APROVADO pela Íris numa cópia limpa e num clone (338 testes unitários, 18 e2e de
  build, 91 e2e; JS inicial 12,4 KB gzip). Ressalvas e ajustes pós-QA: ver `docs/handoff-vega-m0-integracao.md`.
- EM ANDAMENTO quando esta nota foi escrita: um agente da Vega aplicando os ajustes pós-QA (textoDoErro no WebKit,
  remover os 2 preloads de fontes, trocar o laço da platform pelo `core/laco.ts`, converter 8 arquivos CRLF para LF,
  ampliar o `.gitignore`). Confira `git status`, rode `npm run verificar` sozinho (portas fixas 5273/4273) e leia a
  seção "Pós-QA" do handoff antes de commitar. Se o agente não terminou, os itens acima ainda estão pendentes.
- Painel de tarefas: o projeto NÃO está cadastrado no painel (falta o par NEVEMALUCA_PROJECT_ID/NEVEMALUCA_API_KEY em
  `innovarecode-missoes/.env.integration`). Sem isso, nada do projeto aparece no painel nem tem telemetria dos agentes.
  Quem cadastrar o projeto no painel passa o id para o Atlas desta sessão registrar. Não peça nem digite senha/chave.

## 2. Primeiro commit local (sugestão da Íris)

Dois commits, depois dos ajustes pós-QA:
1. Todos os arquivos estáveis (configuração, `src/` com as 11 camadas, `tests/`, `public/`, `.github/`, `docs/plano-*`
   e `docs/handoff-*-m0.md`, `PROGRESSO.md`, `README.md`). Conferir com `git ls-files -o --exclude-standard`.
2. Os três relatórios de arte do Apolo (`docs/direcao-arte-neve-maluca.md`, `docs/relatorio-curadoria-capi-f1.md` e
   `...-f2.md`), porque citam arquivos que ficam fora do git (`arte-fonte/` é ignorada de propósito).
Nunca criar repositório remoto nem fazer push sem autorização do dono. Recomendação do plano: criar o remoto no M1.

## 3. Arte da Capi Barbosa (primeiro personagem)

Tudo em `arte-fonte/personagens/capi/` (ignorado pelo git). Nunca sobrescrever: novos arquivos levam versão no nome.
- `folhas/capi-mestra-v1.png`: imagem-mestra aprovada pelo dono.
- `folhas/capi-f1-descida-v1.png`: folha 1 (descida), aprovada pelo dono e pela curadoria (8 células aprovadas, 4 no
  limite). Recortes e medidas em `recortes-v1/` e `docs/relatorio-curadoria-capi-f1.md`.
- `folhas/capi-f2-manobras-v1.png`: folha 2 (manobras), aprovada pelo dono; curadoria: 6 aprovadas, 4 no limite,
  2 reprovadas (`grabUp`, `leanBack`). `docs/relatorio-curadoria-capi-f2.md`.
- `folhas/capi-f3-festa-v1.png`: folha 3 (festa e telas), GERADA E AINDA NÃO CURADA nem mostrada ao dono.
- `folhas/capi-reposicao-v1.png`: folha de reposição de 6 células (grab para cima, inclinação para trás, agachado,
  pré-salto, aterrissagem, perda de equilíbrio), GERADA E AINDA NÃO CURADA nem mostrada ao dono. Critérios de aceite
  em `docs/relatorio-curadoria-capi-f2.md` §6.2.
- Para o dono ver (a sessão dele não viu as duas últimas): abrir os dois PNG e perguntar se aprova.
- Próximo: Apolo cura a F3 e a reposição com as ferramentas de `arte-fonte/ferramentas-curadoria/`, depois a Vega
  adapta o pipeline de sprites (contato/pivô por quadro, contrato C1).
- Nome unificado da pose de susto: `scared` (a §4.2 do doc de arte ainda chama `panic`).

## 4. Runway (geração de imagem)

- Conta conectada nesta sessão: workspace "InnovareCodeDesenvolvimento", plano Free com cota mensal de 500 créditos.
  Saldo no último uso: cerca de 470 créditos. Nano Banana 2.1 a 2K custa 6 créditos por imagem.
- Áudio e vídeo exigem plano pago (a conta anterior bloqueou após 6 gerações de teste). Para imagens, funcionou.
- Receita que funcionou: BLOCO A (com a proibição de texto, "no pose names, no captions, no labels under the figures",
  ANTES da lista de poses) + bloco CHARACTER + lista de células, anexando só a imagem-mestra por pedido, 4:3, 2K,
  fundo verde #00FF00. Sem essa repetição a IA desenha o nome de cada pose sob a figura (aconteceu na F1).
- Só o Atlas alcança o MCP da Runway; os agentes escrevem prompts e curam arquivos. Baixe com `curl` só em
  `arte-fonte/`, copiando a URL assinada exatamente.
- Os outros 5 personagens (Professora Bandeira, Vó Cidinha, Brunão, Quequé, Bia Bolota) estão descritos na §4.7 do
  doc de arte. O plano pede 4 de 6; a escolha final é decisão D3 do dono. Recomendação: depois do M1a.

## 5. Decisões do dono ainda abertas (todas em `PROGRESSO.md`, D3 a D10)

Elenco final (4 de 6) e mascote (Juiz Apito é opcional); ranking online (recomendação: só local); orçamento de arte;
idioma; desafio do dia; repositório remoto e site de teste (recomendação: no M1); logotipo (recomendação: direção A
"Sorvete de Montanha"); toque por gestos ou botões; a cuia da Capi "pisca" (aparece em 3 das 12 poses da F1); salto
estrela de verdade (hoje só "ar de estilo").

## 6. Próximos passos

1. Fechar os ajustes pós-QA do M0 e fazer o commit local inicial (seção 2).
2. Curar a folha 3 e a reposição (Apolo) e mostrar as imagens ao dono.
3. M1a, protótipo cinza da descida (Vega e Lyra), SEM arte, terminando no portão do dono: "a sensação de descer está
   boa?" No M1 use `core/laco.ts` como única fonte de ticks por quadro e guarde o contador de ticks no estado da
   descida (o replay não depende do laço). Medir fps de novo com camadas de parallax (canvas por software a 4x passou
   de 20 ms; o canvas acelerado, que é o do iPhone, passou).
4. M1b (arte integrada) só depois do portão do M1a.
5. Teste no iPhone real: áudio, tela cheia, entalhe e fps. Só o dono pode provar.

## 7. Como rodar

`npm ci` e `npm run verificar` (typecheck, testes, build, e2e, e2e:build). Rodar sozinho: portas 5273 e 4273 são fixas.
Windows: nunca `rm -rf` ou `Remove-Item` em pasta com junção para `node_modules` (já apagou o node_modules real uma vez
no InnoFighters). Heredoc do bash quebra com apóstrofo e crase: use a ferramenta Write para arquivos.

## 8. Atualização posterior (mesmo dia)

Os ajustes pós-QA do M0 TERMINARAM (agente da Vega): `textoDoErro` com `Nome: mensagem`, preloads de fontes
removidos, `platform/laco.ts` agora usa o `criarLaco` do `core/` (igualdade exata provada com relógio sintético),
8 arquivos convertidos para LF, `.gitignore` ampliado. `npm run verificar` verde duas vezes seguidas, sozinho
(343 unit, 18 e2e de build, 91 e2e); bundle 12,6 KB gzip. Detalhes na seção "Pós-QA" de
`docs/handoff-vega-m0-integracao.md`. Nada foi commitado. O primeiro commit local (seção 2) pode ser feito agora.
Observação: `docs/relatorio-curadoria-capi-f2.md` (do Apolo) teve o fim de linha convertido para LF; confira que
continua LF antes de commitar.
