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

// '3' (plano itens-corrida, I0): a MESMA forma de '2', mais `caixas` (sempre `[]` até I2 plantar as posições reais)
// — bump só para marcar a mudança de forma (nenhum compat-check lê este campo hoje; `ReplayV2` nunca serializa
// `CamadaJogo`, ela é sempre regerada de `pista`+`def`, puro e determinístico — ver `criarCorrida`).
export const VERSAO_CAMADA_JOGO = '3';

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
 * Impulso somado ao pulo normal dentro de uma zona de kicker, m/s. O plano estimava ~1,4-1,8 s de ar (física da
 * Capi) como o mínimo TEÓRICO pra 1 mortal (`estimarTicksNoAr`/`planejarVoo`, `descida/bot.ts`) — mas o manobreiro
 * decide a volta pelo cronograma DISCRETO de aceleração do giro (acelera, soma graus, solta com antecedência pra
 * convergir em exatamente 360°,720°...); medido no harness: com folga pequena sobre o mínimo teórico, o pouso fecha
 * a só uns graus de completar a volta (conta como ZERO pontos, não "quase"). Só uma folga GRANDE sobre o mínimo
 * (aqui, ar medido de ~2,5-4 s nos kickers reais das 5 pistas oficiais) empurra o cronograma pra cima do próximo
 * múltiplo de 360° com margem — e isso é o valor que o harness `ferramentas/harness-corrida/cli.mjs` de fato prova
 * (>= 3 mortais/pista em média, >= 30% de encaixe kicker->mortal, manobrar compensando no tempo). Baixar este
 * número pro "ideal" de 1,4-1,8 s teórico FAZ o harness falhar — testado, não é estética.
 */
export const IMPULSO_KICKER_MS = 32;

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
/** Nunca mais perto de um kicker que isto (de qualquer lado): agachar no meio de um voo de kicker não é a ideia. */
const MARGEM_KICKER_OBSTACULO_M = 10;

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

/** Esse `x` cai dentro (+ margem) de algum kicker, ou sobre um trilho? Nenhum dos dois é lugar pra um galho. */
function perigosoParaObstaculo(pista: PistaGerada, kickers: readonly KickerCamada[], x: number): boolean {
  if (trilhoEm(pista, x) !== null) return true;
  for (const k of kickers) {
    if (x >= k.x - MARGEM_KICKER_OBSTACULO_M && x <= k.x + k.largura + MARGEM_KICKER_OBSTACULO_M) return true;
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
function obstaculosAltosDe(pista: PistaGerada, def: DefPista, kickers: readonly KickerCamada[], rng: ReturnType<typeof rngDoCanal>): ObjetoPista[] {
  const obstaculos: ObjetoPista[] = [];
  const fim = pista.chegadaX - MARGEM_CHEGADA_M;
  let x = MARGEM_ABERTURA_M + rng.entre(PASSO_OBSTACULO_MIN_M, PASSO_OBSTACULO_MAX_M);
  while (x <= fim) {
    if (!perigosoParaObstaculo(pista, kickers, x)) {
      obstaculos.push({ tipo: 'galho', x, largura: LARGURA_OBSTACULO_ALTO_M, altura: ALTURA_OBSTACULO_ALTO_M, variante: 0 });
    }
    const dificuldade = dificuldadeLocalEm(x, pista, def);
    const passoBase = PASSO_OBSTACULO_MAX_M - (PASSO_OBSTACULO_MAX_M - PASSO_OBSTACULO_MIN_M) * dificuldade;
    x += passoBase * rng.entre(0.85, 1.15);
  }
  return obstaculos;
}

/** Gera a camada de jogo para uma `PistaGerada` já pronta. Pura: nunca lança, nunca confere hash esperado. */
export function gerarCamadaJogo(pista: PistaGerada, def: DefPista): CamadaJogo {
  const rng = rngDoCanal(def.semente, 'camada');
  const kickers = kickersDe(encontrarRampas(pista));
  const itens: ItemCamada[] = [];
  for (const k of kickers) itens.push(...itensDoKicker(pista, k));
  for (const t of pista.trilhos) itens.push(...itensDoTrilho(pista, t));
  const douradoDaPista = dourado(pista, kickers, rng);
  if (douradoDaPista !== null) itens.push(douradoDaPista);
  const obstaculosAltos = obstaculosAltosDe(pista, def, kickers, rng);

  // `caixas` (plano itens-corrida, I0): posicionamento real é I2 — por ora sempre `[]`, mesmo bootstrap que
  // `obstaculosAltos` teve antes do C4 (campo presente na forma, sem efeito nenhum até a lógica existir).
  const caixas: CaixaCamada[] = [];
  const semHash = { itens, kickers, obstaculosAltos, caixas, porticoX: pista.chegadaX, versao: VERSAO_CAMADA_JOGO };
  const hash = hashDeValor(semHash);
  return { ...semHash, hash };
}
