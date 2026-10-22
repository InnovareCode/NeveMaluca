/**
 * `PistaGerada` (C5) de TESTE, só para o M1a: a Vega está fazendo o gerador real (`src/pista/`, em paralelo) e
 * este arquivo existe para a Lyra desenvolver render/câmera/entrada sem esperar por ele. NÃO é o C5 de produção:
 * sem `hashEsperado` conferido, sem catálogo de trechos, sem respeitar as regras de vizinhança do plano §3.4.
 *
 * SUBSTITUIR por `pista.gerar(defPista)` de verdade na integração (ver handoff da Lyra, M1a: "PARA O PRÓXIMO").
 */
import { criarRng } from '../../core/rng';
import type { ObjetoPista, PistaGerada, TipoObjeto } from '../../core/contratos';

const DX_M = 0.5;
const SEMENTE_TESTE = 1234567;
const TIPOS_DE_TESTE: readonly TipoObjeto[] = ['pinheiro', 'pedra', 'pinheiro', 'rampa'];

export function gerarPistaTeste(comprimentoM = 600): PistaGerada {
  const n = Math.floor(comprimentoM / DX_M) + 1;
  const alturas = new Float64Array(n);
  const rng = criarRng(SEMENTE_TESTE);
  const objetos: ObjetoPista[] = [];

  for (let i = 0; i < n; i += 1) {
    const x = i * DX_M;
    // descida média de ~ -18° (visual apenas: fora de core/pista/descida, Math.sin é permitido) + duas ondulações
    const base = -0.32 * x;
    const onda = Math.sin(x * 0.05) * 3 + Math.sin(x * 0.17) * 1;
    alturas[i] = base + onda;
    if (i > 0 && i % 60 === 0) {
      const tipo = rng.escolher(TIPOS_DE_TESTE);
      objetos.push({ tipo, x, largura: tipo === 'rampa' ? 3 : 1, altura: tipo === 'rampa' ? 1.5 : 1.8, variante: rng.inteiro(3) });
    }
  }

  const chegadaX = (n - 1) * DX_M;
  return {
    id: 'teste-m1a',
    semente: SEMENTE_TESTE,
    versaoGerador: 'teste-m1a-0',
    dx: DX_M,
    alturas,
    objetos,
    trilhos: [],
    checkpoints: [Math.floor(n / 3), Math.floor((2 * n) / 3)],
    chegadaX,
    hash: '0000000000000000', // placeholder: esta pista de teste não passa por exigirHashIgual
  };
}
