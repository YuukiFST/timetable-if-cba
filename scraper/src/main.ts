import { Effect, Schema } from "effect"
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { ArquivoCursos, ArquivoTurma, SCHEMA_VERSION } from "shared/schema"
import { fetchRegularTT, fetchTimetables, pickTimetable } from "./edupage.js"
import { diffData, formatDiffLog } from "./diff-data.js"
import { transform, TransformError, type Overrides } from "./transform.js"
import { writeDataAtomically } from "./write-data.js"

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const dataDir = join(root, "web", "public", "data")

// JSON com chaves ordenadas → diffs limpos no git (PRD §6.1).
const stableStringify = (value: unknown): string =>
  JSON.stringify(value, (_k, v: unknown) =>
    v !== null && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
    2,
  ) + "\n"

const pipeline = Effect.gen(function* () {
  const overrides: Overrides = yield* Effect.promise(async () => {
    try {
      return JSON.parse(await readFile(join(root, "scraper", "overrides.json"), "utf8")) as Overrides
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return {}
      throw e
    }
  })

  const timetables = yield* fetchTimetables
  const tt = pickTimetable(timetables)
  if (!tt) return yield* new TransformError({ message: "nenhum timetable publicado" })
  yield* Effect.log(`Timetable ${tt.tt_num}: ${tt.text}`)

  const raw = yield* fetchRegularTT(tt.tt_num)
  const { cursos, turmas, discarded } = yield* Effect.try({
    try: () => transform(raw, overrides),
    catch: (e) => (e instanceof TransformError ? e : new TransformError({ message: String(e) })),
  })
  for (const d of discarded) yield* Effect.logWarning(`descartado: ${d}`)

  const generatedAt = new Date().toISOString()
  // Valida contra os schemas compartilhados antes de escrever qualquer arquivo.
  const cursosFile = yield* Schema.decodeUnknown(ArquivoCursos)({ schemaVersion: SCHEMA_VERSION, generatedAt, cursos })
  const turmaFiles = yield* Effect.all(
    turmas.map((turma) => Schema.decodeUnknown(ArquivoTurma)({ schemaVersion: SCHEMA_VERSION, generatedAt, turma })),
  )

  const cursosContent = stableStringify(cursosFile)
  const turmaContents = turmaFiles.map((f) => ({ id: f.turma.id, content: stableStringify(f) }))
  const diff = yield* Effect.promise(() => diffData(dataDir, cursosContent, turmaContents))
  yield* Effect.log(formatDiffLog(diff))

  if (!diff.changed) return

  // Escrita só depois de fetch+decode+transform completos: falha preserva JSON anterior.
  yield* Effect.promise(() => writeDataAtomically(dataDir, cursosContent, turmaContents))
  yield* Effect.log(`OK: ${cursos.length} cursos, ${turmas.length} turmas, ${discarded.length} itens descartados`)
})

Effect.runPromise(pipeline).catch((e) => {
  console.error(e)
  process.exit(1)
})
