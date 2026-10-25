/**
 * Tela de Seleção de Personagem (Canvas 2D), acessível pelo botão PERSONAGEM do Menu (ou automaticamente antes
 * de TREINO/CAMPEONATO -- `[[fluxo-inicio-selecao-personagem-antes-de-correr]]`).
 *
 * Redesenho "premium estilo Pixar" (`docs/direcao-ui-premium.md` §11.1, Fase 2): fundo A (capa fosca) com aurora
 * viva e flocos, palco com pedestal de gelo + personagem em `celeb` (altura 150, teto do guia §1.7) com aro de
 * luz, painel Geada com nome/manobra/bordão (balão de fala) e as 3 barras de atributo (ícones de item
 * reaproveitados como ícones de atributo: `turbo`=Velocidade, `escudo`=Equilíbrio, `bola`=Força -- decisão do
 * dono, 2026-10-24, evita gastar os 2 créditos de geração de imagem que restam), fileira de 6 cartões com
 * RETRATO RECORTADO DA CAPA (`kit-premium.ts: desenharRetratoDaCapa`, §6.2) em vez do sprite pequeno (zero
 * placeholder feio, cartão sempre nítido mesmo antes do sprite chegar), VOLTAR redondo no canto e CTA CORRER!.
 *
 * Textos de desenvolvedor removidos (feedback do dono): nada de "Todos liberados por enquanto" nem "Base
 * 90-110" -- ver memória `selecao-personagem-catalogo-inteiro-vs-desbloqueados` pro porquê de ainda oferecer o
 * catálogo inteiro (gating de desbloqueio é M3-futuro).
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { Evolucao } from '../../core/contratos';
import { seno } from '../../core/trig';
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import { assetsItensProntos, precarregarAssetsItens } from '../../assets/itens';
import { imagemPalcoHDPronta, precarregarImagemPalcoHD } from '../../assets/palco-hd';
import { NIVEL_MAXIMO_EVOLUCAO, PASSO_ATRIBUTO_POR_NIVEL } from '../../data/evolucao';
import { PERSONAGENS_DE_DADOS } from '../../data/personagens';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { dispositivoTemToque, easeOutBack, escalonar, msParaTicks, overshootPadrao, poseEntrada, prefereMovimentoReduzido } from '../animacao';
import { caminhoArredondado, desenharFlocos, desenharTexto, type CamadaEstatica } from '../desenho';
import { criarEstadoPressao, eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import {
  barraAtributo,
  botao3D,
  botaoRedondoVoltar,
  construirFundoFosco,
  desenharLetreiro,
  desenharRetratoDaCapa,
  dicaTeclado,
  medalhao,
  painelGeada,
  pedestalDeGelo,
  recorteRetratoDisponivel,
  type AtributoPersonagem,
} from '../kit-premium';
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
const COR_TEXTO = '#f4f9ff';
const COR_SOL = '#FFD23F';
const COR_MUTED = '#aed0ef';

const PAINEL_X = 412;
const PAINEL_Y = 84;
const PAINEL_W = 516;
const PAINEL_H = 234;

const PALCO_CX = 212;
const PALCO_ALTURA = 150; // teto do guia §1.7: nenhum sprite fora da corrida passa de 150 lógicos
// Pés do personagem = BORDA DA FRENTE do pedestal (não o centro da elipse -- feedback do dono, playtest iPhone:
// com os pés no centro, o disco "cortava o corpo"). `PEDESTAL_TOPO_CY` é o centro da elipse de cima;
// `PALCO_PES_Y = PEDESTAL_TOPO_CY + PEDESTAL_RY` é a borda de baixo dela, onde a perspectiva "top-down" coloca
// quem está de pé em cima (ver `kit-premium.ts: pedestalDeGelo`).
const PEDESTAL_RX = 108;
const PEDESTAL_RY = 20;
const PEDESTAL_FAIXA_H = 20;
const PALCO_PES_Y = 358;
const PEDESTAL_TOPO_CY = PALCO_PES_Y - PEDESTAL_RY;
const PALCO_HALO_R = 150;

// Folga de verdade acima da fita de cartões (ver memória `selecao-palco-clipping-pela-fita-de-miniaturas`): o
// pedestal termina em ~y400 (358 + 14 + 10 + sombra), a fita começa em 416 -- ~16px de clearance real.
const MINI_Y = 416;
const MINI_W = 136;
const MINI_H = 108;
const MINI_GAP = 12;
const MINI_X0 = 42;

const BOTAO_VOLTAR: BotaoRetangular = { id: 'voltar', x: 32, y: 20, w: 56, h: 56 };
// y 344 (não 334): o painel acima termina em 318 e sua sombra suave alcança +14 (ver kit-premium.ts) -- precisa
// de folga de verdade pra tampa de neve do botão (§4.2) não "encostar" no painel (feedback do dono, playtest
// iPhone). Altura 60 (não 64) pra sobrar 12px antes da fita de cartões em y416.
const BOTAO_CORRER: BotaoRetangular = { id: 'correr', x: 570, y: 344, w: 300, h: 60 };

// Entrada escalonada (§8.1/§11.1 "título (0) → palco e pedestal (120) → painel (240) → cartões ... → CTA (700)"):
// tempos de início por grupo, em ticks (`msParaTicks`), e duração/passo de cada um (§8.3).
const T_ENTRADA_TITULO = 0;
const T_ENTRADA_PALCO = msParaTicks(120);
const T_ENTRADA_PAINEL = msParaTicks(240);
const T_ENTRADA_CARTOES = msParaTicks(280);
const T_ENTRADA_CTA = msParaTicks(700);
const PASSO_ENTRADA_CARTAO = msParaTicks(70);
const DUR_ENTRADA_GRUPO = msParaTicks(360);
const DUR_ENTRADA_CARTAO = msParaTicks(420);

const LINHA_ATRIBUTOS: readonly { readonly atributo: AtributoPersonagem; readonly icone: 'turbo' | 'escudo' | 'bola'; readonly rotulo: string; readonly y: number }[] = [
  // 246/274/302 (eram 236/266/296): o balão do bordão (178..~219) encobria o medalhão de Velocidade no iPhone do
  // dono. Medalhão raio 14 -> 1ª linha começa em 232 e a última termina em 316, dentro do painel (até 318).
  { atributo: 'velocidade', icone: 'turbo', rotulo: 'Velocidade', y: 246 },
  { atributo: 'equilibrio', icone: 'escudo', rotulo: 'Equilíbrio', y: 274 },
  { atributo: 'forca', icone: 'bola', rotulo: 'Força', y: 302 },
];
const FAIXA_ATRIBUTO = 35; // 90..125 (base 90-110 de ficha + até +15 de bônus no nível 5)
const BARRA_X = 600;
const BARRA_W = 300;
const BARRA_H = 16;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function cartao(indice: number): BotaoRetangular {
  return { id: `card-${indice}`, x: MINI_X0 + indice * (MINI_W + MINI_GAP), y: MINI_Y, w: MINI_W, h: MINI_H };
}

/** Floco vetorial simples (6 raios), nunca emoji de texto (muda de cara por sistema) -- usado só no esqueleto de
 *  carregamento, quando o sprite daquele id ainda não chegou. */
function desenharFlocoVetor(ctx: Ctx, cx: number, cy: number, r: number, alpha: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = `rgba(244, 249, 255, ${alpha})`;
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i += 1) {
    ctx.save();
    ctx.rotate((Math.PI / 3) * i);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r);
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(-r * 0.22, -r * 0.75);
    ctx.moveTo(0, -r * 0.55);
    ctx.lineTo(r * 0.22, -r * 0.75);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

/** Fallback NUNCA é a cápsula marrom antiga: esqueleto translúcido na paleta do jogo + floco vetorial, enquanto o
 *  sprite daquele id não chegou. */
function desenharEsqueletoPersonagem(ctx: Ctx, cx: number, baseY: number, altura: number, t: number): void {
  const pulso = 0.5 + 0.5 * Math.max(0, seno((t * 3) % 360));
  ctx.save();
  ctx.fillStyle = `rgba(143, 182, 224, ${0.16 + 0.1 * pulso})`;
  ctx.beginPath();
  ctx.ellipse(cx, baseY - altura * 0.44, altura * 0.3, altura * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  desenharFlocoVetor(ctx, cx, baseY - altura * 0.44, altura * 0.16, 0.55 + 0.25 * pulso);
  ctx.restore();
}

const PAD_X_BALAO = 20;
const PAD_Y_BALAO = 10;

/** Balão de fala (bordão): a CAIXA se ajusta ao texto (largura real + altura de 1 ou 2 linhas), nunca o
 *  contrário -- antes a caixa era fixa (256x32) e um bordão mais longo (ex. Tio Beto: "Frio? Isso aí é
 *  ar-condicionado!") desenhava o texto PRA FORA do balão branco (feedback do dono, playtest iPhone: "balão
 *  cortado"). Tenta 1 linha reduzindo a fonte até `tamanhoMinimo`; só quebra em 2 linhas se nem assim couber
 *  dentro de `larguraMax` -- com `larguraMax` generoso (painel inteiro, não um terço dele), os 6 bordões do
 *  catálogo cabem numa linha só. `x,y` = topo-esquerda onde o balão COMEÇA (alinhado à esquerda, não centralizado
 *  -- a largura real varia por bordão). Devolve a altura de verdade usada, pra quem chama nunca sobrepor o que
 *  vem depois. */
function desenharBalaoDeFala(ctx: Ctx, texto: string, x: number, y: number, larguraMax: number): number {
  const palavras = texto.split(' ');
  let tamanho = 19;
  let linhas: string[] = [texto];
  const larguraUtil = larguraMax - PAD_X_BALAO * 2;

  for (; tamanho >= 15; tamanho -= 1) {
    ctx.font = `400 ${tamanho}px Bangers, sans-serif`;
    if (ctx.measureText(texto).width <= larguraUtil) {
      linhas = [texto];
      break;
    }
    // tenta quebrar em 2 linhas pela palavra mais próxima da metade (só chega aqui se nem o menor tamanho de
    // 1 linha coube -- com `larguraMax` do painel inteiro, nenhum bordão do catálogo cai neste caminho hoje).
    let melhorCorte = -1;
    let melhorDist = Infinity;
    let acumulado = 0;
    for (let i = 0; i < palavras.length - 1; i += 1) {
      acumulado += (palavras[i]?.length ?? 0) + 1;
      const dist = Math.abs(acumulado - texto.length / 2);
      if (dist < melhorDist) {
        melhorDist = dist;
        melhorCorte = i + 1;
      }
    }
    if (melhorCorte > 0) {
      const l1 = palavras.slice(0, melhorCorte).join(' ');
      const l2 = palavras.slice(melhorCorte).join(' ');
      if (ctx.measureText(l1).width <= larguraUtil && ctx.measureText(l2).width <= larguraUtil) {
        linhas = [l1, l2];
        break;
      }
    }
  }

  ctx.font = `400 ${tamanho}px Bangers, sans-serif`;
  const larguraTexto = Math.max(...linhas.map((l) => ctx.measureText(l).width));
  const w = Math.min(larguraMax, larguraTexto + PAD_X_BALAO * 2);
  const alturaLinha = tamanho * 1.1;
  const h = alturaLinha * linhas.length + PAD_Y_BALAO * 2;
  const caixa = { x, y, w, h };

  ctx.save();
  caminhoArredondado(ctx, caixa, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0B1630';
  ctx.stroke();

  // rabicho na lateral esquerda, apontando para o palco — antes descia por baixo do balão e cobria a 1ª linha de
  // atributos (playtest iPhone do dono).
  const meio = caixa.y + caixa.h / 2;
  ctx.beginPath();
  ctx.moveTo(caixa.x + 2, meio - 8);
  ctx.lineTo(caixa.x - 14, meio + 3);
  ctx.lineTo(caixa.x + 2, meio + 8);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(caixa.x + 1, meio - 9);
  ctx.lineTo(caixa.x - 14, meio + 3);
  ctx.lineTo(caixa.x + 1, meio + 9);
  ctx.strokeStyle = '#0B1630';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#0B1630';
  const cx = caixa.x + caixa.w / 2;
  const cy = caixa.y + caixa.h / 2;
  if (linhas.length === 1) {
    ctx.fillText(linhas[0] ?? '', cx, cy);
  } else {
    ctx.fillText(linhas[0] ?? '', cx, cy - alturaLinha * 0.5);
    ctx.fillText(linhas[1] ?? '', cx, cy + alturaLinha * 0.5);
  }
  ctx.restore();

  return h;
}

/** Fundo = `capa.webp` borrada (§3.1, UMA vez, offscreen) + véu + vinheta -- nunca refeita por quadro. */
function construirFundoTela(doc: Document, img: HTMLImageElement): CamadaEstatica {
  return construirFundoFosco(doc, img, { reducao: 16, veuTopo: 0.3, veuBase: 0.55 });
}

export function criarCenaSelecao(opcoes: OpcoesCenaSelecao): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  const reduzido = prefereMovimentoReduzido();
  const temToque = dispositivoTemToque();
  let hover: string | null = null;
  let ticks = 0;
  let fundo: CamadaEstatica | null = null;
  const pressao = criarEstadoPressao();

  // Defensivo: se esta tela abrir sem ter passado por abertura/menu (ex. teste direto), garante o fire-and-forget
  // mesmo assim -- cacheado, não duplica o carregamento se já estava em andamento.
  void precarregarAssetsMenuCapa();
  void precarregarAssetsItens();

  // Sprites: melhor esforço, cacheado por id (`assets/index.ts`) -- se abertura/menu já chamaram, o `.then()`
  // roda como microtask antes do 1º quadro desta cena (zero placeholder na prática).
  const sprites = new Map<string, SpritePersonagem>();
  for (const id of opcoes.catalogo) {
    // Arte HD do palco (`assets/palco-hd.ts`): a MESMA pose/enquadramento do recorte de produção, só que a
    // ~2,85x a resolução (feedback do dono: "personagem grande e nítido" -- os recortes de produção têm só
    // ~175-210px, perto do teto de ampliação do guia; a HD evita o borrão). Pré-carrega as 6 de uma vez (são
    // só 2 poses por personagem, ~400KB cada par) pra trocar de personagem na seleção nunca mostrar a versão
    // mole primeiro.
    precarregarImagemPalcoHD(id, 'celeb');
    precarregarImagemPalcoHD(id, 'ride0');
    void carregarSpritePersonagem(id)
      .then((s) => {
        sprites.set(id, s);
      })
      .catch(() => {
        // fallback silencioso: o esqueleto translúcido cobre enquanto não chega
      });
  }

  // Animação das barras ao trocar de personagem (§11.1: "comparar fica divertido"): guarda o valor de ONDE a
  // barra partiu (o personagem anterior) e o tick em que a troca começou -- só usado pra interpolar por 300ms.
  let idAnterior = opcoes.obterPersonagemAtivo();
  let deBonus = 0;
  let deValores: Readonly<Record<AtributoPersonagem, number>> = lerFicha(idAnterior);
  let inicioTransicaoBarras = -1000;
  const DURACAO_BARRAS = 18; // 300ms a 60Hz

  function lerFicha(id: string): Readonly<Record<AtributoPersonagem, number>> {
    const def = obterDefPersonagem(id);
    const a = def?.atributos ?? { velocidade: 100, equilibrio: 100, pulo: 100 };
    return { velocidade: a.velocidade, equilibrio: a.equilibrio, forca: a.pulo };
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
      pressao.marcar('correr', ticks);
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

  function desenharPalco(ctx: Ctx, id: string, t: number): void {
    const sprite = sprites.get(id);
    // Pose de destaque (manobra) se existir, senão a "de pé" -- mas a ESCALA sempre pela altura de `ride0` (igual
    // a `render/piloto.ts: ALTURA_ALVO_M`), nunca pela altura da pose atual (memória `escala-sprite-por-pose...`).
    // `celeb` (comemorando, em pé), não `star`: nos 6 personagens `star` é pose `tipo:'ar'`, sem ponto de contato
    // de verdade com o chão (ver `assets/palco-hd.ts`) -- ancorar nela faz o personagem flutuar longe do
    // pedestal (feedback do dono, playtest iPhone: "o personagem não fica EM CIMA do palco").
    const poseEscolhida: 'celeb' | 'ride0' = sprite?.obterQuadro('celeb') ? 'celeb' : 'ride0';
    const quadro = sprite ? (sprite.obterQuadro(poseEscolhida) ?? sprite.obterQuadro('ride0')) : null;
    const referenciaProd = sprite?.obterQuadro('ride0')?.dados ?? quadro?.dados;
    const pulso = reduzido ? 1 : 1 + 0.015 * seno((t * 2.2) % 360);

    ctx.save();
    const halo = ctx.createRadialGradient(PALCO_CX, PALCO_PES_Y - PALCO_ALTURA * 0.4, 8, PALCO_CX, PALCO_PES_Y - PALCO_ALTURA * 0.4, PALCO_HALO_R);
    halo.addColorStop(0, 'rgba(159, 227, 255, 0.22)');
    halo.addColorStop(1, 'rgba(159, 227, 255, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(PALCO_CX - PALCO_HALO_R, PALCO_PES_Y - PALCO_ALTURA * 0.4 - PALCO_HALO_R, PALCO_HALO_R * 2, PALCO_HALO_R * 2);
    ctx.restore();

    pedestalDeGelo(ctx, PALCO_CX, PEDESTAL_TOPO_CY, PEDESTAL_RX, PEDESTAL_RY, PEDESTAL_FAIXA_H);

    // Sombra de contato dos pés (§7.1): separada da sombra ambiente do pedestal -- um traço elíptico escuro bem
    // junto da base, que "gruda" o personagem na superfície (sem ela ele lê como colado por cima, flutuando).
    ctx.save();
    ctx.fillStyle = 'rgba(4, 12, 26, 0.38)';
    ctx.beginPath();
    ctx.ellipse(PALCO_CX, PALCO_PES_Y + 3, PALCO_ALTURA * 0.22, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Arte HD (§7, feedback do dono "nítido"): mesma pose/enquadramento do recorte de produção, ~2,85x a
    // resolução -- a âncora (ponto de contato) é a MESMA FRAÇÃO do recorte de produção (`contato/tamanho`),
    // porque o enquadramento é idêntico entre as duas versões (só muda a escala). Ver `assets/palco-hd.ts`.
    const hd = imagemPalcoHDPronta(id, poseEscolhida);
    const hdRef = imagemPalcoHDPronta(id, 'ride0');
    const dProd = quadro?.dados;

    ctx.save();
    ctx.translate(PALCO_CX, PALCO_PES_Y);
    ctx.scale(pulso, pulso);
    if (hd && hdRef && dProd) {
      const [ax, ay] = dProd.contato ?? dProd.pivo;
      const fracX = ax / dProd.largura;
      const fracY = ay / dProd.altura;
      const escala = PALCO_ALTURA / hdRef.altura;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(hd.imagem, -fracX * hd.largura * escala, -fracY * hd.altura * escala, hd.largura * escala, hd.altura * escala);
    } else if (quadro && referenciaProd) {
      const d = quadro.dados;
      const escala = PALCO_ALTURA / referenciaProd.altura;
      const [ancoraX, ancoraY] = d.contato ?? d.pivo;
      ctx.drawImage(quadro.imagem, -ancoraX * escala, -ancoraY * escala, d.largura * escala, d.altura * escala);
    } else {
      ctx.restore();
      desenharEsqueletoPersonagem(ctx, PALCO_CX, PALCO_PES_Y, PALCO_ALTURA, t);
      ctx.save();
    }
    ctx.restore();
  }

  function desenharPainelInfo(ctx: Ctx, id: string, t: number): void {
    const def = obterDefPersonagem(id);
    const nome = def?.nome ?? nomeExibicao(id);
    const assinatura = def?.nomeAssinatura;
    const bordao = def?.bordao;
    const evolucao = opcoes.obterEvolucao?.();
    const nivel = evolucao ? evolucao.niveis[id] ?? 0 : 0;
    const bonus = nivel * PASSO_ATRIBUTO_POR_NIVEL;
    const para = lerFicha(id);

    if (doc) painelGeada(ctx, doc, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: PAINEL_H });
    else {
      ctx.save();
      ctx.fillStyle = 'rgba(12, 27, 48, 0.82)';
      caminhoArredondado(ctx, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: PAINEL_H }, 18);
      ctx.fill();
      ctx.restore();
    }

    desenharTexto(ctx, nome, PAINEL_X + 32, 136, { fonte: 'italic 800 40px "Barlow Condensed", Impact, sans-serif', cor: COR_TEXTO, contorno: 5 });

    if (nivel > 0) {
      desenharTexto(ctx, `NÍVEL ${nivel}/${NIVEL_MAXIMO_EVOLUCAO}`, PAINEL_X + PAINEL_W - 26, PAINEL_Y + 28, {
        fonte: '800 14px Barlow, sans-serif',
        cor: COR_SOL,
        alinhamento: 'right',
      });
    }

    if (assinatura) {
      desenharTexto(ctx, `Manobra: ${assinatura}`, PAINEL_X + 32, 166, { fonte: 'italic 600 18px Barlow, sans-serif', cor: COR_SOL });
    }
    if (bordao) {
      desenharBalaoDeFala(ctx, bordao, PAINEL_X + 32, 178, PAINEL_W - 64);
    }

    // Progresso [0,1] da transição de barras (300ms, easeOutBack): 0 = ainda no valor antigo, 1 = já no novo.
    const p = Math.min(1, (t - inicioTransicaoBarras) / DURACAO_BARRAS);
    const curva = easeOutBack(overshootPadrao(reduzido, 1.7));
    const prog = p >= 1 ? 1 : curva(Math.max(0, p));

    for (const linha of LINHA_ATRIBUTOS) {
      const valorDe = deValores[linha.atributo];
      const valorPara = para[linha.atributo];
      const valorAtual = valorDe + (valorPara - valorDe) * prog;
      const bonusAtual = deBonus + (bonus - deBonus) * prog;
      const fracaoBase = clamp01((valorAtual - 90) / FAIXA_ATRIBUTO);
      const fracaoBonus = clamp01(bonusAtual / FAIXA_ATRIBUTO);

      medalhao(ctx, PAINEL_X + 44, linha.y, 28, 'vidro', (ictx, raio) => {
        const icones = assetsItensProntos();
        const img = icones?.[linha.icone];
        if (img) ictx.drawImage(img, -raio * 0.68, -raio * 0.68, raio * 1.36, raio * 1.36);
      });
      desenharTexto(ctx, linha.rotulo, PAINEL_X + 72, linha.y + 1, { fonte: '600 17px Barlow, sans-serif', cor: COR_TEXTO, base: 'middle' });
      barraAtributo(ctx, BARRA_X, linha.y - BARRA_H / 2, BARRA_W, BARRA_H, linha.atributo, fracaoBase, fracaoBonus);
    }

    // Legenda do bônus de evolução: só quando HÁ bônus, logo abaixo do selo de nível (antes ficava sempre no canto
    // de baixo, por cima da ponta da barra de Força).
    if (nivel > 0) {
      ctx.save();
      ctx.fillStyle = COR_SOL;
      ctx.fillRect(PAINEL_X + PAINEL_W - 98, PAINEL_Y + 38, 14, 10);
      ctx.restore();
      desenharTexto(ctx, 'evolução', PAINEL_X + PAINEL_W - 80, PAINEL_Y + 47, { fonte: '600 14px Barlow, sans-serif', cor: COR_MUTED });
    }
  }

  function desenharCartao(ctx: Ctx, indice: number, id: string, t: number): void {
    const r = cartao(indice);
    const ativo = opcoes.obterPersonagemAtivo() === id;
    const aoVivo = hover === `card-${indice}`;
    const elevacao = ativo ? -10 : aoVivo ? -4 : 0;
    const escala = ativo ? 1.06 : 1;

    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2 + elevacao);
    ctx.scale(escala, escala);
    ctx.translate(-r.w / 2, -r.h / 2);

    const assets = assetsMenuCapaProntos();
    if (assets && recorteRetratoDisponivel(id)) {
      desenharRetratoDaCapa(ctx, assets.capa, id, { x: 0, y: 0, w: r.w, h: r.h }, { raio: 16 });
    } else {
      ctx.fillStyle = 'rgba(12, 27, 48, 0.85)';
      caminhoArredondado(ctx, { x: 0, y: 0, w: r.w, h: r.h }, 16);
      ctx.fill();
      desenharEsqueletoPersonagem(ctx, r.w / 2, r.h - 16, 58, t);
    }

    // faixa do nome
    const faixa = ctx.createLinearGradient(0, r.h - 34, 0, r.h);
    faixa.addColorStop(0, 'rgba(6, 14, 36, 0)');
    faixa.addColorStop(1, 'rgba(6, 14, 36, 0.85)');
    ctx.save();
    caminhoArredondado(ctx, { x: 0, y: 0, w: r.w, h: r.h }, 16);
    ctx.clip();
    ctx.fillStyle = faixa;
    ctx.fillRect(0, r.h - 34, r.w, 34);
    ctx.restore();

    ctx.lineWidth = ativo ? 3 : 2;
    ctx.strokeStyle = ativo ? COR_SOL : aoVivo ? '#ffffff' : 'rgba(255,255,255,0.25)';
    caminhoArredondado(ctx, { x: 0, y: 0, w: r.w, h: r.h }, 16);
    ctx.stroke();

    desenharTexto(ctx, nomeExibicao(id), r.w / 2, r.h - 10, {
      fonte: 'italic 800 18px "Barlow Condensed", Impact, sans-serif',
      cor: ativo ? COR_SOL : '#ffffff',
      alinhamento: 'center',
    });

    if (!ativo) {
      ctx.globalAlpha = 0.15;
      ctx.fillStyle = '#000000';
      caminhoArredondado(ctx, { x: 0, y: 0, w: r.w, h: r.h }, 16);
      ctx.fill();
    }

    ctx.restore();
  }

  return {
    id: 'selecao',
    atualizar() {
      ticks += 1;
    },
    desenhar(ctx: Ctx, alpha: number) {
      const t = ticks + alpha;
      const assets = assetsMenuCapaProntos();

      if (!fundo && assets && doc) fundo = construirFundoTela(doc, assets.capa);
      if (fundo) fundo.desenhar(ctx);
      else {
        ctx.save();
        ctx.fillStyle = COR_FUNDO;
        ctx.fillRect(0, 0, LARGURA, ALTURA);
        ctx.restore();
      }

      desenharFlocos(ctx, 22, t, 0.7);

      const poseTitulo = poseEntrada(t, T_ENTRADA_TITULO, DUR_ENTRADA_GRUPO, reduzido, 18);
      ctx.save();
      ctx.globalAlpha = poseTitulo.opacidade;
      ctx.translate(0, poseTitulo.deslocaY);
      if (doc) desenharLetreiro(ctx, doc, 'ESCOLHA SEU PERSONAGEM', LARGURA / 2, 66, 40, 'gelo');
      else desenharTexto(ctx, 'ESCOLHA SEU PERSONAGEM', LARGURA / 2, 66, { fonte: 'italic 800 40px "Barlow Condensed", Impact, sans-serif', cor: COR_TEXTO, contorno: 6, alinhamento: 'center' });
      ctx.restore();

      const ativo = opcoes.obterPersonagemAtivo();
      if (ativo !== idAnterior) {
        deValores = lerFicha(idAnterior);
        deBonus = (() => {
          const evolucao = opcoes.obterEvolucao?.();
          const nivelAnterior = evolucao ? evolucao.niveis[idAnterior] ?? 0 : 0;
          return nivelAnterior * PASSO_ATRIBUTO_POR_NIVEL;
        })();
        inicioTransicaoBarras = t;
        idAnterior = ativo;
      }

      const posePalco = poseEntrada(t, T_ENTRADA_PALCO, DUR_ENTRADA_GRUPO, reduzido, 28);
      ctx.save();
      ctx.globalAlpha = posePalco.opacidade;
      ctx.translate(0, posePalco.deslocaY);
      desenharPalco(ctx, ativo, t);
      ctx.restore();

      const posePainel = poseEntrada(t, T_ENTRADA_PAINEL, DUR_ENTRADA_GRUPO, reduzido, 24);
      ctx.save();
      ctx.globalAlpha = posePainel.opacidade;
      ctx.translate(0, posePainel.deslocaY);
      desenharPainelInfo(ctx, ativo, t);
      ctx.restore();

      // Cartões "sendo dados" (§8.5/§11.1): escalonados, de baixo, com uma leve rotação que desaparece ao assentar.
      opcoes.catalogo.forEach((id, indice) => {
        const t0 = T_ENTRADA_CARTOES + escalonar(indice, PASSO_ENTRADA_CARTAO);
        const pose = poseEntrada(t, t0, DUR_ENTRADA_CARTAO, reduzido, 70);
        const r = cartao(indice);
        const pivoX = r.x + r.w / 2;
        const pivoY = r.y + r.h / 2;
        ctx.save();
        ctx.globalAlpha = pose.opacidade;
        ctx.translate(pivoX, pivoY + pose.deslocaY);
        ctx.rotate((((indice % 2 === 0 ? 1 : -1) * 6 * Math.PI) / 180) * (1 - pose.curva));
        ctx.translate(-pivoX, -pivoY);
        desenharCartao(ctx, indice, id, t);
        ctx.restore();
      });

      botaoRedondoVoltar(ctx, BOTAO_VOLTAR.x + BOTAO_VOLTAR.w / 2, BOTAO_VOLTAR.y + BOTAO_VOLTAR.h / 2, BOTAO_VOLTAR.w / 2, hover === 'voltar');

      const poseCTA = poseEntrada(t, T_ENTRADA_CTA, DUR_ENTRADA_GRUPO, reduzido, 20);
      ctx.save();
      ctx.globalAlpha = poseCTA.opacidade;
      ctx.translate(0, poseCTA.deslocaY);
      const poseCorrer = pressao.pose('correr', ticks);
      botao3D(ctx, { ...BOTAO_CORRER, texto: 'CORRER!', tipo: 'primario', destaque: true, aoVivo: hover === 'correr', t, pressionado: poseCorrer.pressionado, escalaExtra: poseCorrer.escalaExtra });
      ctx.restore();

      // Dica de teclado no padrão comum do guia (§11, "pílulas pequenas de vidro no canto superior direito") --
      // acabamento, 2026-10-24: o texto solto embaixo do CTA encostava na fita de cartões (só 18px de folga total
      // entre o botão e a fita); a pílula no canto nunca disputa espaço vertical com o resto do layout.
      if (!temToque) dicaTeclado(ctx, 'ESC volta · ←/→ troca', 928, 34);
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
