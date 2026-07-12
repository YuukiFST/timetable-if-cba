import { useMemo, useState } from "react"
import { loadMateriasDoCurso, useQuery } from "../data/api"
import { escolherTurma, resetProgresso } from "../storage"
import { EscolhaCurso } from "./Onboarding"
import { AvisoFonteDados, ErroDados, QueryView, Titulo } from "../components/ui"

export function Config({ turmaId }: { turmaId: string }) {
  const q = useQuery(useMemo(() => loadMateriasDoCurso(turmaId), [turmaId]), `materias-${turmaId}`)
  const [trocando, setTrocando] = useState(false)
  const [confirmandoReset, setConfirmandoReset] = useState(false)
  const cursoIdAtual = q.status === "ok" ? q.value.curso.id : null

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

  if (q.status === "error")
    return (
      <div>
        <Titulo>Configurações</Titulo>
        <ErroDados error={q.error} onReescolher={() => setTrocando(true)} />
        <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
          <button
            type="button"
            onClick={() => setTrocando(true)}
            className="ix-row min-h-12 w-full px-4 py-3 text-left font-medium text-primary active:bg-surface-2"
          >
            Trocar curso
          </button>
        </section>
      </div>
    )

  return (
    <QueryView q={q}>
      {({ curso, generatedAt }) => (
        <div>
          <Titulo>Configurações</Titulo>

          <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm text-muted">Curso atual</p>
              <p className="font-semibold">{curso.nome}</p>
            </div>
            <button
              type="button"
              onClick={() => setTrocando(true)}
              className="ix-row min-h-12 w-full px-4 py-3 text-left font-medium text-primary active:bg-surface-2"
            >
              Trocar curso
            </button>
          </section>

          <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
            {confirmandoReset ? (
              <div className="px-4 py-3">
                <p className="font-medium">Apagar todas as matérias marcadas?</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetProgresso()
                      setConfirmandoReset(false)
                    }}
                    className="ix-btn min-h-11 rounded-xl bg-danger px-4 font-semibold text-white active:scale-[0.97]"
                  >
                    Apagar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoReset(false)}
                    className="ix-btn min-h-11 rounded-xl bg-surface-2 px-4 font-semibold active:scale-[0.97]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoReset(true)}
                className="ix-row min-h-12 w-full px-4 py-3 text-left font-medium text-danger active:bg-surface-2"
              >
                Resetar progresso das matérias
              </button>
            )}
          </section>

          <AvisoFonteDados generatedAt={generatedAt} variant="completo" />
        </div>
      )}
    </QueryView>
  )
}
