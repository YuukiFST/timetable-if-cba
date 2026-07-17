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

// Fixture mínima construída à mão: fixa o comportamento dos branches que a fixture
// real só exercita por acaso (truncamento, parsing de sala, descartes, colisão de id).
const tables = (over: Partial<Record<string, unknown[]>>): { tables: Array<{ id: string; data_rows: unknown[] }> } => ({
  tables: [
    { id: "classes", data_rows: over.classes ?? [{ id: "c1", name: "Turma X", short: "TX" }] },
    { id: "subjects", data_rows: over.subjects ?? [{ id: "s1", name: "Matéria 1", short: "M1" }] },
    { id: "teachers", data_rows: over.teachers ?? [{ id: "p1", short: "Prof" }] },
    { id: "classrooms", data_rows: over.classrooms ?? [{ id: "r1", short: "Lab 3 - Bloco A" }] },
    {
      id: "periods",
      data_rows: over.periods ?? [
        { id: "1", period: "1", starttime: "07:00", endtime: "07:50" },
        { id: "2", period: "2", starttime: "07:50", endtime: "08:40" },
      ],
    },
    {
      id: "lessons",
      data_rows: over.lessons ?? [{ id: "l1", subjectid: "s1", teacherids: ["p1"], classids: ["c1"], durationperiods: 1 }],
    },
    {
      id: "cards",
      data_rows: over.cards ?? [{ lessonid: "l1", period: "1", days: "100000", classroomids: ["r1"] }],
    },
  ],
})

describe("transform (branches)", () => {
  it("sala usa só o prefixo antes de ' - '", () => {
    const r = transform(tables({}), {})
    expect(r.turmas[0]?.aulas[0]?.sala).toBe("Lab 3")
  })

  it("duração além do último período trunca horaFim e registra descarte", () => {
    const r = transform(
      tables({ lessons: [{ id: "l1", subjectid: "s1", teacherids: [], classids: ["c1"], durationperiods: 5 }] }),
      {},
    )
    expect(r.turmas[0]?.aulas[0]?.horaFim).toBe("08:40")
    expect(r.discarded.some((d) => d.includes("estoura os períodos"))).toBe(true)
  })

  it("card com lessonid inexistente é descartado", () => {
    const r = () =>
      transform(tables({ cards: [{ lessonid: "nada", period: "1", days: "100000", classroomids: [] }] }), {})
    // sem nenhuma aula válida, nenhuma turma sai — mas o transform não pode lançar
    expect(r().turmas).toHaveLength(0)
    expect(r().discarded.some((d) => d.includes("lessonid nada inexistente"))).toBe(true)
  })

  it("card com period inexistente é descartado", () => {
    const r = transform(tables({ cards: [{ lessonid: "l1", period: "99", days: "100000", classroomids: [] }] }), {})
    expect(r.turmas).toHaveLength(0)
    expect(r.discarded.some((d) => d.includes("period 99 inexistente"))).toBe(true)
  })

  it("lesson com vários classids gera aula em cada turma", () => {
    const r = transform(
      tables({
        classes: [
          { id: "c1", name: "Turma X", short: "TX" },
          { id: "c2", name: "Turma Y", short: "TY" },
        ],
        lessons: [{ id: "l1", subjectid: "s1", teacherids: [], classids: ["c1", "c2"], durationperiods: 1 }],
      }),
      {},
    )
    expect(r.turmas).toHaveLength(2)
    for (const t of r.turmas) expect(t.aulas).toHaveLength(1)
  })

  it("colisão de id após safeId falha alto", () => {
    expect(() =>
      transform(
        tables({
          classes: [
            { id: "*15", name: "Turma X", short: "TX" },
            { id: "15", name: "Turma Y", short: "TY" },
          ],
          lessons: [{ id: "l1", subjectid: "s1", teacherids: [], classids: ["*15", "15"], durationperiods: 1 }],
        }),
        {},
      ),
    ).toThrow(/id de turma duplicado/)
  })

  it("subject referenciado mas inexistente vira descarte, turma sai sem a matéria", () => {
    const r = transform(
      tables({
        subjects: [],
        lessons: [{ id: "l1", subjectid: "fantasma", teacherids: [], classids: ["c1"], durationperiods: 1 }],
      }),
      {},
    )
    expect(r.discarded.some((d) => d.includes("fantasma"))).toBe(true)
    expect(r.turmas[0]?.materias).toHaveLength(0)
  })
})
