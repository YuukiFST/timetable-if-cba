import { Data, Effect, Either, Schema } from "effect"
import { ArquivoCursos, ArquivoTurma, type Curso, type Materia, type Turma } from "shared/schema"
import { useEffect, useState } from "react"
import { materiasDoCurso } from "../lib/horario"

export class DataError extends Data.TaggedError("DataError")<{ path: string; cause: unknown }> {}

/** Whitelist de IDs de turma (mesmo padrão dos arquivos em public/data/turmas/). */
export const TURMA_ID = /^t[A-Za-z0-9_-]+$/

export const isTurmaIdValid = (turmaId: string): boolean => TURMA_ID.test(turmaId)

const loadJson = <A, I>(path: string, schema: Schema.Schema<A, I>): Effect.Effect<A, DataError> =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(path)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as unknown
    },
    catch: (cause) => new DataError({ path, cause }),
  }).pipe(
    Effect.flatMap((json) =>
      Schema.decodeUnknown(schema)(json).pipe(Effect.mapError((cause) => new DataError({ path, cause }))),
    ),
  )

export const loadCursos = loadJson("/data/cursos.json", ArquivoCursos)
export const loadTurma = (turmaId: string): Effect.Effect<ArquivoTurma, DataError> =>
  isTurmaIdValid(turmaId)
    ? loadJson(`/data/turmas/${turmaId}.json`, ArquivoTurma)
    : Effect.fail(new DataError({ path: turmaId, cause: new Error("turmaId inválido") }))
export const loadTurmas = (ids: ReadonlyArray<string>): Effect.Effect<ArquivoTurma[], DataError> =>
  Effect.all(
    ids.map((id) => loadTurma(id).pipe(Effect.either)),
    { concurrency: 6 },
  ).pipe(Effect.map((results) => results.flatMap((r) => (Either.isRight(r) ? [r.right] : []))))

export interface MateriasDoCurso {
  curso: Curso
  materias: Materia[]
  turmaAtual: Turma
  turmas: Turma[]
  generatedAt: string
}

// Matérias do curso inteiro: cursos.json → turmas do curso → união das matérias (F3).
export const loadMateriasDoCurso = (turmaId: string): Effect.Effect<MateriasDoCurso, DataError> =>
  Effect.gen(function* () {
    const arquivo = yield* loadTurma(turmaId)
    const { turma } = arquivo
    const { cursos } = yield* loadCursos
    const curso = cursos.find((c) => c.id === turma.cursoId)
    if (!curso)
      return {
        curso: { id: turma.cursoId, nome: turma.cursoId, turmaIds: [turmaId] },
        materias: [...turma.materias],
        turmaAtual: turma,
        turmas: [turma],
        generatedAt: arquivo.generatedAt,
      }
    const carregadas = (yield* loadTurmas(curso.turmaIds)).map((t) => t.turma)
    const turmas = carregadas.some((t) => t.id === turma.id) ? carregadas : [turma, ...carregadas]
    return { curso, materias: materiasDoCurso(turmas), turmaAtual: turma, turmas, generatedAt: arquivo.generatedAt }
  })

export type Query<A> = { status: "loading" } | { status: "error"; error: DataError } | { status: "ok"; value: A }

// Estado de servidor não existe (JSON estático): um hook simples cobre tudo (PRD §6.3).
// Invariante: `key` é a identidade da query — deve mudar sempre que o significado do
// effect mudar. O effect fica fora das deps de propósito: chamadores criam um objeto
// novo por render (loadTurma(id)) e depender dele causaria refetch infinito.
export function useQuery<A>(effect: Effect.Effect<A, DataError>, key: string): Query<A> {
  const [state, setState] = useState<Query<A>>({ status: "loading" })
  useEffect(() => {
    let alive = true
    setState({ status: "loading" })
    Effect.runPromiseExit(effect).then((exit) => {
      if (!alive) return
      if (exit._tag === "Success") setState({ status: "ok", value: exit.value })
      else {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : new DataError({ path: key, cause: exit.cause })
        setState({ status: "error", error })
      }
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return state
}
