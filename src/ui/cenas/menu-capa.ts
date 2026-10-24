/**
 * Carregador dos assets da "capa oficial" do menu principal (pedido do dono, key art estilo Crash 4): `capa.webp`
 * (1920x1072, os 6 personagens + Capi herói ao centro, canto superior esquerdo livre) e `logo.webp` (NEVE MALUCA,
 * com alfa), em `public/assets/menu/`. Mesmo padrão de cache de módulo + preload fire-and-forget de
 * `render/temas/parque-raster.ts` (`cache`/`promessaCarregamento`, getter síncrono): `ui/cenas/menu.ts` nunca trava
 * esperando a imagem -- decide capa x tela de carregamento a cada quadro por `assetsMenuCapaProntos()`.
 */
import { resolverUrlAsset } from '../../assets/index';

export interface AssetsMenuCapa {
  readonly capa: HTMLImageElement;
  readonly logo: HTMLImageElement;
}

const PASTA = 'assets/menu/';

let cache: AssetsMenuCapa | null = null;
let promessaCarregamento: Promise<boolean> | null = null;

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Erro ao carregar asset do menu: ${url}`));
  });
}

/** Dispara o carregamento (fire-and-forget). Cacheado: chamadas repetidas devolvem a mesma promessa. */
export function precarregarAssetsMenuCapa(): Promise<boolean> {
  if (promessaCarregamento) return promessaCarregamento;
  promessaCarregamento = (async () => {
    try {
      const [capa, logo] = await Promise.all([
        carregarImagem(resolverUrlAsset(`${PASTA}capa.webp`)),
        carregarImagem(resolverUrlAsset(`${PASTA}logo.webp`)),
      ]);
      cache = { capa, logo };
      return true;
    } catch {
      cache = null;
      return false;
    }
  })();
  return promessaCarregamento;
}

/** `null` enquanto não carregou (ou se falhou): o pintor cai na tela de carregamento, nunca trava o menu. */
export function assetsMenuCapaProntos(): AssetsMenuCapa | null {
  return cache;
}

/** Só para teste/limpeza entre cenários de e2e: força esquecer o cache carregado (mesmo padrão de `parque-raster.ts`). */
export function _esquecerAssetsMenuCapaParaTeste(): void {
  cache = null;
  promessaCarregamento = null;
}
