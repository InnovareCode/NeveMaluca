# src/ui/

**Dono:** Lyra. **Estado no M1a:** `tipos.ts` (interface `Cena`), `cenas/boot.ts` (M0) e `cenas/{descida,resultado,jogo}.ts`
(M1a: descida jogável com motor/pista de TESTE, resultado, e a composta que liga as duas). `main.ts` (fora do
alcance da Lyra) ainda monta só `criarCenaBoot`; plugar `criarCenaJogo` no lugar dela é a integração pendente
(ver handoff da Lyra, M1a, "PARA O PRÓXIMO").

**Responsabilidade (plano §3.1):** cenas (`ui/cenas/*`: título, descida, resultado), menus e a persistência de
interface. É a camada que junta o resto.

**`motor-teste.ts` e `pista-teste.ts` (M1a) são um DUBLÊ, não produção:** ficam em `ui/cenas/` (não em
`src/descida/`/`src/pista/`, que são da Vega) exatamente para a Lyra poder desenvolver render/câmera/entrada em
paralelo com o motor real. Quando `src/descida/` e `src/pista/` existirem, a integração troca o que
`criarCenaDescida` usa por dentro — os dois arquivos de teste são descartados.

**Importa de:** todas as camadas (`core`, `data`, `pista`, `descida`, `meta`, `render`, `audio`, `input`, `assets`, `platform`).

**Contrato da cena:** `atualizar()` por tick de passo fixo (sem relógio de parede), `desenhar(ctx, alpha)` por quadro em coordenadas lógicas 960x540
(o `main.ts` já aplicou `usarEspacoLogico`). Fundo estático vai numa camada `drawImage` (ver `boot.ts`: o degradê e o `strokeText` redesenhados
todo quadro custavam ~65 ms num canvas por software).

**Regra:** sem `<style>` nem `style="..."` em HTML gerado como string no build; use classes de `src/*.css`
(a CSP do build é `style-src 'self'`). Ajustar `elemento.style.x` por script é permitido.
