/**
 * Storage falso em memoria para testes em Node (sem jsdom). Registra cada escrita/remocao para os testes provarem
 * "nada foi escrito por cima" e permite injetar as falhas reais do navegador: cota cheia, leitura que lanca,
 * escrita que lanca.
 */
import type { ArmazenamentoLike } from '../../src/meta/tipos';

export interface OpcoesStorageFalso {
  /** Soma maxima de caracteres (chaves + valores) aceita; acima disso `setItem` lanca `QuotaExceededError`. */
  cota?: number;
}

export class StorageFalso implements ArmazenamentoLike {
  readonly dados = new Map<string, string>();
  /** Cada `setItem`/`removeItem` aceito, na ordem: `['set', chave]` ou `['remove', chave]`. */
  readonly escritas: Array<readonly ['set' | 'remove', string]> = [];
  cota: number | undefined;
  falhaLeitura = false;
  falhaEscrita = false;

  constructor(inicial: Record<string, string> = {}, opcoes: OpcoesStorageFalso = {}) {
    for (const [k, v] of Object.entries(inicial)) this.dados.set(k, v);
    this.cota = opcoes.cota;
  }

  getItem(chave: string): string | null {
    if (this.falhaLeitura) throw new Error('SecurityError: leitura bloqueada');
    return this.dados.get(chave) ?? null;
  }

  setItem(chave: string, valor: string): void {
    if (this.falhaEscrita) throw new Error('SecurityError: escrita bloqueada');
    if (this.cota !== undefined) {
      let usado = 0;
      for (const [k, v] of this.dados) if (k !== chave) usado += k.length + v.length;
      if (usado + chave.length + valor.length > this.cota) {
        const e = new Error('QuotaExceededError');
        e.name = 'QuotaExceededError';
        throw e;
      }
    }
    this.dados.set(chave, valor);
    this.escritas.push(['set', chave]);
  }

  removeItem(chave: string): void {
    if (this.falhaEscrita) throw new Error('SecurityError: escrita bloqueada');
    this.dados.delete(chave);
    this.escritas.push(['remove', chave]);
  }

  /** Chaves escritas (set) desde o inicio, sem repeticao. */
  chavesEscritas(): string[] {
    return [...new Set(this.escritas.filter(([t]) => t === 'set').map(([, k]) => k))];
  }
}
