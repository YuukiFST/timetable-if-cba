import { useMemo, useState } from "react"
import { loadMateriasDoCurso, useQuery } from "../data/api"
import { aulasDoDia, aulasVigentes, diaLetivo, DIAS, DIAS_CURTO } from "../lib/horario"
import { useProgresso } from "../storage"
import { AulaCard, AvisoFonteDados, QueryView, Titulo } from "../components/ui"

export function Semana({ turmaId }: { turmaId: string }) {
  const q = useQuery(
    useMemo(() => loadMateriasDoCurso(turmaId), [turmaId]),
    `materias-${turmaId}`,
  )
  const progresso = useProgresso()
  const [dia, setDia] = useState(() => Math.max(0, Math.min(5, diaLetivo(new Date()))))

  const cursando = useMemo(() => new Set(progresso?.cursando ?? []), [progresso])
  const concluidas = useMemo(() => new Set(progresso?.materiasConcluidas ?? []), [progresso])

  return (
    <QueryView q={q}>
      {({ curso, turmaAtual, turmas, materias, generatedAt }) => {
        const materiaCurta = (id: string) => {
          const m = materias.find((m) => m.id === id)
          return m?.nomeCurto ?? m?.nome ?? id
        }
        const materiaNome = (id: string) => materias.find((m) => m.id === id)?.nome ?? id
        const aulas = aulasVigentes(turmaAtual, turmas, cursando, concluidas)
        const diasComAula = [0, 1, 2, 3, 4, 5].filter((d) => aulas.some((a) => a.diaSemana === d))
        return (
          <div>
            <Titulo sub={curso.nome}>Semana</Titulo>
            <AvisoFonteDados generatedAt={generatedAt} />

            {/* Mobile: tabs por dia */}
            <div className="md:hidden">
              <div role="tablist" aria-label="Dia da semana" className="mb-4 flex gap-1 rounded-2xl bg-surface-2 p-1">
                {diasComAula.map((d) => (
                  <button
                    key={d}
                    role="tab"
                    aria-selected={dia === d}
                    onClick={() => setDia(d)}
                    className={`min-h-11 flex-1 rounded-xl text-sm font-semibold ${
                      dia === d ? "bg-surface text-primary shadow-sm" : "ix-tab text-muted"
                    }`}
                  >
                    {DIAS_CURTO[d]}
                  </button>
                ))}
              </div>
              <ul className="space-y-2.5">
                {aulasDoDia(aulas, dia).map((aula, i) => (
                  <AulaCard key={`${aula.slot}-${aula.materiaId}-${i}`} aula={aula} materia={materiaNome(aula.materiaId)} />
                ))}
                {!aulas.some((a) => a.diaSemana === dia) && (
                  <li className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
                    Sem aulas em {DIAS[dia]}.
                  </li>
                )}
              </ul>
            </div>

            {/* Desktop: grade completa */}
            <div className="hidden gap-3 md:grid" style={{ gridTemplateColumns: `repeat(${diasComAula.length}, 1fr)` }}>
              {diasComAula.map((d) => (
                <section key={d} aria-label={DIAS[d]}>
                  <h2 className="mb-2 text-center text-sm font-bold uppercase tracking-wide text-muted">{DIAS[d]}</h2>
                  <ul className="space-y-2">
                    {aulasDoDia(aulas, d).map((aula, i) => (
                      <li key={`${aula.slot}-${aula.materiaId}-${i}`} className="rounded-xl border border-border bg-surface p-2.5">
                        <p className="text-xs tabular-nums text-muted">
                          {aula.horaInicio}–{aula.horaFim}
                        </p>
                        <p className="mt-0.5 truncate text-sm font-semibold" title={materiaNome(aula.materiaId)}>
                          {materiaCurta(aula.materiaId)}
                        </p>
                        <p className="truncate text-xs text-muted">{aula.sala ?? "—"}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        )
      }}
    </QueryView>
  )
}
