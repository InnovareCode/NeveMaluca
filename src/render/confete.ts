/**
 * Confete de comemoração (plano "corrida em campeonato" §C1): só aparece nos ~2 s de celebração após a chegada,
 * num pool fixo em espaço de TELA (não de mundo -- é uma celebração de UI, não precisa de câmera). Mesmo padrão
 * de pool circular pré-alocado de `particulas.ts` (zero alocação por quadro), determinístico via `Rng` (nunca
 * `Math.random`, proibido em `src/`).
 */
import { ALTURA, LARGURA, PASSO_S } from '../core/constantes';
import type { Rng } from '../core/rng';

const CAPACIDADE = 90;
const CORES = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#ffffff'] as const;
const GRAVIDADE_PX_S2 = 220; // leve: cai balançando como papel, não como pedra (ver `spray` de particulas.ts p/ contraste)

interface Confete {
  ativo: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  anguloGraus: number;
  velAngular: number;
  tamanho: number;
  cor: string;
  vida: number;
}

export interface SistemaConfete {
  /** Dispara uma rajada nova (chamar 1x, no instante em que a fase virou `'chegou'`). */
  estourar(): void;
  atualizar(): void;
  desenhar(ctx: CanvasRenderingContext2D): void;
}

export function criarConfete(rng: Rng): SistemaConfete {
  const pool: Confete[] = Array.from({ length: CAPACIDADE }, () => ({
    ativo: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    anguloGraus: 0,
    velAngular: 0,
    tamanho: 4,
    cor: CORES[0],
    vida: 0,
  }));

  return {
    estourar() {
      for (let i = 0; i < CAPACIDADE; i += 1) {
        const p = pool[i]!;
        p.ativo = true;
        p.x = LARGURA / 2 + rng.entre(-90, 90);
        p.y = ALTURA * 0.3 + rng.entre(-20, 20);
        const anguloRad = rng.entre(0, Math.PI * 2);
        const vel = rng.entre(60, 220);
        p.vx = Math.cos(anguloRad) * vel;
        p.vy = Math.sin(anguloRad) * vel - 140; // empurrão pra cima, soma com a rajada radial
        p.anguloGraus = rng.entre(0, 360);
        p.velAngular = rng.entre(-220, 220);
        p.tamanho = rng.entre(3, 6);
        p.cor = CORES[rng.inteiro(CORES.length)] as string;
        p.vida = rng.inteiro(60) + 60;
      }
    },

    atualizar() {
      for (let i = 0; i < CAPACIDADE; i += 1) {
        const p = pool[i]!;
        if (!p.ativo) continue;
        p.x += p.vx * PASSO_S;
        p.y += p.vy * PASSO_S;
        p.vy += GRAVIDADE_PX_S2 * PASSO_S;
        p.anguloGraus += p.velAngular * PASSO_S;
        p.vida -= 1;
        if (p.vida <= 0 || p.y > ALTURA + 40) p.ativo = false;
      }
    },

    desenhar(ctx) {
      for (let i = 0; i < CAPACIDADE; i += 1) {
        const p = pool[i]!;
        if (!p.ativo) continue;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.anguloGraus * Math.PI) / 180);
        ctx.fillStyle = p.cor;
        ctx.fillRect(-p.tamanho / 2, -p.tamanho * 0.35, p.tamanho, p.tamanho * 0.7);
        ctx.restore();
      }
    },
  };
}
