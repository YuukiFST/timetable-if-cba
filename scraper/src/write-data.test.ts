import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { randomUUID } from "node:crypto"
import { afterEach, describe, expect, it } from "vitest"
import { writeDataAtomically } from "./write-data.js"

const dataDir = join(tmpdir(), `write-data-test-${randomUUID()}`)

afterEach(async () => {
  await rm(dataDir, { recursive: true, force: true })
})

describe("writeDataAtomically", () => {
  it("escreve cursos.json e turmas substituindo dataset legado", async () => {
    await mkdir(join(dataDir, "turmas"), { recursive: true })
    await writeFile(join(dataDir, "cursos.json"), '{"old":true}\n', "utf8")
    await writeFile(join(dataDir, "turmas", "legacy.json"), '{"legacy":true}\n', "utf8")

    await writeDataAtomically(
      dataDir,
      '{"cursos":[]}\n',
      [
        { id: "t1", content: '{"id":"t1"}\n' },
        { id: "t2", content: '{"id":"t2"}\n' },
      ],
    )

    expect(await readFile(join(dataDir, "cursos.json"), "utf8")).toBe('{"cursos":[]}\n')
    const turmas = (await readdir(join(dataDir, "turmas"))).sort()
    expect(turmas).toEqual(["t1.json", "t2.json"])
    expect(await readFile(join(dataDir, "turmas", "t1.json"), "utf8")).toBe('{"id":"t1"}\n')
  })

  it("falha parcial não corrompe dataset anterior", async () => {
    await mkdir(join(dataDir, "turmas"), { recursive: true })
    await writeFile(join(dataDir, "cursos.json"), '{"keep":true}\n', "utf8")
    await writeFile(join(dataDir, "turmas", "t1.json"), '{"id":"t1"}\n', "utf8")

    const fs = await import("node:fs/promises")
    let writes = 0
    const failingFs = {
      mkdir: fs.mkdir,
      readdir: fs.readdir,
      rename: fs.rename,
      rm: fs.rm,
      writeFile: async (...args: Parameters<typeof fs.writeFile>) => {
        writes++
        if (writes === 2) throw new Error("falha simulada")
        return fs.writeFile(...args)
      },
    }

    await expect(
      writeDataAtomically(
        dataDir,
        '{"new":true}\n',
        [
          { id: "t1", content: '{"id":"t1"}\n' },
          { id: "t2", content: '{"id":"t2"}\n' },
        ],
        failingFs,
      ),
    ).rejects.toThrow("falha simulada")

    expect(await readFile(join(dataDir, "cursos.json"), "utf8")).toBe('{"keep":true}\n')
    expect(await readdir(join(dataDir, "turmas"))).toEqual(["t1.json"])
  })
})
