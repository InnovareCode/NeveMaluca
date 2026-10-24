/**
 * Popups de manobra e combo (plano §3.5, M2): texto que sobe e some sobre o piloto quando uma manobra pontua
 * ou o combo fecha/perde. Puramente render — lê os eventos do tick, nunca altera o motor (mesmo padrão de
 * `particulas.ts`: pool fixo pré-alocado, zero alocação de objetos por quadro).
 *
 * Nomes cômicos são do Apolo (`data/textos.pt-BR.ts`, import DIRETO do arquivo — não existe barril que o
 * exporte, e mesmo se existisse a varredura de arquitetura trata barril de camada vizinha como "arquivo da
 * raiz", ver memória `varredura-import-barril-camada`). Regra do Apolo: os números (+pontos, xN) ficam numa
 * linha separada, em fonte "séria" (peso normal) — nunca interpolados dentro da frase cômica.
 */
import { PX_POR_METRO } from '../core/constantes';
import type { EventoDescida, Grab, ModoPiloto, PilotoLeitura } from '../core/contratos';
import type { IdManobraM2 } from '../data/manobras';
import { nomeDaManobra, nomeDoComboPerdido, nomeDoFechamentoDeCombo, nomeDoVoo, type ContextoManobra } from '../data/textos.pt-BR';
import { mundoParaTela, pxPorMetro, type EstadoCamera } from './mundo';

const CAPACIDADE = 16;
const VIDA_MANOBRA_TICKS = 50;
const VIDA_COMBO_TICKS = 70;
/** Metros que o texto sobe ao longo da vida do popup. */
const SUBIDA_M = 1.6;
/** Espaço entre a linha cômica e a linha dos números, em px (antes da escala da câmera). */
const ENTRELINHA_PX = 22;

const COR_MANOBRA = '#ffe08a';
const COR_COMBO_FECHADO = '#ffd166';
const COR_COMBO_PERDIDO = '#ff6b6b';
const COR_PERFEITO = '#fff1a8';
const VIDA_PERFEITO_TICKS = 40;

interface Popup {
  ativo: boolean;
  /** Linha 1: o callout cômico do Apolo. */
  linhaComica: string;
  /** Linha 2: os números, em fonte séria — vazia quando não há número (ex.: combo perdido). */
  linhaNumeros: string;
  cor: string;
  xM: number;
  yM: number;
  vida: number;
  vidaMax: number;
  tamanhoPx: number;
}

export interface SistemaPopupsManobra {
  /** Lê os eventos do tick (de `LeituraDescida`) e anima os popups já abertos. `tick` alimenta a `semente`
   * que escolhe entre sinônimos do Apolo, pra não repetir sempre a mesma piada. */
  atualizar(piloto: PilotoLeitura, eventos: readonly EventoDescida[], tick: number): void;
  /** Desenha os popups ativos, convertendo mundo -> tela via a câmera. */
  desenhar(ctx: CanvasRenderingContext2D, camera: EstadoCamera): void;
  /** Reseta todos os popups ativos. */
  limpar(): void;
}

/** Cria o sistema de popups com pool circular fixo (mesmo padrão do spray de `particulas.ts`). */
export function criarSistemaPopupsManobra(): SistemaPopupsManobra {
  const pool: Popup[] = Array.from({ length: CAPACIDADE }, () => ({
    ativo: false,
    linhaComica: '',
    linhaNumeros: '',
    cor: '#f4f9ff',
    xM: 0,
    yM: 0,
    vida: 0,
    vidaMax: 1,
    tamanhoPx: 22,
  }));
  let indiceCabeca = 0;

  function abrir(
    linhaComica: string,
    linhaNumeros: string,
    cor: string,
    xM: number,
    yM: number,
    vidaMax: number,
    tamanhoPx: number
  ): void {
    const p = pool[indiceCabeca]!;
    p.ativo = true;
    p.linhaComica = linhaComica;
    p.linhaNumeros = linhaNumeros;
    p.cor = cor;
    p.xM = xM;
    p.yM = yM;
    p.vida = vidaMax;
    p.vidaMax = vidaMax;
    p.tamanhoPx = tamanhoPx;
    indiceCabeca = (indiceCabeca + 1) % CAPACIDADE;
  }

  // Contexto do ÚLTIMO voo em andamento: o evento `manobra` chega no tick do pouso, quando o motor já zerou
  // `piloto.ticksNoAr`/`grab` (ver `ContextoManobra` em data/textos.pt-BR.ts) — por isso rastreia ENQUANTO
  // `modo === 'ar'` e usa o valor congelado do tick anterior quando o pouso chega.
  let modoAnterior: ModoPiloto | null = null;
  let vooVoltas = 0;
  let vooTicksNoAr = 0;
  let vooGrab: Grab | null = null;
  let vooTicksSegurando = 0;
  let tickInicioTrilho: number | null = null;

  return {
    atualizar(piloto, eventos, tick) {
      for (let i = 0; i < CAPACIDADE; i += 1) {
        const p = pool[i]!;
        if (!p.ativo) continue;
        p.vida -= 1;
        if (p.vida <= 0) p.ativo = false;
      }

      if (piloto.modo === 'ar') {
        if (modoAnterior !== 'ar') {
          vooVoltas = 0;
          vooTicksNoAr = 0;
          vooGrab = null;
          vooTicksSegurando = 0;
        }
        vooVoltas = piloto.voltas;
        vooTicksNoAr = piloto.ticksNoAr;
        if (piloto.grab !== null) {
          vooGrab = piloto.grab;
          vooTicksSegurando += 1;
        }
      }
      modoAnterior = piloto.modo;

      const idsDoVoo: IdManobraM2[] = [];
      let pontosDoVoo = 0;

      for (const ev of eventos) {
        if (ev.tipo === 'trilho' && ev.etapa === 'inicio') {
          tickInicioTrilho = tick;
        } else if (ev.tipo === 'manobra') {
          idsDoVoo.push(ev.id as IdManobraM2);
          pontosDoVoo += ev.pontos;
        } else if (ev.tipo === 'combo-fechado') {
          abrir(nomeDoFechamentoDeCombo(ev.mult, tick), `x${ev.mult}  +${ev.total}`, COR_COMBO_FECHADO, piloto.x, piloto.y + 1.0, VIDA_COMBO_TICKS, 30);
        } else if (ev.tipo === 'combo-perdido') {
          abrir(nomeDoComboPerdido(tick), '', COR_COMBO_PERDIDO, piloto.x, piloto.y + 0.6, VIDA_MANOBRA_TICKS, 22);
        } else if (ev.tipo === 'obstaculo-rente') {
          // C4 (plano corrida-campeonato): bônus de passar agachado BEM rente a um obstáculo alto -- só existe
          // quando `camada` está presente (treino sem camada nunca emite este evento), mesmo texto cru de sempre
          // (sem passar pelos sinônimos do Apolo: é feedback raro e pontual, não precisa variar).
          abrir('POR UM FIO!', `+${ev.pontos}`, COR_COMBO_FECHADO, piloto.x, piloto.y + 0.8, VIDA_MANOBRA_TICKS, 24);
        } else if (ev.tipo === 'pouso' && ev.qualidade === 'perfeito') {
          // Game feel (feedback do dono, 2026-10-24): "PERFEITO!" no pouso impecável -- texto cru de sempre (sem
          // sinônimo do Apolo, é um selo de qualidade, não uma piada variável), mesmo molde dos popups acima.
          abrir('PERFEITO!', '', COR_PERFEITO, piloto.x, piloto.y + 0.9, VIDA_PERFEITO_TICKS, 26);
        }
      }

      if (idsDoVoo.length > 0) {
        const ticksDeslizando = idsDoVoo.includes('trilho') && tickInicioTrilho !== null ? tick - tickInicioTrilho : undefined;
        // `exactOptionalPropertyTypes` (ver memória `tsconfig-exact-optional-forwarding`): `ContextoManobra` declara
        // os campos como `campo?: T` (sem `| undefined`), então nunca atribui `undefined` explícito — só inclui a
        // chave quando o valor existe.
        const ctx: ContextoManobra = {
          junto: idsDoVoo,
          semente: tick,
          ...(vooVoltas > 0 ? { voltas: vooVoltas } : {}),
          ...(vooTicksNoAr > 0 ? { ticksNoAr: vooTicksNoAr } : {}),
          ...(vooGrab !== null ? { grab: vooGrab } : {}),
          ...(vooTicksSegurando > 0 ? { ticksSegurando: vooTicksSegurando } : {}),
          ...(ticksDeslizando !== undefined ? { ticksDeslizando } : {}),
        };
        const nomeComico = idsDoVoo.length > 1 ? nomeDoVoo(idsDoVoo, ctx) : nomeDaManobra(idsDoVoo[0]!, ctx);
        abrir(nomeComico, `+${pontosDoVoo}`, COR_MANOBRA, piloto.x, piloto.y + 0.6, VIDA_MANOBRA_TICKS, 22);
      }
    },

    desenhar(ctx, camera) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0b1a33';
      ctx.lineWidth = 3;

      const fatorEscala = pxPorMetro(PX_POR_METRO, camera.zoom) / PX_POR_METRO;

      for (let i = 0; i < CAPACIDADE; i += 1) {
        const p = pool[i]!;
        if (!p.ativo) continue;

        const progresso = 1 - p.vida / p.vidaMax; // 0 -> 1 ao longo da vida
        const pt = mundoParaTela(p.xM, p.yM + SUBIDA_M * progresso, camera, PX_POR_METRO);
        // desvanece só no último terço da vida, para ficar legível o resto do tempo
        const fracaoVida = p.vida / p.vidaMax;
        const alpha = fracaoVida < 0.3 ? Math.max(0, fracaoVida / 0.3) : 1;
        ctx.globalAlpha = alpha;

        // Linha 1: o callout cômico do Apolo (itálico, mais peso — "tom de piada").
        ctx.font = `italic 800 ${Math.round(p.tamanhoPx * fatorEscala)}px "Barlow Condensed", sans-serif`;
        ctx.strokeText(p.linhaComica, pt.x, pt.y);
        ctx.fillStyle = p.cor;
        ctx.fillText(p.linhaComica, pt.x, pt.y);

        // Linha 2: os números, em fonte séria (sem itálico, peso normal) — nunca dentro da frase cômica.
        if (p.linhaNumeros.length > 0) {
          const yNumeros = pt.y + ENTRELINHA_PX * fatorEscala;
          ctx.font = `600 ${Math.round(p.tamanhoPx * 0.7 * fatorEscala)}px "Barlow Condensed", sans-serif`;
          ctx.strokeText(p.linhaNumeros, pt.x, yNumeros);
          ctx.fillStyle = '#f4f9ff';
          ctx.fillText(p.linhaNumeros, pt.x, yNumeros);
        }
      }

      ctx.restore();
    },

    limpar() {
      for (let i = 0; i < CAPACIDADE; i += 1) pool[i]!.ativo = false;
      indiceCabeca = 0;
    },
  };
}
