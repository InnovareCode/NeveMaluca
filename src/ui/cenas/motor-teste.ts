/**
 * Motor de descida de TESTE (ROTEIRIZADO/placeholder): recebe um `ComandoDescida` (C2) por tick e devolve uma
 * `LeituraDescida` (C3) plausível, só para a Lyra provar render/câmera/entrada no M1a enquanto a Vega constrói o
 * motor real (`src/descida/`) em paralelo. NÃO é física de produção: sem colisão de objetos, sem trilho, sem
 * combo/manobras de verdade, sem replay. SUBSTITUIR por `descida.criarMotor(...)` na integração (handoff, "PARA
 * O PRÓXIMO").
 *
 * Por estar em `ui/` (não em `core/pista/descida`), `Math.sin/atan2` são permitidos aqui (a regra de trig
 * tabelada do plano §3.3 só vale no núcleo determinístico do replay).
 */
import { PASSO_S } from '../../core/constantes';
import type { ComandoDescida, EventoDescida, FaseDescida, LeituraDescida, ModoPiloto, PistaGerada } from '../../core/contratos';
import { alturaDoTerreno } from '../../render/terreno';

const GRAVIDADE = 9.8 * 2.2; // acentuada de propósito para a "sensação de jogo" (ponto de partida, afinar com a Vega)
const ATRITO = 0.6;
const ARRASTO = 0.012;
const IMPULSO_PULO = 9;
const VELOCIDADE_INICIAL = 6;
const VEL_ANGULAR_GIRO_GRAUS_S = 420;
const ATRASO_GIRO_TICKS = 8; // mesmo ponto de partida do plano §3.3: "um toque rápido é só um pulo"
const TICKS_CONTAGEM = 60;
const TICKS_TOMBO = 90;
const JANELA_POUSO_PERFEITO_GRAUS = 20;
const JANELA_POUSO_BOM_GRAUS = 45;

export interface MotorTeste {
  tick(cmd: ComandoDescida): LeituraDescida;
}

function diferencaAngular(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  else if (d < -180) d += 360;
  return d;
}

export function criarMotorTeste(pista: PistaGerada): MotorTeste {
  let tick = 0;
  let fase: FaseDescida = 'contagem';
  let x = 0;
  let y = alturaDoTerreno(pista, 0);
  let vx = VELOCIDADE_INICIAL;
  let vy = 0;
  let modo: ModoPiloto = 'chao';
  let angulo = 0;
  let anguloAcumulado = 0;
  let ticksNoAr = 0;
  let pontos = 0;
  let ticksTombo = 0;

  const inclinacaoGraus = (xm: number): number => {
    const h0 = alturaDoTerreno(pista, xm - pista.dx);
    const h1 = alturaDoTerreno(pista, xm + pista.dx);
    return (Math.atan2(h1 - h0, 2 * pista.dx) * 180) / Math.PI;
  };

  const montarLeitura = (eventos: readonly EventoDescida[]): LeituraDescida => ({
    tick,
    fase,
    piloto: {
      x,
      y,
      vx,
      vy,
      velocidade: Math.hypot(vx, vy),
      angulo,
      anguloTerreno: inclinacaoGraus(x),
      modo,
      pose: modo, // placeholder: poses de verdade vêm de `data/manobras` (ainda não existe)
      grab: null,
      voltas: Math.trunc(Math.abs(anguloAcumulado) / 360),
      ticksNoAr,
    },
    combo: { ativo: false, manobras: [], soma: 0, mult: 1, janela: 0 }, // combos de verdade são do M2 (plano §7)
    pontos: Math.round(pontos),
    distancia: x,
    distanciaTotal: pista.chegadaX,
    coletados: 0,
    eventos,
  });

  return {
    tick(cmd: ComandoDescida): LeituraDescida {
      tick += 1;
      const eventos: EventoDescida[] = [];

      if (fase === 'contagem') {
        if (tick >= TICKS_CONTAGEM) fase = 'descendo';
        return montarLeitura(eventos);
      }
      if (fase === 'chegou') return montarLeitura(eventos);
      if (fase === 'tombo') {
        ticksTombo -= 1;
        if (ticksTombo <= 0) {
          fase = 'descendo';
          modo = 'chao';
          angulo = inclinacaoGraus(x);
        }
        return montarLeitura(eventos);
      }

      if (modo === 'chao') {
        const inclinacao = inclinacaoGraus(x);
        // `inclinacao` é NEGATIVA numa descida para a direita (h1 < h0 em `inclinacaoGraus`): o componente de
        // gravidade que ACELERA o piloto para a frente (+x) é `-GRAVIDADE * sin(inclinacao)` (sinal invertido:
        // bug real encontrado medindo no e2e — sem o `-`, vx ficava travado no piso de 1 m/s, nunca descia).
        const g = -GRAVIDADE * Math.sin((inclinacao * Math.PI) / 180);
        vx += (g - ATRITO * vx - ARRASTO * vx * vx) * PASSO_S;
        if (vx < 1) vx = 1;
        angulo = inclinacao;
        if (cmd.pulo) {
          vy = IMPULSO_PULO;
          modo = 'ar';
          ticksNoAr = 0;
          anguloAcumulado = 0;
          eventos.push({ tipo: 'pulo', forca: IMPULSO_PULO });
        }
      } else if (modo === 'ar') {
        vy -= GRAVIDADE * PASSO_S;
        ticksNoAr += 1;
        if (cmd.giro !== 0 && ticksNoAr > ATRASO_GIRO_TICKS) {
          const delta = cmd.giro * VEL_ANGULAR_GIRO_GRAUS_S * PASSO_S;
          angulo += delta;
          anguloAcumulado += delta;
        }
        const alturaTerreno = alturaDoTerreno(pista, x);
        if (y <= alturaTerreno) {
          const inclinacaoPouso = inclinacaoGraus(x);
          const diff = Math.abs(diferencaAngular(angulo, inclinacaoPouso));
          y = alturaTerreno;
          if (diff <= JANELA_POUSO_PERFEITO_GRAUS) {
            modo = 'chao';
            angulo = inclinacaoPouso;
            pontos += 10 + ticksNoAr;
            eventos.push({ tipo: 'pouso', qualidade: 'perfeito', queda: ticksNoAr });
          } else if (diff <= JANELA_POUSO_BOM_GRAUS) {
            modo = 'chao';
            angulo = inclinacaoPouso;
            vx *= 0.7;
            pontos += 5 + ticksNoAr * 0.5;
            eventos.push({ tipo: 'pouso', qualidade: 'bom', queda: ticksNoAr });
          } else {
            fase = 'tombo';
            modo = 'tombo';
            ticksTombo = TICKS_TOMBO;
            vx *= 0.4;
            eventos.push({ tipo: 'tombo', causa: 'angulo' });
          }
        }
      }

      x += vx * PASSO_S;
      y += vy * PASSO_S;
      if (modo === 'chao') y = alturaDoTerreno(pista, x);

      if (x >= pista.chegadaX) {
        fase = 'chegou';
        eventos.push({ tipo: 'chegada', pontos: Math.round(pontos), ticks: tick });
      }

      return montarLeitura(eventos);
    },
  };
}
