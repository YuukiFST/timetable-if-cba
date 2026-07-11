import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { randomUUID } from "node:crypto"

type FsDeps = {
  mkdir: typeof mkdir
  readdir: typeof readdir
  rename: typeof rename
  rm: typeof rm
  writeFile: typeof writeFile
}

const defaultFs: FsDeps = { mkdir, readdir, rename, rm, writeFile }

export async function writeDataAtomically(
  dataDir: string,
  cursosJson: string,
  turmaFiles: ReadonlyArray<{ id: string; content: string }>,
  fs: FsDeps = defaultFs,
): Promise<void> {
  const stagingDir = join(dataDir, `.staging-${randomUUID()}`)
  const turmasDir = join(dataDir, "turmas")
  const turmasBak = join(dataDir, "turmas.bak")
  const turmasNew = join(dataDir, "turmas.new")

  try {
    await fs.mkdir(join(stagingDir, "turmas"), { recursive: true })
    await fs.writeFile(join(stagingDir, "cursos.json"), cursosJson, "utf8")
    for (const f of turmaFiles) {
      await fs.writeFile(join(stagingDir, "turmas", `${f.id}.json`), f.content, "utf8")
    }

    const stagedTurmas = await fs.readdir(join(stagingDir, "turmas"))
    if (stagedTurmas.length !== turmaFiles.length) {
      throw new Error(`staging incompleto: ${stagedTurmas.length}/${turmaFiles.length} turmas`)
    }

    await fs.rm(turmasBak, { recursive: true, force: true })
    try {
      await fs.rename(turmasDir, turmasBak)
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e
    }

    try {
      await fs.rename(join(stagingDir, "turmas"), turmasNew)
      await fs.rename(turmasNew, turmasDir)
      await fs.rename(join(stagingDir, "cursos.json"), join(dataDir, "cursos.json"))
    } catch (e) {
      await fs.rm(turmasDir, { recursive: true, force: true })
      try {
        await fs.rename(turmasBak, turmasDir)
      } catch {
        /* turmas.bak ausente */
      }
      throw e
    }

    await fs.rm(turmasBak, { recursive: true, force: true })
  } finally {
    await fs.rm(stagingDir, { recursive: true, force: true })
  }
}
