/**
 * Tela de Seleção de Personagem (Canvas 2D), acessível pelo botão PERSONAGEM do Menu (ou automaticamente antes
 * de TREINO/CAMPEONATO -- `[[fluxo-inicio-selecao-personagem-antes-de-correr]]`).
 *
 * Redesenho "no nível da capa" (feedback do dono, 2026-10-24: a versão anterior em grade de cartões pequenos
 * sobre painel azul liso ficava longe da qualidade de `public/assets/menu/capa.webp`, e os 5 personagens não
 * ativos apareciam como cápsula marrom genérica por 2-4s até os sprites carregarem -- "nem por segundos").
 *
 * Resposta aos dois problemas:
 *  1. Zero placeholder feio: os 6 sprites são precarregados o quanto antes (`ui/cenas/abertura.ts`, maior lead
 *     time possível -- `carregarSpritePersonagem` é cacheado por id em `assets/index.ts`, então quando esta tela
 *     monta, a MESMA promessa já resolvida dispara o `.then()` como microtask antes do 1º quadro, `[[gating-cena-por-promise-quebra-testes-sincronos]]`). Enquanto algum sprite específico ainda não chegou (rede lenta),
 *     o fallback NUNCA é a cápsula marrom antiga: é um esqueleto translúcido azul-neve com um floco, no tom da
 *     paleta do jogo (nunca "fora do padrão Pixar" por acidente de cor).
 *  2. Fundo = `capa.webp` borrada (uma vez, em `CamadaEstatica` -- `ui/desenho.ts` -- nunca `filter` por quadro)
 *     e escurecida; o personagem ATIVO aparece GRANDE no palco à esquerda (pose 'star' preferida: manobra),
 *     com nome, manobra assinatura (`DefPersonagem.nomeAssinatura`) e barras de Velocidade/Equilíbrio/Força no
 *     painel à direita (Força usa `atributos.pulo` como proxy -- é o mesmo agrupamento conceitual de
 *     `data/evolucao.ts: ATRIBUTOS_EVOLUCAO`, "Força (pulo+embalo)"). Nível de evolução (se `obterEvolucao` foi
 *     passado e > 0): badge + segmento dourado além da barra base, mesma economia de `oficina-campeonato.ts`.
 *     Uma fita de 6 miniaturas abaixo troca o ativo ao tocar (mesmo contrato de sempre: `aoEscolher` persiste e,
 *     se veio de TREINO/CAMPEONATO, navega); o botão CORRER grande reafirma o ativo atual (mesmo `aoEscolher`).
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { Evolucao } from '../../core/contratos';
import { seno } from '../../core/trig';
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import { NIVEL_MAXIMO_EVOLUCAO, PASSO_ATRIBUTO_POR_NIVEL } from '../../data/evolucao';
import { PERSONAGENS_DE_DADOS } from '../../data/personagens';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { caminhoArredondado, criarCamadaEstatica, desenharBotaoBala, desenharFlocos, desenharTexto, type CamadaEstatica } from '../desenho';
import { eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import type { Cena } from '../tipos';
import { assetsMenuCapaProntos, precarregarAssetsMenuCapa } from './menu-capa';

export interface OpcoesCenaSelecao {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  /** Catálogo inteiro de ids de personagem (ordem de exibição = ordem das miniaturas). */
  readonly catalogo: readonly string[];
  readonly obterPersonagemAtivo: () => string;
  /** Escolheu um card: quem persiste é o chamador (gerenciador), esta tela só avisa. */
  readonly aoEscolher: (id: string) => void;
  readonly aoVoltar: () => void;
  /** Lido a cada quadro (não cacheado): nível de evolução do ativo, se a economia de campeonato já existir. */
  readonly obterEvolucao?: (() => Evolucao) | undefined;
}

/** Nomes curtos para a fita de miniaturas (direção de arte §3); id cru é o fallback para um id futuro. */
const NOMES_EXIBICAO: Readonly<Record<string, string>> = {
  capi: 'Capi',
  bandeira: 'Prof. Bandeira',
  cidinha: 'Vó Cidinha',
  beto: 'Tio Beto',
  queque: 'Quequé',
  bia: 'Bia Pipoca',
};

function nomeExibicao(id: string): string {
  return NOMES_EXIBICAO[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
}

function obterDefPersonagem(id: string) {
  return PERSONAGENS_DE_DADOS.find((d) => d.id === id);
}

const COR_FUNDO = '#0c1b30';
const COR_PAINEL = 'rgba(12, 27, 48, 0.78)';
const COR_BORDA = '#2a517f';
const COR_TEXTO = '#f4f9ff';
const COR_CONTORNO = '#0b1a33';
const COR_SELECIONADO = '#f6c90e';
const COR_DESTAQUE = '#ffd166';
const COR_MUTED = '#8fb6e0';
const COR_BARRA_BASE = '#5fb0ff';

const PAINEL_X = 440;
const PAINEL_Y = 72;
const PAINEL_W = 500;
const PAINEL_H = 250;

const PALCO_CX = 215;
// Folga de verdade acima da fita de miniaturas (`MINI_Y`, abaixo): o personagem (e o monte de neve sob os pés)
// termina bem antes de 340 -- antes a prancha encostava/sumia atrás do topo dos cards (feedback do dono).
const PALCO_BASE_Y = 298;
const PALCO_ALTURA = 192;
const PALCO_HALO_R = 122;
const MONTE_RX = PALCO_ALTURA * 0.56;
const MONTE_RY = 15;

const MINI_Y = 340;
const MINI_W = 140;
const MINI_H = 92;
const MINI_GAP = 10;
const MINI_X0 = (LARGURA - (MINI_W * 6 + MINI_GAP * 5)) / 2;

const BOTAO_VOLTAR: BotaoRetangular = { id: 'voltar', x: 40, y: 454, w: 160, h: 44 };
const BOTAO_CORRER: BotaoRetangular = { id: 'correr', x: 330, y: 444, w: 300, h: 58 };

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function cartao(indice: number): BotaoRetangular {
  return { id: `card-${indice}`, x: MINI_X0 + indice * (MINI_W + MINI_GAP), y: MINI_Y, w: MINI_W, h: MINI_H };
}

/** Fundo = `capa.webp` borrada (UMA vez, offscreen) + véu escuro -- nunca refeita por quadro (`filter` é caro em canvas por software). */
function construirFundoBorrado(doc: Document, img: HTMLImageElement): CamadaEstatica {
  return criarCamadaEstatica(doc, (ctx) => {
    ctx.save();
    ctx.filter = 'blur(10px)';
    const escala = Math.max(LARGURA / img.naturalWidth, ALTURA / img.naturalHeight) * 1.08;
    const w = img.naturalWidth * escala;
    const h = img.naturalHeight * escala;
    ctx.drawImage(img, (LARGURA - w) / 2, (ALTURA - h) / 2, w, h);
    ctx.restore();
    ctx.fillStyle = 'rgba(6, 13, 27, 0.72)';
    ctx.fillRect(0, 0, LARGURA, ALTURA);
  });
}

/** Fallback NUNCA é a cápsula marrom antiga: esqueleto translúcido na paleta do jogo + floco, enquanto o sprite daquele id não chegou. */
function desenharEsqueletoPersonagem(ctx: Ctx, cx: number, baseY: number, altura: number, t: number): void {
  const pulso = 0.5 + 0.5 * Math.max(0, seno((t * 3) % 360));
  ctx.save();
  ctx.fillStyle = `rgba(143, 182, 224, ${0.16 + 0.1 * pulso})`;
  ctx.beginPath();
  ctx.ellipse(cx, baseY - altura * 0.44, altura * 0.3, altura * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  desenharTexto(ctx, '❄', cx, baseY - altura * 0.44, {
    fonte: `${Math.round(altura * 0.26)}px sans-serif`,
    cor: `rgba(244, 249, 255, ${0.55 + 0.25 * pulso})`,
    alinhamento: 'center',
    base: 'middle',
  });
  ctx.restore();
}

/** Barra horizontal (90..110 de ficha + até +15 de evolução no nível 5 = faixa 90..125). Segmento azul = ficha, dourado = bônus. */
function desenharBarraAtributo(ctx: Ctx, x: number, y: number, w: number, h: number, rotulo: string, valorBase: number, bonus: number): void {
  const FAIXA = 35;
  const fracaoBase = clamp01((valorBase - 90) / FAIXA);
  const fracaoBonus = clamp01(bonus / FAIXA);
  const rotuloW = 92;
  const trilhoX = x + rotuloW;
  const trilhoW = w - rotuloW;

  desenharTexto(ctx, rotulo, x, y + h / 2, { fonte: '600 15px Barlow, sans-serif', cor: COR_TEXTO, base: 'middle' });

  ctx.save();
  ctx.fillStyle = 'rgba(8, 18, 36, 0.55)';
  caminhoArredondado(ctx, { x: trilhoX, y, w: trilhoW, h }, h / 2);
  ctx.fill();

  caminhoArredondado(ctx, { x: trilhoX, y, w: trilhoW, h }, h / 2);
  ctx.clip();
  ctx.fillStyle = COR_BARRA_BASE;
  ctx.fillRect(trilhoX, y, trilhoW * fracaoBase, h);
  if (fracaoBonus > 0) {
    ctx.fillStyle = COR_SELECIONADO;
    ctx.fillRect(trilhoX + trilhoW * fracaoBase, y, trilhoW * fracaoBonus, h);
  }
  ctx.restore();

  ctx.lineWidth = 2;
  ctx.strokeStyle = COR_BORDA;
  caminhoArredondado(ctx, { x: trilhoX, y, w: trilhoW, h }, h / 2);
  ctx.stroke();
}

export function criarCenaSelecao(opcoes: OpcoesCenaSelecao): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  let hover: string | null = null;
  let ticks = 0;
  let fundo: CamadaEstatica | null = null;

  // Defensivo: se esta tela abrir sem ter passado por abertura/menu (ex. teste direto), garante o fire-and-forget
  // mesmo assim -- cacheado, não duplica o carregamento se já estava em andamento.
  void precarregarAssetsMenuCapa();

  // Sprites: melhor esforço, cacheado por id (`assets/index.ts`) -- se abertura/menu já chamaram, o `.then()`
  // roda como microtask antes do 1º quadro desta cena (zero placeholder na prática).
  const sprites = new Map<string, SpritePersonagem>();
  for (const id of opcoes.catalogo) {
    void carregarSpritePersonagem(id)
      .then((s) => {
        sprites.set(id, s);
      })
      .catch(() => {
        // fallback silencioso: o esqueleto translúcido cobre enquanto não chega
      });
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
    else if (pontoDentroDoBotao(pt, BOTAO_CORRER)) hover = 'correr';
    else hover = null;
  };

  const aoTocar = (e: Event): void => {
    e.preventDefault?.();
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    const indice = cartaoNoPonto(pt);
    if (indice !== null) {
      opcoes.aoEscolher(opcoes.catalogo[indice] as string);
    } else if (pontoDentroDoBotao(pt, BOTAO_VOLTAR)) {
      opcoes.aoVoltar();
    } else if (pontoDentroDoBotao(pt, BOTAO_CORRER)) {
      opcoes.aoEscolher(opcoes.obterPersonagemAtivo());
    }
  };

  const aoTeclar = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.code === 'Escape' || ev.code === 'Backspace') {
      ev.preventDefault?.();
      opcoes.aoVoltar();
      return;
    }
    if (ev.code === 'ArrowRight' || ev.code === 'ArrowLeft') {
      ev.preventDefault?.();
      const total = opcoes.catalogo.length;
      if (total === 0) return;
      const atual = opcoes.catalogo.indexOf(opcoes.obterPersonagemAtivo());
      const base = atual >= 0 ? atual : 0;
      const proximo = ev.code === 'ArrowRight' ? (base + 1) % total : (base - 1 + total) % total;
      opcoes.aoEscolher(opcoes.catalogo[proximo] as string);
    } else if (ev.code === 'Enter' || ev.code === 'Space') {
      ev.preventDefault?.();
      opcoes.aoEscolher(opcoes.obterPersonagemAtivo());
    }
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  janela?.addEventListener('keydown', aoTeclar);

  /** Monte de neve sob os pés: sombra de contato + corpo em gradiente (volume, não um disco liso) + brilho no
   *  topo + alguns glints -- antes era uma elipse translúcida lisa, que contra o fundo escuro lia como "disco
   *  cinza chapado" (feedback do dono). Determinístico (sem `Math.random`, proibido em `src/`). */
  function desenharMonteDeNeve(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 12, 26, 0.32)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + ry * 0.5, rx * 0.88, ry * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createRadialGradient(cx - rx * 0.15, cy - ry * 0.6, rx * 0.08, cx, cy, rx);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#eaf4ff');
    grad.addColorStop(1, '#bfdcf5');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.18, cy - ry * 0.35, rx * 0.3, ry * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    for (const [fx, fy] of [
      [-0.45, -0.1],
      [0.3, 0.2],
      [0.05, -0.4],
    ] as const) {
      ctx.beginPath();
      ctx.arc(cx + rx * fx, cy + ry * fy, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function desenharPalco(ctx: Ctx, id: string, t: number): void {
    const sprite = sprites.get(id);
    // Pose de destaque (manobra) se existir, senão a "de pé" -- mas a ESCALA sempre pela altura de `ride0` (igual
    // a `render/piloto.ts: ALTURA_ALVO_M`), nunca pela altura da pose atual: `star` tem padding de enquadramento
    // diferente de `ride0`, então escalar por ela faria o personagem "mudar de tamanho" ao trocar de pose/id.
    const quadro = sprite ? (sprite.obterQuadro('star') ?? sprite.obterQuadro('ride0')) : null;
    const referencia = sprite?.obterQuadro('ride0')?.dados ?? quadro?.dados;
    const pulso = 1 + 0.015 * seno((t * 2.2) % 360);

    ctx.save();
    const halo = ctx.createRadialGradient(PALCO_CX, PALCO_BASE_Y - PALCO_ALTURA * 0.4, 8, PALCO_CX, PALCO_BASE_Y - PALCO_ALTURA * 0.4, PALCO_HALO_R);
    halo.addColorStop(0, 'rgba(255, 230, 150, 0.28)');
    halo.addColorStop(1, 'rgba(255, 230, 150, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(PALCO_CX - PALCO_HALO_R, PALCO_BASE_Y - PALCO_ALTURA * 0.4 - PALCO_HALO_R, PALCO_HALO_R * 2, PALCO_HALO_R * 2);
    ctx.restore();

    desenharMonteDeNeve(ctx, PALCO_CX, PALCO_BASE_Y + 4, MONTE_RX, MONTE_RY);

    ctx.save();
    ctx.translate(PALCO_CX, PALCO_BASE_Y);
    ctx.scale(pulso, pulso);
    if (quadro && referencia) {
      const d = quadro.dados;
      const escala = PALCO_ALTURA / referencia.altura;
      const [ancoraX, ancoraY] = d.contato ?? d.pivo;
      ctx.drawImage(quadro.imagem, -ancoraX * escala, -ancoraY * escala, d.largura * escala, d.altura * escala);
    } else {
      ctx.restore();
      desenharEsqueletoPersonagem(ctx, PALCO_CX, PALCO_BASE_Y, PALCO_ALTURA, t);
      ctx.save();
    }
    ctx.restore();
  }

  function desenharPainelInfo(ctx: Ctx, id: string): void {
    const def = obterDefPersonagem(id);
    const nome = def?.nome ?? nomeExibicao(id);
    const assinatura = def?.nomeAssinatura;
    const bordao = def?.bordao;
    const atributos = def?.atributos ?? { velocidade: 100, equilibrio: 100, pulo: 100 };
    const evolucao = opcoes.obterEvolucao?.();
    const nivel = evolucao ? evolucao.niveis[id] ?? 0 : 0;
    const bonus = nivel * PASSO_ATRIBUTO_POR_NIVEL;

    ctx.save();
    ctx.fillStyle = COR_PAINEL;
    caminhoArredondado(ctx, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: PAINEL_H }, 18);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COR_BORDA;
    ctx.stroke();
    ctx.restore();

    desenharTexto(ctx, nome, PAINEL_X + 26, PAINEL_Y + 40, { fonte: 'italic 800 28px "Barlow Condensed", Impact, sans-serif', cor: COR_TEXTO, contorno: 3, corContorno: COR_CONTORNO });

    if (nivel > 0) {
      desenharTexto(ctx, `NÍVEL ${nivel}/${NIVEL_MAXIMO_EVOLUCAO}`, PAINEL_X + PAINEL_W - 24, PAINEL_Y + 32, {
        fonte: '800 13px Barlow, sans-serif',
        cor: COR_DESTAQUE,
        alinhamento: 'right',
      });
    }

    if (assinatura) {
      desenharTexto(ctx, `Manobra: ${assinatura}`, PAINEL_X + 26, PAINEL_Y + 66, { fonte: 'italic 600 16px Barlow, sans-serif', cor: COR_DESTAQUE });
    }
    if (bordao) {
      desenharTexto(ctx, `"${bordao}"`, PAINEL_X + 26, PAINEL_Y + 88, { fonte: 'italic 500 13px Barlow, sans-serif', cor: COR_MUTED });
    }

    desenharBarraAtributo(ctx, PAINEL_X + 26, PAINEL_Y + 118, PAINEL_W - 52, 18, 'Velocidade', atributos.velocidade, bonus);
    desenharBarraAtributo(ctx, PAINEL_X + 26, PAINEL_Y + 152, PAINEL_W - 52, 18, 'Equilíbrio', atributos.equilibrio, bonus);
    desenharBarraAtributo(ctx, PAINEL_X + 26, PAINEL_Y + 186, PAINEL_W - 52, 18, 'Força', atributos.pulo, bonus);

    desenharTexto(ctx, 'Base 90–110 · dourado = bônus de evolução', PAINEL_X + PAINEL_W / 2, PAINEL_Y + PAINEL_H - 18, {
      fonte: '500 12px Barlow, sans-serif',
      cor: COR_MUTED,
      alinhamento: 'center',
    });
  }

  function desenharMiniatura(ctx: Ctx, indice: number, id: string, t: number): void {
    const r = cartao(indice);
    const ativo = opcoes.obterPersonagemAtivo() === id;
    const aoVivo = hover === `card-${indice}`;

    ctx.save();
    ctx.fillStyle = ativo ? 'rgba(29, 58, 92, 0.9)' : COR_PAINEL;
    caminhoArredondado(ctx, r, 12);
    ctx.fill();
    ctx.lineWidth = ativo ? 3 : 2;
    ctx.strokeStyle = ativo ? COR_SELECIONADO : aoVivo ? '#ffffff' : COR_BORDA;
    ctx.stroke();
    ctx.restore();

    const centroX = r.x + r.w / 2;
    const centroY = r.y + 38;
    const sprite = sprites.get(id);
    const quadro = sprite ? (sprite.obterQuadro('ride0') ?? sprite.obterQuadro('star')) : null;

    ctx.save();
    ctx.translate(centroX, centroY);
    if (quadro) {
      const d = quadro.dados;
      const escala = 58 / d.altura;
      const [ancoraX, ancoraY] = d.contato ?? d.pivo;
      ctx.drawImage(quadro.imagem, -ancoraX * escala, -ancoraY * escala, d.largura * escala, d.altura * escala);
    } else {
      ctx.restore();
      desenharEsqueletoPersonagem(ctx, centroX, centroY + 20, 58, t);
      ctx.save();
    }
    ctx.restore();

    desenharTexto(ctx, nomeExibicao(id), centroX, r.y + r.h - 10, {
      fonte: '700 13px Barlow, sans-serif',
      cor: ativo ? COR_SELECIONADO : COR_TEXTO,
      alinhamento: 'center',
    });
  }

  return {
    id: 'selecao',
    atualizar() {
      ticks += 1;
    },
    desenhar(ctx: Ctx, alpha: number) {
      const t = ticks + alpha;
      const assets = assetsMenuCapaProntos();

      if (!fundo && assets && doc) fundo = construirFundoBorrado(doc, assets.capa);
      if (fundo) fundo.desenhar(ctx);
      else {
        ctx.save();
        ctx.fillStyle = COR_FUNDO;
        ctx.fillRect(0, 0, LARGURA, ALTURA);
        ctx.restore();
      }

      desenharFlocos(ctx, 28, t);

      desenharTexto(ctx, 'ESCOLHA SEU PERSONAGEM', LARGURA / 2, 38, {
        fonte: 'italic 800 34px "Barlow Condensed", Impact, sans-serif',
        cor: COR_TEXTO,
        contorno: 6,
        corContorno: COR_CONTORNO,
        alinhamento: 'center',
      });
      desenharTexto(ctx, 'Todos liberados por enquanto — escolha e desça a montanha', LARGURA / 2, 60, {
        fonte: '600 15px Barlow, sans-serif',
        cor: COR_MUTED,
        contorno: 3,
        alinhamento: 'center',
      });

      const ativo = opcoes.obterPersonagemAtivo();
      desenharPalco(ctx, ativo, t);
      desenharPainelInfo(ctx, ativo);

      opcoes.catalogo.forEach((id, indice) => desenharMiniatura(ctx, indice, id, t));

      desenharBotaoBala(ctx, {
        ...BOTAO_VOLTAR,
        texto: 'VOLTAR',
        corTopo: hover === 'voltar' ? '#e85d4a' : '#c0392b',
        corBase: hover === 'voltar' ? '#b03a26' : '#7d241a',
        aoVivo: hover === 'voltar',
      });
      desenharBotaoBala(ctx, {
        ...BOTAO_CORRER,
        texto: 'CORRER!',
        destaque: true,
        corTopo: hover === 'correr' ? '#ffe066' : '#f6c90e',
        corBase: hover === 'correr' ? '#f39c12' : '#d35400',
        aoVivo: hover === 'correr',
      });

      desenharTexto(ctx, 'ESC volta ao menu · ←/→ troca', BOTAO_VOLTAR.x + BOTAO_VOLTAR.w / 2, BOTAO_VOLTAR.y + BOTAO_VOLTAR.h + 16, {
        fonte: '500 12px Barlow, sans-serif',
        cor: COR_MUTED,
        alinhamento: 'center',
      });
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
