/**
 * Cena de Menu Principal (Canvas 2D) -- CAPA OFICIAL estilo key art (pedido do dono, ref. Crash 4): `capa.webp`
 * (1920x1072, os 6 personagens + Capi herói ao centro, `public/assets/menu/`) em tela cheia com efeito Ken Burns
 * (zoom/pan lento) + neve caindo por cima, e `logo.webp` no canto superior esquerdo livre (~34% da largura) com
 * respiração/brilho sutis. Substitui o antigo pelotão de sprites desenhado à mão + fundo raster do tema `parque`
 * (`menu-capa.ts` cuida do carregamento, mesmo padrão de `render/temas/parque-raster.ts`).
 *
 * Geometria dos botões medida PIXEL A PIXEL na própria arte (`capa.webp`, grade de 10%): o elenco ocupa quase toda
 * a largura a partir de ~19% (o cara deitado, canto inferior esquerdo) e ~20% (a criança) -- não sobra espaço para
 * uma coluna cheia de 0 a 540. A coluna de botões (x 20..240) fica à esquerda, ABAIXO do logo, com uma folga sem
 * botão entre y 292 e 400 bem em cima do rosto do cara deitado (óculos escuros + bigode, ~y 346..388) -- nenhum
 * botão entra nessa faixa. Acima dela (TREINO/CAMPEONATO) e abaixo (OPÇÕES/PERSONAGEM/PISTA) os botões só tocam
 * roupa/prancha dos personagens de fundo, nunca um rosto, e o Capi (x >= 403) fica inteiro livre. Confirmado por
 * screenshot real (skill `medir-antes-de-afirmar`), não só pela conta -- reajuste aqui se a arte mudar.
 *
 * Contrato de callbacks: `aoJogar`/`aoModos`/`aoOpcoes`/`aoPersonagem`/`aoPista` e os rótulos (TREINO/CAMPEONATO/
 * OPÇÕES/PERSONAGEM/PISTA) continuam os mesmos de antes; só a GEOMETRIA mudou (testes em
 * `tests/unit/ui-cenas-fase1.test.ts` e os e2e `fase1-fluxo-cenas`/`selecao-pista`/`selecao-personagem`/
 * `campeonato-corrida` foram atualizados para as novas coordenadas).
 */
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import { ALTURA, LARGURA, TICKS_POR_SEGUNDO } from '../../core/constantes';
import { seno } from '../../core/trig';
import { PISTA_MORRO_DO_PINHAO, obterPistaDeDados } from '../../data/pistas';
import { REGRAS_SAVE } from '../../data/regras-save';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { precarregarAssetsDoTema } from '../../render/temas/catalogo';
import { caminhoArredondado, criarCamadaEstatica, desenharBotaoBala, desenharFlocos, desenharTexto, type CamadaEstatica, type Retangulo } from '../desenho';
import { eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import type { Cena } from '../tipos';
import { assetsMenuCapaProntos, precarregarAssetsMenuCapa } from './menu-capa';

export interface OpcoesCenaMenu {
  readonly canvas: AlvoToque;
  readonly janela?: AlvoTeclado | undefined;
  readonly documento?: Document | undefined;
  readonly aoJogar: () => void;
  readonly aoModos?: (() => void) | undefined;
  readonly aoOpcoes: () => void;
  /** Abre a tela de seleção de personagem; sem ela, o botão PERSONAGEM fica inerte (testes que não usam o recurso). */
  readonly aoPersonagem?: (() => void) | undefined;
  /** Abre a tela de seleção de pista; sem ela, o botão PISTA fica inerte (testes que não usam o recurso). */
  readonly aoPista?: (() => void) | undefined;
  /** Id do personagem ativo: mostrado no cartão pequeno ao lado do botão PERSONAGEM; sem ele, cai no 1º do save. */
  readonly obterPersonagemAtivo?: (() => string) | undefined;
  /** Pista ativa do save; sem ela, nada extra é pré-carregado. Dispara o preload do raster DELA desde já -- TREINO/
   * CAMPEONATO pulam `selecao-pista.ts` e, até o polimento "Pixar no gameplay", só `descida.ts`/`corrida.ts`
   * disparavam isto, já tarde demais pro 1º quadro deles. O menu dá o maior tempo de folga possível. */
  readonly obterPistaAtiva?: (() => string) | undefined;
}

const COR_TEXTO = '#f4f9ff';

const BOTOES_LARGURA = 220;
const BOTAO_H = 40;
const BOTOES_X = 20;

const BOTAO_JOGAR: BotaoRetangular = { id: 'jogar', x: BOTOES_X, y: 204, w: BOTOES_LARGURA, h: BOTAO_H };
const BOTAO_MODOS: BotaoRetangular = { id: 'modos', x: BOTOES_X, y: 252, w: BOTOES_LARGURA, h: BOTAO_H };
// Folga SEM botão entre 292 e 400 (ver comentário de topo): bem em cima do rosto do personagem de fundo deitado.
const BOTAO_OPCOES: BotaoRetangular = { id: 'opcoes', x: BOTOES_X, y: 400, w: BOTOES_LARGURA, h: BOTAO_H };
const BOTAO_PERSONAGEM: BotaoRetangular = { id: 'personagem', x: BOTOES_X, y: 448, w: BOTOES_LARGURA, h: BOTAO_H };
const BOTAO_PISTA: BotaoRetangular = { id: 'pista', x: BOTOES_X, y: 496, w: BOTOES_LARGURA, h: BOTAO_H };

/** Cartão pequeno do personagem ativo (brief: "se o menu mostrava o personagem ativo, um cartão pequeno basta"),
 *  ao lado do botão PERSONAGEM -- substitui o antigo pelotão inteiro como forma de mostrar quem está selecionado. */
const CARTAO_PERSONAGEM: Retangulo = { x: BOTAO_PERSONAGEM.x + BOTOES_LARGURA + 10, y: BOTAO_PERSONAGEM.y, w: 56, h: BOTAO_H };

/** Logo (`logo.webp`) no canto superior esquerdo livre da capa, ~34% da largura (818x433 de origem: razão 1,889). */
const LOGO_X = 24;
const LOGO_Y = 16;
const LOGO_W = LARGURA * 0.34;
const LOGO_H = LOGO_W / (818 / 433);

/** Tela de carregamento (NUNCA o fallback vetorial de montanha -- pedido do dono): fundo liso na paleta do jogo +
 *  neve + texto pulsante, sem tentar imitar a cena raster. Só aparece nos poucos quadros antes de `capa.webp`
 *  decodificar (cache do navegador deixa isso instantâneo nas visitas seguintes). */
function pintarFundoDeCarregamento(ctx: Ctx): void {
  const ceu = ctx.createLinearGradient(0, 0, 0, ALTURA);
  ceu.addColorStop(0, '#0b1a3a');
  ceu.addColorStop(1, '#173a6e');
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, LARGURA, ALTURA);
}

/** Desenha `capa.webp` cobrindo os 960x540 lógicos inteiros (sem distorcer) com Ken Burns bem lento (zoom + pan
 *  oscilando devagar, períodos diferentes por eixo pra não sincronizar) -- o canvas lógico já é sempre 16:9 via
 *  letterbox de `platform/escala.ts`, então "qualquer proporção de tela" (incl. iPhone paisagem) é coberta por
 *  construção; aqui só falta a imagem preencher os 960x540 sem sobrar borda. */
function desenharCapaKenBurns(ctx: Ctx, img: HTMLImageElement, t: number): void {
  const s = t / TICKS_POR_SEGUNDO;
  const zoom = 1.045 + 0.025 * seno(s * (360 / 54));
  const panX = 14 * seno(s * (360 / 71));
  const panY = 8 * seno(s * (360 / 63) + 40);

  const escalaBase = Math.max(LARGURA / img.naturalWidth, ALTURA / img.naturalHeight);
  const escala = escalaBase * zoom;
  const destLargura = img.naturalWidth * escala;
  const destAltura = img.naturalHeight * escala;
  const destX = (LARGURA - destLargura) / 2 + panX;
  const destY = (ALTURA - destAltura) / 2 + panY;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, LARGURA, ALTURA);
  ctx.clip();
  ctx.drawImage(img, destX, destY, destLargura, destAltura);
  ctx.restore();
}

export function criarCenaMenu(opcoes: OpcoesCenaMenu): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);

  let ticks = 0;
  let botaoHover: string | null = null;
  let fundoCarregamento: CamadaEstatica | null = null;

  void precarregarAssetsMenuCapa();

  // Pista ativa: preload cedo (fire-and-forget), não pro cenário do PRÓPRIO menu (agora é `capa.webp`, acima) --
  // pro TREINO/CAMPEONATO que o jogador pode abrir a qualquer momento a partir daqui.
  if (opcoes.obterPistaAtiva) {
    const temaDaAtiva = (obterPistaDeDados(opcoes.obterPistaAtiva()) ?? PISTA_MORRO_DO_PINHAO).tema;
    void precarregarAssetsDoTema(temaDaAtiva, doc);
  }

  // Cartão do personagem ativo: só 1 sprite (não o elenco inteiro), melhor esforço -- cai no fallback de cápsula
  // enquanto não carrega (mesma técnica de `ui/cenas/abertura-campeonato.ts`).
  let spriteAtivo: SpritePersonagem | null = null;
  const idAtivoNoBoot = opcoes.obterPersonagemAtivo?.() ?? REGRAS_SAVE.iniciais[0] ?? 'capi';
  void carregarSpritePersonagem(idAtivoNoBoot)
    .then((s) => {
      spriteAtivo = s;
    })
    .catch(() => {
      // fallback silencioso: o cartão mostra a cápsula genérica
    });

  const aoMover = (e: Event): void => {
    const ev = e as PointerEvent;
    const pt = eventoParaPontoLogico(ev, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_JOGAR)) botaoHover = 'jogar';
    else if (pontoDentroDoBotao(pt, BOTAO_MODOS)) botaoHover = 'modos';
    else if (pontoDentroDoBotao(pt, BOTAO_OPCOES)) botaoHover = 'opcoes';
    else if (pontoDentroDoBotao(pt, BOTAO_PERSONAGEM)) botaoHover = 'personagem';
    else if (pontoDentroDoBotao(pt, BOTAO_PISTA)) botaoHover = 'pista';
    else botaoHover = null;
  };

  const aoTocar = (e: Event): void => {
    e.preventDefault?.();
    const ev = e as PointerEvent;
    const pt = eventoParaPontoLogico(ev, opcoes.canvas);

    if (pontoDentroDoBotao(pt, BOTAO_JOGAR)) {
      opcoes.aoJogar();
    } else if (pontoDentroDoBotao(pt, BOTAO_MODOS)) {
      // CAMPEONATO (posição que era MODOS): sem `aoModos`, fica inerte, nunca cai de volta pra `aoJogar` (mentiria
      // pro jogador que campeonato = descida solo).
      opcoes.aoModos?.();
    } else if (pontoDentroDoBotao(pt, BOTAO_OPCOES)) {
      opcoes.aoOpcoes();
    } else if (pontoDentroDoBotao(pt, BOTAO_PERSONAGEM)) {
      opcoes.aoPersonagem?.();
    } else if (pontoDentroDoBotao(pt, BOTAO_PISTA)) {
      opcoes.aoPista?.();
    }
  };

  const aoTeclar = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.code === 'Enter' || ev.code === 'Space') {
      opcoes.aoJogar();
    } else if (ev.code === 'KeyC') {
      opcoes.aoModos?.();
    } else if (ev.code === 'KeyO') {
      opcoes.aoOpcoes();
    } else if (ev.code === 'KeyP') {
      opcoes.aoPersonagem?.();
    } else if (ev.code === 'KeyT') {
      opcoes.aoPista?.();
    }
  };

  opcoes.canvas.addEventListener('pointerdown', aoTocar);
  opcoes.canvas.addEventListener('pointermove', aoMover);
  janela?.addEventListener('keydown', aoTeclar);

  return {
    id: 'menu',
    atualizar() {
      ticks += 1;
    },
    desenhar(ctx: Ctx, alpha: number) {
      const t = ticks + alpha;
      const assets = assetsMenuCapaProntos();

      if (assets) {
        desenharCapaKenBurns(ctx, assets.capa, t);

        // Véu escuro à esquerda (brief: "gradiente escuro pra leitura"), atrás do logo e dos botões -- não cobre o
        // Capi nem o resto do elenco, que fica livre à direita de x~320.
        const veu = ctx.createLinearGradient(0, 0, 320, 0);
        veu.addColorStop(0, 'rgba(5, 12, 26, 0.58)');
        veu.addColorStop(1, 'rgba(5, 12, 26, 0)');
        ctx.fillStyle = veu;
        ctx.fillRect(0, 0, 320, ALTURA);
      } else {
        if (!fundoCarregamento && doc) fundoCarregamento = criarCamadaEstatica(doc, pintarFundoDeCarregamento);
        if (fundoCarregamento) fundoCarregamento.desenhar(ctx);
        else pintarFundoDeCarregamento(ctx);

        desenharFlocos(ctx, 40, t);
        desenharTexto(ctx, `Carregando${'.'.repeat(1 + (Math.floor(t / 20) % 3))}`, LARGURA / 2, ALTURA * 0.56, {
          fonte: '700 20px Barlow, sans-serif',
          cor: COR_TEXTO,
          contorno: 4,
          alinhamento: 'center',
          base: 'middle',
        });
        return;
      }

      desenharFlocos(ctx, 36, t);

      // Logo: respiração (escala) + brilho (halo radial) sutis -- sem `shadowBlur`/`filter` (caro em canvas por
      // software, mesma regra de performance do README de `render/`).
      const s = t / TICKS_POR_SEGUNDO;
      const pulso = 1 + 0.025 * seno(s * (360 / 6));
      const brilhoAlpha = 0.26 + 0.14 * Math.max(0, seno(s * (360 / 6)));
      const logoCx = LOGO_X + LOGO_W / 2;
      const logoCy = LOGO_Y + LOGO_H / 2;
      const raioHalo = Math.max(LOGO_W, LOGO_H) * 0.58;

      ctx.save();
      const halo = ctx.createRadialGradient(logoCx, logoCy, 8, logoCx, logoCy, raioHalo);
      halo.addColorStop(0, `rgba(255, 255, 255, ${brilhoAlpha})`);
      halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(logoCx - raioHalo, logoCy - raioHalo, raioHalo * 2, raioHalo * 2);
      ctx.translate(logoCx, logoCy);
      ctx.scale(pulso, pulso);
      ctx.drawImage(assets.logo, -LOGO_W / 2, -LOGO_H / 2, LOGO_W, LOGO_H);
      ctx.restore();

      // Botões "bala": TREINO (destaque, descida solo) e CAMPEONATO na mesma posição/rótulo de sempre (ver
      // comentário de topo do arquivo).
      desenharBotaoBala(ctx, {
        ...BOTAO_JOGAR,
        texto: 'TREINO',
        corTopo: botaoHover === 'jogar' ? '#ffe066' : '#f6c90e',
        corBase: botaoHover === 'jogar' ? '#f39c12' : '#d35400',
        destaque: true,
        aoVivo: botaoHover === 'jogar',
      });

      desenharBotaoBala(ctx, {
        ...BOTAO_MODOS,
        texto: 'CAMPEONATO',
        corTopo: botaoHover === 'modos' ? '#4da2ff' : '#2a7de1',
        corBase: botaoHover === 'modos' ? '#1f6fd0' : '#144d8f',
        aoVivo: botaoHover === 'modos',
      });

      desenharBotaoBala(ctx, {
        ...BOTAO_OPCOES,
        texto: 'OPÇÕES',
        corTopo: botaoHover === 'opcoes' ? '#4da2ff' : '#2a7de1',
        corBase: botaoHover === 'opcoes' ? '#1f6fd0' : '#144d8f',
        aoVivo: botaoHover === 'opcoes',
      });

      desenharBotaoBala(ctx, {
        ...BOTAO_PERSONAGEM,
        texto: 'PERSONAGEM',
        corTopo: botaoHover === 'personagem' ? '#4da2ff' : '#2a7de1',
        corBase: botaoHover === 'personagem' ? '#1f6fd0' : '#144d8f',
        aoVivo: botaoHover === 'personagem',
      });

      desenharBotaoBala(ctx, {
        ...BOTAO_PISTA,
        texto: 'PISTA',
        corTopo: botaoHover === 'pista' ? '#4da2ff' : '#2a7de1',
        corBase: botaoHover === 'pista' ? '#1f6fd0' : '#144d8f',
        aoVivo: botaoHover === 'pista',
      });

      // Cartão pequeno do personagem ativo, ao lado de PERSONAGEM.
      ctx.save();
      ctx.fillStyle = 'rgba(8, 18, 36, 0.6)';
      caminhoArredondado(ctx, CARTAO_PERSONAGEM, 10);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = botaoHover === 'personagem' ? '#ffffff' : '#2a517f';
      ctx.stroke();
      ctx.save();
      caminhoArredondado(ctx, CARTAO_PERSONAGEM, 10);
      ctx.clip();
      const quadro = spriteAtivo ? (spriteAtivo.obterQuadro('ride0') ?? spriteAtivo.obterQuadro('star')) : null;
      const cx = CARTAO_PERSONAGEM.x + CARTAO_PERSONAGEM.w / 2;
      const cy = CARTAO_PERSONAGEM.y + CARTAO_PERSONAGEM.h / 2 + 2;
      if (quadro) {
        const d = quadro.dados;
        const escala = (CARTAO_PERSONAGEM.h - 6) / d.altura;
        const [ancoraX, ancoraY] = d.contato ?? d.pivo;
        ctx.drawImage(quadro.imagem, cx - ancoraX * escala, cy - ancoraY * escala, d.largura * escala, d.altura * escala);
      } else {
        ctx.fillStyle = '#8e5b23';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 10, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.restore();

      // Rodapé (canto inferior direito: a coluna de botões agora ocupa o canto inferior esquerdo).
      desenharTexto(ctx, 'v1.0 · Neve Maluca · Innovare Games', LARGURA - 20, ALTURA - 16, {
        fonte: '600 14px Barlow, sans-serif',
        cor: COR_TEXTO,
        contorno: 3,
        alinhamento: 'right',
      });
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
