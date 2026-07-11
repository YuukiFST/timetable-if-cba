# Trilha IF CBA

O **timetable** do IFMT Campus Cuiabá ([EdUpage](https://ifmtcba.edupage.org/timetable/)) é antigo, pouco intuitivo e ruim no celular: a grade aparece como tabela genérica, sem visão de curso, sem contagem do que falta cursar e sem resposta rápida para o dia a dia.

Este projeto existe para isso. Lê os horários públicos do instituto e mostra do jeito que o aluno precisa:

- **Curso** — todas as matérias do seu curso, agrupadas por semestre, com dia/horário de cada uma
- **Progresso** — marque o que já cursou; veja quantas faltam e o % até concluir o curso
- **Planejar** — marque as matérias que está cursando; a grade mostra o que há em cada dia
- **Hoje** — aulas do dia das matérias marcadas em Planejar (sala, professor, próxima aula)
- **Choques** — aviso quando duas turmas do mesmo curso batem no mesmo horário

PWA gratuito e instalável. Sem login; sua turma e seu progresso ficam só no aparelho. Funciona offline depois do primeiro acesso.

> Os nomes, dias e horários vêm do EdUpage. Se algo estiver errado, o problema está nos dados da instituição — não neste app.

## Rodar

```sh
npm install
npm run scrape        # gera web/public/data/*.json a partir do EdUpage (ver scraper/README.md)
./dev.sh              # sobe o app e abre http://localhost:5173 no navegador
```

Alternativa: `npm run dev`

## Qualidade

- `npm run typecheck` — TypeScript
- `npm test` — testes
- Commits: Conventional Commits (`feat(web): descrição`)

## Estrutura

| Pasta | Função |
|-------|--------|
| `web/` | App React (Vite, Tailwind 4, PWA) |
| `scraper/` | Extrai dados do EdUpage → JSON estático |
| `shared/` | Schemas compartilhados (`effect/Schema`) |

Mais detalhes: [scraper/README.md](scraper/README.md). Deploy na Vercel (`vercel.json`).
