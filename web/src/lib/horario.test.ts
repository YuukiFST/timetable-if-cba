import type { Aula, Materia } from "shared/schema"
import { describe, expect, it } from "vitest"
import { agregarProgresso, calcularHoje, materiasDoCurso, porSemestre } from "./horario"

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
