/**
 * Render dos elementos de item NO MUNDO (plano `docs/plano-itens-corrida.md` §I5, Lyra): caixa, bola de neve
 * (projétil), poça de calda (armadilha), bolha de gelo (escudo) e o aviso "casco azul" da nuvem de granizo sobre o
 * alvo. Puramente render -- lê posições já calculadas por quem chama (`ui/cenas/corrida.ts`), nunca consulta
 * `pista/` (regra de camada, memória `render-nao-pode-importar-pista`: `render/` só importa `core/`, `data/`,
 * `assets/`) e nunca toca o motor/orquestrador.
 *
 * `OrquestradorItens.entidadesVisiveis` (`corrida/itens.ts`) devolve `y: 0` pra bola/poça -- elas não têm altura
 * própria (dodge é discreto, por `modo==='ar'`, não geometria) -- por isso `ui/cenas/corrida.ts` recalcula o `yM`
 * de cada uma com `alturaEm(pista, x)` ANTES de entregar aqui (mesmo padrão de `corrida-rivais-sem-xy`: a conta de
 * posição mora na cena, nunca em `render/`). Caixa já chega com `y` real (`CaixaCamada`, plantada por
 * `pista/camada-jogo.ts`), usado direto.
 *
 * Ícones reais (2026-10-24, `assets/itens.ts`: `caixa`/`bola`/`poca`/`nuvem`/`escudo`, 256x256) quando já
 * carregados; os vetoriais abaixo (`desenharCaixaVetorial`/etc.) são o fallback enquanto a imagem não chegou --
 * nunca um placeholder feio, só a MESMA forma que já existia antes dos ícones.
 */
import { PX_POR_METRO } from '../core/constantes';
import type { TipoItem } from '../core/contratos';
import { assetsItensProntos } from '../assets/itens';
import { mundoParaTela, pxPorMetro, type EstadoCamera } from './mundo';

const COR_CONTORNO = '#0b1a33';
const COR_CAIXA = '#ffd166';
const COR_BOLA = '#eaf6ff';
const COR_POCA = '#c87f3c';
const COR_ESCUDO = '#9fe8ff';
const COR_AVISO_ALVO = '#5fc9ff';

/** Entidade de item com posição já resolvida no MUNDO (metros) -- ver cabeçalho sobre o `y` de bola/poça. */
export interface EntidadeItemVisual {
  readonly id: string;
  readonly tipo: TipoItem | 'caixa';
  readonly xM: number;
  readonly yM: number;
}

/** Caixa: ícone real (`caixa.webp`) com o mesmo leve bob de antes; sem o ícone, cai no quadrado dourado+laço
 *  vetorial (mesma linguagem visual dos coletáveis, `render/camada.ts`). */
function desenharCaixa(ctx: CanvasRenderingContext2D, x: number, y: number, escala: number, tick: number): void {
  const bob = Math.sin((tick + x * 0.3) * 0.1) * 3 * escala;
  const icone = assetsItensProntos()?.caixa;
  ctx.save();
  ctx.translate(x, y + bob);
  if (icone) {
    // 52 px = 1,3 m: o mesmo raio de coleta da caixa (`RAIO_CAIXA_M`, pista/camada-jogo.ts) — o que se vê é o que se pega,
    // e lê de longe no iPhone. Centro a 0,8 m do chão: a base flutua ~6 px acima da neve.
    const lado = 52 * escala;
    ctx.drawImage(icone, -lado / 2, -lado / 2, lado, lado);
  } else {
    const lado = 16 * escala;
    ctx.fillStyle = COR_CAIXA;
    ctx.strokeStyle = COR_CONTORNO;
    ctx.lineWidth = Math.max(1.5, 2 * escala);
    ctx.fillRect(-lado / 2, -lado / 2, lado, lado);
    ctx.strokeRect(-lado / 2, -lado / 2, lado, lado);
    ctx.beginPath();
    ctx.moveTo(-lado / 2, 0);
    ctx.lineTo(lado / 2, 0);
    ctx.moveTo(0, -lado / 2);
    ctx.lineTo(0, lado / 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Bola de neve: ícone real (`bola.webp`) + risquinhos de movimento atrás; sem o ícone, cai no círculo vetorial
 *  (mesma linguagem do turbo de pouso). */
function desenharBola(ctx: CanvasRenderingContext2D, x: number, y: number, escala: number): void {
  const raio = 9 * escala;
  const icone = assetsItensProntos()?.bola;
  ctx.save();
  ctx.strokeStyle = COR_BOLA;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = Math.max(1.5, 2 * escala);
  for (const dy of [-4, 4]) {
    ctx.beginPath();
    ctx.moveTo(x - raio * 1.4, y + dy * escala);
    ctx.lineTo(x - raio * 0.6, y + dy * escala);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (icone) {
    const lado = raio * 4.8;
    ctx.drawImage(icone, x - lado / 2, y - lado / 2, lado, lado);
  } else {
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, Math.PI * 2);
    ctx.fillStyle = COR_BOLA;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, 2 * escala);
    ctx.strokeStyle = COR_CONTORNO;
    ctx.stroke();
  }
  ctx.restore();
}

/** Poça de calda: ícone real (`poca.webp`) achatado no chão; sem o ícone, cai na elipse vetorial semi-transparente
 *  -- lê como "molhado/pegajoso", nunca sólido. */
function desenharPoca(ctx: CanvasRenderingContext2D, x: number, y: number, escala: number): void {
  const icone = assetsItensProntos()?.poca;
  ctx.save();
  ctx.globalAlpha = 0.85;
  if (icone) {
    const largura = 68 * escala;
    const altura = largura * 0.62; // achatada, mas sem espremer a arte do ícone a ponto de virar um traço
    ctx.drawImage(icone, x - largura / 2, y - altura / 2, largura, altura);
  } else {
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.ellipse(x, y, 16 * escala, 6 * escala, 0, 0, Math.PI * 2);
    ctx.fillStyle = COR_POCA;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, 2 * escala);
    ctx.strokeStyle = COR_CONTORNO;
    ctx.stroke();
  }
  ctx.restore();
}

/** Desenha todas as entidades visíveis (caixa/bola/poça) -- a nuvem nunca chega aqui (mira um alvo móvel, sem
 *  posição própria: ver `alvoNoJogador`/`desenharAvisoAlvo`); turbo/escudo/ima são buffs sem corpo no mundo. */
export function desenharEntidadesItens(ctx: CanvasRenderingContext2D, camera: EstadoCamera, entidades: readonly EntidadeItemVisual[], tick: number): void {
  if (entidades.length === 0) return;
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom) / PX_POR_METRO;
  for (const ent of entidades) {
    const pt = mundoParaTela(ent.xM, ent.yM, camera, PX_POR_METRO);
    if (ent.tipo === 'caixa') desenharCaixa(ctx, pt.x, pt.y, escala, tick);
    else if (ent.tipo === 'bola') desenharBola(ctx, pt.x, pt.y, escala);
    else if (ent.tipo === 'poca') desenharPoca(ctx, pt.x, pt.y, escala);
    // outros tipos (turbo/escudo/nuvem/ima) nunca chegam em `entidadesVisiveis` -- ver `corrida/itens.ts`.
  }
}

/** Bolha de gelo (escudo) ao redor de quem está protegido: ícone real (`escudo.webp`) translúcido pulsante;
 *  sem o ícone, cai no halo vetorial. Nunca esconde o sprite por baixo (alpha sempre < 1). Chamado 1x por quem
 *  tem `escudo` ativo (jogador OU rival), `xM`/`yM` já calculados por quem chama. */
export function desenharEscudo(ctx: CanvasRenderingContext2D, camera: EstadoCamera, xM: number, yM: number, tick: number): void {
  const pt = mundoParaTela(xM, yM + 0.8, camera, PX_POR_METRO);
  const escala = pxPorMetro(PX_POR_METRO, camera.zoom) / PX_POR_METRO;
  const pulso = 0.5 + 0.5 * Math.sin(tick * 0.15);
  const icone = assetsItensProntos()?.escudo;
  ctx.save();
  if (icone) {
    ctx.globalAlpha = 0.55 + 0.25 * pulso;
    const lado = (54 + pulso * 4) * escala;
    ctx.drawImage(icone, pt.x - lado / 2, pt.y - lado / 2, lado, lado);
  } else {
    ctx.globalAlpha = 0.3 + 0.2 * pulso;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 24 * escala, 0, Math.PI * 2);
    ctx.fillStyle = COR_ESCUDO;
    ctx.fill();
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = Math.max(1.5, 2 * escala);
    ctx.strokeStyle = '#eaffff';
    ctx.stroke();
  }
  ctx.restore();
}

/** Aviso "casco azul" (nuvem de granizo mirando, plano I-D2: "~2s de aviso"): ícone real (`nuvem.webp`) pulsante
 *  sobre a cabeça do alvo; sem o ícone, cai na bolha+"!" vetorial (mesma linguagem do aviso de obstáculo,
 *  `render/camada.ts: desenharSistemaAvisos`). */
export function desenharAvisoAlvo(ctx: CanvasRenderingContext2D, camera: EstadoCamera, xM: number, yM: number, tick: number): void {
  const pt = mundoParaTela(xM, yM + 1.8, camera, PX_POR_METRO);
  const pulso = 0.5 + 0.5 * Math.sin(tick * 0.25);
  const icone = assetsItensProntos()?.nuvem;
  ctx.save();
  ctx.globalAlpha = 0.6 + 0.3 * pulso;
  if (icone) {
    const lado = 34 + pulso * 6;
    ctx.drawImage(icone, pt.x - lado / 2, pt.y - lado / 2, lado, lado);
  } else {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 13 + pulso * 3, 0, Math.PI * 2);
    ctx.fillStyle = COR_AVISO_ALVO;
    ctx.fill();
    ctx.strokeStyle = COR_CONTORNO;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#06203b';
    ctx.font = '800 16px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('!', pt.x, pt.y + 1);
  }
  ctx.restore();
}
