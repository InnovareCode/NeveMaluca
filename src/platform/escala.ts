/**
 * Origem: adaptado de src/platform/escala.ts do InnoFighters (2026-10-22). Novidades: margens de área segura (entalhe/ilha/barra
 * do iPhone em paisagem), posição do canvas dentro da área útil e observador de redimensionamento (iOS reporta tamanho velho
 * logo após girar o aparelho).
 *
 * O canvas tem buffer fixo de 1920x1080 (960x540 lógicos x RS). O que muda é o tamanho CSS: o maior retângulo 16:9, em pixels
 * INTEIROS, que cabe na janela menos as margens seguras, centralizado nessa área (letterbox).
 */
import { ALTURA, LARGURA } from './constantes';

export interface TamanhoCss {
  readonly largura: number;
  readonly altura: number;
}

/** Margens de área segura em px CSS (as `env(safe-area-inset-*)` do navegador). */
export interface Margens {
  readonly topo: number;
  readonly direita: number;
  readonly base: number;
  readonly esquerda: number;
}

export const SEM_MARGENS: Margens = { topo: 0, direita: 0, base: 0, esquerda: 0 };

export interface AreaDoCanvas extends TamanhoCss {
  /** Distância da borda esquerda da janela até o canvas, em px CSS inteiros. */
  readonly esquerda: number;
  /** Distância da borda de cima da janela até o canvas, em px CSS inteiros. */
  readonly topo: number;
}

const naoNegativo = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * Maior retângulo LARGURA:ALTURA que cabe na janela descontadas as margens, sem distorcer, em px inteiros (arredonda para baixo:
 * nunca passa da área útil), centralizado nela. Janela ou área útil vazia: tudo zero.
 */
export function calcularAreaDoCanvas(janelaLargura: number, janelaAltura: number, margens: Margens = SEM_MARGENS): AreaDoCanvas {
  // margens arredondadas para CIMA: nunca invadem a área segura por fração de pixel
  const topo = Math.ceil(naoNegativo(margens.topo));
  const base = Math.ceil(naoNegativo(margens.base));
  const esquerda = Math.ceil(naoNegativo(margens.esquerda));
  const direita = Math.ceil(naoNegativo(margens.direita));
  const util = { largura: Math.floor(naoNegativo(janelaLargura) - esquerda - direita), altura: Math.floor(naoNegativo(janelaAltura) - topo - base) };
  if (util.largura <= 0 || util.altura <= 0) return { largura: 0, altura: 0, esquerda: 0, topo: 0 };
  // contas com inteiros (sem fator em ponto flutuante: 375 * (960/540) poderia dar 666.999...)
  const limitaALargura = util.largura * ALTURA <= util.altura * LARGURA;
  const largura = limitaALargura ? util.largura : Math.floor((util.altura * LARGURA) / ALTURA);
  const altura = limitaALargura ? Math.floor((util.largura * ALTURA) / LARGURA) : util.altura;
  return {
    largura,
    altura,
    esquerda: esquerda + Math.floor((util.largura - largura) / 2),
    topo: topo + Math.floor((util.altura - altura) / 2),
  };
}

/** Só o tamanho (sem margens): compatível com o contrato do InnoFighters. */
export function calcularTamanhoCss(janelaLargura: number, janelaAltura: number): TamanhoCss {
  const { largura, altura } = calcularAreaDoCanvas(janelaLargura, janelaAltura);
  return { largura, altura };
}

/**
 * Lê as margens seguras do navegador. Um elemento-sonda (classe `sonda-seguranca`, em plataforma.css) tem padding igual às
 * variáveis `--seg-*`, que valem `env(safe-area-inset-*)`; o padding calculado volta em px. Os testes simulam um entalhe
 * definindo `--teste-esq` etc. no `<html>` (por CSSOM, que a CSP permite).
 */
export function lerMargensSeguras(doc: Document = document): Margens {
  const raiz = doc.body ?? doc.documentElement;
  let sonda = doc.getElementById('sonda-seguranca');
  if (!sonda) {
    sonda = doc.createElement('div');
    sonda.id = 'sonda-seguranca';
    sonda.className = 'sonda-seguranca';
    sonda.setAttribute('aria-hidden', 'true');
    raiz.appendChild(sonda);
  }
  const estilo = doc.defaultView?.getComputedStyle(sonda);
  const px = (valor: string | undefined): number => naoNegativo(Number.parseFloat(valor ?? '0'));
  return { topo: px(estilo?.paddingTop), direita: px(estilo?.paddingRight), base: px(estilo?.paddingBottom), esquerda: px(estilo?.paddingLeft) };
}

/** Aplica a área calculada ao canvas (por CSSOM: permitido pela CSP `style-src 'self'`). */
export function ajustarEscala(canvas: HTMLCanvasElement, alvo: Window = window): AreaDoCanvas {
  const area = calcularAreaDoCanvas(alvo.innerWidth, alvo.innerHeight, lerMargensSeguras(alvo.document));
  canvas.style.position = 'fixed';
  canvas.style.width = `${area.largura}px`;
  canvas.style.height = `${area.altura}px`;
  canvas.style.left = `${area.esquerda}px`;
  canvas.style.top = `${area.topo}px`;
  return area;
}

/**
 * Reajusta a escala quando a janela muda. `resize` + `orientationchange` + `visualViewport.resize` (barra do Safari/Chrome do iPhone
 * aparecendo e sumindo). Logo após girar o aparelho o iOS ainda reporta o tamanho antigo: reajusta de novo no próximo quadro e 250 ms
 * depois. Devolve a função que desfaz tudo.
 */
export function observarEscala(canvas: HTMLCanvasElement, alvo: Window = window, aoAjustar?: (area: AreaDoCanvas) => void): () => void {
  const ajustar = (): void => {
    const area = ajustarEscala(canvas, alvo);
    aoAjustar?.(area);
  };
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let quadro = 0;
  const aoGirar = (): void => {
    ajustar();
    cancelAnimationFrame(quadro);
    quadro = alvo.requestAnimationFrame(ajustar);
    const t = setTimeout(() => {
      timers.delete(t);
      ajustar();
    }, 250);
    timers.add(t);
  };
  alvo.addEventListener('resize', ajustar);
  alvo.addEventListener('orientationchange', aoGirar);
  alvo.visualViewport?.addEventListener('resize', ajustar);
  ajustar();
  return () => {
    alvo.removeEventListener('resize', ajustar);
    alvo.removeEventListener('orientationchange', aoGirar);
    alvo.visualViewport?.removeEventListener('resize', ajustar);
    cancelAnimationFrame(quadro);
    for (const t of timers) clearTimeout(t);
    timers.clear();
  };
}
