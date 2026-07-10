import { Schema } from "effect"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Turma } from "shared/schema"
import { describe, expect, it } from "vitest"
import { parseTurmaNome, transform } from "./transform.js"

// Fixture real do EdUpage (regularttGetData, tt 1223, capturada 2026-07-10).
// Detecta drift de formato: se o EdUpage mudar o shape, o transform quebra aqui primeiro.
const fixture = JSON.parse(
  readFileSync(join(__dirname, "..", "fixtures", "regulartt-1223.json"), "utf8"),
) as { r: { dbiAccessorRes: { tables: Array<{ id: string; data_rows: unknown[] }> } } }
const raw = fixture.r.dbiAccessorRes

describe("parseTurmaNome", () => {
  it("padrão código.semestre", () => {
    expect(parseTurmaNome("DCOM 7131.2A Inform. Integ.")).toEqual({
      cursoNome: "DCOM 7131 Inform. Integ.",
      semestre: 2,
    })
  })
  it("padrão Nº Sem", () => {
    expect(parseTurmaNome("DEEA Eng. Elétrica 3º Sem")).toEqual({ cursoNome: "DEEA Eng. Elétrica", semestre: 3 })
  })
  it("padrão No SEM. com hífen", () => {
    expect(parseTurmaNome("DABC - Licenc. em Educ. Fís. - 5o SEM.")).toEqual({
      cursoNome: "DABC - Licenc. em Educ. Fís.",
      semestre: 5,
    })
  })
  it("sem padrão: curso = nome inteiro, sem semestre", () => {
    expect(parseTurmaNome("DEEA EnergIFE 1")).toEqual({ cursoNome: "DEEA EnergIFE 1" })
  })
})

describe("transform (fixture real)", () => {
  const result = transform(raw, {})

  it("produz cursos e turmas", () => {
    expect(result.cursos.length).toBeGreaterThan(10)
    expect(result.turmas.length).toBeGreaterThan(50)
  })

  it("toda turma valida contra o schema compartilhado e tem aulas coerentes", () => {
    for (const turma of result.turmas) {
      Schema.decodeUnknownSync(Turma)(turma)
      expect(turma.aulas.length).toBeGreaterThan(0)
      expect(turma.materias.length).toBeGreaterThan(0)
      for (const aula of turma.aulas) {
        expect(aula.diaSemana).toBeGreaterThanOrEqual(0)
        expect(aula.diaSemana).toBeLessThanOrEqual(5)
        expect(aula.horaInicio).toMatch(/^\d{2}:\d{2}$/)
        expect(turma.materias.some((m) => m.id === aula.materiaId)).toBe(true)
      }
    }
  })

  it("cursos referenciam turmas existentes", () => {
    const turmaIds = new Set(result.turmas.map((t) => t.id))
    for (const curso of result.cursos) {
      expect(curso.turmaIds.length).toBeGreaterThan(0)
      for (const id of curso.turmaIds) expect(turmaIds.has(id)).toBe(true)
    }
  })

  it("override sobrescreve derivação", () => {
    const alvo = result.turmas.find((t) => t.semestre !== undefined)
    expect(alvo).toBeDefined()
    const overridden = transform(raw, { [alvo!.nome]: { semestre: 99 } })
    expect(overridden.turmas.find((t) => t.id === alvo!.id)?.semestre).toBe(99)
  })

  it("ids de turma são seguros para nome de arquivo", () => {
    for (const t of result.turmas) expect(t.id).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})
