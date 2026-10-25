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
import { bezierQuad, easeInCubic } from './animacao';
import { caminhoArredondado, criarCamadaEstatica, desenharTexto, type CamadaEstatica, type Retangulo } from './desenho';

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
/**
 * Amplia a versão reduzida do fundo sem virar mosaico. Ampliar 8-10x num passo só, mesmo com suavização ligada,
 * deixa uma grade de blocos visível (era o "pixelado" que o Atlas viu no pódio/oficina/classificação). Aqui:
 * 1 passada de desfoque barata na versão pequena (a imagem sobre ela mesma, deslocada 1 px nas 4 direções) e
 * depois ampliação em degraus de 2x até ~metade do buffer — o último degrau (<=2x) fica pra quem desenha.
 * Feito UMA vez por fundo (o resultado vai pra uma `CamadaEstatica`), nunca por quadro. Sem `ctx.filter` (iPhone).
 */
function ampliarSuave(doc: Document, pequena: HTMLCanvasElement): HTMLCanvasElement {
  const borrada = doc.createElement('canvas');
  borrada.width = pequena.width;
  borrada.height = pequena.height;
  const ctxB = borrada.getContext('2d');
  if (!ctxB) return pequena;
  ctxB.imageSmoothingEnabled = true;
  ctxB.drawImage(pequena, 0, 0);
  ctxB.globalAlpha = 0.35;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) ctxB.drawImage(pequena, dx, dy);
  ctxB.globalAlpha = 1;

  let atual: HTMLCanvasElement = borrada;
  while (atual.width * 2 <= LARGURA_BUFFER / 2 + 1) {
    const maior = doc.createElement('canvas');
    maior.width = atual.width * 2;
    maior.height = atual.height * 2;
    const ctxM = maior.getContext('2d');
    if (!ctxM) break;
    ctxM.imageSmoothingEnabled = true;
    ctxM.imageSmoothingQuality = 'high';
    ctxM.drawImage(atual, 0, 0, maior.width, maior.height);
    atual = maior;
  }
  return atual;
}

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
  const ampliada = ampliarSuave(doc, pequena);

  return criarCamadaEstatica(doc, (ctx) => {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(ampliada, 0, 0, LARGURA, ALTURA);
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
  const ampliada = ampliarSuave(doc, pequena);

  return criarCamadaEstatica(doc, (ctx) => {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(ampliada, 0, 0, LARGURA, ALTURA);
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
  //
  // Acabamento (feedback do dono, 2026-10-24, DUAS rodadas): "a tampa de neve está serrilhada demais" e, depois
  // do 1º fix, "ainda lê como serrilhada, pontas em V com contorno preto". Duas causas raiz, não uma só:
  //
  // 1ª causa (corrigida na 1ª rodada): a receita original ancorava cada semicírculo em `topoY + raio*0.3`, com
  // `raio` sorteado por hash -- a base de CADA arco ficava numa altura diferente da do vizinho, e a reta
  // implícita entre dois `arc()` seguidos virava um dentinho. Fix: todos os montinhos centrados na MESMA altura
  // (`topoY`).
  //
  // 2ª causa (o "V com contorno preto" que sobrou): com a base alinhada, dois montinhos vizinhos ainda podem
  // SE SOBREPOR se `raio_i + raio_(i+1)` passar do espaçamento entre eles -- o raio sorteado ia de 11 a 15
  // (diâmetro 22-30) com espaçamento de só 24. Quando dois semicírculos se cruzam, o caminho continua
  // "por baixo" da sobreposição (correto pro PREENCHIMENTO, que soma as duas áreas certo via regra non-zero),
  // mas o `ctx.stroke()` desenha o CAMINHO LITERAL, inclusive o trecho onde um arco entra e sai de dentro do
  // outro -- essa interseção span aparece como um V preto bem na emenda. Fix: raio máximo bem menor que meio
  // espaçamento (nunca mais que ~40% do espaçamento cada, então a soma nunca ultrapassa o espaçamento) -- os
  // montinhos ficam tangentes ou com uma folga mínima, nunca se cruzando.
  ctx.beginPath();
  ctx.moveTo(x0, baseY);
  // Espaçamento = a MAIOR soma possível de dois raios vizinhos (8+10=...; aqui 10+10=20, +1 de folga) -- garante
  // que dois montinhos NUNCA se cruzam (sem o "V" da sobreposição) e ainda assim ficam quase tangentes (sem o
  // trecho reto virar perceptível, que seria outra forma de "não ler como nuvem").
  const passoMontinho = 21 * escala;
  const qtdMontinhos = Math.max(2, Math.round(largura / passoMontinho));
  for (let i = 0; i <= qtdMontinhos; i += 1) {
    const px = x0 + (largura * i) / qtdMontinhos;
    const raio = (8 + hash01(i) * 2) * escala; // 8 a 10
    ctx.arc(px, topoY, raio, Math.PI, 0, false);
  }
  // Base com gotas (formato de gota: duas curvas quadráticas por gota) -- SÓ na escala grande (painel, escala>=0,7).
  //
  // 3ª causa do "V com contorno preto" (achada medindo a tampa pequena de botão -- escala 0,42 -- numa captura
  // REAL de campeonato, 2026-10-24): as gotas não são o problema na escala 1 (painel), onde têm tamanho de sobra
  // pra curva do `quadraticCurveTo` ficar visivelmente arredondada. Na escala pequena (0,42), a MESMA receita dá
  // gotas de só ~4-12px de comprimento por ~6-9px de largura -- pequenas demais pra curva aparecer: a gota
  // degenera numa reta quase sem curvatura, e o contorno de 1-2,5px nela lê como um dente afiado, não uma gota.
  // Fix: abaixo de escala 0,7 nem desenha gota nenhuma -- só uma base reta (sem saliência pendurada, que a essa
  // escala ninguém nota a falta, e SEM dente nenhum pra errar).
  if (escala >= 0.7) {
    const passoGota = 46 * escala;
    const qtdGotas = Math.max(1, Math.round(largura / passoGota));
    for (let i = qtdGotas; i >= 0; i -= 1) {
      const gx = x0 + (largura * i) / qtdGotas;
      const h = hash01(i * 3.7);
      const comprimento = ((i % 4 === 0 ? 22 : 10) + h * 6) * escala;
      const largGota = (14 + h * 8) * escala;
      ctx.quadraticCurveTo(gx + largGota * 0.25, baseY + comprimento * 0.5, gx, baseY + comprimento);
      ctx.quadraticCurveTo(gx - largGota * 0.25, baseY + comprimento * 0.5, gx - largGota, baseY);
    }
  } else {
    ctx.lineTo(x0, baseY); // base reta, sem gota -- pequena demais pra curva de gota ler como gota (ver acima)
  }
  ctx.closePath();

  const grad = ctx.createLinearGradient(0, topoY, 0, baseY + 18 * escala);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.6, '#e6f4ff');
  grad.addColorStop(1, '#b9ddf5');
  ctx.fillStyle = grad;
  ctx.fill();

  // Contorno na escala do elemento -- na versão pequena de botão (escala ~0,42), um contorno de 2,5px fixo é
  // mais grosso que o próprio raio do montinho (~8-10px) e domina visualmente, lendo como "dentes" pretos em
  // vez de contorno fino. `Math.max(1,...)` mantém um traço visível mesmo na escala mínima.
  ctx.lineWidth = Math.max(1, 2.5 * escala);
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
  ctx.fillStyle = 'rgba(3, 8, 24, 0.14)';
  caminhoArredondado(ctx, { x, y: y + 14, w, h }, raio + 6);
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
  /** Estado "pressionado" (§4.3): a face desce sobre o lábio (6px -> 2px visível) e amassa (1,04 ; 0,92) com
   *  pivô na base. Quem rastreia pointerdown/pointerup é a CENA (`criarEstadoPressao`, abaixo) -- este componente
   *  só DESENHA o estado que recebe, nunca decide quando apertar. */
  readonly pressionado?: boolean | undefined;
  /** Multiplicador de escala externo, uniforme, com pivô no CENTRO -- usado pela cena para o "soltar" (mola
   *  voltando de 1,06 a 1 depois do release, §4.3 "Soltou") sem este componente precisar saber de tempo de soltura.
   *  Combinado (multiplicado) com a respiração do `destaque`. Padrão 1 (sem efeito). */
  readonly escalaExtra?: number | undefined;
}

/** Botão 3D "bala gelada" (§4.3): sombra, lábio de extrusão, face em gradiente de 3 paradas, brilho de vidro,
 *  contorno e texto com contorno. Estados `parado`/`hover`(`aoVivo`)/`pressionado`/`desativado` (a mola de
 *  "soltar" é responsabilidade de quem chama, via `escalaExtra` -- ver `criarEstadoPressao`). */
export function botao3D(ctx: Ctx, b: Botao3DProps): void {
  const cores = CORES_BOTAO[b.tipo];
  const raio = b.h / 2;
  const t = b.t ?? 0;
  const pressionado = b.pressionado === true && b.tipo !== 'desativado';
  const respirar = (b.destaque && b.tipo !== 'desativado' ? 1 + 0.03 * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / 96)) : 1) * (b.escalaExtra ?? 1);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;

  ctx.save();
  // Respiração/soltar: escala uniforme com pivô no centro.
  ctx.translate(cx, cy);
  ctx.scale(respirar, respirar);
  ctx.translate(-cx, -cy);
  if (pressionado) {
    // Pressionado: amassa (1,04 ; 0,92) com pivô na BASE do botão (§4.3) -- a "queda" sobre o lábio.
    const baseY = b.y + b.h;
    ctx.translate(cx, baseY);
    ctx.scale(1.04, 0.92);
    ctx.translate(-cx, -baseY);
  }
  const deslocaY = pressionado ? 4 : 0; // a face desce sobre o lábio

  // Sombra.
  ctx.fillStyle = 'rgba(3, 8, 24, 0.40)';
  caminhoArredondado(ctx, { x: b.x, y: b.y + 8, w: b.w, h: b.h }, raio);
  ctx.fill();

  // Lábio (extrusão): visível vai de 6px a 2px quando pressionado (a face "engole" o lábio).
  ctx.fillStyle = cores.labio;
  caminhoArredondado(ctx, { x: b.x, y: b.y + (pressionado ? 2 : 6), w: b.w, h: b.h }, raio);
  ctx.fill();

  // Daqui pra baixo (face, brilho, contorno, texto) tudo desce junto quando pressionado -- um só `translate`.
  ctx.save();
  ctx.translate(0, deslocaY);

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

  ctx.restore(); // fecha o translate(0, deslocaY) de "face pra baixo"
  ctx.restore(); // fecha o scale/translate de respiração + amassado de pressionado
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

/** Fração mínima visível do preenchimento (§4.4 -- feedback do dono, playtest iPhone: o Tio Beto tem Equilíbrio
 *  no PISO da ficha (90, `fracaoBase = 0`) e a barra lia como "vazia/bugada", não como "valor baixo de verdade".
 *  Todo atributo deste jogo é 90-125 (nunca "ausente"), então um traço legível no início do trilho sempre faz
 *  sentido -- `0` nunca é "sem dado", é só a ponta de baixo da escala. */
const FRACAO_MINIMA_VISIVEL_BARRA = 0.045;

/** Barra de atributo (§4.4): trilho de vidro + preenchimento em gradiente por atributo + segmento de bônus
 *  (listrado, diagonal) quando `bonusFracao > 0`. `fracaoBase`/`bonusFracao` já vêm em [0,1] (quem chama decide
 *  a escala/faixa -- esta função só desenha). `fracaoBase` nunca desenha um preenchimento menor que
 *  `FRACAO_MINIMA_VISIVEL_BARRA` (um valor baixo de verdade continua lendo como "tem uma barra ali", não bugado). */
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
  const baseW = w * Math.max(FRACAO_MINIMA_VISIVEL_BARRA, Math.min(1, fracaoBase));
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
 *  é o centro da elipse de CIMA. O personagem fica de pé na BORDA DA FRENTE dessa elipse (`topoCy + ry`), não no
 *  centro -- feedback do dono (playtest iPhone, 2026-10-24/25): com os pés no centro, o disco "corta o corpo"
 *  (a metade de baixo da elipse desenha por cima das canelas). `ui/cenas/selecao.ts` já ancora os pés lá; esta
 *  função só precisa parecer um CILINDRO com volume de verdade (faixa lateral mais alta + aro de luz na borda da
 *  frente), não um disco chapado. */
export function pedestalDeGelo(ctx: Ctx, cx: number, topoCy: number, rx: number, ry: number, alturaFaixa: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 12, 26, 0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, topoCy + alturaFaixa + ry * 0.5, rx * 0.92, ry * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();

  const faixa = ctx.createLinearGradient(0, topoCy, 0, topoCy + alturaFaixa);
  faixa.addColorStop(0, '#6FC0EE');
  faixa.addColorStop(0.5, '#2E7FCB');
  faixa.addColorStop(1, '#123E7E');
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

  // Linhas verticais sutis na faixa (facetas de gelo) -- quebram a superfície lisa, reforçam "é um volume".
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - rx, topoCy);
  ctx.lineTo(cx - rx, topoCy + alturaFaixa);
  ctx.ellipse(cx, topoCy + alturaFaixa, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(cx + rx, topoCy);
  ctx.closePath();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 2;
  for (const f of [-0.55, -0.15, 0.3, 0.68]) {
    ctx.beginPath();
    ctx.moveTo(cx + rx * f, topoCy);
    ctx.lineTo(cx + rx * f * 0.94, topoCy + alturaFaixa);
    ctx.stroke();
  }
  ctx.restore();

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

  // Brilho geral no alto (luz vindo de cima-esquerda, §7.1).
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(cx - rx * 0.12, topoCy - ry * 0.25, rx * 0.46, ry * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();

  // Aro de luz na BORDA DA FRENTE (onde os pés do personagem pousam) -- o detalhe que vende "ele está EM CIMA
  // disto", não atrás/dentro.
  ctx.beginPath();
  ctx.ellipse(cx, topoCy, rx * 0.98, ry * 0.98, 0, 0.12, Math.PI - 0.12);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.stroke();

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

// ---------------------------------------------------------------------------------------------------------------
// 9. Dica de teclado (padrão comum §11: pílula pequena de vidro, canto superior direito, alinhada à direita)
// ---------------------------------------------------------------------------------------------------------------

/** Pílula pequena de vidro com uma dica de teclado (ex. "ESC volta"), alinhada à direita de `xDireita` em `y`
 *  (centro vertical). Substitui texto solto perto de botões/cartões (acabamento, 2026-10-24: a dica da seleção
 *  de personagem encostava na fita de cartões por falta de uma caixa própria) pelo padrão do guia §11: "pílulas
 *  pequenas de vidro no canto superior direito, em (928, 34)". */
export function dicaTeclado(ctx: Ctx, texto: string, xDireita: number, y: number): void {
  ctx.save();
  ctx.font = '600 14px Barlow, sans-serif';
  const largura = ctx.measureText(texto).width;
  const padX = 12;
  const h = 26;
  const w = largura + padX * 2;
  const x = xDireita - w;
  ctx.fillStyle = 'rgba(10, 24, 60, 0.55)';
  caminhoArredondado(ctx, { x, y: y - h / 2, w, h }, h / 2);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.stroke();
  ctx.restore();
  desenharTexto(ctx, texto, xDireita - padX, y, { fonte: '600 14px Barlow, sans-serif', cor: '#B8C4DA', alinhamento: 'right', base: 'middle' });
}

// ---------------------------------------------------------------------------------------------------------------
// 10. Floco pequeno (ícone de dificuldade/decoração) -- NUNCA o asterisco "*" que lia feio nos cartões de pista
// ---------------------------------------------------------------------------------------------------------------

/** Floco de 3 eixos com "galhos" em V nas pontas (6 raios no total, com ramos -- acabamento, 2026-10-24: o
 *  `selecao-pista.ts` antigo desenhava só os 3 eixos SEM ramos, que lê como um asterisco de fonte, não como
 *  neve). Usado nos indicadores de dificuldade dos cartões de pista; pequeno e barato o bastante pra repetir
 *  5x por cartão sem cachear. */
export function iconeFloco(ctx: Ctx, cx: number, cy: number, raio: number, cor: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = cor;
  ctx.lineWidth = Math.max(1.2, raio * 0.22);
  ctx.lineCap = 'round';
  for (let i = 0; i < 3; i += 1) {
    ctx.save();
    ctx.rotate((Math.PI / 3) * i);
    ctx.beginPath();
    ctx.moveTo(0, -raio);
    ctx.lineTo(0, raio);
    ctx.moveTo(0, -raio * 0.55);
    ctx.lineTo(-raio * 0.3, -raio * 0.85);
    ctx.moveTo(0, -raio * 0.55);
    ctx.lineTo(raio * 0.3, -raio * 0.85);
    ctx.moveTo(0, raio * 0.55);
    ctx.lineTo(-raio * 0.3, raio * 0.85);
    ctx.moveTo(0, raio * 0.55);
    ctx.lineTo(raio * 0.3, raio * 0.85);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------
// 11. Raios de glória (§7.3) -- vencedor/troféu, um único `path`/`fill`
// ---------------------------------------------------------------------------------------------------------------

export type CorRaios = 'ouro' | 'gelo';

const CORES_RAIOS: Readonly<Record<CorRaios, { readonly rgb: string; readonly alpha: number }>> = {
  ouro: { rgb: '255, 210, 63', alpha: 0.3 },
  gelo: { rgb: '159, 227, 255', alpha: 0.18 },
};

/** Doze a dezesseis triângulos finos saindo de `(cx, cy)` (§7.3), um único `path`/`fill` (gradiente radial).
 *  `escala` 0 esconde tudo (early-return); animar de 0 a 1 com `easeOutBack` é o "carimbo" do guia. `rotacaoGraus`
 *  gira o conjunto (6-8°/s no idle, §9.1). */
export function raiosDeGloria(ctx: Ctx, cx: number, cy: number, cor: CorRaios, raioMax: number, escala: number, rotacaoGraus = 0, quantidade = 16): void {
  if (escala <= 0.01) return;
  const def = CORES_RAIOS[cor];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotacaoGraus * Math.PI) / 180);
  ctx.scale(escala, escala);

  const grad = ctx.createRadialGradient(0, 0, raioMax * 0.08, 0, 0, raioMax);
  grad.addColorStop(0, `rgba(${def.rgb}, ${def.alpha})`);
  grad.addColorStop(1, `rgba(${def.rgb}, 0)`);
  ctx.fillStyle = grad;

  const abertura = (8 * Math.PI) / 180;
  ctx.beginPath();
  for (let i = 0; i < quantidade; i += 1) {
    const centro = (i / quantidade) * Math.PI * 2;
    const a0 = centro - abertura / 2;
    const a1 = centro + abertura / 2;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a0) * raioMax, Math.sin(a0) * raioMax);
    ctx.lineTo(Math.cos(a1) * raioMax, Math.sin(a1) * raioMax);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------
// 12. Confete (§7.5) -- determinístico, agrupado por cor (poucos `fill` por quadro)
// ---------------------------------------------------------------------------------------------------------------

type CorConfete = 'sol' | 'chiclete' | 'gelo' | 'menta' | 'tangerina';
const ORDEM_CORES_CONFETE: readonly CorConfete[] = ['sol', 'chiclete', 'gelo', 'menta', 'tangerina'];
const HEX_CORES_CONFETE: Readonly<Record<CorConfete, string>> = {
  sol: '#FFD23F',
  chiclete: '#FF5C8A',
  gelo: '#9FE3FF',
  menta: '#3DDC97',
  tangerina: '#FF8A1F',
};

const CONFETE_VIDA_TICKS = 180;
const CONFETE_GRAVIDADE = 0.25;
const CONFETE_ARRASTO = 0.99;

/** Soma geométrica `r + r² + ... + r^n` (fechada, sem laço) -- é o que permite achar a posição de UMA peça de
 *  confete em qualquer instante `e` sem precisar simular tick a tick desde o nascimento (filosofia de
 *  `ui/animacao.ts`: pose = função(t), nunca um laço de física guardando estado mutável entre quadros). A física
 *  real (gravidade constante + arrasto multiplicativo por tick, exatamente como o guia descreve o "por tick") é
 *  uma recorrência linear de 1ª ordem -- e toda recorrência linear assim tem fechamento em soma geométrica. */
function somaGeometrica(r: number, n: number): number {
  if (n <= 0) return 0;
  if (Math.abs(r - 1) < 1e-9) return n;
  return (r * (1 - r ** n)) / (1 - r);
}

/** Posição/rotação/achatamento ("cambalhota") de uma peça `i` após `e` ticks de voo, partindo de `(x0,y0)` com
 *  velocidade inicial `(vx0,vy0)` e velocidade angular `giro` -- pura função de `e` (ver `somaGeometrica`). */
function posicaoConfete(x0: number, y0: number, vx0: number, vy0: number, giro: number, indice: number, e: number): { x: number; y: number; rotacao: number; escalaY: number } {
  const dx = vx0 * somaGeometrica(CONFETE_ARRASTO, e);
  const fatorDrag = CONFETE_ARRASTO / (1 - CONFETE_ARRASTO);
  const dy = vy0 * somaGeometrica(CONFETE_ARRASTO, e) + CONFETE_GRAVIDADE * fatorDrag * (e - somaGeometrica(CONFETE_ARRASTO, e));
  const balancoX = Math.sin(e * 0.1 + indice) * 6;
  const fase = e * giro;
  return { x: x0 + dx + balancoX, y: y0 + dy, rotacao: fase, escalaY: Math.abs(Math.cos(fase)) };
}

export type ModoConfete = 'canhoes' | 'chuva';

/** Confete determinístico (§7.5): `modo:'canhoes'` = duas saídas nos cantos de baixo, pra cima e pra dentro, todas
 *  as peças nascendo juntas (comemoração de pódio); `modo:'chuva'` = nascendo espalhadas no topo ao longo dos
 *  primeiros ~180 ticks (chuva da vitória do campeonato, §9.2). `eTicks` = ticks desde que a comemoração começou
 *  (negativo = nada ainda). Agrupa por cor (no máximo 5 `fill`, nunca 1 por peça -- guia §7.5). */
export function desenharConfete(ctx: Ctx, modo: ModoConfete, quantidade: number, eTicks: number): void {
  if (eTicks < 0) return;
  for (const cor of ORDEM_CORES_CONFETE) {
    ctx.save();
    ctx.fillStyle = HEX_CORES_CONFETE[cor];
    ctx.beginPath();
    let algumaPeca = false;
    for (let i = 0; i < quantidade; i += 1) {
      const h = hash01(i * 7.13);
      const corDaPeca = ORDEM_CORES_CONFETE[Math.floor(hash01(i * 3.31) * ORDEM_CORES_CONFETE.length) % ORDEM_CORES_CONFETE.length];
      if (corDaPeca !== cor) continue;

      const nascimento = modo === 'chuva' ? (i / quantidade) * CONFETE_VIDA_TICKS : 0;
      const e = eTicks - nascimento;
      if (e < 0 || e > CONFETE_VIDA_TICKS) continue;

      const ladoCanhao = i % 2 === 0 ? 1 : -1; // canhão esquerdo (0,540) atira p/ direita; direito (960,540) p/ esquerda
      const x0 = modo === 'canhoes' ? (ladoCanhao > 0 ? 0 : LARGURA) : (i * 967) % LARGURA;
      const y0 = modo === 'canhoes' ? ALTURA : -20;
      const velocidade = modo === 'canhoes' ? 9 + h * 4 : 0;
      const anguloGraus = 60 + hash01(i * 5.77) * 15;
      const vx0 = modo === 'canhoes' ? Math.cos((anguloGraus * Math.PI) / 180) * velocidade * ladoCanhao : 0;
      const vy0 = modo === 'canhoes' ? -Math.sin((anguloGraus * Math.PI) / 180) * velocidade : 1.5 + hash01(i * 2.19) * 1.5;
      const giro = 0.08 + hash01(i * 4.63) * 0.14;

      const pos = posicaoConfete(x0, y0, vx0, vy0, giro, i, e);
      if (pos.y > ALTURA + 40) continue; // já saiu de vez da tela por baixo -- nem desenha

      const alpha = e > CONFETE_VIDA_TICKS - 30 ? Math.max(0, (CONFETE_VIDA_TICKS - e) / 30) : 1;
      if (alpha <= 0.02) continue;

      const larguraPeca = 8 + hash01(i * 1.41) * 4;
      const alturaPeca = (5 + hash01(i * 6.07) * 1) * Math.max(0.15, pos.escalaY);
      const cosA = Math.cos(pos.rotacao);
      const sinA = Math.sin(pos.rotacao);
      const hw = larguraPeca / 2;
      const hh = alturaPeca / 2;
      const cantos: readonly [number, number][] = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
      cantos.forEach(([px, py], indiceCanto) => {
        const rx = pos.x + px * cosA - py * sinA;
        const ry = pos.y + px * sinA + py * cosA;
        if (indiceCanto === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      });
      ctx.closePath();
      algumaPeca = true;
    }
    if (algumaPeca) ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 13. Moeda voando em arco (§8.3 "moeda voando") e moeda girando (§7.6, troféu Floco de Ouro)
// ---------------------------------------------------------------------------------------------------------------

/** Posição ao longo do arco (bezier quadrática, ponto de controle acima do meio -- princípio "arcos", §8.1) de
 *  `origem` a `destino`, em progresso linear `p` ∈ [0,1] (a easeInCubic do guia já é aplicada aqui dentro). */
export function posicaoEmArco(origem: { readonly x: number; readonly y: number }, destino: { readonly x: number; readonly y: number }, p: number): { x: number; y: number } {
  const controle = { x: (origem.x + destino.x) / 2, y: Math.min(origem.y, destino.y) - 100 };
  return bezierQuad(origem, controle, destino, easeInCubic(p));
}

/** Moeda (ícone `floco-dourado`, ou um círculo `sol` de fallback sem a imagem) numa posição -- usada junto de
 *  `posicaoEmArco` pra desenhar cada moeda voando do personagem até o contador (§9.1/§9.4). */
export function desenharMoedaIcone(ctx: Ctx, img: HTMLImageElement | null, x: number, y: number, tamanho: number): void {
  ctx.save();
  if (img) {
    ctx.drawImage(img, x - tamanho / 2, y - tamanho / 2, tamanho, tamanho);
  } else {
    ctx.fillStyle = '#FFD23F';
    ctx.beginPath();
    ctx.arc(x, y, tamanho / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = COR_TINTA;
    ctx.stroke();
  }
  ctx.restore();
}

/** Moeda girando "de verdade" (§7.6): giro de moeda por `escalaX = cos(θ)`; de perfil (|escalaX|<0,3), desenha a
 *  borda por cima numa elipse fina em `ouro-escuro`. O brilho que atravessa (faixa diagonal, canvas auxiliar) do
 *  guia foi deixado de fora -- custo de mais um canvas offscreen por chamada pra um detalhe que só aparece 500ms
 *  a cada 3s; simplificação deliberada, documentada na memória da Lyra. */
export function desenharMoedaGirando(ctx: Ctx, img: HTMLImageElement | null, cx: number, cy: number, diametro: number, tTicks: number): void {
  const theta = tTicks * 0.05;
  const escalaX = Math.cos(theta);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(escalaX === 0 ? 0.001 : escalaX, 1);
  desenharMoedaIcone(ctx, img, 0, 0, diametro);
  ctx.restore();
  if (Math.abs(escalaX) < 0.3) {
    ctx.save();
    ctx.globalAlpha = (0.3 - Math.abs(escalaX)) * 2;
    ctx.fillStyle = '#B4560F';
    ctx.beginPath();
    ctx.ellipse(cx, cy, diametro * 0.07, diametro / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------------------------------------------------------
// 14. Etiqueta VOCÊ (§4.4) e balão de fala genérico (§4.4) -- compartilhados por pódio/classificação/oficina
// ---------------------------------------------------------------------------------------------------------------

/** Pílula `sol` "VOCÊ" com setinha pra baixo, balançando ±3px em 1400ms (84 ticks) -- `cx` é o centro horizontal,
 *  `topoY` é onde a BASE da etiqueta deve ficar (a seta aponta pra baixo a partir daí). */
export function etiquetaVoce(ctx: Ctx, cx: number, baseY: number, tTicks: number): void {
  const balanco = Math.sin((tTicks / 84) * Math.PI * 2) * 3;
  const w = 62;
  const h = 24;
  const x = cx - w / 2;
  const y = baseY - h - 8;
  ctx.save();
  ctx.translate(0, balanco);
  ctx.fillStyle = '#FFD23F';
  caminhoArredondado(ctx, { x, y, w, h }, h / 2);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COR_TINTA;
  caminhoArredondado(ctx, { x, y, w, h }, h / 2);
  ctx.stroke();
  desenharTexto(ctx, 'VOCÊ', cx, y + h / 2 + 1, { fonte: 'italic 800 14px "Barlow Condensed", Impact, sans-serif', cor: COR_TINTA, alinhamento: 'center', base: 'middle' });

  ctx.beginPath();
  ctx.moveTo(cx - 5, y + h - 1);
  ctx.lineTo(cx + 5, y + h - 1);
  ctx.lineTo(cx, y + h + 7);
  ctx.closePath();
  ctx.fillStyle = '#FFD23F';
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = COR_TINTA;
  ctx.stroke();
  ctx.restore();
}

export type DirecaoRabicho = 'baixo' | 'esquerda';

/** Balão de fala genérico (§4.4), fonte Bangers, largura automática por `texto` -- versão compartilhada e
 *  simples (sem a quebra em 2 linhas de `selecao.ts: desenharBalaoDeFala`, que lida com bordões mais longos);
 *  pensado para callouts curtos (ex. "NÍVEL 3!" na oficina, §9.4). `cx,cy` é o CENTRO do balão. */
export function balaoDeFala(ctx: Ctx, texto: string, cx: number, cy: number, direcaoRabicho: DirecaoRabicho = 'baixo', tamanho = 26): void {
  const fonte = `400 ${tamanho}px Bangers, sans-serif`;
  ctx.save();
  ctx.font = fonte;
  const largTexto = ctx.measureText(texto).width;
  const w = largTexto + 28;
  const h = tamanho + 22;
  const x = cx - w / 2;
  const y = cy - h / 2;

  caminhoArredondado(ctx, { x, y, w, h }, 14);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COR_TINTA;
  ctx.stroke();

  ctx.beginPath();
  if (direcaoRabicho === 'baixo') {
    ctx.moveTo(cx - 10, y + h - 2);
    ctx.lineTo(cx, y + h + 14);
    ctx.lineTo(cx + 10, y + h - 2);
  } else {
    ctx.moveTo(x + 18, y + h - 10);
    ctx.lineTo(x - 14, y + h + 6);
    ctx.lineTo(x + 32, y + h - 10);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = COR_TINTA;
  ctx.stroke();

  desenharTexto(ctx, texto, cx, cy, { fonte, cor: COR_TINTA, alinhamento: 'center', base: 'middle' });
  ctx.restore();
}

// ---------------------------------------------------------------------------------------------------------------
// 15. Nome ajustado -- nunca estoura a coluna ao lado (tempo/pontos), mesmo com nome completo ("Capi Barbosa")
// ---------------------------------------------------------------------------------------------------------------

/**
 * Linhas de lista (pódio 4º-6º, classificação, final) desenham "Nome (você)" numa coluna estreita ao lado de
 * tempo/pontos -- testado só com nomes curtos ("Capi"), a lista nunca bateu com o NOME DE VERDADE do catálogo
 * ("Capi Barbosa"), que é mais longo e estourava em cima da coluna da direita (achado rodando um campeonato de
 * verdade, 2026-10-24, não aparecia em nenhum teste com dado sintético curto). Resolve em 2 passos antes de
 * desistir: 1) tenta sem o sufixo " (você)" (a cor/realce da linha já diz que é o jogador, o texto é redundante);
 * 2) reduz o tamanho da fonte até caber, nunca abaixo de `tamanhoMinimo`.
 */
export function medirNomeAjustado(ctx: Ctx, nome: string, comSufixoVoce: boolean, larguraMax: number, montarFonte: (tamanho: number) => string, tamanhoInicial: number, tamanhoMinimo = 13): { readonly texto: string; readonly tamanho: number } {
  const candidatos = comSufixoVoce ? [`${nome} (você)`, nome] : [nome];
  for (const texto of candidatos) {
    for (let tamanho = tamanhoInicial; tamanho >= tamanhoMinimo; tamanho -= 1) {
      ctx.font = montarFonte(tamanho);
      if (ctx.measureText(texto).width <= larguraMax) return { texto, tamanho };
    }
  }
  return { texto: candidatos[candidatos.length - 1] ?? nome, tamanho: tamanhoMinimo };
}
