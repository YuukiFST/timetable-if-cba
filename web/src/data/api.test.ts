import { afterEach, describe, expect, it, vi } from "vitest"
import { DataError, isTurmaIdValid, limparCacheDados, loadMateriasDoCurso, loadTurma, loadTurmas } from "./api"

afterEach(() => {
  limparCacheDados()
  vi.restoreAllMocks()
})

describe("isTurmaIdValid", () => {
  it("aceita ids de turma do scraper", () => {
    expect(isTurmaIdValid("t-517")).toBe(true)
  })

  it("rejeita path traversal e ids vazios", () => {
    expect(isTurmaIdValid("../etc/passwd")).toBe(false)
    expect(isTurmaIdValid("")).toBe(false)
    expect(isTurmaIdValid("x-517")).toBe(false)
  })
})

describe("loadTurma", () => {
  it("falha sem fetch para turmaId inválido", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const err = await loadTurma("../evil").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DataError)
    expect(String((err as DataError).cause)).toContain("turmaId inválido")
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("rejeita JSON fora do schema", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ nada: true })))
    const err = await loadTurma("t-1").catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DataError)
    expect(String((err as DataError).cause)).toContain("dados fora do schema")
  })

  it("não cacheia falha: retry refaz o fetch", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("boom", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            schemaVersion: 1,
            generatedAt: "2026-01-01T00:00:00.000Z",
            turma: { id: "t-1", nome: "T", cursoId: "c1", materias: [], aulas: [] },
          }),
        ),
      )
    await expect(loadTurma("t-1")).rejects.toBeInstanceOf(DataError)
    await expect(loadTurma("t-1")).resolves.toMatchObject({ turma: { id: "t-1" } })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it("cacheia sucesso: segunda chamada não refaz o fetch", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          schemaVersion: 1,
          generatedAt: "2026-01-01T00:00:00.000Z",
          turma: { id: "t-1", nome: "T", cursoId: "c1", materias: [], aulas: [] },
        }),
      ),
    )
    await loadTurma("t-1")
    await loadTurma("t-1")
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe("loadTurmas", () => {
  it("ignora turmas que falham e retorna as válidas", async () => {
    const turmaOk = {
      schemaVersion: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
      turma: {
        id: "t-1",
        nome: "Turma A",
        cursoId: "c1",
        materias: [{ id: "m1", nome: "Mat 1" }],
        aulas: [{ diaSemana: 0, slot: 0, horaInicio: "07:00", horaFim: "07:50", materiaId: "m1" }],
      },
    }
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith("t-1.json")) return new Response(JSON.stringify(turmaOk))
      return new Response("not found", { status: 404 })
    })

    const result = await loadTurmas(["t-1", "t-missing"])
    expect(result).toHaveLength(1)
    expect(result[0]?.turma.id).toBe("t-1")
  })
})

describe("loadMateriasDoCurso", () => {
  it("carrega curso mesmo quando outra turma do curso falha", async () => {
    const turmaAtual = {
      schemaVersion: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
      turma: {
        id: "t-atual",
        nome: "Turma atual",
        cursoId: "c1",
        materias: [{ id: "m1", nome: "Mat 1" }],
        aulas: [{ diaSemana: 0, slot: 0, horaInicio: "07:00", horaFim: "07:50", materiaId: "m1" }],
      },
    }
    const cursos = {
      schemaVersion: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
      cursos: [{ id: "c1", nome: "Curso 1", turmaIds: ["t-atual", "t-missing"] }],
    }
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input)
      if (url.endsWith("cursos.json")) return new Response(JSON.stringify(cursos))
      if (url.endsWith("t-atual.json")) return new Response(JSON.stringify(turmaAtual))
      return new Response("not found", { status: 404 })
    })

    const result = await loadMateriasDoCurso("t-atual")
    expect(result.turmaAtual.id).toBe("t-atual")
    expect(result.turmas.some((t) => t.id === "t-atual")).toBe(true)
    expect(result.turmas.some((t) => t.id === "t-missing")).toBe(false)
  })
})
