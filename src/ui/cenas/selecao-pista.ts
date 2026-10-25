/**
 * Tela de Seleção de Pista (Canvas 2D), acessível pelo botão PISTA do Menu. Redesenho "premium estilo Pixar"
 * (`docs/direcao-ui-premium.md` §11.9, Fase 2): espelha `selecao.ts` (mesmo molde de VOLTAR redondo + Painel
 * Geada + CTA), mas a arte dos 5 cartões-postais e do fundo vem do cenário raster real da pista (reaproveita o
 * MESMO `Parallax`/`PintorTema` que `ui/cenas/corrida.ts`/`descida.ts` pintam de verdade -- `render/temas/
 * catalogo.ts`, ver memória `pintor-tema-wire-por-defpista-tema`), renderizado UMA vez por pista num canvas
 * offscreen e reaproveitado tanto para o cartão (recorte "cover") quanto para o Fundo B borrado (`kit-premium.ts`).
 * Zero placeholder feio: enquanto o raster daquela pista não carregou, o cartão cai no swatch de cor do tema
 * (gradiente do céu + silhueta), nunca uma caixa cinza.
 *
 * Mostra o catálogo INTEIRO (as 5 pistas de `REGRAS_SAVE.pistas`), não só `prog.pistas`: o gating de desbloqueio
 * por objetivos ainda não existe (M3-futuro, mesmo estado que a seleção de personagem -- memória
 * `selecao-personagem-catalogo-inteiro-vs-desbloqueados`). Texto de desenvolvedor removido (feedback do dono):
 * nada de "Todas liberadas por enquanto".
 */
import { ALTURA, ALTURA_BUFFER, LARGURA, LARGURA_BUFFER, RS } from '../../core/constantes';
import type { IdTema } from '../../core/contratos';
import { obterPistaDeDados, PISTAS_DE_DADOS } from '../../data/pistas';
import type { Parallax } from '../../render/parallax';
import { precarregarAssetsDoTema, rasterProntoParaTema, temaDeRenderDoTema } from '../../render/temas/catalogo';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { dispositivoTemToque, escalonar, msParaTicks, poseEntrada, prefereMovimentoReduzido } from '../animacao';
import { caminhoArredondado, desenharFlocos, desenharTexto, type CamadaEstatica } from '../desenho';
import { criarEstadoPressao, eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import { botao3D, botaoRedondoVoltar, construirFundoFosco, desenharLetreiro, dicaTeclado, iconeFloco, painelGeada } from '../kit-premium';
import type { Cena } from '../tipos';
import { criarFundoCampeonato } from './fundo-campeonato';

export interface OpcoesCenaSelecaoPista {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  /** Catálogo inteiro de ids de pista (ordem de exibição = ordem dos cards). */
  readonly catalogo: readonly string[];
  readonly obterPistaAtiva: () => string;
  /** Escolheu um card: quem persiste é o chamador (gerenciador), esta tela só avisa. */
  readonly aoEscolher: (id: string) => void;
  readonly aoVoltar: () => void;
}

/** Uma linha de clima por pista (texto de apresentação, não é dado de jogo -- inspirado nas fichas de
 *  `docs/temas-pistas-m3.md`). Id cru como fallback para uma pista futura sem entrada aqui. */
const CLIMA_POR_PISTA: Readonly<Record<string, string>> = {
  'morro-do-pinhao': 'Araucárias, pinhão assando e o friozinho do vanerão.',
  'pico-do-picole': 'Confete de sorvete e paredes de casquinha açucarada.',
  'vila-chocolate': 'Neve de chocolate quente sob luzes de lampião.',
  'vulcao-pe-gelado': 'Vapor gelado subindo entre blocos de basalto.',
  'cume-da-ventania': 'Rajadas de vento e aurora lá no alto da serra.',
};

const COR_FUNDO = '#0c1b30';
const COR_TEXTO = '#f4f9ff';
const COR_SOL = '#FFD23F';
const COR_MUTED = '#aed0ef';

const CARD_W = 164;
const CARD_H = 220;
const CARD_GAP = 16;
const CARD_X0 = 38;
const CARD_Y = 104;

const PAINEL_X = 160;
const PAINEL_Y = 344;
const PAINEL_W = 640;
const PAINEL_H = 92;

const BOTAO_VOLTAR: BotaoRetangular = { id: 'voltar', x: 32, y: 20, w: 56, h: 56 };
const BOTAO_PRONTO: BotaoRetangular = { id: 'pronto', x: LARGURA / 2 - 150, y: 456, w: 300, h: 64 };

function cartao(indice: number): BotaoRetangular {
  return { id: `card-${indice}`, x: CARD_X0 + indice * (CARD_W + CARD_GAP), y: CARD_Y, w: CARD_W, h: CARD_H };
}

// Entrada escalonada (§11.9 "cartões 'dados' de baixo... de dentro para fora (3,2,4,1,5), escalonados a 70ms"):
// posições 1-based 3,2,4,1,5 == índices 0-based 2,1,3,0,4 -- o card do MEIO entra primeiro, depois os vizinhos
// pra fora. Só vale pro catálogo de 5 pistas de hoje; um catálogo de outro tamanho cai na ordem natural (guarda
// no uso abaixo).
const ORDEM_ENTRADA_CARTOES = [2, 1, 3, 0, 4];
const T_ENTRADA_CARTOES = 0;
const PASSO_ENTRADA_CARTAO = msParaTicks(70);
const DUR_ENTRADA_CARTAO = msParaTicks(420);
const DUR_CROSSFADE_FUNDO = msParaTicks(300);

export function criarCenaSelecaoPista(opcoes: OpcoesCenaSelecaoPista): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  const reduzido = prefereMovimentoReduzido();
  const temToque = dispositivoTemToque();
  let hover: string | null = null;
  let ticks = 0;
  const pressao = criarEstadoPressao();

  const parallaxPorTema = new Map<IdTema, Parallax>();
  const framesPorPista = new Map<string, HTMLCanvasElement>();
  const fundoPorPista = new Map<string, CamadaEstatica>();

  // Crossfade de fundo ao mudar o destaque (§11.9: "Fundo B da pista destacada (hover ou selecionada). Ao mudar
  // o destaque, fade cruzado de 300ms"). `idFundoAnterior` é um retrato CONGELADO de qual pista estava no comando
  // ANTES da troca mais recente -- só esse par (anterior/alvo) participa do fade; mudar de novo no meio do fade
  // apenas reinicia os dois ponteiros, nunca empilha fades.
  let idFundoAlvo = opcoes.obterPistaAtiva();
  let idFundoAnterior = idFundoAlvo;
  let inicioCrossfade = -1000;

  // Dispara o carregamento dos cenários raster das 5 pistas (fire-and-forget): por quando o frame estiver
  // pronto, `tentarConstruirFrame` monta o canvas offscreen reaproveitado pelo cartão E pelo Fundo B.
  for (const id of opcoes.catalogo) {
    const tema = obterPistaDeDados(id, PISTAS_DE_DADOS)?.tema;
    if (tema) void precarregarAssetsDoTema(tema, opcoes.documento);
  }

  function obterParallax(tema: IdTema): Parallax | null {
    if (!doc) return null;
    let p = parallaxPorTema.get(tema);
    if (!p) {
      p = criarFundoCampeonato(tema, doc);
      parallaxPorTema.set(tema, p);
    }
    return p;
  }

  /** Um quadro (960x540 lógico) do cenário real da pista, renderizado offscreen UMA vez (depois que o raster
   *  daquele tema estiver pronto) -- reaproveitado pelo cartão (recorte) e pelo Fundo B (`construirFundoFosco`). */
  function obterFrame(id: string): HTMLCanvasElement | null {
    const existente = framesPorPista.get(id);
    if (existente) return existente;
    if (!doc) return null;
    const tema = obterPistaDeDados(id, PISTAS_DE_DADOS)?.tema;
    if (!tema || !rasterProntoParaTema(tema)) return null;
    const parallax = obterParallax(tema);
    if (!parallax) return null;

    const canvas = doc.createElement('canvas');
    canvas.width = LARGURA_BUFFER;
    canvas.height = ALTURA_BUFFER;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;
    ctx.setTransform(RS, 0, 0, RS, 0, 0);
    parallax.desenhar(ctx, 0, 0);
    framesPorPista.set(id, canvas);
    return canvas;
  }

  function obterFundo(id: string): CamadaEstatica | null {
    const existente = fundoPorPista.get(id);
    if (existente) return existente;
    if (!doc) return null;
    const frame = obterFrame(id);
    if (!frame) return null;
    const fundo = construirFundoFosco(doc, frame, { reducao: 8, veuTopo: 0.25, veuBase: 0.45, zoom: 1.02 });
    fundoPorPista.set(id, fundo);
    return fundo;
  }

  const cartaoNoPonto = (pt: { x: number; y: number }): number | null => {
    for (let i = 0; i < opcoes.catalogo.length; i += 1) {
      if (pontoDentroDoBotao(pt, cartao(i))) return i;
    }
    return null;
  };

  const aoMover = (e: Event): void => {
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    const indice = cartaoNoPonto(pt);
    if (indice !== null) hover = `card-${indice}`;
    else if (pontoDentroDoBotao(pt, BOTAO_VOLTAR)) hover = 'voltar';
    else if (pontoDentroDoBotao(pt, BOTAO_PRONTO)) hover = 'pronto';
    else hover = null;
  };

  const aoTocar = (e: Event): void => {
    e.preventDefault?.();
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    const indice = cartaoNoPonto(pt);
    if (indice !== null) {
      opcoes.aoEscolher(opcoes.catalogo[indice] as string);
    } else if (pontoDentroDoBotao(pt, BOTAO_VOLTAR) || pontoDentroDoBotao(pt, BOTAO_PRONTO)) {
      if (pontoDentroDoBotao(pt, BOTAO_PRONTO)) pressao.marcar('pronto', ticks);
      opcoes.aoVoltar();
    }
  };

  const aoTeclar = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.code === 'Escape' || ev.code === 'Backspace') {
      ev.preventDefault?.();
      opcoes.aoVoltar();
    }
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  janela?.addEventListener('keydown', aoTeclar);

  /** Swatch do tema (céu + silhueta + chip de destaque) -- fallback enquanto o raster daquela pista não chegou. */
  function desenharSwatch(ctx: Ctx, x: number, y: number, w: number, h: number, tema: IdTema): void {
    const def = temaDeRenderDoTema(tema);
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, def.cores.ceu[0]);
    grad.addColorStop(1, def.cores.ceu[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    ctx.fillStyle = def.cores.silhueta;
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + h * 0.55);
    ctx.lineTo(x + w * 0.4, y + h * 0.3);
    ctx.lineTo(x + w * 0.7, y + h * 0.6);
    ctx.lineTo(x + w, y + h * 0.4);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = def.cores.destaque;
    ctx.beginPath();
    ctx.ellipse(x + w - 18, y + 20, 8, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function desenharCartao(ctx: Ctx, indice: number, id: string): void {
    const r = cartao(indice);
    const ativo = opcoes.obterPistaAtiva() === id;
    const aoVivo = hover === `card-${indice}`;
    const def = obterPistaDeDados(id, PISTAS_DE_DADOS);
    const nome = def?.nome ?? id;
    const tema = def?.tema ?? 'bosque';
    const dificuldade = Math.max(1, Math.min(5, def?.ordem ?? 1));
    const elevacao = ativo ? -10 : aoVivo ? -4 : 0;
    const escala = ativo ? 1.08 : 1;

    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2 + elevacao);
    ctx.scale(escala, escala);
    ctx.translate(-r.w / 2, -r.h / 2);

    ctx.save();
    caminhoArredondado(ctx, { x: 0, y: 0, w: r.w, h: r.h }, 16);
    ctx.clip();
    const frame = obterFrame(id);
    if (frame) {
      // "Cover": recorta o quadro 960x540 pela faixa vertical central (a pista é mais alta que larga no
      // cartão) e amplia pra cobrir o cartão inteiro, sem distorcer.
      const escalaFonte = r.h / ALTURA;
      const larguraFonteNoDestino = r.w / escalaFonte;
      const sx = Math.max(0, (LARGURA - larguraFonteNoDestino) / 2);
      ctx.drawImage(frame, sx, 0, Math.min(LARGURA, larguraFonteNoDestino), ALTURA, 0, 0, r.w, r.h);
      ctx.fillStyle = 'rgba(6, 14, 36, 0.18)';
      ctx.fillRect(0, 0, r.w, r.h);
    } else {
      desenharSwatch(ctx, 0, 0, r.w, r.h, tema);
    }
    ctx.restore();

    // faixa do nome
    const faixa = ctx.createLinearGradient(0, r.h - 56, 0, r.h);
    faixa.addColorStop(0, 'rgba(6, 14, 36, 0)');
    faixa.addColorStop(1, 'rgba(6, 14, 36, 0.85)');
    ctx.save();
    caminhoArredondado(ctx, { x: 0, y: 0, w: r.w, h: r.h }, 16);
    ctx.clip();
    ctx.fillStyle = faixa;
    ctx.fillRect(0, r.h - 56, r.w, 56);
    ctx.restore();

    ctx.lineWidth = ativo ? 3 : 2;
    ctx.strokeStyle = ativo ? COR_SOL : aoVivo ? '#ffffff' : 'rgba(255,255,255,0.25)';
    caminhoArredondado(ctx, { x: 0, y: 0, w: r.w, h: r.h }, 16);
    ctx.stroke();

    desenharTexto(ctx, nome, r.w / 2, r.h - 34, {
      fonte: 'italic 800 20px "Barlow Condensed", Impact, sans-serif',
      cor: ativo ? COR_SOL : '#ffffff',
      alinhamento: 'center',
    });

    // Flocos de dificuldade (= ordem da pista) -- acabamento, 2026-10-24 (feedback do dono: "as estrelas de
    // dificuldade saem como asteriscos"): a receita antiga desenhava só 3 eixos retos (6 raios SEM ramos), que lê
    // como "*" de fonte. `iconeFloco` (kit-premium.ts) acrescenta os ramos em V que fazem ler como neve.
    const flocosW = 14;
    const inicioX = r.w / 2 - (flocosW * dificuldade) / 2 + flocosW / 2;
    for (let i = 0; i < dificuldade; i += 1) {
      iconeFloco(ctx, inicioX + i * flocosW, r.h - 14, 5, '#9FE3FF');
    }

    ctx.restore();
  }

  return {
    id: 'selecao-pista',
    atualizar() {
      ticks += 1;
    },
    desenhar(ctx: Ctx, alpha: number) {
      const t = ticks + alpha;
      const ativo = opcoes.obterPistaAtiva();
      const indiceHover = hover?.startsWith('card-') ? Number(hover.slice(5)) : null;
      const destacada = indiceHover !== null ? (opcoes.catalogo[indiceHover] ?? ativo) : ativo;

      if (destacada !== idFundoAlvo) {
        idFundoAnterior = idFundoAlvo;
        idFundoAlvo = destacada;
        inicioCrossfade = t;
      }
      const pCrossfade = Math.min(1, Math.max(0, (t - inicioCrossfade) / DUR_CROSSFADE_FUNDO));
      const fundoAlvo = obterFundo(idFundoAlvo);
      const fundoAnterior = idFundoAnterior === idFundoAlvo ? fundoAlvo : obterFundo(idFundoAnterior);

      if (pCrossfade < 1 && fundoAnterior) {
        fundoAnterior.desenhar(ctx);
        if (fundoAlvo && fundoAlvo !== fundoAnterior) {
          ctx.save();
          ctx.globalAlpha = pCrossfade;
          fundoAlvo.desenhar(ctx);
          ctx.restore();
        }
      } else if (fundoAlvo) {
        fundoAlvo.desenhar(ctx);
      } else {
        ctx.save();
        ctx.fillStyle = COR_FUNDO;
        ctx.fillRect(0, 0, LARGURA, ALTURA);
        ctx.restore();
      }
      desenharFlocos(ctx, 20, t, 0.7);

      if (doc) desenharLetreiro(ctx, doc, 'ESCOLHA SUA PISTA', LARGURA / 2, 66, 40, 'gelo');
      else desenharTexto(ctx, 'ESCOLHA SUA PISTA', LARGURA / 2, 66, { fonte: 'italic 800 40px "Barlow Condensed", Impact, sans-serif', cor: COR_TEXTO, contorno: 6, alinhamento: 'center' });

      // Cartões "sendo dados" (§8.5/§11.9): de dentro pra fora, escalonados, com leve rotação que assenta em 0.
      opcoes.catalogo.forEach((id, indice) => {
        const ordem = ORDEM_ENTRADA_CARTOES.length === opcoes.catalogo.length ? ORDEM_ENTRADA_CARTOES.indexOf(indice) : indice;
        const t0 = T_ENTRADA_CARTOES + escalonar(ordem < 0 ? indice : ordem, PASSO_ENTRADA_CARTAO);
        const pose = poseEntrada(t, t0, DUR_ENTRADA_CARTAO, reduzido, 80);
        const r = cartao(indice);
        const pivoX = r.x + r.w / 2;
        const pivoY = r.y + r.h / 2;
        ctx.save();
        ctx.globalAlpha = pose.opacidade;
        ctx.translate(pivoX, pivoY + pose.deslocaY);
        ctx.rotate((((indice % 2 === 0 ? 1 : -1) * 6 * Math.PI) / 180) * (1 - pose.curva));
        ctx.translate(-pivoX, -pivoY);
        desenharCartao(ctx, indice, id);
        ctx.restore();
      });

      const def = obterPistaDeDados(ativo, PISTAS_DE_DADOS);
      if (doc) painelGeada(ctx, doc, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: PAINEL_H }, { tampa: false });
      else {
        ctx.save();
        ctx.fillStyle = 'rgba(12, 27, 48, 0.82)';
        caminhoArredondado(ctx, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: PAINEL_H }, 18);
        ctx.fill();
        ctx.restore();
      }
      desenharTexto(ctx, def?.nome ?? ativo, PAINEL_X + 28, PAINEL_Y + 38, { fonte: 'italic 800 30px "Barlow Condensed", Impact, sans-serif', cor: COR_TEXTO, contorno: 4 });
      desenharTexto(ctx, CLIMA_POR_PISTA[ativo] ?? '', PAINEL_X + 28, PAINEL_Y + 66, { fonte: '600 16px Barlow, sans-serif', cor: COR_MUTED });

      botaoRedondoVoltar(ctx, BOTAO_VOLTAR.x + BOTAO_VOLTAR.w / 2, BOTAO_VOLTAR.y + BOTAO_VOLTAR.h / 2, BOTAO_VOLTAR.w / 2, hover === 'voltar');
      const posePronto = pressao.pose('pronto', ticks);
      botao3D(ctx, { ...BOTAO_PRONTO, texto: 'PRONTO', tipo: 'primario', destaque: true, aoVivo: hover === 'pronto', t, pressionado: posePronto.pressionado, escalaExtra: posePronto.escalaExtra });

      // Dica de teclado no padrão comum do guia (§11): pílula de vidro no canto superior direito, não texto
      // solto -- e só em aparelho sem toque (não existe "ESC" no celular).
      if (!temToque) dicaTeclado(ctx, 'ESC volta ao menu', 928, 34);
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
