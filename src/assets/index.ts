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

function resolverUrlAsset(caminhoRelativo: string): string {
  const base = import.meta.env.BASE_URL || '/';
  const semBarraDupla = base.endsWith('/') ? base : `${base}/`;
  const caminhoSemBarra = caminhoRelativo.startsWith('/') ? caminhoRelativo.slice(1) : caminhoRelativo;
  return `${semBarraDupla}${caminhoSemBarra}`;
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

    await Promise.all(
      Object.entries(manifesto).map(async ([nome, dados]) => {
        const img = new Image();
        const urlImg = resolverUrlAsset(`assets/personagens/${id}/recortes/${dados.arquivo}`);
        img.src = urlImg;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`Erro ao carregar sprite ${urlImg}`));
        });
        quadros.set(nome, { imagem: img, dados });
      })
    );

    return {
      id,
      obterQuadro(pose: string): QuadroCarregado | null {
        return quadros.get(pose) ?? quadros.get('ride0') ?? null;
      },
    };
  })();

  cachePersonagens.set(id, promessa);
  return promessa;
}
