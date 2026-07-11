# PRD — Trilha IF CBA

> **PWA gratuito para alunos do IFMT Campus Cuiabá consultarem grade de aulas (matérias, dias, horários, salas, professores) e acompanharem o progresso do curso (matérias feitas vs faltantes).**
>
> Fonte de dados: https://ifmtcba.edupage.org/timetable/
> Este documento é autocontido: um agente de desenvolvimento deve conseguir implementar o projeto inteiro apenas com ele.

---

## 1. Visão geral

### Problema
O IFMT Cuiabá publica os horários no EdUpage (`ifmtcba.edupage.org/timetable/`), uma interface genérica de grade escolar:
lenta para a pergunta do dia a dia ("qual minha próxima aula e em que sala?"), ruim no celular, e sem nenhuma noção de progresso do curso — o aluno não vê quantas matérias já cursou nem quantas faltam para se formar.

### Solução
Um web app instalável (PWA) que:
1. Mostra a grade da turma do aluno de forma clara e mobile-first (hoje / semana / próxima aula).
2. Lista todas as matérias do curso por semestre.
3. Deixa o aluno marcar matérias concluídas e vê contadores de progresso (feitas, faltantes, %).

### Público
Alunos do IFMT Campus Cuiabá, todos os cursos/turmas publicados no EdUpage.

### Objetivo em uma frase
Abrir o app e em menos de 5 segundos saber a próxima aula, a sala e quanto falta para terminar o curso.

---

## 2. Restrições inegociáveis

1. **Custo zero total** — desenvolvimento, hospedagem, CI e dados. Nenhum serviço pago, nenhum free tier que exija cartão de crédito.
2. **PWA instalável** — manifest + service worker + HTTPS; o botão "Instalar" do navegador deve aparecer em desktop e Android. Funciona offline com os últimos dados cacheados.
3. **Mobile-first** — celular é o dispositivo principal; desktop é adaptação.
4. **Effect na stack** — https://effect.website/ é obrigatório na camada de dados (scraper e frontend). Usar `effect` (pipeline, error handling) e `effect/Schema` (decode/validação).
5. **Sem login, sem backend de usuário** — progresso e preferências ficam no dispositivo (localStorage). Nenhum dado pessoal sai do aparelho.
6. **Somente leitura no EdUpage** — o scraper apenas consulta; nunca autentica, nunca grava, respeita cadência baixa (1 execução semanal).

---

## 3. Personas e user stories

**Persona única: aluno do IFMT Cuiabá** (ensino médio integrado, técnico ou superior), usa majoritariamente o celular.

| # | User story | Critério de aceite |
|---|---|---|
| U1 | Como aluno, quero escolher meu curso e turma uma única vez | Escolha persiste entre sessões e reinstalações do PWA no mesmo navegador |
| U2 | Como aluno, quero ver minha próxima aula (matéria, sala, horário, professor) ao abrir o app | Tela inicial destaca a aula atual/próxima com base no relógio do dispositivo |
| U3 | Como aluno, quero ver a grade completa da semana | Visão semanal com dias × slots de horário, legível em tela de 360 px |
| U4 | Como aluno, quero ver todas as matérias do meu curso organizadas por semestre | Lista agrupada por semestre/módulo |
| U5 | Como aluno, quero marcar matérias que já cursei | Toggle por matéria; persiste local |
| U6 | Como aluno, quero ver quantas matérias fiz, quantas faltam e o % do curso | Contadores globais e por semestre, atualizados imediatamente ao marcar |
| U7 | Como aluno, quero usar o app sem internet | Grade e progresso funcionam offline após o primeiro acesso |
| U8 | Como aluno, quero saber se os dados estão atualizados | Data de geração dos dados visível (ex.: "Atualizado em 05/07/2026") |

---

## 4. Funcionalidades (MVP)

### F1 — Onboarding
- Primeira abertura: escolher **curso** → **turma** (dados vindos de `cursos.json`).
- Persistir escolha em localStorage. Trocável depois em Configurações.

### F2 — Grade de aulas
- **Tela "Hoje"** (inicial): aulas do dia em lista cronológica; aula atual/próxima destacada (comparação com hora local). Fora do horário de aula, mostra o próximo dia letivo.
- **Tela "Semana"**: grade dias × horários. No celular, navegação por dia (swipe/tabs); no desktop, semana inteira em grid.
- Cada aula exibe: matéria, sala, professor, horário de início/fim.

### F3 — Matérias e progresso
- Lista de matérias do curso agrupada por semestre.
- Checkbox "concluída" por matéria → localStorage.
- Cabeçalho com: total de matérias, concluídas, faltantes, % (global e por semestre).

### F4 — PWA
- `manifest.webmanifest` (nome, ícones 192/512, theme color, display standalone).
- Service worker (Workbox via `vite-plugin-pwa`): precache do app shell + runtime cache (stale-while-revalidate) dos JSON de dados.
- Banner/hint de instalação discreto na primeira visita.

### F5 — Configurações
- Trocar curso/turma.
- Resetar progresso (com confirmação).
- Exibir `generatedAt` dos dados e link para o EdUpage original.

---

## 5. Fora de escopo (v1)

- Login / sincronização entre dispositivos.
- Notas, faltas, frequência (isso é Q-Acadêmico/SUAP, não EdUpage).
- Notificações push.
- Substituições/alterações diárias de aula (EdUpage "substitutions") — só a grade regular.
- Outros campi do IFMT.
- Pré-requisitos entre matérias e planejamento de matrícula.

---

## 6. Arquitetura

```
Repositório único (GitHub, público)
├── scraper/          # Node + TS + Effect — extrai EdUpage → JSON
├── web/              # Vite + React + TS + Tailwind — PWA
│   └── public/data/  # JSON gerado pelo scraper (commitado)
└── .github/workflows/scrape.yml   # cron semanal + dispatch manual
```

**Fluxo:** GitHub Action (cron semanal, ex. domingo 03:00 BRT, + `workflow_dispatch`) roda o scraper → escreve `web/public/data/*.json` → se houver diff, commita → push dispara deploy automático do Vercel → app serve JSON estático novo. Sem servidor próprio, sem banco.

### 6.1 Scraper (`scraper/`)

- Node 22 + TypeScript, tudo orquestrado com **Effect**: pipeline `fetchRawData → decodeWithSchema → transform → writeJson`, com `Effect.retry` (backoff, máx. 3 tentativas) e erros tipados (`FetchError`, `DecodeError`, `TransformError`).
- **Estratégia de extração (verificar na primeira task de implementação):** o EdUpage expõe os dados da grade via endpoints internos JSON — tipicamente `POST /timetable/server/ttviewer.js?__func=getTTViewerData` (lista de anos letivos/timetables) e `POST /timetable/server/regulartt.js?__func=regularttGetData` (dados completos: turmas, matérias, professores, salas, períodos, cards de aula). Fazer engenharia reversa via DevTools (aba Network ao abrir https://ifmtcba.edupage.org/timetable/) e fixar os payloads exatos no código com comentário explicando o formato.
- **Fallback:** se os endpoints não funcionarem sem sessão, usar Playwright headless dentro do Action (grátis) para abrir a página e interceptar as respostas de rede.
- **Falha nunca corrompe dados:** se qualquer etapa falhar, o JSON anterior permanece intacto (o script só escreve após decode + transform completos) e o Action cria/atualiza uma issue no repo (`actions/github-script`) com o erro.
- Saída determinística (chaves ordenadas) para diffs limpos no git.

### 6.2 Dados estáticos (`web/public/data/`)

- `cursos.json` — índice: lista de cursos, e por curso suas turmas (id, nome, semestre/ano).
- `turmas/<turmaId>.json` — grade da turma: aulas (dia, slot, matéria, sala, professor) + lista de matérias.
- Todo arquivo tem `generatedAt` (ISO 8601) e `schemaVersion`.
- Mapeamento turma → semestre do curso: derivar do nome da turma no EdUpage (ex. "3º SEM ADS"). Onde o nome não permitir derivação, usar `scraper/overrides.json` (curadoria manual versionada) — o scraper aplica overrides por último.

### 6.3 Web app (`web/`)

- **Vite + React 19 + TypeScript + Tailwind CSS 4**, SPA estática. (npm install -D typescript@7Then run `npx tsc` as usual for a new native experience.)
- **Effect no frontend:** camada de dados em `web/src/data/` — carregar JSON com `Effect` + `Schema.decodeUnknown` (mesmos schemas do scraper, compartilhados via pasta `shared/` ou package interno), erros tipados renderizados como estados de UI ("dados indisponíveis, tente online").
- **Estado local:** localStorage com envelope versionado `{ version: 1, turmaId, materiasConcluidas: string[] }`; função de migração quando `version` mudar. IDs de matéria estáveis (id do EdUpage, não índice posicional).
- **Roteamento:** React Router (ou TanStack Router) com 4 rotas: `/` (Hoje), `/semana`, `/materias`, `/config` + tela de onboarding quando não há turma escolhida.
- **PWA:** `vite-plugin-pwa` com Workbox; precache do bundle, runtime cache `StaleWhileRevalidate` para `/data/*.json`.
- Sem Redux/Zustand; estado de servidor não existe (JSON estático), estado de UI com hooks + localStorage.

### 6.4 Hospedagem e CI (tudo grátis)

- **Vercel free (Hobby):** deploy automático do GitHub, HTTPS, domínio `*.vercel.app`. Build command: `npm run build` no `web/`.
- **GitHub Actions free** (repo público = minutos ilimitados): workflow de scrape + workflow de CI (typecheck + testes em PR).

---

## 7. Modelo de dados (schemas com `effect/Schema`)

```ts
// shared/schema.ts — usado por scraper e web
const Materia = Schema.Struct({
  id: Schema.String,            // id estável do EdUpage
  nome: Schema.String,
  nomeCurto: Schema.optional(Schema.String),
  semestre: Schema.optional(Schema.Number), // 1..N; ausente se não derivável
});

const Aula = Schema.Struct({
  diaSemana: Schema.Number,     // 0=segunda .. 5=sábado
  slot: Schema.Number,          // índice do período
  horaInicio: Schema.String,    // "07:00"
  horaFim: Schema.String,       // "07:50"
  materiaId: Schema.String,
  sala: Schema.optional(Schema.String),
  professor: Schema.optional(Schema.String),
});

const Turma = Schema.Struct({
  id: Schema.String,
  nome: Schema.String,          // ex. "3º SEM ADS"
  cursoId: Schema.String,
  materias: Schema.Array(Materia),
  aulas: Schema.Array(Aula),
});

const Curso = Schema.Struct({
  id: Schema.String,
  nome: Schema.String,          // ex. "Análise e Desenvolvimento de Sistemas"
  turmaIds: Schema.Array(Schema.String),
});

const ArquivoDados = Schema.Struct({
  schemaVersion: Schema.Number,
  generatedAt: Schema.String,   // ISO 8601
  // + payload (cursos ou turma)
});

// Local (não vai para JSON estático):
const ProgressoLocal = Schema.Struct({
  version: Schema.Number,
  turmaId: Schema.String,
  materiasConcluidas: Schema.Array(Schema.String), // materiaId[]
});
```

Campos opcionais existem porque o EdUpage é dado real e imperfeito: aulas sem sala ou professor definidos devem renderizar normalmente com "—", nunca quebrar o decode do arquivo inteiro (usar decode tolerante por item com log dos itens descartados).

---

## 8. UX / UI

- **Mobile-first**, tela-alvo 360×800; desktop = layout expandido (semana em grid).
- **Navegação:** bottom tab bar no mobile (Hoje / Semana / Matérias / Config); sidebar ou top nav no desktop.
- **Tela Hoje:** cartões de aula em coluna; cartão da aula atual com destaque visual claro (borda/cor); vazio elegante em dia sem aula ("Sem aulas hoje 🎉 Próxima: segunda 07:00").
- **Tela Semana:** mobile = tabs por dia; desktop = grid completo. Células compactas: sigla da matéria + sala.
- **Tela Matérias:** progresso no topo (barra + números grandes: X feitas · Y faltam · Z%), lista por semestre com checkbox por matéria.
- **Tema:** claro/escuro seguindo `prefers-color-scheme`. Verde institucional do IFMT (#2f9e41, padrão da Rede Federal) como cor primária.
- Acessibilidade básica: contraste AA, alvos de toque ≥ 44 px, navegação por teclado nas listas, `aria-label` nos toggles.

---

## 9. Requisitos não funcionais

1. **Dados desatualizados nunca quebram o app** — sempre renderiza o último JSON válido; `generatedAt` visível; se > 30 dias, aviso discreto "dados podem estar desatualizados".
2. **Falha do scraper é visível e não destrutiva** — JSON anterior preservado; issue automática no GitHub com o erro; workflow marca run como failed.
3. **Performance:** bundle inicial < 300 KB gzip; Lighthouse Performance ≥ 90 e PWA "installable" no build de produção.
4. **Offline:** após primeiro acesso online, todas as 4 telas funcionam sem rede.
5. **Privacidade/LGPD:** nenhum dado do aluno sai do dispositivo; sem analytics de terceiros no v1.
6. **Qualidade de código:** TypeScript estrito (`strict: true`, sem `any`); `tsc --noEmit` zero erros e `vitest run` verde como gate de toda entrega.

---

## 10. Fases de entrega

Cada fase termina com: `npx tsc --noEmit` limpo, `npx vitest run` verde, e o critério de aceite da fase demonstrado.

### Fase 1 — Scraper + dados
- Engenharia reversa dos endpoints do EdUpage (documentar payloads em comentário/README do scraper).
- Pipeline Effect completo; gera `cursos.json` + `turmas/*.json` válidos contra os schemas.
- Workflow `scrape.yml` (cron semanal + dispatch) commitando diffs e abrindo issue em falha.
- **Aceite:** rodar `npm run scrape` localmente produz JSON real do IFMT Cuiabá; testes unitários da transformação com fixture de resposta real gravada.

### Fase 2 — App com grade
- Setup Vite/React/Tailwind; onboarding (curso → turma); telas Hoje e Semana lendo os JSON via camada Effect.
- **Aceite:** com os dados da Fase 1, escolher uma turma real e ver a grade correta comparada manualmente com o EdUpage.

### Fase 3 — Matérias e progresso
- Tela Matérias com checkboxes e contadores; persistência localStorage versionada; tela Config (trocar turma, reset).
- **Aceite:** marcar/desmarcar sobrevive a reload; contadores corretos (teste unitário da função de agregação).

### Fase 4 — PWA + polish
- `vite-plugin-pwa`, manifest, ícones, offline, deploy Vercel.
- **Aceite:** Lighthouse marca instalável; botão Install aparece no Chrome desktop/Android; app abre offline em modo avião após primeiro acesso; Performance ≥ 90.

---

## 11. Riscos e mitigações

| Risco | Prob. | Mitigação |
|---|---|---|
| EdUpage muda formato interno dos endpoints | Média | Decode com `Schema` falha alto e cedo (issue automática, dados antigos preservados); fixture de resposta real nos testes detecta drift; fallback Playwright interceptando rede |
| Endpoints exigirem sessão/token | Média | Fallback Playwright headless no Action (a página pública carrega os dados; interceptar respostas) |
| Nome da turma não permite derivar semestre | Alta | `overrides.json` curado manualmente; matérias sem semestre caem num grupo "Sem semestre definido" — nunca somem |
| Grade regular ≠ realidade (substituições diárias) | Certa | Escopo v1 é grade regular; app deixa claro "grade regular" + link para o EdUpage; substituições = v2 |
| Vercel free mudar limites | Baixa | App é 100% estático — migração trivial para Cloudflare Pages ou GitHub Pages |

---

## 12. Stack — resumo para o agente

| Camada | Tecnologia |
|---|---|
| Linguagem | TypeScript (strict) em tudo |
| Efeitos/dados | **Effect** + `effect/Schema` (scraper e frontend) |
| Frontend | Vite, React 19, Tailwind CSS 4, React Router |
| PWA | `vite-plugin-pwa` (Workbox) |
| Scraper | Node 22 + Effect; fallback Playwright |
| Testes | Vitest (unitário; fixtures reais do EdUpage) |
| CI/CD | GitHub Actions (scrape cron + CI) → Vercel Hobby |
| Persistência do usuário | localStorage versionado (sem backend) |
