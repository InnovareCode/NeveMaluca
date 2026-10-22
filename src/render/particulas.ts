/**
 * Sistema de partículas e rastro de neve (plano §2.1, §2.2 e Fase 2 da direção de arte):
 * 1. Flocos de neve em camadas de profundidade (fundo, meio, frente) com perspectiva e brisa suave.
 * 2. Spray de neve saindo da prancha no chão, com arco balístico, dispersão e rajadas em pousos/tombos.
 *
 * Alta performance (60 fps garantido):
 * - Flocos determinísticos com fórmula matemática direta, sem alocação no loop.
 * - Spray com pool circular fixo de partículas recicladas (zero garbage collection no frame).
 * - Determinismo visual via `Rng` (nunca `Math.random`).
 */
import { ALTURA, LARGURA, PASSO_S, PX_POR_METRO } from '../core/constantes';
import type { EventoDescida, PilotoLeitura } from '../core/contratos';
import type { Rng } from '../core/rng';
import { mundoParaTela, pxPorMetro, type EstadoCamera } from './mundo';

const CAPACIDADE_SPRAY = 128;

interface ParticulaSpray {
  ativo: boolean;
  x: number; // metros no mundo
  y: number; // metros no mundo
  vx: number; // m/s
  vy: number; // m/s
  vida: number; // ticks restantes
  vidaMax: number; // ticks totais
  raioBasePx: number;
  alpha: number;
}

export interface SistemaParticulas {
  /** Atualiza o spray com base no estado do piloto e nos eventos do tick. */
  atualizar(piloto: PilotoLeitura, eventos: readonly EventoDescida[]): void;
  /** Desenha o spray de neve emitido pela prancha e impactos. */
  desenharSpray(ctx: CanvasRenderingContext2D, camera: EstadoCamera): void;
  /** Desenha os flocos de neve distantes (camada de fundo, atrás dos objetos/piloto). */
  desenharFlocosFundo(ctx: CanvasRenderingContext2D, cameraXm: number, tempoTicks: number): void;
  /** Desenha os flocos de neve próximos (camada frontal, na frente do piloto para sensação de profundidade 3D). */
  desenharFlocosFrente(ctx: CanvasRenderingContext2D, cameraXm: number, tempoTicks: number): void;
  /** Reseta todas as partículas ativas. */
  limpar(): void;
}

const FLOCOS_FUNDO_TOTAL = 45;
const FLOCOS_MEIO_TOTAL = 35;
const FLOCOS_FRENTE_TOTAL = 20;

/**
 * Desenha os flocos de profundidade em camada de fundo (distante + médio).
 * Determinístico bit a bit, rápido e sem alocação de objetos.
 */
export function desenharFlocosProfundidadeFundo(
  ctx: CanvasRenderingContext2D,
  cameraXm: number,
  tempoTicks: number
): void {
  // 1. Camada mais distante: flocos sutis, azuis-gelo suaves, menores
  ctx.fillStyle = 'rgba(191, 217, 238, 0.55)';
  ctx.beginPath();
  for (let i = 0; i < FLOCOS_FUNDO_TOTAL; i += 1) {
    const xBruto = ((i * 797) % LARGURA) + (0.12 + (i % 3) * 0.05) * tempoTicks - cameraXm * 0.15;
    const x = ((xBruto % LARGURA) + LARGURA) % LARGURA;
    const y = (((i * 541) % ALTURA) + (0.28 + (i % 4) * 0.1) * tempoTicks) % ALTURA;
    const raio = 1.0 + (i % 3) * 0.4;
    ctx.moveTo(x + raio, y);
    ctx.arc(x, y, raio, 0, Math.PI * 2);
  }
  ctx.fill();

  // 2. Camada intermediária: flocos brancos-neve, velocidade média
  ctx.fillStyle = 'rgba(247, 251, 255, 0.75)';
  ctx.beginPath();
  for (let i = 0; i < FLOCOS_MEIO_TOTAL; i += 1) {
    const xBruto = ((i * 911) % LARGURA) + (0.25 + (i % 4) * 0.08) * tempoTicks - cameraXm * 0.35;
    const x = ((xBruto % LARGURA) + LARGURA) % LARGURA;
    const y = (((i * 647) % ALTURA) + (0.45 + (i % 5) * 0.15) * tempoTicks) % ALTURA;
    const raio = 1.8 + (i % 3) * 0.5;
    ctx.moveTo(x + raio, y);
    ctx.arc(x, y, raio, 0, Math.PI * 2);
  }
  ctx.fill();
}

/**
 * Desenha os flocos frontais (próximos da lente, com sensação de volume 3D Pixar).
 */
export function desenharFlocosProfundidadeFrente(
  ctx: CanvasRenderingContext2D,
  cameraXm: number,
  tempoTicks: number
): void {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.beginPath();
  for (let i = 0; i < FLOCOS_FRENTE_TOTAL; i += 1) {
    // Flocos frontais reagem mais ao vento e ao movimento da câmera
    const balanco = Math.sin((tempoTicks + i * 17) * 0.04) * 6;
    const xBruto = ((i * 1033) % LARGURA) + (0.4 + (i % 3) * 0.15) * tempoTicks - cameraXm * 0.7 + balanco;
    const x = ((xBruto % LARGURA) + LARGURA) % LARGURA;
    const y = (((i * 701) % ALTURA) + (0.8 + (i % 4) * 0.25) * tempoTicks) % ALTURA;
    const raio = 3.0 + (i % 3) * 0.9;
    ctx.moveTo(x + raio, y);
    ctx.arc(x, y, raio, 0, Math.PI * 2);
  }
  ctx.fill();
}

/**
 * Cria um gerenciador de partículas com pool circular fixo para o spray de neve e controle de flocos.
 */
export function criarSistemaParticulas(rng: Rng): SistemaParticulas {
  const pool: ParticulaSpray[] = Array.from({ length: CAPACIDADE_SPRAY }, () => ({
    ativo: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    vida: 0,
    vidaMax: 20,
    raioBasePx: 3,
    alpha: 0.8,
  }));
  let indiceCabeca = 0;

  function emitir(x: number, y: number, vx: number, vy: number, vidaMax: number, raioBasePx: number, alpha = 0.8): void {
    const p = pool[indiceCabeca]!;
    p.ativo = true;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.vida = vidaMax;
    p.vidaMax = vidaMax;
    p.raioBasePx = raioBasePx;
    p.alpha = alpha;
    indiceCabeca = (indiceCabeca + 1) % CAPACIDADE_SPRAY;
  }

  return {
    atualizar(piloto, eventos) {
      // 1. Atualiza partículas ativas
      for (let i = 0; i < CAPACIDADE_SPRAY; i += 1) {
        const p = pool[i]!;
        if (!p.ativo) continue;
        p.x += p.vx * PASSO_S;
        p.y += p.vy * PASSO_S;
        p.vy -= 9.8 * PASSO_S; // gravidade na neve
        p.vx *= 0.92; // resistência do ar
        p.vida -= 1;
        if (p.vida <= 0) {
          p.ativo = false;
        }
      }

      // 2. Emissão de spray da prancha no chão
      if (piloto.modo === 'chao' && piloto.velocidade > 0.6) {
        // Calcula o ponto traseiro da prancha no chão (em metros)
        const rad = (piloto.angulo * Math.PI) / 180;
        const meioPrancha = 0.55;
        const traseiraX = piloto.x - Math.cos(rad) * meioPrancha;
        const traseiraY = piloto.y - Math.sin(rad) * meioPrancha;

        // Taxa de emissão proporcional à velocidade
        const intensidade = Math.min(4, Math.max(1, Math.floor(piloto.velocidade / 5)));
        for (let k = 0; k < intensidade; k += 1) {
          const velSpray = piloto.velocidade * 0.35 + rng.entre(0.5, 2.0);
          // Dispersão para trás e para cima com arco balístico fofo
          const anguloSprayRad = rad + Math.PI + rng.entre(-0.4, 0.7);
          const vx = Math.cos(anguloSprayRad) * velSpray + rng.entre(-0.4, 0.4);
          const vy = Math.abs(Math.sin(anguloSprayRad)) * velSpray + rng.entre(0.6, 2.2);
          const duracao = rng.inteiro(14) + 12;
          const tamanho = rng.entre(2.0, 4.2);
          emitir(traseiraX + rng.entre(-0.08, 0.08), traseiraY + rng.entre(-0.04, 0.08), vx, vy, duracao, tamanho, 0.75);
        }
      }

      // 3. Eventos de pouso e tombo (rajada de neve fofa)
      for (const ev of eventos) {
        if (ev.tipo === 'pouso') {
          const qtd = ev.qualidade === 'perfeito' ? 14 : ev.qualidade === 'bom' ? 10 : 18;
          for (let k = 0; k < qtd; k += 1) {
            const angulo = rng.entre(0.2, Math.PI - 0.2);
            const vel = rng.entre(2.0, 5.5) + (ev.queda * 0.3);
            const vx = Math.cos(angulo) * vel * (rng.proximo() > 0.5 ? 1 : -1);
            const vy = Math.sin(angulo) * vel + rng.entre(0.5, 2.0);
            const duracao = rng.inteiro(16) + 14;
            const tamanho = rng.entre(2.5, 5.0);
            emitir(piloto.x + rng.entre(-0.3, 0.3), piloto.y, vx, vy, duracao, tamanho, 0.85);
          }
        } else if (ev.tipo === 'tombo') {
          for (let k = 0; k < 24; k += 1) {
            const angulo = rng.entre(0.1, Math.PI - 0.1);
            const vel = rng.entre(3.0, 7.5);
            const vx = Math.cos(angulo) * vel * (rng.proximo() > 0.5 ? 1 : -1);
            const vy = Math.sin(angulo) * vel + rng.entre(1.0, 3.5);
            const duracao = rng.inteiro(20) + 18;
            const tamanho = rng.entre(3.0, 6.0);
            emitir(piloto.x + rng.entre(-0.4, 0.4), piloto.y, vx, vy, duracao, tamanho, 0.9);
          }
        }
      }
    },

    desenharSpray(ctx, camera) {
      const escala = pxPorMetro(PX_POR_METRO, camera.zoom);
      const fatorEscala = escala / PX_POR_METRO;

      // Desenha as partículas agrupadas
      for (let i = 0; i < CAPACIDADE_SPRAY; i += 1) {
        const p = pool[i]!;
        if (!p.ativo) continue;

        const pt = mundoParaTela(p.x, p.y, camera, PX_POR_METRO);
        // Otimização: descarte fora da tela com folga
        if (pt.x < -30 || pt.x > LARGURA + 30 || pt.y < -30 || pt.y > ALTURA + 30) continue;

        const progressoVida = p.vida / p.vidaMax; // 1 -> 0
        const raio = p.raioBasePx * fatorEscala * (0.4 + 0.6 * progressoVida);
        const alpha = p.alpha * progressoVida;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(1, raio), 0, Math.PI * 2);
        // Alterna entre luz e sombra sutil para dar volume à nuvem de neve
        ctx.fillStyle = i % 3 === 0 ? `rgba(191, 217, 238, ${alpha.toFixed(2)})` : `rgba(247, 251, 255, ${alpha.toFixed(2)})`;
        ctx.fill();
      }
    },

    desenharFlocosFundo(ctx, cameraXm, tempoTicks) {
      desenharFlocosProfundidadeFundo(ctx, cameraXm, tempoTicks);
    },

    desenharFlocosFrente(ctx, cameraXm, tempoTicks) {
      desenharFlocosProfundidadeFrente(ctx, cameraXm, tempoTicks);
    },

    limpar() {
      for (let i = 0; i < CAPACIDADE_SPRAY; i += 1) pool[i]!.ativo = false;
      indiceCabeca = 0;
    },
  };
}
