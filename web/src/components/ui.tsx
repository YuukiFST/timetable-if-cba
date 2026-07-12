import type { ReactNode } from "react"
import { Link } from "react-router"
import type { Aula } from "shared/schema"
import type { DataError, Query } from "../data/api"

const EDUPAGE_URL = "https://ifmtcba.edupage.org/timetable/"
const DIAS_MS = 24 * 60 * 60 * 1000

// Ícones inline (traço 1.75, estilo SF Symbols) — sem lib de ícones para 4 desenhos.
const icon = (path: ReactNode) => (
  <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
)
export const IconHoje = () => icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)
export const IconMaterias = () => icon(<><path d="M4 19V6a2 2 0 0 1 2-2h13v13H6a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h13" /><path d="M9 8h6" /></>)
export const IconConfig = () => icon(<><circle cx="12" cy="12" r="3.5" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></>)
export const IconPlanejar = () => icon(<><rect x="3.5" y="4" width="17" height="17" rx="2.5" /><path d="M3.5 9h17M8 3v3M16 3v3" /><path d="M7.5 13l2 2 4-4" /></>)

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

export function AvisoFonteDados({
  generatedAt,
  variant = "compacto",
  className = "",
}: {
  generatedAt: string
  variant?: "compacto" | "completo"
  className?: string
}) {
  const geradoEm = new Date(generatedAt)
  const dataValida = !Number.isNaN(geradoEm.getTime())
  const dataLabel = dataValida ? geradoEm.toLocaleDateString("pt-BR") : "data desconhecida"
  const desatualizado = dataValida && Date.now() - geradoEm.getTime() > 30 * DIAS_MS

  if (variant === "completo") {
    return (
      <section className={`rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-muted ${className}`}>
        <p>
          Os horários e nomes das matérias vêm do <strong className="text-foreground">EdUpage</strong> (timetable
          oficial do IFMT). Se nome, dia ou horário estiverem errados, o problema está nos dados da instituição, não
          neste app.
        </p>
        <p className="mt-2">
          Grade regular (não inclui substituições do dia). Atualizado em{" "}
          <strong className="text-foreground">{dataLabel}</strong>.
        </p>
        {desatualizado && <p className="mt-1 text-danger">Dados com mais de 30 dias — podem estar desatualizados.</p>}
        <a
          href={EDUPAGE_URL}
          target="_blank"
          rel="noreferrer"
          className="ix-link mt-2 inline-block min-h-11 pt-2 font-medium text-primary"
        >
          Ver horário oficial no EdUpage ↗
        </a>
      </section>
    )
  }

  return (
    <aside className={`mb-5 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted ${className}`} role="note">
      <p>
        Horários e nomes vêm do <strong className="text-foreground">EdUpage</strong>. Dados incorretos (nome, dia,
        horário) são da fonte oficial, não deste app.
      </p>
      <p className="mt-1.5">
        Atualizado em <strong className="text-foreground">{dataLabel}</strong>
        {" · "}
        <a href={EDUPAGE_URL} target="_blank" rel="noreferrer" className="ix-link font-medium text-primary">
          Ver horário oficial ↗
        </a>
      </p>
    </aside>
  )
}

export function AvisoPlanejar({ className = "" }: { className?: string }) {
  return (
    <aside
      className={`mb-5 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-sm text-muted ${className}`}
      role="note"
    >
      <p className="font-semibold text-foreground">Por que esta aba existe?</p>
      <p className="mt-1.5">
        No <strong className="text-foreground">SUAP</strong>, quando o período de matrículas está aberto, é difícil
        enxergar quais matérias você pode escolher em cada dia da semana. Aqui a grade mostra, por dia, todas as
        matérias disponíveis — fica mais fácil montar sua grade antes de confirmar no sistema oficial.
      </p>
      <p className="mt-1.5">
        Toque numa matéria para marcar o que você pretende cursar. As escolhidas aparecem em{" "}
        <strong className="text-foreground">Hoje</strong> nos dias em que têm aula.
      </p>
    </aside>
  )
}

export function HojeSemMaterias() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <p className="text-lg font-semibold">Suas aulas de hoje</p>
      <p className="mt-2 text-sm text-muted">
        Esta aba mostra as aulas do dia atual das matérias que você marcou em{" "}
        <strong className="text-foreground">Planejar</strong>. Se não aparecer nada, é porque você ainda não
        selecionou suas matérias.
      </p>
      <Link
        to="/planejar"
        className="ix-btn mt-5 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 text-sm font-semibold text-on-primary"
      >
        Ir para Planejar
      </Link>
    </div>
  )
}

export function ErroDados({
  error,
  onReescolher,
}: {
  error: DataError
  onReescolher?: () => void
}) {
  const cause = error.cause
  const msg = cause instanceof Error ? cause.message : String(cause)
  const ausente = msg.includes("HTTP 404")
  const invalidId = msg.includes("turmaId inválido")
  const decode = !msg.includes("HTTP") && !invalidId
  const dica = invalidId
    ? "Identificador de turma inválido no armazenamento local. Escolha o curso de novo."
    : ausente
      ? "A turma salva não existe mais nos dados. Escolha o curso de novo."
      : decode
        ? "Os dados podem estar corrompidos ou desatualizados. Em desenvolvimento, rode npm run scrape na raiz do projeto."
        : msg.includes("HTTP")
          ? `Falha ao buscar os dados (${msg}).`
          : "Os dados podem estar corrompidos ou desatualizados."

  return (
    <div role="alert" className="rounded-2xl border border-border bg-surface p-5 text-center">
      <p className="font-semibold">Dados indisponíveis</p>
      <p className="mt-1 text-sm text-muted">
        Não foi possível carregar <code className="text-foreground">{error.path}</code>.
      </p>
      <p className="mt-2 text-sm text-muted">{dica}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {(ausente || invalidId) && onReescolher && (
          <button
            type="button"
            onClick={onReescolher}
            className="ix-btn min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary active:scale-[0.97]"
          >
            Escolher curso de novo
          </button>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="ix-btn min-h-11 rounded-xl bg-surface-2 px-4 text-sm font-semibold active:scale-[0.97]"
        >
          Recarregar
        </button>
      </div>
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
export function QueryView<A>({
  q,
  children,
  onReescolher,
}: {
  q: Query<A>
  children: (value: A) => ReactNode
  onReescolher?: () => void
}) {
  if (q.status === "loading") return <Carregando />
  if (q.status === "error") return <ErroDados error={q.error} onReescolher={onReescolher} />
  return <>{children(q.value)}</>
}
