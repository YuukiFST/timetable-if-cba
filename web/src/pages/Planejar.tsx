import { useMemo, useState } from "react"
import type { Aula } from "shared/schema"
import { loadMateriasDoCurso, useQuery } from "../data/api"
import {
  aulasSobrepoem,
  chaveCelula,
  DIAS,
  DIAS_CURTO,
  detectarChoquesPlano,
  diaLetivo,
  type ItemPlano,
  montarTabelaPlano,
  ofertasPorMateria,
} from "../lib/horario"
import { toggleCursando, useProgresso } from "../storage"
import { AvisoFonteDados, AvisoPlanejar, QueryView, Titulo } from "../components/ui"

type Estado = "escolhida" | "choque" | "conflita" | "livre"

const CLASSE: Record<Estado, string> = {
  choque: "border-warning bg-warning-soft text-foreground",
  escolhida: "border-primary bg-primary-soft text-foreground",
  conflita: "border-border bg-surface-2 text-muted opacity-60",
  livre: "border-border bg-surface-2 text-foreground",
}

const HOVER_CHIP: Record<Estado, string> = {
  choque: "ix-chip ix-chip-choque",
  escolhida: "ix-chip ix-chip-escolhida",
  conflita: "ix-chip",
  livre: "ix-chip ix-chip-livre",
}

function ChipMateria({
  nome,
  corto,
  bloco,
  estado,
  onToggle,
}: {
  nome: string
  corto: string
  bloco: Aula | null
  estado: Estado
  onToggle: () => void
}) {
  const alerta = estado === "choque" || estado === "conflita"
  return (
    <button
      type="button"
      onClick={onToggle}
      title={estado === "conflita" ? `${nome} — colide com sua escolha` : nome}
      aria-label={nome}
      aria-pressed={estado === "escolhida" || estado === "choque"}
      className={`flex w-full flex-col rounded-lg border px-2 py-1.5 text-left active:scale-[0.98] ${CLASSE[estado]} ${HOVER_CHIP[estado]}`}
    >
      <span className="flex items-center gap-1 text-xs font-semibold leading-tight">
        {alerta && <span aria-hidden>⚠</span>}
        <span className="truncate">{corto}</span>
      </span>
      {bloco && (
        <span className="text-[11px] tabular-nums leading-tight text-muted">
          {bloco.horaInicio}–{bloco.horaFim}
        </span>
      )}
    </button>
  )
}

export function Planejar({ turmaId }: { turmaId: string }) {
  const q = useQuery(
    useMemo(() => loadMateriasDoCurso(turmaId), [turmaId]),
    `materias-${turmaId}`,
  )
  const progresso = useProgresso()
  const [dia, setDia] = useState(() => Math.max(0, Math.min(5, diaLetivo(new Date()))))

  const concluidas = useMemo(() => new Set(progresso?.materiasConcluidas ?? []), [progresso])
  const selecionadas = useMemo(
    () => new Set((progresso?.cursando ?? []).filter((id) => !concluidas.has(id))),
    [progresso, concluidas],
  )

  return (
    <QueryView q={q}>
      {({ curso, materias, turmas, generatedAt }) => {
        const ofertas = ofertasPorMateria(turmas)
        const nomePorId = new Map(materias.map((m) => [m.id, m.nome]))
        const cortoPorId = new Map(materias.map((m) => [m.id, m.nomeCurto ?? m.nome]))
        const pool = materias.filter((m) => !concluidas.has(m.id))
        const tabela = montarTabelaPlano(pool, ofertas)

        const itensSel: ItemPlano[] = [...selecionadas]
          .map((id) => ({ materiaId: id, blocos: ofertas.get(id)?.blocos ?? [] }))
          .filter((it) => it.blocos.length > 0)
        const choques = detectarChoquesPlano(itensSel)
        const blocosSel = itensSel.flatMap((it) => it.blocos)

        const estadoDe = (materiaId: string): Estado => {
          if (selecionadas.has(materiaId)) return choques.materiasEmChoque.has(materiaId) ? "choque" : "escolhida"
          const blocos = ofertas.get(materiaId)?.blocos ?? []
          if (blocos.some((b) => blocosSel.some((s) => aulasSobrepoem(b, s)))) return "conflita"
          return "livre"
        }

        // matérias sem horário: não entram na tabela nem em choque
        const semHorario = pool.filter((m) => !(ofertas.get(m.id)?.blocos.length))

        const nChoques = choques.pares.length
        const resumo =
          selecionadas.size === 0
            ? "Toque numa matéria para escolher"
            : `${selecionadas.size} escolhida${selecionadas.size === 1 ? "" : "s"}${
                nChoques > 0 ? ` · ${nChoques} choque${nChoques === 1 ? "" : "s"}` : " · sem choques"
              }`

        const chip = (materiaId: string, bloco: Aula | null) => (
          <ChipMateria
            key={materiaId}
            nome={nomePorId.get(materiaId) ?? materiaId}
            corto={cortoPorId.get(materiaId) ?? materiaId}
            bloco={bloco}
            estado={estadoDe(materiaId)}
            onToggle={() => toggleCursando(materiaId)}
          />
        )
        // bloco específico de uma matéria naquela célula (para mostrar o horário no chip)
        const blocoNaCelula = (materiaId: string, d: number, faixa: string): Aula | null =>
          ofertas.get(materiaId)?.blocos.find((b) => b.diaSemana === d && b.horaInicio === faixa) ?? null

        return (
          <div>
            <Titulo sub={`${curso.nome} · ${resumo}`}>Planejar</Titulo>
            <AvisoPlanejar />
            <AvisoFonteDados generatedAt={generatedAt} />

            {tabela.dias.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
                Nenhuma matéria com horário para planejar.
              </div>
            ) : (
              <>
                {/* Mobile: abas por dia + linhas por faixa de horário */}
                <div className="md:hidden">
                  <div role="tablist" aria-label="Dia da semana" className="mb-4 flex gap-1 rounded-2xl bg-surface-2 p-1">
                    {tabela.dias.map((d) => (
                      <button
                        key={d}
                        role="tab"
                        aria-selected={dia === d}
                        onClick={() => setDia(d)}
                        className={`min-h-11 flex-1 rounded-xl text-sm font-semibold ${
                          dia === d ? "bg-surface text-primary shadow-sm" : "ix-tab text-muted"
                        }`}
                      >
                        {DIAS_CURTO[d]}
                      </button>
                    ))}
                  </div>
                  <ul className="space-y-2.5">
                    {tabela.faixas
                      .map((faixa) => [faixa, tabela.celulas.get(chaveCelula(dia, faixa)) ?? []] as const)
                      .filter(([, ids]) => ids.length > 0)
                      .map(([faixa, ids]) => (
                        <li key={faixa} className="flex gap-3 rounded-2xl border border-border bg-surface p-3">
                          <span className="w-12 shrink-0 pt-1 text-sm font-semibold tabular-nums text-muted">{faixa}</span>
                          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                            {ids.length > 1 && (
                              <span className="text-xs font-semibold text-warning">⚠ {ids.length} no mesmo horário</span>
                            )}
                            {ids.map((id) => chip(id, blocoNaCelula(id, dia, faixa)))}
                          </div>
                        </li>
                      ))}
                    {!tabela.faixas.some((faixa) => (tabela.celulas.get(chaveCelula(dia, faixa)) ?? []).length > 0) && (
                      <li className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">
                        Sem matérias em {DIAS[dia]}.
                      </li>
                    )}
                  </ul>
                </div>

                {/* Desktop: tabela semanal (faixa × dia) */}
                <div
                  className="hidden gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid"
                  style={{ gridTemplateColumns: `auto repeat(${tabela.dias.length}, minmax(0, 1fr))` }}
                >
                  <div className="bg-surface" />
                  {tabela.dias.map((d) => (
                    <div key={d} className="bg-surface px-2 py-2 text-center text-sm font-bold uppercase tracking-wide text-muted">
                      {DIAS_CURTO[d]}
                    </div>
                  ))}
                  {tabela.faixas.map((faixa) => (
                    <div key={faixa} className="contents">
                      <div className="bg-surface px-2 py-2 text-right text-xs font-semibold tabular-nums text-muted">{faixa}</div>
                      {tabela.dias.map((d) => {
                        const ids = tabela.celulas.get(chaveCelula(d, faixa)) ?? []
                        return (
                          <div key={d} className="flex flex-col gap-1 bg-surface p-1.5">
                            {ids.map((id) => chip(id, blocoNaCelula(id, d, faixa)))}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}

            {semHorario.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Sem horário definido</h2>
                <div className="flex flex-wrap gap-1.5">{semHorario.map((m) => chip(m.id, null))}</div>
              </section>
            )}
          </div>
        )
      }}
    </QueryView>
  )
}
