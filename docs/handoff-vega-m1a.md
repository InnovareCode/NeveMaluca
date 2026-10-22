# Handoff da Vega: M1a, `src/descida/` + `src/pista/` + `src/data/pistas.ts` + `ferramentas/harness/`

Data: 2026-10-22. Escopo (plano §7, M1a): gerador de pista por semente, motor de física/colisão/tombo/checkpoint/
chegada, bot "cuidadoso" e o harness que mede conclusão. Manobras pontuadas, combo, multiplicador e replay (C6) são
M2 — não implementados aqui de propósito. Nenhum commit. Não toquei em `src/render/`, `src/input/`, `src/ui/cenas/`,
`src/main.ts` nem em `src/core/contratos.ts`.

## O que foi provado (rodado aqui, Windows, Node 24)

- `npm run typecheck`: limpo. `npm test`: **26 arquivos, 395 testes verdes** (meus: `pista-gerador.test.ts`,
  `descida-motor.test.ts`, `descida-bot-harness.test.ts`, 36 testes). `npm run build`: ok, 13,1 kB gzip de JS (era
  12,3 kB no M0; `main.ts` ainda não importa `descida/`/`pista/`, só `data/` cresceu um pouco com `pistas.ts`).
- **Determinismo (DoD do briefing):** teste unitário roda o bot "cuidadoso" duas vezes, do zero, na pista publicada
  (`morro-do-pinhao`, 900 m), por 5400 ticks (90 s) — `hashEstado()` idêntico nas duas rodadas
  (`descida-motor.test.ts`, describe "determinismo"). Mutação: segurar giro tempo suficiente para mudar a
  QUALIDADE do pouso (perfeito vs. torto) muda o hash permanentemente (um giro curto demais não muda nada, porque o
  pouso reatribui o ângulo do corpo à tangente do terreno — só prova quando a mutação sobrevive ao pouso).
- **Bot conclui a pista (DoD do briefing):** `tests/unit/descida-bot-harness.test.ts` roda 100 sementes dentro do
  `npm test` (100/100). Além disso, rodei `ferramentas/harness/cli.mjs` à mão em **900 sementes no total** (3 lotes:
  100 a partir de 1, 300 a partir de 1000, 500 a partir de 5000) — **900/900, 0 tombos**. Isso prova o catálogo/
  gerador em geral (sementes variadas), não só a pista publicada.
- **Varredura de camadas e funções proibidas** (`tests/unit/arquitetura.test.ts`, já existia): continua verde com
  os arquivos novos — nenhum `Math.sin/cos/atan2/pow` em `descida/`/`pista/`, nenhum import fora da camada.

## Como a Lyra instancia o motor e lê o contrato (para a integração)

```ts
import { PISTA_MORRO_DO_PINHAO } from './data/pistas';
import { gerarPista, exigirPistaValida } from './pista'; // ou exigirPistasValidas([PISTA_MORRO_DO_PINHAO, ...])
import { criarDescida } from './descida';

const pistaGerada = exigirPistaValida(PISTA_MORRO_DO_PINHAO); // confere o hashEsperado; gerarPista() não confere
const motor = criarDescida(pistaGerada); // config opcional: criarDescida(pistaGerada, configCustom)

// No laço (core/laco.ts chama isto a cada tick, com o ComandoDescida do input/):
const leitura = motor.processar(comando); // LeituraDescida (C3), pronta pro render/áudio/HUD
// Antes do 1º processar(), motor.leitura() devolve fase 'contagem' (tick -1): é o que a cena de contagem mostra
// SEM chamar processar() (plano §3.2: a contagem regressiva não avança o motor).
```

- **`LeituraDescida.combo` e `.pontos` são placeholders estáveis no M1a** (`combo: {ativo:false, manobras:[],
  soma:0, mult:1, janela:0}`, `pontos: 0`, `coletados: 0`). Não é bug: manobras/combo/pontuação são M2 (plano §7).
  A Lyra pode já desenhar o HUD de pontos (vai mostrar 0 até o M2) e a barra de combo (vai ficar sempre vazia).
- **`piloto.pose`** já usa o vocabulário de poses do Apolo (`ride0`, `tuck0`, `air`, `flip0`, `land`, `fall0/1/2`,
  `rail`, `celeb`) — mapeamento meu, simples (chão/agachado, ar/girando, pousando, tombo por terço do tempo,
  trilho, chegada). Dá pra trocar o sprite certo sem a Lyra reimplementar essa lógica.
- **`distanciaTotal` é sempre `0` no M1a** (eu não usei; `distancia` = `piloto.x`). Se a Lyra quiser uma barra de
  progresso, use `pistaGerada.chegadaX` diretamente (está disponível onde a pista é gerada) em vez de
  `distanciaTotal` — avise o Atlas se preferir que eu preencha esse campo.
- **`ReplayV1`/`codificarComandos` não são usados aqui** (M2). Se alguém quiser gravar um replay já no M1a para
  teste manual, `core/replay.ts` já faz a parte de codificação; o motor não precisa de nada extra pra isso.

## Decisões de física (plano §3.3, números de PARTIDA — ver `src/descida/constantes.ts`)

- **Minha interpretação da janela de pouso de 3 níveis:** o contrato `QUALIDADES_POUSO` tem `perfeito`/`bom`/
  `torto`, mas o plano só descreve 2 limiares (`janelaPerfeita` 20°, `janelaBoa` 45°). Usei **3** limiares:
  `limiarPerfeitoGraus` (8°) = perfeito, `limiarBomGraus` (24°) = bom, `limiarTortoGraus` (58°) = torto, acima =
  tombo. Os dois últimos números (24° e 58°) subiram em relação ao ponto de partida do plano (20°/45°) depois de
  medir com o harness: com 45°, o bot "cuidadoso" ficava presa num laço de tombo-respawn-tombo determinístico (ver
  "Aprendizado" abaixo). O plano já pede janela "generosa" (§1, pilar 2); a folga veio daí.
- **`velocidadeMinimaChaoMs` (1,5 m/s) é rede de segurança, não está no plano.** Não há freio no jogo (agachar
  ACELERA, reduz o arrasto); então a única forma de a velocidade cair a zero é um trecho achatado/subida vencer a
  gravidade — nesse ponto a força líquida também é zero, e sem isso o piloto ficaria parado PARA SEMPRE (o `v`
  nunca é negativo, não "desce de ré"). Sem esse piso, 3 sementes em 100 travavam permanentemente.
- **Pulo é impulso na NORMAL do terreno** (não na tangente), como o plano descreve; o bônus de rampa soma ao
  próprio impulso (mais impulso normal = também mais altura), não um "empurrão" horizontal separado.
- **`descida/bot.ts` decide o giro de nivelamento UMA VEZ por voo**, não a cada tick (ver comentário no código e
  "Aprendizado"). É o bot que eu chamo de "cuidadoso": nunca segura grab, nunca agacha, só pula (rampa/obstáculo) e
  nivela o corpo no ar.

## Decisões do gerador (plano §3.4, `src/pista/catalogo.ts` e `gerador.ts`)

- **8 trechos no catálogo:** `reta`, `ondulado`, `rampa`, `vao`, `trilho`, `pedras`, `degrau`, `boneco`. Campos de
  `DefTrecho` (tipo INTERNO de `pista/`, o contrato C5 só define `DefPista`/`PistaGerada`) e os ângulos de cada um
  estão comentados no próprio arquivo.
- **`TIPOS_PROIBIDOS_NA_ABERTURA`** (`rampa`/`vao`/`degrau` nunca abrem a pista) e **margem segura final** (últimos
  24 m só escolhem entre trechos "seguros") — as duas são regras MINHAS, não do plano, que nasceram de bugs reais
  do harness (ver "Aprendizado"). Sem elas, a pista podia nascer fisicamente impossível de largada ou terminar num
  precipício sem chão pra pousar.
- **Checkpoint só em tangente de entrada "segura" (≤ 10°):** um trecho do tipo "seguro" (ex. `reta`) herda a
  tangente de SAÍDA do trecho anterior (plano: "tangente casada"), então pode começar em subida se vier logo
  depois de uma `rampa`. Checkpoints ali deixavam o respawn (velocidade fixa de 4 m/s) sem força pra vencer a
  subida. `LIMIAR_ANGULO_CHECKPOINT_SEGURO_GRAUS` (10°) filtra isso.
- **`DX_PISTA_M`/`PistaGerada.dx` é o literal `0.5`**, não a constante `DX_PISTA_M` (que é `number`): o contrato
  C5 tipa o campo como literal. `validacao.ts` do M0 já derruba o boot se `DX_PISTA_M !== 0.5`, então os dois nunca
  divergem em runtime — é só o TypeScript que precisa do literal.
- **`morro-do-pinhao` (`src/data/pistas.ts`) tem 900 m** (mudei do meu rascunho inicial de 480 m): com o bot, 480 m
  dava ~22-25 s, bem abaixo da meta de 60-90 s do plano §7 (o bot é "ótimo", mais rápido que um jogador aprendendo).
  Com 900 m o bot fecha em ~39 s — ainda abaixo da meta, mas a meta real é medida com o DONO jogando (plano §8), e
  isso é tuning, não física errada. **Pendência explícita para o portão do dono.**

## EXCEÇÃO DE DONO: `src/data/pistas.ts`

`data/` é do Cronos (ver README daquela pasta); escrevi `pistas.ts` porque o briefing do Atlas me pediu
explicitamente (para destravar o motor/gerador sem esperar o `DefPista` completo do M1 "de verdade"). `data/pistas.ts`
tem um aviso no cabeçalho. **Cronos deve revisar/substituir** quando modelar `DefPersonagem`/`DefPista` reais (nome
de exibição, texto dos objetivos, etc.) — a FORMA do `DefPista` e o `hashEsperado` atual (`1c4d551601d3a6ae`) podem
mudar; se o Cronos mudar `comprimentoM`/`trechos`/`semente`, o hash muda e `pista-gerador.test.ts` + `exigirPistaValida`
acusam na hora (é o que eles existem para fazer).

## PENDÊNCIAS (quem resolve o quê)

- **Ninguém chama `pista.exigirPistasValidas([PISTA_MORRO_DO_PINHAO])` no boot real.** `data/` não pode importar
  `pista/` (plano §3.1: `data` só importa `core`), então essa checagem cruzada tem de rodar em quem junta as duas
  camadas — hoje nada faz isso (mesma lacuna que o M0 já tinha com `exigirCoreValido()`; ver `handoff-vega-m0.md`).
  Quem monta a integração (`main.ts` ou a cena de descida) precisa chamar isso no boot.
- **Duração da descida (60-90 s) não está confirmada com o dono** — ver nota acima sobre `comprimentoM`. Ajustar
  `comprimentoM`/pesos dos trechos depois do primeiro teste do dono no aparelho é esperado (plano §8: "o número que
  vale é o lido no aparelho").
- **`ferramentas/pista/`** (desenhar o perfil da pista em PNG) não foi feito — não estava no DoD do briefing (só
  `ferramentas/harness/`) e o tempo foi para fechar o 100/100. Fica como item fácil de abrir depois se for útil
  pra revisar pistas sem jogar.
- `PX_POR_METRO`/câmera/render são da Lyra; não toquei. `distanciaTotal` sempre 0 (ver seção de integração acima).

## APRENDIZADO (causa raiz + correção; também vai pra memória da Vega)

1. **"Preso pra sempre" em chão achatado/subida:** a física do plano (clamp de `v` em 0, sem andar de ré) tem um
   ponto de equilíbrio genuíno em ângulo ≈ 0 com `v = 0` (força líquida zero). **Causa raiz:** nenhuma regra do
   plano cobre esse caso; **correção:** piso de velocidade (`velocidadeMinimaChaoMs`) + proibir trechos de "efeito
   especial" (`rampa`/`vao`/`degrau`) de abrir a pista ou ficarem logo antes de um checkpoint com tangente alta;
   **como evitar:** todo trecho novo que o Cronos/alguém adicionar ao catálogo devia ser testado no harness ANTES
   de entrar numa pista publicada — é rápido (`npm run harness -- --pista <id> --sementes 100`) e pega isso.
2. **Bot oscilando até o corpo girar 70°+ numa única queda:** o giro segurado tem um atraso de 8 ticks antes de
   `velAngular` sequer começar a mudar (plano §3.3, pra distinguir toque rápido de giro de verdade). Um bot que
   RECALCULA a direção do giro a cada tick (reage ao ângulo atual) flipa de direção no meio da correção, e cada
   flip reinicia o atraso de 8 ticks — nesse intervalo o `velAngular` ANTIGO (na direção errada) continua girando
   o corpo, e o próximo flip piora. **Causa raiz:** controle reativo tick-a-tick contra um atuador com atraso fixo
   oscila. **Correção:** o bot decide a direção de nivelamento UMA vez por voo (no instante da decolagem) e
   desiste de corrigir ao cruzar o ângulo zero (`src/descida/bot.ts`), em vez de recalcular a cada tick. **Como
   evitar:** qualquer controlador (bot ou IA futura) sobre um atuador com delay/rampa deve decidir por JANELA, não
   por tick — vale lição geral pra IA de personagem no M3+.
3. **Teste de mutação que não muta nada que sobrevive:** meu primeiro teste de determinismo testava giro por só 9
   ticks numa queda curta — o pouso reatribui o ângulo do corpo à tangente do terreno (plano §3.3), que ERASA
   qualquer rotação que não tenha mudado a QUALIDADE do pouso. **Causa raiz:** mutação fraca demais pra atravessar
   um reset de estado conhecido. **Correção:** testar mutações que mudam algo que PERSISTE (aqui, a velocidade
   retida no pouso) — a skill `quem-valida-o-que` já avisa "teste novo prova-se por mutação", isto é o caso
   concreto de uma mutação que parecia certa e não provava nada.
