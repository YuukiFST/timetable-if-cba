import { useState } from "react"
import { loadTurma, useQuery } from "../data/api"
import { escolherTurma, resetProgresso } from "../storage"
import { EscolhaTurma } from "./Onboarding"
import { QueryView, Titulo } from "../components/ui"

const DIAS_MS = 24 * 60 * 60 * 1000

export function Config({ turmaId }: { turmaId: string }) {
  const q = useQuery(loadTurma(turmaId), turmaId)
  const [trocando, setTrocando] = useState(false)
  const [confirmandoReset, setConfirmandoReset] = useState(false)

  if (trocando)
    return (
      <EscolhaTurma
        titulo="Trocar de turma"
        onPick={(id) => {
          escolherTurma(id)
          setTrocando(false)
        }}
      />
    )

  return (
    <QueryView q={q}>
      {(arquivo) => {
        const geradoEm = new Date(arquivo.generatedAt)
        const desatualizado = Date.now() - geradoEm.getTime() > 30 * DIAS_MS
        return (
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
                className="min-h-12 w-full px-4 py-3 text-left font-medium text-primary transition-colors active:bg-surface-2"
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
                      className="min-h-11 rounded-xl bg-danger px-4 font-semibold text-white transition-transform active:scale-[0.97]"
                    >
                      Apagar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoReset(false)}
                      className="min-h-11 rounded-xl bg-surface-2 px-4 font-semibold transition-transform active:scale-[0.97]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmandoReset(true)}
                  className="min-h-12 w-full px-4 py-3 text-left font-medium text-danger transition-colors active:bg-surface-2"
                >
                  Resetar progresso das matérias
                </button>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted">
              <p>
                Grade regular (não inclui substituições do dia). Atualizado em{" "}
                <strong className="text-foreground">{geradoEm.toLocaleDateString("pt-BR")}</strong>.
              </p>
              {desatualizado && <p className="mt-1 text-danger">Dados com mais de 30 dias — podem estar desatualizados.</p>}
              <a
                href="https://ifmtcba.edupage.org/timetable/"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block min-h-11 pt-2 font-medium text-primary"
              >
                Ver horário oficial no EdUpage ↗
              </a>
            </section>
          </div>
        )
      }}
    </QueryView>
  )
}
