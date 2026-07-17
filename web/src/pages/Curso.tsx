import { useMemo, useState } from "react"
import { loadMateriasDoCurso, useQuery } from "../data/api"
import { agregarProgresso, diaInicialPorMateria, DIAS_CURTO, detectarChoques, fmtHorarioMateria, ofertasPorMateria, porSemestre, type ChoqueInfo } from "../lib/horario"
import { escolherTurma, toggleMateria, useProgresso } from "../storage"
import { EscolhaCurso } from "./Onboarding"
import { AvisoFonteDados, QueryView, Titulo } from "../components/ui"

const fmtAula = (a: { diaSemana: number; horaInicio: string; horaFim: string }) =>
  `${DIAS_CURTO[a.diaSemana]} ${a.horaInicio}–${a.horaFim}`

function ChoqueDetalhes({ info }: { info: ChoqueInfo[] }) {
  return (
    <details className="px-4 pb-2.5 -mt-1 text-sm">
      <summary className="ix-summary cursor-pointer text-warning marker:text-warning">Ver choques por turma</summary>
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

export function Curso({ turmaId }: { turmaId: string }) {
  const q = useQuery(() => loadMateriasDoCurso(turmaId), `materias-${turmaId}`)
  const progresso = useProgresso()
  const [trocando, setTrocando] = useState(false)
  const concluidas = useMemo(() => new Set(progresso?.materiasConcluidas ?? []), [progresso])
  const cursoIdAtual = q.status === "ok" ? q.value.turmaAtual.cursoId : null

  if (trocando)
    return (
      <EscolhaCurso
        titulo="Trocar de curso"
        onPick={(turmaId, cursoId) => {
          escolherTurma(turmaId, cursoId, cursoIdAtual)
          setTrocando(false)
        }}
      />
    )

  return (
    <QueryView q={q} onReescolher={() => setTrocando(true)}>
      {({ curso, materias, turmaAtual, turmas, generatedAt }) => {
        const total = agregarProgresso(materias, concluidas)
        const choques = detectarChoques(turmaAtual, turmas, concluidas)
        const dia = diaInicialPorMateria(turmas)
        const ofertas = ofertasPorMateria(turmaAtual, turmas)
        return (
          <div>
            <Titulo sub={curso.nome}>Curso</Titulo>

            <button
              type="button"
              onClick={() => setTrocando(true)}
              className="ix-ghost mb-4 min-h-11 rounded-lg px-2 text-sm font-medium text-primary"
            >
              Trocar curso
            </button>

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

            <AvisoFonteDados generatedAt={generatedAt} />

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
                    {/* ordem por dia de aula (seg→sáb); sort estável mantém empates e sem-aula no fim */}
                    {[...doSemestre]
                      .sort((a, b) => (dia.get(a.id) ?? 99) - (dia.get(b.id) ?? 99))
                      .map((m) => {
                      const feita = concluidas.has(m.id)
                      const info = choques.get(m.id)
                      const temChoque = !feita && !!info?.some((c) => c.conflitos.length > 0)
                      const horario = fmtHorarioMateria(ofertas.get(m.id)?.blocos ?? [])
                      return (
                        <li key={m.id} className="border-b border-border last:border-b-0">
                          <div className="flex min-h-12 items-center gap-2 px-4 py-2.5">
                            <div className="min-w-0 flex-1">
                              <p className={`truncate ${feita ? "text-muted line-through" : "font-medium"}`}>{m.nome}</p>
                              <p className="mt-0.5 truncate text-sm tabular-nums text-muted">
                                {horario ?? "Sem horário definido"}
                              </p>
                            </div>
                            {temChoque && (
                              <span className="shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                                Choque
                              </span>
                            )}
                            <div className="ml-auto shrink-0">
                              <button
                                type="button"
                                aria-pressed={feita}
                                onClick={() => toggleMateria(m.id)}
                                className={`min-h-9 rounded-lg px-2.5 text-xs font-semibold active:scale-[0.97] ${
                                  feita ? "ix-btn bg-primary text-on-primary" : "ix-pill bg-surface-2 text-muted"
                                }`}
                              >
                                Feita
                              </button>
                            </div>
                          </div>
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
