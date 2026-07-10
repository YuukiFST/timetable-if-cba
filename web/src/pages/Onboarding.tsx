import { useState } from "react"
import type { Curso } from "shared/schema"
import { loadCursos, loadMateriasDoCurso, loadTurma, useQuery } from "../data/api"
import { agregarProgresso, porSemestre } from "../lib/horario"
import { iniciarProgresso } from "../storage"
import { QueryView } from "../components/ui"

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()

/** Escolha curso → turma (F1). Também usada pela tela Config para trocar de turma. */
export function EscolhaTurma({ titulo, onPick }: { titulo: string; onPick: (turmaId: string) => void }) {
  const q = useQuery(loadCursos, "cursos")
  const [curso, setCurso] = useState<Curso | null>(null)
  const [busca, setBusca] = useState("")

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
            (() => {
              const filtrados = [...dados.cursos]
                .filter((c) => norm(c.nome).includes(norm(busca)))
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
                  )}
                </>
              )
            })()
          ) : (
            <>
              <button type="button" onClick={() => setCurso(null)} className="mb-3 min-h-11 text-sm font-medium text-primary">
                ← Outro curso
              </button>
              <ul className="space-y-2">
                {curso.turmaIds.map((id) => (
                  <TurmaButton key={id} turmaId={id} onPick={() => onPick(id)} />
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

/** Passo do onboarding: marcar matérias já feitas (progresso é arbitrário — sem atalho por semestre). */
function MarcarConcluidas({ turmaId }: { turmaId: string }) {
  const q = useQuery(loadMateriasDoCurso(turmaId), `materias-${turmaId}`)
  const [feitas, setFeitas] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setFeitas((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <QueryView q={q}>
      {({ materias }) => {
        const p = agregarProgresso(materias, feitas)
        return (
          <div className="pb-28">
            <header className="mb-6">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">Horários IFMT Cuiabá</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight">O que você já fez?</h1>
              <p className="mt-1 text-sm text-muted">Marque as matérias já concluídas. Dá para ajustar depois em Matérias.</p>
            </header>

            {porSemestre(materias).map(([sem, doSemestre]) => (
              <section key={sem ?? "sem"} className="mb-6">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
                  {sem === null ? "Sem semestre definido" : `${sem}º semestre`}
                </h2>
                <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
                  {doSemestre.map((m) => {
                    const feita = feitas.has(m.id)
                    return (
                      <li key={m.id} className="border-b border-border last:border-b-0">
                        <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors active:bg-surface-2">
                          <input
                            type="checkbox"
                            checked={feita}
                            onChange={() => toggle(m.id)}
                            aria-label={`Já fiz ${m.nome}`}
                            className="size-5 shrink-0 accent-(--primary)"
                          />
                          <span className={feita ? "text-muted line-through" : ""}>{m.nome}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}

            <div className="glass fixed inset-x-0 bottom-0 z-10 border-t border-border safe-bottom">
              <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
                <p className="flex-1 text-sm text-muted">
                  <strong className="text-foreground">{p.feitas}</strong> marcadas
                </p>
                <button
                  type="button"
                  onClick={() => iniciarProgresso(turmaId, [])}
                  className="min-h-11 px-3 text-sm font-medium text-muted active:text-foreground"
                >
                  Pular por agora
                </button>
                <button
                  type="button"
                  onClick={() => iniciarProgresso(turmaId, [...feitas])}
                  className="min-h-11 rounded-xl bg-primary px-5 font-semibold text-on-primary transition-transform active:scale-[0.97]"
                >
                  Concluir
                </button>
              </div>
            </div>
          </div>
        )
      }}
    </QueryView>
  )
}

export function Onboarding() {
  const [turmaEscolhida, setTurmaEscolhida] = useState<string | null>(null)
  return (
    <div className="mx-auto min-h-dvh max-w-3xl px-4 py-8">
      {turmaEscolhida === null ? (
        <EscolhaTurma titulo="Qual é a sua turma?" onPick={setTurmaEscolhida} />
      ) : (
        <MarcarConcluidas turmaId={turmaEscolhida} />
      )}
    </div>
  )
}
