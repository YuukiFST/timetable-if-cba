# Horário por matéria + aviso EdUpage

## Objetivo

Na tela Curso, mostrar dia e horário de cada matéria (`Seg 18:50–22:25`). Em telas com horários (Curso, Hoje, Semana, Planejar), avisar que os dados vêm do EdUpage e erros são da fonte institucional.

## Horário na lista (Curso)

- Subtítulo `text-sm text-muted` abaixo do nome
- Fonte: primeiro bloco mesclado de `ofertasPorMateria(turmas)` por `materiaId`
- Sem aula: `Sem horário definido`
- Helper: `fmtHorarioMateria(blocos: Aula[]): string | null` em `horario.ts`

## Aviso de fonte

- Componente `AvisoFonteDados` em `ui.tsx`
- `variant="compacto"`: Curso, Hoje, Semana, Planejar
- `variant="completo"`: Config (substitui bloco duplicado)
- Props: `generatedAt: string` (ISO), opcional `desatualizado` em Config
- `generatedAt` exposto em `MateriasDoCurso` via `loadMateriasDoCurso`

## Posição

- Curso: entre progresso e lista de semestres
- Hoje / Semana / Planejar: abaixo de `Titulo`

## Fora de escopo

- Onboarding, mudança de ordenação, dismiss do aviso
