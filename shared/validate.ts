import type { ArquivoCursos, ArquivoTurma, Aula, Curso, Materia, Turma } from "./schema"

// Guards leves para o client — mesmas restrições de schema.ts (fonte da verdade),
// sem carregar o runtime do effect no bundle. O scraper continua validando com
// effect/Schema na escrita; aqui é a re-validação de leitura.
// Mantido em sincronia por validate.test.ts (mesmos casos-limite do schema).

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null
const isStr = (v: unknown): v is string => typeof v === "string"
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)
const optStr = (v: unknown): boolean => v === undefined || isStr(v)
const optNum = (v: unknown): boolean => v === undefined || isNum(v)
const isHorario = (v: unknown): v is string => isStr(v) && /^\d{2}:\d{2}$/.test(v)

const isMateria = (v: unknown): v is Materia =>
  isObj(v) && isStr(v.id) && isStr(v.nome) && optStr(v.nomeCurto) && optNum(v.semestre)

const isAula = (v: unknown): v is Aula =>
  isObj(v) &&
  isNum(v.diaSemana) &&
  v.diaSemana >= 0 &&
  v.diaSemana <= 5 &&
  isNum(v.slot) &&
  isHorario(v.horaInicio) &&
  isHorario(v.horaFim) &&
  isStr(v.materiaId) &&
  optStr(v.sala) &&
  optStr(v.professor)

const isTurma = (v: unknown): v is Turma =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.nome) &&
  isStr(v.cursoId) &&
  optNum(v.semestre) &&
  Array.isArray(v.materias) &&
  v.materias.every(isMateria) &&
  Array.isArray(v.aulas) &&
  v.aulas.every(isAula)

const isCurso = (v: unknown): v is Curso =>
  isObj(v) && isStr(v.id) && isStr(v.nome) && Array.isArray(v.turmaIds) && v.turmaIds.every(isStr)

const isEnvelope = (v: Record<string, unknown>): boolean => isNum(v.schemaVersion) && isStr(v.generatedAt)

export const isArquivoCursos = (v: unknown): v is ArquivoCursos =>
  isObj(v) && isEnvelope(v) && Array.isArray(v.cursos) && v.cursos.every(isCurso)

export const isArquivoTurma = (v: unknown): v is ArquivoTurma => isObj(v) && isEnvelope(v) && isTurma(v.turma)
