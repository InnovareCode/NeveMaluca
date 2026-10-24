/**
 * Indicadores visuais dos rivais da corrida (plano `docs/plano-corrida-campeonato.md` §C2b, redesenho "rivais na
 * pista de verdade" pedido pelo dono em 2026-10-24): quem está dentro da margem da tela é desenhado com o MESMO
 * sprite/escala/ancoragem do piloto do jogador (`render/piloto.ts: desenharPiloto`, reaproveitado aqui — nunca uma
 * bolha/anel/avatar circular), nome pequeno e discreto sobre a cabeça; quem já saiu da tela ganha uma seta na
 * borda com o rosto (sprite, se já carregado) e a distância relativa ao jogador ("+12 m"/"-8 m") -- esse indicador
 * de FORA da tela continua como estava (é HUD, não "rival em bolha" na pista).
 *
 * Só RENDER: recebe a posição de mundo (`xM`/`yM`) e a inclinação do terreno (`anguloGraus`) já calculadas por
 * quem chama (`ui/cenas/corrida.ts`) -- nunca consulta `pista/` (regra de camada, memória
 * `render-nao-pode-importar-pista`: `render/` só importa `core/`, `data/`, `assets/`) e nunca toca o motor.
 *
 * PENDÊNCIA conhecida (fora do alcance desta tela, registrada no handoff): `LeituraRivalCorrida` (`core/
 * contratos.ts`) só expõe `distancia`/`fase` de cada rival, não a leitura completa do motor dele (`pose`/`modo`/
 * `angulo`/`y` reais) nem os `EventoDescida` que disparariam takeoff/wobble/grab/estica-e-amassa visuais -- por
 * isso aqui cada rival sempre desenha numa pose "de pé" (ou de queda, quando `fase === 'tombo'`), nunca salta/gira
 * de verdade. Expor isso é mudança em `src/corrida/corrida.ts` (fora do escopo desta tarefa).
 */
import type { SpritePersonagem } from '../assets/index';
import { ALTURA, LARGURA, PX_POR_METRO } from '../core/constantes';
import type { PilotoLeitura } from '../core/contratos';
import { mundoParaTela, type EstadoCamera } from './mundo';
import { desenharPiloto } from './piloto';

const COR_TEXTO = '#f4f9ff';
const COR_CONTORNO = '#0b1a33';
/** Faixa de borda (px lógicos): um rival dentro dela já conta como "fora da tela" para a seta, não o anel. */
const MARGEM_BORDA_PX = 30;
const RAIO_AVATAR_SETA_PX = 13;
/** Dois rivais desenhados em tamanho real com centros mais perto que isto (px lógicos, tela) contam como
 * "amontoados": a plaquinha de nome de qualquer um dos dois sairia por cima do sprite do outro -- sem isto, no
 * início de uma corrida (pelotão fechado) os nomes empilham/atravessam uns aos outros e ficam ilegíveis. O sprite
 * em si continua desenhado (só o nome some) -- ver `desenharRivais`. */
const LIMIAR_COLADO_PX = 90;
/** Altura (m) acima do CHÃO (pés) onde o nome flutua -- fixa porque toda pose agora escala pro mesmo tamanho real
 * (`render/piloto.ts: ALTURA_ALVO_M`), então o topo da cabeça está sempre na mesma altura relativa aos pés. */
const ALTURA_NOME_M = 2.25;

export interface RivalVisual {
  readonly id: string;
  readonly nome: string;
  readonly cor: string;
  /** Posição no MUNDO: pés no chão da pista no x do rival (plano C-D2: sem colisão, cada motor é independente). */
  readonly xM: number;
  readonly yM: number;
  /** Inclinação do terreno (graus, convenção `core/trig.ts`) em `xM` -- aproxima o ângulo do corpo dele no chão. */
  readonly anguloGraus: number;
  /** `fase === 'tombo'` do motor dele: desenha numa pose de queda em vez da pose "de pé" padrão. */
  readonly emTombo: boolean;
  /** `rival.distancia - jogador.distancia`: positivo = na frente, negativo = atrás. */
  readonly distanciaRelativaM: number;
  /** Sprite já carregado (fire-and-forget), ou `null`/ausente -- cai no fallback (cápsula/ponto colorido). */
  readonly sprite?: SpritePersonagem | null | undefined;
}

/** Leitura sintética: só os campos que `desenharPiloto` de fato lê (x/y/angulo/modo/pose) -- os demais (vx/vy/
 * velocidade/grab/voltas/ticksNoAr) não existem pra um rival nesta tela (ver PENDÊNCIA no cabeçalho), zerados. */
function pilotoSinteticoDoRival(rival: RivalVisual): PilotoLeitura {
  return {
    x: rival.xM,
    y: rival.yM,
    vx: 0,
    vy: 0,
    velocidade: 0,
    angulo: rival.anguloGraus,
    anguloTerreno: rival.anguloGraus,
    modo: rival.emTombo ? 'tombo' : 'chao',
    pose: rival.emTombo ? 'fall1' : 'ride0',
    grab: null,
    voltas: 0,
    ticksNoAr: 0,
  };
}

function obterAvatar(sprite: RivalVisual['sprite']): CanvasImageSource | null {
  return sprite?.obterQuadro('ride0')?.imagem ?? null;
}

/** Avatar circular (só usado pelo indicador de FORA da tela): o sprite recortado em círculo, ou ponto colorido + inicial. */
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

/** Desenha todos os `rivais`: dentro da margem da tela, sprite em tamanho real (+ nome se não estiver amontoado
 * com outro rival, ver `LIMIAR_COLADO_PX`) -- ordenados por profundidade (`yTela` crescente) pra quem está mais à
 * frente na tela (mais embaixo) desenhar por CIMA de quem está mais atrás, legível mesmo no pelotão fechado do
 * início; fora da margem, seta+rosto+distância (esses nunca colidem entre si -- cada lado da borda tem no máximo
 * uma seta por altura `ALTURA * 0.42`, sempre a mesma). */
export function desenharRivais(ctx: CanvasRenderingContext2D, camera: EstadoCamera, rivais: readonly RivalVisual[]): void {
  const pontos = rivais.map((rival) => {
    const pt = mundoParaTela(rival.xM, rival.yM, camera, PX_POR_METRO);
    return { x: pt.x, y: pt.y, dentroDaTela: pt.x >= MARGEM_BORDA_PX && pt.x <= LARGURA - MARGEM_BORDA_PX };
  });

  const ordem = rivais.map((rival, i) => ({ rival, p: pontos[i]! })).sort((a, b) => a.p.y - b.p.y);

  for (const { rival, p } of ordem) {
    if (!p.dentroDaTela) {
      desenharRivalForaDeTela(ctx, p.x, rival);
      continue;
    }
    const colado = pontos.some((q, j) => rivais[j] !== rival && q.dentroDaTela && Math.hypot(p.x - q.x, p.y - q.y) < LIMIAR_COLADO_PX);
    desenharPiloto(ctx, pilotoSinteticoDoRival(rival), camera, rival.sprite ?? null);
    if (colado) continue;

    const topo = mundoParaTela(rival.xM, rival.yM + ALTURA_NOME_M, camera, PX_POR_METRO);
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.font = '700 12px Barlow, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = COR_CONTORNO;
    ctx.strokeText(rival.nome, topo.x, topo.y);
    ctx.fillStyle = COR_TEXTO;
    ctx.fillText(rival.nome, topo.x, topo.y);
    ctx.restore();
  }
}
