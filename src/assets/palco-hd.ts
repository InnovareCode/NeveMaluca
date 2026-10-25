/**
 * Arte HD do palco da seleção de personagem (pedido do dono, 2026-10-24/25, playtest iPhone: "personagem grande
 * e nítido no palco" -- os recortes de produção (`personagens/<id>/recortes/`, usados pela animação in-game) têm
 * só ~175-210px de lado, perto do teto de ampliação do guia de UI (1,6x nativo); ampliados pra ~150 lógicos
 * (300px de buffer) ficam visivelmente moles. `arte-fonte/personagens/<id>/recortes-v1/` (gitignored, só local --
 * ver `docs/...` e o README do pipeline) tem a MESMA arte (mesma pose, mesmo enquadramento, conferido pixel a
 * pixel nos 6 personagens) a ~2,85x a resolução -- só pra `celeb`/`ride0`, as 2 poses que o palco usa. Copiadas
 * UMA vez para `public/assets/personagens/<id>/palco/` (este arquivo só lê daqui, nunca de `arte-fonte/`, que não
 * vai para o build/deploy).
 *
 * Como não têm manifesto próprio (não é o pipeline de animação, é só uma imagem estática maior), a âncora
 * (ponto de contato dos pés) é derivada do manifesto de PRODUÇÃO: como o enquadramento é idêntico, a FRAÇÃO
 * `contato / tamanho` do recorte pequeno vale pro recorte grande (só a escala muda, não a composição) -- quem
 * chama (`ui/cenas/selecao.ts`) já tem o `QuadroCarregado` de produção carregado e passa a fração.
 *
 * `celeb`, não `star`: nos 6 personagens, `star` é pose `tipo:'ar'` com `contato: null` (é o truque NO AR, sem
 * contato nenhum com o chão -- faz sentido pra corrida, não pra um palco com pedestal). `celeb` é `tipo:'chao'`
 * com `contato` de verdade nos 6 -- "comemorando, em pé" é o que combina com "pousado em cima do pedestal"
 * (achado medindo no navegador: com `star`, os pés ancoravam no `pivo`, um ponto de rotação, não de contato, e o
 * personagem flutuava longe do pedestal -- feedback do dono, playtest iPhone).
 */
import { resolverUrlAsset } from './index';

export interface ImagemPalcoHD {
  readonly imagem: HTMLImageElement;
  readonly largura: number;
  readonly altura: number;
}

export type PosePalco = 'celeb' | 'ride0';

const cache = new Map<string, Promise<ImagemPalcoHD | undefined>>();

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Erro ao carregar arte HD do palco: ${url}`));
  });
}

/** Carrega (ou devolve do cache) a imagem HD de `id`/`pose`. `undefined` em caso de falha -- nunca lança, quem
 *  desenha cai no recorte de produção normal (mesmo espírito de "melhor esforço" dos outros loaders do projeto). */
export function carregarImagemPalcoHD(id: string, pose: PosePalco): Promise<ImagemPalcoHD | undefined> {
  const chave = `${id}:${pose}`;
  const existente = cache.get(chave);
  if (existente) return existente;

  const promessa = (async () => {
    try {
      const url = resolverUrlAsset(`assets/personagens/${id}/palco/${id}-${pose}.png`);
      const imagem = await carregarImagem(url);
      return { imagem, largura: imagem.naturalWidth, altura: imagem.naturalHeight };
    } catch {
      return undefined;
    }
  })();

  cache.set(chave, promessa);
  return promessa;
}

/** Getter síncrono: `undefined` enquanto não carregou (ou se falhou) -- quem desenha nunca espera, só melhora
 *  de qualidade no quadro em que a promessa já resolveu (mesmo padrão de `menu-capa.ts`/`itens.ts`). */
const prontos = new Map<string, ImagemPalcoHD | undefined>();

export function imagemPalcoHDPronta(id: string, pose: PosePalco): ImagemPalcoHD | undefined {
  return prontos.get(`${id}:${pose}`);
}

/** Dispara o carregamento fire-and-forget e preenche o getter síncrono quando pronto. */
export function precarregarImagemPalcoHD(id: string, pose: PosePalco): void {
  const chave = `${id}:${pose}`;
  if (prontos.has(chave)) return;
  void carregarImagemPalcoHD(id, pose).then((r) => {
    prontos.set(chave, r);
  });
}

/** Só para teste/limpeza entre cenários de e2e. */
export function _esquecerPalcoHDParaTeste(): void {
  cache.clear();
  prontos.clear();
}
