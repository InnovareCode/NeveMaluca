/**
 * Kit de componentes "premium estilo Pixar" (`docs/direcao-ui-premium.md`), para toda tela fora da corrida.
 *
 * Regras herdadas de `ui/desenho.ts` (não repetidas, só reforçadas aqui porque são fáceis de violar num
 * componente novo):
 *  - nunca `ctx.filter`/`shadowBlur` no caminho por quadro -- desfoque é feito reduzindo e ampliando a imagem
 *    (§3.1 do guia), sombra é gradiente/fill, não blur;
 *  - sem `ctx.roundRect` (falta em WebKit antigo) -- usa `caminhoArredondado`, de `ui/desenho.ts`;
 *  - sem `Math.random` -- qualquer variação (gotas da tampa de neve, etc.) vem de hash determinístico do índice.
 *
 * Peças CARAS (fundo borrado, Painel Geada, letreiro) são desenhadas UMA vez num canvas fora da tela e cacheadas
 * -- o custo por quadro é só o `drawImage`. Peças BARATAS (botão 3D, medalhão, retrato) são desenhadas direto
 * todo quadro (dão estado/animação, não compensa cachear).
 */
import { ALTURA, LARGURA } from '../core/constantes';
import { ALTURA_BUFFER, LARGURA_BUFFER, RS } from '../platform/constantes';
import type { Ctx } from '../platform/canvas';
import { caminhoArredondado, criarCamadaEstatica, type CamadaEstatica, type Retangulo } from './desenho';

const COR_TINTA = '#0B1630';

// ---------------------------------------------------------------------------------------------------------------
// 1. Fundos foscos (§3)
// ---------------------------------------------------------------------------------------------------------------

export interface OpcoesFundoFosco {
  /** Fator de redução antes de ampliar de volta -- é o "desfoque sem `ctx.filter`" (§3, nota 3). Maior = mais borrado. */
  readonly reducao?: number;
  readonly veuTopo?: number;
  readonly veuBase?: number;
  readonly vinheta?: boolean;
  /** 1,08 por padrão (igual ao `selecao.ts` de hoje): cobre a tela com uma pequena sobra pra não deixar borda viva. */
  readonly zoom?: number;
}

/** Largura/altura "naturais" de uma fonte de imagem para o Canvas -- `HTMLImageElement` tem `naturalWidth/Height`,
 *  `HTMLCanvasElement` tem `width/height` direto (ex.: um quadro da `Parallax` renderizado offscreen, usado pelo
 *  Fundo B de `selecao-pista.ts`). */
function dimensoesDeFonte(fonte: HTMLImageElement | HTMLCanvasElement): { readonly w: number; readonly h: number } {
  const comoImagem = fonte as Partial<HTMLImageElement>;
  if (typeof comoImagem.naturalWidth === 'number') return { w: comoImagem.naturalWidth, h: comoImagem.naturalHeight ?? 0 };
  return { w: fonte.width, h: fonte.height };
}

/** Fundo A/B (§3.1/§3.2): reduz `fonte` bem pequena (canvas auxiliar) e amplia de volta com suavização -- o
 *  desfoque por redução+ampliação do guia, que funciona em qualquer motor (ao contrário de `ctx.filter`, que
 *  o WebKit do iPhone não garante). Desenhado uma vez, devolvido como `CamadaEstatica` (só `drawImage` depois).
 *  `fonte` aceita uma imagem estática (capa) OU um canvas já desenhado (um quadro de cenário renderizado). */
export function construirFundoFosco(doc: Document, fonte: HTMLImageElement | HTMLCanvasElement, opcoes: OpcoesFundoFosco = {}): CamadaEstatica {
  const reducao = Math.max(1, opcoes.reducao ?? 16);
  const veuTopo = opcoes.veuTopo ?? 0.3;
  const veuBase = opcoes.veuBase ?? 0.55;
  const zoom = opcoes.zoom ?? 1.08;
  const { w: largFonte, h: altFonte } = dimensoesDeFonte(fonte);

  // Passo 1: a imagem/cenário cobrindo 960x540 em resolução normal (fonte para o passo de redução).
  const cheio = doc.createElement('canvas');
  cheio.width = LARGURA;
  cheio.height = ALTURA;
  const ctxCheio = cheio.getContext('2d');
  if (!ctxCheio) throw new Error('Canvas 2D indisponível neste navegador');
  const escala = Math.max(LARGURA / largFonte, ALTURA / altFonte) * zoom;
  const w = largFonte * escala;
  const h = altFonte * escala;
  ctxCheio.drawImage(fonte, (LARGURA - w) / 2, (ALTURA - h) / 2, w, h);

  // Passo 2: reduz bem pequena -- É o desfoque (quanto menor, mais borrado ao ampliar de volta).
  const pequena = doc.createElement('canvas');
  pequena.width = Math.max(1, Math.round(LARGURA / reducao));
  pequena.height = Math.max(1, Math.round(ALTURA / reducao));
  const ctxPequena = pequena.getContext('2d');
  if (!ctxPequena) throw new Error('Canvas 2D indisponível neste navegador');
  ctxPequena.imageSmoothingEnabled = true;
  ctxPequena.imageSmoothingQuality = 'high';
  ctxPequena.drawImage(cheio, 0, 0, pequena.width, pequena.height);

  return criarCamadaEstatica(doc, (ctx) => {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pequena, 0, 0, LARGURA, ALTURA);
    ctx.restore();

    const veu = ctx.createLinearGradient(0, 0, 0, ALTURA);
    veu.addColorStop(0, `rgba(6, 14, 36, ${veuTopo})`);
    veu.addColorStop(1, `rgba(6, 14, 36, ${veuBase})`);
    ctx.fillStyle = veu;
    ctx.fillRect(0, 0, LARGURA, ALTURA);

    if (opcoes.vinheta !== false) {
      const vinheta = ctx.createRadialGradient(480, 270, 200, 480, 270, 620);
      vinheta.addColorStop(0, 'rgba(6, 14, 36, 0)');
      vinheta.addColorStop(1, 'rgba(6, 14, 36, 0.55)');
      ctx.fillStyle = vinheta;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
    }
  });
}

/** Fundo C (§3.3, pausa): copia o canvas da PRÓPRIA corrida (já desenhado neste quadro) e aplica a mesma receita
 *  de desfoque -- "a corrida congelada e borrada atrás do painel". Chamar UMA vez, ao abrir a pausa (a corrida
 *  por baixo não se move enquanto pausada). `origem` é o buffer 1920x1080 real (`RS` já aplicado). */
export function construirFundoCongelado(doc: Document, origem: HTMLCanvasElement, veu = 0.45): CamadaEstatica {
  const pequena = doc.createElement('canvas');
  pequena.width = Math.max(1, Math.round(LARGURA_BUFFER / 10));
  pequena.height = Math.max(1, Math.round(ALTURA_BUFFER / 10));
  const ctxPequena = pequena.getContext('2d');
  if (!ctxPequena) throw new Error('Canvas 2D indisponível neste navegador');
  ctxPequena.imageSmoothingEnabled = true;
  ctxPequena.imageSmoothingQuality = 'high';
  ctxPequena.drawImage(origem, 0, 0, pequena.width, pequena.height);

  return criarCamadaEstatica(doc, (ctx) => {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(pequena, 0, 0, LARGURA, ALTURA);
    ctx.restore();
    ctx.fillStyle = `rgba(5, 12, 26, ${veu})`;
    ctx.fillRect(0, 0, LARGURA, ALTURA);
  });
}

// ---------------------------------------------------------------------------------------------------------------
// 2. Tampa de neve (§4.2) -- a assinatura visual, em cima de painéis e botões primários
// ---------------------------------------------------------------------------------------------------------------

function hash01(i: number): number {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

/** Tampa de neve escorrendo (§4.2): monte fofo de arcos em cima + gotas/pingentes na base. `escala` 1 = painel
 *  grande (gotas a cada ~40px, base em y+10); `escala` menor (ex. 0,4) = versão pequena de botão (base em y+6). */
export function desenharTampaDeNeve(ctx: Ctx, x: number, y: number, w: number, escala = 1): void {
  const saliencia = 4 * escala;
  const x0 = x - saliencia;
  const x1 = x + w + saliencia;
  const largura = x1 - x0;
  const baseY = y + (escala >= 0.7 ? 10 : 6) * escala;
  const topoY = y - 6 * escala;

  ctx.save();

  // Base + montinhos: um único caminho (sombra de contato embaixo + corpo).
  ctx.beginPath();
  ctx.moveTo(x0, baseY);
  const passoMontinho = 26 * escala;
  const qtdMontinhos = Math.max(2, Math.round(largura / passoMontinho));
  for (let i = 0; i <= qtdMontinhos; i += 1) {
    const px = x0 + (largura * i) / qtdMontinhos;
    const raio = (10 + hash01(i) * 6) * escala;
    ctx.arc(px, topoY + raio * 0.3, raio, Math.PI, 0, false);
  }
  // Base com gotas (formato de gota: duas curvas quadráticas por gota).
  const passoGota = (escala >= 0.7 ? 46 : 32) * escala;
  const qtdGotas = Math.max(1, Math.round(largura / passoGota));
  for (let i = qtdGotas; i >= 0; i -= 1) {
    const gx = x0 + (largura * i) / qtdGotas;
    const h = hash01(i * 3.7);
    const comprimento = ((i % 4 === 0 ? 22 : 10) + h * 6) * escala;
    const largGota = (14 + h * 8) * escala;
    ctx.quadraticCurveTo(gx + largGota * 0.25, baseY + comprimento * 0.5, gx, baseY + comprimento);
    ctx.quadraticCurveTo(gx - largGota * 0.25, baseY + comprimento * 0.5, gx - largGota, baseY);
  }
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, topoY, 0, baseY + 18 * escala);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.6, '#e6f4ff');
  grad.addColorStop(1, '#b9ddf5');
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.lineWidth = 2.5;
  ctx.strokeStyle = COR_TINTA;
  ctx.stroke();

  // Brilhos no alto dos montinhos.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 4; i += 1) {
    const px = x0 + largura * (0.14 + i * 0.24);
    ctx.beginPath();
    ctx.ellipse(px, topoY + 1 * escala, 4 * escala, 2 * escala, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------
// 3. Painel Geada (§4.1) -- substitui todo painel azul opaco
// ---------------------------------------------------------------------------------------------------------------

export type VariantePainel = 'padrao' | 'ouro';

export interface OpcoesPainelGeada {
  readonly raio?: number;
  readonly variante?: VariantePainel;
  /** Tampa de neve no topo (padrão: sim). */
  readonly tampa?: boolean;
}

const FOLGA_PAINEL = 24;
const cachePaineis = new Map<string, HTMLCanvasElement>();

function construirPainelOffscreen(doc: Document, w: number, h: number, raio: number, variante: VariantePainel, tampa: boolean): HTMLCanvasElement {
  const largura = w + FOLGA_PAINEL * 2;
  const altura = h + FOLGA_PAINEL * 2 + (tampa ? 14 : 0);
  const canvas = doc.createElement('canvas');
  canvas.width = Math.ceil(largura * RS);
  canvas.height = Math.ceil(altura * RS);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador');
  ctx.setTransform(RS, 0, 0, RS, 0, 0);

  const x = FOLGA_PAINEL;
  const y = FOLGA_PAINEL + (tampa ? 10 : 0);
  const r: Retangulo = { x, y, w, h };

  // 1. Sombra dupla falsa (sem blur): dois retângulos arredondados deslocados.
  ctx.fillStyle = 'rgba(3, 8, 24, 0.40)';
  caminhoArredondado(ctx, { x, y: y + 10, w, h }, raio);
  ctx.fill();
  ctx.fillStyle = 'rgba(3, 8, 24, 0.18)';
  caminhoArredondado(ctx, { x, y: y + 18, w, h }, raio + 6);
  ctx.fill();

  // 2. Chapa opaca: o corpo do painel NUNCA deixa o fundo da cena atravessar -- o guia é explícito ("o vidro é
  // FOSCO ESCURO, não transparente"). Sem backdrop-filter em Canvas 2D, a alternativa a "borrar o que está atrás"
  // seria deixar transparência real, que quebraria o contraste >7:1 do texto branco em cima de céu claro. Esta
  // chapa opaca garante que o resultado final (depois do `drawImage` no quadro real) não dependa do que estava
  // por baixo -- a cor do painel é SEMPRE a mesma, testável sem precisar congelar o jogo num estado exato.
  ctx.fillStyle = '#0A1830';
  caminhoArredondado(ctx, r, raio);
  ctx.fill();

  // 3. Base escura (a mesma cor-base por cima da chapa, só reforça o tom -- ambas compõem dentro do PRÓPRIO
  // canvas offscreen, nunca com o conteúdo real da cena).
  ctx.fillStyle = 'rgba(10, 24, 60, 0.66)';
  caminhoArredondado(ctx, r, raio);
  ctx.fill();

  // 4. Tinta de cor.
  caminhoArredondado(ctx, r, raio);
  ctx.save();
  ctx.clip();
  const tinta = ctx.createLinearGradient(x, y, x, y + h);
  if (variante === 'ouro') {
    tinta.addColorStop(0, 'rgba(255, 210, 63, 0.18)');
    tinta.addColorStop(1, 'rgba(180, 86, 15, 0.12)');
  } else {
    tinta.addColorStop(0, 'rgba(140, 210, 255, 0.22)');
    tinta.addColorStop(0.35, 'rgba(80, 140, 230, 0.10)');
    tinta.addColorStop(1, 'rgba(20, 30, 90, 0.20)');
  }
  ctx.fillStyle = tinta;
  ctx.fillRect(x, y, w, h);

  // 5. Reflexos diagonais no canto superior esquerdo.
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((20 * Math.PI) / 180);
  ctx.fillRect(-20, -40, 40, h * 1.6);
  ctx.fillRect(60, -40, 14, h * 1.6);
  ctx.restore();
  ctx.restore();

  // 6. Aro interno (luz na quina de cima).
  const inset = 1.75;
  caminhoArredondado(ctx, { x: x + inset, y: y + inset, w: w - inset * 2, h: h - inset * 2 }, Math.max(0, raio - inset));
  const aroInterno = ctx.createLinearGradient(x, y, x, y + h * 0.5);
  if (variante === 'ouro') {
    aroInterno.addColorStop(0, 'rgba(255, 210, 63, 0.8)');
    aroInterno.addColorStop(1, 'rgba(255, 210, 63, 0.05)');
  } else {
    aroInterno.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    aroInterno.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
  }
  ctx.lineWidth = 1.75;
  ctx.strokeStyle = aroInterno;
  ctx.stroke();

  // 7. Aro externo.
  caminhoArredondado(ctx, r, raio);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(11, 22, 48, 0.85)';
  ctx.stroke();

  // 8. Tampa de neve.
  if (tampa) desenharTampaDeNeve(ctx, x, y, w, 1);

  return canvas;
}

/** Painel Geada (§4.1): vidro fosco escuro com tampa de neve no topo. Construído UMA vez por combinação
 *  (tamanho/raio/variante/tampa) e cacheado -- chamadas seguintes são só `drawImage`. */
export function painelGeada(ctx: Ctx, doc: Document, r: Retangulo, opcoes: OpcoesPainelGeada = {}): void {
  const raio = opcoes.raio ?? 22;
  const variante = opcoes.variante ?? 'padrao';
  const tampa = opcoes.tampa ?? true;
  const chave = `${Math.round(r.w)}x${Math.round(r.h)}:${raio}:${variante}:${tampa}`;
  let camada = cachePaineis.get(chave);
  if (!camada) {
    camada = construirPainelOffscreen(doc, r.w, r.h, raio, variante, tampa);
    cachePaineis.set(chave, camada);
  }
  const yTampa = tampa ? 10 : 0;
  ctx.drawImage(camada, r.x - FOLGA_PAINEL, r.y - FOLGA_PAINEL - yTampa, camada.width / RS, camada.height / RS);
}

/** Só para teste/limpeza entre cenários de e2e. */
export function _esquecerCachePaineisParaTeste(): void {
  cachePaineis.clear();
}

// ---------------------------------------------------------------------------------------------------------------
// 4. Botão 3D "bala gelada" (§4.3) e botão redondo de voltar
// ---------------------------------------------------------------------------------------------------------------

export type TipoBotao3D = 'primario' | 'secundario' | 'perigo' | 'confirmar' | 'desativado';

const CORES_BOTAO: Readonly<Record<TipoBotao3D, { topo: string; meio: string; base: string; labio: string }>> = {
  primario: { topo: '#FFE27A', meio: '#FFB020', base: '#F07A12', labio: '#B4500C' },
  secundario: { topo: '#7CC4FF', meio: '#2A7DE1', base: '#1450A0', labio: '#0C3270' },
  perigo: { topo: '#FF7A66', meio: '#E0432C', base: '#B0281A', labio: '#7A160E' },
  confirmar: { topo: '#9BF5C8', meio: '#3DDC97', base: '#1F9E66', labio: '#126B44' },
  desativado: { topo: '#6B7682', meio: '#55606A', base: '#2C343B', labio: '#1C2227' },
};

export interface Botao3DProps {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly texto: string;
  readonly tipo: TipoBotao3D;
  readonly aoVivo?: boolean | undefined;
  /** CTA único da tela: respira (§8.6) e ganha tampa de neve pequena. */
  readonly destaque?: boolean | undefined;
  /** Ticks desde que a cena ficou visível -- só usado para a respiração do `destaque`. */
  readonly t?: number | undefined;
  readonly tamanhoFonte?: number | undefined;
}

/** Botão 3D "bala gelada" (§4.3): sombra, lábio de extrusão, face em gradiente de 3 paradas, brilho de vidro,
 *  contorno e texto com contorno. Estados `parado`/`hover`(`aoVivo`)/`desativado` (ver guia para a tabela
 *  completa; `pressionado`/`soltar` ficam para quando a cena rastrear pointerup, hoje só pointerdown). */
export function botao3D(ctx: Ctx, b: Botao3DProps): void {
  const cores = CORES_BOTAO[b.tipo];
  const raio = b.h / 2;
  const t = b.t ?? 0;
  const respirar = b.destaque && b.tipo !== 'desativado' ? 1 + 0.03 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 96)) : 1;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(respirar, respirar);
  ctx.translate(-cx, -cy);

  // Sombra.
  ctx.fillStyle = 'rgba(3, 8, 24, 0.40)';
  caminhoArredondado(ctx, { x: b.x, y: b.y + 8, w: b.w, h: b.h }, raio);
  ctx.fill();

  // Lábio (extrusão).
  ctx.fillStyle = cores.labio;
  caminhoArredondado(ctx, { x: b.x, y: b.y + 6, w: b.w, h: b.h }, raio);
  ctx.fill();

  // Face.
  const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
  grad.addColorStop(0, cores.topo);
  grad.addColorStop(0.5, cores.meio);
  grad.addColorStop(1, cores.base);
  ctx.fillStyle = grad;
  caminhoArredondado(ctx, b, raio);
  ctx.fill();

  // Brilho de cima (recortado na face) + luz de baixo.
  ctx.save();
  caminhoArredondado(ctx, b, raio);
  ctx.clip();
  ctx.fillStyle = `rgba(255, 255, 255, ${b.aoVivo ? 0.5 : 0.35})`;
  ctx.beginPath();
  ctx.ellipse(cx, b.y + b.h * 0.22, b.w * 0.46, b.h * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.fillRect(b.x, b.y + b.h - 5, b.w, 2.5);
  ctx.restore();

  // Contorno.
  ctx.lineWidth = 3;
  ctx.strokeStyle = b.aoVivo ? '#ffffff' : COR_TINTA;
  caminhoArredondado(ctx, b, raio);
  ctx.stroke();
  if (b.aoVivo) {
    caminhoArredondado(ctx, { x: b.x - 2, y: b.y - 2, w: b.w + 4, h: b.h + 4 }, raio + 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.stroke();
  }

  // Texto.
  const tamanho = b.tamanhoFonte ?? (b.destaque ? 28 : 22);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.font = `italic 800 ${tamanho}px "Barlow Condensed", Impact, sans-serif`;
  ctx.lineWidth = 5;
  ctx.strokeStyle = COR_TINTA;
  ctx.strokeText(b.texto, cx, cy + 1);
  ctx.fillStyle = b.tipo === 'desativado' ? 'rgba(255,255,255,0.6)' : '#ffffff';
  ctx.fillText(b.texto, cx, cy + 1);

  if (b.destaque && b.tipo !== 'desativado') desenharTampaDeNeve(ctx, b.x + b.w * 0.14, b.y, b.w * 0.72, 0.42);

  ctx.restore();
}

/** Botão redondo de voltar (seta desenhada em código -- nunca glifo de fonte, que muda de cara por sistema). */
export function botaoRedondoVoltar(ctx: Ctx, cx: number, cy: number, raio: number, aoVivo = false): void {
  const cores = CORES_BOTAO.secundario;
  ctx.save();

  ctx.fillStyle = 'rgba(3, 8, 24, 0.40)';
  ctx.beginPath();
  ctx.arc(cx, cy + 5, raio, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = cores.labio;
  ctx.beginPath();
  ctx.arc(cx, cy + 4, raio, 0, Math.PI * 2);
  ctx.fill();

  const grad = ctx.createLinearGradient(cx, cy - raio, cx, cy + raio);
  grad.addColorStop(0, cores.topo);
  grad.addColorStop(0.5, cores.meio);
  grad.addColorStop(1, cores.base);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = `rgba(255,255,255,${aoVivo ? 0.45 : 0.3})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy - raio * 0.3, raio * 0.75, raio * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.lineWidth = 3;
  ctx.strokeStyle = aoVivo ? '#ffffff' : COR_TINTA;
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.stroke();

  // Seta pra esquerda, em código.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  const r = raio * 0.32;
  ctx.beginPath();
  ctx.moveTo(r * 0.6, -r);
  ctx.lineTo(-r * 0.7, 0);
  ctx.lineTo(r * 0.6, r);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, 0);
  ctx.lineTo(r * 0.9, 0);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------
// 5. Letreiro (§5.1) -- título com volume, cacheado por string
// ---------------------------------------------------------------------------------------------------------------

export type FaceLetreiro = 'gelo' | 'ouro' | 'marca' | 'prata' | 'bronze';

const FACES_LETREIRO: Readonly<Record<FaceLetreiro, { paradas: readonly [number, string][]; extrusao: string }>> = {
  gelo: { paradas: [[0, '#FFFFFF'], [0.45, '#D8F3FF'], [1, '#7FD0FF']], extrusao: '#1659B8' },
  ouro: { paradas: [[0, '#FFF8D6'], [0.5, '#FFD23F'], [1, '#FF9A1F']], extrusao: '#B4560F' },
  marca: { paradas: [[0, '#FFD36B'], [0.55, '#FF8A1F'], [1, '#F2611A']], extrusao: '#9E3A0B' },
  prata: { paradas: [[0, '#FFFFFF'], [0.5, '#DCE6F2'], [1, '#9AA9C2']], extrusao: '#56657F' },
  bronze: { paradas: [[0, '#FFE0C2'], [0.5, '#E39A5B'], [1, '#B5652A']], extrusao: '#6E3814' },
};

interface LetreiroCacheado {
  readonly canvas: HTMLCanvasElement;
  readonly largura: number;
  readonly altura: number;
  readonly baselineY: number;
}

const cacheLetreiros = new Map<string, LetreiroCacheado>();

function construirLetreiro(doc: Document, texto: string, tamanho: number, face: FaceLetreiro): LetreiroCacheado {
  const fonte = `italic 800 ${tamanho}px "Barlow Condensed", Impact, sans-serif`;
  const medida = doc.createElement('canvas').getContext('2d');
  if (!medida) throw new Error('Canvas 2D indisponível neste navegador');
  medida.font = fonte;
  const largTexto = medida.measureText(texto).width;

  const margem = tamanho * 0.9;
  const largura = largTexto + margem * 2;
  const altura = tamanho * 1.8 + 16;
  const baselineY = tamanho * 1.25 + 8;

  const canvas = doc.createElement('canvas');
  canvas.width = Math.ceil(largura * RS);
  canvas.height = Math.ceil(altura * RS);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível neste navegador');
  ctx.setTransform(RS, 0, 0, RS, 0, 0);

  const cx = largura / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.font = fonte;

  const def = FACES_LETREIRO[face];

  // 1. Sombra.
  ctx.fillStyle = 'rgba(4, 10, 30, 0.45)';
  ctx.fillText(texto, cx, baselineY + 8);

  // 2/3. Extrusão (contorno + 5 preenchimentos deslocados).
  ctx.lineWidth = 10;
  ctx.strokeStyle = COR_TINTA;
  ctx.strokeText(texto, cx, baselineY + 5);
  ctx.fillStyle = def.extrusao;
  for (let dy = 1; dy <= 5; dy += 1) ctx.fillText(texto, cx, baselineY + dy);

  // 4. Contorno da face.
  ctx.lineWidth = 7;
  ctx.strokeStyle = COR_TINTA;
  ctx.strokeText(texto, cx, baselineY);

  // 5. Face com gradiente + brilho de vidro (via canvas auxiliar + `source-atop`).
  const aux = doc.createElement('canvas');
  aux.width = canvas.width;
  aux.height = canvas.height;
  const ctxAux = aux.getContext('2d');
  if (!ctxAux) throw new Error('Canvas 2D indisponível neste navegador');
  ctxAux.setTransform(RS, 0, 0, RS, 0, 0);
  ctxAux.textAlign = 'center';
  ctxAux.textBaseline = 'alphabetic';
  ctxAux.font = fonte;
  const gradFace = ctxAux.createLinearGradient(0, baselineY - tamanho, 0, baselineY + tamanho * 0.2);
  for (const [pos, cor] of def.paradas) gradFace.addColorStop(pos, cor);
  ctxAux.fillStyle = gradFace;
  ctxAux.fillText(texto, cx, baselineY);

  ctxAux.globalCompositeOperation = 'source-atop';
  ctxAux.fillStyle = 'rgba(255,255,255,0.35)';
  ctxAux.fillRect(0, baselineY - tamanho, largura, tamanho * 0.5);

  ctx.drawImage(aux, 0, 0, largura, altura);

  return { canvas, largura, altura, baselineY };
}

/** Letreiro (§5.1): título "com volume", irmão do logo. `x, y` = centro, linha de base (mesmo contrato de
 *  `desenharTexto(..., alinhamento:'center')`). Cacheado por `texto|tamanho|face`: só vale a pena para títulos
 *  fixos (não para números que mudam todo quadro). */
export function desenharLetreiro(ctx: Ctx, doc: Document, texto: string, x: number, y: number, tamanho: number, face: FaceLetreiro = 'gelo'): void {
  const chave = `${texto}|${tamanho}|${face}`;
  let item = cacheLetreiros.get(chave);
  if (!item) {
    item = construirLetreiro(doc, texto, tamanho, face);
    cacheLetreiros.set(chave, item);
  }
  ctx.drawImage(item.canvas, x - item.largura / 2, y - item.baselineY, item.largura, item.altura);
}

export function _esquecerCacheLetreirosParaTeste(): void {
  cacheLetreiros.clear();
}

// ---------------------------------------------------------------------------------------------------------------
// 6. Retratos recortados da capa (§6.2)
// ---------------------------------------------------------------------------------------------------------------

interface RecorteRetrato {
  readonly x: number;
  readonly y: number;
  readonly lado: number;
}

/** Recortes testados em `capa.webp` (1920x1072); a Lyra já ajustou ±20px no olho em relação à tabela "crua" do
 *  guia (§6.2) depois de medir no navegador (skill `medir-antes-de-afirmar`): `bandeira` subiu 14px (o topo da
 *  cabeça cortava no recorte original) e `queque` desceu 10px (sobrava céu demais e a prancha cortava embaixo). */
const RECORTES_RETRATO: Readonly<Record<string, RecorteRetrato>> = {
  capi: { x: 800, y: 190, lado: 540 },
  bandeira: { x: 1420, y: 56, lado: 340 },
  cidinha: { x: 1580, y: 360, lado: 280 },
  beto: { x: 140, y: 660, lado: 320 },
  queque: { x: 1090, y: 70, lado: 240 },
  bia: { x: 450, y: 390, lado: 340 },
};

export function recorteRetratoDisponivel(id: string): boolean {
  return id in RECORTES_RETRATO;
}

export interface OpcoesRetrato {
  /** Zoom extra no centro do recorte (1 = usa o quadrado cru; 1,25 = padrão do guia para retrato circular). */
  readonly zoom?: number;
  readonly circulo?: boolean;
  readonly raio?: number;
}

/** Retrato recortado da capa (§6.2): o personagem em alta resolução, de graça (a capa já tem os 6 renderizados).
 *  `destino` é a caixa onde o retrato entra (sangria total -- cobre o retângulo/círculo inteiro). Sem recorte
 *  conhecido para `id`, não desenha nada (quem chama decide o fallback, igual ao padrão de ícones). */
export function desenharRetratoDaCapa(ctx: Ctx, capa: HTMLImageElement, id: string, destino: Retangulo, opcoes: OpcoesRetrato = {}): void {
  const recorte = RECORTES_RETRATO[id];
  if (!recorte) return;
  const zoom = opcoes.zoom ?? 1;
  const ladoFonte = recorte.lado / zoom;
  const offset = (recorte.lado - ladoFonte) / 2;
  const sx = recorte.x + offset;
  const sy = recorte.y + offset;

  ctx.save();
  if (opcoes.circulo) {
    ctx.beginPath();
    ctx.arc(destino.x + destino.w / 2, destino.y + destino.h / 2, opcoes.raio ?? Math.min(destino.w, destino.h) / 2, 0, Math.PI * 2);
    ctx.clip();
  } else {
    caminhoArredondado(ctx, destino, opcoes.raio ?? 16);
    ctx.clip();
  }
  // "Cover": a caixa de destino pode não ser quadrada -- estica o recorte quadrado pra cobrir sem distorcer
  // demais (os recortes do guia já foram escolhidos quadrados pensando nisso).
  ctx.drawImage(capa, sx, sy, ladoFonte, ladoFonte, destino.x, destino.y, destino.w, destino.h);
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------
// 7. Medalhão, barra de atributo, monte de neve / pedestal (§4.4)
// ---------------------------------------------------------------------------------------------------------------

export type VarianteMedalhao = 'vidro' | 'ouro' | 'prata' | 'bronze';

const FACES_MEDALHAO: Readonly<Record<VarianteMedalhao, readonly [string, string]>> = {
  vidro: ['rgba(140,210,255,0.28)', 'rgba(10,24,60,0.6)'],
  ouro: ['#FFF8D6', '#FF9A1F'],
  prata: ['#FFFFFF', '#9AA9C2'],
  bronze: ['#FFE0C2', '#B5652A'],
};

/** Medalhão (§4.4): círculo de vidro ou de posição (ouro/prata/bronze); `desenharConteudo` recebe o `ctx` já
 *  transladado pro centro, pra desenhar ícone/número sem recalcular posição. */
export function medalhao(ctx: Ctx, cx: number, cy: number, diametro: number, variante: VarianteMedalhao, desenharConteudo?: (ctx: Ctx, raio: number) => void): void {
  const raio = diametro / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(3,8,24,0.35)';
  ctx.beginPath();
  ctx.arc(cx, cy + 2, raio, 0, Math.PI * 2);
  ctx.fill();

  const [c0, c1] = FACES_MEDALHAO[variante];
  const grad = ctx.createLinearGradient(cx, cy - raio, cx, cy + raio);
  grad.addColorStop(0, c0);
  grad.addColorStop(1, c1);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 2;
  ctx.strokeStyle = variante === 'vidro' ? 'rgba(255,255,255,0.3)' : COR_TINTA;
  ctx.stroke();

  if (desenharConteudo) {
    ctx.save();
    ctx.translate(cx, cy);
    desenharConteudo(ctx, raio);
    ctx.restore();
  }
  ctx.restore();
}

export type AtributoPersonagem = 'velocidade' | 'equilibrio' | 'forca';

const GRADIENTES_ATRIBUTO: Readonly<Record<AtributoPersonagem, readonly [string, string]>> = {
  velocidade: ['#FFE27A', '#FF8A1F'],
  equilibrio: ['#9FE3FF', '#2A7DE1'],
  forca: ['#FF9BB8', '#FF5C8A'],
};

/** Barra de atributo (§4.4): trilho de vidro + preenchimento em gradiente por atributo + segmento de bônus
 *  (listrado, diagonal) quando `bonusFracao > 0`. `fracaoBase`/`bonusFracao` já vêm em [0,1] (quem chama decide
 *  a escala/faixa -- esta função só desenha). */
export function barraAtributo(ctx: Ctx, x: number, y: number, w: number, h: number, atributo: AtributoPersonagem, fracaoBase: number, bonusFracao = 0): void {
  const raio = h / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(4, 10, 30, 0.55)';
  caminhoArredondado(ctx, { x, y, w, h }, raio);
  ctx.fill();

  caminhoArredondado(ctx, { x, y, w, h }, raio);
  ctx.clip();
  const [c0, c1] = GRADIENTES_ATRIBUTO[atributo];
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, c0);
  grad.addColorStop(1, c1);
  ctx.fillStyle = grad;
  const baseW = w * Math.max(0, Math.min(1, fracaoBase));
  ctx.fillRect(x, y, baseW, h);

  if (bonusFracao > 0) {
    const bonusW = w * Math.max(0, Math.min(1, bonusFracao));
    ctx.fillStyle = '#FFD23F';
    ctx.fillRect(x + baseW, y, bonusW, h);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y, w, h * 0.4);
  ctx.restore();

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  caminhoArredondado(ctx, { x, y, w, h }, raio);
  ctx.stroke();
  ctx.restore();
}

/** Monte de neve sob os pés (herdado de `selecao.ts`, movido pro kit compartilhado): sombra de contato + corpo
 *  em gradiente radial (volume, não um disco liso) + brilho + alguns glints determinísticos. */
export function monteDeNeve(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
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
  for (const [fx, fy] of [[-0.45, -0.1], [0.3, 0.2], [0.05, -0.4]] as const) {
    ctx.beginPath();
    ctx.arc(cx + rx * fx, cy + ry * fy, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Pedestal de gelo (§4.4): elipse superior em face Neve + faixa lateral em gradiente + brilho frontal. `topoCy`
 *  é o centro da elipse de CIMA (o personagem fica de pé bem acima dela). */
export function pedestalDeGelo(ctx: Ctx, cx: number, topoCy: number, rx: number, ry: number, alturaFaixa: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 12, 26, 0.3)';
  ctx.beginPath();
  ctx.ellipse(cx, topoCy + alturaFaixa + ry * 0.4, rx * 0.9, ry * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const faixa = ctx.createLinearGradient(0, topoCy, 0, topoCy + alturaFaixa);
  faixa.addColorStop(0, '#5FB4E8');
  faixa.addColorStop(1, '#1659B8');
  ctx.fillStyle = faixa;
  ctx.beginPath();
  ctx.moveTo(cx - rx, topoCy);
  ctx.lineTo(cx - rx, topoCy + alturaFaixa);
  ctx.ellipse(cx, topoCy + alturaFaixa, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(cx + rx, topoCy);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = COR_TINTA;
  ctx.stroke();

  const topo = ctx.createLinearGradient(0, topoCy - ry, 0, topoCy + ry);
  topo.addColorStop(0, '#FFFFFF');
  topo.addColorStop(0.6, '#E6F4FF');
  topo.addColorStop(1, '#B9DDF5');
  ctx.fillStyle = topo;
  ctx.beginPath();
  ctx.ellipse(cx, topoCy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = COR_TINTA;
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(cx, topoCy + ry * 0.2, rx * 0.5, ry * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------
// 8. Estrelinha de 4 pontas (§7.4) -- brilho piscante determinístico
// ---------------------------------------------------------------------------------------------------------------

/** Estrelinha (losango de 4 pontas + ponto central). `fase` em ticks: escala 0→1→0 em ~1200ms (72 ticks) e gira
 *  45° no ciclo -- determinístico (função do tempo, sem estado). */
export function estrelinha(ctx: Ctx, cx: number, cy: number, raio: number, faseTicks: number): void {
  const ciclo = 72;
  const p = (faseTicks % ciclo) / ciclo;
  const escala = Math.sin(Math.PI * p);
  if (escala <= 0.01) return;
  const r = raio * escala;
  const rotacao = (45 * Math.PI) / 180 * p;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotacao);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.25, 0);
  ctx.lineTo(0, r);
  ctx.lineTo(-r * 0.25, 0);
  ctx.closePath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(0, r * 0.25);
  ctx.lineTo(r, 0);
  ctx.lineTo(0, -r * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
