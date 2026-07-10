import { Effect } from "effect"
import { useMemo } from "react"
import { loadCursos, loadTurma, loadTurmas, useQuery, type DataError } from "../data/api"
import { agregarProgresso, DIAS_CURTO, detectarChoques, materiasDoCurso, porSemestre, type ChoqueInfo } from "../lib/horario"
import { toggleMateria, useProgresso } from "../storage"
import { QueryView, Titulo } from "../components/ui"
import type { Curso, Materia, Turma } from "shared/schema"

interface MateriasDoCurso {
  curso: Curso
  materias: Materia[]
  turmaAtual: Turma
  turmas: Turma[]
}

// Matérias do curso inteiro: cursos.json → turmas do curso → união das matérias (F3).
const loadMateriasDoCurso = (turmaId: string): Effect.Effect<MateriasDoCurso, DataError> =>
  Effect.gen(function* () {
    const { turma } = yield* loadTurma(turmaId)
    const { cursos } = yield* loadCursos
    const curso = cursos.find((c) => c.id === turma.cursoId)
    if (!curso)
      return { curso: { id: turma.cursoId, nome: turma.cursoId, turmaIds: [turmaId] }, materias: [...turma.materias], turmaAtual: turma, turmas: [turma] }
    const turmas = (yield* loadTurmas(curso.turmaIds)).map((t) => t.turma)
    return { curso, materias: materiasDoCurso(turmas), turmaAtual: turma, turmas }
  })

const fmtAula = (a: { diaSemana: number; horaInicio: string; horaFim: string }) =>
  `${DIAS_CURTO[a.diaSemana]} ${a.horaInicio}–${a.horaFim}`

function ChoqueDetalhes({ info }: { info: ChoqueInfo[] }) {
  return (
    <details className="px-4 pb-2.5 -mt-1 text-sm">
      <summary className="cursor-pointer text-warning marker:text-warning">Ver choques por turma</summary>
      <ul className="mt-1.5 space-y-1.5 text-muted">
        {info.map((c) => (
          <li key={c.turma.id}>
            <span className="font-medium text-foreground">{c.turma.nome}</span>
            {c.conflitos.length === 0 ? (
              <span> — sem choque com sua grade</span>
            ) : (
              <ul className="mt-0.5 ml-3 list-disc space-y-0.5">
                {c.conflitos.map((cf, i) => (
                  <li key={i}>
                    {fmtAula(cf.aula)} choca com {cf.materiaContraNome} ({fmtAula(cf.contra)})
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}

export function Materias({ turmaId }: { turmaId: string }) {
  const q = useQuery(useMemo(() => loadMateriasDoCurso(turmaId), [turmaId]), `materias-${turmaId}`)
  const progresso = useProgresso()
  const concluidas = useMemo(() => new Set(progresso?.materiasConcluidas ?? []), [progresso])

  return (
    <QueryView q={q}>
      {({ curso, materias, turmaAtual, turmas }) => {
        const total = agregarProgresso(materias, concluidas)
        const choques = detectarChoques(turmaAtual, turmas)
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
                      const info = choques.get(m.id)
                      const temChoque = !feita && !!info?.some((c) => c.conflitos.length > 0)
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
                            {temChoque && (
                              <span className="ml-auto shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                                Choque
                              </span>
                            )}
                          </label>
                          {temChoque && info && <ChoqueDetalhes info={info} />}
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
