import { useState } from "react"
import { loadTurma, useQuery } from "../data/api"
import { escolherTurma, resetProgresso } from "../storage"
import { EscolhaCurso } from "./Onboarding"
import { AvisoFonteDados, QueryView, Titulo } from "../components/ui"

export function Config({ turmaId }: { turmaId: string }) {
  const q = useQuery(loadTurma(turmaId), turmaId)
  const [trocando, setTrocando] = useState(false)
  const [confirmandoReset, setConfirmandoReset] = useState(false)

  if (trocando)
    return (
      <EscolhaCurso
        titulo="Trocar de curso"
        onPick={(id) => {
          escolherTurma(id)
          setTrocando(false)
        }}
      />
    )

  return (
    <QueryView q={q}>
      {(arquivo) => (
        <div>
          <Titulo>Configurações</Titulo>

          <section className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm text-muted">Turma atual</p>
              <p className="font-semibold">{arquivo.turma.nome}</p>
            </div>
            <button
              type="button"
              onClick={() => setTrocando(true)}
              className="ix-row min-h-12 w-full px-4 py-3 text-left font-medium text-primary active:bg-surface-2"
            >
              Trocar curso/turma
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

          <AvisoFonteDados generatedAt={arquivo.generatedAt} variant="completo" />
        </div>
      )}
    </QueryView>
  )
}
