import { afterEach, describe, expect, it, vi } from "vitest"
import { dadosDesatualizados, fetchGeneratedAtRemoto, limparCacheDados } from "./atualizarDados"

describe("dadosDesatualizados", () => {
  it("true quando generatedAt difere", () => {
    expect(dadosDesatualizados("2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z")).toBe(true)
  })

  it("false quando igual", () => {
    expect(dadosDesatualizados("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toBe(false)
  })
})

describe("fetchGeneratedAtRemoto", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("retorna generatedAt do servidor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ generatedAt: "2026-07-10T12:00:00.000Z" }),
      }),
    )
    await expect(fetchGeneratedAtRemoto()).resolves.toBe("2026-07-10T12:00:00.000Z")
    expect(fetch).toHaveBeenCalledWith("/data/cursos.json", { cache: "no-store" })
  })

  it("retorna null em falha", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
    await expect(fetchGeneratedAtRemoto()).resolves.toBeNull()
  })
})

describe("limparCacheDados", () => {
  it("apaga cache de dados", async () => {
    const del = vi.fn().mockResolvedValue(true)
    vi.stubGlobal("caches", { delete: del })
    await limparCacheDados()
    expect(del).toHaveBeenCalledWith("dados-edupage")
  })
})
