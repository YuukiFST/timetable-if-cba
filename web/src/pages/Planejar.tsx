import { useMemo, useState, type ReactNode } from "react"
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
  type TabelaPlano,
} from "../lib/horario"
import { escolherTurma, toggleCursando, useProgresso } from "../storage"
import { EscolhaCurso } from "./Onboarding"
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
  bloco,
  estado,
  onToggle,
  compacto = false,
}: {
  nome: string
  bloco: Aula | null
  estado: Estado
  onToggle: () => void
  compacto?: boolean
}) {
  const alerta = estado === "choque" || estado === "conflita"
  return (
    <button
      type="button"
      onClick={onToggle}
      title={estado === "conflita" ? `${nome} — colide com sua escolha` : undefined}
      aria-label={nome}
      aria-pressed={estado === "escolhida" || estado === "choque"}
      className={`flex min-w-0 w-full max-w-full flex-col rounded-lg border text-left active:scale-[0.98] ${
        compacto ? "px-1.5 py-1" : "px-2 py-1.5"
      } ${CLASSE[estado]} ${HOVER_CHIP[estado]}`}
    >
      <span
        className={`flex min-w-0 items-start gap-1 font-semibold ${
          compacto ? "text-[10px] leading-tight" : "text-xs leading-snug"
        }`}
      >
        {alerta && <span aria-hidden className="shrink-0">⚠</span>}
        <span className="min-w-0 break-normal">{nome}</span>
      </span>
      {bloco && (
        <span className="text-[11px] tabular-nums leading-tight text-muted">
          {bloco.horaInicio}–{bloco.horaFim}
        </span>
      )}
    </button>
  )
}

function GradeMobile({
  tabela,
  diaInicial,
  chip,
  blocoNaCelula,
}: {
  tabela: TabelaPlano
  diaInicial: number
  chip: (materiaId: string, bloco: Aula | null) => ReactNode
  blocoNaCelula: (materiaId: string, d: number, faixa: string) => Aula | null
}) {
  const [dia, setDia] = useState(diaInicial)

  return (
    <div className="md:hidden">
      {/* grupo de toggles, não tablist: sem roving tabindex/setas, roles de tab prometeriam interação inexistente */}
      <div role="group" aria-label="Dia da semana" className="mb-4 flex gap-1 rounded-2xl bg-surface-2 p-1">
        {tabela.dias.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={dia === d}
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
  )
}

export function Planejar({ turmaId }: { turmaId: string }) {
  const q = useQuery(() => loadMateriasDoCurso(turmaId), `materias-${turmaId}`)
  const progresso = useProgresso()
  const [trocando, setTrocando] = useState(false)
  const cursoIdAtual = q.status === "ok" ? q.value.turmaAtual.cursoId : null

  const concluidas = useMemo(() => new Set(progresso?.materiasConcluidas ?? []), [progresso])
  const selecionadas = useMemo(
    () => new Set((progresso?.cursando ?? []).filter((id) => !concluidas.has(id))),
    [progresso, concluidas],
  )

  if (trocando)
    return (
      <EscolhaCurso
        titulo="Trocar de curso"
        onPick={(id, cursoId) => {
          escolherTurma(id, cursoId, cursoIdAtual)
          setTrocando(false)
        }}
      />
    )

  return (
    <QueryView q={q} onReescolher={() => setTrocando(true)}>
      {({ curso, materias, turmaAtual, turmas, generatedAt }) => {
        const ofertas = ofertasPorMateria(turmaAtual, turmas)
        const nomePorId = new Map(materias.map((m) => [m.id, m.nome]))
        const pool = materias.filter((m) => !concluidas.has(m.id))
        const tabela = montarTabelaPlano(pool, ofertas)
        const hoje = diaLetivo(new Date())
        const diaInicial =
          hoje >= 0 && tabela.dias.includes(hoje) ? hoje : (tabela.dias[0] ?? 0)

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

        const semHorario = pool.filter((m) => !(ofertas.get(m.id)?.blocos.length))

        const nChoques = choques.pares.length
        const resumo =
          selecionadas.size === 0
            ? "Toque numa matéria para escolher"
            : `${selecionadas.size} escolhida${selecionadas.size === 1 ? "" : "s"}${
                nChoques > 0 ? ` · ${nChoques} choque${nChoques === 1 ? "" : "s"}` : " · sem choques"
              }`

        const chip = (materiaId: string, bloco: Aula | null, compacto = false) => (
          <ChipMateria
            key={materiaId}
            nome={nomePorId.get(materiaId) ?? materiaId}
            bloco={bloco}
            estado={estadoDe(materiaId)}
            onToggle={() => toggleCursando(materiaId)}
            compacto={compacto}
          />
        )
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
                <GradeMobile
                  key={`${turmaId}-${tabela.dias.join(",")}`}
                  tabela={tabela}
                  diaInicial={diaInicial}
                  chip={chip}
                  blocoNaCelula={blocoNaCelula}
                />

                <div className="hidden md:block md:-mx-4 md:overflow-x-auto">
                  <div
                    className="grid min-w-[42rem] gap-px overflow-hidden rounded-2xl border border-border bg-border"
                    style={{ gridTemplateColumns: `auto repeat(${tabela.dias.length}, minmax(6.5rem, 1fr))` }}
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
                          <div key={d} className="flex min-w-0 flex-col gap-1 bg-surface p-1.5">
                            {ids.map((id) => chip(id, blocoNaCelula(id, d, faixa), true))}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                  </div>
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
