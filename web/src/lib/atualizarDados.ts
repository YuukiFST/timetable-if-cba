/** Deve coincidir com cacheName em vite.config.ts (workbox runtimeCaching). */
export const CACHE_DADOS = "dados-edupage"

export async function fetchGeneratedAtRemoto(): Promise<string | null> {
  try {
    const res = await fetch("/data/cursos.json", { cache: "no-store" })
    if (!res.ok) return null
    const json = (await res.json()) as { generatedAt?: unknown }
    return typeof json.generatedAt === "string" ? json.generatedAt : null
  } catch {
    return null
  }
}

export function dadosDesatualizados(local: string, remoto: string): boolean {
  return remoto !== local
}

export async function limparCacheDados(): Promise<void> {
  if (!("caches" in globalThis)) return
  await caches.delete(CACHE_DADOS)
}

export async function limparCacheDadosERecarregar(): Promise<void> {
  await limparCacheDados()
  location.reload()
}
