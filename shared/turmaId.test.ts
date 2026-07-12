import { describe, expect, it } from "vitest"
import { isTurmaIdValid } from "./turmaId"

describe("isTurmaIdValid", () => {
  it("aceita ids de turma do scraper", () => {
    expect(isTurmaIdValid("t-517")).toBe(true)
    expect(isTurmaIdValid("t1")).toBe(true)
    expect(isTurmaIdValid("t-519")).toBe(true)
    expect(isTurmaIdValid("t205")).toBe(true)
  })

  it("rejeita path traversal, vazio e prefixo errado", () => {
    expect(isTurmaIdValid("../evil")).toBe(false)
    expect(isTurmaIdValid("../etc/passwd")).toBe(false)
    expect(isTurmaIdValid("")).toBe(false)
    expect(isTurmaIdValid("x-517")).toBe(false)
  })
})
