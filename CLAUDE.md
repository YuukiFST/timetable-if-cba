# CLAUDE.md — Horários IFMT Cuiabá

## Commits

Antes de commitar: ler `~/.cursor/rules/git.mdc` (regra global).

Formato obrigatório — **Conventional Commits**, uma linha:

```
feat(web): descrição curta
```

Tipos: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `perf`, `test`, `ci`.

O hook `.githooks/commit-msg` valida isso localmente (`npm install` ativa via `postinstall`).

CI (adicionar em `.github/workflows/ci.yml` quando tiver escopo `workflow`):

```yaml
- run: npm run validate:commit
  if: github.event_name == 'push'
```

Sem trailers de agente (`Co-authored-by: Cursor`, etc.).

## Rodar

```sh
npm install
./dev.sh
```
