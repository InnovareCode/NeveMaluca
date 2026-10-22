# src/assets/

**Dono:** Vega (carregador) e Lyra (uso). **Estado no M0:** vazio. Só importa no M1b, quando houver arte.

**Responsabilidade (plano §3.1, contrato C1):** manifesto de atlas, carregador e carga sob demanda. Os arquivos
servidos moram em `public/assets/` (não em `src/`). Teto de 2 páginas de 2048x2048 por personagem.

**Importa de:** `core/`, `data/`.

**Lembrete de base:** com `--base=/subcaminho/` use `import.meta.env.BASE_URL` para montar URLs de `public/`;
URL começando em `/` ignora a base.
