/**
 * Pista inicial `morro-do-pinhao` (C5 `DefPista`), para o M1a. O id já existe em `regras-save.ts` (PISTAS_INICIAIS);
 * tema, nome e objetos de ambientação vêm de `docs/direcao-arte-neve-maluca.md` §2.2 (bosque, araucárias, celeiro).
 *
 * EXCEÇÃO DE DONO temporária (Atlas, M1a): este arquivo é de `data/` (dono normal: Cronos), mas o Vega o escreveu
 * agora para destravar o motor e o gerador em paralelo com a Lyra, sem esperar o `DefPista` completo do Cronos no M1
 * "de verdade". `data/` só importa `core/` (plano §3.1): por isso este arquivo NÃO importa `pista/` para conferir o
 * próprio `hashEsperado` no import (violaria a camada) — quem faz isso é `pista.exigirPistasValidas(PISTAS_DE_DADOS)`,
 * chamado por quem junta `data/` e `pista/` (hoje nenhum: ver PENDÊNCIAS do handoff). Cronos deve revisar/substituir
 * este arquivo quando modelar `DefPista` de verdade (nome de exibição, objetivos com texto, etc.).
 */
import { FORMA_ID } from '../core/constantes';
import type { DefPista } from '../core/contratos';
import { ErroDeContrato } from '../core/erros';
import { FORMATO_HASH } from '../core/hash';

export const PISTA_MORRO_DO_PINHAO: DefPista = {
  id: 'morro-do-pinhao',
  nome: 'Morro do Pinhão',
  tema: 'bosque',
  semente: 20261022,
  comprimentoM: 900,
  dificuldade: [0, 0.4],
  trechos: {
    reta: 5,
    ondulado: 3,
    boneco: 2,
    pedras: 1.5,
    trilho: 1.5,
    rampa: 1,
    degrau: 0.3,
    vao: 0.2,
  },
  musica: 'vanerao-morro',
  objetivos: ['morro-do-pinhao-o1', 'morro-do-pinhao-o2', 'morro-do-pinhao-o3'],
  // Travado por `gerador.test.ts` e por `exigirPistaValida` (plano §3.4): mudar o catálogo/algoritmo do gerador
  // muda este hash; é proposital (invalida recordes antigos da pista, que vão para `recordesAntigos`, não somem).
  hashEsperado: '1c4d551601d3a6ae',
  // Campos de PROGRESSÃO (plano M3 §B.3), ignorados pelo gerador: não entram no hash acima.
  ordem: 1,
  desbloqueio: { tipo: 'inicial' },
};

/**
 * Pista 2 (M3 F3, plano §B.2): parque de manobras da Bia Pipoca. Trechos-assinatura de GEOMETRIA no FIM do
 * catálogo (`pista/catalogo.ts`): `kicker-duplo`, `palito-longo`, `vao-calda`, `carrinhos` — a pele (casquinha,
 * calda, palito) é da Lyra, por cima do mesmo `TipoObjeto`/feição que já existe (plano §B.3, "visual sem contrato
 * novo"). `hashEsperado` calculado por `ferramentas/harness/cli.mjs -- --pista pico-do-picole` depois de o catálogo
 * estar fechado (mesma trava de recordes que o Morro já tem).
 */
export const PISTA_PICO_DO_PICOLE: DefPista = {
  id: 'pico-do-picole',
  nome: 'Pico do Picolé',
  tema: 'parque',
  semente: 20261023,
  comprimentoM: 1000,
  dificuldade: [0.15, 0.55],
  trechos: {
    reta: 5,
    ondulado: 3,
    boneco: 2,
    pedras: 1.5,
    trilho: 1,
    rampa: 0.8,
    'kicker-duplo': 0.6,
    'palito-longo': 1.2,
    'vao-calda': 0.3,
    carrinhos: 0.4,
  },
  musica: 'pop-picole',
  objetivos: ['pico-do-picole-o1', 'pico-do-picole-o2', 'pico-do-picole-o3'],
  // Travado por `pista-gerador.test.ts` e por `exigirPistaValida`, igual ao Morro: mudar o catálogo/algoritmo do
  // gerador muda este hash de propósito (invalida recordes antigos, que vão para `recordesAntigos`, não somem).
  hashEsperado: '50f697e4c01623c4',
  // Campos de PROGRESSÃO (plano M3 §B.3), ignorados pelo gerador: não entram no hash acima.
  ordem: 2,
  desbloqueio: { tipo: 'objetivos', total: 2 },
};

/**
 * Pista 3 (M3 F3, plano §B.2): a vila colonial da Vó Cidinha, "os telhados viraram pista" (ficha
 * `docs/temas-pistas-m3.md` §2). Trechos-assinatura de GEOMETRIA no FIM do catálogo (`pista/catalogo.ts`):
 * `telhados`, `escadaria`, `varal`, `chamine` — a pele (telha colonial, enxaimel, varal de luzinhas) é da Lyra,
 * por cima do mesmo `TipoObjeto`/feição que já existe. `vao`/`degrau` originais ficam de fora dos pesos (trocados
 * pelos irmãos temáticos `telhados`/`escadaria`, mesmo padrão do Picolé). `hashEsperado` calculado por
 * `ferramentas/harness/cli.mjs -- --pista vila-chocolate` depois de o catálogo estar fechado.
 */
export const PISTA_VILA_CHOCOLATE: DefPista = {
  id: 'vila-chocolate',
  nome: 'Vila do Chocolate Quente',
  tema: 'vila',
  semente: 20261024,
  comprimentoM: 1100,
  dificuldade: [0.25, 0.65],
  trechos: {
    reta: 4.5,
    ondulado: 3,
    boneco: 1.5,
    chamine: 1.3,
    varal: 1.2,
    rampa: 0.8,
    telhados: 0.6,
    escadaria: 0.5,
  },
  musica: 'valsa-chocolate',
  objetivos: ['vila-chocolate-o1', 'vila-chocolate-o2', 'vila-chocolate-o3'],
  // Travado por `pista-gerador.test.ts` e por `exigirPistaValida`, igual ao Morro e ao Picolé: mudar o
  // catálogo/algoritmo do gerador muda este hash de propósito (invalida recordes antigos, que vão para
  // `recordesAntigos`, não somem).
  hashEsperado: 'f2677ef8e26391d8',
  // Campos de PROGRESSÃO (plano M3 §B.3), ignorados pelo gerador: não entram no hash acima.
  ordem: 3,
  desbloqueio: { tipo: 'objetivos', total: 4 },
};

/**
 * Pista 4 (M3 F3, plano §B.2): o vulcão de gelo e magma da Professora Bandeira (ficha `docs/temas-pistas-m3.md`
 * §3). Trechos-assinatura de GEOMETRIA no FIM do catálogo (`pista/catalogo.ts`): `geiser`, `ponte-basalto`,
 * `basalto`, `cratera` — a pele (crosta de gêiser, ponte de lajes, prisma de basalto, parede com rachadura de
 * magma) é da Lyra, por cima do mesmo `TipoObjeto`/feição que já existe. `vao`/`degrau`/`trilho`/`pedras`
 * originais ficam de fora dos pesos (trocados pelos irmãos temáticos, mesmo padrão do Picolé/Vila); `rampa` fica
 * (mesmo padrão da Vila: ela também é skinada como "crosta de gêiser" pela detecção de inclinação, §0.4 da
 * ficha). `hashEsperado` calculado por `ferramentas/harness/cli.mjs -- --pista vulcao-pe-gelado` depois de o
 * catálogo estar fechado.
 */
export const PISTA_VULCAO_PE_GELADO: DefPista = {
  id: 'vulcao-pe-gelado',
  nome: 'Vulcão Pé-Gelado',
  tema: 'vulcao',
  semente: 20261025,
  comprimentoM: 1100,
  dificuldade: [0.35, 0.8],
  trechos: {
    reta: 4,
    ondulado: 3,
    boneco: 1.2,
    basalto: 1.3,
    'ponte-basalto': 1.1,
    rampa: 0.7,
    geiser: 0.6,
    cratera: 0.4,
  },
  musica: 'milonga-vulcao',
  objetivos: ['vulcao-pe-gelado-o1', 'vulcao-pe-gelado-o2', 'vulcao-pe-gelado-o3'],
  // Travado por `pista-gerador.test.ts` e por `exigirPistaValida`, igual ao Morro/Picolé/Vila: mudar o
  // catálogo/algoritmo do gerador muda este hash de propósito (invalida recordes antigos, que vão para
  // `recordesAntigos`, não somem).
  hashEsperado: 'fa202a1f434bf5d2',
  // Campos de PROGRESSÃO (plano M3 §B.3), ignorados pelo gerador: não entram no hash acima.
  ordem: 4,
  desbloqueio: { tipo: 'objetivos', total: 6 },
};

/**
 * Pista 5 (M3 F3, plano §B.2), a ÚLTIMA: o cume de madrugada da ficha `docs/temas-pistas-m3.md` §4, casa do Quequé
 * e do Tio Beto. Trechos-assinatura de GEOMETRIA no FIM do catálogo (`pista/catalogo.ts`): `fenda-corda`,
 * `teleferico`, `cornija`, `reta-avalanche` — a pele (corda, cabo de teleférico, cornija enrolada, avalanche
 * cômica) é da Lyra, por cima do mesmo `TipoObjeto`/feição que já existe. `vao`/`degrau`/`trilho` originais ficam
 * de fora dos pesos (trocados pelos irmãos temáticos, mesmo padrão do Picolé/Vila/Vulcão); `pedras`/`boneco`/
 * `rampa` ficam (reskinados pela ficha, mesmo padrão de reúso do Vulcão com `rampa`). `hashEsperado` calculado por
 * `ferramentas/harness/cli.mjs -- --pista cume-da-ventania` depois de o catálogo estar fechado.
 */
export const PISTA_CUME_DA_VENTANIA: DefPista = {
  id: 'cume-da-ventania',
  nome: 'Cume da Ventania',
  tema: 'cume',
  semente: 20261026,
  comprimentoM: 1200,
  dificuldade: [0.45, 0.9],
  trechos: {
    reta: 3.5,
    ondulado: 3,
    boneco: 1,
    pedras: 1.2,
    rampa: 0.6,
    'fenda-corda': 1.2,
    teleferico: 1,
    cornija: 0.9,
    'reta-avalanche': 0.8,
  },
  musica: 'chimarrita-cume',
  objetivos: ['cume-da-ventania-o1', 'cume-da-ventania-o2', 'cume-da-ventania-o3'],
  // Travado por `pista-gerador.test.ts` e por `exigirPistaValida`, igual às pistas anteriores: mudar o
  // catálogo/algoritmo do gerador muda este hash de propósito (invalida recordes antigos, que vão para
  // `recordesAntigos`, não somem).
  hashEsperado: '4a0c74b127222cd9',
  // Campos de PROGRESSÃO (plano M3 §B.3), ignorados pelo gerador: não entram no hash acima.
  ordem: 5,
  desbloqueio: { tipo: 'objetivos', total: 8 },
};

export const PISTAS_DE_DADOS: readonly DefPista[] = [
  PISTA_MORRO_DO_PINHAO,
  PISTA_PICO_DO_PICOLE,
  PISTA_VILA_CHOCOLATE,
  PISTA_VULCAO_PE_GELADO,
  PISTA_CUME_DA_VENTANIA,
];

/** Busca um `DefPista` do catálogo por id (ex.: seleção de pista na cena de descida). `undefined` se não existir. */
export function obterPistaDeDados(id: string, defs: readonly DefPista[] = PISTAS_DE_DADOS): DefPista | undefined {
  return defs.find((d) => d.id === id);
}

function problemasDeDefPista(def: DefPista): string[] {
  const p: string[] = [];
  if (!FORMA_ID.test(def.id)) p.push(`pista.id "${def.id}" fora da forma de id`);
  if (!Number.isInteger(def.semente) || def.semente < 0 || def.semente > 0xffffffff) p.push(`pista "${def.id}": semente fora de uint32`);
  if (!(def.comprimentoM > 0)) p.push(`pista "${def.id}": comprimentoM precisa ser > 0`);
  const [ini, fim] = def.dificuldade;
  if (!(ini >= 0 && ini <= 1 && fim >= 0 && fim <= 1 && fim >= ini)) p.push(`pista "${def.id}": dificuldade [${ini}, ${fim}] inválida`);
  if (Object.values(def.trechos).every((v) => !(v !== undefined && v > 0))) p.push(`pista "${def.id}": nenhum trecho com peso > 0`);
  if (!FORMATO_HASH.test(def.hashEsperado)) p.push(`pista "${def.id}": hashEsperado mal formado`);
  return p;
}

/** Validação de FORMA dos `DefPista` daqui (não gera a pista: isso é `pista.exigirPistasValidas`, que cruzaria a camada). */
export function exigirPistasDeDadosValidas(defs: readonly DefPista[] = PISTAS_DE_DADOS): void {
  const problemas = defs.flatMap(problemasDeDefPista);
  if (problemas.length > 0) throw new ErroDeContrato('contrato-invalido', 'DefPista de data/ inválido', problemas);
}

exigirPistasDeDadosValidas();
