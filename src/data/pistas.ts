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

export const PISTAS_DE_DADOS: readonly DefPista[] = [PISTA_MORRO_DO_PINHAO];

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
