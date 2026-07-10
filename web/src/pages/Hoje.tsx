import { useEffect, useState } from "react"
import { loadTurma, useQuery } from "../data/api"
import { calcularHoje, DIAS } from "../lib/horario"
import { AulaCard, QueryView, Titulo } from "../components/ui"

export function Hoje({ turmaId }: { turmaId: string }) {
  const q = useQuery(loadTurma(turmaId), turmaId)
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <QueryView q={q}>
      {({ turma }) => {
        const hoje = calcularHoje(turma.aulas, agora)
        const materiaNome = (id: string) => turma.materias.find((m) => m.id === id)?.nome ?? id
        return (
          <div>
            <Titulo sub={turma.nome}>{hoje.ehHoje ? "Hoje" : `Próximo dia letivo · ${DIAS[hoje.dia]}`}</Titulo>
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
