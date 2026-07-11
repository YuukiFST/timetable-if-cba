# Scraper EdUpage → JSON estático

Extrai a grade regular do IFMT Cuiabá de `ifmtcba.edupage.org` e escreve `web/public/data/{cursos.json, turmas/*.json}`.

## Endpoints (engenharia reversa, capturados em 2026-07-10)

Ambos POST JSON, **sem sessão/autenticação**, body `{"__args": [...], "__gsh": "00000000"}`:

1. `POST /timetable/server/ttviewer.js?__func=getTTViewerData` — args `[null, <ano>]`.
   Resposta: `r.regular.timetables[] = { tt_num, year, text, datefrom, hidden }`.
   O scraper escolhe o timetable de `datefrom` mais recente.
2. `POST /timetable/server/regulartt.js?__func=regularttGetData` — args `[null, "<tt_num>"]`.
   Resposta: `r.dbiAccessorRes.tables[]`, cada uma `{ id, data_rows }`.
   Tabelas usadas: `classes`, `subjects`, `teachers`, `classrooms`, `periods`, `lessons`, `cards`.

Modelo: `card` (dia via bitmask `days` "010000" = terça, período inicial, salas) → `lesson` (matéria, professores, turmas, duração em períodos) → `class`/`subject`/`teacher`/`classroom`.

Respostas reais gravadas em `fixtures/` — os testes de transform rodam sobre elas e detectam drift de formato.

## Rodar

```sh
npm run scrape   # na raiz do repo
```

Pipeline Effect: `fetchTimetables → fetchRegularTT → decode (Schema) → transform → validar → escrever`.
Retry com backoff exponencial (máx. 3 tentativas). Nenhum arquivo é escrito antes de decode + transform + validação completos: falha preserva o JSON anterior. Escrita atômica em staging antes de substituir `turmas/` e `cursos.json`.

## CI (GitHub Actions)

Workflow `scrape.yml` (domingo 06:00 UTC + `workflow_dispatch`):

1. Roda `npm run scrape`
2. Se houver diff em `web/public/data`, abre PR para `main` (branch `data/scrape-YYYYMMDD-HHMM`)
3. Se já existir PR aberto com o mesmo título, atualiza a branch e comenta
4. Merge manual (recomendado: branch protection exigindo CI verde)
5. Deploy Vercel só após merge do PR

Não há push direto em `main` para dados do scrape.

## Semestre / curso por turma

Derivados do nome da turma (`DCOM 7131.2A Inform. Integ.` → curso "DCOM 7131 Inform. Integ.", semestre 2; `DEEA Eng. Elétrica 3º Sem` → semestre 3).
Nomes fora dos padrões: corrigir em [overrides.json](overrides.json) (chave = nome exato da turma).
