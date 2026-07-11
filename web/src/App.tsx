import { NavLink, Route, Routes } from "react-router"
import { InstallHint } from "./components/InstallHint"
import { IconConfig, IconHoje, IconMaterias, IconPlanejar } from "./components/ui"
import { useProgresso } from "./storage"
import { Config } from "./pages/Config"
import { Curso } from "./pages/Curso"
import { Hoje } from "./pages/Hoje"
import { Onboarding } from "./pages/Onboarding"
import { Planejar } from "./pages/Planejar"

const tabs = [
  { to: "/", label: "Curso", icon: <IconMaterias /> },
  { to: "/planejar", label: "Planejar", icon: <IconPlanejar /> },
  { to: "/hoje", label: "Hoje", icon: <IconHoje /> },
  { to: "/config", label: "Config", icon: <IconConfig /> },
] as const

export function App() {
  const progresso = useProgresso()
  if (!progresso) return <Onboarding />

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <main className="flex-1 px-4 pb-24 pt-4 md:pb-8 md:pt-20">
        <Routes>
          <Route path="/" element={<Curso turmaId={progresso.turmaId} />} />
          <Route path="/planejar" element={<Planejar turmaId={progresso.turmaId} />} />
          <Route path="/hoje" element={<Hoje turmaId={progresso.turmaId} />} />
          <Route path="/config" element={<Config turmaId={progresso.turmaId} />} />
        </Routes>
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
                `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-xs font-medium md:flex-row md:gap-2 md:text-sm ${
                  isActive ? "text-primary" : "ix-tab text-muted active:text-foreground"
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
