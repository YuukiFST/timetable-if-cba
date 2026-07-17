import { Data, Either, Schema } from "effect"
import type { Aula, Curso, Materia, Turma } from "shared/schema"
import { timeToMin } from "shared/tempo"
import {
  RawCard,
  RawClass,
  RawClassroom,
  RawLesson,
  RawPeriod,
  RawSubject,
  RawTeacher,
  type RawTables,
} from "./edupage.js"

export class TransformError extends Data.TaggedError("TransformError")<{ message: string }> {}

export interface Overrides {
  readonly [turmaNome: string]: { readonly cursoNome?: string; readonly semestre?: number }
}

export interface TransformResult {
  readonly cursos: ReadonlyArray<Curso>
  readonly turmas: ReadonlyArray<Turma>
  readonly discarded: ReadonlyArray<string> // logs de itens crus inválidos
}

// Decode tolerante: item inválido é descartado com log, nunca derruba o arquivo (PRD §7).
const decodeRows = <A, I>(schema: Schema.Schema<A, I>, rows: ReadonlyArray<unknown>, table: string, discarded: string[]): A[] => {
  const out: A[] = []
  for (const row of rows) {
    const r = Schema.decodeUnknownEither(schema)(row)
    if (Either.isRight(r)) out.push(r.right)
    else discarded.push(`${table}: ${JSON.stringify(row).slice(0, 120)}`)
  }
  return out
}

// IDs do EdUpage têm "*" / "-" ("*15", "-534"); para nome de arquivo e rota, só [A-Za-z0-9_-].
export const safeId = (id: string): string => "t" + id.replace(/[^A-Za-z0-9_-]/g, "")

const slug = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

// Nomes de turma reais do EdUpage (fixture 2026-07):
//   "DCOM 7131.2A Inform. Integ."        → curso "DCOM 7131 Inform. Integ.", semestre 2
//   "DEEA Eng. Elétrica 3º Sem"          → curso "DEEA Eng. Elétrica", semestre 3
//   "DABC - Licenc. em Educ. Fís. - 5o SEM." → curso "DABC - Licenc. em Educ. Fís.", semestre 5
//   sem padrão → curso = nome inteiro, semestre indefinido (overrides.json corrige)
export const parseTurmaNome = (nome: string): { cursoNome: string; semestre?: number } => {
  const n = nome.replace(/\s+/g, " ").trim()
  const code = n.match(/^(\S+) (\d+)\.(\d+)[A-Z]*I? (.+)$/)
  if (code) return { cursoNome: `${code[1]} ${code[2]} ${code[4]}`.trim(), semestre: Number(code[3]) }
  const sem = n.match(/^(.*?)[- ]*(\d+)\s*[ºo°]?\s*SEM\.?$/i)
  if (sem && sem[1]) return { cursoNome: sem[1].replace(/[- ]+$/, "").trim(), semestre: Number(sem[2]) }
  return { cursoNome: n }
}


export const transform = (raw: RawTables, overrides: Overrides): TransformResult => {
  const discarded: string[] = []
  const table = (id: string) => raw.tables.find((t) => t.id === id)?.data_rows ?? []

  const classes = decodeRows(RawClass, table("classes"), "classes", discarded)
  const subjects = new Map(decodeRows(RawSubject, table("subjects"), "subjects", discarded).map((s) => [s.id, s]))
  const teachers = new Map(decodeRows(RawTeacher, table("teachers"), "teachers", discarded).map((t) => [t.id, t]))
  const classrooms = new Map(decodeRows(RawClassroom, table("classrooms"), "classrooms", discarded).map((c) => [c.id, c]))
  const periods = decodeRows(RawPeriod, table("periods"), "periods", discarded).sort(
    (a, b) => Number(a.period) - Number(b.period),
  )
  const lessons = new Map(decodeRows(RawLesson, table("lessons"), "lessons", discarded).map((l) => [l.id, l]))
  const cards = decodeRows(RawCard, table("cards"), "cards", discarded)

  if (classes.length === 0 || cards.length === 0)
    throw new TransformError({ message: `dados insuficientes: ${classes.length} classes, ${cards.length} cards` })

  const periodIndex = new Map(periods.map((p, i) => [p.id, i]))

  // aulas por classe
  const aulasPorClasse = new Map<string, Aula[]>()
  for (const card of cards) {
    const lesson = lessons.get(card.lessonid)
    if (!lesson) {
      discarded.push(`cards: lessonid ${card.lessonid} inexistente`)
      continue
    }
    const startIdx = periodIndex.get(card.period)
    const start = startIdx === undefined ? undefined : periods[startIdx]
    if (!start || startIdx === undefined) {
      discarded.push(`cards: period ${card.period} inexistente`)
      continue
    }
    const endIdx = startIdx + lesson.durationperiods - 1
    if (endIdx > periods.length - 1)
      discarded.push(`cards: duração ${lesson.durationperiods} estoura os períodos (lesson ${card.lessonid}); horaFim truncada`)
    const end = periods[Math.min(endIdx, periods.length - 1)] ?? start
    const sala = card.classroomids[0] !== undefined ? classrooms.get(card.classroomids[0])?.short.split(" - ")[0] : undefined
    const professor =
      lesson.teacherids.map((id) => teachers.get(id)?.short).filter(Boolean).join(", ") || undefined
    for (let dia = 0; dia < card.days.length; dia++) {
      if (card.days[dia] !== "1") continue
      for (const classId of lesson.classids) {
        const aula: Aula = {
          diaSemana: dia,
          slot: startIdx,
          horaInicio: start.starttime,
          horaFim: end.endtime,
          materiaId: lesson.subjectid,
          ...(sala !== undefined ? { sala } : {}),
          ...(professor !== undefined ? { professor } : {}),
        }
        const list = aulasPorClasse.get(classId) ?? []
        list.push(aula)
        aulasPorClasse.set(classId, list)
      }
    }
  }

  // turmas (só classes com aula) + cursos derivados do nome, overrides por último
  const turmas: Turma[] = []
  const cursos = new Map<string, { nome: string; turmaIds: string[] }>()
  for (const cls of classes) {
    const aulas = aulasPorClasse.get(cls.id)
    if (!aulas || aulas.length === 0) continue
    const parsed = parseTurmaNome(cls.name)
    const ov = overrides[cls.name]
    const cursoNome = ov?.cursoNome ?? parsed.cursoNome
    const semestre = ov?.semestre ?? parsed.semestre
    const cursoId = slug(cursoNome)
    const turmaId = safeId(cls.id)

    const materiaIds = [...new Set(aulas.map((a) => a.materiaId))]
    const materias: Materia[] = materiaIds.flatMap((id) => {
      const s = subjects.get(id)
      if (!s) {
        discarded.push(`subjects: id ${id} referenciado por aula mas inexistente`)
        return []
      }
      return [{ id: s.id, nome: s.name, nomeCurto: s.short, ...(semestre !== undefined ? { semestre } : {}) }]
    })

    aulas.sort((a, b) => a.diaSemana - b.diaSemana || timeToMin(a.horaInicio) - timeToMin(b.horaInicio) || a.materiaId.localeCompare(b.materiaId))
    materias.sort((a, b) => a.nome.localeCompare(b.nome))

    turmas.push({
      id: turmaId,
      nome: cls.name.replace(/\s+/g, " ").trim(),
      cursoId,
      ...(semestre !== undefined ? { semestre } : {}),
      materias,
      aulas,
    })
    const curso = cursos.get(cursoId) ?? { nome: cursoNome, turmaIds: [] }
    curso.turmaIds.push(turmaId)
    cursos.set(cursoId, curso)
  }

  // safeId achata "*15"/"15" no mesmo "t15": colisão corromperia arquivos — falhar alto
  const ids = new Set<string>()
  for (const t of turmas) {
    if (ids.has(t.id)) throw new TransformError({ message: `id de turma duplicado após safeId: ${t.id}` })
    ids.add(t.id)
  }

  turmas.sort((a, b) => a.nome.localeCompare(b.nome))
  const cursosArr: Curso[] = [...cursos.entries()]
    .map(([id, c]) => ({ id, nome: c.nome, turmaIds: [...c.turmaIds].sort() }))
    .sort((a, b) => a.nome.localeCompare(b.nome))

  return { cursos: cursosArr, turmas, discarded }
}
