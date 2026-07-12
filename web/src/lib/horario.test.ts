import type { Aula, Materia, Turma } from "shared/schema"
import { describe, expect, it } from "vitest"
import {
  agregarProgresso,
  aulasSobrepoem,
  aulasVigentes,
  calcularHoje,
  detectarChoques,
  detectarChoquesPlano,
  chaveCelula,
  diaInicialPorMateria,
  fmtHorarioMateria,
  materiasDoCurso,
  mesclarAulas,
  montarTabelaPlano,
  ofertasPorMateria,
  porSemestre,
} from "./horario"

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

describe("mesclarAulas", () => {
  // caso real: 2 aulas coladas + intervalo 15min + 2 aulas coladas, mesma matéria
  const bloco4 = [
    aula(2, "18:50", "19:40"),
    aula(2, "19:40", "20:30"),
    aula(2, "20:45", "21:35"),
    aula(2, "21:35", "22:25"),
  ]

  it("4 aulas com intervalo de 15min viram 1 bloco", () => {
    const r = mesclarAulas(bloco4)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ horaInicio: "18:50", horaFim: "22:25" })
  })

  it("gap > 25min não mescla", () => {
    const r = mesclarAulas([aula(2, "07:00", "07:50"), aula(2, "08:20", "09:10")])
    expect(r).toHaveLength(2)
  })

  it("matérias diferentes coladas não mesclam", () => {
    const r = mesclarAulas([aula(2, "07:00", "07:50", "m1"), aula(2, "07:50", "08:40", "m2")])
    expect(r).toHaveLength(2)
  })

  it("dias diferentes não mesclam", () => {
    const r = mesclarAulas([aula(2, "07:00", "07:50"), aula(3, "07:50", "08:40")])
    expect(r).toHaveLength(2)
  })

  it("aula contida não encolhe o bloco", () => {
    const r = mesclarAulas([aula(2, "07:00", "09:00"), aula(2, "07:30", "08:00")])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ horaInicio: "07:00", horaFim: "09:00" })
  })

  it("durante o intervalo o bloco mesclado é a aula atual", () => {
    const r = calcularHoje(mesclarAulas(bloco4), quarta(20, 35))
    expect(r.atualIdx).toBe(0)
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
    const mapa = detectarChoques(atual, [atual, t2, t3], new Set())
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
    expect(detectarChoques(atual, [atual, t2], new Set()).has("m1")).toBe(false)
  })

  it("sem turmas extras: mapa vazio", () => {
    expect(detectarChoques(atual, [atual], new Set()).size).toBe(0)
  })

  it("matéria da grade já concluída não gera choque", () => {
    const t2 = turma("B", [mat("m2")], [aula(1, "19:00", "20:40", "m2")])
    const info = detectarChoques(atual, [atual, t2], new Set(["m1"])).get("m2")
    expect(info?.[0]?.conflitos).toHaveLength(0)
  })

  it("candidata concluída fica fora do mapa", () => {
    const t2 = turma("B", [mat("m2")], [aula(1, "19:00", "20:40", "m2")])
    expect(detectarChoques(atual, [atual, t2], new Set(["m2"])).has("m2")).toBe(false)
  })

  it("aula candidata em dois blocos consecutivos = um conflito só", () => {
    // grade atual como bloco único 18:50–22:25; candidata em 2 sub-blocos (gap 15min)
    const grade = turma("A", [mat("m1")], [aula(4, "18:50", "22:25", "m1")])
    const t2 = turma("B", [mat("m2")], [aula(4, "18:50", "20:30", "m2"), aula(4, "20:45", "22:25", "m2")])
    const info = detectarChoques(grade, [grade, t2], new Set()).get("m2")
    expect(info?.[0]?.conflitos).toHaveLength(1)
    expect(info?.[0]?.conflitos[0]?.aula).toMatchObject({ horaInicio: "18:50", horaFim: "22:25" })
  })
})

describe("ofertasPorMateria", () => {
  it("agrupa aulas por matéria e mescla blocos consecutivos", () => {
    const t = turma("A", [mat("m1"), mat("m2")], [
      aula(2, "18:50", "20:30", "m1"),
      aula(2, "20:45", "22:25", "m1"),
      aula(3, "13:00", "13:50", "m2"),
    ])
    const ofertas = ofertasPorMateria(t, [t])
    expect(ofertas.get("m1")?.blocos).toHaveLength(1)
    expect(ofertas.get("m1")?.blocos[0]).toMatchObject({ horaInicio: "18:50", horaFim: "22:25" })
    expect(ofertas.get("m2")?.blocos).toHaveLength(1)
    expect(ofertas.get("m1")?.turmaNome).toBe("A")
  })

  it("matéria na grade usa só horários de turmaAtual", () => {
    const atual = turma("A", [mat("m1")], [aula(1, "07:00", "08:00", "m1")])
    const outra = turma("B", [mat("m1")], [aula(3, "13:00", "14:00", "m1")])
    const ofertas = ofertasPorMateria(atual, [atual, outra])
    expect(ofertas.get("m1")?.blocos).toEqual([aula(1, "07:00", "08:00", "m1")])
    expect(ofertas.get("m1")?.turmaNome).toBe("A")
  })

  it("matéria fora da grade usa horários de outra turma", () => {
    const atual = turma("A", [mat("m1")], [aula(1, "07:00", "08:00", "m1")])
    const outra = turma("B", [mat("m2")], [aula(3, "13:00", "14:00", "m2")])
    const ofertas = ofertasPorMateria(atual, [atual, outra])
    expect(ofertas.get("m2")?.blocos).toEqual([aula(3, "13:00", "14:00", "m2")])
    expect(ofertas.get("m2")?.turmaNome).toBe("B")
  })
})

describe("detectarChoquesPlano", () => {
  const item = (materiaId: string, blocos: Aula[]) => ({ materiaId, blocos })

  it("horários diversos no mesmo dia não chocam", () => {
    const r = detectarChoquesPlano([
      item("m1", [aula(0, "13:00", "14:40", "m1")]),
      item("m2", [aula(0, "18:50", "20:30", "m2")]),
    ])
    expect(r.pares).toHaveLength(0)
    expect(r.materiasEmChoque.size).toBe(0)
  })

  it("sobreposição real no mesmo dia = um par", () => {
    const r = detectarChoquesPlano([
      item("m1", [aula(0, "13:00", "14:40", "m1")]),
      item("m2", [aula(0, "14:00", "15:30", "m2")]),
    ])
    expect(r.pares).toHaveLength(1)
    expect([...r.materiasEmChoque].sort()).toEqual(["m1", "m2"])
  })

  it("blocos já mesclados sobrepondo = um par só, não dois", () => {
    const r = detectarChoquesPlano([
      item("m1", [aula(4, "18:50", "22:25", "m1")]),
      item("m2", [aula(4, "19:40", "21:35", "m2")]),
    ])
    expect(r.pares).toHaveLength(1)
  })

  it("dias diferentes nunca chocam", () => {
    const r = detectarChoquesPlano([
      item("m1", [aula(0, "13:00", "14:40", "m1")]),
      item("m2", [aula(1, "13:00", "14:40", "m2")]),
    ])
    expect(r.pares).toHaveLength(0)
  })
})

describe("aulasVigentes", () => {
  const atual = turma("A", [mat("m1"), mat("m2")], [
    aula(0, "13:00", "14:40", "m1"),
    aula(1, "13:00", "14:40", "m2"),
  ])
  const outra = turma("B", [mat("m3")], [aula(2, "18:50", "20:30", "m3")])

  it("cursando não-vazio: só as marcadas, cruzando turmas", () => {
    const r = aulasVigentes(atual, [atual, outra], new Set(["m1", "m3"]), new Set())
    expect(r.map((a) => a.materiaId).sort()).toEqual(["m1", "m3"])
  })

  it("matéria na grade usa horário da turma atual", () => {
    const outraComMesma = turma("B", [mat("m1")], [aula(2, "18:50", "20:30", "m1")])
    const r = aulasVigentes(atual, [atual, outraComMesma], new Set(["m1"]), new Set())
    expect(r).toEqual([aula(0, "13:00", "14:40", "m1")])
  })

  it("matéria fora da grade usa horário da turma ofertante", () => {
    const r = aulasVigentes(atual, [atual, outra], new Set(["m3"]), new Set())
    expect(r).toEqual([aula(2, "18:50", "20:30", "m3")])
  })

  it("matéria em cursando e concluída (dado corrompido) não aparece", () => {
    const r = aulasVigentes(atual, [atual, outra], new Set(["m1", "m3"]), new Set(["m1"]))
    expect(r.map((a) => a.materiaId)).toEqual(["m3"])
  })

  it("cursando vazio: retorna array vazio (sem fallback)", () => {
    const r = aulasVigentes(atual, [atual, outra], new Set(), new Set(["m2"]))
    expect(r).toEqual([])
  })

  it("cursando vazio mesmo sem concluídas: retorna vazio", () => {
    const r = aulasVigentes(atual, [atual, outra], new Set(), new Set())
    expect(r).toEqual([])
  })
})

describe("montarTabelaPlano", () => {
  // m1 em 2 dias; m2 no mesmo dia+horário que m1 (choque); m3 sozinha noutra faixa
  const t = turma("A", [mat("m1"), mat("m2"), mat("m3")], [
    aula(0, "13:00", "14:40", "m1"),
    aula(1, "13:45", "15:15", "m1"),
    aula(0, "13:00", "14:40", "m2"),
    aula(0, "18:50", "20:30", "m3"),
  ])
  const ofertas = ofertasPorMateria(t, [t])
  const pool = [mat("m1"), mat("m2"), mat("m3")]

  it("faixas ordenadas por horário e dias só os com aula", () => {
    const tab = montarTabelaPlano(pool, ofertas)
    expect(tab.faixas).toEqual(["13:00", "13:45", "18:50"])
    expect(tab.dias).toEqual([0, 1])
  })

  it("matéria em dois dias aparece em duas células", () => {
    const tab = montarTabelaPlano(pool, ofertas)
    expect(tab.celulas.get(chaveCelula(0, "13:00"))).toContain("m1")
    expect(tab.celulas.get(chaveCelula(1, "13:45"))).toEqual(["m1"])
  })

  it("duas matérias no mesmo dia+início caem na mesma célula", () => {
    const tab = montarTabelaPlano(pool, ofertas)
    expect(tab.celulas.get(chaveCelula(0, "13:00"))?.sort()).toEqual(["m1", "m2"])
  })

  it("matéria sem oferta não entra na tabela", () => {
    const tab = montarTabelaPlano([...pool, mat("m4")], ofertas)
    expect([...tab.celulas.values()].flat()).not.toContain("m4")
  })
})

describe("fmtHorarioMateria", () => {
  it("formata blocos mesclados no mesmo dia", () => {
    expect(fmtHorarioMateria([aula(0, "18:50", "20:30"), aula(0, "20:45", "22:25")])).toBe("Seg 18:50–22:25")
  })

  it("formata todos os blocos em dias diferentes", () => {
    expect(fmtHorarioMateria([aula(0, "18:50", "20:30"), aula(2, "13:00", "14:40")])).toBe(
      "Seg 18:50–20:30 · Qua 13:00–14:40",
    )
  })

  it("retorna null sem blocos", () => {
    expect(fmtHorarioMateria([])).toBeNull()
  })
})

describe("diaInicialPorMateria", () => {
  it("usa o menor dia quando a matéria tem aulas em dias diferentes", () => {
    const t = turma("A", [mat("m1")], [aula(3, "19:00", "20:40", "m1"), aula(1, "19:00", "20:40", "m1")])
    expect(diaInicialPorMateria([t]).get("m1")).toBe(1)
  })

  it("inclui sábado (dia 5)", () => {
    const t = turma("A", [mat("m1")], [aula(5, "08:00", "12:00", "m1")])
    expect(diaInicialPorMateria([t]).get("m1")).toBe(5)
  })

  it("matéria sem aula não aparece no mapa", () => {
    const t = turma("A", [mat("m1"), mat("m2")], [aula(2, "07:00", "08:00", "m1")])
    const dia = diaInicialPorMateria([t])
    expect(dia.get("m1")).toBe(2)
    expect(dia.has("m2")).toBe(false)
  })
})
