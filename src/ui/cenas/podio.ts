/**
 * Cena de pódio da pista (plano `docs/plano-corrida-campeonato.md` §C2b/C5a): mostra a ordem de chegada
 * (`ResultadoCorrida.ordem`) dos 6, com o jogador destacado, e volta ao chamador (`aoContinuar`) no toque/tecla.
 *
 * Redesenho "premium estilo Pixar" (`docs/direcao-ui-premium.md` §11.3 + comemoração §9.1): Fundo B da pista,
 * chão de neve subindo, 3 blocos de gelo com os personagens caindo/assentando, raios de glória + confete pro
 * jogador no top 3, Painel Geada com a lista do 4º ao 6º, moedas voando até o contador de flocos e CTA
 * CONTINUAR. A cena é criada exatamente quando a Nevasca revela (`campeonato.ts: trocarComNevasca`), então
 * `ticks`/`t` JÁ é "ticks desde a revelação" -- a linha do tempo do guia (em ms desde a revelação) usa `t`
 * direto, sem precisar de outro relógio.
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { IdPersonagem, IdTema, ResultadoCorrida } from '../../core/contratos';
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import { assetsItensProntos, precarregarAssetsItens } from '../../assets/itens';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { easeOutBack, easeOutCubic, escalonar, molaForte, msParaTicks, overshootPadrao, poseEntrada, prefereMovimentoReduzido, progresso } from '../animacao';
import { caminhoArredondado, desenharTexto, type CamadaEstatica } from '../desenho';
import { criarEstadoPressao, eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import {
  botao3D,
  desenharConfete,
  desenharLetreiro,
  desenharMoedaIcone,
  dicaTeclado,
  etiquetaVoce,
  medalhao,
  medirNomeAjustado,
  painelGeada,
  posicaoEmArco,
  raiosDeGloria,
  type FaceLetreiro,
} from '../kit-premium';
import type { Cena } from '../tipos';
import { obterFundoBDoTema } from './fundo-campeonato';

export interface OpcoesCenaPodio {
  readonly resultado: ResultadoCorrida;
  /** Nome de exibição por id (`DefPersonagem.nome`); id sem entrada cai no próprio id (nunca trava o pódio). */
  readonly nomesPorId: Readonly<Record<IdPersonagem, string>>;
  readonly idJogador: IdPersonagem;
  /** Nome de exibição da pista (`DefPista.nome`, ex. "Morro do Pinhão") -- sem ele cai no id cru (feedback do
   *  dono, 2026-10-24: a pílula mostrava "morro-do-pinhao" direto). */
  readonly nomePista?: string | undefined;
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  /** Tema da pista corrida, pro Fundo B (§3.2); sem ele cai num sólido simples. */
  readonly temaFundo?: IdTema | undefined;
  readonly aoContinuar?: (() => void) | undefined;
}

const COR_FUNDO = '#0b1a33';
const COR_TEXTO = '#f4f9ff';

const BOTAO_CONTINUAR: BotaoRetangular = { id: 'continuar', x: 628, y: 456, w: 300, h: 64 };
const CONTADOR_FLOCOS: BotaoRetangular = { id: 'flocos', x: 760, y: 20, w: 168, h: 48 };

interface BlocoPodio {
  readonly posicao: 1 | 2 | 3;
  readonly cx: number;
  readonly w: number;
  readonly topoY: number;
  readonly baseY: number;
  readonly numero: string;
  readonly face: FaceLetreiro;
  readonly pose: 'celeb' | 'star' | 'land';
  readonly alturaPersonagem: number;
}

const BLOCOS: readonly BlocoPodio[] = [
  { posicao: 2, cx: 200, w: 132, topoY: 356, baseY: 470, numero: '2', face: 'prata', pose: 'star', alturaPersonagem: 120 },
  { posicao: 1, cx: 340, w: 140, topoY: 318, baseY: 470, numero: '1', face: 'ouro', pose: 'celeb', alturaPersonagem: 130 },
  { posicao: 3, cx: 480, w: 132, topoY: 384, baseY: 470, numero: '3', face: 'bronze', pose: 'land', alturaPersonagem: 115 },
];

const PAINEL_456_X = 600;
const PAINEL_456_Y = 150;
const PAINEL_456_W = 328;
const PAINEL_456_H = 236;
const LINHA_456_ALTURA = 64;

// Linha do tempo da comemoração (§9.1), em ticks desde a revelação (= `t` desta cena).
const T_CHAO = msParaTicks(100);
const DUR_CHAO = msParaTicks(360);
const T_BLOCO: Readonly<Record<1 | 2 | 3, number>> = { 3: msParaTicks(200), 2: msParaTicks(340), 1: msParaTicks(480) };
const DUR_BLOCO = msParaTicks(420);
const ATRASO_PERSONAGEM_NO_BLOCO = msParaTicks(120);
const DUR_PERSONAGEM = msParaTicks(260);
const T_RAIOS = msParaTicks(1100);
const DUR_RAIOS = msParaTicks(700);
const T_CONFETE = msParaTicks(1150);
const T_CARIMBO_TITULO = msParaTicks(1200);
const T_LINHAS_456 = msParaTicks(1300);
const PASSO_LINHA_456 = msParaTicks(60);
const DUR_LINHA_456 = msParaTicks(360);
const T_MOEDAS = msParaTicks(1500);
const PASSO_MOEDA = msParaTicks(60);
const DUR_MOEDA = msParaTicks(520);
const QTD_MOEDAS = 8;
const T_CTA = msParaTicks(1900);

function corDoChao(): string {
  return '#E6F4FF';
}

/** Hash determinístico [0,1] do tick inteiro -- só pra direção da tremida do título (§9.1), sem `Math.random`. */
function hashTick(i: number): number {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

/** Chão de neve (§9.1 "faixa de neve do chão sobe de y560 para 470"): topo com montinhos (mesma técnica anti-
 *  serrilhado de `kit-premium.ts: desenharTampaDeNeve` -- base de todos os montinhos na MESMA altura). */
function desenharChaoDeNeve(ctx: Ctx, y: number): void {
  const passo = 30;
  const qtd = Math.ceil(LARGURA / passo) + 1;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-10, ALTURA + 10);
  ctx.lineTo(-10, y);
  for (let i = 0; i <= qtd; i += 1) {
    const px = i * passo;
    const raio = 13 + ((i * 37) % 7);
    ctx.arc(px, y, raio, Math.PI, 0, false);
  }
  ctx.lineTo(LARGURA + 10, ALTURA + 10);
  ctx.closePath();
  ctx.fillStyle = corDoChao();
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#0B1630';
  ctx.beginPath();
  ctx.moveTo(-10, y + 2);
  for (let i = 0; i <= qtd; i += 1) {
    const px = i * passo;
    const raio = 13 + ((i * 37) % 7);
    ctx.arc(px, y, raio, Math.PI, 0, false);
  }
  ctx.stroke();
  ctx.restore();
}

export function criarCenaPodio(opcoes: OpcoesCenaPodio): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  const reduzido = prefereMovimentoReduzido();
  const continuar = (): void => opcoes.aoContinuar?.();

  void precarregarAssetsItens();
  const sprites = new Map<IdPersonagem, SpritePersonagem>();
  for (const id of opcoes.resultado.ordem) {
    void carregarSpritePersonagem(id)
      .then((s) => sprites.set(id, s))
      .catch(() => undefined);
  }

  let fundo: CamadaEstatica | null = null;
  let hover = false;
  let ticks = 0;
  const pressao = criarEstadoPressao();

  const aoMover = (ev: Event): void => {
    const pt = eventoParaPontoLogico(ev as PointerEvent, opcoes.canvas);
    hover = pontoDentroDoBotao(pt, BOTAO_CONTINUAR);
  };

  const aoTecla = (ev: Event): void => {
    const e = ev as KeyboardEvent;
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') {
      pressao.marcar('continuar', ticks);
      continuar();
    }
  };

  const aoTocar = (ev: Event): void => {
    const pt = eventoParaPontoLogico(ev as PointerEvent, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_CONTINUAR)) {
      pressao.marcar('continuar', ticks);
      continuar();
    }
  };

  janela?.addEventListener('keydown', aoTecla);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  opcoes.canvas.addEventListener('pointerdown', aoTocar);

  const posicaoJogador = opcoes.resultado.ordem.indexOf(opcoes.idJogador) + 1;
  const noTop3 = posicaoJogador >= 1 && posicaoJogador <= 3;
  const titulo = posicaoJogador === 1 ? '1º LUGAR!' : noTop3 ? 'PÓDIO!' : 'QUASE!';
  const faceTitulo: FaceLetreiro = posicaoJogador === 1 ? 'ouro' : noTop3 ? 'prata' : 'gelo';

  function desenharBloco(ctx: Ctx, t: number, bloco: BlocoPodio): void {
    const t0 = T_BLOCO[bloco.posicao];
    const p = progresso(t, t0, DUR_BLOCO);
    const curva = reduzido ? 1 : easeOutBack(overshootPadrao(reduzido, 1.7))(p);
    if (p <= 0.001) return; // ainda nem começou a subir -- nada pra desenhar
    const deslocaY = (1 - curva) * 160;
    const topoYAtual = bloco.topoY + deslocaY;

    ctx.save();
    ctx.beginPath();
    caminhoArredondado(ctx, { x: bloco.cx - bloco.w / 2, y: topoYAtual, w: bloco.w, h: Math.max(1, bloco.baseY - topoYAtual) }, 10);
    const grad = ctx.createLinearGradient(0, topoYAtual, 0, bloco.baseY);
    grad.addColorStop(0, '#E9F7FF');
    grad.addColorStop(0.25, '#9FE3FF');
    grad.addColorStop(1, '#2A7DE1');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#0B1630';
    ctx.stroke();

    desenharTexto(ctx, bloco.numero, bloco.cx, topoYAtual + (bloco.baseY - topoYAtual) / 2, {
      fonte: `italic 800 ${bloco.posicao === 1 ? 60 : bloco.posicao === 2 ? 52 : 48}px "Barlow Condensed", Impact, sans-serif`,
      cor: bloco.face === 'ouro' ? '#FFD23F' : bloco.face === 'prata' ? '#DCE6F2' : '#E39A5B',
      contorno: 5,
      alinhamento: 'center',
      base: 'middle',
    });

    // Personagem caindo/assentando sobre o bloco (§8.5 "entra", simplificado via `poseEntrada`).
    const sprite = sprites.get(opcoes.resultado.ordem[bloco.posicao - 1] as IdPersonagem);
    const quadro = sprite ? (sprite.obterQuadro(bloco.pose) ?? sprite.obterQuadro('ride0')) : null;
    const referencia = sprite?.obterQuadro('ride0')?.dados ?? quadro?.dados;
    if (quadro && referencia) {
      const posePersonagem = poseEntrada(t, t0 + ATRASO_PERSONAGEM_NO_BLOCO, DUR_PERSONAGEM, reduzido, 140);
      if (posePersonagem.opacidade > 0.01) {
        const escala = bloco.alturaPersonagem / referencia.altura;
        const d = quadro.dados;
        const [ancoraX, ancoraY] = d.contato ?? d.pivo;
        ctx.save();
        ctx.globalAlpha = posePersonagem.opacidade;
        ctx.translate(bloco.cx, topoYAtual - posePersonagem.deslocaY);
        ctx.drawImage(quadro.imagem, -ancoraX * escala, -ancoraY * escala, d.largura * escala, d.altura * escala);
        ctx.restore();

        if (bloco.posicao === 1) {
          const pRaios = progresso(t, T_RAIOS, DUR_RAIOS);
          const escalaRaios = reduzido ? 1 : easeOutBack(overshootPadrao(reduzido, 2.6))(pRaios);
          if (pRaios > 0.001) raiosDeGloria(ctx, bloco.cx, topoYAtual - bloco.alturaPersonagem * 0.5, 'ouro', 220, escalaRaios, t * 0.133, 16);
        }

        if (opcoes.idJogador === opcoes.resultado.ordem[bloco.posicao - 1]) {
          etiquetaVoce(ctx, bloco.cx, topoYAtual - bloco.alturaPersonagem - 6, t);
        }
      }
    }
    ctx.restore();
  }

  return {
    id: 'podio',
    atualizar() {
      ticks += 1;
    },
    desenhar(ctx: Ctx, alpha: number) {
      const t = ticks + alpha;

      if (!fundo && doc && opcoes.temaFundo) fundo = obterFundoBDoTema(opcoes.temaFundo, doc);
      if (fundo) fundo.desenhar(ctx);
      else {
        ctx.save();
        ctx.fillStyle = COR_FUNDO;
        ctx.fillRect(0, 0, LARGURA, ALTURA);
        ctx.restore();
      }

      const pChao = easeOutCubic(progresso(t, T_CHAO, DUR_CHAO));
      desenharChaoDeNeve(ctx, 560 - 90 * pChao);

      // Blocos 3º/2º/1º, nessa ordem de entrada (mas o 1º fica no meio -- o array `BLOCOS` já está em ordem
      // visual esquerda->direita; a entrada é controlada por `T_BLOCO`, não pela ordem de desenho).
      for (const bloco of BLOCOS) desenharBloco(ctx, t, bloco);

      if (noTop3 && t >= T_CONFETE) desenharConfete(ctx, 'canhoes', 80, t - T_CONFETE);

      // Título com carimbo + tremida leve (§9.1 "1200: letreiro + tremida de 3px") -- só aparece em
      // `T_CARIMBO_TITULO` (não antes, senão "estreia" antes dos blocos/personagens que ele está anunciando).
      const pCarimboTitulo = progresso(t, T_CARIMBO_TITULO, msParaTicks(360));
      if (pCarimboTitulo > 0.001) {
        const curvaTitulo = reduzido ? 1 : molaForte(pCarimboTitulo);
        const escalaTitulo = reduzido ? 1 : 1.8 - 0.8 * curvaTitulo;
        const pTremida = progresso(t, T_CARIMBO_TITULO, msParaTicks(250));
        const tremidaX = reduzido || pTremida >= 1 ? 0 : (hashTick(Math.floor(t)) - 0.5) * 6 * (1 - pTremida);
        ctx.save();
        ctx.globalAlpha = Math.min(1, pCarimboTitulo * 3);
        ctx.translate(LARGURA / 2 + tremidaX, 62);
        ctx.scale(escalaTitulo, escalaTitulo);
        if (doc) desenharLetreiro(ctx, doc, titulo, 0, 0, 48, faceTitulo);
        else desenharTexto(ctx, titulo, 0, 0, { fonte: 'italic 800 48px "Barlow Condensed", Impact, sans-serif', cor: COR_TEXTO, contorno: 8, alinhamento: 'center', base: 'middle' });
        ctx.restore();
      }

      // Pílula com o nome da pista (nunca o id cru -- `nomePista` já vem resolvido do chamador).
      const nomePista = opcoes.nomePista ?? opcoes.resultado.pista;
      ctx.save();
      ctx.font = 'italic 800 16px "Barlow Condensed", Impact, sans-serif';
      const largNome = ctx.measureText(nomePista).width;
      const pw = largNome + 32;
      ctx.fillStyle = 'rgba(10,24,60,0.55)';
      caminhoArredondado(ctx, { x: LARGURA / 2 - pw / 2, y: 86, w: pw, h: 22 }, 11);
      ctx.fill();
      ctx.restore();
      desenharTexto(ctx, nomePista, LARGURA / 2, 97, { fonte: 'italic 800 16px "Barlow Condensed", Impact, sans-serif', cor: COR_TEXTO, alinhamento: 'center', base: 'middle' });

      // Painel Geada do 4º ao 6º.
      if (doc) painelGeada(ctx, doc, { x: PAINEL_456_X, y: PAINEL_456_Y, w: PAINEL_456_W, h: PAINEL_456_H });
      else {
        ctx.save();
        ctx.fillStyle = 'rgba(12,27,48,0.82)';
        ctx.fillRect(PAINEL_456_X, PAINEL_456_Y, PAINEL_456_W, PAINEL_456_H);
        ctx.restore();
      }
      const poses456: readonly ['ride0', 'wobble', 'fall2'] = ['ride0', 'wobble', 'fall2'];
      for (let i = 0; i < 3; i += 1) {
        const posicao = i + 4;
        const id = opcoes.resultado.ordem[posicao - 1];
        if (!id) continue;
        const ehJogador = id === opcoes.idJogador;
        // y40, não y20: a tampa de neve pendura gotas até ~38px abaixo do topo do painel -- y20 ficava embaixo
        // da tampa (medido no navegador, feedback do dono 2026-10-24).
        const linhaY = PAINEL_456_Y + 40 + i * LINHA_456_ALTURA;
        const t0 = T_LINHAS_456 + escalonar(i, PASSO_LINHA_456);
        const pose = poseEntrada(t, t0, DUR_LINHA_456, reduzido, 60);
        if (pose.opacidade <= 0.01) continue;

        ctx.save();
        ctx.globalAlpha = pose.opacidade;
        ctx.translate(pose.deslocaY, 0);

        if (ehJogador) {
          ctx.save();
          ctx.fillStyle = 'rgba(255, 210, 63, 0.16)';
          caminhoArredondado(ctx, { x: PAINEL_456_X + 8, y: linhaY, w: PAINEL_456_W - 16, h: LINHA_456_ALTURA - 8 }, 10);
          ctx.fill();
          ctx.restore();
        }

        medalhao(ctx, PAINEL_456_X + 36, linhaY + LINHA_456_ALTURA / 2 - 4, 36, 'vidro', (ictx) => {
          ictx.textAlign = 'center';
          ictx.textBaseline = 'middle';
          ictx.font = 'italic 800 18px "Barlow Condensed", Impact, sans-serif';
          ictx.fillStyle = '#ffffff';
          ictx.fillText(String(posicao), 0, 1);
        });

        const sprite = sprites.get(id);
        const quadro = sprite ? (sprite.obterQuadro(poses456[i] as string) ?? sprite.obterQuadro('ride0')) : null;
        const referencia = sprite?.obterQuadro('ride0')?.dados ?? quadro?.dados;
        if (quadro && referencia) {
          const escala = 52 / referencia.altura;
          const d = quadro.dados;
          const [ancoraX, ancoraY] = d.contato ?? d.pivo;
          ctx.save();
          ctx.translate(PAINEL_456_X + 86, linhaY + LINHA_456_ALTURA - 6);
          ctx.drawImage(quadro.imagem, -ancoraX * escala, -ancoraY * escala, d.largura * escala, d.altura * escala);
          ctx.restore();
        }

        // Largura disponível = painel - início do nome (120) - margem direita (20) - reserva pro tempo (~65,
        // "40.6 s" + folga).
        const fonteNome = (tamanho: number) => `italic 800 ${tamanho}px "Barlow Condensed", Impact, sans-serif`;
        const nomeAjustado = medirNomeAjustado(ctx, opcoes.nomesPorId[id] ?? id, ehJogador, PAINEL_456_W - 120 - 20 - 65, fonteNome, 20);
        desenharTexto(ctx, nomeAjustado.texto, PAINEL_456_X + 120, linhaY + LINHA_456_ALTURA / 2 - 4, {
          fonte: fonteNome(nomeAjustado.tamanho),
          cor: ehJogador ? '#FFD23F' : '#ffffff',
          base: 'middle',
        });
        const segundos = ((opcoes.resultado.ticks[id] ?? 0) / 60).toFixed(1);
        desenharTexto(ctx, `${segundos} s`, PAINEL_456_X + PAINEL_456_W - 20, linhaY + LINHA_456_ALTURA / 2 - 4, {
          fonte: '700 17px Barlow, sans-serif',
          cor: COR_TEXTO,
          alinhamento: 'right',
          base: 'middle',
        });
        ctx.restore();
      }

      // Contador de flocos + moedas voando do personagem do jogador até a pílula (§9.1 "1500: flocos ganhos").
      const icones = assetsItensProntos();
      const flocosGanhos = opcoes.resultado.flocosGanhos;
      let chegadas = 0;
      const origemMoedas = noTop3
        ? { x: BLOCOS.find((b) => b.posicao === posicaoJogador)?.cx ?? LARGURA / 2, y: (BLOCOS.find((b) => b.posicao === posicaoJogador)?.topoY ?? 400) - 60 }
        : { x: PAINEL_456_X + 86, y: PAINEL_456_Y + 40 };
      const destinoMoedas = { x: CONTADOR_FLOCOS.x + 30, y: CONTADOR_FLOCOS.y + CONTADOR_FLOCOS.h / 2 };
      let tUltimaChegada = -1000;
      for (let i = 0; i < QTD_MOEDAS && flocosGanhos > 0; i += 1) {
        const t0 = T_MOEDAS + escalonar(i, PASSO_MOEDA);
        const p = progresso(t, t0, DUR_MOEDA);
        if (p >= 1) {
          chegadas += 1;
          tUltimaChegada = Math.max(tUltimaChegada, t0 + DUR_MOEDA);
          continue;
        }
        if (p <= 0) continue;
        const pos = posicaoEmArco(origemMoedas, destinoMoedas, p);
        desenharMoedaIcone(ctx, icones?.flocoDourado ?? null, pos.x, pos.y, 22);
      }
      const flocosExibidos = flocosGanhos > 0 ? Math.round((flocosGanhos * Math.min(chegadas, QTD_MOEDAS)) / QTD_MOEDAS) : 0;
      const pulsoContador = t - tUltimaChegada < 10 ? 1 + 0.12 * (1 - (t - tUltimaChegada) / 10) : 1;

      ctx.save();
      ctx.fillStyle = 'rgba(10,24,60,0.55)';
      caminhoArredondado(ctx, CONTADOR_FLOCOS, CONTADOR_FLOCOS.h / 2);
      ctx.fill();
      ctx.restore();
      desenharMoedaIcone(ctx, icones?.flocoDourado ?? null, CONTADOR_FLOCOS.x + 30, CONTADOR_FLOCOS.y + CONTADOR_FLOCOS.h / 2, 30);
      ctx.save();
      ctx.translate(CONTADOR_FLOCOS.x + CONTADOR_FLOCOS.w - 18, CONTADOR_FLOCOS.y + CONTADOR_FLOCOS.h / 2);
      ctx.scale(pulsoContador, pulsoContador);
      desenharTexto(ctx, `+${flocosExibidos}`, 0, 0, { fonte: 'italic 800 24px "Barlow Condensed", Impact, sans-serif', cor: '#FFD23F', alinhamento: 'right', base: 'middle' });
      ctx.restore();

      // Itens (se vierem) -- `ResultadoCorrida.itens` opcional (acertosDados/acertosSofridos).
      if (opcoes.resultado.itens) {
        const yItens = CONTADOR_FLOCOS.y + CONTADOR_FLOCOS.h + 10;
        const desenharPilulaItem = (icone: 'bola' | 'nuvem', valor: number, x: number): void => {
          ctx.save();
          ctx.fillStyle = 'rgba(10,24,60,0.5)';
          caminhoArredondado(ctx, { x, y: yItens, w: 76, h: 30 }, 15);
          ctx.fill();
          ctx.restore();
          const img = icones?.[icone];
          if (img) ctx.drawImage(img, x + 6, yItens + 3, 24, 24);
          desenharTexto(ctx, String(valor), x + 60, yItens + 15, { fonte: '700 16px Barlow, sans-serif', cor: COR_TEXTO, alinhamento: 'right', base: 'middle' });
        };
        desenharPilulaItem('bola', opcoes.resultado.itens.acertosDados, CONTADOR_FLOCOS.x + 2);
        desenharPilulaItem('nuvem', opcoes.resultado.itens.acertosSofridos, CONTADOR_FLOCOS.x + 90);
      }

      const poseCTA = poseEntrada(t, T_CTA, msParaTicks(360), reduzido, 20);
      if (poseCTA.opacidade > 0.01) {
        const poseP = pressao.pose('continuar', ticks);
        ctx.save();
        ctx.globalAlpha = poseCTA.opacidade;
        ctx.translate(0, poseCTA.deslocaY);
        botao3D(ctx, { ...BOTAO_CONTINUAR, texto: 'CONTINUAR', tipo: 'primario', destaque: true, aoVivo: hover, t, pressionado: poseP.pressionado, escalaExtra: poseP.escalaExtra });
        ctx.restore();
      }

      // Nem acima de y108 (carteira de flocos + itens) nem perto de y150 (a tampa do Painel 4º-6º, cujo canto
      // direito também bate em x928) -- desce pro espaço livre entre o painel (fim em y386) e o CTA (início em
      // y456), medido no navegador (feedback do dono, 2026-10-24).
      dicaTeclado(ctx, 'ESPAÇO continua', 928, 418);
    },
    destruir() {
      janela?.removeEventListener('keydown', aoTecla);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
    },
  };
}
