import { Either, Schema } from "effect"
import { PlanoLocal, ProgressoLocal } from "shared/schema"
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

const VERSION = 1
const progresso = makeStore<ProgressoLocal>("horarios-ifmt-progresso", (raw) => {
  const decoded = Schema.decodeUnknownEither(ProgressoLocal)(raw)
  if (Either.isLeft(decoded)) return null
  return decoded.right.version === VERSION ? decoded.right : null
})

export const readProgresso = progresso.read
export const writeProgresso = progresso.write
export const useProgresso = progresso.use

/** Onboarding: grava turma + concluídas marcadas de uma vez (progresso ainda não existe). */
export const iniciarProgresso = (turmaId: string, concluidas: string[]): void =>
  progresso.write({ version: VERSION, turmaId, materiasConcluidas: [...concluidas].sort() })

export const escolherTurma = (turmaId: string): void => {
  const atual = progresso.read()
  progresso.write({
    version: VERSION,
    turmaId,
    // trocar de turma preserva progresso (mesmo curso, ids de matéria estáveis)
    materiasConcluidas: atual?.materiasConcluidas ?? [],
  })
}

export const toggleMateria = (materiaId: string): void => {
  const atual = progresso.read()
  if (!atual) return
  const set = new Set(atual.materiasConcluidas)
  if (set.has(materiaId)) set.delete(materiaId)
  else set.add(materiaId)
  progresso.write({ ...atual, materiasConcluidas: [...set].sort() })
}

export const resetProgresso = (): void => {
  const atual = progresso.read()
  if (atual) progresso.write({ ...atual, materiasConcluidas: [] })
}

// --- Plano de matrícula (simulador do próximo semestre) ---

const VERSION_PLANO = 1
const plano = makeStore<PlanoLocal>("horarios-ifmt-plano", (raw) => {
  const decoded = Schema.decodeUnknownEither(PlanoLocal)(raw)
  if (Either.isLeft(decoded)) return null
  return decoded.right.version === VERSION_PLANO ? decoded.right : null
})

export const usePlano = plano.use

/** Alterna uma matéria no plano; trocar de turma zera o plano (ids só valem dentro do curso). */
export const togglePlano = (turmaId: string, materiaId: string): void => {
  const atual = plano.read()
  const base = atual?.turmaId === turmaId ? atual.materiaIds : []
  const set = new Set(base)
  if (set.has(materiaId)) set.delete(materiaId)
  else set.add(materiaId)
  plano.write({ version: VERSION_PLANO, turmaId, materiaIds: [...set].sort() })
}
