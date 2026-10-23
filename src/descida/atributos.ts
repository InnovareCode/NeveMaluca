/**
 * Física por personagem (plano M3 §A): converte o `DefPersonagem.atributos` (orçamento fixo, `data/personagens.ts`)
 * num `ConfigDescida` RELATIVO à Capi (opção A1 do plano, a única recomendada):
 *
 *   campo = base × (1 + sentido × ganho × (atrib − atribCapi) / 100)
 *
 * Com `atrib === atribCapi` (a própria Capi, ou qualquer personagem empatado com ela num atributo), o fator é
 * exatamente `1`: multiplicar por `1` não perde nenhum bit em IEEE 754, então `configDoPersonagem('capi')` devolve
 * `CONFIG_PADRAO` campo a campo, sem precisar de um caso especial — é a conta, não uma coincidência. Puro, sem
 * `Math.pow`/`**` (proibidos em `descida/` pela varredura de arquitetura).
 *
 * `atribCapi` é o valor QUE A CAPI TEM naquele atributo, não a média 100 (ela não é 100 em tudo: giro 90,
 * equilíbrio 110 — plano §A.1, "atenção à escala"). Por isso a referência entra pelo próprio catálogo, não por uma
 * constante separada.
 */
import type { Atributo, DefPersonagem, IdPersonagem } from '../core/contratos';
import { ATRIBUTOS } from '../core/contratos';
import { ErroDeContrato } from '../core/erros';
import { PERSONAGENS_DE_DADOS } from '../data/personagens';
import { CONFIG_PADRAO, type ConfigDescida } from './constantes';

/** Id do personagem cuja ficha de atributos devolve `CONFIG_PADRAO` sem desvio (plano §A.1). Nunca ajustado (§A.4). */
export const PERSONAGEM_REFERENCIA: IdPersonagem = 'capi';

/** Uma linha do mapa: qual campo do motor o atributo afeta, em que sentido, e com que força (plano §A.2). */
export interface RegraAtributo {
  readonly campo: keyof ConfigDescida;
  readonly sentido: 1 | -1;
  readonly ganho: number;
}

/**
 * Ganhos de partida (plano M3 §A.2; quem afina depois é a Íris com o harness de balanço, F2). `aceleracao` não
 * reusa `atrito`/`arrasto` (achado 1 do plano §0: o termo é imperceptível nessa escala) — ganha o campo próprio
 * `fatorEmbalo`, mais `velocidadeRespawnMs` (volta mais rápido de um tombo). Campos fora deste mapa
 * (`gravidadeMs2`, `atrito`, `arrasto`, `atrasoGiroTicks`...) são regras do mundo e NUNCA variam por personagem.
 */
export const MAPA_ATRIBUTOS: Readonly<Record<Atributo, readonly RegraAtributo[]>> = {
  velocidade: [{ campo: 'velocidadeMaxMs', sentido: 1, ganho: 0.6 }],
  aceleracao: [
    { campo: 'fatorEmbalo', sentido: 1, ganho: 0.8 },
    { campo: 'velocidadeRespawnMs', sentido: 1, ganho: 1.5 },
  ],
  giro: [
    { campo: 'giroVelMaxGrausPorTick', sentido: 1, ganho: 1.0 },
    { campo: 'giroAcelGrausPorTick2', sentido: 1, ganho: 1.0 },
  ],
  equilibrio: [
    { campo: 'limiarPerfeitoGraus', sentido: 1, ganho: 1.0 },
    { campo: 'limiarBomGraus', sentido: 1, ganho: 1.0 },
    { campo: 'limiarTortoGraus', sentido: 1, ganho: 1.0 },
  ],
  pulo: [{ campo: 'impulsoPuloMs', sentido: 1, ganho: 1.0 }],
};

/**
 * A conta pura da opção A1, já com `def`/`ref` resolvidos (testável sem catálogo nem `CONFIG_PADRAO` de verdade).
 * `mapa`/`base` são injetáveis só para o teste conseguir provar a fórmula isolada; em produção usam os padrões.
 */
export function aplicarAtributos(
  def: DefPersonagem,
  ref: DefPersonagem,
  mapa: Readonly<Record<Atributo, readonly RegraAtributo[]>> = MAPA_ATRIBUTOS,
  base: ConfigDescida = CONFIG_PADRAO,
): ConfigDescida {
  let config: ConfigDescida = base;
  for (const atributo of ATRIBUTOS) {
    const diferenca = def.atributos[atributo] - ref.atributos[atributo];
    for (const regra of mapa[atributo]) {
      const fator = 1 + regra.sentido * regra.ganho * diferenca / 100;
      config = { ...config, [regra.campo]: config[regra.campo] * fator };
    }
  }
  return config;
}

/**
 * `ConfigDescida` do personagem `id` (plano §A.3). `catalogo` default é o elenco real (`data/personagens.ts`); id
 * desconhecido (save corrompido, versão velha do elenco) cai na física da própria referência em vez de travar a
 * descida — mesma filosofia de "nunca é motivo para travar o jogo" do fantasma (`descida/replay.ts`).
 */
export function configDoPersonagem(
  id: IdPersonagem,
  catalogo: readonly DefPersonagem[] = PERSONAGENS_DE_DADOS,
  mapa: Readonly<Record<Atributo, readonly RegraAtributo[]>> = MAPA_ATRIBUTOS,
  base: ConfigDescida = CONFIG_PADRAO,
): ConfigDescida {
  const ref = catalogo.find((d) => d.id === PERSONAGEM_REFERENCIA);
  if (!ref) throw new ErroDeContrato('contrato-invalido', `configDoPersonagem: referência "${PERSONAGEM_REFERENCIA}" não está no catálogo`);
  const def = catalogo.find((d) => d.id === id) ?? ref;
  return aplicarAtributos(def, ref, mapa, base);
}
