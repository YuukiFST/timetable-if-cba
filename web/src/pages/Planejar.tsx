import { useMemo, useState } from "react"
import type { Aula } from "shared/schema"
import { loadMateriasDoCurso, useQuery } from "../data/api"
import {
  chaveBloco,
  DIAS,
  DIAS_CURTO,
  detectarChoquesPlano,
  type ItemPlano,
  ofertasPorMateria,
  porSemestre,
  timeToMin,
} from "../lib/horario"
import { togglePlano, useProgresso, usePlano } from "../storage"
import { QueryView, Titulo } from "../components/ui"

const PX_POR_MIN = 0.75
const ALTURA_MIN_BLOCO = 40

/** Rótulo curto do horário de uma matéria: "Seg 13:00 · Ter 15:50". */
const resumoHorario = (blocos: ReadonlyArray<Aula>): string =>
  blocos
    .slice()
    .sort((a, b) => a.diaSemana - b.diaSemana || timeToMin(a.horaInicio) - timeToMin(b.horaInicio))
    .map((b) => `${DIAS_CURTO[b.diaSemana]} ${b.horaInicio}`)
    .join(" · ")

interface BlocoNaGrade {
  bloco: Aula
  materiaId: string
  nome: string
  emChoque: boolean
}

function GradePlano({
  blocos,
  diaFoco,
  onFocarDia,
}: {
  blocos: BlocoNaGrade[]
  diaFoco: number | null
  onFocarDia: (dia: number) => void
}) {
  const dias = useMemo(() => [...new Set(blocos.map((b) => b.bloco.diaSemana))].sort((a, b) => a - b), [blocos])
  if (blocos.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
        Marque matérias abaixo para montar a grade.
      </div>
    )

  const inicio = Math.min(...blocos.map((b) => timeToMin(b.bloco.horaInicio)))
  const fim = Math.max(...blocos.map((b) => timeToMin(b.bloco.horaFim)))
  const altura = (fim - inicio) * PX_POR_MIN
  // marcas de hora inteiras dentro do intervalo
  const horas: number[] = []
  for (let h = Math.ceil(inicio / 60) * 60; h <= fim; h += 60) horas.push(h)

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-3">
      <div className="flex gap-1.5" style={{ minWidth: "max-content" }}>
        {/* eixo de horas */}
        <div className="relative w-9 shrink-0" style={{ height: altura }}>
          {horas.map((h) => (
            <span
              key={h}
              className="absolute right-1 -translate-y-1/2 text-[11px] tabular-nums text-muted"
              style={{ top: (h - inicio) * PX_POR_MIN }}
            >
              {String(Math.floor(h / 60)).padStart(2, "0")}h
            </span>
          ))}
        </div>
        {dias.map((dia) => {
          const doDia = blocos.filter((b) => b.bloco.diaSemana === dia)
          const focado = diaFoco === dia
          return (
            <div key={dia} className={`shrink-0 ${focado ? "w-40" : "w-24"} transition-[width] duration-200`}>
              <button
                type="button"
                onClick={() => onFocarDia(dia)}
                className={`mb-1.5 min-h-8 w-full rounded-lg text-xs font-bold uppercase tracking-wide transition-colors ${
                  focado ? "bg-primary text-on-primary" : "bg-surface-2 text-muted"
                }`}
              >
                {DIAS_CURTO[dia]}
              </button>
              <div className="relative" style={{ height: altura }}>
                {doDia.map((b) => {
                  const top = (timeToMin(b.bloco.horaInicio) - inicio) * PX_POR_MIN
                  const h = Math.max((timeToMin(b.bloco.horaFim) - timeToMin(b.bloco.horaInicio)) * PX_POR_MIN, ALTURA_MIN_BLOCO)
                  return (
                    <div
                      key={chaveBloco(b.bloco) + b.materiaId}
                      className={`absolute inset-x-0 overflow-hidden rounded-lg border px-1.5 py-1 ${
                        b.emChoque ? "border-warning bg-warning-soft" : "border-primary bg-primary-soft"
                      }`}
                      style={{ top, height: h }}
                    >
                      <p className="text-[11px] tabular-nums leading-tight text-muted">{b.bloco.horaInicio}</p>
                      <p className={`truncate text-xs font-semibold leading-tight ${focado ? "whitespace-normal" : ""}`} title={b.nome}>
                        {b.nome}
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function Planejar({ turmaId }: { turmaId: string }) {
  const q = useQuery(
    useMemo(() => loadMateriasDoCurso(turmaId), [turmaId]),
    `materias-${turmaId}`,
  )
  const progresso = useProgresso()
  const plano = usePlano()
  const [diaFoco, setDiaFoco] = useState<number | null>(null)

  const concluidas = useMemo(() => new Set(progresso?.materiasConcluidas ?? []), [progresso])
  // plano só vale para a turma atual (togglePlano zera ao trocar); concluída marcada
  // depois deixa de aparecer no pool — some da grade/resumo também para não travar.
  const selecionadas = useMemo(
    () => new Set((plano?.turmaId === turmaId ? plano.materiaIds : []).filter((id) => !concluidas.has(id))),
    [plano, turmaId, concluidas],
  )

  return (
    <QueryView q={q}>
      {({ curso, materias, turmas }) => {
        const ofertas = ofertasPorMateria(turmas)
        const nomePorId = new Map(materias.map((m) => [m.id, m.nome]))
        const pool = materias.filter((m) => !concluidas.has(m.id))

        const itens: ItemPlano[] = [...selecionadas]
          .map((id) => ({ materiaId: id, blocos: ofertas.get(id)?.blocos ?? [] }))
          .filter((it) => it.blocos.length > 0)
        const choques = detectarChoquesPlano(itens)

        const blocosGrade: BlocoNaGrade[] = itens.flatMap((it) =>
          it.blocos.map((bloco) => ({
            bloco,
            materiaId: it.materiaId,
            nome: nomePorId.get(it.materiaId) ?? it.materiaId,
            emChoque: choques.blocosEmChoque.has(chaveBloco(bloco)),
          })),
        )

        const nChoques = choques.pares.length
        const resumo =
          selecionadas.size === 0
            ? "Marque matérias para simular"
            : `${selecionadas.size} escolhida${selecionadas.size === 1 ? "" : "s"}${
                nChoques > 0 ? ` · ${nChoques} choque${nChoques === 1 ? "" : "s"}` : " · sem choques"
              }`

        return (
          <div>
            <Titulo sub={`${curso.nome} · ${resumo}`}>Planejar</Titulo>

            <section aria-label="Grade do plano" className="mb-6">
              <GradePlano blocos={blocosGrade} diaFoco={diaFoco} onFocarDia={(d) => setDiaFoco((atual) => (atual === d ? null : d))} />
              {diaFoco !== null && (
                <p className="mt-2 px-1 text-xs text-muted">
                  Mostrando {DIAS[diaFoco]} em destaque. Toque de novo para desfazer.
                </p>
              )}
            </section>

            {porSemestre(pool).map(([sem, doSemestre]) => (
              <section key={sem ?? "sem"} className="mb-6">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
                  {sem === null ? "Sem semestre definido" : `${sem}º semestre`}
                </h2>
                <ul className="overflow-hidden rounded-2xl border border-border bg-surface">
                  {doSemestre.map((m) => {
                    const oferta = ofertas.get(m.id)
                    const marcada = selecionadas.has(m.id)
                    const emChoque = marcada && choques.materiasEmChoque.has(m.id)
                    return (
                      <li key={m.id} className="border-b border-border last:border-b-0">
                        <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors active:bg-surface-2">
                          <input
                            type="checkbox"
                            checked={marcada}
                            onChange={() => togglePlano(turmaId, m.id)}
                            aria-label={`Cursar ${m.nome}`}
                            className="size-5 shrink-0 accent-(--primary)"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{m.nome}</span>
                            <span className="block truncate text-xs text-muted">
                              {oferta ? resumoHorario(oferta.blocos) : "sem horário"}
                            </span>
                          </span>
                          {emChoque && (
                            <span className="ml-auto shrink-0 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
                              Choque
                            </span>
                          )}
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )
      }}
    </QueryView>
  )
}
