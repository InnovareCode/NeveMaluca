/**
 * Bot "cuidadoso" (plano §3.4: harness de pista). Reflexo puro sobre `LeituraDescida` + `PistaGerada`: olha um pouco
 * à frente, pula diante de rampa/obstáculo, e nivela o corpo no ar (giro contra o próprio ângulo) para pousar dentro
 * da janela. Nunca segura grab nem agacha (menos risco). Determinístico: sem RNG, mesma leitura => mesmo comando.
 */
import type { ComandoDescida, Giro, LeituraDescida, PistaGerada } from '../core/contratos';
import { inclinacaoGrausEm, obstaculoDuroNaFaixa } from '../pista/consulta';

export interface OpcoesBotCuidadoso {
  /** Quantos metros adiante o bot olha para decidir se pula. */
  readonly antecipacaoM?: number;
  /** Inclinação (graus) a partir da qual uma subida adiante é tratada como rampa/kicker a saltar. */
  readonly limiarRampaGraus?: number;
  /** Ângulo do corpo (graus) acima do qual o bot gira no ar para nivelar antes do pouso. */
  readonly limiarNivelarGraus?: number;
  /**
   * Velocidade mínima (m/s) para o bot pular só porque viu uma subida adiante (não vale para obstáculo: esse pulo é
   * sempre obrigatório). Pular quase parado ganha pouca altura/distância e costuma pousar mal, numa subida, com
   * ainda menos velocidade — risco de ficar "preso" (sem força líquida pra sair do lugar). Esperar um pouco de
   * embalo antes de arriscar o salto de rampa evita essa armadilha.
   */
  readonly velocidadeMinParaPularDeRampaMs?: number;
}

const PADRAO: Required<OpcoesBotCuidadoso> = { antecipacaoM: 4, limiarRampaGraus: 8, limiarNivelarGraus: 6, velocidadeMinParaPularDeRampaMs: 3 };

/** Cria a função de decisão do bot para UMA pista. Chamar a cada tick com a `LeituraDescida` mais recente. */
export function criarBotCuidadoso(pista: PistaGerada, opcoes: OpcoesBotCuidadoso = {}): (leitura: LeituraDescida) => ComandoDescida {
  const cfg = { ...PADRAO, ...opcoes };
  // Nivelar é uma decisão TOMADA UMA VEZ por voo, não recalculada a cada tick: girar segurado tem `atrasoGiroTicks`
  // de delay (plano §3.3, "um toque rápido é só um pulo") ANTES de a velocidade angular começar a mudar de verdade.
  // Reavaliar o sinal do giro a cada tick faz o bot alternar de direção enquanto a velocidade angular antiga ainda
  // está "a caminho" de zerar, e o corpo passa a girar mais ainda na direção ERRADA durante esse atraso — oscilação
  // que pode crescer sem parar numa queda longa. Decidir uma vez (e desistir ao cruzar o zero) corrige sem oscilar.
  let giroDecidido: Giro = 0;
  let anguloAoDecidir = 0;
  let noArAnterior = false;
  return (leitura: LeituraDescida): ComandoDescida => {
    const { piloto } = leitura;
    let pulo = false;
    if (piloto.modo === 'chao' || piloto.modo === 'trilho') {
      const inclinacaoAdiante = inclinacaoGrausEm(pista, piloto.x + cfg.antecipacaoM);
      const obstaculoAdiante = obstaculoDuroNaFaixa(pista, piloto.x, piloto.x + cfg.antecipacaoM);
      const rampaAdiante = inclinacaoAdiante > cfg.limiarRampaGraus && piloto.velocidade >= cfg.velocidadeMinParaPularDeRampaMs;
      pulo = rampaAdiante || obstaculoAdiante;
    }

    const noAr = piloto.modo === 'ar';
    if (!noAr) giroDecidido = 0;
    else if (!noArAnterior) {
      // Acabou de decolar nesta leitura: decide a direção UMA vez, se valer a pena corrigir.
      giroDecidido = piloto.angulo > cfg.limiarNivelarGraus ? -1 : piloto.angulo < -cfg.limiarNivelarGraus ? 1 : 0;
      anguloAoDecidir = piloto.angulo;
    } else if (giroDecidido !== 0) {
      // Já cruzou o nível (zero) ou passou para o lado oposto de onde começou: para de corrigir (evita ultrapassar).
      const cruzouOuNivelou = anguloAoDecidir >= 0 ? piloto.angulo <= 0 : piloto.angulo >= 0;
      if (cruzouOuNivelou) giroDecidido = 0;
    }
    noArAnterior = noAr;

    return { pulo, giro: giroDecidido, grab: null, agachar: false };
  };
}
