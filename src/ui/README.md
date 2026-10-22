# src/ui/

**Dono:** Lyra. **Estado no M0 (a montagem do boot está em `src/main.ts`: núcleo, save, áudio, plataforma):** `tipos.ts` (interface `Cena`) e `cenas/boot.ts` (cena vazia: degradê, flocos, título provisório e versão do build).

**Responsabilidade (plano §3.1):** cenas (`ui/cenas/*`: título, descida, resultado), menus e a persistência de
interface. É a camada que junta o resto.

**Importa de:** todas as camadas (`core`, `data`, `pista`, `descida`, `meta`, `render`, `audio`, `input`, `assets`, `platform`).

**Contrato da cena:** `atualizar()` por tick de passo fixo (sem relógio de parede), `desenhar(ctx, alpha)` por quadro em coordenadas lógicas 960x540
(o `main.ts` já aplicou `usarEspacoLogico`). Fundo estático vai numa camada `drawImage` (ver `boot.ts`: o degradê e o `strokeText` redesenhados
todo quadro custavam ~65 ms num canvas por software).

**Regra:** sem `<style>` nem `style="..."` em HTML gerado como string no build; use classes de `src/*.css`
(a CSP do build é `style-src 'self'`). Ajustar `elemento.style.x` por script é permitido.
