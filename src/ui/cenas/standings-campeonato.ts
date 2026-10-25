/**
 * Classificação entre pistas do campeonato (plano `docs/plano-corrida-campeonato.md` §C5b/C8b, C-D1): soma de
 * pontos 10/8/6/4/2/1 de cada pista já corrida (`meta/campeonato.ts` → `classificacao`, nunca recalculado aqui),
 * jogador destacado. Fundo B raster da PRÓXIMA pista (ou a última, se o campeonato acabou).
 *
 * Redesenho "premium estilo Pixar" (`docs/direcao-ui-premium.md` §11.4): Painel Geada com medalhão de posição +
 * retrato circular + nome + pontos, indicadores de progresso das 5 pistas, miniatura da próxima pista e a
 * "ultrapassagem" (§11.4 item 4): as linhas entram na ordem ANTERIOR, as pílulas "+N" voam até o total (que
 * conta), e por fim as linhas reordenam para a classificação nova com setinhas ▲/▼. `classificacaoAnterior` é
 * opcional -- sem ela (chamador antigo/teste), a tela cai direto na ordem final, sem a coreografia de troca.
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { IdPersonagem, IdTema } from '../../core/contratos';
import type { ClassificacaoItem } from '../../meta/campeonato';
import { assetsItensProntos, precarregarAssetsItens } from '../../assets/itens';
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { easeInOutCubic, easeOutCubic, escalonar, lerp, msParaTicks, poseEntrada, prefereMovimentoReduzido, progresso } from '../animacao';
import { caminhoArredondado, desenharTexto, type CamadaEstatica } from '../desenho';
import { criarEstadoPressao, eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import { botao3D, desenharLetreiro, desenharMoedaIcone, dicaTeclado, medalhao, medirNomeAjustado, painelGeada } from '../kit-premium';
import type { Cena } from '../tipos';
import { obterFundoBDoTema } from './fundo-campeonato';

export interface OpcoesCenaStandings {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly classificacao: readonly ClassificacaoItem[];
  /** Classificação ANTES da pista que acabou de ser corrida -- habilita a animação de ultrapassagem (§11.4).
   *  Sem ela, a tela mostra a ordem final direto, sem coreografia (compatibilidade com chamadores antigos). */
  readonly classificacaoAnterior?: readonly ClassificacaoItem[] | undefined;
  readonly nomesPorId: Readonly<Record<IdPersonagem, string>>;
  readonly idJogador: IdPersonagem;
  readonly pistaConcluidaNome: string;
  /** `undefined` = essa era a última pista (o campeonato já decidiu quem venceu). */
  readonly proximaPistaNome?: string | undefined;
  readonly temaFundo: IdTema;
  /** Índice (0-based) da pista recém-concluída, pros 5 indicadores de progresso; sem ele, nenhum indicador
   *  especial de "pista atual" (só decoração, nunca bloqueia a tela). */
  readonly etapaConcluida?: number | undefined;
  readonly totalPistas?: number | undefined;
  readonly aoContinuar: () => void;
}

const COR_TEXTO = '#f4f9ff';
const COR_SOL = '#FFD23F';
const COR_MENTA = '#3DDC97';
const COR_SINAL = '#C7301C';

const PAINEL_X = 220;
const PAINEL_Y = 120;
const PAINEL_W = 520;
const ALTURA_LINHA = 50;

const BOTAO_CONTINUAR: BotaoRetangular = { id: 'continuar', x: 600, y: 456, w: 300, h: 64 };

const T_LINHAS = 0;
const PASSO_LINHA = msParaTicks(60);
const DUR_LINHA = msParaTicks(360);
const T_PILULAS = msParaTicks(500);
const DUR_PILULA = msParaTicks(600);
const T_REORDENAR = msParaTicks(1000);
const DUR_REORDENAR = msParaTicks(600);
const T_CTA = T_REORDENAR + DUR_REORDENAR + msParaTicks(200);

export function criarCenaStandings(opcoes: OpcoesCenaStandings): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  const reduzido = prefereMovimentoReduzido();
  // Lido de novo A CADA quadro em `desenhar` (não uma vez aqui): o raster quase nunca está pronto no instante
  // exato em que esta cena é construída (a Nevasca revela e constrói na hora -- 1 chamada só aqui ficaria `null`
  // pra sempre, mesmo quando o raster terminasse de carregar 1s depois). Achado rodando um campeonato de
  // verdade, 2026-10-24 -- não aparecia em teste sintético que já pré-aquecia o cache antes de criar a cena.
  let fundo: CamadaEstatica | null = null;

  void precarregarAssetsItens();
  const sprites = new Map<IdPersonagem, SpritePersonagem>();
  for (const item of opcoes.classificacao) {
    void carregarSpritePersonagem(item.id)
      .then((s) => sprites.set(item.id, s))
      .catch(() => undefined);
  }

  let hover = false;
  let ticks = 0;
  const pressao = criarEstadoPressao();

  const continuar = (): void => opcoes.aoContinuar();

  const aoMover = (e: Event): void => {
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    hover = pontoDentroDoBotao(pt, BOTAO_CONTINUAR);
  };

  const aoTocar = (e: Event): void => {
    e.preventDefault?.();
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_CONTINUAR)) {
      pressao.marcar('continuar', ticks);
      continuar();
    }
  };

  const aoTeclar = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.code === 'Space' || ev.code === 'Enter') {
      pressao.marcar('continuar', ticks);
      continuar();
    }
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  janela?.addEventListener('keydown', aoTeclar);

  // Ordem ANTERIOR (pela qual as linhas entram) -- cai na ordem final se não vier `classificacaoAnterior`.
  const ordemAnterior: readonly IdPersonagem[] = opcoes.classificacaoAnterior ? opcoes.classificacaoAnterior.map((c) => c.id) : opcoes.classificacao.map((c) => c.id);
  const ordemFinal: readonly IdPersonagem[] = opcoes.classificacao.map((c) => c.id);
  const pontosPorId = new Map(opcoes.classificacao.map((c) => [c.id, c.pontos] as const));
  const pontosAnterioresPorId = new Map((opcoes.classificacaoAnterior ?? opcoes.classificacao).map((c) => [c.id, c.pontos] as const));
  // Todo id que não estava na lista anterior (1ª pista) entra com 0, pra pílula "+N" bater com o ganho real.
  for (const id of ordemFinal) if (!pontosAnterioresPorId.has(id)) pontosAnterioresPorId.set(id, 0);

  /** Posição (índice 0-based) de `id` numa ordem; -1 se ausente (nunca deveria acontecer, mas não trava). */
  const indiceEm = (ordem: readonly IdPersonagem[], id: IdPersonagem): number => ordem.indexOf(id);

  return {
    id: 'campeonato-standings',
    atualizar() {
      ticks += 1;
    },
    desenhar(ctx: Ctx, alpha: number) {
      const t = ticks + alpha;
      if (!fundo && doc) fundo = obterFundoBDoTema(opcoes.temaFundo, doc);
      fundo?.desenhar(ctx);
      if (!fundo) {
        ctx.save();
        ctx.fillStyle = '#0b1a33';
        ctx.fillRect(0, 0, LARGURA, ALTURA);
        ctx.restore();
      }

      if (doc) desenharLetreiro(ctx, doc, 'CLASSIFICAÇÃO', LARGURA / 2, 56, 40, 'gelo');
      else desenharTexto(ctx, 'CLASSIFICAÇÃO', LARGURA / 2, 56, { fonte: 'italic 800 40px "Barlow Condensed", Impact, sans-serif', cor: COR_TEXTO, contorno: 6, alinhamento: 'center' });

      // Pílula "Depois de <pista>" + indicadores de progresso das 5 pistas.
      ctx.save();
      ctx.font = '600 15px Barlow, sans-serif';
      const textoDepois = `Depois de ${opcoes.pistaConcluidaNome}`;
      const largDepois = ctx.measureText(textoDepois).width;
      const pw = largDepois + 28;
      ctx.fillStyle = 'rgba(10,24,60,0.5)';
      caminhoArredondado(ctx, { x: LARGURA / 2 - pw / 2, y: 78, w: pw, h: 24 }, 12);
      ctx.fill();
      ctx.restore();
      desenharTexto(ctx, textoDepois, LARGURA / 2, 90, { fonte: '600 15px Barlow, sans-serif', cor: COR_TEXTO, alinhamento: 'center', base: 'middle' });

      const total = opcoes.totalPistas ?? 5;
      if (opcoes.etapaConcluida !== undefined) {
        const passoFloco = 28;
        const inicioFlocosX = LARGURA / 2 - (passoFloco * (total - 1)) / 2;
        for (let i = 0; i < total; i += 1) {
          const feita = i < opcoes.etapaConcluida;
          const proxima = i === opcoes.etapaConcluida;
          ctx.save();
          ctx.translate(inicioFlocosX + i * passoFloco, 112);
          ctx.fillStyle = feita ? COR_SOL : proxima ? '#9FE3FF' : 'rgba(255,255,255,0.25)';
          const pulso = proxima && !reduzido ? 1 + 0.15 * Math.sin((t / 40) * Math.PI) : 1;
          ctx.scale(pulso, pulso);
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // h:330 (não 316) e 1ª linha em y60 (não y40): a tampa de neve pendura gotas até ~38px abaixo do topo do
      // painel -- y40 só tinha 2px de folga. A altura cresceu junto pra não empurrar a última linha pro CTA
      // logo abaixo (y456). Medido no navegador, feedback do dono (2026-10-24).
      if (doc) painelGeada(ctx, doc, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: 330 });
      else {
        ctx.save();
        ctx.fillStyle = 'rgba(12,27,48,0.82)';
        caminhoArredondado(ctx, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: 330 }, 18);
        ctx.fill();
        ctx.restore();
      }

      const pReordenar = easeInOutCubic(progresso(t, T_REORDENAR, DUR_REORDENAR));
      const icones = assetsItensProntos();

      ordemFinal.forEach((id, indiceFinal) => {
        const indiceInicial = indiceEm(ordemAnterior, id);
        const indiceUsado = indiceInicial < 0 ? indiceFinal : indiceInicial;
        // Y interpola da posição ANTERIOR pra FINAL durante a janela de reordenar; fora dela, fica num extremo.
        const yAnterior = PAINEL_Y + 60 + indiceUsado * ALTURA_LINHA;
        const yFinal = PAINEL_Y + 60 + indiceFinal * ALTURA_LINHA;
        const subiu = indiceFinal < indiceUsado;
        const desceu = indiceFinal > indiceUsado;
        const arcoX = (subiu || desceu) && pReordenar > 0 && pReordenar < 1 ? 14 * Math.sin(Math.PI * pReordenar) : 0;
        const y = lerp(yAnterior, yFinal, pReordenar);

        const t0Entrada = T_LINHAS + escalonar(indiceUsado, PASSO_LINHA);
        const poseLinha = poseEntrada(t, t0Entrada, DUR_LINHA, reduzido, 40);
        if (poseLinha.opacidade <= 0.01) return;

        const ehJogador = id === opcoes.idJogador;
        ctx.save();
        ctx.globalAlpha = poseLinha.opacidade;
        ctx.translate(arcoX, poseLinha.deslocaY);

        if (ehJogador) {
          ctx.save();
          ctx.fillStyle = 'rgba(255, 210, 63, 0.18)';
          caminhoArredondado(ctx, { x: PAINEL_X + 8, y: y - ALTURA_LINHA / 2 + 6, w: PAINEL_W - 16, h: ALTURA_LINHA - 10 }, 10);
          ctx.fill();
          ctx.restore();
        }

        medalhao(ctx, PAINEL_X + 36, y, 36, indiceFinal === 0 ? 'ouro' : indiceFinal === 1 ? 'prata' : indiceFinal === 2 ? 'bronze' : 'vidro', (ictx) => {
          ictx.textAlign = 'center';
          ictx.textBaseline = 'middle';
          ictx.font = 'italic 800 16px "Barlow Condensed", Impact, sans-serif';
          ictx.fillStyle = indiceFinal <= 2 ? '#0B1630' : '#ffffff';
          ictx.fillText(String(indiceFinal + 1), 0, 1);
        });

        const sprite = sprites.get(id);
        const quadro = sprite?.obterQuadro('ride0');
        if (quadro) {
          const escala = 32 / quadro.dados.altura;
          const [ax, ay] = quadro.dados.contato ?? quadro.dados.pivo;
          ctx.save();
          ctx.beginPath();
          ctx.arc(PAINEL_X + 80, y, 20, 0, Math.PI * 2);
          ctx.clip();
          ctx.translate(PAINEL_X + 80, y + 14);
          ctx.drawImage(quadro.imagem, -ax * escala, -ay * escala, quadro.dados.largura * escala, quadro.dados.altura * escala);
          ctx.restore();
        }

        const fonteNomeStandings = (tamanho: number) => `italic 800 ${tamanho}px "Barlow Condensed", Impact, sans-serif`;
        const nomeAjustadoStandings = medirNomeAjustado(ctx, opcoes.nomesPorId[id] ?? id, ehJogador, PAINEL_W - 112 - 110, fonteNomeStandings, 22);
        desenharTexto(ctx, nomeAjustadoStandings.texto, PAINEL_X + 112, y, {
          fonte: fonteNomeStandings(nomeAjustadoStandings.tamanho),
          cor: ehJogador ? COR_SOL : '#ffffff',
          base: 'middle',
        });

        // Contagem de pontos: do valor ANTERIOR até o FINAL, com a pílula "+N" voando/encolhendo (§11.4 item 2).
        const pontosFinal = pontosPorId.get(id) ?? 0;
        const pontosAntes = pontosAnterioresPorId.get(id) ?? pontosFinal;
        const ganho = pontosFinal - pontosAntes;
        const pPilula = easeOutCubic(progresso(t, T_PILULAS, DUR_PILULA));
        const pontosExibidos = Math.round(lerp(pontosAntes, pontosFinal, pPilula));

        desenharTexto(ctx, String(pontosExibidos), PAINEL_X + PAINEL_W - 70, y, {
          fonte: 'italic 800 26px "Barlow Condensed", Impact, sans-serif',
          cor: COR_TEXTO,
          alinhamento: 'right',
          base: 'middle',
        });
        if (ganho > 0 && pPilula < 1) {
          ctx.save();
          ctx.globalAlpha *= 1 - pPilula;
          ctx.fillStyle = 'rgba(61,220,151,0.25)';
          caminhoArredondado(ctx, { x: PAINEL_X + PAINEL_W - 58, y: y - 11, w: 50, h: 22 }, 11);
          ctx.fill();
          ctx.restore();
          if (icones?.flocoDourado) desenharMoedaIcone(ctx, icones.flocoDourado, PAINEL_X + PAINEL_W - 46, y, 14);
          desenharTexto(ctx, `+${ganho}`, PAINEL_X + PAINEL_W - 26, y, { fonte: '800 13px Barlow, sans-serif', cor: COR_MENTA, alinhamento: 'right', base: 'middle' });
        }

        if (subiu && pReordenar > 0 && pReordenar < 1) {
          desenharTexto(ctx, '▲', PAINEL_X + PAINEL_W - 20, y, { fonte: '800 16px Barlow, sans-serif', cor: COR_MENTA, alinhamento: 'right', base: 'middle' });
        } else if (desceu && pReordenar > 0 && pReordenar < 1) {
          desenharTexto(ctx, '▼', PAINEL_X + PAINEL_W - 20, y, { fonte: '800 16px Barlow, sans-serif', cor: COR_SINAL, alinhamento: 'right', base: 'middle' });
        }

        ctx.restore();
      });

      if (opcoes.proximaPistaNome) {
        desenharTexto(ctx, `Próxima: ${opcoes.proximaPistaNome}`, PAINEL_X, 462, { fonte: '600 15px Barlow, sans-serif', cor: '#aed0ef' });
      }

      const poseCTA = poseEntrada(t, T_CTA, msParaTicks(360), reduzido, 20);
      if (poseCTA.opacidade > 0.01) {
        const poseP = pressao.pose('continuar', ticks);
        ctx.save();
        ctx.globalAlpha = poseCTA.opacidade;
        ctx.translate(0, poseCTA.deslocaY);
        botao3D(ctx, {
          ...BOTAO_CONTINUAR,
          texto: opcoes.proximaPistaNome ? 'CONTINUAR' : 'VER RESULTADO FINAL',
          tipo: 'primario',
          destaque: true,
          aoVivo: hover,
          t,
          pressionado: poseP.pressionado,
          escalaExtra: poseP.escalaExtra,
        });
        ctx.restore();
      }

      dicaTeclado(ctx, 'ESPAÇO continua', 928, 34);
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
