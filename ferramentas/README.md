# ferramentas/

Scripts Node de desenvolvimento, fora do bundle. No M0 só existe `icone/`. O resto é previsto pelo plano (§5) e será
criado por quem o precisar, **copiando do InnoFighters com nota de origem**.

| Pasta | Estado | O que faz | Dono |
|---|---|---|---|
| `icone/` | pronto | `npm run icone:provisorio` regenera `public/icones/*.png` (PNG escrito à mão, sem dependência). Provisório até o M4 (D9) | Vulcano |
| `sprites/` | previsto (M1b) | pipeline de folhas 4x3 para atlas C1, agora com `contato` e `pivo`. Origem: `../InnoFighters/ferramentas/sprites/`. Vai precisar de `sharp` (justificar na hora) | Vega |
| `harness/` | previsto (M1a) | bot descendo cada pista com N sementes (`npm run harness`) | Vega |
| `pista/` | previsto (M1) | desenha o perfil de uma pista em PNG para revisar sem jogar | Vega |
| `medir/` | `fps.mjs` pronto (M0, Lyra) | `node ferramentas/medir/fps.mjs [url] [--cpu=4] [--gpu=swiftshader]`: fps e p95 do quadro com CPU atrasada (CDP). Tempo até jogar: previsto (M1) | Lyra/Íris |

Arte bruta fica em `arte-fonte/` e saída de pipeline em `sprites-gerados/`; as duas pastas estão no `.gitignore`.
