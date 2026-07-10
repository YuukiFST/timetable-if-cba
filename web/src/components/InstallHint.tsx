import { useEffect, useState } from "react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
}

const DISMISS_KEY = "horarios-ifmt-install-dismissed"

/** Hint discreto de instalação na primeira visita (F4); some após instalar ou dispensar. */
export function InstallHint() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return
    const handler = (e: Event) => {
      e.preventDefault()
      setEvento(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  if (!evento) return null
  return (
    <div className="glass fixed inset-x-4 bottom-20 z-20 flex items-center gap-3 rounded-2xl border border-border p-3 shadow-lg md:bottom-6 md:left-auto md:right-6 md:w-80">
      <p className="flex-1 text-sm">Instale o app para abrir direto e usar offline.</p>
      <button
        type="button"
        onClick={() => {
          void evento.prompt()
          setEvento(null)
        }}
        className="min-h-11 rounded-xl bg-primary px-3 text-sm font-semibold text-on-primary transition-transform active:scale-[0.97]"
      >
        Instalar
      </button>
      <button
        type="button"
        aria-label="Dispensar"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1")
          setEvento(null)
        }}
        className="min-h-11 px-2 text-sm text-muted"
      >
        ✕
      </button>
    </div>
  )
}
