# Horários IFMT Cuiabá

O aluno do IFMT Campus Cuiabá abre o app e em menos de 5 segundos sabe a próxima aula, a sala e quanto falta para terminar o curso — coisa que o EdUpage oficial não responde bem no celular.

PWA gratuito e instalável: grade da turma (Hoje / Semana), matérias por semestre com progresso marcável, tudo offline após o primeiro acesso. Sem login; progresso fica no aparelho.

## Rodar

```sh
npm install
npm run scrape        # gera web/public/data/*.json do EdUpage (ver scraper/README.md)
npm run dev -w web    # app em http://localhost:5173
```

Gates de qualidade: `npm run typecheck` e `npm test`.

## Estrutura

- `scraper/` — Node + Effect: EdUpage → JSON estático (cron semanal via GitHub Actions)
- `web/` — Vite + React 19 + Tailwind 4 + vite-plugin-pwa
- `shared/schema.ts` — schemas `effect/Schema` compartilhados

Detalhes de arquitetura no [PRD](PRD.md) e em [scraper/README.md](scraper/README.md). Deploy: Vercel (config em `vercel.json`).
