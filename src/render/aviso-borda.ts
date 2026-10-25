/**
 * Aviso antecipado na BORDA da tela (pedido do dono, iPhone, 2026-10-24: "os obstáculos precisam chamar mais a
 * atenção... aviso antecipado na borda que aparece com tempo de reação"; reforçado no mesmo dia: "hoje é um
 * círculo de ~40px, faça bem maior (~70px lógicos), com o ícone do TIPO de obstáculo... na altura em que o
 * obstáculo vai aparecer"). Complementa o "!" flutuante que já existe sobre o galho (`criarSistemaAvisosObstaculo`
 * em `render/camada.ts`, ancorado no MUNDO -- só aparece quando o objeto já está perto o bastante da câmera para
 * caber na tela): este aqui acende ANTES disso, fixo na borda DIREITA da tela (o jogador sempre avança em +x,
 * tudo de novo entra pela direita -- `render/mundo.ts: mundoParaTela`), enquanto o perigo ainda está fora do
 * campo de visão, na ALTURA (eixo Y) em que ele vai mesmo aparecer.
 *
 * Gatilho: puramente geométrico, sem herdar `AVISO_SEGUNDOS` do motor (`descida/motor.ts`, que é só para o galho) --
 * um perigo "acende" quando, NO RITMO ATUAL (`velocidadeMs`), ele vai cruzar a borda direita visível em até
 * `LEAD_SEGUNDOS` (~1 s, o pedido exato do dono). Puramente render: só LÊ posições já resolvidas por quem chama
 * (`pista.objetos`/`camada.obstaculosAltos` via `coletarPerigosPista`, + poça do item em `ui/cenas/corrida.ts`,
 * que não mora em nenhuma lista de pista — ver `render/itens.ts`).
 *
 * Ícone por TIPO (pedido do dono): `duro` (pedra/tronco/pinheiro) e `poca` só são evitáveis pulando por cima
 * (a checagem de colisão do motor só roda com `p.modo === 'chao'`, `descida/motor.ts`) -- seta pra CIMA. `galho`
 * é a regra de agachar (plano C4) -- seta pra BAIXO, mesmo glifo da dica `desenharDicaAgachar`.
 */
import { PX_POR_METRO, LARGURA, ALTURA } from '../core/constantes';
import type { CamadaJogo, PistaGerada, TipoObjeto } from '../core/contratos';
import { larguraVisivelM, mundoParaTela, type EstadoCamera } from './mundo';
import { COR_PERIGO } from './objetos';
import { alturaDoTerreno } from './terreno';

/** Cópia COSMÉTICA de `pista/catalogo.ts: TIPOS_OBSTACULO_DURO` -- mesma razão/mesmo risco de `render/objetos.ts`
 *  (`render/` não importa `pista/`, ver memória `render-nao-pode-importar-pista`). */
const TIPOS_PERIGO_DURO: ReadonlySet<TipoObjeto> = new Set(['pedra', 'tronco', 'pinheiro']);

export interface PontoPerigo {
  readonly xM: number;
  /** Altura (metros, mundo) onde o PERIGO DE VERDADE vai aparecer -- o emblema de borda nasce nessa mesma altura
   *  de tela (via `mundoParaTela`), pra já avisar "olha pra cá" no lugar certo. */
  readonly yM: number;
  /** `'galho'` ganha a seta pra BAIXO (agachar); `'duro'`/`'poca'` ganham a seta pra CIMA (só dá pra evitar
   *  pulando por cima -- nenhum dos dois tem desvio por agachar no motor). */
  readonly tipo: 'duro' | 'galho' | 'poca';
}

/** Metros acima do chão onde cada tipo "mora" visualmente -- usado só pra mirar a ALTURA do emblema de borda. */
const ALTURA_VISUAL_DURO_M = 0.8;
const ALTURA_VISUAL_GALHO_M = 2.1;

/** Perigos ESTÁTICOS da pista (pedra/tronco/pinheiro + galho) -- chamar 1x na criação da cena (não muda por
 *  tick): `ui/cenas/descida.ts`/`corrida.ts` guardam o resultado e, na corrida, concatenam a poça (dinâmica,
 *  nasce/morre por item) a cada quadro. */
export function coletarPerigosPista(pista: PistaGerada, camada: CamadaJogo): PontoPerigo[] {
  const lista: PontoPerigo[] = [];
  for (const o of pista.objetos) {
    if (!TIPOS_PERIGO_DURO.has(o.tipo)) continue;
    const xM = o.x + o.largura / 2;
    lista.push({ xM, yM: alturaDoTerreno(pista, xM) + ALTURA_VISUAL_DURO_M, tipo: 'duro' });
  }
  for (const o of camada.obstaculosAltos) {
    const xM = o.x + o.largura / 2;
    lista.push({ xM, yM: alturaDoTerreno(pista, xM) + ALTURA_VISUAL_GALHO_M, tipo: 'galho' });
  }
  return lista;
}

/** ~1 s de antecedência (pedido do dono, textual: "use a velocidade: ~1s antes") -- distinto dos 1,5 s de
 *  `AVISO_SEGUNDOS` do motor (esse é só para o "!" do galho, ancorado no mundo; este é o aviso de BORDA). */
const LEAD_SEGUNDOS = 1;
/** Nunca empilha mais que isto (tela pequena, iPhone em paisagem) -- os mais próximos de aparecer vencem. */
const CAPACIDADE_VISIVEL = 3;
const MARGEM_BORDA_PX = 58;
/** Nunca cola no HUD de cima (velocidade/pontos, y<40) nem no botão de item/pausa embaixo. */
const Y_MIN_PX = ALTURA * 0.16;
const Y_MAX_PX = ALTURA * 0.78;
/** Raio do emblema -- ~70px lógicos de DIÂMETRO (pedido do dono, "faça bem maior"): a 1ª versão (triângulo de
 *  15px, depois círculo de 22px de raio/44px de diâmetro) ainda não "gritava" o bastante num print real do
 *  iPhone. Ver [[medir-antes-de-afirmar-hud-pequeno-precisa-ser-grande]]. */
const RAIO_EMBLEMA = 35;

/** Desenha até `CAPACIDADE_VISIVEL` emblemas pulsantes na borda direita, um por perigo que vai ENTRAR na tela em
 *  até `LEAD_SEGUNDOS` no ritmo atual, NA ALTURA (`yM`) em que ele vai aparecer -- some sozinho assim que o
 *  objeto real já está visível (o "!"/a própria arte do obstáculo assume a partir daí). Anel de brilho + emblema
 *  sólido PULSANDO EM TAMANHO (não só alfa -- movimento chama mais atenção que cor sozinha numa tela pequena) +
 *  seta grande desenhada (não um glifo de fonte pequeno). `tick` só anima o pulso (nunca decide o gatilho). */
export function desenharAvisosBorda(ctx: CanvasRenderingContext2D, perigos: readonly PontoPerigo[], camera: EstadoCamera, velocidadeMs: number, tick: number): void {
  if (perigos.length === 0 || velocidadeMs <= 0) return;
  const bordaDireitaM = camera.x + larguraVisivelM(camera, PX_POR_METRO) / 2;
  const leadM = velocidadeMs * LEAD_SEGUNDOS;

  const ativos = perigos
    .filter((p) => p.xM > bordaDireitaM && p.xM <= bordaDireitaM + leadM)
    .sort((a, b) => a.xM - b.xM) // o que vai aparecer PRIMEIRO na tela fica no topo, nunca a ordem de `pista.objetos`
    .slice(0, CAPACIDADE_VISIVEL);
  if (ativos.length === 0) return;

  const pulso = 0.5 + 0.5 * Math.sin(tick * 0.3);
  const x = LARGURA - MARGEM_BORDA_PX;
  const yUsados: number[] = [];

  ativos.forEach((p) => {
    // Quanto mais perto de entrar na tela, mais forte/maior o alerta (nunca "liga" de repente no limiar).
    const proximidade = 1 - Math.min(1, (p.xM - bordaDireitaM) / leadM);
    const forca = 0.5 + 0.5 * proximidade;
    const raio = RAIO_EMBLEMA * (0.88 + 0.14 * pulso) * (0.85 + 0.15 * proximidade);

    // Altura real de tela onde o perigo vai aparecer, com folga mínima contra o HUD/outro emblema já desenhado.
    let y = Math.max(Y_MIN_PX, Math.min(Y_MAX_PX, mundoParaTela(p.xM, p.yM, camera, PX_POR_METRO).y));
    for (const outro of yUsados) if (Math.abs(outro - y) < raio * 1.6) y = outro + raio * 1.6;
    yUsados.push(y);

    ctx.save();
    // Anel de brilho por fora, respirando mais que o emblema (mesmo vocabulário de `desenharAlertaObstaculo`).
    ctx.globalAlpha = (0.3 + 0.24 * pulso) * forca;
    ctx.fillStyle = COR_PERIGO;
    ctx.beginPath();
    ctx.arc(x, y, raio * 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.88 + 0.12 * forca;
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, Math.PI * 2);
    ctx.fillStyle = COR_PERIGO;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0b1a33';
    ctx.stroke();

    // Seta grande DESENHADA (não glifo de fonte): lê de longe num celular pequeno, pra cima (pular) ou pra baixo
    // (agachar) conforme o tipo.
    const paraCima = p.tipo !== 'galho';
    const s = raio * 0.62;
    ctx.save();
    ctx.translate(x, y);
    if (!paraCima) ctx.rotate(Math.PI);
    ctx.beginPath();
    ctx.moveTo(-s, s * 0.2);
    ctx.lineTo(0, -s);
    ctx.lineTo(s, s * 0.2);
    ctx.lineTo(s * 0.42, s * 0.2);
    ctx.lineTo(s * 0.42, s * 0.95);
    ctx.lineTo(-s * 0.42, s * 0.95);
    ctx.lineTo(-s * 0.42, s * 0.2);
    ctx.closePath();
    ctx.fillStyle = '#fff4f4';
    ctx.fill();
    ctx.restore();
    ctx.restore();
  });
}
