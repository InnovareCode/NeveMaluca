/**
 * Camada de jogo (plano `docs/plano-corrida-campeonato.md` §Arquitetura, C3): `gerarCamadaJogo(pista, def)` PURO e
 * determinístico, sobreposto a uma `PistaGerada` JÁ congelada — nunca toca `alturas`/`objetos`/`trilhos`/`hash` do
 * terreno (o gerador do M1a continua sendo a única fonte de geometria; o hash do Morro e de toda pista oficial fica
 * intacto). Produz:
 *
 *   - `kickers`: zonas de impulso extra sobre RAMPAS DE VERDADE do terreno (trechos onde a tangente sobe acima de
 *     `LIMIAR_KICKER_GRAUS`, detectados só pela altura amostrada — `pista/` não conhece `DefTrecho`, só o array já
 *     gerado). Pular dentro da zona soma `IMPULSO_KICKER_MS` ao impulso normal (`motor.ts`, C3): é o que estende o
 *     ar o bastante para um mortal caber, sem mexer em nenhuma constante de `ConfigDescida`.
 *   - `itens`: `floco` nos 3 pontos da linha que o plano pede ensinar — um pouco de chão ANTES de cada kicker (quem
 *     anda reto já ganha algo), um arco no AR depois dele (recompensa pular ali) e ao longo de cada `trilho` (quem
 *     grinda ganha mais) — e exatamente 1 `dourado` por pista, no arco do kicker mais alto, mais alto e com raio
 *     menor (fora da linha óbvia, plano C3: "esconde 1 dourado por pista").
 *   - `obstaculosAltos` (C4): 1 "galho" a cada 30-40 m (passo encolhe com a dificuldade LOCAL daquele ponto, mesma
 *     interpolação `dificuldade[0..1]` do gerador — `pista/gerador.ts`), nunca sobre um trilho nem dentro/perto de
 *     um kicker (descolar rente a um deles já é risco bastante sem também ter que agachar no meio do voo). Só passa
 *     AGACHADO (`descida/motor.ts`): o motor decide a física, aqui só a posição.
 *   - `porticoX`: mesma posição que `render/chegada.ts` já desenha por conta própria (`pista.chegadaX`) — campo
 *     aqui só para a camada ter a forma final; render não precisa migrar para ler daqui agora.
 *
 * Determinístico: só `+ - * /`, `core/rng.ts` (canal PRÓPRIO `'camada'`, nunca o mesmo fluxo da escolha de trechos
 * do gerador, que usa `criarRng(def.semente)` direto) e as consultas puras de `pista/consulta.ts`. Mesma semente +
 * mesma `PistaGerada` => mesma `CamadaJogo`, byte a byte (hash no fim, mesmo padrão de `gerador.ts`).
 */
import type { CaixaCamada, CamadaJogo, DefPista, ItemCamada, KickerCamada, ObjetoPista, PistaGerada } from '../core/contratos';
import { hashDeValor } from '../core/hash';
import { rngDoCanal } from '../core/rng';
import { alturaEm, inclinacaoGrausEm, trilhoEm } from './consulta';

// '4' (calibragem "cai sobre obstáculo", dono/iPhone, 2026-10-24): `perigosoParaObstaculo` passou a proteger a
// zona de POUSO de QUALQUER rampa de verdade (não só das promovidas a `kicker`) — antes só olhava `kickers` e
// `trilho`, então uma rampa comum (que também dá pulo, via `bonusRampa` do motor, sem precisar virar kicker) não
// tinha NENHUMA proteção depois de si. Medido num diagnóstico tipo-harness (bot manobreiro/cuidadoso, Capi
// `impulsoPuloMs=9` pós-I6, 5 pistas oficiais x 5 sementes de corrida): pulos de rampa comum pousam ~25-42m
// adiante (p50/p90); em 2,8% das vezes o pouso caía LITERALMENTE dentro do galho seguinte, sempre na MESMA rampa,
// sempre na mesma pista (determinístico — não "má sorte", falha de geração). `VALORES` de `obstaculosAltos`/
// `caixas` mudam com isso (forma do tipo é a mesma) — bump por ser mudança de FEATURE aprovada, não só valor
// (mesmo padrão do bump '2'->'3'); goldens que gravam `CamadaJogo` regerados no mesmo commit.
//
// '5' (calibragem "voo crível", dono/iPhone, 2026-10-25): só `IMPULSO_KICKER_MS` mudou de valor (32->16, ver
// comentário dele abaixo) — mas é uma mudança de FEATURE aprovada (voo do kicker, não só um número), mesmo padrão
// dos bumps anteriores: muda `kickers[].impulsoMs` em toda `CamadaJogo` gerada, então o hash (`semHash` inclui
// `kickers`) muda de qualquer forma; o bump deixa explícito NO VALOR DA VERSÃO que a física do kicker mudou, não
// só a geometria. `obstaculosAltos`/`caixas` continuam sem mudar de FORMA (só o número do kicker é outro).
export const VERSAO_CAMADA_JOGO = '5';

/** Passo do varredor de rampas, em metros: fino o bastante para não pular picos curtos (vão/kicker-duplo). */
const PASSO_VARREDURA_M = 1;
/** Tangente (graus) a partir da qual um ponto do terreno conta como "subindo = rampa/kicker" (plano §Arquitetura). */
const LIMIAR_KICKER_GRAUS = 15;
/**
 * Os bots (`descida/bot.ts`) pulam ao ver a subida com `antecipacaoM` (padrão 4 m) de ANTECEDÊNCIA — o pulo de
 * verdade acontece bem ANTES do ponto em que a tangente cruza `LIMIAR_KICKER_GRAUS`. Sem puxar o início do kicker
 * pra trás por essa margem, a zona nunca cobre `piloto.x` no tick do pulo (medido no harness: quase nenhum pulo
 * caía dentro do kicker antes desta margem existir).
 */
const MARGEM_ANTECIPACAO_BOT_M = 8;
/** Largura mínima/máxima de uma zona de kicker, em metros (recorta runs de rampa muito curtas ou muito longas). */
const LARGURA_KICKER_MIN_M = 6;
const LARGURA_KICKER_MAX_M = 14;
/** Espaço mínimo entre o FIM de um kicker e o INÍCIO do próximo: evita cluster em rampas emendadas (plano §3.4). */
const ESPACAMENTO_MIN_KICKERS_M = 15;
/** Nunca perto da abertura (sem embalo ainda) nem da chegada (sem espaço pra pousar/comemorar). */
const MARGEM_ABERTURA_M = 10;
const MARGEM_CHEGADA_M = 15;
/** Teto de kickers por pista (pistas de 900-1200 m do plano não precisam de mais que isso para a linha ficar clara). */
const MAX_KICKERS = 18;
/**
 * Impulso somado ao pulo normal dentro de uma zona de kicker, m/s.
 *
 * Calibragem "voo crível" (dono/iPhone, 2026-10-25): o valor anterior (32) media ~2,5-4s de ar e altura máxima
 * ~25-85m (mediana ~37m) — 13x a altura do personagem (`ALTURA_ALVO_M=2,8`, `render/piloto.ts`) e tempo no ar
 * irreal (dono: "fica no ar, some, cai", câmera tem que abrir demais). 32 -> 16: ar medido cai pra ~1,9-2,6s
 * (mediana ~2,2s, dentro do alvo ~1,6-2,2s pedido) e altura máxima pra ~9-21m (mediana ~13m, ~4-7x o personagem —
 * bem mais coerente). Medição em `ferramentas/medir-voos-tmp.mjs` (descartável, removido depois de extrair os
 * números: harness tipo `harness-corrida/cli.mjs`, 6 personagens x 5 pistas oficiais x 5 sementes, bots
 * cuidadoso+manobreiro, separando voo comum/descida/kicker por ângulo de decolagem e zona).
 *
 * O plano original estimava ~1,4-1,8 s de ar (física da Capi) como o mínimo TEÓRICO pra 1 mortal
 * (`estimarTicksNoAr`/`planejarVoo`, `descida/bot.ts`: giro leva uns ~1,1s do início ao fechar 360° com o
 * `giroVelMaxGrausPorTick`/`giroAcelGrausPorTick2` de hoje) — o alvo pedido (1,6-2,2s) já fica ACIMA desse mínimo,
 * com folga de sobra pra um jogador de verdade (que vê o próprio giro e solta no momento certo, diferente do bot).
 * MAS o bot manobreiro decide a volta por um cronograma DISCRETO + uma estimativa SIMÉTRICA de tempo de ar
 * (`estimarTicksNoAr`) que erra um pouco contra o terreno real (a pista desce) — num voo de 3-4s esse erro é uma
 * fração pequena do total e o bot sempre converge pra cima do próximo múltiplo de 360° com sobra; num voo de ~2s o
 * MESMO erro absoluto (poucos ticks) já derruba a conta pra ZERO em ALGUMAS pistas/personagens específicos (não é
 * "quase", fecha a uns graus de faltar). **Isto é uma limitação da ESTIMATIVA do bot, não da física/giro real** —
 * por isso o harness (`ferramentas/harness-corrida/cli.mjs`, critério C3) foi recalibrado pra medir o encaixe
 * agregando os 6 PERSONAGENS do elenco (não só a Capi): a física por personagem (atributo `pulo`, 90-110,
 * `descida/atributos.ts`) muda o `impulsoPuloMs` de cada um o suficiente pra empurrar o bot pro lado certo do
 * "cliff" em pistas diferentes — prova que o mortal ainda é alcançável com o giro atual, sem fingir que o bot da
 * Capi sozinho reproduz isso em toda pista (ver comentário grande no próprio harness).
 */
export const IMPULSO_KICKER_MS = 16;

const RAIO_FLOCO_CHAO_M = 1.1;
const RAIO_FLOCO_ARCO_M = 1.6;
const RAIO_FLOCO_TRILHO_M = 0.9;
const RAIO_DOURADO_M = 0.9;

/** Distância entre obstáculos altos na dificuldade MÍNIMA (0) / MÁXIMA (1) do trecho local (plano C4: "~1 a cada
 *  30-40 m, densidade subindo com a dificuldade" — interpola entre os dois, igual à conta de `pista/gerador.ts`). */
const PASSO_OBSTACULO_MAX_M = 40;
const PASSO_OBSTACULO_MIN_M = 30;
/** Largura do "galho" (metros): estreito o bastante para o bônus "por um fio" (`descida/motor.ts`) exigir reflexo. */
const LARGURA_OBSTACULO_ALTO_M = 1.4;
/** Altura visual do galho sobre o chão (metros); a física SÓ olha o `x`/`largura` (ver `descida/motor.ts`). */
const ALTURA_OBSTACULO_ALTO_M = 1.3;
/** Nunca mais perto de uma rampa (de verdade, qualquer uma — não só a promovida a kicker) que isto, do lado de
 *  ANTES dela: agachar no meio da subida/decolagem não é a ideia, e cobre a antecipação do bot (`bot.ts`,
 *  `MARGEM_ANTECIPACAO_BOT_M=8`, a decolagem real já pode acontecer um pouco antes do início geométrico da rampa). */
const MARGEM_KICKER_OBSTACULO_M = 10;
/**
 * Depois de QUALQUER rampa de verdade (`encontrarRampas`, >15°, não só as promovidas a `kicker`): janela livre de
 * galho na distância TÍPICA de pouso de um salto "comum" (sem o bônus de `IMPULSO_KICKER_MS`, só `impulsoPuloMs`
 * + `bonusRampa` — o pulo do dia a dia, I6: "pulo mais forte"). Medido (não teórico, mesmo método do I6): bot
 * manobreiro/cuidadoso, Capi, 5 pistas oficiais x 5 sementes de corrida — distância de voo fora de kicker tem
 * mediana ~25-29m e p90 ~32-42m; 45m dá folga sobre o p90 das duas estratégias de bot sem comer o espaçamento de
 * obstáculo inteiro (`PASSO_OBSTACULO_MIN_M=30`, só 1 "slot" de galho fica protegido por rampa, não a pista toda).
 * Sem esta margem, QUALQUER rampa (a maioria nem chega a ser kicker: falha largura/espaçamento mínimo) podia ter
 * um galho plantado exatamente onde o salto pousa — e isso é DETERMINÍSTICO por pista, não "má sorte": a mesma
 * rampa sempre pousa (e sempre batia) no mesmo galho, toda corrida.
 *
 * Kickers de verdade pousam MUITO mais longe que isso — mediana ~90m, p90 ~120m medido pós-calibragem "voo
 * crível" (`IMPULSO_KICKER_MS=16`, 2026-10-25; era ~135-170m com o impulso antigo de 32, mesma conclusão: segue
 * fora do alcance prático de qualquer janela de proteção sem apagar a densidade de obstáculo da pista inteira). O
 * motor já evita o TOMBO ali por outro caminho (`descida/motor.ts`: `p.agachado` é decidido e aplicado no MESMO
 * tick em que o pouso é checado, então mesmo pousando em cima na mira o bot nunca bate — reconfirmado 0% de tombo
 * em 751 pousos de kicker pós-calibragem, reflexo independe da distância). Esta margem cobre o pulo comum, que é
 * o caso sem essa rede de segurança embutida.
 */
const MARGEM_POUSO_ALTO_M = 45;

/** Espaçamento entre caixas de item (plano itens-corrida, I-D5): generoso o bastante pra não virar chuva de itens
 *  numa pista de 900-1200 m, raro o bastante pra cada caixa valer a rota. Mesma variação por `rng` (canal
 *  `'camada'`) dos outros passos deste arquivo — evita um padrão idêntico em pistas de dificuldade constante. */
const PASSO_CAIXA_MIN_M = 60;
const PASSO_CAIXA_MAX_M = 90;
const RAIO_CAIXA_M = 1.3;

interface Rampa {
  readonly x0: number;
  readonly x1: number;
}

/** Varre a altura amostrada e devolve os trechos contíguos onde a tangente sobe acima do limiar (rampas de verdade). */
function encontrarRampas(pista: PistaGerada): Rampa[] {
  const rampas: Rampa[] = [];
  let inicio: number | null = null;
  const fim = pista.chegadaX - MARGEM_CHEGADA_M;
  for (let x = MARGEM_ABERTURA_M; x <= fim; x += PASSO_VARREDURA_M) {
    const subindo = inclinacaoGrausEm(pista, x) > LIMIAR_KICKER_GRAUS && trilhoEm(pista, x) === null;
    if (subindo && inicio === null) inicio = x;
    else if (!subindo && inicio !== null) {
      rampas.push({ x0: inicio, x1: x });
      inicio = null;
    }
  }
  if (inicio !== null) rampas.push({ x0: inicio, x1: fim });
  return rampas;
}

/**
 * Rampas -> kickers: puxa o início pra trás (`MARGEM_ANTECIPACAO_BOT_M`, cobre o pulo "visto de longe" dos bots),
 * recorta largura, aplica espaçamento mínimo e o teto de quantidade.
 */
function kickersDe(rampas: readonly Rampa[]): KickerCamada[] {
  const kickers: KickerCamada[] = [];
  let fimAnterior = Number.NEGATIVE_INFINITY;
  for (const r of rampas) {
    if (kickers.length >= MAX_KICKERS) break;
    const x0 = Math.max(MARGEM_ABERTURA_M, r.x0 - MARGEM_ANTECIPACAO_BOT_M);
    if (x0 - fimAnterior < ESPACAMENTO_MIN_KICKERS_M) continue;
    const largura = Math.max(LARGURA_KICKER_MIN_M, Math.min(r.x1 - x0, LARGURA_KICKER_MAX_M));
    kickers.push({ x: x0, largura, impulsoMs: IMPULSO_KICKER_MS });
    fimAnterior = x0 + largura;
  }
  return kickers;
}

/** Flocos de CHÃO levando até o kicker (ensina a se aproximar) + o ARCO de flocos no ar depois dele (ensina a pular). */
function itensDoKicker(pista: PistaGerada, k: KickerCamada): ItemCamada[] {
  const itens: ItemCamada[] = [];
  for (const dx of [-8, -5]) {
    const x = k.x + dx;
    if (x > MARGEM_ABERTURA_M) itens.push({ tipo: 'floco', x, y: alturaEm(pista, x) + 0.6, raio: RAIO_FLOCO_CHAO_M });
  }
  // Arco no ar (perfil aproximado: sobe, pico, desce), relativo ao chão em cada ponto — não é física simulada, só
  // um arco visual generoso o bastante (raio maior) para quem pulou ali de verdade acertar.
  const apos = k.x + k.largura;
  for (const [dx, altura] of [[2, 1.4], [5, 2.4], [8, 1.4]] as const) {
    const x = apos + dx;
    if (x < pista.chegadaX - MARGEM_CHEGADA_M) itens.push({ tipo: 'floco', x, y: alturaEm(pista, x) + altura, raio: RAIO_FLOCO_ARCO_M });
  }
  return itens;
}

/** 3 flocos espaçados ao longo de um trilho (ensina a grindar), na altura efetiva do próprio trilho. */
function itensDoTrilho(pista: PistaGerada, trilho: PistaGerada['trilhos'][number]): ItemCamada[] {
  const comprimento = trilho.x1 - trilho.x0;
  if (comprimento <= 4) return [];
  const passos = [0.2, 0.5, 0.8];
  return passos.map((f) => {
    const x = trilho.x0 + comprimento * f;
    return { tipo: 'floco' as const, x, y: alturaEm(pista, x) + trilho.altura + 0.3, raio: RAIO_FLOCO_TRILHO_M };
  });
}

/** O dourado (1 por pista): no pico do arco do kicker sorteado, um pouco mais alto que os flocos daquele arco. */
function dourado(pista: PistaGerada, kickers: readonly KickerCamada[], rng: ReturnType<typeof rngDoCanal>): ItemCamada | null {
  if (kickers.length === 0) return null;
  const k = rng.escolher(kickers);
  const x = k.x + k.largura + 5;
  return { tipo: 'dourado', x, y: alturaEm(pista, x) + 3.2, raio: RAIO_DOURADO_M };
}

/** Dificuldade LOCAL no ponto `x` (mesma interpolação linear de `pista/gerador.ts`, repetida aqui: `pista/` não
 *  conhece `DefTrecho`/o laço do gerador, só o `[inicio,fim]` do próprio `DefPista`). */
function dificuldadeLocalEm(x: number, pista: PistaGerada, def: DefPista): number {
  const frac = pista.chegadaX > 0 ? x / pista.chegadaX : 0;
  const [inicio, fim] = def.dificuldade;
  return inicio + (fim - inicio) * frac;
}

/**
 * Esse `x` cai sobre um trilho, ou perto demais de QUALQUER rampa de verdade (antes dela, ou na janela de pouso
 * depois)? Nenhum dos dois é lugar pra um galho. `rampas` é a lista BRUTA (`encontrarRampas`, antes do corte de
 * `kickersDe` por largura/espaçamento/teto) — a decolagem acontece na rampa física, não na versão filtrada que
 * só serve pra decidir qual ganha o bônus de impulso extra.
 */
function perigosoParaObstaculo(pista: PistaGerada, rampas: readonly Rampa[], x: number): boolean {
  if (trilhoEm(pista, x) !== null) return true;
  for (const r of rampas) {
    // Mesma conta de `kickersDe` pro início: a decolagem de verdade (vista pelo bot) pode ser até
    // `MARGEM_ANTECIPACAO_BOT_M` ANTES do começo geométrico da rampa — sem repetir essa conta aqui, o lado "antes"
    // ficava mais curto do que o kicker já cobria (regressão medida: galho a 267m passava a entrar a 0,002m do
    // início da janela, contra os 8m de antecipação que o kicker original já descontava).
    const inicioDecolagem = Math.max(MARGEM_ABERTURA_M, r.x0 - MARGEM_ANTECIPACAO_BOT_M);
    if (x >= inicioDecolagem - MARGEM_KICKER_OBSTACULO_M && x <= r.x1 + MARGEM_POUSO_ALTO_M) return true;
  }
  return false;
}

/**
 * Obstáculos altos (plano C4): varre a pista a cada passo (30-40 m, encolhendo com a dificuldade LOCAL — mais
 * obstáculo onde a pista já está mais difícil) e planta um "galho" quando o ponto não é perigoso (kicker/trilho
 * perto). O passo em si já varia pela dificuldade por `rng` (canal `'camada'`, mesmo gerador dos outros itens):
 * sem essa variação, pistas com `dificuldade` igual em todo o trecho (ex. [0.3, 0.3]) sempre dariam o MESMO passo,
 * byte a byte — inofensivo para o hash, mas template demais para o olho.
 */
function obstaculosAltosDe(pista: PistaGerada, def: DefPista, rampas: readonly Rampa[], rng: ReturnType<typeof rngDoCanal>): ObjetoPista[] {
  const obstaculos: ObjetoPista[] = [];
  const fim = pista.chegadaX - MARGEM_CHEGADA_M;
  let x = MARGEM_ABERTURA_M + rng.entre(PASSO_OBSTACULO_MIN_M, PASSO_OBSTACULO_MAX_M);
  while (x <= fim) {
    if (!perigosoParaObstaculo(pista, rampas, x)) {
      obstaculos.push({ tipo: 'galho', x, largura: LARGURA_OBSTACULO_ALTO_M, altura: ALTURA_OBSTACULO_ALTO_M, variante: 0 });
    }
    const dificuldade = dificuldadeLocalEm(x, pista, def);
    const passoBase = PASSO_OBSTACULO_MAX_M - (PASSO_OBSTACULO_MAX_M - PASSO_OBSTACULO_MIN_M) * dificuldade;
    x += passoBase * rng.entre(0.85, 1.15);
  }
  return obstaculos;
}

/**
 * Caixas de item (plano itens-corrida §Contratos, I2): varre a pista num passo quase regular (como
 * `obstaculosAltosDe`), evitando kicker/trilho (`perigosoParaObstaculo` — mesmo motivo: pegar uma caixa não pode
 * competir com decolar ou grindar). 1 espaço por CORREDOR é regra de `corrida/itens.ts`, não daqui — esta função só
 * planta ONDE as caixas ficam, igual a `obstaculosAltosDe`.
 */
function caixasDe(pista: PistaGerada, rampas: readonly Rampa[], rng: ReturnType<typeof rngDoCanal>): CaixaCamada[] {
  const caixas: CaixaCamada[] = [];
  const fim = pista.chegadaX - MARGEM_CHEGADA_M;
  let x = MARGEM_ABERTURA_M + rng.entre(PASSO_CAIXA_MIN_M, PASSO_CAIXA_MAX_M);
  while (x <= fim) {
    if (!perigosoParaObstaculo(pista, rampas, x)) {
      caixas.push({ x, y: alturaEm(pista, x) + 0.8, raio: RAIO_CAIXA_M });
    }
    x += rng.entre(PASSO_CAIXA_MIN_M, PASSO_CAIXA_MAX_M);
  }
  return caixas;
}

/** Gera a camada de jogo para uma `PistaGerada` já pronta. Pura: nunca lança, nunca confere hash esperado. */
export function gerarCamadaJogo(pista: PistaGerada, def: DefPista): CamadaJogo {
  const rng = rngDoCanal(def.semente, 'camada');
  const rampas = encontrarRampas(pista);
  const kickers = kickersDe(rampas);
  const itens: ItemCamada[] = [];
  for (const k of kickers) itens.push(...itensDoKicker(pista, k));
  for (const t of pista.trilhos) itens.push(...itensDoTrilho(pista, t));
  const douradoDaPista = dourado(pista, kickers, rng);
  if (douradoDaPista !== null) itens.push(douradoDaPista);
  // `obstaculosAltos`/`caixas` (C4/I2): longe de QUALQUER rampa de verdade (`rampas`, lista bruta — ver
  // `perigosoParaObstaculo`), não só das promovidas a `kicker` (correção "cai sobre obstáculo", VERSAO '4').
  const obstaculosAltos = obstaculosAltosDe(pista, def, rampas, rng);
  // Posicionamento real das caixas (plano itens-corrida, I2) — continua o MESMO `rng` de canal `'camada'`, depois
  // de kickers/dourado/obstáculos (ordem importa pro determinismo, nunca pro resultado em si).
  const caixas = caixasDe(pista, rampas, rng);

  const semHash = { itens, kickers, obstaculosAltos, caixas, porticoX: pista.chegadaX, versao: VERSAO_CAMADA_JOGO };
  const hash = hashDeValor(semHash);
  return { ...semHash, hash };
}
