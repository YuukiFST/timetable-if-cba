import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomUUID } from "node:crypto"
import { afterEach, describe, expect, it } from "vitest"
import { rm } from "node:fs/promises"
import { diffData, formatDiffLog } from "./diff-data.js"

const dataDir = join(tmpdir(), `diff-data-test-${randomUUID()}`)

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true })
})

const writeDataset = async (
  cursos: object,
  turmas: ReadonlyArray<{ id: string; body: object }>,
) => {
  await mkdir(join(dataDir, "turmas"), { recursive: true })
  await writeFile(join(dataDir, "cursos.json"), JSON.stringify(cursos), "utf8")
  for (const t of turmas) {
    await writeFile(join(dataDir, "turmas", `${t.id}.json`), JSON.stringify(t.body), "utf8")
  }
}

describe("diffData", () => {
  it("primeira execução = mudança", async () => {
    const r = await diffData(dataDir, '{"cursos":[]}', [{ id: "t1", content: '{"turma":{}}' }])
    expect(r.changed).toBe(true)
    expect(r.turmasNovas).toEqual(["t1"])
  })

  it("ignora generatedAt", async () => {
    await writeDataset(
      { generatedAt: "2026-01-01T00:00:00.000Z", cursos: [{ id: "c1", nome: "X", turmaIds: ["t1"] }] },
      [{ id: "t1", body: { generatedAt: "2026-01-01T00:00:00.000Z", turma: { id: "t1", aulas: [] } } }],
    )
    const cursos = JSON.stringify({
      generatedAt: "2026-07-01T00:00:00.000Z",
      cursos: [{ id: "c1", nome: "X", turmaIds: ["t1"] }],
    })
    const turma = JSON.stringify({
      generatedAt: "2026-07-01T00:00:00.000Z",
      turma: { id: "t1", aulas: [] },
    })
    const r = await diffData(dataDir, cursos, [{ id: "t1", content: turma }])
    expect(r.changed).toBe(false)
  })

  it("detecta turma alterada", async () => {
    await writeDataset(
      { generatedAt: "2026-01-01T00:00:00.000Z", cursos: [] },
      [{ id: "t1", body: { generatedAt: "2026-01-01T00:00:00.000Z", turma: { id: "t1", aulas: [{ diaSemana: 2 }] } } }],
    )
    const r = await diffData(
      dataDir,
      JSON.stringify({ generatedAt: "2026-01-02T00:00:00.000Z", cursos: [] }),
      [
        {
          id: "t1",
          content: JSON.stringify({
            generatedAt: "2026-01-02T00:00:00.000Z",
            turma: { id: "t1", aulas: [{ diaSemana: 4 }] },
          }),
        },
      ],
    )
    expect(r.changed).toBe(true)
    expect(r.turmasAlteradas).toEqual(["t1"])
  })

  it("detecta turma nova e removida", async () => {
    await writeDataset(
      { generatedAt: "2026-01-01T00:00:00.000Z", cursos: [] },
      [{ id: "t1", body: { generatedAt: "2026-01-01T00:00:00.000Z", turma: { id: "t1" } } }],
    )
    const r = await diffData(
      dataDir,
      JSON.stringify({ generatedAt: "2026-01-02T00:00:00.000Z", cursos: [] }),
      [{ id: "t2", content: JSON.stringify({ generatedAt: "2026-01-02T00:00:00.000Z", turma: { id: "t2" } }) }],
    )
    expect(r.turmasNovas).toEqual(["t2"])
    expect(r.turmasRemovidas).toEqual(["t1"])
  })
})

describe("formatDiffLog", () => {
  it("sem mudanças", () => {
    expect(
      formatDiffLog({ changed: false, cursosChanged: false, turmasAlteradas: [], turmasNovas: [], turmasRemovidas: [] }),
    ).toContain("Sem mudanças")
  })

  it("com mudanças", () => {
    expect(
      formatDiffLog({
        changed: true,
        cursosChanged: false,
        turmasAlteradas: ["t1"],
        turmasNovas: [],
        turmasRemovidas: [],
      }),
    ).toContain("t1")
  })
})
