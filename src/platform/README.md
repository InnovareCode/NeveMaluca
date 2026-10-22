# src/platform/

**Dono:** Lyra. **Estado no M0:** entregue (escala, orientação, foco/pausa, laço mínimo, tela cheia, destrave de áudio, versão, fontes, erros).

**Responsabilidade (plano §3.1, M0):** escala do canvas (960x540 lógico com buffer 2x, letterbox, área segura), foco e pausa,
orientação (paisagem, D2), tela cheia, erros e fontes. PWA e tela acesa (wake lock) ficam para o M4.

**Importa de:** `core/` (só `core/constantes`, via `constantes.ts`).

| Arquivo | O que faz | Origem |
|---|---|---|
| `constantes.ts` | re-export de `core/constantes`: `LARGURA`/`ALTURA` (960x540), `RS` (2), buffer 1920x1080, `PASSO_MS`, `ACUMULADOR_MAXIMO_MS`. Não define número | novo |
| `escala.ts` | `calcularAreaDoCanvas` (puro, px inteiros, margens seguras, centrado), `ajustarEscala`, `observarEscala` | InnoFighters, ampliado |
| `orientacao.ts` | `emRetrato`, `observarOrientacao` (mesma media query do CSS), `travarPaisagem` | InnoFighters, ampliado |
| `foco.ts` | `observarFoco`: blur/focus e visibilidade (ida e volta) | InnoFighters, ampliado |
| `laco.ts` | `criarLaco`: passo fixo com acumulador sobre rAF, pausa por motivo, para no primeiro erro. `PASSO_MS` vem do core; NÃO usa o `criarLaco` do core (ver abaixo) | novo |
| `tela-cheia.ts` | situação (`disponivel`/`ios`/`instalado`/...) e pedido com retry no fim do toque | cópia do InnoFighters |
| `tela-cheia-ui.ts` | botão e cartão COMO ATIVAR (DOM acessível, tecla F) | novo, textos do InnoFighters |
| `audio-desbloqueio.ts` | `desbloquearAudio(window, audio)`: resume no gesto que o WebKit reconhece | cópia do InnoFighters |
| `aviso.ts` | aviso discreto (`#aviso`, role=status) que some sozinho | cópia do InnoFighters |
| `erros.ts` | erros na caixa `#err` (convenção do Vulcano) | InnoFighters, adaptado |
| `erros-no-carregamento.ts` | liga a caixa `#err` no import. `main.ts` o importa PRIMEIRO, para uma falha de validação do `core/` no import não virar tela em branco | novo |
| `fontes.ts` + `fontes.css` | carga das 3 fontes antes do 1º quadro; `@font-face` auto-hospedado | cópia do InnoFighters |
| `plataforma.css` | área segura (`--seg-*`), aviso de retrato `#rot`, `#aviso`, botão e cartão | adaptado |
| `canvas.ts` | `prepararCanvas` (buffer 1920x1080) e `usarEspacoLogico` | novo |

**Regras que valem aqui:**
- Sem `<style>` nem `style=""` em HTML. Estilo por classe em CSS externo; `elemento.style.x = ...` por script é permitido pela CSP.
- Área segura: o CSS define `--seg-topo/direita/base/esquerda` (valem `env(safe-area-inset-*)`). Para simular um entalhe em teste, defina
  `--teste-topo/direita/base/esq` no `<html>` por `style.setProperty` e dispare `resize`.
- Só o carimbo do `requestAnimationFrame` como relógio no laço; sem `Date.now` para tempo de simulação.
- Tela cheia no iPhone NÃO tem API (Safari e Chrome do iOS): o botão vira COMO ATIVAR e abre o cartão. Não "consertar" tentando a API.

**Dois laços, de propósito (integração do M0):** `platform/laco.ts` (rAF, pausa por motivo, para no erro) e `core/laco.ts` (puro, relógio por parâmetro, usado por
`descida/` e pelo replay). Mesma cadência: `tests/unit/integracao-m0.test.ts` roda os dois com o mesmo relógio sintético (30 a 144 Hz, jitter) e a diferença
é de no máximo 1 tick por quadro. **Diverge só no teto:** a platform limita o *delta* de cada quadro a 100 ms; o core limita o *acumulador* inteiro (quadro de
~85 ms ou mais logo depois de sobra de tick roda 1 tick a mais na platform). Alinhar é trocar uma linha na platform; deixei como estava (sem mudar comportamento).
