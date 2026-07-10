import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router"
import { loadMateriasDoCurso, useQuery } from "../data/api"
import { aulasVigentes, calcularHoje, DIAS } from "../lib/horario"
import { useProgresso } from "../storage"
import { AulaCard, QueryView, Titulo } from "../components/ui"

export function Hoje({ turmaId }: { turmaId: string }) {
  const q = useQuery(
    useMemo(() => loadMateriasDoCurso(turmaId), [turmaId]),
    `materias-${turmaId}`,
  )
  const progresso = useProgresso()
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  const cursando = useMemo(() => new Set(progresso?.cursando ?? []), [progresso])
  const concluidas = useMemo(() => new Set(progresso?.materiasConcluidas ?? []), [progresso])

  return (
    <QueryView q={q}>
      {({ curso, turmaAtual, turmas, materias }) => {
        const hoje = calcularHoje(aulasVigentes(turmaAtual, turmas, cursando, concluidas), agora)
        const materiaNome = (id: string) => materias.find((m) => m.id === id)?.nome ?? id
        return (
          <div>
            <Titulo
              sub={
                <Link to="/" className="inline-flex min-h-11 items-center gap-1.5">
                  {curso.nome} <span className="font-medium text-primary">trocar</span>
                </Link>
              }
            >
              {hoje.ehHoje ? "Hoje" : `Próximo dia letivo · ${DIAS[hoje.dia]}`}
            </Titulo>
            {hoje.aulas.length === 0 ? (
              <div className="rounded-2xl border border-border bg-surface p-8 text-center">
                <p className="text-lg font-semibold">Sem aulas por aqui</p>
                <p className="mt-1 text-sm text-muted">Aproveite o descanso.</p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {hoje.aulas.map((aula, i) => (
                  <AulaCard
                    key={`${aula.diaSemana}-${aula.slot}-${aula.materiaId}-${i}`}
                    aula={aula}
                    materia={materiaNome(aula.materiaId)}
                    destaque={i === hoje.atualIdx || (hoje.atualIdx < 0 && i === hoje.proximaIdx)}
                    rotulo={i === hoje.atualIdx ? "Agora" : hoje.atualIdx < 0 && i === hoje.proximaIdx ? "Próxima" : undefined}
                  />
                ))}
              </ul>
            )}
          </div>
        )
      }}
    </QueryView>
  )
}
