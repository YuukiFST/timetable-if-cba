import { describe, expect, it } from "vitest"
import { isArquivoCursos, isArquivoTurma } from "./validate"

const envelope = { schemaVersion: 1, generatedAt: "2026-01-01T00:00:00.000Z" }
const turmaOk = {
  ...envelope,
  turma: {
    id: "t-1",
    nome: "T",
    cursoId: "c1",
    materias: [{ id: "m1", nome: "M" }],
    aulas: [{ diaSemana: 0, slot: 0, horaInicio: "07:00", horaFim: "07:50", materiaId: "m1" }],
  },
}

// Espelha os casos-limite de schema.ts (effect/Schema): os guards do client devem
// rejeitar exatamente o que o schema do scraper rejeita.
describe("isArquivoTurma", () => {
  it("aceita arquivo válido", () => {
    expect(isArquivoTurma(turmaOk)).toBe(true)
  })

  it("aceita campos opcionais presentes", () => {
    const t = structuredClone(turmaOk)
    t.turma.materias[0] = { id: "m1", nome: "M", nomeCurto: "M.", semestre: 2 } as never
    t.turma.aulas[0] = { ...t.turma.aulas[0]!, sala: "S1", professor: "P" } as never
    expect(isArquivoTurma(t)).toBe(true)
  })

  it("rejeita diaSemana fora de 0..5", () => {
    const t = structuredClone(turmaOk)
    t.turma.aulas[0]!.diaSemana = 99
    expect(isArquivoTurma(t)).toBe(false)
  })

  it("rejeita horário fora do padrão HH:MM", () => {
    const t = structuredClone(turmaOk)
    t.turma.aulas[0]!.horaInicio = "7:00"
    expect(isArquivoTurma(t)).toBe(false)
  })

  it("rejeita envelope sem generatedAt e não-objetos", () => {
    expect(isArquivoTurma({ schemaVersion: 1, turma: turmaOk.turma })).toBe(false)
    expect(isArquivoTurma(null)).toBe(false)
    expect(isArquivoTurma("x")).toBe(false)
  })
})

describe("isArquivoCursos", () => {
  it("aceita arquivo válido e rejeita curso sem turmaIds", () => {
    expect(isArquivoCursos({ ...envelope, cursos: [{ id: "c1", nome: "C", turmaIds: ["t-1"] }] })).toBe(true)
    expect(isArquivoCursos({ ...envelope, cursos: [{ id: "c1", nome: "C" }] })).toBe(false)
  })
})
