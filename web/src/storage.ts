import type { ProgressoLocal } from "shared/schema"
import { isTurmaIdValid } from "shared/turmaId"
import { useSyncExternalStore } from "react"

// Store local versionado sobre localStorage, com cache + sync entre abas (PRD §6.3).
// Um factory por chave: migrar dentro de `decode` quando a versão mudar.
function makeStore<A>(key: string, decode: (raw: unknown) => A | null) {
  const listeners = new Set<() => void>()
  let cache: A | null | undefined

  const read = (): A | null => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? null : decode(JSON.parse(raw))
    } catch {
      return null
    }
  }

  const write = (value: A | null): void => {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
    cache = value
    for (const l of listeners) l()
  }

  // outra aba mudou este valor → invalida o cache local
  if (typeof window !== "undefined")
    window.addEventListener("storage", (e) => {
      if (e.key !== key) return
      cache = undefined
      for (const l of listeners) l()
    })

  const use = (): A | null =>
    useSyncExternalStore(
      (cb) => {
        listeners.add(cb)
        return () => listeners.delete(cb)
      },
      () => (cache !== undefined ? cache : (cache = read())),
    )

  return { read, write, use }
}

// --- Progresso (matérias concluídas) ---

const VERSION = 2

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return [...new Set(v.filter((x): x is string => typeof x === "string"))].sort()
}

/** Migra progresso local entre versões; null se irrecuperável. */
export function migrateProgresso(raw: unknown): ProgressoLocal | null {
  if (typeof raw !== "object" || raw === null) return null
  const o = raw as Record<string, unknown>
  if (typeof o.turmaId !== "string") return null
  if (!isTurmaIdValid(o.turmaId)) return null

  const stored = typeof o.version === "number" ? o.version : 0
  if (stored > VERSION) return null

  let progresso: ProgressoLocal = {
    version: VERSION,
    turmaId: o.turmaId,
    materiasConcluidas: asStringArray(o.materiasConcluidas),
    cursando: asStringArray(o.cursando),
  }

  // v1 → v2: normaliza cursando (campo opcional na v1)
  if (stored === 1) progresso = { ...progresso, version: VERSION, cursando: asStringArray(o.cursando) }

  // Campos já validados acima (turmaId + arrays normalizados); objeto construído aqui é o schema.
  return progresso
}

const progresso = makeStore<ProgressoLocal>("horarios-ifmt-progresso", migrateProgresso)

export const readProgresso = progresso.read
export const writeProgresso = progresso.write
export const useProgresso = progresso.use

/** Onboarding: grava turma + concluídas marcadas de uma vez (progresso ainda não existe). */
export const iniciarProgresso = (turmaId: string, concluidas: string[]): void =>
  progresso.write({ version: VERSION, turmaId, materiasConcluidas: [...concluidas].sort(), cursando: [] })

export const escolherTurma = (turmaId: string, novoCursoId: string, cursoIdAtual: string | null): void => {
  const atual = progresso.read()
  const mesmoCurso = cursoIdAtual !== null && cursoIdAtual === novoCursoId
  if (!mesmoCurso) {
    progresso.write({ version: VERSION, turmaId, materiasConcluidas: [], cursando: [] })
    return
  }
  progresso.write({
    version: VERSION,
    turmaId,
    materiasConcluidas: atual?.materiasConcluidas ?? [],
    cursando: atual?.cursando ?? [],
  })
}

/** Marca/desmarca "feita"; feita e cursando são mutuamente exclusivos. */
export const toggleMateria = (materiaId: string): void => {
  const atual = progresso.read()
  if (!atual) return
  const feitas = new Set(atual.materiasConcluidas)
  const cursando = new Set(atual.cursando ?? [])
  if (feitas.has(materiaId)) {
    feitas.delete(materiaId)
  } else {
    feitas.add(materiaId)
    cursando.delete(materiaId) // não pode estar feita e cursando ao mesmo tempo
  }
  progresso.write({ ...atual, materiasConcluidas: [...feitas].sort(), cursando: [...cursando].sort() })
}

/** Marca/desmarca "cursando agora"; cursando e feita são mutuamente exclusivos. */
export const toggleCursando = (materiaId: string): void => {
  const atual = progresso.read()
  if (!atual) return
  const cursando = new Set(atual.cursando ?? [])
  const feitas = new Set(atual.materiasConcluidas)
  if (cursando.has(materiaId)) {
    cursando.delete(materiaId)
  } else {
    cursando.add(materiaId)
    feitas.delete(materiaId)
  }
  progresso.write({ ...atual, materiasConcluidas: [...feitas].sort(), cursando: [...cursando].sort() })
}

export const resetProgresso = (): void => {
  const atual = progresso.read()
  if (atual) progresso.write({ ...atual, materiasConcluidas: [], cursando: [] })
}

const PLANO_KEY = "horarios-ifmt-plano"

/** One-shot: copia plano legado para cursando se cursando estiver vazio. */
export function migrarPlanoLegado(): void {
  if (typeof window === "undefined") return
  const atual = progresso.read()
  if (!atual || (atual.cursando?.length ?? 0) > 0) return
  try {
    const raw = localStorage.getItem(PLANO_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as { turmaId?: string; materiaIds?: string[] }
    if (atual.turmaId !== parsed.turmaId || !parsed.materiaIds?.length) {
      localStorage.removeItem(PLANO_KEY)
      return
    }
    progresso.write({
      ...atual,
      cursando: [...new Set(parsed.materiaIds)].sort(),
    })
    localStorage.removeItem(PLANO_KEY)
  } catch {
    localStorage.removeItem(PLANO_KEY)
  }
}
