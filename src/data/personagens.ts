/**
 * Elenco final do M3 (`docs/elenco-m3.md` §4, aprovado pelo dono): 6 `DefPersonagem` com o orçamento fixo de
 * atributos (soma 500, inteiros 90..110). A Capi é a REFERÊNCIA (`descida/atributos.ts` → `PERSONAGEM_REFERENCIA`):
 * `configDoPersonagem('capi')` devolve `CONFIG_PADRAO` bit a bit (plano M3 §A.1) — por isso este catálogo não
 * carrega física nenhuma, só a ficha.
 *
 * `casa`/`desbloqueio` seguem o plano M3 §B.5: a Capi nasce liberada (`inicial`); os outros 5 liberam ao concluir
 * a própria pista-casa uma vez (Beto e Quequé compartilham o Cume — plano §3 do elenco: "o mais despreparado no
 * lugar mais frio é a piada da pista final").
 */
import type { Atributo, DefPersonagem } from '../core/contratos';
import { ATRIBUTOS } from '../core/contratos';
import { ErroDeContrato } from '../core/erros';
import { REGRAS_SAVE } from './regras-save';

export const CAPI: DefPersonagem = {
  id: 'capi',
  nome: 'Capi Barbosa',
  bordao: 'Bah, que lomba!',
  nomeAssinatura: 'Roda de Chimarrão',
  atributos: { velocidade: 100, aceleracao: 100, giro: 90, equilibrio: 110, pulo: 100 },
  casa: 'morro-do-pinhao',
  desbloqueio: { tipo: 'inicial' },
};

export const BANDEIRA: DefPersonagem = {
  id: 'bandeira',
  nome: 'Professora Bandeira',
  bordao: 'Pelas minhas contas… vai dar bom!',
  nomeAssinatura: 'Cauda-Vela',
  atributos: { velocidade: 100, aceleracao: 90, giro: 95, equilibrio: 105, pulo: 110 },
  casa: 'vulcao-pe-gelado',
  desbloqueio: { tipo: 'concluir', pista: 'vulcao-pe-gelado' },
};

export const CIDINHA: DefPersonagem = {
  id: 'cidinha',
  nome: 'Vó Cidinha',
  bordao: 'Sai da frente, netinho!',
  nomeAssinatura: 'Novelo Supersônico',
  atributos: { velocidade: 95, aceleracao: 105, giro: 110, equilibrio: 100, pulo: 90 },
  casa: 'vila-chocolate',
  desbloqueio: { tipo: 'concluir', pista: 'vila-chocolate' },
};

export const BETO: DefPersonagem = {
  id: 'beto',
  nome: 'Tio Beto',
  bordao: 'Frio? Isso aí é ar-condicionado!',
  nomeAssinatura: 'Espreguiçadeira',
  atributos: { velocidade: 110, aceleracao: 95, giro: 100, equilibrio: 90, pulo: 105 },
  casa: 'cume-da-ventania',
  desbloqueio: { tipo: 'concluir', pista: 'cume-da-ventania' },
};

export const QUEQUE: DefPersonagem = {
  id: 'queque',
  nome: 'Quequé',
  bordao: 'Quero! Quero! Quero ganhar!',
  nomeAssinatura: 'Voo Rasante',
  atributos: { velocidade: 90, aceleracao: 110, giro: 100, equilibrio: 100, pulo: 100 },
  casa: 'cume-da-ventania',
  desbloqueio: { tipo: 'concluir', pista: 'cume-da-ventania' },
};

export const BIA: DefPersonagem = {
  id: 'bia',
  nome: 'Bia Pipoca',
  bordao: 'Tá gravando? Então olha essa!',
  nomeAssinatura: 'Estouro de Pipoca',
  atributos: { velocidade: 95, aceleracao: 100, giro: 105, equilibrio: 95, pulo: 105 },
  casa: 'pico-do-picole',
  desbloqueio: { tipo: 'concluir', pista: 'pico-do-picole' },
};

export const PERSONAGENS_DE_DADOS: readonly DefPersonagem[] = [CAPI, BANDEIRA, CIDINHA, BETO, QUEQUE, BIA];

function problemasDeDefPersonagem(def: DefPersonagem, idsDePistas: readonly string[]): string[] {
  const p: string[] = [];
  let soma = 0;
  for (const atributo of ATRIBUTOS) {
    const v = def.atributos[atributo];
    if (!Number.isInteger(v) || v < 90 || v > 110) p.push(`personagem "${def.id}": atributo "${atributo}" = ${v} fora de 90..110`);
    soma += v;
  }
  if (soma !== 500) p.push(`personagem "${def.id}": soma dos atributos = ${soma}, esperado 500`);
  if (!idsDePistas.includes(def.casa)) p.push(`personagem "${def.id}": casa "${def.casa}" não existe em REGRAS_SAVE.pistas`);
  if (def.desbloqueio.tipo === 'concluir' && !idsDePistas.includes(def.desbloqueio.pista)) {
    p.push(`personagem "${def.id}": desbloqueio.pista "${def.desbloqueio.pista}" não existe em REGRAS_SAVE.pistas`);
  }
  return p;
}

/**
 * Validação de FORMA (não gera física: isso é `descida.configDoPersonagem`, que cruzaria a camada — `data/` só
 * importa `core/`). Lista o que está errado (vazia = tudo certo); pura, não lança.
 */
export function problemasDosPersonagensDeDados(
  defs: readonly DefPersonagem[] = PERSONAGENS_DE_DADOS,
  regras: { readonly personagens: readonly string[]; readonly pistas: readonly string[] } = REGRAS_SAVE,
): string[] {
  const p: string[] = [];
  const idsDosDefs = defs.map((d) => d.id);
  for (const id of idsDosDefs) if (!regras.personagens.includes(id)) p.push(`personagem "${id}": não está em REGRAS_SAVE.personagens`);
  for (const id of regras.personagens) if (!idsDosDefs.includes(id)) p.push(`REGRAS_SAVE.personagens: "${id}" sem DefPersonagem correspondente`);
  const quantosCapi = idsDosDefs.filter((id) => id === 'capi').length;
  if (quantosCapi !== 1) p.push(`elenco: "capi" (a referência) precisa existir exatamente uma vez, achei ${quantosCapi}`);
  for (const def of defs) p.push(...problemasDeDefPersonagem(def, regras.pistas));
  return p;
}

/** Lança `ErroDeContrato` se o elenco estiver errado (boot com tela de erro clara, nunca um catálogo meio quebrado). */
export function exigirPersonagensDeDadosValidos(
  defs: readonly DefPersonagem[] = PERSONAGENS_DE_DADOS,
  regras: { readonly personagens: readonly string[]; readonly pistas: readonly string[] } = REGRAS_SAVE,
): void {
  const problemas = problemasDosPersonagensDeDados(defs, regras);
  if (problemas.length > 0) throw new ErroDeContrato('contrato-invalido', 'DefPersonagem de data/ inválido', problemas);
}

/**
 * Regra de DESENHO (plano M3 §A.3: "cada atributo tem um único dono do 110" — não derruba o boot, é um teste
 * unitário que mantém o elenco honesto). Pura: devolve o `Atributo` que tem mais de um dono do 110, ou `[]`.
 */
export function atributosComMaisDeUmDonoDe110(defs: readonly DefPersonagem[] = PERSONAGENS_DE_DADOS): readonly Atributo[] {
  return ATRIBUTOS.filter((atributo) => defs.filter((d) => d.atributos[atributo] === 110).length > 1);
}

exigirPersonagensDeDadosValidos();
