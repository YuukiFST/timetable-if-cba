# Implementation Plans

Gerado pelo `/improve` em 2026-07-11. Commit base: `860b3b5`. Issues publicadas em 2026-07-11.

Executar na ordem abaixo. Cada executor: ler o plano inteiro, honrar STOP conditions, atualizar a linha de status ao concluir.

## Execution order & status

| Plan | Title | Priority | Effort | Depends on | Issue | Status |
|------|-------|----------|--------|------------|-------|--------|
| 001 | Seleção de turma no onboarding | P1 | M | — | [#1](https://github.com/YuukiFST/timetable-if-cba/issues/1) | TODO |
| 002 | Reset progresso ao trocar de curso | P1 | S | 005 | [#5](https://github.com/YuukiFST/timetable-if-cba/issues/5) | TODO |
| 003 | Reset limpa cursando | P1 | S | 005 | [#6](https://github.com/YuukiFST/timetable-if-cba/issues/6) | TODO |
| 004 | Escrita atômica do scraper | P1 | M | — | [#7](https://github.com/YuukiFST/timetable-if-cba/issues/7) | TODO |
| 005 | Testes de storage.ts | P1 | S | — | [#2](https://github.com/YuukiFST/timetable-if-cba/issues/2) | DONE |
| 006 | Ofertas priorizam turmaAtual | P2 | M | 001 | [#8](https://github.com/YuukiFST/timetable-if-cba/issues/8) | TODO |
| 007 | Reconciliar PRD com Planejar/Hoje | P2 | M | — | [#3](https://github.com/YuukiFST/timetable-if-cba/issues/3) | TODO |
| 008 | Scrape via PR em vez de push direto | P2 | M | — | [#4](https://github.com/YuukiFST/timetable-if-cba/issues/4) | TODO |

## Dependency notes

- **005 antes de 002 e 003** — characterization tests do storage antes de mudar semântica de reset/troca.
- **001 antes de 006** — escolha correta de turma define o que `turmaAtual` significa para ofertas.
- **004 e 008** independentes do web; podem rodar em paralelo com 001–003.

## Findings considerados e rejeitados

- **PERF-02 (carregar todas as turmas):** by design para matérias integradas + choques; otimização com JSON agregado é opcional, não bug.
- **Playwright fallback (DEP-01):** válido mas fora do pacote recomendado; spike separado quando EdUpage exigir sessão.
- **ESLint/Prettier (DX-01):** útil, não bloqueia correções de dados/progresso.
- **CSP headers (SECURITY-02):** hardening válido; defer até superfície XSS concreta ou após planos P1.
