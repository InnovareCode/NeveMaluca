"""
Pos-processamento generico dos cenarios raster "Pixar" das pistas (rollout de docs/rollout-cenarios-pixar.md).
Generaliza o piloto (antes em arte-fonte/ferramentas-curadoria/cenario-pico-do-picole.py, que era gitignored):
este arquivo e VERSIONADO e nao depende de arte-fonte/ (embute alfa_chave/rotular/despill), pra sobreviver a
troca de conta -- ver memoria [[pipeline-sprites-gitignored]].

Entrada:  arte-fonte/cenarios/<pista>/{silhuetas,medias,fundo,objetos,manta,texturas}-v1.png  (6 imagens 2K, nunca mexidas)
Saida:    public/assets/cenarios/<pista>/*.webp  (o que vai pro git e pro jogo)

Uso:  python ferramentas/cenario-raster.py <pista>
      (ex.: python ferramentas/cenario-raster.py morro-do-pinhao)

Chroma por pista (docs/rollout-cenarios-pixar.md SS1.1): Morro=magenta (tema cheio de verde; despill verde comeria a
folhagem), as demais=verde. O despill magenta tira a franja magenta; o verde limita G a max(R,B).
"""
import os
import sys

import numpy as np
from PIL import Image

RAIZ = r"C:/Projetos/Web/InnoGames/NeveMaluca"
CHAVES = {"verde": np.array([0, 255, 0]), "magenta": np.array([255, 0, 255])}


# --------------------------------------------------------------------------- funcoes base (embutidas)
def alfa_chave(img, fundo, tol=48, suav=70):
    d = np.sqrt(((img - fundo[None, None, :]) ** 2).sum(-1))
    a = np.clip((d - tol) / suav, 0, 1)
    return (a * 255).round().astype(np.uint8)


def despill(rgb, alpha, chroma):
    """Tira a franja da chave na borda (alfa<255). verde: limita G a max(R,B). magenta: tira min(R,B)-G de R e B."""
    rgb = rgb.copy()
    m = alpha < 255
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    if chroma == "verde":
        maxrb = np.maximum(r, b)
        rgb[..., 1] = np.where(m, np.minimum(g, maxrb), g)
    else:  # magenta
        e = np.minimum(r, b) - g
        e = np.where(e > 0, e, 0)
        rgb[..., 0] = np.where(m, r - e, r)
        rgb[..., 2] = np.where(m, b - e, b)
    return rgb


def rotular(mask):
    """Componentes conexos 8-vizinhos por corridas + union-find. Devolve (rotulos int32, n)."""
    h, w = mask.shape
    pai = []

    def achar(x):
        while pai[x] != x:
            pai[x] = pai[pai[x]]
            x = pai[x]
        return x

    corridas = []
    anteriores = []
    for y in range(h):
        linha = mask[y].astype(np.int8)
        d = np.diff(np.concatenate(([0], linha, [0])))
        ini = np.flatnonzero(d == 1)
        fim = np.flatnonzero(d == -1) - 1
        atuais = []
        j = 0
        for x0, x1 in zip(ini, fim):
            novo = len(pai)
            pai.append(novo)
            while j < len(anteriores) and anteriores[j][1] < x0 - 1:
                j += 1
            k = j
            while k < len(anteriores) and anteriores[k][0] <= x1 + 1:
                ra, rb = achar(anteriores[k][2]), achar(novo)
                if ra != rb:
                    pai[max(ra, rb)] = min(ra, rb)
                k += 1
            atuais.append((x0, x1, novo))
            corridas.append((y, x0, x1, novo))
        anteriores = atuais
    raizes = {}
    rot = np.zeros((h, w), np.int32)
    for y, x0, x1, i in corridas:
        r = achar(i)
        if r not in raizes:
            raizes[r] = len(raizes) + 1
        rot[y, x0:x1 + 1] = raizes[r]
    return rot, len(raizes)


# --------------------------------------------------------------------------- helpers
def chave_e_despill(rgb, chroma, corte_topo_frac=None, tol=48, suav=70):
    chave = CHAVES[chroma]
    alpha = alfa_chave(rgb, chave, tol, suav)
    rgb2 = despill(rgb, alpha, chroma)
    if corte_topo_frac is not None:
        corte = int(rgb.shape[0] * corte_topo_frac)
        alpha = alpha.copy()
        alpha[:corte] = 0
    return np.dstack([np.clip(rgb2, 0, 255).astype(np.uint8), alpha.astype(np.uint8)])


def emenda_horizontal(arr, frac=0.06):
    arr = arr.astype(np.float64)
    h, w = arr.shape[:2]
    bw = max(1, int(round(w * frac)))
    cauda, cabeca = arr[:, w - bw:], arr[:, :bw]
    t = np.linspace(0, 1, bw)[None, :, None]
    mistura = cauda * (1 - t) + cabeca * t
    return np.clip(np.concatenate([mistura, arr[:, bw:w - bw]], axis=1), 0, 255).astype(np.uint8)


def redimensionar_cobrindo(arr, lw, lh):
    h, w = arr.shape[:2]
    alvo, atual = lw / lh, w / h
    if atual > alvo:
        nw = int(round(h * alvo)); x0 = (w - nw) // 2; arr = arr[:, x0:x0 + nw]
    elif atual < alvo:
        nh = int(round(w / alvo)); y0 = (h - nh) // 2; arr = arr[y0:y0 + nh]
    modo = "RGBA" if arr.shape[2] == 4 else "RGB"
    return Image.fromarray(arr, modo).resize((lw, lh), Image.LANCZOS)


def salvar(saida, img, nome, q=92):
    os.makedirs(saida, exist_ok=True)
    img.save(os.path.join(saida, nome), "WEBP", quality=q, method=6)
    print(f"  -> {nome}  {img.size}  {img.mode}")


# --------------------------------------------------------------------------- etapas
def carregar_rgb(fonte, nome):
    return np.asarray(Image.open(os.path.join(fonte, nome)).convert("RGB")).astype(np.int32)


def processar_fundo(cfg):
    print("fundo.webp (opaco, 16:9)")
    rgb = emenda_horizontal(carregar_rgb(cfg["fonte"], "fundo-v1.png"), 0.06)
    salvar(cfg["saida"], redimensionar_cobrindo(rgb, 1920, 1080), "fundo.webp")


def processar_medias(cfg):
    print("medias.webp (chroma, 16:9)")
    rgba = chave_e_despill(carregar_rgb(cfg["fonte"], "medias-v1.png"), cfg["chroma"])
    rgba = emenda_horizontal(rgba, 0.06)
    salvar(cfg["saida"], redimensionar_cobrindo(rgba, 1920, 1080), "medias.webp")


def processar_silhuetas(cfg):
    print("silhuetas.webp (chroma, 21:9)")
    rgba = chave_e_despill(carregar_rgb(cfg["fonte"], "silhuetas-v1.png"), cfg["chroma"],
                           corte_topo_frac=cfg.get("corte_topo_silhuetas"))
    rgba = emenda_horizontal(rgba, 0.06)
    salvar(cfg["saida"], redimensionar_cobrindo(rgba, 2520, 1080), "silhuetas.webp")


def processar_manta(cfg):
    print("manta.webp (chroma no topo, faixa cisalhavel)")
    rgb = carregar_rgb(cfg["fonte"], "manta-v1.png")
    rgba = chave_e_despill(rgb, cfg["chroma"])
    alpha = rgba[..., 3]
    h, w = alpha.shape
    topo_cor = np.array(cfg["manta_topo_cor"])
    dist = np.linalg.norm(rgb - topo_cor[None, None, :], axis=2)
    perto = dist < 40
    primeiras = [int(np.argmax(perto[:, x])) for x in range(0, w, 40) if perto[:, x].any()]
    topo_neve = max(0, (min(primeiras) if primeiras else 0) - 4)

    bottom_cor = cfg.get("manta_bottom_cor")
    if bottom_cor is not None:
        cor = np.array(bottom_cor)
        opaca = alpha > 200
        media = np.zeros((h, 3))
        for y in range(topo_neve, h):
            px = rgba[y][opaca[y]][:, :3]
            media[y] = px.mean(axis=0) if len(px) else (media[y - 1] if y else 0)
        d_bottom = np.linalg.norm(media - cor[None, :], axis=1)
        linhas = np.flatnonzero((d_bottom < 28) & (np.arange(h) > topo_neve))
        fim = int(linhas.max()) if len(linhas) else h - 1
        corte_baixo = min(h, int(round(fim + 0.10 * (fim - topo_neve))))
    else:
        corte_baixo = h  # slab vai ate a base
    print(f"  topo_neve={topo_neve} corte_baixo={corte_baixo} (h={h})")

    faixa = emenda_horizontal(rgba[topo_neve:corte_baixo], 0.06)
    af = 128
    lf = max(1, round(faixa.shape[1] * (af / faixa.shape[0])))
    salvar(cfg["saida"], Image.fromarray(faixa, "RGBA").resize((lf, af), Image.LANCZOS), "manta.webp")


def processar_texturas(cfg):
    print("texturas (espelho 2x2 -> 512)")
    rgb = carregar_rgb(cfg["fonte"], "texturas-v1.png")
    h, w = rgb.shape[:2]
    mh, mw = h // 2, w // 2
    quad = [rgb[0:mh, 0:mw], rgb[0:mh, mw:w], rgb[mh:h, 0:mw], rgb[mh:h, mw:w]]  # TL TR BL BR
    for nome, q in zip(cfg["texturas"], quad):
        topo = np.concatenate([q, q[:, ::-1]], axis=1)
        base = np.concatenate([q[::-1, :], q[::-1, ::-1]], axis=1)
        grande = np.concatenate([topo, base], axis=0)
        img = Image.fromarray(np.clip(grande, 0, 255).astype(np.uint8), "RGB").resize((512, 512), Image.LANCZOS)
        salvar(cfg["saida"], img, f"{nome}.webp")


def processar_objetos(cfg):
    print("folha de objetos (12 celulas)")
    raw = carregar_rgb(cfg["fonte"], "objetos-v1.png")
    rgba = chave_e_despill(raw, cfg["chroma"])
    h, w = rgba.shape[:2]
    cols = [round(i * w / 4) for i in range(5)]
    lins = [round(i * h / 3) for i in range(4)]
    multicomp = set(cfg.get("objetos_multicomp", ()))
    # objetos que brilham (lua, magma, lanterna) deixam um halo que vira franja da chave: re-chaveia a
    # celula com tol/suav mais fortes pra comer o halo sem tocar no corpo (longe da chave). {nome: (tol, suav)}
    forte = dict(cfg.get("objetos_chave_forte", {}))
    for i, nome in enumerate(cfg["objetos"]):
        x0, x1 = cols[i % 4], cols[i % 4 + 1]
        y0, y1 = lins[i // 4], lins[i // 4 + 1]
        if nome in forte:
            t, s = forte[nome]
            cel = chave_e_despill(raw[y0:y1, x0:x1], cfg["chroma"], tol=t, suav=s)
        else:
            cel = rgba[y0:y1, x0:x1]
        mask = cel[..., 3] > 10
        if not mask.any():
            print(f"  AVISO: celula {nome} vazia, pulando"); continue
        rot, n = rotular(mask)
        if n > 1:
            areas = np.array([int((rot == r).sum()) for r in range(1, n + 1)])
            if nome in multicomp:
                # mantem todo componente com area >= 2% da celula (partes soltas de proposito: vapor, varal...)
                limiar = 0.02 * mask.size
                manter = {r + 1 for r in range(n) if areas[r] >= limiar}
                mask = np.isin(rot, list(manter))
            else:
                mask = rot == (int(np.argmax(areas)) + 1)
        ys, xs = np.nonzero(mask)
        pad = 2
        cy0, cy1 = max(0, ys.min() - pad), min(cel.shape[0], ys.max() + 1 + pad)
        cx0, cx1 = max(0, xs.min() - pad), min(cel.shape[1], xs.max() + 1 + pad)
        rec = cel[cy0:cy1, cx0:cx1].copy()
        so = mask[cy0:cy1, cx0:cx1]
        rec[..., 3] = np.where(so, rec[..., 3], 0)
        if rec.shape[0] > 256:
            esc = 256 / rec.shape[0]
            rec_img = Image.fromarray(rec, "RGBA").resize((max(1, round(rec.shape[1] * esc)), 256), Image.LANCZOS)
        else:
            rec_img = Image.fromarray(rec, "RGBA")
        salvar(cfg["saida"], rec_img, f"{nome}.webp")


# --------------------------------------------------------------------------- config por pista
PISTAS = {
    "morro-do-pinhao": {
        "chroma": "magenta",
        "corte_topo_silhuetas": None,   # medido: R1 funcionou, sem fileira-fantasma no Morro
        "manta_topo_cor": [247, 251, 255],
        "manta_bottom_cor": None,       # slab vai ate a base (so neve, sem faixa colorida)
        "texturas": ["tex-corpo", "tex-subida", "tex-queda", "tex-neve"],  # TL TR BL BR (SS4.8)
        "objetos": [
            "obj-pedra-baixa", "obj-pedra-dupla", "obj-tora-araucaria", "obj-pinheiro",
            "obj-boneco-cartola", "obj-pinhao", "obj-travessa", "obj-mourao",
            "obj-bandeirinha-vermelha", "obj-bandeirinha-amarela", "obj-porteira", "obj-placa-seta",
        ],
        "objetos_multicomp": (),        # Morro: nenhum objeto com partes soltas de proposito
    },
    "vila-chocolate": {
        "chroma": "verde",
        "corte_topo_silhuetas": None,   # medido: #1 noturna veio limpa, sem fantasma
        "manta_topo_cor": [234, 240, 255],   # neve #EAF0FF
        "manta_bottom_cor": None,       # slab (neve->telha->periwinkle) vai ate a base
        "texturas": ["tex-corpo", "tex-telha", "tex-enxaimel", "tex-neve"],  # TL TR BL BR (SS5.8)
        "objetos": [
            "obj-chamine", "obj-barril", "obj-treno", "obj-pinheiro-luzinhas",
            "obj-boneco-gorro", "obj-marshmallow", "obj-varal", "obj-lampiao",
            "obj-cata-vento", "obj-lua", "obj-caneca", "obj-portico-enxaimel",
        ],
        "objetos_multicomp": ("obj-varal",),   # varal: lampadas penduradas soltas de proposito
        "objetos_chave_forte": {"obj-lua": (230, 40)},   # lua tem halo assado: chave forte come o anel verde
    },
    "vulcao-pe-gelado": {
        "chroma": "verde",
        "corte_topo_silhuetas": None,
        "manta_topo_cor": [221, 235, 250],   # neve-gelo #DDEBFA
        "manta_bottom_cor": None,            # slab de gelo vai ate a base
        "texturas": ["tex-corpo", "tex-crosta", "tex-basalto", "tex-neve"],  # TL TR BL BR (SS6.8)
        "objetos": [
            "obj-prisma-basalto", "obj-bomba-vulcanica", "obj-coluna-tombada", "obj-fumarola",
            "obj-boneco-escalda-pes", "obj-cristal-gelo", "obj-ponte-basalto", "obj-chaleira",
            "obj-baforada", "obj-lua", "obj-termometro", "obj-portico-basalto",
        ],
        "objetos_multicomp": ("obj-baforada", "obj-chaleira"),   # vapor solto de proposito
        "objetos_chave_forte": {"obj-lua": (230, 40)},           # lua: come o halo verde
    },
    "cume-da-ventania": {
        "chroma": "verde",
        "corte_topo_silhuetas": None,
        "manta_topo_cor": [232, 241, 255],   # neve de vento #E8F1FF
        "manta_bottom_cor": None,            # slab de gelo vai ate a base
        "texturas": ["tex-corpo", "tex-cornija", "tex-fenda", "tex-neve"],  # TL TR BL BR (SS7.8)
        "objetos": [
            "obj-rocha-gelo", "obj-bloco-gelo", "obj-laje-cornija", "obj-pinheiro-torto",
            "obj-boneco-cachecol", "obj-cristal-floco", "obj-corda", "obj-poste-corda",
            "obj-torre-trelica", "obj-biruta", "obj-lua", "obj-placa-vento",
        ],
        "objetos_multicomp": (),             # corda e uma peca so; nada solto de proposito
        "objetos_chave_forte": {"obj-lua": (230, 40)},
    },
}


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in PISTAS:
        print("uso: python ferramentas/cenario-raster.py <pista>")
        print("pistas:", ", ".join(PISTAS)); sys.exit(1)
    pista = sys.argv[1]
    cfg = dict(PISTAS[pista])
    cfg["fonte"] = f"{RAIZ}/arte-fonte/cenarios/{pista}"
    cfg["saida"] = f"{RAIZ}/public/assets/cenarios/{pista}"
    print(f"=== {pista} (chroma {cfg['chroma']}) ===")
    processar_fundo(cfg)
    processar_medias(cfg)
    processar_silhuetas(cfg)
    processar_manta(cfg)
    processar_texturas(cfg)
    processar_objetos(cfg)
    print("Pronto:", cfg["saida"])


if __name__ == "__main__":
    main()
