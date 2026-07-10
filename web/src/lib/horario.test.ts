import type { Aula, Materia, Turma } from "shared/schema"
import { describe, expect, it } from "vitest"
import { agregarProgresso, aulasSobrepoem, calcularHoje, detectarChoques, materiasDoCurso, porSemestre } from "./horario"

const aula = (diaSemana: number, horaInicio: string, horaFim: string, materiaId = "m1"): Aula => ({
  diaSemana,
  slot: 0,
  horaInicio,
  horaFim,
  materiaId,
})

// quarta-feira 2026-07-08
const quarta = (h: number, m = 0) => new Date(2026, 6, 8, h, m)

describe("calcularHoje", () => {
  const aulas = [aula(2, "07:00", "07:45"), aula(2, "07:45", "08:30"), aula(4, "13:00", "13:45")]

  it("destaca a aula em andamento", () => {
    const r = calcularHoje(aulas, quarta(7, 20))
    expect(r.ehHoje).toBe(true)
    expect(r.atualIdx).toBe(0)
    expect(r.proximaIdx).toBe(1)
  })

  it("antes da primeira aula: nenhuma atual, próxima é a primeira", () => {
    const r = calcularHoje(aulas, quarta(6))
    expect(r.atualIdx).toBe(-1)
    expect(r.proximaIdx).toBe(0)
  })

  it("depois da última aula do dia: mostra o próximo dia letivo", () => {
    const r = calcularHoje(aulas, quarta(22))
    expect(r.ehHoje).toBe(false)
    expect(r.dia).toBe(4)
    expect(r.proximaIdx).toBe(0)
  })

  it("domingo: mostra o primeiro dia letivo com aula", () => {
    const domingo = new Date(2026, 6, 5, 10)
    const r = calcularHoje(aulas, domingo)
    expect(r.ehHoje).toBe(false)
    expect(r.dia).toBe(2)
  })

  it("sem nenhuma aula: vazio sem quebrar", () => {
    const r = calcularHoje([], quarta(10))
    expect(r.aulas).toEqual([])
    expect(r.proximaIdx).toBe(-1)
  })
})

const mat = (id: string, semestre?: number): Materia => ({ id, nome: `Matéria ${id}`, ...(semestre !== undefined ? { semestre } : {}) })

describe("agregarProgresso", () => {
  it("conta feitas, faltantes e % arredondado", () => {
    const r = agregarProgresso([mat("a"), mat("b"), mat("c")], new Set(["a", "c"]))
    expect(r).toEqual({ total: 3, feitas: 2, faltam: 1, pct: 67 })
  })
  it("curso vazio: 0% sem divisão por zero", () => {
    expect(agregarProgresso([], new Set()).pct).toBe(0)
  })
})

describe("porSemestre", () => {
  it("agrupa ordenado, sem-semestre por último", () => {
    const grupos = porSemestre([mat("a", 2), mat("b"), mat("c", 1)])
    expect(grupos.map(([s]) => s)).toEqual([1, 2, null])
  })
})

describe("materiasDoCurso", () => {
  it("une por id, preferindo a versão com semestre", () => {
    const r = materiasDoCurso([{ materias: [mat("a")] }, { materias: [mat("a", 3), mat("b", 1)] }])
    expect(r.find((m) => m.id === "a")?.semestre).toBe(3)
    expect(r).toHaveLength(2)
  })
})

describe("aulasSobrepoem", () => {
  it("borda fim==inicio não choca", () => {
    expect(aulasSobrepoem(aula(2, "07:00", "07:45"), aula(2, "07:45", "08:30"))).toBe(false)
  })
  it("sobreposição parcial no mesmo dia choca", () => {
    expect(aulasSobrepoem(aula(2, "07:00", "08:00"), aula(2, "07:45", "08:30"))).toBe(true)
  })
  it("dias diferentes nunca chocam", () => {
    expect(aulasSobrepoem(aula(2, "07:00", "08:00"), aula(3, "07:00", "08:00"))).toBe(false)
  })
})

const turma = (id: string, materias: Materia[], aulas: Aula[]): Turma => ({
  id,
  nome: id,
  cursoId: "c1",
  materias,
  aulas,
})

describe("detectarChoques", () => {
  // grade atual: Física (m1) terça 19:00–20:40
  const atual = turma("A", [mat("m1")], [aula(1, "19:00", "20:40", "m1")])

  it("matéria em duas turmas: uma choca, outra não", () => {
    const t2 = turma("B", [mat("m2")], [aula(1, "19:00", "20:40", "m2")]) // choca
    const t3 = turma("C", [mat("m2")], [aula(3, "19:00", "20:40", "m2")]) // sem choque
    const mapa = detectarChoques(atual, [atual, t2, t3])
    const info = mapa.get("m2")
    expect(info).toHaveLength(2)
    const b = info?.find((c) => c.turma.id === "B")
    const c = info?.find((c) => c.turma.id === "C")
    expect(b?.conflitos).toHaveLength(1)
    expect(b?.conflitos[0]?.materiaContraNome).toBe("Matéria m1")
    expect(c?.conflitos).toHaveLength(0)
  })

  it("matéria já na grade atual fica fora do mapa", () => {
    const t2 = turma("B", [mat("m1")], [aula(1, "19:00", "20:40", "m1")])
    expect(detectarChoques(atual, [atual, t2]).has("m1")).toBe(false)
  })

  it("sem turmas extras: mapa vazio", () => {
    expect(detectarChoques(atual, [atual]).size).toBe(0)
  })
})
