import type { ReactNode } from "react"
import type { Aula } from "shared/schema"
import type { DataError, Query } from "../data/api"

// Ícones inline (traço 1.75, estilo SF Symbols) — sem lib de ícones para 4 desenhos.
const icon = (path: ReactNode) => (
  <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
)
export const IconHoje = () => icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)
export const IconSemana = () => icon(<><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></>)
export const IconMaterias = () => icon(<><path d="M4 19V6a2 2 0 0 1 2-2h13v13H6a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h13" /><path d="M9 8h6" /></>)
export const IconConfig = () => icon(<><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></>)

export function Titulo({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight">{children}</h1>
      {sub !== undefined && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
    </header>
  )
}

export function AulaCard({ aula, materia, destaque, rotulo }: { aula: Aula; materia: string; destaque?: boolean; rotulo?: string }) {
  return (
    <li
      className={`flex gap-3 rounded-2xl border p-3.5 transition-colors ${
        destaque ? "border-primary bg-primary-soft" : "border-border bg-surface"
      }`}
    >
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-2 py-1 text-center tabular-nums">
        <span className="text-sm font-semibold">{aula.horaInicio}</span>
        <span className="text-xs text-muted">{aula.horaFim}</span>
      </div>
      <div className="min-w-0 flex-1">
        {rotulo !== undefined && (
          <span className="mb-1 inline-block rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-on-primary">
            {rotulo}
          </span>
        )}
        <p className="truncate font-semibold leading-snug">{materia}</p>
        <p className="mt-0.5 truncate text-sm text-muted">
          {aula.sala ?? "—"} · {aula.professor ?? "—"}
        </p>
      </div>
    </li>
  )
}

export function ErroDados({ error }: { error: DataError }) {
  return (
    <div role="alert" className="rounded-2xl border border-border bg-surface p-5 text-center">
      <p className="font-semibold">Dados indisponíveis</p>
      <p className="mt-1 text-sm text-muted">
        Não foi possível carregar {error.path}. Verifique a conexão e tente de novo.
      </p>
    </div>
  )
}

export function Carregando() {
  return (
    <ul className="animate-pulse space-y-2.5" aria-label="Carregando">
      {[0, 1, 2].map((i) => (
        <li key={i} className="h-20 rounded-2xl bg-surface-2" />
      ))}
    </ul>
  )
}

/** Render padrão dos três estados de uma Query. */
export function QueryView<A>({ q, children }: { q: Query<A>; children: (value: A) => ReactNode }) {
  if (q.status === "loading") return <Carregando />
  if (q.status === "error") return <ErroDados error={q.error} />
  return <>{children(q.value)}</>
}
