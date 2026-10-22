# src/render/

**Dono:** Lyra. **Estado no M1a:** entregue (sem arte — formas geométricas cinza/coloridas; a arte real troca isto no M1b).

**Responsabilidade (plano §3.6, §7, risco R4):** câmera, terreno, cenário procedural em camadas (parallax),
piloto, objetos, HUD. Só lê o estado do motor (`PilotoLeitura`/`EstadoCamera`), nunca o altera.

**Importa de:** `core/` (e, no futuro, `data/`, `assets/` — ainda não usados no M1a).

| Arquivo | O que faz |
|---|---|
| `mundo.ts` | `mundoParaTela`: metros (y para cima) -> px lógicos (y para baixo), com a câmera e o zoom aplicados |
| `camera.ts` | `criarCamera`: mola com amortecimento crítico (olhar à frente por `vx`), zoom por velocidade, tremida no pouso/tombo via `rngVisual` |
| `terreno.ts` | `desenharTerreno`/`alturaDoTerreno`: polígono cinza a partir de `PistaGerada.alturas`, interpolado |
| `objetos.ts` | `desenharObjetos`: `ObjetoPista` como retângulo colorido por tipo, apoiado no terreno |
| `piloto.ts` | `desenharPiloto`: cápsula (elipse) + prancha (traço), cor por `modo`, rotação por `angulo` (graus -> canvas) |
| `parallax.ts` | `criarParallax`: céu em degradê + 3 silhuetas de montanha (pré-desenhadas, como o boot.ts do M0) + neve caindo determinística |
| `hud.ts` | `desenharHud`: velocidade (km/h) e pontos; aviso "PREPARA..." na contagem |

**Regras de desempenho (o portão é o iPhone):** camadas de montanha pré-desenhadas em canvas fora da tela (uma vez,
não a cada quadro — lição do boot.ts: redesenhar texto/degradê todo quadro custava ~65 ms por quadro num canvas
por software); sem `shadowBlur` nem `filter`. Esta camada fica isolada para poder ser trocada por PixiJS se o fps
não passar (plano, saídas da opção A).

**Regra de determinismo que vale aqui também:** `Math.random` é proibido em TODA `src/` (varredura de
`tests/unit/arquitetura.test.ts`); qualquer aleatoriedade visual usa `criarRng`/`rngDoCanal` do canal `visual`
(plano §3.3). `Math.sin/cos/atan2/pow` SÃO permitidos em `render/` (a regra de trig tabelada só vale em
`core/pista/descida`, o núcleo determinístico do replay).

**Conversão de ângulo (`piloto.ts`):** o contrato usa graus, 0 = +x, anti-horário (mundo com y para cima); o canvas
roda em radianos, sentido horário, y para baixo — por isso `piloto.ts` inverte o sinal antes de `ctx.rotate`.

**Pendência conhecida (M1a):** câmera e zoom usam constantes PONTO DE PARTIDA (`VELOCIDADE_MAX_REF_MS`,
`RIGIDEZ_CAMERA`...), declaradas assim nos comentários — afinar no aparelho com a Vega e o dono quando o motor
real (teto de velocidade por personagem) existir.
