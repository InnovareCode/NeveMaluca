/**
 * Carregador e manifesto de sprites de personagens (contrato C1, plano §3.1).
 * Respeita a base do Vite (`import.meta.env.BASE_URL`) para funcionar tanto em dev quanto no GitHub Pages.
 */

export interface DadosQuadroSprite {
  readonly arquivo: string;
  readonly largura: number;
  readonly altura: number;
  readonly contato: readonly [number, number] | null;
  readonly pivo: readonly [number, number];
  readonly tipo: 'chao' | 'ar' | 'corpo';
}

export interface QuadroCarregado {
  readonly imagem: HTMLImageElement;
  readonly dados: DadosQuadroSprite;
}

export interface SpritePersonagem {
  readonly id: string;
  readonly obterQuadro: (pose: string) => QuadroCarregado | null;
}

const cachePersonagens = new Map<string, Promise<SpritePersonagem>>();

/** Resolve um caminho relativo (`assets/...`) para a URL respeitando a base do Vite; reusado por outros carregadores de asset (ex. `render/temas/parque-raster.ts`). */
export function resolverUrlAsset(caminhoRelativo: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const semBarraDupla = base.endsWith('/') ? base : `${base}/`;
  const caminhoSemBarra = caminhoRelativo.startsWith('/') ? caminhoRelativo.slice(1) : caminhoRelativo;
  return `${semBarraDupla}${caminhoSemBarra}`;
}

/** Carrega UMA imagem, com 1 nova tentativa se a 1ª falhar (rede instável de celular -- um `img.onerror` isolado
 *  não deve ser definitivo). `undefined` se as duas tentativas falharem (quem chama decide o que fazer). */
async function carregarImagemComRetry(url: string): Promise<HTMLImageElement | undefined> {
  for (let tentativa = 0; tentativa < 2; tentativa += 1) {
    try {
      const img = new Image();
      img.src = url;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Erro ao carregar sprite ${url}`));
      });
      return img;
    } catch {
      // 2ª (e última) tentativa cai pro loop de novo; se essa também falhar, devolve undefined abaixo.
    }
  }
  return undefined;
}

export function carregarSpritePersonagem(id: string = 'capi'): Promise<SpritePersonagem> {
  const existente = cachePersonagens.get(id);
  if (existente) return existente;

  const promessa = (async () => {
    const urlManifesto = resolverUrlAsset(`assets/personagens/${id}/manifesto.json`);
    const res = await fetch(urlManifesto);
    if (!res.ok) {
      throw new Error(`Falha ao carregar manifesto de sprites de ${id}: ${res.status}`);
    }
    const manifesto = (await res.json()) as Record<string, DadosQuadroSprite>;

    const quadros = new Map<string, QuadroCarregado>();

    // Cada pose é independente: uma imagem que falha (rede instável, 1 arquivo fora do ar) NUNCA derruba o
    // personagem inteiro -- antes um único `Promise.all` fazia qualquer falha rejeitar TUDO, e a promessa
    // rejeitada ficava cacheada pra sempre (sem retry), apagando o personagem da seleção pro resto da sessão
    // (`obterQuadro` só devolve `null`, a tela cai no esqueleto translúcido). Ver memória
    // `carregar-sprite-resiliente-falha-isolada-nao-derruba-personagem`.
    await Promise.all(
      Object.entries(manifesto).map(async ([nome, dados]) => {
        const urlImg = resolverUrlAsset(`assets/personagens/${id}/recortes/${dados.arquivo}`);
        const imagem = await carregarImagemComRetry(urlImg);
        if (imagem) quadros.set(nome, { imagem, dados });
      })
    );

    if (quadros.size === 0) {
      throw new Error(`Nenhum quadro de sprite carregou para "${id}" (manifesto com ${Object.keys(manifesto).length} poses)`);
    }

    return {
      id,
      obterQuadro(pose: string): QuadroCarregado | null {
        return quadros.get(pose) ?? quadros.get('ride0') ?? quadros.values().next().value ?? null;
      },
    };
  })();

  cachePersonagens.set(id, promessa);
  return promessa;
}
