// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest"
import {
  escolherTurma,
  iniciarProgresso,
  migrateProgresso,
  migrarPlanoLegado,
  readProgresso,
  resetProgresso,
  toggleCursando,
  toggleMateria,
  writeProgresso,
} from "./storage"

beforeEach(() => {
  localStorage.clear()
})

describe("iniciarProgresso", () => {
  it("grava cursando vazio e arrays ordenados", () => {
    iniciarProgresso("t1", ["m2", "m1"])
    expect(readProgresso()).toEqual({
      version: 2,
      turmaId: "t1",
      materiasConcluidas: ["m1", "m2"],
      cursando: [],
    })
  })
})

describe("toggleMateria", () => {
  beforeEach(() => iniciarProgresso("t1", []))

  it("marca matéria como feita", () => {
    toggleMateria("m1")
    expect(readProgresso()?.materiasConcluidas).toEqual(["m1"])
  })

  it("remove matéria feita", () => {
    iniciarProgresso("t1", ["m1"])
    toggleMateria("m1")
    expect(readProgresso()?.materiasConcluidas).toEqual([])
  })

  it("feita e cursando são mutuamente exclusivos", () => {
    toggleCursando("m1")
    toggleMateria("m1")
    expect(readProgresso()?.materiasConcluidas).toEqual(["m1"])
    expect(readProgresso()?.cursando).toEqual([])

    toggleCursando("m1")
    expect(readProgresso()?.materiasConcluidas).toEqual([])
    expect(readProgresso()?.cursando).toEqual(["m1"])
  })
})

describe("escolherTurma", () => {
  it("preserva feitas e cursando ao trocar turma do mesmo curso", () => {
    iniciarProgresso("t1", ["m1"])
    toggleCursando("m2")
    escolherTurma("t2", "c1", "c1")
    expect(readProgresso()).toEqual({
      version: 2,
      turmaId: "t2",
      materiasConcluidas: ["m1"],
      cursando: ["m2"],
    })
  })

  it("zera progresso ao trocar para outro curso", () => {
    iniciarProgresso("t1", ["m1"])
    toggleCursando("m2")
    escolherTurma("t9", "c2", "c1")
    expect(readProgresso()).toEqual({
      version: 2,
      turmaId: "t9",
      materiasConcluidas: [],
      cursando: [],
    })
  })
})

describe("resetProgresso", () => {
  it("zera feitas e cursando preservando turmaId", () => {
    iniciarProgresso("t1", ["m1"])
    toggleCursando("m2")
    resetProgresso()
    expect(readProgresso()?.materiasConcluidas).toEqual([])
    expect(readProgresso()?.cursando).toEqual([])
    expect(readProgresso()?.turmaId).toBe("t1")
  })
})

describe("readProgresso", () => {
  it("retorna null para versão futura irrecuperável", () => {
    localStorage.setItem(
      "horarios-ifmt-progresso",
      JSON.stringify({ version: 99, turmaId: "t1", materiasConcluidas: [], cursando: [] }),
    )
    expect(readProgresso()).toBeNull()
  })

  it("migra v1 para v2 preservando dados", () => {
    localStorage.setItem(
      "horarios-ifmt-progresso",
      JSON.stringify({ version: 1, turmaId: "t1", materiasConcluidas: ["m1"], cursando: ["m2"] }),
    )
    expect(readProgresso()).toEqual({
      version: 2,
      turmaId: "t1",
      materiasConcluidas: ["m1"],
      cursando: ["m2"],
    })
  })

  it("retorna null para JSON inválido", () => {
    localStorage.setItem("horarios-ifmt-progresso", "not-json{")
    expect(readProgresso()).toBeNull()
  })
})

describe("migrateProgresso", () => {
  it("rejeita versão futura", () => {
    expect(migrateProgresso({ version: 99, turmaId: "t1", materiasConcluidas: [], cursando: [] })).toBeNull()
  })

  it("rejeita turmaId inválido", () => {
    expect(migrateProgresso({ version: 2, turmaId: "../evil", materiasConcluidas: [], cursando: [] })).toBeNull()
    expect(migrateProgresso({ version: 2, turmaId: "", materiasConcluidas: [], cursando: [] })).toBeNull()
    expect(migrateProgresso({ version: 2, turmaId: "x-517", materiasConcluidas: [], cursando: [] })).toBeNull()
  })

  it("aceita turmaId válido do scraper", () => {
    expect(migrateProgresso({ version: 2, turmaId: "t-517", materiasConcluidas: [], cursando: [] })).toEqual({
      version: 2,
      turmaId: "t-517",
      materiasConcluidas: [],
      cursando: [],
    })
    expect(migrateProgresso({ version: 2, turmaId: "t1", materiasConcluidas: [], cursando: [] })).toEqual({
      version: 2,
      turmaId: "t1",
      materiasConcluidas: [],
      cursando: [],
    })
  })
})

describe("readProgresso turmaId inválido", () => {
  it("retorna null para turmaId inválido no localStorage", () => {
    localStorage.setItem(
      "horarios-ifmt-progresso",
      JSON.stringify({ version: 2, turmaId: "../evil", materiasConcluidas: [], cursando: [] }),
    )
    expect(readProgresso()).toBeNull()
  })
})

describe("migrarPlanoLegado", () => {
  it("copia ids do plano legado para cursando e remove chave plano", () => {
    writeProgresso({ version: 2, turmaId: "t1", materiasConcluidas: [], cursando: [] })
    localStorage.setItem("horarios-ifmt-plano", JSON.stringify({ turmaId: "t1", materiaIds: ["m1", "m2"] }))
    migrarPlanoLegado()
    expect(readProgresso()?.cursando).toEqual(["m1", "m2"])
    expect(localStorage.getItem("horarios-ifmt-plano")).toBeNull()
  })

  it("turmaId diferente: descarta o plano sem copiar", () => {
    writeProgresso({ version: 2, turmaId: "t1", materiasConcluidas: [], cursando: [] })
    localStorage.setItem("horarios-ifmt-plano", JSON.stringify({ turmaId: "t-outra", materiaIds: ["m1"] }))
    migrarPlanoLegado()
    expect(readProgresso()?.cursando).toEqual([])
    expect(localStorage.getItem("horarios-ifmt-plano")).toBeNull()
  })

  it("cursando já preenchido: não sobrescreve nem apaga o plano", () => {
    writeProgresso({ version: 2, turmaId: "t1", materiasConcluidas: [], cursando: ["m9"] })
    localStorage.setItem("horarios-ifmt-plano", JSON.stringify({ turmaId: "t1", materiaIds: ["m1"] }))
    migrarPlanoLegado()
    expect(readProgresso()?.cursando).toEqual(["m9"])
    expect(localStorage.getItem("horarios-ifmt-plano")).not.toBeNull()
  })

  it("JSON corrompido: remove a chave sem quebrar", () => {
    writeProgresso({ version: 2, turmaId: "t1", materiasConcluidas: [], cursando: [] })
    localStorage.setItem("horarios-ifmt-plano", "{nao é json")
    expect(() => migrarPlanoLegado()).not.toThrow()
    expect(localStorage.getItem("horarios-ifmt-plano")).toBeNull()
    expect(readProgresso()?.cursando).toEqual([])
  })
})

describe("escolherTurma", () => {
  it("cursoIdAtual null: troca de curso zera progresso", () => {
    writeProgresso({ version: 2, turmaId: "t1", materiasConcluidas: ["m1"], cursando: ["m2"] })
    escolherTurma("t2", "c-novo", null)
    expect(readProgresso()).toEqual({ version: 2, turmaId: "t2", materiasConcluidas: [], cursando: [] })
  })

  it("mesmo curso: preserva progresso ao trocar de turma", () => {
    writeProgresso({ version: 2, turmaId: "t1", materiasConcluidas: ["m1"], cursando: ["m2"] })
    escolherTurma("t2", "c1", "c1")
    expect(readProgresso()).toEqual({ version: 2, turmaId: "t2", materiasConcluidas: ["m1"], cursando: ["m2"] })
  })
})
