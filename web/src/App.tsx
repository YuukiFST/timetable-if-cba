import { lazy, Suspense } from "react"
import { NavLink, Route, Routes } from "react-router"
import { AvisoAtualizacaoDados } from "./components/AvisoAtualizacaoDados"
import { InstallHint } from "./components/InstallHint"
import { Carregando, IconConfig, IconHoje, IconMaterias, IconPlanejar } from "./components/ui"
import { loadCursos, useQuery } from "./data/api"
import { useProgresso } from "./storage"
import { Onboarding } from "./pages/Onboarding"

// Code-split por rota: primeira visita (Onboarding) e cada aba só baixam o que usam.
const Config = lazy(() => import("./pages/Config").then((m) => ({ default: m.Config })))
const Curso = lazy(() => import("./pages/Curso").then((m) => ({ default: m.Curso })))
const Hoje = lazy(() => import("./pages/Hoje").then((m) => ({ default: m.Hoje })))
const Planejar = lazy(() => import("./pages/Planejar").then((m) => ({ default: m.Planejar })))

const tabs = [
  { to: "/", label: "Curso", icon: <IconMaterias /> },
  { to: "/planejar", label: "Planejar", icon: <IconPlanejar /> },
  { to: "/hoje", label: "Hoje", icon: <IconHoje /> },
  { to: "/config", label: "Config", icon: <IconConfig /> },
] as const

export function App() {
  const progresso = useProgresso()
  const meta = useQuery(loadCursos, "cursos")
  const generatedAtLocal = meta.status === "ok" ? meta.value.generatedAt : null
  if (!progresso) return <Onboarding />

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <AvisoAtualizacaoDados generatedAtLocal={generatedAtLocal} />
      <main className="flex-1 px-4 pb-24 pt-4 md:pb-8 md:pt-20">
        <Suspense fallback={<Carregando />}>
          <Routes>
            <Route path="/" element={<Curso turmaId={progresso.turmaId} />} />
            <Route path="/planejar" element={<Planejar turmaId={progresso.turmaId} />} />
            <Route path="/hoje" element={<Hoje turmaId={progresso.turmaId} />} />
            <Route path="/config" element={<Config turmaId={progresso.turmaId} />} />
          </Routes>
        </Suspense>
      </main>

      <nav
        aria-label="Navegação principal"
        className="glass fixed inset-x-0 bottom-0 z-10 border-t border-border safe-bottom md:bottom-auto md:top-0 md:border-b md:border-t-0"
      >
        <div className="mx-auto flex max-w-3xl">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === "/"}
              className={({ isActive }) =>
                `relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium md:flex-row md:gap-2 md:text-sm ${
                  isActive
                    ? "font-semibold text-primary after:absolute after:bottom-1.5 after:h-1 after:w-1 after:rounded-full after:bg-primary md:after:bottom-1"
                    : "ix-tab text-muted active:text-foreground"
                }`
              }
            >
              <span aria-hidden>{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <InstallHint />
    </div>
  )
}
