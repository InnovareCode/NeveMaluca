/**
 * Overlay de pausa (feedback do dono, playtest iPhone: "durante a partida não dá pra pausar, voltar ao menu,
 * abrir configuração nem reiniciar"). Compartilhado por `ui/cenas/jogo.ts` (Treino) e `ui/cenas/campeonato.ts`
 * (Corrida): os dois compõem a descida/corrida real por baixo (congelada, nunca destruída) com este painel por
 * cima -- redesenho "premium estilo Pixar" (`docs/direcao-ui-premium.md` §11.8, Fase 1): Fundo C (a própria
 * corrida congelada, desfocada -- `kit-premium.ts: construirFundoCongelado`), Painel Geada, botão 3D e letreiro.
 *
 * Congelar o motor (o compositor para de chamar `atualizar()`) não basta pra isolar o INPUT: o toque/teclado da
 * descida/corrida por baixo continua com os PRÓPRIOS ouvintes vivos no mesmo `canvas`/`janela` (nunca destruído,
 * só congelado -- CONTINUAR precisa voltar exatamente de onde parou). Sem bloquear, o MESMO toque que fecha a
 * pausa tocando em CONTINUAR também seria lido como um pulo pelo toque de baixo, e disparar no próximo tick real
 * (mesmo risco pro Escape/P: fechar a pausa sem travar reabriria na hora, lido de novo pelo teclado de baixo).
 * Por isso, sempre que este controlador está ATIVO (pausado e não suspenso) ele chama
 * `stopImmediatePropagation()` em TODO toque/tecla antes de devolver o controle -- não só `stopPropagation()`,
 * que pararia a subida pro `document`/`window` mas NÃO impede outro ouvinte já registrado no MESMO `canvas`/
 * `janela` (caso daqui: `input/toque.ts`/`teclado.ts` da cena de baixo). Esta ordem só funciona porque o
 * controlador é criado (e seus ouvintes registrados) ANTES da descida/corrida em `jogo.ts`/`campeonato.ts` --
 * ouvintes do MESMO nó disparam na ordem de registro, então o de pausa sempre roda primeiro.
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { easeOutCubic, escalonar, msParaTicks, poseEntrada, prefereMovimentoReduzido, progresso } from '../animacao';
import type { CamadaEstatica } from '../desenho';
import { criarEstadoPressao, eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular, type EstadoPressao } from '../interacao';
import { botao3D, construirFundoCongelado, desenharLetreiro, painelGeada, type TipoBotao3D } from '../kit-premium';
import { desenharTexto } from '../desenho';

const COR_TEXTO = '#f4f9ff';
const COR_MUTED = '#aed0ef';

const PAINEL_W = 400;
const PAINEL_H = 380;
const PAINEL_X = LARGURA / 2 - PAINEL_W / 2;
const PAINEL_Y = ALTURA / 2 - PAINEL_H / 2;

const BOTAO_W = 320;
const BOTAO_H = 56;
const BOTAO_X = LARGURA / 2 - BOTAO_W / 2;
const PASSO_Y = 66;
const PRIMEIRA_Y = PAINEL_Y + 96;

export const BOTAO_CONTINUAR: BotaoRetangular = { id: 'continuar', x: BOTAO_X, y: PRIMEIRA_Y, w: BOTAO_W, h: BOTAO_H };
export const BOTAO_REINICIAR: BotaoRetangular = { id: 'reiniciar', x: BOTAO_X, y: PRIMEIRA_Y + PASSO_Y, w: BOTAO_W, h: BOTAO_H };
export const BOTAO_CONFIGURACOES: BotaoRetangular = { id: 'configuracoes', x: BOTAO_X, y: PRIMEIRA_Y + 2 * PASSO_Y, w: BOTAO_W, h: BOTAO_H };
export const BOTAO_VOLTAR_MENU: BotaoRetangular = { id: 'voltar-menu', x: BOTAO_X, y: PRIMEIRA_Y + 3 * PASSO_Y, w: BOTAO_W, h: BOTAO_H };

export const BOTAO_CONFIRMAR_SAIDA: BotaoRetangular = { id: 'confirmar-saida', x: LARGURA / 2 - 170, y: PRIMEIRA_Y + PASSO_Y + 10, w: 150, h: 56 };
export const BOTAO_CANCELAR_SAIDA: BotaoRetangular = { id: 'cancelar-saida', x: LARGURA / 2 + 20, y: PRIMEIRA_Y + PASSO_Y + 10, w: 150, h: 56 };

export type AlvoHoverPausa = 'continuar' | 'reiniciar' | 'configuracoes' | 'voltar-menu' | 'confirmar-saida' | 'cancelar-saida' | null;

export interface EstadoVisualPausa {
  readonly confirmandoSaida: boolean;
  readonly podeReiniciar: boolean;
  readonly hover: AlvoHoverPausa;
  /** Ticks desde que a pausa abriu -- só usado pra respiração do CTA (`destaque`); 0 é um valor seguro. */
  readonly t?: number | undefined;
  /** Fundo B pronto (a corrida congelada e borrada); sem ele (testes/1º quadro) cai num sólido simples. */
  readonly fundo?: CamadaEstatica | null | undefined;
  readonly documento?: Document | undefined;
  /** Sprite do personagem do jogador, se já carregado -- §11.8 "o personagem espia pela borda direita do
   *  painel". `null`/ausente simplesmente não desenha ninguém espiando (nunca trava a pausa por isso). */
  readonly spritePersonagem?: SpritePersonagem | null | undefined;
  /** Estado de pressionar/soltar dos botões (§4.3) -- sem ele (testes antigos), botões ficam sempre no repouso. */
  readonly pressao?: EstadoPressao | undefined;
}

const ALTURA_PEEK = 110;
const T_INICIO_PEEK = msParaTicks(200); // 200ms depois do painel (painel já está com escala 1 bem antes disso)
const DUR_PEEK = msParaTicks(420);
const DESLOCA_PEEK = 30;

/** Personagem "espiando" pela borda direita do painel (§11.8): desenhado ANTES do painel (por isso metade some
 *  atrás dele), pose `scared` normalmente ou `wobble` na confirmação de saída. Escala pela altura de `ride0`
 *  (nunca pela pose atual -- mesma regra de `selecao.ts`/`render/piloto.ts`), nunca mais que 150 lógicos (teto
 *  do guia §1.7; aqui 110, menor que o personagem-herói de outras telas). */
function desenharPersonagemEspiando(ctx: Ctx, sprite: SpritePersonagem, pose: 'scared' | 'wobble', bordaDireitaX: number, baseY: number, tAbertura: number): void {
  const quadro = sprite.obterQuadro(pose) ?? sprite.obterQuadro('ride0');
  const referencia = sprite.obterQuadro('ride0')?.dados ?? quadro?.dados;
  if (!quadro || !referencia) return;

  const p = easeOutCubic(progresso(tAbertura, T_INICIO_PEEK, DUR_PEEK));
  const offsetX = -10 + DESLOCA_PEEK * p; // começa quase todo escondido, desliza 30px pra fora

  const d = quadro.dados;
  const escala = ALTURA_PEEK / referencia.altura;
  const [ancoraX, ancoraY] = d.contato ?? d.pivo;

  ctx.save();
  ctx.translate(bordaDireitaX + offsetX, baseY);
  ctx.drawImage(quadro.imagem, -ancoraX * escala, -ancoraY * escala, d.largura * escala, d.altura * escala);
  ctx.restore();
}

/** Acha qual botão (se algum) está sob o ponto, de acordo com a sub-tela atual (normal ou confirmação de saída). */
export function botaoPausaEm(pt: { x: number; y: number }, confirmandoSaida: boolean): AlvoHoverPausa {
  if (confirmandoSaida) {
    if (pontoDentroDoBotao(pt, BOTAO_CONFIRMAR_SAIDA)) return 'confirmar-saida';
    if (pontoDentroDoBotao(pt, BOTAO_CANCELAR_SAIDA)) return 'cancelar-saida';
    return null;
  }
  if (pontoDentroDoBotao(pt, BOTAO_CONTINUAR)) return 'continuar';
  if (pontoDentroDoBotao(pt, BOTAO_REINICIAR)) return 'reiniciar';
  if (pontoDentroDoBotao(pt, BOTAO_CONFIGURACOES)) return 'configuracoes';
  if (pontoDentroDoBotao(pt, BOTAO_VOLTAR_MENU)) return 'voltar-menu';
  return null;
}

const COR_FUNDO_SIMPLES = '#0c1b30';

/** Painel de pausa "premium estilo Pixar" (§11.8): Fundo C + Painel Geada + botão 3D + letreiro. Sem `documento`
 *  (testes unitários, ambiente node) cai num sólido simples + texto puro -- o visual real é provado no navegador
 *  por `tests/e2e/pausa.spec.ts` (skill `medir-antes-de-afirmar`). */
const T_ENTRADA_BOTOES = msParaTicks(100);
const PASSO_ENTRADA_BOTAO = msParaTicks(50);
const DUR_ENTRADA_BOTAO = msParaTicks(300);

export function desenharPainelPausa(ctx: Ctx, estado: EstadoVisualPausa): void {
  const doc = estado.documento;
  const t = estado.t ?? 0;
  const reduzido = prefereMovimentoReduzido();

  if (estado.fundo) estado.fundo.desenhar(ctx);
  else {
    ctx.save();
    ctx.fillStyle = COR_FUNDO_SIMPLES;
    ctx.globalAlpha = 0.72;
    ctx.fillRect(0, 0, LARGURA, ALTURA);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Personagem espiando pela borda do painel (§11.8): desenhado ANTES do painel, pra ficar meio escondido.
  if (estado.spritePersonagem) {
    desenharPersonagemEspiando(ctx, estado.spritePersonagem, estado.confirmandoSaida ? 'wobble' : 'scared', PAINEL_X + PAINEL_W, PAINEL_Y + PAINEL_H - 20, t);
  }

  if (doc) {
    painelGeada(ctx, doc, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: PAINEL_H });
    desenharLetreiro(ctx, doc, 'PAUSA', LARGURA / 2, PAINEL_Y + 58, 36, 'gelo');
  } else {
    ctx.save();
    ctx.fillStyle = 'rgba(12, 27, 48, 0.85)';
    ctx.fillRect(PAINEL_X, PAINEL_Y, PAINEL_W, PAINEL_H);
    ctx.restore();
    desenharTexto(ctx, 'PAUSA', LARGURA / 2, PAINEL_Y + 58, { fonte: 'italic 800 36px "Barlow Condensed", Impact, sans-serif', cor: COR_TEXTO, contorno: 5, alinhamento: 'center' });
  }

  if (estado.confirmandoSaida) {
    desenharTexto(ctx, 'Sair da corrida e voltar ao menu?', LARGURA / 2, PRIMEIRA_Y + 6, {
      fonte: '700 18px Barlow, sans-serif',
      cor: COR_TEXTO,
      alinhamento: 'center',
    });
    desenharTexto(ctx, 'O progresso desta pista não é salvo.', LARGURA / 2, PRIMEIRA_Y + 30, {
      fonte: '500 14px Barlow, sans-serif',
      cor: COR_MUTED,
      alinhamento: 'center',
    });
    const poseSim = estado.pressao?.pose('confirmar-saida', t) ?? { pressionado: false, escalaExtra: 1 };
    const poseCancelar = estado.pressao?.pose('cancelar-saida', t) ?? { pressionado: false, escalaExtra: 1 };
    botao3D(ctx, { ...BOTAO_CONFIRMAR_SAIDA, texto: 'SIM, SAIR', tipo: 'perigo', aoVivo: estado.hover === 'confirmar-saida', pressionado: poseSim.pressionado, escalaExtra: poseSim.escalaExtra });
    botao3D(ctx, { ...BOTAO_CANCELAR_SAIDA, texto: 'CANCELAR', tipo: 'secundario', aoVivo: estado.hover === 'cancelar-saida', pressionado: poseCancelar.pressionado, escalaExtra: poseCancelar.escalaExtra });
    return;
  }

  /** Cada botão do menu principal da pausa entra escalonado (§10.2 "os botões entram escalonados a 50ms") --
   *  desenha `fn` dentro do alpha/deslocaY da pose de entrada deste índice. */
  const comEntradaDeBotao = (indice: number, fn: () => void): void => {
    const pose = poseEntrada(t, T_ENTRADA_BOTOES + escalonar(indice, PASSO_ENTRADA_BOTAO), DUR_ENTRADA_BOTAO, reduzido, 16);
    ctx.save();
    ctx.globalAlpha = pose.opacidade;
    ctx.translate(0, pose.deslocaY);
    fn();
    ctx.restore();
  };

  const poseDoBotao = (id: string): { readonly pressionado: boolean; readonly escalaExtra: number } => estado.pressao?.pose(id, t) ?? { pressionado: false, escalaExtra: 1 };

  comEntradaDeBotao(0, () => {
    const pose = poseDoBotao('continuar');
    botao3D(ctx, { ...BOTAO_CONTINUAR, texto: 'CONTINUAR', tipo: 'confirmar', destaque: true, aoVivo: estado.hover === 'continuar', t, pressionado: pose.pressionado, escalaExtra: pose.escalaExtra });
  });

  const tipoReiniciar: TipoBotao3D = !estado.podeReiniciar ? 'desativado' : 'secundario';
  comEntradaDeBotao(1, () => {
    const pose = poseDoBotao('reiniciar');
    botao3D(ctx, { ...BOTAO_REINICIAR, texto: 'REINICIAR CORRIDA', tipo: tipoReiniciar, aoVivo: estado.podeReiniciar && estado.hover === 'reiniciar', pressionado: pose.pressionado, escalaExtra: pose.escalaExtra });
  });
  if (!estado.podeReiniciar) {
    desenharTexto(ctx, 'só antes de cruzar a chegada', LARGURA / 2, BOTAO_REINICIAR.y + BOTAO_REINICIAR.h + 14, {
      fonte: '600 14px Barlow, sans-serif',
      cor: COR_MUTED,
      alinhamento: 'center',
    });
  }

  comEntradaDeBotao(2, () => {
    const pose = poseDoBotao('configuracoes');
    botao3D(ctx, { ...BOTAO_CONFIGURACOES, texto: 'CONFIGURAÇÕES', tipo: 'secundario', aoVivo: estado.hover === 'configuracoes', pressionado: pose.pressionado, escalaExtra: pose.escalaExtra });
  });
  comEntradaDeBotao(3, () => {
    const pose = poseDoBotao('voltar-menu');
    botao3D(ctx, { ...BOTAO_VOLTAR_MENU, texto: 'VOLTAR AO MENU', tipo: 'perigo', aoVivo: estado.hover === 'voltar-menu', pressionado: pose.pressionado, escalaExtra: pose.escalaExtra });
  });

  desenharTexto(ctx, 'ESC/P continua', LARGURA / 2, PAINEL_Y + 366, {
    fonte: '600 14px Barlow, sans-serif',
    cor: COR_MUTED,
    alinhamento: 'center',
  });
}

export interface OpcoesControladorPausa {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  /** Lido a cada clique/tecla (nunca cacheado): reflete "já cruzou a chegada" na hora (plano C-D6). */
  readonly podeReiniciar: () => boolean;
  readonly aoContinuar: () => void;
  readonly aoReiniciar: () => void;
  readonly aoAbrirConfiguracoes: () => void;
  /** Confirmou "sim, sair" no sub-painel: quem decide o que "sair" significa é o chamador (jogo.ts/campeonato.ts). */
  readonly aoConfirmarSaidaAoMenu: () => void;
  /** Id do personagem do jogador (§11.8, "o personagem espia pela borda do painel") -- sem ele, a pausa funciona
   *  igual, só sem ninguém espiando (nunca é motivo pra travar, mesma filosofia de sprite "melhor esforço"). */
  readonly personagem?: string | undefined;
}

export interface ControladorPausa {
  readonly pausado: boolean;
  abrir(): void;
  continuar(): void;
  /** Suspende a reação a toque/tecla SEM fechar a pausa (usado enquanto a tela de Configurações, que tem os
   *  próprios ouvintes, está por cima) — `desenhar` também não pinta o painel nesse meio tempo. */
  suspender(): void;
  retomar(): void;
  desenhar(ctx: Ctx): void;
  destruir(): void;
}

/** Controlador da pausa: estado (pausado/confirmando-saída/suspenso) + ouvintes de toque/tecla + desenho. */
export function criarControladorPausa(opcoes: OpcoesControladorPausa): ControladorPausa {
  const janela = opcoes.janela;
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  let pausado = false;
  let confirmandoSaida = false;
  let suspenso = false;
  let hover: AlvoHoverPausa = null;
  let ticksAbertura = 0;
  // Fundo C (§3.3): captura a corrida congelada UMA vez por pausa aberta -- reconstruir todo quadro seria caro
  // (reduz+amplia a imagem) e desnecessário (a corrida por baixo não se move enquanto pausada).
  let fundo: CamadaEstatica | null = null;
  const pressao = criarEstadoPressao();
  let spritePersonagem: SpritePersonagem | null = null;
  void carregarSpritePersonagem(opcoes.personagem ?? 'capi')
    .then((s) => {
      spritePersonagem = s;
    })
    .catch(() => {
      // fallback silencioso -- sem sprite, ninguém espia (ver `EstadoVisualPausa.spritePersonagem`)
    });

  const ativo = (): boolean => pausado && !suspenso;

  const aoTocar = (ev: Event): void => {
    if (!ativo()) return;
    const e = ev as PointerEvent;
    e.preventDefault?.();
    // Essencial (ver cabeçalho do arquivo): sem isto, o MESMO toque que fecha a pausa também vira pulo no toque
    // congelado de baixo, que só seria lido no tick real seguinte -- jogador "pula" ao tocar CONTINUAR.
    e.stopImmediatePropagation?.();
    const pt = eventoParaPontoLogico(e, opcoes.canvas);
    const alvo = botaoPausaEm(pt, confirmandoSaida);
    if (alvo) pressao.marcar(alvo, ticksAbertura);
    if (confirmandoSaida) {
      if (alvo === 'confirmar-saida') {
        pausado = false;
        confirmandoSaida = false;
        opcoes.aoConfirmarSaidaAoMenu();
      } else if (alvo === 'cancelar-saida') {
        confirmandoSaida = false;
      }
      return;
    }
    if (alvo === 'continuar') {
      pausado = false;
      opcoes.aoContinuar();
    } else if (alvo === 'reiniciar') {
      if (!opcoes.podeReiniciar()) return;
      pausado = false;
      opcoes.aoReiniciar();
    } else if (alvo === 'configuracoes') {
      opcoes.aoAbrirConfiguracoes();
    } else if (alvo === 'voltar-menu') {
      confirmandoSaida = true;
    }
  };

  const aoMover = (ev: Event): void => {
    if (!ativo()) {
      hover = null;
      return;
    }
    (ev as PointerEvent).stopImmediatePropagation?.();
    const pt = eventoParaPontoLogico(ev as PointerEvent, opcoes.canvas);
    hover = botaoPausaEm(pt, confirmandoSaida);
  };

  const aoTeclar = (ev: Event): void => {
    if (!ativo()) return;
    const e = ev as KeyboardEvent;
    // Essencial (ver cabeçalho): sem isto, Escape/P pra FECHAR a pausa também seria lido pelo teclado de baixo
    // (que chamaria `aoPausar` de novo e reabriria na hora).
    e.stopImmediatePropagation?.();
    if (confirmandoSaida) {
      if (e.code === 'Escape') confirmandoSaida = false;
      return;
    }
    if (e.code === 'Escape' || e.code === 'KeyP' || e.code === 'Enter') {
      pausado = false;
      opcoes.aoContinuar();
    }
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  janela?.addEventListener('keydown', aoTeclar);

  return {
    get pausado() {
      return pausado;
    },
    abrir() {
      pausado = true;
      confirmandoSaida = false;
      ticksAbertura = 0;
      fundo = null; // recaptura a corrida congelada na próxima `desenhar` (frame mais recente, não um velho)
    },
    continuar() {
      pausado = false;
      confirmandoSaida = false;
    },
    suspender() {
      suspenso = true;
    },
    retomar() {
      suspenso = false;
    },
    desenhar(ctx) {
      if (!ativo()) return;
      if (!fundo && doc) fundo = construirFundoCongelado(doc, ctx.canvas, 0.45);
      desenharPainelPausa(ctx, { confirmandoSaida, podeReiniciar: opcoes.podeReiniciar(), hover, t: ticksAbertura, fundo, documento: doc, spritePersonagem, pressao });
      ticksAbertura += 1;
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
