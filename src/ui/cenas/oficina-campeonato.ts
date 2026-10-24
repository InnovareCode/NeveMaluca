/**
 * Oficina de upgrade entre pistas (plano `docs/plano-corrida-campeonato.md` §C-D3/C-D4, C5a/C6, C8b): gasta flocos
 * pra subir UM nível do personagem (`data/evolucao.ts` → `comprarNivel`, um nível só, melhora os 3 atributos
 * juntos -- "giro fora", plano C-D4). Quem persiste é o chamador (`aoComprar`, mesmo padrão de "só avisa, quem
 * grava é o gerenciador" de `ui/cenas/selecao.ts`/`opcoes.ts`); esta tela sempre LÊ o estado fresco por
 * `obterEvolucao()` a cada quadro, nunca um valor cacheado na criação -- depois de comprar, o número muda sem
 * precisar remontar a cena.
 *
 * PENDÊNCIA conhecida (não é desta tela): `aplicarEvolucao` (a física do upgrade, C6, Vega, `descida/atributos.ts`)
 * ainda não existe -- o nível comprado aqui fica gravado no save, mas por ora não muda a física da descida.
 */
import { ALTURA, LARGURA } from '../../core/constantes';
import type { Evolucao, IdPersonagem } from '../../core/contratos';
import { carregarSpritePersonagem, type SpritePersonagem } from '../../assets/index';
import { ATRIBUTOS_EVOLUCAO, NIVEL_MAXIMO_EVOLUCAO, PASSO_ATRIBUTO_POR_NIVEL, custoDoNivel, type AtributoEvolucao } from '../../data/evolucao';
import type { AlvoTeclado } from '../../input/teclado';
import type { AlvoToque } from '../../input/toque';
import type { Ctx } from '../../platform/canvas';
import { caminhoArredondado, desenharBotaoBala, desenharTexto } from '../desenho';
import { eventoParaPontoLogico, pontoDentroDoBotao, type BotaoRetangular } from '../interacao';
import type { Cena } from '../tipos';
import { criarFundoCampeonato } from './fundo-campeonato';

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

/** Rótulos em pt-BR (plano C-D4: "Velocidade, Equilíbrio, Força"). */
const NOME_ATRIBUTO: Readonly<Record<AtributoEvolucao, string>> = {
  velocidade: 'Velocidade',
  equilibrio: 'Equilíbrio',
  forca: 'Força',
};

const COR_TEXTO = '#f4f9ff';
const COR_CONTORNO = '#0b1a33';
const COR_DESTAQUE = '#ffd166';

const PAINEL_X = LARGURA / 2 - 260;
const PAINEL_Y = 130;
const PAINEL_W = 520;
const PAINEL_H = 260;

const BOTAO_COMPRAR: BotaoRetangular = { id: 'comprar', x: LARGURA / 2 - 150, y: PAINEL_Y + PAINEL_H + 24, w: 300, h: 54 };
const BOTAO_CONTINUAR: BotaoRetangular = { id: 'continuar', x: LARGURA / 2 - 110, y: ALTURA - 68, w: 220, h: 42 };

export function criarCenaOficina(opcoes: OpcoesCenaOficina): Cena {
  const janela = opcoes.janela ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = opcoes.documento ?? (typeof document !== 'undefined' ? document : undefined);
  const fundo = criarFundoCampeonato('parque', doc); // oficina é "base", não uma pista específica -- mesmo tema key art do menu

  let sprite: SpritePersonagem | null = null;
  void carregarSpritePersonagem(opcoes.personagem)
    .then((s) => {
      sprite = s;
    })
    .catch(() => {
      // fallback silencioso
    });

  let hover: string | null = null;
  let ticks = 0;

  const aoMover = (e: Event): void => {
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_COMPRAR)) hover = 'comprar';
    else if (pontoDentroDoBotao(pt, BOTAO_CONTINUAR)) hover = 'continuar';
    else hover = null;
  };

  const aoTocar = (e: Event): void => {
    e.preventDefault?.();
    const pt = eventoParaPontoLogico(e as PointerEvent, opcoes.canvas);
    if (pontoDentroDoBotao(pt, BOTAO_COMPRAR)) opcoes.aoComprar();
    else if (pontoDentroDoBotao(pt, BOTAO_CONTINUAR)) opcoes.aoContinuar();
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
      fundo.desenhar(ctx, 0, ticks + alpha);
      ctx.save();
      ctx.fillStyle = 'rgba(8, 18, 36, 0.42)';
      ctx.fillRect(0, 0, LARGURA, ALTURA);
      ctx.restore();

      const evolucao = opcoes.obterEvolucao();
      const nivelAtual = evolucao.niveis[opcoes.personagem] ?? 0;
      const noMaximo = nivelAtual >= NIVEL_MAXIMO_EVOLUCAO;
      const custo = custoDoNivel(nivelAtual + 1);
      const temFlocos = custo !== undefined && evolucao.flocos >= custo;

      desenharTexto(ctx, 'OFICINA DA MONTANHA', LARGURA / 2, 58, {
        fonte: 'italic 900 40px "Barlow Condensed", Impact, sans-serif',
        cor: COR_DESTAQUE,
        contorno: 8,
        corContorno: COR_CONTORNO,
        alinhamento: 'center',
      });
      desenharTexto(ctx, `${opcoes.nomePersonagem} · nível ${nivelAtual}/${NIVEL_MAXIMO_EVOLUCAO} · ❄ ${evolucao.flocos} flocos`, LARGURA / 2, 88, {
        fonte: '600 17px Barlow, sans-serif',
        cor: COR_TEXTO,
        contorno: 4,
        alinhamento: 'center',
      });

      // Retrato pequeno, canto esquerdo do painel.
      const quadro = sprite ? (sprite.obterQuadro('ride0') ?? sprite.obterQuadro('star')) : null;
      ctx.save();
      ctx.translate(PAINEL_X - 60, PAINEL_Y + PAINEL_H / 2);
      if (quadro) {
        const d = quadro.dados;
        const escala = 150 / d.altura;
        const [ancoraX, ancoraY] = d.contato ?? d.pivo;
        ctx.drawImage(quadro.imagem, -ancoraX * escala, -ancoraY * escala, d.largura * escala, d.altura * escala);
      } else {
        ctx.fillStyle = '#8e5b23';
        ctx.beginPath();
        ctx.ellipse(0, 0, 30, 40, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.fillStyle = 'rgba(12, 27, 48, 0.78)';
      caminhoArredondado(ctx, { x: PAINEL_X, y: PAINEL_Y, w: PAINEL_W, h: PAINEL_H }, 16);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#2a517f';
      ctx.stroke();
      ctx.restore();

      desenharTexto(ctx, `Próximo nível (${nivelAtual + 1}) melhora:`, PAINEL_X + 24, PAINEL_Y + 34, {
        fonte: '700 18px Barlow, sans-serif',
        cor: COR_TEXTO,
      });

      ATRIBUTOS_EVOLUCAO.forEach((atributo, indice) => {
        const y = PAINEL_Y + 74 + indice * 44;
        desenharTexto(ctx, NOME_ATRIBUTO[atributo], PAINEL_X + 24, y, { fonte: '600 18px Barlow, sans-serif', cor: COR_TEXTO, base: 'middle' });
        const bonusAtual = nivelAtual * PASSO_ATRIBUTO_POR_NIVEL;
        const bonusProximo = Math.min(nivelAtual + 1, NIVEL_MAXIMO_EVOLUCAO) * PASSO_ATRIBUTO_POR_NIVEL;
        desenharTexto(ctx, noMaximo ? `+${bonusAtual}` : `+${bonusAtual} → +${bonusProximo}`, PAINEL_X + PAINEL_W - 24, y, {
          fonte: '700 17px Barlow, sans-serif',
          cor: noMaximo ? '#8fd99f' : COR_DESTAQUE,
          alinhamento: 'right',
          base: 'middle',
        });
      });

      desenharTexto(
        ctx,
        noMaximo ? 'Nível máximo atingido' : `Custa ${custo ?? '?'} flocos`,
        PAINEL_X + PAINEL_W / 2,
        PAINEL_Y + PAINEL_H - 20,
        { fonte: '600 15px Barlow, sans-serif', cor: '#8fb6e0', alinhamento: 'center' },
      );

      desenharBotaoBala(ctx, {
        ...BOTAO_COMPRAR,
        texto: noMaximo ? 'NÍVEL MÁXIMO' : temFlocos ? `COMPRAR NÍVEL ${nivelAtual + 1}` : 'FLOCOS INSUFICIENTES',
        destaque: true,
        corTopo: noMaximo || !temFlocos ? '#5a6b85' : hover === 'comprar' ? '#ffe066' : '#f6c90e',
        corBase: noMaximo || !temFlocos ? '#3b4a61' : hover === 'comprar' ? '#f39c12' : '#d35400',
        aoVivo: hover === 'comprar' && !noMaximo && temFlocos,
      });

      desenharBotaoBala(ctx, {
        ...BOTAO_CONTINUAR,
        texto: 'CONTINUAR',
        corTopo: hover === 'continuar' ? '#4da2ff' : '#2a7de1',
        corBase: hover === 'continuar' ? '#1f6fd0' : '#144d8f',
        aoVivo: hover === 'continuar',
      });
    },
    destruir() {
      opcoes.canvas.removeEventListener('pointerdown', aoTocar);
      opcoes.canvas.removeEventListener('pointermove', aoMover);
      janela?.removeEventListener('keydown', aoTeclar);
    },
  };
}
