/**
 * IA da corrida (plano `docs/plano-corrida-campeonato.md` §Arquitetura, C2a): um perfil de risco por personagem
 * (plano C-D5: "Bia arrisca mortais, Capi constante, Beto ousado") + uma TRAVA anti-travamento (`QUEDAS_PARA_TRAVAR`
 * quedas no MESMO checkpoint => o resto da corrida roda no modo cuidadoso, nunca mais tenta manobra).
 *
 * Reaproveita os bots PUROS de `descida/bot.ts` (cuidadoso/manobreiro) sem tocar neles: a decisão de QUAL bot rodar
 * a cada tick (e a pequena variação de parâmetros por corrida) é desta camada — os bots continuam "sem RNG, mesma
 * leitura => mesmo comando" (plano §3.3), e é essa pureza que permite planejar o giro no ar.
 *
 * Determinístico: o único sorteio é na CRIAÇÃO do piloto de IA (canal `ia-<id>` da semente da corrida, abaixo),
 * nunca dentro do laço de decisão por tick — por isso nenhum `Math.random`/relógio aqui (varredura de arquitetura
 * trata `corrida/` com as mesmas regras de `descida/`).
 */
import type { ComandoDescida, DefPersonagem, EventoDescida, IdPersonagem, LeituraDescida, ObjetoPista, PistaGerada } from '../core/contratos';
import { hashDeTexto } from '../core/hash';
import { criarRng, type Rng } from '../core/rng';
import { criarBotCuidadoso, criarBotManobreiro, type ConfigDescida, type OpcoesBotManobreiro } from '../descida/index';

export interface PerfilIA {
  readonly ousadia: 0 | 1 | 2;
}

/**
 * Personalidade de cada personagem (plano C-D5). `beto` nasce em ousadia 2 de propósito: é o caso que TRAVAVA antes
 * desta camada existir (medição da Nova: 35 quedas no Vulcão Pé-Gelado, manobreiro ousadia 2, nunca chegou) — e é
 * exatamente o caso que a trava abaixo precisa resolver, não evitar baixando a ousadia dele.
 */
export const PERFIS_IA: Readonly<Record<IdPersonagem, PerfilIA>> = {
  capi: { ousadia: 0 },
  bandeira: { ousadia: 1 },
  cidinha: { ousadia: 1 },
  beto: { ousadia: 2 },
  queque: { ousadia: 1 },
  bia: { ousadia: 2 },
};

/** Perfil moderado para um `id` fora do catálogo (save/perfil desconhecido) — nunca trava o boot por isso. */
const PERFIL_PADRAO: PerfilIA = { ousadia: 1 };

/** Perfil do personagem `id`, ou `PERFIL_PADRAO` se `id` não estiver no catálogo. */
export function perfilIA(id: IdPersonagem, catalogo: Readonly<Record<IdPersonagem, PerfilIA>> = PERFIS_IA): PerfilIA {
  return catalogo[id] ?? PERFIL_PADRAO;
}

/** Quantas quedas NO MESMO checkpoint até a trava anti-travamento desistir da manobra pelo resto da corrida. */
export const QUEDAS_PARA_TRAVAR = 2;

/** Canal de RNG próprio do rival `id` (plano §Arquitetura: "sorteio pelo canal `ia-<id>` da semente"). */
function rngDaIA(semente: number, id: IdPersonagem): Rng {
  const deslocamento = parseInt(hashDeTexto(`ia-${id}`).slice(0, 8), 16);
  return criarRng((semente + deslocamento) | 0);
}

/**
 * Variação pequena e determinística dos parâmetros do MANOBREIRO (por corrida, não por tick): sem isto, dois
 * rivais da MESMA personalidade em corridas de sementes diferentes jogariam byte a byte iguais — o sorteio é só
 * aqui, uma vez, na criação; o bot em si segue puro. O CUIDADOSO (abaixo) não entra nesse sorteio de propósito:
 * ele é a REDE DE SEGURANÇA depois da trava, e `descida-bot-harness-vulcao.test.ts` já prova 50/50 com os
 * parâmetros PADRÃO — jitter aqui já quebrou essa garantia uma vez (semente 37 do Vulcão) sem mexer em nada além
 * do raio de busca do bot. Risco e segurança não competem pelo mesmo sorteio.
 */
function sortearOpcoesManobreiro(rng: Rng, ousadia: 0 | 1 | 2): OpcoesBotManobreiro {
  return { ousadia, antecipacaoM: 3.5 + rng.entre(0, 1), limiarRampaGraus: 7 + rng.entre(0, 2) };
}

/**
 * Cria o piloto de IA de UM corredor para uma pista/corrida. `semente` é a da CORRIDA (mesma semente => mesma IA,
 * plano "determinístico"). A trava (`QUEDAS_PARA_TRAVAR` quedas no mesmo checkpoint) troca, PARA SEMPRE, do
 * manobreiro para o cuidadoso — nunca volta a arriscar: é o jeito mais simples de nunca mais travar o Beto no
 * Vulcão sem mexer na física de ninguém (bot ou motor).
 */
export function criarIA(
  pista: PistaGerada,
  config: ConfigDescida,
  def: DefPersonagem,
  semente: number,
  catalogoPerfis: Readonly<Record<IdPersonagem, PerfilIA>> = PERFIS_IA,
  /** Obstáculos altos da camada desta corrida (plano C4): sem ele, nenhum rival agacha (compatível com antes do C4). */
  obstaculosAltos: readonly ObjetoPista[] = [],
): (leitura: LeituraDescida) => ComandoDescida {
  const rng = rngDaIA(semente, def.id);
  const perfil = perfilIA(def.id, catalogoPerfis);
  const manobreiro = criarBotManobreiro(pista, config, sortearOpcoesManobreiro(rng, perfil.ousadia), obstaculosAltos);
  const cuidadoso = criarBotCuidadoso(pista, {}, obstaculosAltos); // parâmetros padrão, de propósito: ver comentário acima.

  let checkpointAtual = 0;
  const quedasPorCheckpoint = new Map<number, number>();
  let travado = false;

  return (leitura: LeituraDescida): ComandoDescida => {
    for (const ev of leitura.eventos as readonly EventoDescida[]) {
      if (ev.tipo === 'checkpoint') {
        checkpointAtual = ev.indice;
      } else if (ev.tipo === 'tombo') {
        const quedas = (quedasPorCheckpoint.get(checkpointAtual) ?? 0) + 1;
        quedasPorCheckpoint.set(checkpointAtual, quedas);
        if (quedas >= QUEDAS_PARA_TRAVAR) travado = true;
      }
    }
    return travado ? cuidadoso(leitura) : manobreiro(leitura);
  };
}
