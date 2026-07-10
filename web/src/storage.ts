import { Either, Schema } from "effect"
import { ProgressoLocal } from "shared/schema"
import { useSyncExternalStore } from "react"

const KEY = "horarios-ifmt-progresso"
const VERSION = 1

// Envelope versionado (PRD §6.3): migrar aqui quando VERSION mudar.
const migrate = (raw: unknown): ProgressoLocal | null => {
  const decoded = Schema.decodeUnknownEither(ProgressoLocal)(raw)
  if (Either.isLeft(decoded)) return null
  return decoded.right.version === VERSION ? decoded.right : null
}

export const readProgresso = (): ProgressoLocal | null => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw === null ? null : migrate(JSON.parse(raw))
  } catch {
    return null
  }
}

const listeners = new Set<() => void>()
let cache: ProgressoLocal | null | undefined

// outra aba mudou o progresso → invalida o cache local
if (typeof window !== "undefined")
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return
    cache = undefined
    for (const l of listeners) l()
  })

export const writeProgresso = (p: ProgressoLocal | null): void => {
  if (p === null) localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, JSON.stringify(p))
  cache = p
  for (const l of listeners) l()
}

export const useProgresso = (): ProgressoLocal | null =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => (cache !== undefined ? cache : (cache = readProgresso())),
  )

/** Onboarding: grava turma + concluídas marcadas de uma vez (progresso ainda não existe). */
export const iniciarProgresso = (turmaId: string, concluidas: string[]): void =>
  writeProgresso({ version: VERSION, turmaId, materiasConcluidas: [...concluidas].sort() })

export const escolherTurma = (turmaId: string): void => {
  const atual = readProgresso()
  writeProgresso({
    version: VERSION,
    turmaId,
    // trocar de turma preserva progresso (mesmo curso, ids de matéria estáveis)
    materiasConcluidas: atual?.materiasConcluidas ?? [],
  })
}

export const toggleMateria = (materiaId: string): void => {
  const atual = readProgresso()
  if (!atual) return
  const set = new Set(atual.materiasConcluidas)
  if (set.has(materiaId)) set.delete(materiaId)
  else set.add(materiaId)
  writeProgresso({ ...atual, materiasConcluidas: [...set].sort() })
}

export const resetProgresso = (): void => {
  const atual = readProgresso()
  if (atual) writeProgresso({ ...atual, materiasConcluidas: [] })
}
