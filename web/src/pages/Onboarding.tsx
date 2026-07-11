import { useState } from "react"
import type { Curso } from "shared/schema"
import { loadCursos, loadTurmas, useQuery } from "../data/api"
import { iniciarProgresso } from "../storage"
import { QueryView } from "../components/ui"

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

/** Escolha do curso (F1). Também usada pela aba Curso e por Config para trocar de curso. */
export function EscolhaCurso({
  titulo,
  onPick,
}: {
  titulo: string
  onPick: (turmaId: string, cursoId: string) => void
}) {
  const q = useQuery(loadCursos, "cursos")
  const [busca, setBusca] = useState("")
  const [cursoSelecionado, setCursoSelecionado] = useState<Curso | null>(null)
  const turmasQ = useQuery(
    cursoSelecionado ? loadTurmas(cursoSelecionado.turmaIds) : loadTurmas([]),
    cursoSelecionado ? `turmas-${cursoSelecionado.id}` : "turmas-none",
  )

  const escolherCurso = (c: Curso) => {
    if (c.turmaIds.length === 1) {
      const id = c.turmaIds[0]
      if (id) onPick(id, c.id)
      return
    }
    setCursoSelecionado(c)
  }

  if (cursoSelecionado)
    return (
      <div>
        <header className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Trilha IF CBA</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Qual turma?</h1>
          <p className="mt-1 text-sm text-muted">
            {cursoSelecionado.nome} — escolha sua turma/semestre. Dá para trocar depois em Config.
          </p>
        </header>
        <button
          type="button"
          onClick={() => setCursoSelecionado(null)}
          className="ix-ghost mb-4 min-h-11 rounded-lg px-2 text-sm font-medium text-primary"
        >
          ← Voltar
        </button>
        <QueryView q={turmasQ}>
          {(arquivos) => (
            <ul className="space-y-2">
              {[...arquivos]
                .sort((a, b) => (a.turma.semestre ?? 99) - (b.turma.semestre ?? 99) || a.turma.nome.localeCompare(b.turma.nome))
                .map(({ turma }) => (
                  <li key={turma.id}>
                    <button
                      type="button"
                      onClick={() => onPick(turma.id, cursoSelecionado.id)}
                      className="ix-card min-h-14 w-full rounded-2xl border border-border bg-surface p-4 text-left font-medium active:scale-[0.98]"
                    >
                      {turma.nome}
                      {turma.semestre !== undefined && (
                        <span className="ml-2 text-sm font-normal text-muted">{turma.semestre}º sem</span>
                      )}
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </QueryView>
      </div>
    )

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Trilha IF CBA</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{titulo}</h1>
        <p className="mt-1 text-sm text-muted">Escolha seu curso. Dá para trocar depois em Config.</p>
      </header>
      <QueryView q={q}>
        {(dados) => {
          const filtrados = [...dados.cursos]
            .filter((c) => c.turmaIds.length > 0 && norm(c.nome).includes(norm(busca)))
            // cursos com mais turmas primeiro: joga pseudo-cursos (dependências etc.) para o fim
            .sort((a, b) => b.turmaIds.length - a.turmaIds.length || a.nome.localeCompare(b.nome))
          return (
            <>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar curso…"
                aria-label="Buscar curso"
                className="mb-3 min-h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base outline-none focus:border-primary"
              />
              {filtrados.length === 0 ? (
                <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
                  Nenhum curso encontrado.
                </p>
              ) : (
                <ul className="space-y-2">
                  {filtrados.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => escolherCurso(c)}
                        className="ix-card min-h-14 w-full rounded-2xl border border-border bg-surface p-4 text-left font-medium active:scale-[0.98]"
                      >
                        {c.nome}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )
        }}
      </QueryView>
    </div>
  )
}

export function Onboarding() {
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-8">
      <EscolhaCurso titulo="Qual curso você faz?" onPick={(turmaId) => iniciarProgresso(turmaId, [])} />
    </div>
  )
}
