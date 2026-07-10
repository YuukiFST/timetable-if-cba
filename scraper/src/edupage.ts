import { Data, Effect, Schedule, Schema } from "effect"

// Endpoints internos do EdUpage (engenharia reversa, 2026-07 — ver README).
// Ambos aceitam POST JSON sem sessão:
//   ttviewer.js?__func=getTTViewerData  body {"__args":[null,<ano>],"__gsh":"00000000"}
//     → r.regular.timetables: [{ tt_num, year, text, datefrom, hidden }]
//   regulartt.js?__func=regularttGetData  body {"__args":[null,"<tt_num>"],"__gsh":"00000000"}
//     → r.dbiAccessorRes.tables: [{ id: "classes"|"subjects"|..., data_rows: [...] }]
const BASE = "https://ifmtcba.edupage.org/timetable/server"

export class FetchError extends Data.TaggedError("FetchError")<{ url: string; cause: unknown }> {}
export class DecodeError extends Data.TaggedError("DecodeError")<{ what: string; cause: unknown }> {}

// --- Schemas das respostas cruas (só os campos que usamos) ---

export const TimetableRef = Schema.Struct({
  tt_num: Schema.String,
  year: Schema.Number,
  text: Schema.String,
  datefrom: Schema.String,
  hidden: Schema.optional(Schema.Boolean),
})
export type TimetableRef = typeof TimetableRef.Type

const TTViewerResponse = Schema.Struct({
  r: Schema.Struct({
    regular: Schema.Struct({ timetables: Schema.Array(TimetableRef) }),
  }),
})

const RawTable = Schema.Struct({
  id: Schema.String,
  data_rows: Schema.Array(Schema.Unknown),
})

const RegularTTResponse = Schema.Struct({
  r: Schema.Struct({
    dbiAccessorRes: Schema.Struct({ tables: Schema.Array(RawTable) }),
  }),
})

// Linhas das tabelas que o transform consome (decode tolerante por item).
export const RawClass = Schema.Struct({ id: Schema.String, name: Schema.String, short: Schema.String })
export const RawSubject = Schema.Struct({ id: Schema.String, name: Schema.String, short: Schema.String })
export const RawTeacher = Schema.Struct({ id: Schema.String, short: Schema.String })
export const RawClassroom = Schema.Struct({ id: Schema.String, short: Schema.String })
export const RawPeriod = Schema.Struct({
  id: Schema.String,
  period: Schema.String,
  starttime: Schema.String,
  endtime: Schema.String,
})
export const RawLesson = Schema.Struct({
  id: Schema.String,
  subjectid: Schema.String,
  teacherids: Schema.Array(Schema.String),
  classids: Schema.Array(Schema.String),
  durationperiods: Schema.optionalWith(Schema.Number, { default: () => 1 }),
})
export const RawCard = Schema.Struct({
  lessonid: Schema.String,
  period: Schema.String,
  days: Schema.String, // bitmask "010000" = terça
  classroomids: Schema.Array(Schema.String),
})

export interface RawTables {
  readonly tables: ReadonlyArray<{ readonly id: string; readonly data_rows: ReadonlyArray<unknown> }>
}

const post = (url: string, args: ReadonlyArray<unknown>) =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ __args: args, __gsh: "00000000" }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return (await res.json()) as unknown
    },
    catch: (cause) => new FetchError({ url, cause }),
  }).pipe(Effect.retry(Schedule.exponential("1 second").pipe(Schedule.intersect(Schedule.recurs(2)))))

const decode = <A, I>(schema: Schema.Schema<A, I>, what: string) => (input: unknown) =>
  Schema.decodeUnknown(schema)(input).pipe(
    Effect.mapError((cause) => new DecodeError({ what, cause })),
  )

export const fetchTimetables = post(`${BASE}/ttviewer.js?__func=getTTViewerData`, [null, new Date().getFullYear()]).pipe(
  Effect.flatMap(decode(TTViewerResponse, "getTTViewerData")),
  Effect.map((r) => r.r.regular.timetables),
)

export const fetchRegularTT = (ttNum: string): Effect.Effect<RawTables, FetchError | DecodeError> =>
  post(`${BASE}/regulartt.js?__func=regularttGetData`, [null, ttNum]).pipe(
    Effect.flatMap(decode(RegularTTResponse, "regularttGetData")),
    Effect.map((r) => r.r.dbiAccessorRes),
  )

// Grade vigente: a de datefrom mais recente (inclui a do próximo semestre já publicada).
export const pickTimetable = (tts: ReadonlyArray<TimetableRef>): TimetableRef | undefined =>
  [...tts].sort((a, b) => a.datefrom.localeCompare(b.datefrom)).at(-1)
