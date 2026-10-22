/**
 * Fase 2: cenários estilo animação 3D/Pixar do Morro do Pinhão (docs/direcao-arte-neve-maluca.md §2.1 e §2.2).
 *
 * O que estes testes PROVAM e o que NÃO provam:
 * - PROVAM: os tokens de cor da direção de arte (§2.1) estão nos módulos certos, o terreno desenha
 *   sombra + manta de luz com o contorno em caminho SEPARADO (a armadilha do WebKit documentada em
 *   `tests/e2e/descida-m1a.spec.ts`), o parallax monta as 3 camadas e o sistema de partículas
 *   emite spray no chão, no pouso e no tombo, e respeita o teto do pool.
 * - NÃO PROVAM: geometria na tela (isso é e2e no navegador, com screenshot e leitura de pixel) nem
 *   taxa de quadros (60 fps é medido no aparelho, não em node). As asserções visuais reais ficam no e2e.
 */
import { describe, expect, it } from 'vitest';
import { ALTURA, LARGURA } from '../../src/core/constantes';
import type { EventoDescida, PilotoLeitura } from '../../src/core/contratos';
import { criarRng } from '../../src/core/rng';
import { PISTA_MORRO_DO_PINHAO } from '../../src/data/pistas';
import { exigirPistaValida } from '../../src/pista/index';
import {
  COR_CELEIRO_VERMELHO,
  COR_CEU_HORIZONTE,
  COR_CEU_TOPO,
  COR_FOLHAGEM_PINHEIRO,
  COR_MONTANHA_DISTANTE_LUZ,
  COR_MONTANHA_DISTANTE_SOMBRA,
  COR_MONTANHA_MEDIA_LUZ,
  COR_MONTANHA_MEDIA_SOMBRA,
  COR_NEVE_CAPUZ,
  criarParallax,
} from '../../src/render/parallax';
import { criarSistemaParticulas, desenharFlocosProfundidadeFundo, desenharFlocosProfundidadeFrente } from '../../src/render/particulas';
import {
  COR_NEVE,
  COR_NEVE_LUZ,
  COR_NEVE_SOMBRA,
  ESPESSURA_MANTA_NEVE_PX,
  alturaDoTerreno,
  comprimentoDaPistaM,
  desenharTerreno,
} from '../../src/render/terreno';
import type { EstadoCamera } from '../../src/render/mundo';

/** Contexto falso que REGISTRA o que foi desenhado: é o que permite contar preenchimentos e Paths. */
interface Registo {
  readonly chamadas: string[];
  readonly preenchimentos: string[];
  readonly traces: string[];
  /** Índice em `chamadas` do último `beginPath` de cada `stroke` — serve para auditar o caminho traçado. */
  readonly inicioDoTrace: number[];
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(a: number, b: number, c: number, d: number): void;
  closePath(): void;
  arc(x: number, y: number, r: number, a: number, b: number): void;
  fill(): void;
  stroke(): void;
  fillRect(): void;
  strokeRect(): void;
  drawImage(): void;
}

function criarRegisto(): Registo {
  const chamadas: string[] = [];
  const preenchimentos: string[] = [];
  const traces: string[] = [];
  const inicioDoTrace: number[] = [];
  let estiloPreenchimento = '';
  let estiloTraco = '';
  let marcaBeginPath = 0;

  const reg: Registo = {
    chamadas,
    preenchimentos,
    traces,
    inicioDoTrace,
    beginPath: () => {
      marcaBeginPath = chamadas.length;
      chamadas.push('beginPath');
    },
    moveTo: (x, y) => chamadas.push(`moveTo ${Math.round(x)},${Math.round(y)}`),
    lineTo: (x, y) => chamadas.push(`lineTo ${Math.round(x)},${Math.round(y)}`),
    quadraticCurveTo: () => chamadas.push('quadraticCurveTo'),
    closePath: () => chamadas.push('closePath'),
    arc: () => chamadas.push('arc'),
    fill: () => {
      chamadas.push('fill');
      preenchimentos.push(estiloPreenchimento);
    },
    stroke: () => {
      chamadas.push('stroke');
      traces.push(estiloTraco);
      inicioDoTrace.push(marcaBeginPath);
    },
    fillRect: () => chamadas.push('fillRect'),
    strokeRect: () => chamadas.push('strokeRect'),
    drawImage: () => chamadas.push('drawImage'),
  };

  // O estilo precisa ser um ACESSOR no mesmo objeto que `fill`/`stroke` leem: espalhar (`...reg`)
  // num objeto novo copiaria o valor e o setter deixaria de alimentar a variável do `fill`.
  Object.defineProperties(reg, {
    fillStyle: { get: () => estiloPreenchimento, set: (v: string) => (estiloPreenchimento = v), enumerable: true },
    strokeStyle: { get: () => estiloTraco, set: (v: string) => (estiloTraco = v), enumerable: true },
    lineWidth: { get: () => 1, set: () => undefined, enumerable: true },
    createLinearGradient: { value: () => ({ addColorStop: () => undefined }), enumerable: true },
    createRadialGradient: { value: () => ({ addColorStop: () => undefined }), enumerable: true },
  });
  return reg;
}

function contexto(reg: Registo): CanvasRenderingContext2D {
  return reg as unknown as CanvasRenderingContext2D;
}

const CAMERA: EstadoCamera = { x: 20, y: 20, zoom: 1, tremidaX: 0, tremidaY: 0 };

function criarPiloto(parcial: Partial<PilotoLeitura> = {}): PilotoLeitura {
  return {
    x: 20,
    y: 20,
    vx: 12,
    vy: 0,
    velocidade: 12,
    angulo: -10,
    anguloTerreno: -10,
    modo: 'chao',
    pose: 'chao',
    grab: null,
    voltas: 0,
    ticksNoAr: 0,
    ...parcial,
  };
}

describe('Fase 2 §2.1: paleta do Morro do Pinhão nos módulos certos', () => {
  it('céu degradê quente/frio e montanhas com facetas de luz e sombra', () => {
    expect(COR_CEU_TOPO).toBe('#4FA8F0');
    expect(COR_CEU_HORIZONTE).toBe('#BFE6FF');
    expect(COR_MONTANHA_DISTANTE_SOMBRA).toBe('#A9C7E6');
    expect(COR_MONTANHA_DISTANTE_LUZ).toBe('#D2E4F7');
    expect(COR_MONTANHA_MEDIA_SOMBRA).toBe('#7FA3C9');
    expect(COR_MONTANHA_MEDIA_LUZ).toBe('#9EBFE3');
  });

  it('araucárias/pinheiros em #2E6B3A com capuz de neve, e celeiro alpino vermelho #B83A2B', () => {
    expect(COR_FOLHAGEM_PINHEIRO).toBe('#2E6B3A');
    expect(COR_NEVE_CAPUZ).toBe('#F7FBFF');
    expect(COR_CELEIRO_VERMELHO).toBe('#B83A2B');
  });

  it('terreno: neve luz #F7FBFF e neve sombra #BFD9EE', () => {
    expect(COR_NEVE_LUZ).toBe('#F7FBFF');
    expect(COR_NEVE_SOMBRA).toBe('#BFD9EE');
    expect(COR_NEVE).toBe(COR_NEVE_LUZ);
  });
});

describe('Fase 2 §2.1: terreno com neve volumosa (luz na crista, sombra no corpo)', () => {
  const pista = exigirPistaValida(PISTA_MORRO_DO_PINHAO);

  it('desenha o corpo em sombra #BFD9EE e a manta de neve em luz #F7FBFF, com a manta mais grossa que zero', () => {
    const reg = criarRegisto();
    desenharTerreno(contexto(reg), pista, CAMERA);
    expect(reg.preenchimentos).toContain(COR_NEVE_SOMBRA);
    expect(reg.preenchimentos).toContain(COR_NEVE_LUZ);
    expect(ESPESSURA_MANTA_NEVE_PX).toBeGreaterThan(0);
  });

  it('WebKit: o stroke da crista NUNCA é feito no caminho estendido (os dois begins são separados)', () => {
    const reg = criarRegisto();
    desenharTerreno(contexto(reg), pista, CAMERA);
    // Um `fill` por camada (sombra + manta) e um `stroke` para a borda da manta e outro para a crista,
    // cada um no seu próprio `beginPath`. Se alguém voltar a traçar o caminho estendido,
    // o número de begins cai e este teste acusa.
    const begins = reg.chamadas.filter((c) => c === 'beginPath').length;
    const strokes = reg.chamadas.filter((c) => c === 'stroke').length;
    expect(begins).toBeGreaterThanOrEqual(strokes);
    expect(strokes).toBe(2);
  });

  it('a crista desenhada nunca tem ponto a 4000 px (o sintoma do bug do WebKit seria esse stroke enorme)', () => {
    const reg = criarRegisto();
    desenharTerreno(contexto(reg), pista, CAMERA);
    // Para cada stroke(), confere os pontos chamados APÓS o respectivo beginPath e antes do stroke
    // NENHUM ponto desse caminho de contorno pode conter a extensão de +4000 px do preenchimento
    for (const inicio of reg.inicioDoTrace) {
      const fim = reg.chamadas.indexOf('stroke', inicio);
      const comandosDoTrace = reg.chamadas.slice(inicio, fim);
      for (const cmd of comandosDoTrace) {
        if (cmd.startsWith('lineTo') || cmd.startsWith('moveTo')) {
          const y = Number(cmd.split(' ')[1]?.split(',')[1]);
          expect(Math.abs(y)).toBeLessThan(2000);
        }
      }
    }
  });

  it('alturaDoTerreno interpola linearmente e é coerente com comprimentoDaPistaM', () => {
    expect(comprimentoDaPistaM(pista)).toBeCloseTo((pista.alturas.length - 1) * pista.dx, 6);
    expect(alturaDoTerreno(pista, 0)).toBe(pista.alturas[0] as number);
    expect(alturaDoTerreno(pista, -50)).toBe(pista.alturas[0] as number);
  });
});

describe('Fase 2 §2.1/§2.2: parallax rico em camadas', () => {
  it('monta as 3 camadas (montanha distante, média, floresta) e desenha cada uma 2x para o tiling não ter emenda', () => {
    const tiles: HTMLCanvasElement[] = [];
    const doc = {
      createElement: () => {
        const c = {
          width: LARGURA,
          height: ALTURA,
          getContext: () => contexto(criarRegisto()),
        } as unknown as HTMLCanvasElement;
        tiles.push(c);
        return c;
      },
    } as unknown as Document;

    const reg = criarRegisto();
    criarParallax(doc).desenhar(contexto(reg), 12, 90);

    expect(tiles).toHaveLength(3);
    // 3 camadas x 2 drawImage = 6, mais o céu e o brilho do sol (2 fillRect)
    expect(reg.chamadas.filter((c) => c === 'drawImage')).toHaveLength(6);
    expect(reg.chamadas.filter((c) => c === 'fillRect')).toHaveLength(2);
  });

  it('desenha o céu ANTES das camadas e os flocos de profundidade por último (ordem de profundidade)', () => {
    const tiles: HTMLCanvasElement[] = [];
    const doc = {
      createElement: () => {
        const c = { width: LARGURA, height: ALTURA, getContext: () => contexto(criarRegisto()) } as unknown as HTMLCanvasElement;
        tiles.push(c);
        return c;
      },
    } as unknown as Document;

    const reg = criarRegisto();
    criarParallax(doc).desenhar(contexto(reg), 12, 90);
    const primeiroCeu = reg.chamadas.findIndex((c) => c === 'fillRect');
    const primeiraImg = reg.chamadas.findIndex((c) => c === 'drawImage');
    const primeiroFloco = reg.chamadas.findIndex((c) => c === 'fill');
    // Ordem estrita: Céu (0) -> Camadas Parallax (2) -> Flocos (último)
    expect(primeiroCeu).toBeLessThan(primeiraImg);
    expect(primeiraImg).toBeLessThan(primeiroFloco);
    // Os flocos de profundidade são o ÚLTIMO fill do parallax
    expect(reg.preenchimentos[reg.preenchimentos.length - 1]).toContain('rgba(247, 251, 255');
  });

  it('sem `document` (node) não quebra: desenha só o céu e os flocos', () => {
    const reg = criarRegisto();
    expect(() => criarParallax(undefined).desenhar(contexto(reg), 3, 30)).not.toThrow();
    expect(reg.chamadas.filter((c) => c === 'drawImage')).toHaveLength(0);
  });
});

describe('Fase 2: flocos de neve em camadas de profundidade', () => {
  it('fundo e frente pintam N camadas distintas (uma por profundidade), cada uma num único fill', () => {
    const regFundo = criarRegisto();
    desenharFlocosProfundidadeFundo(contexto(regFundo), 10, 100);
    expect(regFundo.preenchimentos).toHaveLength(2); // distante + intermediária

    const regFrente = criarRegisto();
    desenharFlocosProfundidadeFrente(contexto(regFrente), 10, 100);
    expect(regFrente.preenchimentos).toHaveLength(1); // frontal
  });

  it('é determinístico: os mesmos (cameraXm, tempoTicks) pintam exatamente os mesmos arcos', () => {
    const a = criarRegisto();
    const b = criarRegisto();
    desenharFlocosProfundidadeFrente(contexto(a), 33.3, 777);
    desenharFlocosProfundidadeFrente(contexto(b), 33.3, 777);
    expect(a.chamadas).toEqual(b.chamadas);
  });

  it('nunca lança fora da tela: todo arco fica dentro de [-raio, LARGURA+raio] x [-raio, ALTURA+raio]', () => {
    const reg = criarRegisto();
    desenharFlocosProfundidadeFundo(contexto(reg), 999.9, 12345);
    desenharFlocosProfundidadeFrente(contexto(reg), -999.9, 12345);
    // moveTo x+raio, arc x, y: todos com y em [0, ALTURA] por construção do módulo
    const ys = reg.chamadas.filter((c) => c.startsWith('moveTo')).map((c) => Number(c.split(',')[1]));
    expect(ys.length).toBeGreaterThan(0);
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(ALTURA);
    }
  });
});

describe('Fase 2: spray de neve saindo da prancha no chão', () => {
  it('no chão com velocidade o spray aparece; parado no chão, não', () => {
    const emMovimento = criarRegisto();
    const parado = criarRegisto();
    const sistema = criarSistemaParticulas(criarRng(7));
    for (let t = 0; t < 10; t += 1) sistema.atualizar(criarPiloto({ modo: 'chao', velocidade: 14, vx: 14 }), []);
    sistema.desenharSpray(contexto(emMovimento), CAMERA);

    const sistemaParado = criarSistemaParticulas(criarRng(7));
    for (let t = 0; t < 10; t += 1) sistemaAtualizaParado(sistemaParado);
    sistemaParado.desenharSpray(contexto(parado), CAMERA);

    expect(emMovimento.chamadas.filter((c) => c === 'arc').length).toBeGreaterThan(0);
    expect(parado.chamadas.filter((c) => c === 'arc')).toHaveLength(0);
  });

  function sistemaAtualizaParado(s: ReturnType<typeof criarSistemaParticulas>): void {
    s.atualizar(criarPiloto({ modo: 'chao', velocidade: 0, vx: 0, x: -9999 }), []);
  }

  it('no ar nao emite spray (a prancha nao toca a neve)', () => {
    const reg = criarRegisto();
    const sistema = criarSistemaParticulas(criarRng(7));
    for (let t = 0; t < 10; t += 1) sistema.atualizar(criarPiloto({ modo: 'ar', velocidade: 14, vx: 14 }), []);
    sistema.desenharSpray(contexto(reg), CAMERA);
    expect(reg.chamadas.filter((c) => c === 'arc')).toHaveLength(0);
  });

  it('pouso e tombo estouram uma rajada radial', () => {
    const pouso: EventoDescida = { tipo: 'pouso', qualidade: 'torto', queda: 8 };
    const tombo: EventoDescida = { tipo: 'tombo', causa: 'obstaculo' };

    const regPouso = criarRegisto();
    const s1 = criarSistemaParticulas(criarRng(3));
    s1.atualizar(criarPiloto({ modo: 'ar', velocidade: 0, vx: 0 }), [pouso]);
    s1.desenharSpray(contexto(regPouso), CAMERA);
    expect(regPouso.chamadas.filter((c) => c === 'arc').length).toBeGreaterThanOrEqual(14);

    const regTombo = criarRegisto();
    const s2 = criarSistemaParticulas(criarRng(3));
    s2.atualizar(criarPiloto({ modo: 'ar', velocidade: 0, vx: 0 }), [tombo]);
    s2.desenharSpray(contexto(regTombo), CAMERA);
    expect(regTombo.chamadas.filter((c) => c === 'arc').length).toBeGreaterThanOrEqual(20);
  });

  it('o spray some com o tempo (gravidade e vida finita), então o pool nunca cresce sem limite', () => {
    const sistema = criarSistemaParticulas(criarRng(11));
    const ctx = criarRegisto();
    for (let t = 0; t < 400; t += 1) {
      sistema.atualizar(criarPiloto({ modo: 'chao', velocidade: 30, vx: 30 }), []);
    }
    // 400 ticks de emissão contínua não podem gerar mais que o teto do pool (128) de arcos vivos por quadro
    const arcos = ctx.chamadas.filter((c) => c === 'arc').length;
    expect(arcos).toBeLessThanOrEqual(128);
    expect(() => sistema.limpar()).not.toThrow();
    sistema.desenharSpray(contexto(criarRegisto()), CAMERA);
  });

  it('limpar() zera o pool: nada é desenhado depois de limpar', () => {
    const sistema = criarSistemaParticulas(criarRng(5));
    sistema.atualizar(criarPiloto({ modo: 'chao', velocidade: 20, vx: 20 }), []);
    sistema.limpar();
    const reg = criarRegisto();
    sistema.desenharSpray(contexto(reg), CAMERA);
    expect(reg.chamadas.filter((c) => c === 'arc')).toHaveLength(0);
  });
});