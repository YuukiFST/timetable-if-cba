import { useCallback, useEffect, useState } from "react"
import {
  dadosDesatualizados,
  fetchGeneratedAtRemoto,
  limparCacheDadosERecarregar,
} from "../lib/atualizarDados"

/** Banner quando há horários mais novos no servidor que os em cache (PWA). */
export function AvisoAtualizacaoDados({ generatedAtLocal }: { generatedAtLocal: string | null }) {
  const [disponivel, setDisponivel] = useState(false)
  const [atualizando, setAtualizando] = useState(false)

  const verificar = useCallback(async () => {
    if (!generatedAtLocal) return
    const remoto = await fetchGeneratedAtRemoto()
    if (remoto && dadosDesatualizados(generatedAtLocal, remoto)) setDisponivel(true)
    else setDisponivel(false)
  }, [generatedAtLocal])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- verificar é async; setState só após rede
    void verificar()
    const onVis = () => {
      if (document.visibilityState === "visible") void verificar()
    }
    document.addEventListener("visibilitychange", onVis)
    return () => document.removeEventListener("visibilitychange", onVis)
  }, [verificar])

  if (!disponivel) return null

  return (
    <div
      role="status"
      className="fixed inset-x-4 top-4 z-20 flex items-center gap-3 rounded-2xl border border-primary bg-primary-soft p-3 shadow-lg md:top-16"
    >
      <p className="flex-1 text-sm text-foreground">
        Horários atualizados disponíveis. Toque para sincronizar com a versão mais recente.
      </p>
      <button
        type="button"
        disabled={atualizando}
        onClick={() => {
          setAtualizando(true)
          void limparCacheDadosERecarregar()
        }}
        className="ix-btn min-h-11 shrink-0 rounded-xl bg-primary px-3 text-sm font-semibold text-on-primary active:scale-[0.97] disabled:opacity-60"
      >
        {atualizando ? "Atualizando…" : "Atualizar"}
      </button>
    </div>
  )
}
