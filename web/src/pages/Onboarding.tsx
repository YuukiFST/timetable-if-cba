import { useState } from "react"
import type { Curso } from "shared/schema"
import { loadCursos, loadTurma, useQuery } from "../data/api"
import { escolherTurma } from "../storage"
import { QueryView } from "../components/ui"

/** Escolha curso → turma (F1). Também usada pela tela Config para trocar de turma. */
export function EscolhaTurma({ titulo, onDone }: { titulo: string; onDone?: () => void }) {
  const q = useQuery(loadCursos, "cursos")
  const [curso, setCurso] = useState<Curso | null>(null)

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Horários IFMT Cuiabá</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{titulo}</h1>
        <p className="mt-1 text-sm text-muted">
          {curso ? `Turmas de ${curso.nome}` : "Escolha seu curso. Dá para trocar depois em Config."}
        </p>
      </header>
      <QueryView q={q}>
        {(dados) =>
          curso === null ? (
            <ul className="space-y-2">
              {/* cursos com mais turmas primeiro: joga pseudo-cursos (dependências etc.) para o fim */}
              {[...dados.cursos].sort((a, b) => b.turmaIds.length - a.turmaIds.length || a.nome.localeCompare(b.nome)).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setCurso(c)}
                    className="min-h-14 w-full rounded-2xl border border-border bg-surface p-4 text-left font-medium transition-transform duration-100 active:scale-[0.98]"
                  >
                    {c.nome}
                    <span className="mt-0.5 block text-sm font-normal text-muted">
                      {c.turmaIds.length} {c.turmaIds.length === 1 ? "turma" : "turmas"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <button type="button" onClick={() => setCurso(null)} className="mb-3 min-h-11 text-sm font-medium text-primary">
                ← Outro curso
              </button>
              <ul className="space-y-2">
                {curso.turmaIds.map((id) => (
                  <TurmaButton
                    key={id}
                    turmaId={id}
                    onPick={() => {
                      escolherTurma(id)
                      onDone?.()
                    }}
                  />
                ))}
              </ul>
            </>
          )
        }
      </QueryView>
    </div>
  )
}

function TurmaButton({ turmaId, onPick }: { turmaId: string; onPick: () => void }) {
  const q = useQuery(loadTurma(turmaId), turmaId)
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="min-h-14 w-full rounded-2xl border border-border bg-surface p-4 text-left font-medium transition-transform duration-100 active:scale-[0.98]"
      >
        {q.status === "ok" ? q.value.turma.nome : "…"}
        {q.status === "ok" && q.value.turma.semestre !== undefined && (
          <span className="mt-0.5 block text-sm font-normal text-muted">{q.value.turma.semestre}º semestre</span>
        )}
      </button>
    </li>
  )
}

export function Onboarding() {
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-8">
      <EscolhaTurma titulo="Qual é a sua turma?" />
    </div>
  )
}
