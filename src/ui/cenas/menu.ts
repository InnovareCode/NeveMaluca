/**
 * Cena de Menu Principal (Canvas 2D) -- visual "key art" Pixar (plano "corrida em campeonato" §C8a, ZERO
 * crédito): cenário raster de UMA pista (`public/assets/cenarios/`, mesmas camadas que a descida usa, via
 * `render/temas/catalogo.ts`) + os 6 personagens (`public/assets/personagens/`) num pelotão close -- o ativo
 * (hero) na frente/maior, os outros 5 ao redor, em poses de manobra. Botões "bala" (`ui/desenho.ts`,
 * `desenharBotaoBala`) + logo tipográfico.
 *
 * Menu: CAMPEONATO / TREINO / PERSONAGEM / OPÇÕES (o antigo MODOS vira TREINO -- o modo solo de hoje -- e
 * CAMPEONATO é NOVO). Contrato de callbacks e POSIÇÃO de cada botão ficam EXATAMENTE como antes (`aoJogar`/
 * `aoModos`/`aoOpcoes`/`aoPersonagem`/`aoPista`, mesmas coordenadas): só o RÓTULO visual muda -- os testes de
 * `ui-cenas-fase1.test.ts` e os e2e (`fase1-fluxo-cenas`, `selecao-pista`, `selecao-personagem`) clicam por
 * posição, sem conhecer texto. O botão de CAMPEONATO (posição que era "MODOS") liga a `ui/cenas/campeonato.ts`
 * desde a C2b (`gerenciador.ts`: `aoModos: () => irPara('campeonato')`); sem `aoModos` (testes que não usam o
 * recurso) fica inerte, nunca cai de volta em `aoJogar` -- mesmo padrão "fica inerte" de `aoPersonagem`/`aoPista`.
 */
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import { ALTURA, LARGURA } from '../../core/constantes';
import { seno } from '../../core/trig';
import { PISTA_MORRO_DO_PINHAO, obterPistaDeDados } from '../../data/pistas';
import { REGRAS_SAVE } from '../../data/regras-save';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { criarParallax, type Parallax } from '../../render/parallax';
import { pintorDoTema, precarregarAssetsDoTema, precarregarAssetsParqueRaster, temaDeRenderDoTema } from '../../render/temas/catalogo';
import { criarCamadaEstatica, desenharBotaoBala, desenharFlocos, type CamadaEstatica } from '../desenho';
import { eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import type { Cena } from '../tipos';

export interface OpcoesCenaMenu {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly aoJogar: () => void;
  readonly aoModos?: (() => void) | undefined;
  readonly aoOpcoes: () => void;
  /** Abre a tela de seleção de personagem; sem ela, o botão PERSONAGEM fica inerte (testes que não usam o recurso). */
  readonly aoPersonagem?: (() => void) | undefined;
  /** Abre a tela de seleção de pista; sem ela, o botão PISTA fica inerte (testes que não usam o recurso). */
  readonly aoPista?: (() => void) | undefined;
  /** Id do personagem em destaque no pelotão (hero, maior/na frente); sem ele, mostra a `capi`. */
  readonly obterPersonagemAtivo?: (() => string) | undefined;
  /** Pista ativa do save; sem ela, nada extra é pré-carregado. Dispara o preload do raster DELA (além do
   * `parque` da key art, abaixo) desde já -- TREINO/CAMPEONATO pulam `selecao-pista.ts` e, até o polimento
   * "Pixar no gameplay", só `descida.ts`/`corrida.ts` disparavam isto, já tarde demais pro 1º quadro deles. O
   * menu dá o maior tempo de folga possível (o jogador ainda vai navegar/decidir aqui). */
  readonly obterPistaAtiva?: (() => string) | undefined;
  /** Catálogo pro pelotão (hero + 5 ao redor); sem ele, cai no elenco inteiro de `data/regras-save.ts`. */
  readonly catalogoPersonagens?: readonly string[] | undefined;
}

const COR_TEXTO = '#f4f9ff';
const COR_CONTORNO = '#0b1a33';

const BOTOES_LARGURA = 220;
const BOTOES_ALTURA = 54;
const BOTOES_X = 80;
const BOTAO_JOGAR_Y = 220;
const BOTAO_MODOS_Y = 295;
const BOTAO_OPCOES_Y = 370;
const BOTAO_PERSONAGEM_Y = 445;

const BOTAO_JOGAR: BotaoRetangular = { id: 'jogar', x: BOTOES_X, y: BOTAO_JOGAR_Y, w: BOTOES_LARGURA, h: BOTOES_ALTURA };
const BOTAO_MODOS: BotaoRetangular = { id: 'modos', x: BOTOES_X, y: BOTAO_MODOS_Y, w: BOTOES_LARGURA, h: BOTOES_ALTURA };
const BOTAO_OPCOES: BotaoRetangular = { id: 'opcoes', x: BOTOES_X, y: BOTAO_OPCOES_Y, w: BOTOES_LARGURA, h: BOTOES_ALTURA };
const BOTAO_PERSONAGEM: BotaoRetangular = { id: 'personagem', x: BOTOES_X, y: BOTAO_PERSONAGEM_Y, w: BOTOES_LARGURA, h: BOTOES_ALTURA };
// Ao lado de PERSONAGEM (mesma linha), não embaixo: não há mais altura livre no canvas 960x540 para uma 5ª linha.
const BOTAO_PISTA: BotaoRetangular = {
  id: 'pista',
  x: BOTOES_X + BOTOES_LARGURA + 20,
  y: BOTAO_PERSONAGEM_Y,
  w: BOTOES_LARGURA,
  h: BOTOES_ALTURA,
};

/** Fallback vetorial enquanto o cenário raster carrega (fire-and-forget) ou se ele falhar -- nunca trava o menu. */
function pintarCenarioReserva(ctx: Ctx): void {
  const ceu = ctx.createLinearGradient(0, 0, 0, ALTURA);
  ceu.addColorStop(0, '#1b4b8a');
  ceu.addColorStop(1, '#70aae0');
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, LARGURA, ALTURA);

  ctx.fillStyle = '#f4f9ff';
  ctx.beginPath();
  ctx.moveTo(0, ALTURA);
  ctx.lineTo(0, ALTURA * 0.76);
  ctx.bezierCurveTo(LARGURA * 0.35, ALTURA * 0.74, LARGURA * 0.65, ALTURA * 0.56, LARGURA, ALTURA * 0.42);
  ctx.lineTo(LARGURA, ALTURA);
  ctx.closePath();
  ctx.fill();
}

/** Um "ator" do pelotão (plano §C8a): posição/tamanho/pose fixos por SLOT, não por identidade -- qualquer
 *  catálogo de 6 ids encaixa aqui, o hero só ocupa o slot `heroi`. */
interface SlotPelotao {
  readonly x: number;
  readonly y: number;
  readonly alturaPx: number;
  readonly pose: string;
  readonly anguloGraus: number;
}

/** Hero (ativo) na frente/maior, mais baixo na composição (perto da "câmera"); os outros 5 atrás, menores, em
 *  arco -- poses de manobra variadas (voo, grab, pouso), nunca a mesma pose duas vezes. */
const SLOT_HEROI: SlotPelotao = { x: 740, y: 440, alturaPx: 210, pose: 'star', anguloGraus: -4 };
const SLOTS_COMPANHEIROS: readonly SlotPelotao[] = [
  { x: 565, y: 335, alturaPx: 100, pose: 'air', anguloGraus: 8 },
  { x: 650, y: 268, alturaPx: 105, pose: 'grabUp', anguloGraus: -6 },
  { x: 762, y: 254, alturaPx: 102, pose: 'flip0', anguloGraus: 10 },
  { x: 878, y: 296, alturaPx: 108, pose: 'land', anguloGraus: -3 },
  { x: 900, y: 420, alturaPx: 112, pose: 'tuck1', anguloGraus: 4 },
];

function desenharAtorPelotao(ctx: Ctx, sprite: SpritePersonagem | null, slot: SlotPelotao): void {
  const quadro = sprite ? (sprite.obterQuadro(slot.pose) ?? sprite.obterQuadro('ride0')) : null;
  ctx.save();
  ctx.translate(slot.x, slot.y);
  ctx.rotate((slot.anguloGraus * Math.PI) / 180);
  if (quadro) {
    const d = quadro.dados;
    const escala = slot.alturaPx / d.altura;
    const [ancoraX, ancoraY] = d.contato ?? d.pivo;
    ctx.drawImage(quadro.imagem, -ancoraX * escala, -ancoraY * escala, d.largura * escala, d.altura * escala);
  } else {
    // fallback silencioso: cápsula genérica enquanto o sprite não carregou
    ctx.fillStyle = '#8e5b23';
    ctx.beginPath();
    ctx.ellipse(0, 0, slot.alturaPx * 0.17, slot.alturaPx * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function criarCenaMenu(opcoes: OpcoesCenaMenu): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);

  let ticks = 0;
  let botaoHover: string | null = null;
  let cenarioReserva: CamadaEstatica | null = null;

  // Cenário raster "Pixar" do Pico do Picolé (tema `parque`, plano §C8a: "UMA pista" de fundo): decide raster x
  // vetorial UMA vez, só depois de o carregamento (fire-and-forget) assentar -- mesmo padrão de
  // `ui/cenas/selecao-pista.ts` -- então cai sozinho no vetorial (`pintarCenarioReserva`) se ainda não deu tempo
  // ou se os assets falharem (nunca trava o menu).
  let parallaxPronto: Parallax | null = null;
  void precarregarAssetsParqueRaster(doc).then(() => {
    parallaxPronto = criarParallax(doc, pintorDoTema('parque'), temaDeRenderDoTema('parque'));
  });
  // Pista ativa: preload cedo (fire-and-forget), não pro cenário do PRÓPRIO menu (sempre `parque`, acima) -- pro
  // TREINO/CAMPEONATO que o jogador pode abrir a qualquer momento a partir daqui.
  if (opcoes.obterPistaAtiva) {
    const temaDaAtiva = (obterPistaDeDados(opcoes.obterPistaAtiva()) ?? PISTA_MORRO_DO_PINHAO).tema;
    void precarregarAssetsDoTema(temaDaAtiva, doc);
  }
  let derivaXm = 0;

  // Elenco do pelotão (hero + 5): melhor esforço, cada sprite cai no fallback de cápsula se ainda não carregou.
  const catalogo = opcoes.catalogoPersonagens ?? REGRAS_SAVE.personagens;
  const sprites = new Map<string, SpritePersonagem>();
  for (const id of catalogo) {
    void carregarSpritePersonagem(id)
      .then((s) => sprites.set(id, s))
      .catch(() => {
        // fallback silencioso: o slot mostra a cápsula genérica
      });
  }

  const aoMover = (e: Event): void => {
    const ev = e as PointerEvent;
    const pt = eventoParaPontoLogico(ev, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_JOGAR)) botaoHover = 'jogar';
    else if (pontoDentroDoBotao(pt, BOTAO_MODOS)) botaoHover = 'modos';
    else if (pontoDentroDoBotao(pt, BOTAO_OPCOES)) botaoHover = 'opcoes';
    else if (pontoDentroDoBotao(pt, BOTAO_PERSONAGEM)) botaoHover = 'personagem';
    else if (pontoDentroDoBotao(pt, BOTAO_PISTA)) botaoHover = 'pista';
    else botaoHover = null;
  };

  const aoTocar = (e: Event): void => {
    e.preventDefault?.();
    const ev = e as PointerEvent;
    const pt = eventoParaPontoLogico(ev, opcoes.canvas);

    if (pontoDentroDoBotao(pt, BOTAO_JOGAR)) {
      opcoes.aoJogar();
    } else if (pontoDentroDoBotao(pt, BOTAO_MODOS)) {
      // CAMPEONATO (posição que era MODOS): ainda não existe motor de campeonato (C2a/C5a) -- fica inerte sem
      // `aoModos`, nunca cai de volta pra `aoJogar` (mentiria pro jogador que campeonato = descida solo).
      opcoes.aoModos?.();
    } else if (pontoDentroDoBotao(pt, BOTAO_OPCOES)) {
      opcoes.aoOpcoes();
    } else if (pontoDentroDoBotao(pt, BOTAO_PERSONAGEM)) {
      opcoes.aoPersonagem?.();
    } else if (pontoDentroDoBotao(pt, BOTAO_PISTA)) {
      opcoes.aoPista?.();
    }
  };

  const aoTeclar = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.code === 'Enter' || ev.code === 'Space') {
      opcoes.aoJogar();
    } else if (ev.code === 'KeyC') {
      opcoes.aoModos?.();
    } else if (ev.code === 'KeyO') {
      opcoes.aoOpcoes();
    } else if (ev.code === 'KeyP') {
      opcoes.aoPersonagem?.();
    } else if (ev.code === 'KeyT') {
      opcoes.aoPista?.();
    }
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  janela?.addEventListener('keydown', aoTeclar);

  return {
    id: 'menu',
    atualizar() {
      ticks += 1;
      derivaXm += 0.012; // deriva lenta do parallax (sensação de "cenário vivo", não uma câmera de corrida)
    },
    desenhar(ctx: Ctx, alpha: number) {
      const t = ticks + alpha;

      if (parallaxPronto) {
        parallaxPronto.desenhar(ctx, derivaXm, t);
      } else {
        if (!cenarioReserva && doc) cenarioReserva = criarCamadaEstatica(doc, pintarCenarioReserva);
        if (cenarioReserva) cenarioReserva.desenhar(ctx);
        else pintarCenarioReserva(ctx);
      }

      // Estouro de luz atrás do pelotão (key art): gradiente simples, sem `shadowBlur`/`filter` (caro em canvas
      // por software -- mesma regra de performance do README de `render/`).
      const brilho = ctx.createRadialGradient(SLOT_HEROI.x, SLOT_HEROI.y - 90, 10, SLOT_HEROI.x, SLOT_HEROI.y - 90, 280);
      brilho.addColorStop(0, 'rgba(255, 248, 220, 0.55)');
      brilho.addColorStop(1, 'rgba(255, 248, 220, 0)');
      ctx.fillStyle = brilho;
      ctx.fillRect(0, 0, LARGURA, ALTURA);

      desenharFlocos(ctx, 40, t);

      // Pelotão: os 5 companheiros (atrás, menores) primeiro, o hero (ativo, na frente/maior) por último.
      const idHeroi = opcoes.obterPersonagemAtivo?.() ?? catalogo[0] ?? 'capi';
      const companheiros = catalogo.filter((id) => id !== idHeroi);
      SLOTS_COMPANHEIROS.forEach((slot, i) => {
        const id = companheiros[i % Math.max(1, companheiros.length)];
        desenharAtorPelotao(ctx, id ? sprites.get(id) ?? null : null, slot);
      });
      const bobHeroi = seno((t * 2.4) % 360) * 3;
      desenharAtorPelotao(ctx, sprites.get(idHeroi) ?? null, { ...SLOT_HEROI, y: SLOT_HEROI.y + bobHeroi });

      // Logo + subtítulo (key art, canto superior esquerdo -- fora do pelotão).
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      ctx.font = 'italic 900 68px "Barlow Condensed", Impact, sans-serif';

      ctx.lineWidth = 10;
      ctx.strokeStyle = COR_CONTORNO;
      ctx.strokeText('NEVE MALUCA', BOTOES_X, 130);

      const gradTitulo = ctx.createLinearGradient(BOTOES_X, 80, BOTOES_X, 140);
      gradTitulo.addColorStop(0, '#ffffff');
      gradTitulo.addColorStop(1, '#a8e0ff');
      ctx.fillStyle = gradTitulo;
      ctx.fillText('NEVE MALUCA', BOTOES_X, 130);

      ctx.font = '700 20px Barlow, sans-serif';
      ctx.lineWidth = 4;
      ctx.strokeStyle = COR_CONTORNO;
      ctx.strokeText('CAMPEONATO DA MONTANHA', BOTOES_X + 2, 162);
      ctx.fillStyle = COR_TEXTO;
      ctx.fillText('CAMPEONATO DA MONTANHA', BOTOES_X + 2, 162);
      ctx.restore();

      // Botões "bala": CAMPEONATO (destaque, novo) e TREINO (a descida solo de sempre) na mesma posição de
      // JOGAR/MODOS de antes -- só o rótulo muda (ver comentário de topo do arquivo).
      desenharBotaoBala(ctx, {
        ...BOTAO_JOGAR,
        texto: 'TREINO',
        corTopo: botaoHover === 'jogar' ? '#ffe066' : '#f6c90e',
        corBase: botaoHover === 'jogar' ? '#f39c12' : '#d35400',
        destaque: true,
        aoVivo: botaoHover === 'jogar',
      });

      desenharBotaoBala(ctx, {
        ...BOTAO_MODOS,
        texto: 'CAMPEONATO',
        corTopo: botaoHover === 'modos' ? '#4da2ff' : '#2a7de1',
        corBase: botaoHover === 'modos' ? '#1f6fd0' : '#144d8f',
        aoVivo: botaoHover === 'modos',
      });

      desenharBotaoBala(ctx, {
        ...BOTAO_OPCOES,
        texto: 'OPÇÕES',
        corTopo: botaoHover === 'opcoes' ? '#4da2ff' : '#2a7de1',
        corBase: botaoHover === 'opcoes' ? '#1f6fd0' : '#144d8f',
        aoVivo: botaoHover === 'opcoes',
      });

      desenharBotaoBala(ctx, {
        ...BOTAO_PERSONAGEM,
        texto: 'PERSONAGEM',
        corTopo: botaoHover === 'personagem' ? '#4da2ff' : '#2a7de1',
        corBase: botaoHover === 'personagem' ? '#1f6fd0' : '#144d8f',
        aoVivo: botaoHover === 'personagem',
      });

      desenharBotaoBala(ctx, {
        ...BOTAO_PISTA,
        texto: 'PISTA',
        corTopo: botaoHover === 'pista' ? '#4da2ff' : '#2a7de1',
        corBase: botaoHover === 'pista' ? '#1f6fd0' : '#144d8f',
        aoVivo: botaoHover === 'pista',
      });

      // Rodapé
      ctx.save();
      ctx.textAlign = 'left';
      ctx.font = '600 14px Barlow, sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = COR_CONTORNO;
      ctx.strokeText('v1.0 · Neve Maluca · Innovare Games', 20, ALTURA - 16);
      ctx.fillStyle = COR_TEXTO;
      ctx.fillText('v1.0 · Neve Maluca · Innovare Games', 20, ALTURA - 16);
      ctx.restore();
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
