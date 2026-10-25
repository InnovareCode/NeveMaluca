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
import type { EstadoCampeonato } from '../../core/contratos';
import { seno } from '../../core/trig';
import { PERSONAGENS_DE_DADOS } from '../../data/personagens';
import { PISTA_MORRO_DO_PINHAO, PISTAS_DE_DADOS, obterPistaDeDados } from '../../data/pistas';
import { REGRAS_SAVE } from '../../data/regras-save';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { precarregarAssetsDoTema } from '../../render/temas/catalogo';
import { caminhoArredondado, criarCamadaEstatica, desenharBotao, desenharBotaoBala, desenharFlocos, desenharTexto, type CamadaEstatica, type Retangulo } from '../desenho';
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
  /** Campeonato em andamento (etapa < 5), pra oferecer "Continuar" em vez de ir direto pra seleção de personagem
   *  (pedido do dono, playtest iPhone: "quem não terminou as 5 pistas precisa ver Continuar ou Novo jogo").
   *  `null`/ausente: nenhum campeonato em andamento -- o botão CAMPEONATO funciona como sempre. */
  readonly obterCampeonatoEmAndamento?: (() => EstadoCampeonato | null) | undefined;
  /** Retoma o campeonato salvo (mesma etapa, mesmo personagem), pulando a seleção de personagem. */
  readonly aoContinuarCampeonato?: (() => void) | undefined;
  /** Apaga o campeonato em andamento e segue o fluxo de sempre (escolhe personagem -> começa do zero). Só chamado
   *  depois que o jogador confirma "sim" no sub-painel (ver `overlayCampeonato` abaixo) -- nunca direto do clique. */
  readonly aoNovoCampeonato?: (() => void) | undefined;
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

// Painel "Campeonato em andamento" (overlay central, pedido do dono: "Continuar ou Novo jogo") -- mesma receita
// visual do sub-painel de confirmação de `ui/cenas/pausa.ts` (véu + painel escuro arredondado), independente da
// geometria medida na key art acima (é um véu sólido cobrindo a tela inteira, não compete com o elenco da capa).
const PAINEL_CAMP_W = 420;
const PAINEL_CAMP_H = 230;
const PAINEL_CAMP_X = LARGURA / 2 - PAINEL_CAMP_W / 2;
const PAINEL_CAMP_Y = ALTURA / 2 - PAINEL_CAMP_H / 2;

const BOTAO_CONTINUAR_CAMP: BotaoRetangular = { id: 'continuar-campeonato', x: LARGURA / 2 - 160, y: PAINEL_CAMP_Y + 92, w: 320, h: 48 };
const BOTAO_NOVO_CAMP: BotaoRetangular = { id: 'novo-campeonato', x: LARGURA / 2 - 160, y: PAINEL_CAMP_Y + 148, w: 320, h: 48 };
const BOTAO_CANCELAR_CAMP: BotaoRetangular = { id: 'cancelar-campeonato', x: LARGURA / 2 - 160, y: PAINEL_CAMP_Y + 200, w: 320, h: 24 };

// Sub-painel "tem certeza?" do Novo Jogo (mesma geometria de `BOTAO_CONFIRMAR_SAIDA`/`BOTAO_CANCELAR_SAIDA` de
// `ui/cenas/pausa.ts`): dois botões lado a lado, dentro do MESMO painel (só o conteúdo muda).
const BOTAO_CONFIRMAR_NOVO: BotaoRetangular = { id: 'confirmar-novo', x: LARGURA / 2 - 170, y: PAINEL_CAMP_Y + 130, w: 150, h: 52 };
const BOTAO_CANCELAR_NOVO: BotaoRetangular = { id: 'cancelar-novo', x: LARGURA / 2 + 20, y: PAINEL_CAMP_Y + 130, w: 150, h: 52 };

type OverlayCampeonato = 'nenhum' | 'escolha' | 'confirmar-novo';

const NOMES_PERSONAGEM: Readonly<Record<string, string>> = Object.fromEntries(PERSONAGENS_DE_DADOS.map((d) => [d.id, d.nome]));
const TOTAL_PISTAS_CAMPEONATO = PISTAS_DE_DADOS.length;

/** Painel "Campeonato em andamento": Continuar/Novo jogo, e o sub-painel de confirmação deste último. */
function desenharOverlayCampeonato(ctx: Ctx, overlay: OverlayCampeonato, estado: EstadoCampeonato | null, hover: string | null): void {
  if (overlay === 'nenhum') return;

  ctx.save();
  ctx.fillStyle = 'rgba(5, 12, 26, 0.72)';
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  ctx.fillStyle = '#162b47';
  caminhoArredondado(ctx, { x: PAINEL_CAMP_X, y: PAINEL_CAMP_Y, w: PAINEL_CAMP_W, h: PAINEL_CAMP_H }, 18);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#2a517f';
  ctx.stroke();
  ctx.restore();

  const nome = estado ? (NOMES_PERSONAGEM[estado.personagem] ?? estado.personagem) : '';
  const etapaExibida = estado ? Math.min(estado.etapa + 1, TOTAL_PISTAS_CAMPEONATO) : 0;

  if (overlay === 'escolha') {
    desenharTexto(ctx, 'CAMPEONATO EM ANDAMENTO', LARGURA / 2, PAINEL_CAMP_Y + 38, {
      fonte: 'italic 800 26px "Barlow Condensed", Impact, sans-serif',
      cor: COR_TEXTO,
      contorno: 5,
      alinhamento: 'center',
    });
    desenharTexto(ctx, `${nome} · pista ${etapaExibida} de ${TOTAL_PISTAS_CAMPEONATO}`, LARGURA / 2, PAINEL_CAMP_Y + 66, {
      fonte: '600 15px Barlow, sans-serif',
      cor: '#8fb6e0',
      alinhamento: 'center',
    });
    desenharBotao(ctx, {
      ...BOTAO_CONTINUAR_CAMP,
      texto: 'CONTINUAR',
      corTopo: hover === 'continuar-campeonato' ? '#4ad17d' : '#31c66d',
      corBase: hover === 'continuar-campeonato' ? '#239254' : '#1d7f45',
      aoVivo: hover === 'continuar-campeonato',
      destaque: true,
    });
    desenharBotao(ctx, {
      ...BOTAO_NOVO_CAMP,
      texto: 'NOVO JOGO',
      corTopo: hover === 'novo-campeonato' ? '#e85d4a' : '#c0392b',
      corBase: hover === 'novo-campeonato' ? '#b03a26' : '#7d241a',
      aoVivo: hover === 'novo-campeonato',
    });
    desenharTexto(ctx, 'cancelar', LARGURA / 2, BOTAO_CANCELAR_CAMP.y + 16, {
      fonte: '600 14px Barlow, sans-serif',
      cor: hover === 'cancelar-campeonato' ? '#f4f9ff' : '#8fb6e0',
      alinhamento: 'center',
    });
    return;
  }

  // 'confirmar-novo': mesmo painel, conteúdo de confirmação (perder progresso é irreversível -- pedido do dono).
  desenharTexto(ctx, 'Apagar o campeonato atual?', LARGURA / 2, PAINEL_CAMP_Y + 46, {
    fonte: '700 20px Barlow, sans-serif',
    cor: COR_TEXTO,
    alinhamento: 'center',
  });
  desenharTexto(ctx, `O progresso de ${nome} nas ${TOTAL_PISTAS_CAMPEONATO} pistas será perdido.`, LARGURA / 2, PAINEL_CAMP_Y + 74, {
    fonte: '500 15px Barlow, sans-serif',
    cor: '#8fb6e0',
    alinhamento: 'center',
  });
  desenharBotao(ctx, {
    ...BOTAO_CONFIRMAR_NOVO,
    texto: 'SIM, NOVO JOGO',
    corTopo: hover === 'confirmar-novo' ? '#e85d4a' : '#c0392b',
    corBase: hover === 'confirmar-novo' ? '#b03a26' : '#7d241a',
    aoVivo: hover === 'confirmar-novo',
  });
  desenharBotao(ctx, {
    ...BOTAO_CANCELAR_NOVO,
    texto: 'CANCELAR',
    corTopo: hover === 'cancelar-novo' ? '#4da2ff' : '#2a7de1',
    corBase: hover === 'cancelar-novo' ? '#1f6fd0' : '#144d8f',
    aoVivo: hover === 'cancelar-novo',
  });
}

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
  // Overlay "Campeonato em andamento" (ver constantes acima): só existe enquanto o jogador está decidindo entre
  // Continuar/Novo jogo -- nenhum dos botões normais do menu reage a toque/tecla nesse meio tempo.
  let overlayCampeonato: OverlayCampeonato = 'nenhum';
  let hoverOverlay: string | null = null;

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

  /** Acha qual botão (se algum) está sob o ponto, de acordo com a sub-tela do overlay atual. */
  const botaoOverlayEm = (pt: { x: number; y: number }): string | null => {
    if (overlayCampeonato === 'escolha') {
      if (pontoDentroDoBotao(pt, BOTAO_CONTINUAR_CAMP)) return 'continuar-campeonato';
      if (pontoDentroDoBotao(pt, BOTAO_NOVO_CAMP)) return 'novo-campeonato';
      if (pontoDentroDoBotao(pt, BOTAO_CANCELAR_CAMP)) return 'cancelar-campeonato';
      return null;
    }
    if (overlayCampeonato === 'confirmar-novo') {
      if (pontoDentroDoBotao(pt, BOTAO_CONFIRMAR_NOVO)) return 'confirmar-novo';
      if (pontoDentroDoBotao(pt, BOTAO_CANCELAR_NOVO)) return 'cancelar-novo';
      return null;
    }
    return null;
  };

  const aoMover = (e: Event): void => {
    const ev = e as PointerEvent;
    const pt = eventoParaPontoLogico(ev, opcoes.canvas);
    if (overlayCampeonato !== 'nenhum') {
      hoverOverlay = botaoOverlayEm(pt);
      return;
    }
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

    // Overlay "Campeonato em andamento" ativo: só os botões DELE reagem -- os botões normais do menu (inclusive
    // CAMPEONATO, que fica embaixo do véu) ficam surdos enquanto o jogador decide.
    if (overlayCampeonato !== 'nenhum') {
      const alvo = botaoOverlayEm(pt);
      if (alvo === 'continuar-campeonato') {
        overlayCampeonato = 'nenhum';
        opcoes.aoContinuarCampeonato?.();
      } else if (alvo === 'novo-campeonato') {
        overlayCampeonato = 'confirmar-novo';
      } else if (alvo === 'cancelar-campeonato') {
        overlayCampeonato = 'nenhum';
      } else if (alvo === 'confirmar-novo') {
        overlayCampeonato = 'nenhum';
        opcoes.aoNovoCampeonato?.();
      } else if (alvo === 'cancelar-novo') {
        overlayCampeonato = 'escolha';
      }
      return;
    }

    if (pontoDentroDoBotao(pt, BOTAO_JOGAR)) {
      opcoes.aoJogar();
    } else if (pontoDentroDoBotao(pt, BOTAO_MODOS)) {
      // CAMPEONATO (posição que era MODOS): com um campeonato em andamento, abre o overlay Continuar/Novo jogo
      // (pedido do dono) em vez de ir direto pra seleção de personagem. Sem `aoModos`, fica inerte, nunca cai de
      // volta pra `aoJogar` (mentiria pro jogador que campeonato = descida solo).
      const emAndamento = opcoes.obterCampeonatoEmAndamento?.();
      if (emAndamento) overlayCampeonato = 'escolha';
      else opcoes.aoModos?.();
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
    if (overlayCampeonato !== 'nenhum') {
      if (ev.code === 'Escape') overlayCampeonato = overlayCampeonato === 'confirmar-novo' ? 'escolha' : 'nenhum';
      return;
    }
    if (ev.code === 'Enter' || ev.code === 'Space') {
      opcoes.aoJogar();
    } else if (ev.code === 'KeyC') {
      const emAndamento = opcoes.obterCampeonatoEmAndamento?.();
      if (emAndamento) overlayCampeonato = 'escolha';
      else opcoes.aoModos?.();
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

      desenharOverlayCampeonato(ctx, overlayCampeonato, opcoes.obterCampeonatoEmAndamento?.() ?? null, hoverOverlay);
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
