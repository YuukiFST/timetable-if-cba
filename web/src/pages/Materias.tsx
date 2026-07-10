import { Effect } from "effect"
import { useMemo } from "react"
import { loadCursos, loadTurma, loadTurmas, useQuery, type DataError } from "../data/api"
import { agregarProgresso, materiasDoCurso, porSemestre } from "../lib/horario"
import { toggleMateria, useProgresso } from "../storage"
import { QueryView, Titulo } from "../components/ui"
import type { Curso, Materia } from "shared/schema"

// Matérias do curso inteiro: cursos.json → turmas do curso → união das matérias (F3).
const loadMateriasDoCurso = (turmaId: string): Effect.Effect<{ curso: Curso; materias: Materia[] }, DataError> =>
  Effect.gen(function* () {
    const { turma } = yield* loadTurma(turmaId)
    const { cursos } = yield* loadCursos
    const curso = cursos.find((c) => c.id === turma.cursoId)
    if (!curso) return { curso: { id: turma.cursoId, nome: turma.cursoId, turmaIds: [turmaId] }, materias: [...turma.materias] }
    const turmas = yield* loadTurmas(curso.turmaIds)
    return { curso, materias: materiasDoCurso(turmas.map((t) => t.turma)) }
  })

export function Materias({ turmaId }: { turmaId: string }) {
  const q = useQuery(useMemo(() => loadMateriasDoCurso(turmaId), [turmaId]), `materias-${turmaId}`)
  const progresso = useProgresso()
  const concluidas = useMemo(() => new Set(progresso?.materiasConcluidas ?? []), [progresso])

  return (
    <QueryView q={q}>
      {({ curso, materias }) => {
        const total = agregarProgresso(materias, concluidas)
        return (
          <div>
            <Titulo sub={curso.nome}>Matérias</Titulo>

            <section aria-label="Progresso do curso" className="mb-6 rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-3xl font-bold tabular-nums text-primary">{total.pct}%</p>
                <p className="text-sm text-muted">
                  <strong className="text-foreground">{total.feitas}</strong> feitas ·{" "}
                  <strong className="text-foreground">{total.faltam}</strong> faltam
                </p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={total.pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${total.pct}%` }} />
              </div>
            </section>

            {porSemestre(materias).map(([sem, doSemestre]) => {
              const p = agregarProgresso(doSemestre, concluidas)
              return (
                <section key={sem ?? "sem"} className="mb-6">
                  <h2 className="mb-2 flex items-baseline justify-between text-sm font-bold uppercase tracking-wide text-muted">
                    {sem === null ? "Sem semestre definido" : `${sem}º semestre`}
                    <span className="font-medium normal-case tabular-nums">
                      {p.feitas}/{p.total}
                    </span>
                  </h2>
                  <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
                    {doSemestre.map((m) => {
                      const feita = concluidas.has(m.id)
                      return (
                        <li key={m.id} className="border-b border-border last:border-b-0">
                          <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors active:bg-surface-2">
                            <input
                              type="checkbox"
                              checked={feita}
                              onChange={() => toggleMateria(m.id)}
                              aria-label={`Concluí ${m.nome}`}
                              className="size-5 shrink-0 accent-(--primary)"
                            />
                            <span className={feita ? "text-muted line-through" : ""}>{m.nome}</span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })}
          </div>
        )
      }}
    </QueryView>
  )
}
