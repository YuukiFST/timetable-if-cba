import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"

export interface DiffResult {
  readonly changed: boolean
  readonly cursosChanged: boolean
  readonly turmasAlteradas: readonly string[]
  readonly turmasNovas: readonly string[]
  readonly turmasRemovidas: readonly string[]
}

const omitGeneratedAt = (parsed: unknown): unknown => {
  if (parsed === null || typeof parsed !== "object") return parsed
  const { generatedAt: _, ...rest } = parsed as Record<string, unknown>
  return rest
}

/** JSON canônico para comparar conteúdo sem depender de generatedAt ou ordem de chaves. */
export const canonical = (value: unknown): string =>
  JSON.stringify(value, (_k, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )

const parseCanonical = (raw: string): string => {
  try {
    return canonical(omitGeneratedAt(JSON.parse(raw)))
  } catch {
    return raw
  }
}

export async function diffData(
  dataDir: string,
  cursosJson: string,
  turmaFiles: ReadonlyArray<{ id: string; content: string }>,
): Promise<DiffResult> {
  const turmasDir = join(dataDir, "turmas")
  let existingCursos: string | null = null
  let existingTurmaIds: string[] = []

  try {
    existingCursos = await readFile(join(dataDir, "cursos.json"), "utf8")
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e
  }

  try {
    existingTurmaIds = (await readdir(turmasDir))
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""))
      .sort()
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e
  }

  if (existingCursos === null && existingTurmaIds.length === 0) {
    return {
      changed: true,
      cursosChanged: true,
      turmasAlteradas: [],
      turmasNovas: turmaFiles.map((f) => f.id).sort(),
      turmasRemovidas: [],
    }
  }

  const cursosChanged = existingCursos === null || parseCanonical(existingCursos) !== parseCanonical(cursosJson)
  const newIds = new Set(turmaFiles.map((f) => f.id))
  const oldIds = new Set(existingTurmaIds)
  const turmasNovas = [...newIds].filter((id) => !oldIds.has(id)).sort()
  const turmasRemovidas = [...oldIds].filter((id) => !newIds.has(id)).sort()
  const turmasAlteradas: string[] = []

  for (const f of turmaFiles) {
    if (!oldIds.has(f.id)) continue
    try {
      const existing = await readFile(join(turmasDir, `${f.id}.json`), "utf8")
      if (parseCanonical(existing) !== parseCanonical(f.content)) turmasAlteradas.push(f.id)
    } catch {
      turmasAlteradas.push(f.id)
    }
  }
  turmasAlteradas.sort()

  const changed =
    cursosChanged || turmasNovas.length > 0 || turmasRemovidas.length > 0 || turmasAlteradas.length > 0

  return { changed, cursosChanged, turmasAlteradas, turmasNovas, turmasRemovidas }
}

export function formatDiffLog(diff: DiffResult): string {
  if (!diff.changed) return "Sem mudanças nos horários — arquivos não alterados"
  const parts: string[] = []
  if (diff.cursosChanged) parts.push("cursos.json")
  if (diff.turmasNovas.length) parts.push(`${diff.turmasNovas.length} turma(s) nova(s): ${diff.turmasNovas.join(", ")}`)
  if (diff.turmasRemovidas.length)
    parts.push(`${diff.turmasRemovidas.length} turma(s) removida(s): ${diff.turmasRemovidas.join(", ")}`)
  if (diff.turmasAlteradas.length)
    parts.push(`${diff.turmasAlteradas.length} turma(s) alterada(s): ${diff.turmasAlteradas.join(", ")}`)
  return `Mudanças detectadas: ${parts.join("; ")}`
}
