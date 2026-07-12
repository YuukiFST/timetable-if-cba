import { Effect, Either, Schema } from "effect"
import { Aula, ArquivoTurma } from "shared/schema"
import { describe, expect, it, vi } from "vitest"
import { DataError, isTurmaIdValid, loadMateriasDoCurso, loadTurma, loadTurmas } from "./api"

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
    const exit = await Effect.runPromiseExit(loadTurma("../evil"))
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
      expect(exit.cause.error).toBeInstanceOf(DataError)
      expect(String(exit.cause.error.cause)).toContain("turmaId inválido")
    }
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
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

    const result = await Effect.runPromise(loadTurmas(["t-1", "t-missing"]))
    expect(result).toHaveLength(1)
    expect(result[0]?.turma.id).toBe("t-1")
    vi.restoreAllMocks()
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

    const result = await Effect.runPromise(loadMateriasDoCurso("t-atual"))
    expect(result.turmaAtual.id).toBe("t-atual")
    expect(result.turmas.some((t) => t.id === "t-atual")).toBe(true)
    expect(result.turmas.some((t) => t.id === "t-missing")).toBe(false)
    vi.restoreAllMocks()
  })
})

describe("schema boundary", () => {
  it("rejeita diaSemana fora de 0..5", () => {
    const decoded = Schema.decodeUnknownEither(Aula)({
      diaSemana: 99,
      slot: 0,
      horaInicio: "07:00",
      horaFim: "07:50",
      materiaId: "m1",
    })
    expect(Either.isLeft(decoded)).toBe(true)
  })

  it("rejeita horário fora do padrão HH:MM", () => {
    const decoded = Schema.decodeUnknownEither(ArquivoTurma)({
      schemaVersion: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
      turma: {
        id: "t-1",
        nome: "T",
        cursoId: "c1",
        materias: [{ id: "m1", nome: "M" }],
        aulas: [{ diaSemana: 0, slot: 0, horaInicio: "7:00", horaFim: "07:50", materiaId: "m1" }],
      },
    })
    expect(Either.isLeft(decoded)).toBe(true)
  })
})
