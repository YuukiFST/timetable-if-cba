import { Data, Effect, Schema } from "effect"
import { ArquivoCursos, ArquivoTurma } from "shared/schema"
import { useEffect, useState } from "react"

export class DataError extends Data.TaggedError("DataError")<{ path: string; cause: unknown }> {}

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
export const loadTurma = (turmaId: string) => loadJson(`/data/turmas/${turmaId}.json`, ArquivoTurma)
export const loadTurmas = (ids: ReadonlyArray<string>) =>
  Effect.all(ids.map(loadTurma), { concurrency: 6 })

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
