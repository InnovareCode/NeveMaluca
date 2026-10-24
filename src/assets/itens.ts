/**
 * Carregador dos 8 ícones de item (pedido do dono, 2026-10-24: "icones gerados" em arte Pixar, substituindo os
 * vetoriais placeholder de `render/hud.ts`/`render/itens.ts`/`render/camada.ts`): `bola`/`poca`/`nuvem`/`turbo`/
 * `escudo`/`ima` (os 6 `TipoItem`), `caixa` (coletável de item no mundo) e `floco-dourado` (o coletável raro,
 * `ItemCamada.tipo === 'dourado'`) -- 256x256, fundo transparente, em `public/assets/itens/<nome>.webp`.
 *
 * Mesmo padrão de cache de módulo + preload fire-and-forget de `ui/cenas/menu-capa.ts`/`render/temas/parque-raster.ts`
 * (`cache`/`promessaCarregamento`, getter síncrono): quem desenha nunca espera a imagem -- decide ícone x fallback
 * vetorial a cada quadro por `assetsItensProntos()`. Fica em `assets/` (não em `render/`) porque `render/` só
 * importa `core/`/`data/`/`assets/` (regra de camada, memória `render-nao-pode-importar-pista`).
 */
import { resolverUrlAsset } from './index';

export interface AssetsItens {
  readonly bola: HTMLImageElement;
  readonly poca: HTMLImageElement;
  readonly nuvem: HTMLImageElement;
  readonly turbo: HTMLImageElement;
  readonly escudo: HTMLImageElement;
  readonly ima: HTMLImageElement;
  readonly caixa: HTMLImageElement;
  readonly flocoDourado: HTMLImageElement;
}

const PASTA = 'assets/itens/';

let cache: AssetsItens | null = null;
let promessaCarregamento: Promise<boolean> | null = null;

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Erro ao carregar ícone de item: ${url}`));
  });
}

/** Dispara o carregamento (fire-and-forget). Cacheado: chamadas repetidas devolvem a mesma promessa. */
export function precarregarAssetsItens(): Promise<boolean> {
  if (promessaCarregamento) return promessaCarregamento;
  promessaCarregamento = (async () => {
    try {
      const [bola, poca, nuvem, turbo, escudo, ima, caixa, flocoDourado] = await Promise.all([
        carregarImagem(resolverUrlAsset(`${PASTA}bola.webp`)),
        carregarImagem(resolverUrlAsset(`${PASTA}poca.webp`)),
        carregarImagem(resolverUrlAsset(`${PASTA}nuvem.webp`)),
        carregarImagem(resolverUrlAsset(`${PASTA}turbo.webp`)),
        carregarImagem(resolverUrlAsset(`${PASTA}escudo.webp`)),
        carregarImagem(resolverUrlAsset(`${PASTA}ima.webp`)),
        carregarImagem(resolverUrlAsset(`${PASTA}caixa.webp`)),
        carregarImagem(resolverUrlAsset(`${PASTA}floco-dourado.webp`)),
      ]);
      cache = { bola, poca, nuvem, turbo, escudo, ima, caixa, flocoDourado };
      return true;
    } catch {
      cache = null;
      return false;
    }
  })();
  return promessaCarregamento;
}

/** `null` enquanto não carregou (ou se falhou): quem desenha cai no fallback vetorial, nunca trava. */
export function assetsItensProntos(): AssetsItens | null {
  return cache;
}

/** Só para teste/limpeza entre cenários de e2e: força esquecer o cache carregado (mesmo padrão de `menu-capa.ts`). */
export function _esquecerAssetsItensParaTeste(): void {
  cache = null;
  promessaCarregamento = null;
}
