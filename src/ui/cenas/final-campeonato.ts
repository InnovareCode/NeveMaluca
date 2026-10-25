/**
 * Tela final do campeonato (plano `docs/plano-corrida-campeonato.md` §C-D1/C-D9, C5b/C8b): venceu (total do
 * jogador maior que TODOS os 5 rivais) ou perdeu, com a classificação final e -- se venceu -- o troféu
 * (`SaveV1.trofeus`, plano C-D9).
 *
 * Redesenho "premium estilo Pixar" (`docs/direcao-ui-premium.md` §11.6 + comemoração §9.2/§9.3): véu que abre,
 * raios de glória em tela cheia, Floco de Ouro girando caindo do topo, chuva de confete, "CAMPEÃO!/CAMPEÃ!" com
 * carimbo, campeão `celeb` sobre monte de neve, Painel Geada com a classificação final. Na derrota: sem raios
 * nem confete, o rival campeão em miniatura e o jogador em `wobble`.
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { IdPersonagem, IdTema } from '../../core/contratos';
import type { ClassificacaoItem } from '../../meta/campeonato';
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import { assetsItensProntos, precarregarAssetsItens } from '../../assets/itens';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { easeOutBack, easeOutCubic, escalonar, msParaTicks, overshootPadrao, poseEntrada, prefereMovimentoReduzido, progresso } from '../animacao';
import { desenharTexto, type CamadaEstatica } from '../desenho';
import { criarEstadoPressao, eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import { botao3D, desenharConfete, desenharLetreiro, desenharMoedaGirando, dicaTeclado, medalhao, medirNomeAjustado, painelGeada, raiosDeGloria } from '../kit-premium';
import type { Cena } from '../tipos';
import { obterFundoBDoTema } from './fundo-campeonato';

export interface OpcoesCenaFinalCampeonato {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly venceu: boolean;
  readonly classificacaoFinal: readonly ClassificacaoItem[];
  readonly idJogador: IdPersonagem;
  readonly nomePersonagem: string;
  readonly nomesPorId: Readonly<Record<IdPersonagem, string>>;
  readonly ganhouTrofeu: boolean;
  readonly temaFundo: IdTema;
  readonly aoMenu: () => void;
}

/** Gênero por personagem, só pra "CAMPEÃO!/CAMPEÃ!" (§11.6) -- o catálogo (`data/personagens.ts`) não tem campo
 *  de gênero; decisão de conteúdo tirada do próprio nome de exibição ("Professora Bandeira", "Vó Cidinha", "Bia
 *  Pipoca" = femininas; "Tio Beto" = masculino; "Capi"/"Quequé" sem pronome explícito no nome, default
 *  masculino). Se o elenco crescer, este mapa cresce junto -- id sem entrada cai em `'m'`. */
const GENERO_POR_ID: Readonly<Record<string, 'm' | 'f'>> = {
  capi: 'm',
  bandeira: 'f',
  cidinha: 'f',
  beto: 'm',
  queque: 'm',
  bia: 'f',
};

const COR_TEXTO = '#f4f9ff';

const PAINEL_X = 600;
const PAINEL_Y = 130;
const PAINEL_W = 328;
const ALTURA_LINHA = 44;

const BOTAO_MENU: BotaoRetangular = { id: 'menu', x: 628, y: 456, w: 300, h: 64 };

// Comemoração vitória (§9.2) -- ticks desde a revelação.
const T_VEU_ABRE = msParaTicks(200);
const DUR_VEU_ABRE = msParaTicks(600);
const T_RAIOS = msParaTicks(300);
const DUR_RAIOS = msParaTicks(700);
const T_TROFEU = msParaTicks(500);
const DUR_TROFEU = msParaTicks(600);
const T_CONFETE = msParaTicks(900);
const T_TITULO = msParaTicks(1000);
const DUR_TITULO = msParaTicks(360);
const T_CAMPEAO = msParaTicks(1300);
const DUR_CAMPEAO = msParaTicks(420);
const T_LISTA = msParaTicks(1600);
const PASSO_LISTA = msParaTicks(60);
const DUR_LISTA = msParaTicks(360);
const T_CTA = msParaTicks(2200);

export function criarCenaFinalCampeonato(opcoes: OpcoesCenaFinalCampeonato): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  const reduzido = prefereMovimentoReduzido();
  // Lido de novo A CADA quadro (ver `standings-campeonato.ts`): 1 chamada só na criação da cena fica `null` pra
  // sempre se o raster não estava pronto NAQUELE instante exato. Achado rodando um campeonato de verdade, 2026-10-24.
  let fundo: CamadaEstatica | null = null;

  void precarregarAssetsItens();
  let sprite: SpritePersonagem | null = null;
  void carregarSpritePersonagem(opcoes.idJogador)
    .then((s) => {
      sprite = s;
    })
    .catch(() => undefined);

  const idRival = opcoes.classificacaoFinal.find((c) => c.id !== opcoes.idJogador)?.id;
  let spriteRival: SpritePersonagem | null = null;
  if (!opcoes.venceu && idRival) {
    void carregarSpritePersonagem(idRival)
      .then((s) => {
        spriteRival = s;
      })
      .catch(() => undefined);
  }

  let hover = false;
  let ticks = 0;
  const pressao = criarEstadoPressao();

  const aoMenu = (): void => opcoes.aoMenu();

  const aoMover = (e: Event): void => {
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    hover = pontoDentroDoBotao(pt, BOTAO_MENU);
  };
  const aoTocar = (e: Event): void => {
    e.preventDefault?.();
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_MENU)) {
      pressao.marcar('menu', ticks);
      aoMenu();
    }
  };
  const aoTeclar = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.code === 'Space' || ev.code === 'Enter' || ev.code === 'Escape') aoMenu();
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  janela?.addEventListener('keydown', aoTeclar);

  const generoJogador = GENERO_POR_ID[opcoes.idJogador] ?? 'm';
  const tituloVitoria = generoJogador === 'f' ? 'CAMPEÃ!' : 'CAMPEÃO!';

  return {
    id: 'campeonato-final',
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

      if (opcoes.venceu) {
        // Véu de suspense que abre (§9.2: "0: véu 0,8" -> "200: véu cai pra 0,3 em 600ms").
        const pVeu = easeOutCubic(progresso(t, T_VEU_ABRE, DUR_VEU_ABRE));
        const veuAlpha = reduzido ? 0.3 : 0.8 - 0.5 * pVeu;
        ctx.save();
        ctx.fillStyle = `rgba(6, 14, 36, ${veuAlpha})`;
        ctx.fillRect(0, 0, LARGURA, ALTURA);
        ctx.restore();

        const pRaios = progresso(t, T_RAIOS, DUR_RAIOS);
        if (pRaios > 0.001) {
          const escalaRaios = reduzido ? 1 : easeOutBack(overshootPadrao(reduzido, 2.6))(pRaios);
          raiosDeGloria(ctx, LARGURA / 2, ALTURA / 2, 'ouro', 620, escalaRaios, t * 0.1, 16);
        }
      } else {
        ctx.save();
        ctx.fillStyle = 'rgba(8, 10, 16, 0.55)';
        ctx.fillRect(0, 0, LARGURA, ALTURA);
        ctx.restore();
      }

      const titulo = opcoes.venceu ? tituloVitoria : 'FIM DE CAMPEONATO';
      const pTitulo = progresso(t, T_TITULO, DUR_TITULO);
      if (pTitulo > 0.001) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, pTitulo * 2);
        if (doc) desenharLetreiro(ctx, doc, titulo, LARGURA / 2, 70, opcoes.venceu ? 64 : 48, opcoes.venceu ? 'ouro' : 'gelo');
        else desenharTexto(ctx, titulo, LARGURA / 2, 70, { fonte: 'italic 800 56px "Barlow Condensed", Impact, sans-serif', cor: COR_TEXTO, contorno: 8, alinhamento: 'center', base: 'middle' });
        ctx.restore();
      }

      const icones = assetsItensProntos();
      if (opcoes.venceu) {
        // Floco de Ouro caindo do topo e girando (§7.6/§9.2).
        const pTrofeu = easeOutBack(overshootPadrao(reduzido, 1.7))(progresso(t, T_TROFEU, DUR_TROFEU));
        const yTrofeu = -200 + 390 * Math.min(1, progresso(t, T_TROFEU, DUR_TROFEU));
        if (pTrofeu > 0.001) {
          ctx.save();
          const haloP = Math.min(1, progresso(t, T_TROFEU, DUR_TROFEU));
          const halo = ctx.createRadialGradient(380, yTrofeu, 4, 380, yTrofeu, 90);
          halo.addColorStop(0, `rgba(255, 210, 63, ${0.35 * haloP})`);
          halo.addColorStop(1, 'rgba(255, 210, 63, 0)');
          ctx.fillStyle = halo;
          ctx.fillRect(380 - 90, yTrofeu - 90, 180, 180);
          ctx.restore();
          desenharMoedaGirando(ctx, icones?.flocoDourado ?? null, 380, yTrofeu, 128, t);
        }

        if (t >= T_TROFEU + DUR_TROFEU) {
          desenharTexto(ctx, `Troféu de ${opcoes.nomePersonagem} conquistado!`, 380, 290, { fonte: '600 18px Barlow, sans-serif', cor: COR_TEXTO, contorno: 4, alinhamento: 'center' });
        }

        if (t >= T_CONFETE) desenharConfete(ctx, 'chuva', 120, t - T_CONFETE);
      } else if (idRival) {
        // Derrota: campeão rival em miniatura num bloco de 1º, com o Floco de Ouro flutuando. `cx` fica bem à
        // esquerda do Painel Geada (x600) -- não tem coordenada no guia pra esta variante, então a Lyra mediu
        // no navegador (skill `medir-antes-de-afirmar`) pra garantir folga real, não só "parece que cabe".
        const cxRival = 470;
        ctx.save();
        caminhoArredondado2(ctx, cxRival, 440, 100, 90);
        ctx.restore();
        const quadroRival = spriteRival?.obterQuadro('celeb') ?? spriteRival?.obterQuadro('ride0');
        const refRival = spriteRival?.obterQuadro('ride0')?.dados ?? quadroRival?.dados;
        if (quadroRival && refRival) {
          const escala = 110 / refRival.altura;
          const d = quadroRival.dados;
          const [ax, ay] = d.contato ?? d.pivo;
          ctx.save();
          ctx.translate(cxRival, 440);
          ctx.drawImage(quadroRival.imagem, -ax * escala, -ay * escala, d.largura * escala, d.altura * escala);
          ctx.restore();
        }
        const flutua = reduzido ? 0 : Math.sin(t / 40) * 4;
        desenharMoedaGirando(ctx, icones?.flocoDourado ?? null, cxRival, 340 + flutua, 64, t);
        // Acima do bloco (não embaixo, §11.6 -- embaixo colidia com "Você ficou em..." logo abaixo do jogador).
        desenharTexto(ctx, `Campeã${GENERO_POR_ID[idRival] === 'f' ? '' : 'o'}: ${opcoes.nomesPorId[idRival] ?? idRival}`, cxRival, 290, {
          fonte: '600 16px Barlow, sans-serif',
          cor: COR_TEXTO,
          contorno: 3,
          alinhamento: 'center',
        });
      }

      // Campeão/jogador entrando sobre monte de neve (§8.5, simplificado com `poseEntrada`).
      const poseCampeao = poseEntrada(t, T_CAMPEAO, DUR_CAMPEAO, reduzido, 140);
      const quadro = sprite ? (sprite.obterQuadro(opcoes.venceu ? 'celeb' : 'wobble') ?? sprite.obterQuadro('ride0')) : null;
      const referencia = sprite?.obterQuadro('ride0')?.dados ?? quadro?.dados;
      if (quadro && referencia && poseCampeao.opacidade > 0.01) {
        const alturaAlvo = opcoes.venceu ? 150 : 100;
        const escala = alturaAlvo / referencia.altura;
        const d = quadro.dados;
        const [ax, ay] = d.contato ?? d.pivo;
        const cx = opcoes.venceu ? 140 : 180;
        const py = opcoes.venceu ? 440 : 460;
        ctx.save();
        ctx.globalAlpha = poseCampeao.opacidade;
        if (opcoes.venceu) {
          const halo = ctx.createRadialGradient(cx, py - 60, 10, cx, py - 60, 150);
          halo.addColorStop(0, 'rgba(255, 210, 63, 0.3)');
          halo.addColorStop(1, 'rgba(255, 210, 63, 0)');
          ctx.fillStyle = halo;
          ctx.fillRect(cx - 150, py - 210, 300, 300);
        }
        ctx.translate(cx, py - poseCampeao.deslocaY);
        ctx.drawImage(quadro.imagem, -ax * escala, -ay * escala, d.largura * escala, d.altura * escala);
        ctx.restore();
      }
      if (!opcoes.venceu) {
        desenharTexto(ctx, `Você ficou em ${opcoes.classificacaoFinal.findIndex((c) => c.id === opcoes.idJogador) + 1}º. O Floco de Ouro te espera na revanche!`, 80, 500, {
          fonte: '600 15px Barlow, sans-serif',
          cor: COR_TEXTO,
          contorno: 3,
        });
      }

      // h = 56 (não 30): a tampa de neve pendura gotas até ~38px abaixo do topo do painel (pingente longo) --
      // com +30 a 1ª linha (medalhão de raio 14 centrado em Y+28) ficava embaixo da tampa. Medido no navegador,
      // feedback do dono (2026-10-24).
      if (doc) painelGeada(ctx, doc, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: opcoes.classificacaoFinal.length * ALTURA_LINHA + 56 }, { variante: opcoes.venceu ? 'ouro' : 'padrao' });
      else {
        ctx.save();
        ctx.fillStyle = 'rgba(12,27,48,0.82)';
        ctx.fillRect(PAINEL_X, PAINEL_Y, PAINEL_W, opcoes.classificacaoFinal.length * ALTURA_LINHA + 56);
        ctx.restore();
      }

      opcoes.classificacaoFinal.forEach((item, indice) => {
        const t0 = T_LISTA + escalonar(indice, PASSO_LISTA);
        const pose = poseEntrada(t, t0, DUR_LISTA, reduzido, 40);
        if (pose.opacidade <= 0.01) return;
        const posicao = indice + 1;
        const y = PAINEL_Y + 54 + indice * ALTURA_LINHA;
        const ehJogador = item.id === opcoes.idJogador;
        const nome = opcoes.nomesPorId[item.id] ?? item.id;

        ctx.save();
        ctx.globalAlpha = pose.opacidade;
        ctx.translate(pose.deslocaY, 0);

        medalhao(ctx, PAINEL_X + 28, y, 28, posicao === 1 ? 'ouro' : posicao === 2 ? 'prata' : posicao === 3 ? 'bronze' : 'vidro', (ictx) => {
          ictx.textAlign = 'center';
          ictx.textBaseline = 'middle';
          ictx.font = 'italic 800 15px "Barlow Condensed", Impact, sans-serif';
          ictx.fillStyle = posicao <= 3 ? '#0B1630' : '#ffffff';
          ictx.fillText(String(posicao), 0, 1);
        });
        const fonteNomeFinal = (tamanho: number) => (ehJogador ? `italic 800 ${tamanho}px "Barlow Condensed", Impact, sans-serif` : `600 ${tamanho}px Barlow, sans-serif`);
        const nomeAjustadoFinal = medirNomeAjustado(ctx, nome, ehJogador, PAINEL_W - 52 - 55, fonteNomeFinal, ehJogador ? 18 : 16, 12);
        desenharTexto(ctx, nomeAjustadoFinal.texto, PAINEL_X + 52, y, {
          fonte: fonteNomeFinal(nomeAjustadoFinal.tamanho),
          cor: ehJogador ? '#FFD23F' : COR_TEXTO,
          base: 'middle',
        });
        desenharTexto(ctx, `${item.pontos} pts`, PAINEL_X + PAINEL_W - 20, y, { fonte: '700 16px Barlow, sans-serif', cor: COR_TEXTO, alinhamento: 'right', base: 'middle' });
        ctx.restore();
      });

      const poseCTA = poseEntrada(t, T_CTA, msParaTicks(360), reduzido, 20);
      if (poseCTA.opacidade > 0.01) {
        const poseP = pressao.pose('menu', ticks);
        ctx.save();
        ctx.globalAlpha = poseCTA.opacidade;
        ctx.translate(0, poseCTA.deslocaY);
        botao3D(ctx, { ...BOTAO_MENU, texto: 'VOLTAR AO MENU', tipo: 'primario', destaque: true, aoVivo: hover, t, pressionado: poseP.pressionado, escalaExtra: poseP.escalaExtra });
        ctx.restore();
      }

      dicaTeclado(ctx, 'ESC volta ao menu', 928, 34);
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}

/** Bloco em miniatura (1º lugar) pro rival campeão, na derrota (§11.6) -- geometria simples, local, não precisa
 *  virar componente do kit (usado só aqui). */
function caminhoArredondado2(ctx: Ctx, cx: number, baseY: number, w: number, h: number): void {
  ctx.save();
  const x = cx - w / 2;
  const y = baseY - h;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, y + 10);
  ctx.quadraticCurveTo(x, y, x + 10, y);
  ctx.lineTo(x + w - 10, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + 10);
  ctx.lineTo(x + w, baseY);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, y, 0, baseY);
  grad.addColorStop(0, '#E9F7FF');
  grad.addColorStop(0.25, '#9FE3FF');
  grad.addColorStop(1, '#2A7DE1');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#0B1630';
  ctx.stroke();
  ctx.restore();
}
