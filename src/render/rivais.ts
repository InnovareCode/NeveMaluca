/**
 * Indicadores visuais dos rivais da corrida (plano `docs/plano-corrida-campeonato.md` §C2b): quem está dentro da
 * margem da tela ganha um anel colorido + plaquinha de nome sobre a pista; quem já saiu da tela ganha uma seta na
 * borda com o rosto (sprite, se já carregado) e a distância relativa ao jogador ("+12 m"/"-8 m").
 *
 * Só RENDER: recebe a posição de mundo (`xM`/`yM`) já calculada por quem chama (`ui/cenas/corrida.ts`) -- nunca
 * consulta `pista/` (regra de camada, memória `render-nao-pode-importar-pista`: `render/` só importa `core/`,
 * `data/`, `assets/`) e nunca toca o motor.
 */
import type { SpritePersonagem } from '../assets/index';
import { ALTURA, LARGURA, PX_POR_METRO } from '../core/constantes';
import { mundoParaTela, type EstadoCamera } from './mundo';

const COR_TEXTO = '#f4f9ff';
const COR_CONTORNO = '#0b1a33';
/** Faixa de borda (px lógicos): um rival dentro dela já conta como "fora da tela" para a seta, não o anel. */
const MARGEM_BORDA_PX = 30;
const RAIO_AVATAR_PX = 15;
const RAIO_AVATAR_SETA_PX = 13;
/** Dois rivais na pista com centros mais perto que isto (px lógicos, tela) contam como "colados": a plaquinha de
 * nome de qualquer um dos dois sairia por cima da do outro (ou do anel dele), então nenhum dos dois mostra nome
 * -- só o anel+avatar, que já diferencia pela cor/rosto. Sem isto, no início de uma corrida (pelotão fechado) os
 * nomes empilham/atravessam uns aos outros e ficam ilegíveis. */
const LIMIAR_COLADO_PX = 58;

export interface RivalVisual {
  readonly id: string;
  readonly nome: string;
  readonly cor: string;
  /** Posição no MUNDO (chão da pista no x do rival, plano C-D2: sem colisão, cada motor é independente). */
  readonly xM: number;
  readonly yM: number;
  /** `rival.distancia - jogador.distancia`: positivo = na frente, negativo = atrás. */
  readonly distanciaRelativaM: number;
  /** Sprite já carregado (fire-and-forget), ou `null`/ausente -- cai no fallback de ponto colorido + inicial. */
  readonly sprite?: SpritePersonagem | null | undefined;
}

function obterAvatar(sprite: RivalVisual['sprite']): CanvasImageSource | null {
  return sprite?.obterQuadro('ride0')?.imagem ?? null;
}

/** Avatar circular: o sprite recortado em círculo, ou um ponto colorido com a inicial do nome (fallback). */
function desenharAvatarCircular(ctx: CanvasRenderingContext2D, x: number, y: number, raio: number, rival: RivalVisual): void {
  const avatar = obterAvatar(rival.sprite);
  ctx.save();
  if (avatar) {
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, x - raio, y - raio, raio * 2, raio * 2);
  } else {
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, Math.PI * 2);
    ctx.fillStyle = rival.cor;
    ctx.fill();
    ctx.fillStyle = COR_TEXTO;
    ctx.font = `800 ${Math.round(raio * 1.1)}px Barlow, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rival.nome.charAt(0).toUpperCase(), x, y + 1);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x, y, raio, 0, Math.PI * 2);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = rival.cor;
  ctx.stroke();
}

/** Rival visível na pista: anel colorido no chão + avatar; a plaquinha de nome só aparece quando `mostrarNome`
 * for true (false quando está "colado" a outro rival na tela -- ver `LIMIAR_COLADO_PX`, nomes se sobrepondo são
 * piores que não mostrar nome nenhum). */
function desenharRivalNaPista(ctx: CanvasRenderingContext2D, xTela: number, yTela: number, rival: RivalVisual, mostrarNome: boolean): void {
  ctx.save();

  // Anel no chão, marcando onde o rival está (indicador, não a física/pose completa do piloto real).
  ctx.beginPath();
  ctx.ellipse(xTela, yTela, 14, 7, 0, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = rival.cor;
  ctx.stroke();

  desenharAvatarCircular(ctx, xTela, yTela - 34, RAIO_AVATAR_PX, rival);

  if (mostrarNome) {
    ctx.font = '700 13px Barlow, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = COR_CONTORNO;
    ctx.strokeText(rival.nome, xTela, yTela - 54);
    ctx.fillStyle = COR_TEXTO;
    ctx.fillText(rival.nome, xTela, yTela - 54);
  }

  ctx.restore();
}

/** Rival fora da tela: seta na borda apontando para ele + rosto + distância relativa ao jogador. */
function desenharRivalForaDeTela(ctx: CanvasRenderingContext2D, xTela: number, rival: RivalVisual): void {
  const ladoDireita = xTela > LARGURA / 2;
  const x = ladoDireita ? LARGURA - MARGEM_BORDA_PX : MARGEM_BORDA_PX;
  const y = ALTURA * 0.42;
  const dir = ladoDireita ? 1 : -1;

  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.moveTo(dir * 14, 0);
  ctx.lineTo(dir * -6, -9);
  ctx.lineTo(dir * -6, 9);
  ctx.closePath();
  ctx.fillStyle = rival.cor;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.stroke();

  desenharAvatarCircular(ctx, dir * -30, 0, RAIO_AVATAR_SETA_PX, rival);

  const sinal = rival.distanciaRelativaM >= 0 ? '+' : '-';
  const texto = `${sinal}${Math.round(Math.abs(rival.distanciaRelativaM))} m`;
  ctx.font = '800 14px "Barlow Condensed", sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = COR_CONTORNO;
  ctx.strokeText(texto, dir * -30, 26);
  ctx.fillStyle = COR_TEXTO;
  ctx.fillText(texto, dir * -30, 26);

  ctx.restore();
}

/** Desenha todos os `rivais`: dentro da margem da tela, anel+avatar (+ nome se não estiver colado a outro rival,
 * ver `LIMIAR_COLADO_PX`); fora, seta+rosto+distância (esses nunca colidem entre si -- cada lado da borda tem no
 * máximo uma seta por altura `ALTURA * 0.42`, sempre a mesma). */
export function desenharRivais(ctx: CanvasRenderingContext2D, camera: EstadoCamera, rivais: readonly RivalVisual[]): void {
  const pontos = rivais.map((rival) => {
    const pt = mundoParaTela(rival.xM, rival.yM, camera, PX_POR_METRO);
    return { x: pt.x, y: pt.y, dentroDaTela: pt.x >= MARGEM_BORDA_PX && pt.x <= LARGURA - MARGEM_BORDA_PX };
  });

  rivais.forEach((rival, i) => {
    const p = pontos[i]!;
    if (!p.dentroDaTela) {
      desenharRivalForaDeTela(ctx, p.x, rival);
      return;
    }
    const colado = pontos.some((q, j) => j !== i && q.dentroDaTela && Math.hypot(p.x - q.x, p.y - q.y) < LIMIAR_COLADO_PX);
    desenharRivalNaPista(ctx, p.x, p.y, rival, !colado);
  });
}
