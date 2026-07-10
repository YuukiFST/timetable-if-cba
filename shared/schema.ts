import { Schema } from "effect"

// Schemas do PRD §7 — fonte única para scraper e web.

export const Materia = Schema.Struct({
  id: Schema.String, // id estável do EdUpage
  nome: Schema.String,
  nomeCurto: Schema.optional(Schema.String),
  semestre: Schema.optional(Schema.Number), // 1..N; ausente se não derivável
})
export type Materia = typeof Materia.Type

export const Aula = Schema.Struct({
  diaSemana: Schema.Number, // 0=segunda .. 5=sábado
  slot: Schema.Number, // índice do período
  horaInicio: Schema.String, // "07:00"
  horaFim: Schema.String, // "07:50"
  materiaId: Schema.String,
  sala: Schema.optional(Schema.String),
  professor: Schema.optional(Schema.String),
})
export type Aula = typeof Aula.Type

export const Turma = Schema.Struct({
  id: Schema.String,
  nome: Schema.String, // ex. "3º SEM ADS"
  cursoId: Schema.String,
  semestre: Schema.optional(Schema.Number),
  materias: Schema.Array(Materia),
  aulas: Schema.Array(Aula),
})
export type Turma = typeof Turma.Type

export const Curso = Schema.Struct({
  id: Schema.String,
  nome: Schema.String, // ex. "Análise e Desenvolvimento de Sistemas"
  turmaIds: Schema.Array(Schema.String),
})
export type Curso = typeof Curso.Type

const Envelope = Schema.Struct({
  schemaVersion: Schema.Number,
  generatedAt: Schema.String, // ISO 8601
})

export const ArquivoCursos = Schema.Struct({
  ...Envelope.fields,
  cursos: Schema.Array(Curso),
})
export type ArquivoCursos = typeof ArquivoCursos.Type

export const ArquivoTurma = Schema.Struct({
  ...Envelope.fields,
  turma: Turma,
})
export type ArquivoTurma = typeof ArquivoTurma.Type

// Local (localStorage, não vai para JSON estático):
export const ProgressoLocal = Schema.Struct({
  version: Schema.Number,
  turmaId: Schema.String,
  materiasConcluidas: Schema.Array(Schema.String), // materiaId[]
})
export type ProgressoLocal = typeof ProgressoLocal.Type

export const SCHEMA_VERSION = 1
