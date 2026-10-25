/**
 * Cena de resultado (plano §7 M1a, pilar 4 "de novo em 1 toque"): mostra pontos e tempo, e volta para uma nova
 * descida no toque ou tecla (Espaço/Enter), ou Menu ao clicar no botão "MENU" ou apertar Escape/M.
 *
 * Redesenho "premium estilo Pixar" (`docs/direcao-ui-premium.md` §11.2, Fase 3): Fundo B da pista corrida (ou
 * Fundo A, se `temaFundo` não vier -- compatibilidade com quem ainda não passa a pista, ex. testes antigos),
 * letreiro "CHEGOU!" com carimbo, personagem em `celeb` sobre monte de neve com raios de glória gelo, Painel
 * Geada com a contagem de pontos (§9.5) e tempo, CTA "DE NOVO!" e botão "MENU" secundário.
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { IdTema } from '../../core/contratos';
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { easeOutCubic, molaForte, msParaTicks, prefereMovimentoReduzido, progresso } from '../animacao';
import { desenharTexto, type CamadaEstatica } from '../desenho';
import { criarEstadoPressao, eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import { botao3D, construirFundoFosco, desenharLetreiro, dicaTeclado, monteDeNeve, painelGeada, raiosDeGloria } from '../kit-premium';
import type { Cena } from '../tipos';
import type { ResultadoDescida } from './descida';
import { assetsMenuCapaProntos, precarregarAssetsMenuCapa } from './menu-capa';
import { obterFundoBDoTema } from './fundo-campeonato';

export interface OpcoesCenaResultado {
  readonly dados: ResultadoDescida;
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  /** Id do personagem do jogador (retrato `celeb` + monte de neve); sem ele cai no `capi` (nunca trava). */
  readonly personagem?: string | undefined;
  /** Tema da pista corrida, pro Fundo B (§3.2); sem ele cai no Fundo A (capa fosca, §3.1). */
  readonly temaFundo?: IdTema | undefined;
  readonly aoReiniciar?: (() => void) | undefined;
  readonly aoMenu?: (() => void) | undefined;
}

const COR_FUNDO = '#0b1a33';
const COR_TEXTO = '#f4f9ff';
const COR_MUTED = '#aed0ef';

const PAINEL_X = 430;
const PAINEL_Y = 110;
const PAINEL_W = 470;
const PAINEL_H = 250;

const BOTAO_DE_NOVO: BotaoRetangular = { id: 'de-novo', x: 436, y: 384, w: 300, h: 64 };
const BOTAO_MENU: BotaoRetangular = { id: 'menu', x: 752, y: 392, w: 176, h: 48 };

const MONTE_CX = 240;
const MONTE_CY = 440;
const PERSONAGEM_ALTURA = 150;
const PES_Y = 430;

const T_TOQUE_LIBERADO = msParaTicks(600); // "nunca prender o jogador" + não reiniciar sem querer vindo da corrida

export function criarCenaResultado(opcoes: OpcoesCenaResultado): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  const reduzido = prefereMovimentoReduzido();
  const reiniciar = (): void => opcoes.aoReiniciar?.();
  const voltarMenu = (): void => {
    if (opcoes.aoMenu) opcoes.aoMenu();
    else reiniciar();
  };

  void precarregarAssetsMenuCapa();
  let sprite: SpritePersonagem | null = null;
  void carregarSpritePersonagem(opcoes.personagem ?? 'capi')
    .then((s) => {
      sprite = s;
    })
    .catch(() => {
      // fallback silencioso -- sem sprite, só não desenha o personagem (nunca trava a tela de resultado)
    });

  let fundo: CamadaEstatica | null = null;
  let hover: string | null = null;
  const pressao = criarEstadoPressao();

  const aoMover = (ev: Event): void => {
    if (!opcoes.aoMenu) return;
    const pt = eventoParaPontoLogico(ev as PointerEvent, opcoes.canvas);
    hover = pontoDentroDoBotao(pt, BOTAO_MENU) ? 'menu' : pontoDentroDoBotao(pt, BOTAO_DE_NOVO) ? 'de-novo' : null;
  };

  const aoTecla = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (e.code === 'Space' || e.code === 'Enter') {
      pressao.marcar('de-novo', ticks);
      reiniciar();
    } else if (e.code === 'Escape' || e.code === 'KeyM') {
      voltarMenu();
    }
  };

  const aoTocar = (ev: Event): void => {
    const pt = eventoParaPontoLogico(ev as PointerEvent, opcoes.canvas);
    if (opcoes.aoMenu && pontoDentroDoBotao(pt, BOTAO_MENU)) {
      pressao.marcar('menu', ticks);
      voltarMenu();
      return;
    }
    // "tocar em qualquer lugar = de novo" (pilar "de novo em 1 toque"), mas só depois de `T_TOQUE_LIBERADO` --
    // o mesmo toque que vinha da corrida (ex. o pulo final) não pode reiniciar sem querer (§11.2).
    if (ticks < T_TOQUE_LIBERADO) return;
    pressao.marcar('de-novo', ticks);
    reiniciar();
  };

  janela?.addEventListener('keydown', aoTecla);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  opcoes.canvas.addEventListener('pointerdown', aoTocar);

  let ticks = 0;
  return {
    id: 'resultado',
    atualizar() {
      ticks += 1;
    },
    desenhar(ctx: Ctx, alpha: number) {
      const t = ticks + alpha;

      if (!fundo && doc) {
        fundo = opcoes.temaFundo ? obterFundoBDoTema(opcoes.temaFundo, doc) : null;
        if (!fundo) {
          const assets = assetsMenuCapaProntos();
          if (assets) fundo = construirFundoFosco(doc, assets.capa, { reducao: 16, veuTopo: 0.3, veuBase: 0.45 });
        }
      }
      if (fundo) fundo.desenhar(ctx);
      else {
        ctx.save();
        ctx.fillStyle = COR_FUNDO;
        ctx.fillRect(0, 0, LARGURA, ALTURA);
        ctx.restore();
      }

      // Raios de glória gelo atrás do personagem, carimbando junto do título (§11.2).
      const pCarimbo = progresso(t, 0, msParaTicks(360));
      raiosDeGloria(ctx, MONTE_CX, PES_Y - PERSONAGEM_ALTURA * 0.5, 'gelo', 220, easeOutCubic(pCarimbo), t * 0.12, 14);

      monteDeNeve(ctx, MONTE_CX, MONTE_CY, 60, 26);

      const quadro = sprite ? (sprite.obterQuadro('celeb') ?? sprite.obterQuadro('ride0')) : null;
      const referencia = sprite?.obterQuadro('ride0')?.dados ?? quadro?.dados;
      if (quadro && referencia) {
        const escala = PERSONAGEM_ALTURA / referencia.altura;
        const d = quadro.dados;
        const [ancoraX, ancoraY] = d.contato ?? d.pivo;
        ctx.save();
        ctx.translate(MONTE_CX, PES_Y);
        ctx.drawImage(quadro.imagem, -ancoraX * escala, -ancoraY * escala, d.largura * escala, d.altura * escala);
        ctx.restore();
      }

      // Letreiro "CHEGOU!" com carimbo (molaForte, escala 1,8 -> 1 + rotação leve) -- §8.3 "carimbo".
      const pTitulo = reduzido ? 1 : progresso(t, 0, msParaTicks(360));
      const curvaTitulo = molaForte(pTitulo);
      const escalaTitulo = reduzido ? 1 : 1.8 - 0.8 * curvaTitulo;
      const rotacaoTitulo = reduzido ? 0 : (-8 + 5 * curvaTitulo) * (Math.PI / 180);
      ctx.save();
      ctx.translate(LARGURA / 2, 70);
      ctx.rotate(rotacaoTitulo);
      ctx.scale(escalaTitulo, escalaTitulo);
      if (doc) desenharLetreiro(ctx, doc, 'CHEGOU!', 0, 0, 56, 'gelo');
      else desenharTexto(ctx, 'CHEGOU!', 0, 0, { fonte: 'italic 800 56px "Barlow Condensed", Impact, sans-serif', cor: COR_TEXTO, contorno: 8, alinhamento: 'center', base: 'middle' });
      ctx.restore();

      if (doc) painelGeada(ctx, doc, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: PAINEL_H });
      else {
        ctx.save();
        ctx.fillStyle = 'rgba(12, 27, 48, 0.82)';
        ctx.fillRect(PAINEL_X, PAINEL_Y, PAINEL_W, PAINEL_H);
        ctx.restore();
      }

      // y48, não y40: a tampa de neve pendura gotas até ~38px abaixo do topo do painel -- y40 só tinha 2px de
      // folga real (medido no navegador, feedback do dono 2026-10-24).
      desenharTexto(ctx, 'PONTOS', PAINEL_X + 32, PAINEL_Y + 48, { fonte: '600 15px Barlow, sans-serif', cor: COR_MUTED });

      // Contagem de pontos (§9.5): 0 -> total em 1000ms, easeOutCubic. No fim, um "pulo" rápido do número.
      const pContagem = progresso(t, msParaTicks(100), msParaTicks(1000));
      const pontosExibidos = Math.round(opcoes.dados.pontos * easeOutCubic(pContagem));
      const pPulo = progresso(t, msParaTicks(1100), msParaTicks(260));
      const escalaPulo = pPulo >= 1 ? 1 : 1 + 0.22 * Math.sin(Math.PI * Math.min(1, pPulo));
      ctx.save();
      ctx.translate(PAINEL_X + 32, PAINEL_Y + 104);
      ctx.scale(escalaPulo, escalaPulo);
      desenharTexto(ctx, String(pontosExibidos), 0, 0, { fonte: 'italic 800 64px "Barlow Condensed", Impact, sans-serif', cor: '#FFD23F', contorno: 7, corContorno: '#0B1630', base: 'alphabetic' });
      ctx.restore();

      desenharTexto(ctx, `TEMPO ${(opcoes.dados.ticks / 60).toFixed(1)} s`, PAINEL_X + 32, PAINEL_Y + 146, {
        fonte: 'italic 800 26px "Barlow Condensed", Impact, sans-serif',
        cor: COR_TEXTO,
      });
      // Faixa de conquistas (combo/pousos perfeitos/tombos/giro) fica pra quando `ResultadoDescida` expuser o
      // `ResumoDescida` (hoje só vêm `pontos`/`ticks`/`replay`) -- PENDÊNCIA conhecida, não desta tela.

      const poseDeNovo = pressao.pose('de-novo', ticks);
      botao3D(ctx, { ...BOTAO_DE_NOVO, texto: 'DE NOVO!', tipo: 'primario', destaque: true, aoVivo: hover === 'de-novo', t, pressionado: poseDeNovo.pressionado, escalaExtra: poseDeNovo.escalaExtra });
      dicaTeclado(ctx, 'ESPAÇO', BOTAO_DE_NOVO.x + BOTAO_DE_NOVO.w / 2 + 40, BOTAO_DE_NOVO.y + BOTAO_DE_NOVO.h + 16);

      if (opcoes.aoMenu) {
        const poseMenu = pressao.pose('menu', ticks);
        botao3D(ctx, { ...BOTAO_MENU, texto: 'MENU', tipo: 'secundario', aoVivo: hover === 'menu', tamanhoFonte: 20, pressionado: poseMenu.pressionado, escalaExtra: poseMenu.escalaExtra });
      }
    },
    destruir() {
      janela?.removeEventListener('keydown', aoTecla);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
    },
  };
}
