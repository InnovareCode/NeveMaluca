/**
 * Oficina de upgrade entre pistas (plano `docs/plano-corrida-campeonato.md` §C-D3/C-D4, C5a/C6, C8b): gasta flocos
 * pra subir UM nível do personagem (`data/evolucao.ts` → `comprarNivel`, um nível só, melhora os 3 atributos
 * juntos -- "giro fora", plano C-D4). Quem persiste é o chamador (`aoComprar`); a tela sempre LÊ o estado fresco
 * por `obterEvolucao()` a cada quadro, nunca um valor cacheado na criação.
 *
 * Redesenho "premium estilo Pixar" (`docs/direcao-ui-premium.md` §11.5 + comemoração §9.4): Fundo B com luz de
 * lampião, personagem em `sig` com medalhão de nível e pips, Painel Geada com as 3 barras (preview fantasma do
 * próximo nível) e o preço, COMPRAR como primário (ou CONTINUAR, se não der pra comprar), animação de compra com
 * moedas voando, pulo do personagem, anel de choque e balão "NÍVEL N!".
 *
 * PENDÊNCIA conhecida (não é desta tela): `aplicarEvolucao` (a física do upgrade, C6, Vega, `descida/atributos.ts`)
 * ainda não existe -- o nível comprado aqui fica gravado no save, mas por ora não muda a física da descida.
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { Evolucao, IdPersonagem } from '../../core/contratos';
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import { assetsItensProntos, precarregarAssetsItens } from '../../assets/itens';
import { ATRIBUTOS_EVOLUCAO, NIVEL_MAXIMO_EVOLUCAO, PASSO_ATRIBUTO_POR_NIVEL, custoDoNivel, type AtributoEvolucao } from '../../data/evolucao';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { easeOutBack, easeOutCubic, escalonar, lerp, molaForte, msParaTicks, overshootPadrao, prefereMovimentoReduzido, progresso } from '../animacao';
import { desenharTexto, type CamadaEstatica } from '../desenho';
import { criarEstadoPressao, eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import { balaoDeFala, barraAtributo, botao3D, desenharLetreiro, desenharMoedaIcone, dicaTeclado, medalhao, painelGeada, posicaoEmArco, type AtributoPersonagem, type TipoBotao3D } from '../kit-premium';
import type { Cena } from '../tipos';
import { obterFundoBDoTema } from './fundo-campeonato';

export interface OpcoesCenaOficina {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly personagem: IdPersonagem;
  readonly nomePersonagem: string;
  /** Lido a cada quadro (não cacheado): reflete a compra na hora. */
  readonly obterEvolucao: () => Evolucao;
  /** Quem persiste é o chamador; esta tela só avisa que o jogador tocou "comprar". */
  readonly aoComprar: () => void;
  readonly aoContinuar: () => void;
}

const NOME_ATRIBUTO: Readonly<Record<AtributoEvolucao, string>> = {
  velocidade: 'Velocidade',
  equilibrio: 'Equilíbrio',
  forca: 'Força',
};
const ATRIBUTO_PARA_KIT: Readonly<Record<AtributoEvolucao, AtributoPersonagem>> = {
  velocidade: 'velocidade',
  equilibrio: 'equilibrio',
  forca: 'forca',
};

const COR_TEXTO = '#f4f9ff';
const COR_SOL = '#FFD23F';

const PAINEL_X = 430;
const PAINEL_Y = 100;
const PAINEL_W = 498;
const PAINEL_H = 300;

const BOTAO_COMPRAR: BotaoRetangular = { id: 'comprar', x: PAINEL_X + PAINEL_W / 2 - 150, y: PAINEL_Y + 220, w: 300, h: 64 };
const BOTAO_CONTINUAR: BotaoRetangular = { id: 'continuar', x: 708, y: 466, w: 220, h: 54 };
const CARTEIRA: BotaoRetangular = { id: 'carteira', x: 760, y: 20, w: 168, h: 48 };

const PALCO_CX = 230;
const PALCO_PES_Y = 392;
const ALTURA_PERSONAGEM = 150;

// Sequência de compra (§9.4), ticks desde o toque em COMPRAR (0 = `tCompra`).
const DUR_MOEDAS_SAINDO = msParaTicks(450);
const PASSO_MOEDA = msParaTicks(40);
const QTD_MOEDAS_COMPRA = 10;
const T_AGACHA = msParaTicks(520);
const DUR_AGACHA = msParaTicks(120);
const T_PULO = T_AGACHA + DUR_AGACHA;
const DUR_PULO = msParaTicks(260);
const T_POUSO = T_PULO + DUR_PULO + msParaTicks(220);
const T_BARRAS = T_POUSO + msParaTicks(100);
const DUR_BARRAS = msParaTicks(500);
const T_BALAO = T_POUSO + msParaTicks(150);
const DUR_BALAO = msParaTicks(1200);

export function criarCenaOficina(opcoes: OpcoesCenaOficina): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  const reduzido = prefereMovimentoReduzido();
  // Lido de novo A CADA quadro (ver `standings-campeonato.ts`): 1 chamada só na criação da cena fica `null` pra
  // sempre se o raster não estava pronto NAQUELE instante exato (quase nunca está, a Nevasca revela e constrói
  // na hora). Achado rodando um campeonato de verdade, 2026-10-24.
  let fundo: CamadaEstatica | null = null; // oficina é "base", não uma pista específica -- mesmo tema key art do menu

  void precarregarAssetsItens();
  let sprite: SpritePersonagem | null = null;
  void carregarSpritePersonagem(opcoes.personagem)
    .then((s) => {
      sprite = s;
    })
    .catch(() => undefined);

  let hover: string | null = null;
  let ticks = 0;
  const pressao = criarEstadoPressao();
  // Nível/custo no instante da compra (congelados pra animar "do nível antigo pro novo" mesmo depois que
  // `obterEvolucao()` já reflete o novo valor no quadro seguinte à chamada de `aoComprar`).
  let nivelAntesDaCompra = -1;
  let tCompra = -100000;
  let tTremer = -100000; // §4.3 "desativado tocado: treme no eixo x"

  const aoMover = (e: Event): void => {
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_COMPRAR)) hover = 'comprar';
    else if (pontoDentroDoBotao(pt, BOTAO_CONTINUAR)) hover = 'continuar';
    else hover = null;
  };

  const aoTocar = (e: Event): void => {
    e.preventDefault?.();
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_COMPRAR)) {
      const evolucao = opcoes.obterEvolucao();
      const nivelAtual = evolucao.niveis[opcoes.personagem] ?? 0;
      const noMaximo = nivelAtual >= NIVEL_MAXIMO_EVOLUCAO;
      const custo = custoDoNivel(nivelAtual + 1);
      const temFlocos = custo !== undefined && evolucao.flocos >= custo;
      if (noMaximo || !temFlocos) {
        tTremer = ticks;
        return;
      }
      pressao.marcar('comprar', ticks);
      nivelAntesDaCompra = nivelAtual;
      tCompra = ticks;
      opcoes.aoComprar();
    } else if (pontoDentroDoBotao(pt, BOTAO_CONTINUAR)) {
      pressao.marcar('continuar', ticks);
      opcoes.aoContinuar();
    }
  };

  const aoTeclar = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.code === 'Enter' || ev.code === 'Space') opcoes.aoContinuar();
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  janela?.addEventListener('keydown', aoTeclar);

  return {
    id: 'campeonato-oficina',
    atualizar() {
      ticks += 1;
    },
    desenhar(ctx: Ctx, alpha: number) {
      const t = ticks + alpha;
      if (!fundo && doc) fundo = obterFundoBDoTema('parque', doc);
      fundo?.desenhar(ctx);
      if (!fundo) {
        ctx.save();
        ctx.fillStyle = '#0b1a33';
        ctx.fillRect(0, 0, LARGURA, ALTURA);
        ctx.restore();
      }

      // Luz de lampião (§11.5): radial tangerina com `lighter` -- é uma oficina, luz quente.
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const luz = ctx.createRadialGradient(300, 120, 10, 300, 120, 380);
      luz.addColorStop(0, 'rgba(255, 138, 31, 0.18)');
      luz.addColorStop(1, 'rgba(255, 138, 31, 0)');
      ctx.fillStyle = luz;
      ctx.fillRect(0, 0, LARGURA, ALTURA);
      ctx.restore();

      if (doc) desenharLetreiro(ctx, doc, 'OFICINA DA MONTANHA', LARGURA / 2, 56, 36, 'marca');
      else desenharTexto(ctx, 'OFICINA DA MONTANHA', LARGURA / 2, 56, { fonte: 'italic 800 36px "Barlow Condensed", Impact, sans-serif', cor: COR_TEXTO, contorno: 6, alinhamento: 'center' });

      const evolucao = opcoes.obterEvolucao();
      const nivelAgora = evolucao.niveis[opcoes.personagem] ?? 0;
      const comprandoAgora = t >= tCompra && t < tCompra + DUR_BALAO + msParaTicks(300);
      // Durante a animação de compra, o nível "visual" (pra barras/medalhão) só troca em `T_BARRAS` -- antes
      // disso ainda mostra o nível ANTIGO, mesmo que `obterEvolucao()` já tenha o novo (a UI e o dado divergem
      // de propósito por ~900ms pra dar tempo da encenação, igual ao guia descreve em §9.4).
      const nivelVisual = comprandoAgora && t - tCompra < T_BARRAS ? nivelAntesDaCompra : nivelAgora;
      const noMaximo = nivelAgora >= NIVEL_MAXIMO_EVOLUCAO;
      const custo = custoDoNivel(nivelAgora + 1);
      const temFlocos = custo !== undefined && evolucao.flocos >= custo;

      // Carteira.
      ctx.save();
      ctx.fillStyle = 'rgba(10,24,60,0.55)';
      ctx.beginPath();
      ctx.moveTo(CARTEIRA.x + 24, CARTEIRA.y);
      ctx.arcTo(CARTEIRA.x + CARTEIRA.w, CARTEIRA.y, CARTEIRA.x + CARTEIRA.w, CARTEIRA.y + CARTEIRA.h, 24);
      ctx.arcTo(CARTEIRA.x + CARTEIRA.w, CARTEIRA.y + CARTEIRA.h, CARTEIRA.x, CARTEIRA.y + CARTEIRA.h, 24);
      ctx.arcTo(CARTEIRA.x, CARTEIRA.y + CARTEIRA.h, CARTEIRA.x, CARTEIRA.y, 24);
      ctx.arcTo(CARTEIRA.x, CARTEIRA.y, CARTEIRA.x + CARTEIRA.w, CARTEIRA.y, 24);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      const icones = assetsItensProntos();
      desenharMoedaIcone(ctx, icones?.flocoDourado ?? null, CARTEIRA.x + 30, CARTEIRA.y + CARTEIRA.h / 2, 32);
      // Contador desce contando (§9.4 "o contador desce contando em 400ms") -- simplificado como lerp direto.
      const pSaldo = easeOutCubic(progresso(t, tCompra, DUR_MOEDAS_SAINDO));
      const saldoExibido = comprandoAgora && custo !== undefined ? Math.round(lerp(evolucao.flocos + (custo ?? 0), evolucao.flocos, pSaldo)) : evolucao.flocos;
      desenharTexto(ctx, String(saldoExibido), CARTEIRA.x + CARTEIRA.w - 16, CARTEIRA.y + CARTEIRA.h / 2, {
        fonte: 'italic 800 28px "Barlow Condensed", Impact, sans-serif',
        cor: COR_SOL,
        alinhamento: 'right',
        base: 'middle',
      });

      // Palco: personagem com agachar/pular/pousar na compra (§9.4), e pips de nível.
      let deslocaY = 0;
      let poseAnim: 'sig' | 'grabUp' | 'land' = 'sig';
      if (comprandoAgora) {
        const e = t - tCompra;
        if (e >= T_AGACHA && e < T_PULO) {
          poseAnim = 'sig';
        } else if (e >= T_PULO && e < T_PULO + DUR_PULO) {
          poseAnim = 'grabUp';
          const p = easeOutCubic(progresso(t, tCompra + T_PULO, DUR_PULO));
          deslocaY = -60 * Math.sin(Math.PI * p);
        } else if (e >= T_PULO + DUR_PULO && e < T_POUSO) {
          poseAnim = 'grabUp';
        } else if (e >= T_POUSO) {
          poseAnim = 'land';
        }
      }

      const sprite2 = sprite;
      const quadro = sprite2 ? (sprite2.obterQuadro(poseAnim) ?? sprite2.obterQuadro('sig') ?? sprite2.obterQuadro('ride0')) : null;
      const referencia = sprite2?.obterQuadro('ride0')?.dados ?? quadro?.dados;
      if (quadro && referencia) {
        const escala = ALTURA_PERSONAGEM / referencia.altura;
        const d = quadro.dados;
        const [ax, ay] = d.contato ?? d.pivo;
        ctx.save();
        ctx.translate(PALCO_CX, PALCO_PES_Y + deslocaY);
        ctx.drawImage(quadro.imagem, -ax * escala, -ay * escala, d.largura * escala, d.altura * escala);
        ctx.restore();

        // Anel de choque no pouso (§9.4).
        if (comprandoAgora) {
          const pAnel = progresso(t, tCompra + T_POUSO, msParaTicks(400));
          if (pAnel > 0 && pAnel < 1) {
            ctx.save();
            ctx.globalAlpha = 1 - pAnel;
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#9FE3FF';
            ctx.beginPath();
            ctx.arc(PALCO_CX, PALCO_PES_Y, lerp(20, 120, pAnel), 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      medalhao(ctx, PALCO_CX + 60, PALCO_PES_Y - ALTURA_PERSONAGEM + 20, 56, 'vidro', (ictx) => {
        const pCarimbo = comprandoAgora ? progresso(t, tCompra + T_BARRAS, msParaTicks(360)) : 1;
        const escalaCarimbo = reduzido ? 1 : 1 + 0.8 * (1 - molaForte(Math.min(1, pCarimbo)));
        ictx.save();
        ictx.scale(escalaCarimbo, escalaCarimbo);
        ictx.textAlign = 'center';
        ictx.textBaseline = 'middle';
        ictx.font = 'italic 800 16px "Barlow Condensed", Impact, sans-serif';
        ictx.fillStyle = '#ffffff';
        ictx.fillText(`NV ${nivelVisual}`, 0, 1);
        ictx.restore();
      });

      for (let i = 0; i < NIVEL_MAXIMO_EVOLUCAO; i += 1) {
        const x = PALCO_CX - (NIVEL_MAXIMO_EVOLUCAO * 9) / 2 + i * 18;
        ctx.save();
        ctx.translate(x, PALCO_PES_Y + 36);
        ctx.fillStyle = i < nivelVisual ? COR_SOL : 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (doc) painelGeada(ctx, doc, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: PAINEL_H });
      else {
        ctx.save();
        ctx.fillStyle = 'rgba(12,27,48,0.82)';
        ctx.fillRect(PAINEL_X, PAINEL_Y, PAINEL_W, PAINEL_H);
        ctx.restore();
      }

      // y48, não y34: a tampa de neve (kit-premium.ts) pendura gotas até ~38px abaixo do topo do painel (pingente
      // longo); y34 ficava embaixo da tampa (medido no navegador, feedback do dono 2026-10-24).
      desenharTexto(ctx, `Próximo nível (${nivelAgora + 1}) melhora:`, PAINEL_X + 24, PAINEL_Y + 48, { fonte: '700 18px Barlow, sans-serif', cor: COR_TEXTO });

      const pBarras = easeOutBack(overshootPadrao(reduzido))(progresso(t, tCompra + T_BARRAS, DUR_BARRAS));
      ATRIBUTOS_EVOLUCAO.forEach((atributo, indice) => {
        const y = PAINEL_Y + 74 + indice * 44;
        desenharTexto(ctx, NOME_ATRIBUTO[atributo], PAINEL_X + 24, y, { fonte: '600 18px Barlow, sans-serif', cor: COR_TEXTO, base: 'middle' });

        const bonusDe = nivelVisual * PASSO_ATRIBUTO_POR_NIVEL;
        const bonusMax = NIVEL_MAXIMO_EVOLUCAO * PASSO_ATRIBUTO_POR_NIVEL;
        const bonusAtual = Math.min(nivelAgora, NIVEL_MAXIMO_EVOLUCAO) * PASSO_ATRIBUTO_POR_NIVEL;
        const bonusProximo = Math.min(nivelAgora + 1, NIVEL_MAXIMO_EVOLUCAO) * PASSO_ATRIBUTO_POR_NIVEL;
        const bonusMostrado = comprandoAgora && t - tCompra >= T_BARRAS ? lerp(bonusDe, bonusAtual, Math.min(1, pBarras)) : bonusDe;

        barraAtributo(ctx, PAINEL_X + 150, y - 9, 220, 18, ATRIBUTO_PARA_KIT[atributo], bonusMostrado / bonusMax, noMaximo ? 0 : (bonusProximo - bonusAtual) / bonusMax);

        desenharTexto(ctx, noMaximo ? `+${bonusAtual}` : `+${bonusAtual} → +${bonusProximo}`, PAINEL_X + PAINEL_W - 24, y, {
          fonte: '700 15px Barlow, sans-serif',
          cor: noMaximo ? '#8fd99f' : COR_SOL,
          alinhamento: 'right',
          base: 'middle',
        });
      });

      desenharTexto(ctx, noMaximo ? 'Nível máximo atingido' : '', PAINEL_X + PAINEL_W / 2, PAINEL_Y + PAINEL_H - 56, { fonte: '600 15px Barlow, sans-serif', cor: '#8fb6e0', alinhamento: 'center' });
      if (!noMaximo) {
        ctx.save();
        ctx.translate(PAINEL_X + PAINEL_W / 2 - 30, PAINEL_Y + PAINEL_H - 56);
        desenharMoedaIcone(ctx, icones?.flocoDourado ?? null, 0, 0, 26);
        ctx.restore();
        desenharTexto(ctx, `Custa ${custo ?? '?'}`, PAINEL_X + PAINEL_W / 2 + 4, PAINEL_Y + PAINEL_H - 56, { fonte: 'italic 800 22px "Barlow Condensed", Impact, sans-serif', cor: COR_TEXTO, base: 'middle' });
      }

      const eTremer = t - tTremer;
      const DUR_TREMER = msParaTicks(300);
      const tremerX = eTremer >= 0 && eTremer < DUR_TREMER ? Math.sin(eTremer * 0.9) * 6 * (1 - eTremer / DUR_TREMER) : 0;
      const posePrimario = pressao.pose('comprar', ticks);
      const tipoComprar: TipoBotao3D = noMaximo ? 'confirmar' : !temFlocos ? 'desativado' : 'primario';
      ctx.save();
      ctx.translate(tremerX, 0);
      botao3D(ctx, {
        ...BOTAO_COMPRAR,
        texto: noMaximo ? 'NÍVEL MÁXIMO' : `COMPRAR NÍVEL ${nivelAgora + 1}`,
        tipo: tipoComprar,
        destaque: !noMaximo && temFlocos,
        aoVivo: hover === 'comprar',
        t,
        pressionado: posePrimario.pressionado,
        escalaExtra: posePrimario.escalaExtra,
      });
      ctx.restore();

      // Moedas saindo do contador até o personagem (§9.4 "80: 10 moedas saem do contador... até o personagem").
      if (comprandoAgora) {
        for (let i = 0; i < QTD_MOEDAS_COMPRA; i += 1) {
          const t0 = tCompra + msParaTicks(80) + escalonar(i, PASSO_MOEDA);
          const p = progresso(t, t0, DUR_MOEDAS_SAINDO);
          if (p <= 0 || p >= 1) continue;
          const pos = posicaoEmArco({ x: CARTEIRA.x + 30, y: CARTEIRA.y + CARTEIRA.h / 2 }, { x: PALCO_CX, y: PALCO_PES_Y - ALTURA_PERSONAGEM * 0.5 }, p);
          desenharMoedaIcone(ctx, icones?.flocoDourado ?? null, pos.x, pos.y, 16);
        }

        const pBalao = progresso(t, tCompra + T_BALAO, DUR_BALAO);
        if (pBalao > 0 && pBalao < 1) {
          const subida = -30 * Math.min(1, pBalao * 4);
          ctx.save();
          ctx.globalAlpha = pBalao > 0.8 ? (1 - pBalao) * 5 : 1;
          balaoDeFala(ctx, `NÍVEL ${nivelAgora}!`, PALCO_CX, PALCO_PES_Y - ALTURA_PERSONAGEM - 30 + subida, 'baixo', 24);
          ctx.restore();
        }
      }

      const tipoContinuar: TipoBotao3D = noMaximo || !temFlocos ? 'primario' : 'secundario';
      const poseContinuar = pressao.pose('continuar', ticks);
      botao3D(ctx, {
        ...BOTAO_CONTINUAR,
        texto: 'CONTINUAR',
        tipo: tipoContinuar,
        destaque: tipoContinuar === 'primario',
        aoVivo: hover === 'continuar',
        t,
        pressionado: poseContinuar.pressionado,
        escalaExtra: poseContinuar.escalaExtra,
      });

      // Nem embaixo da carteira (y20-68, só 16px de folga até a tampa do painel em y84) nem sobre a tampa do
      // Painel Geada (PAINEL_X+PAINEL_W = 928 por coincidência, bate exatamente com o canto de sempre) -- desce
      // pro espaço livre acima do CTA, medido no navegador (feedback do dono, 2026-10-24).
      dicaTeclado(ctx, 'ENTER continua', 928, BOTAO_CONTINUAR.y - 20);
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
