import type { ArquivoCursos, ArquivoTurma, Curso, Materia, Turma } from "shared/schema"
import { isTurmaIdValid } from "shared/turmaId"
import { isArquivoCursos, isArquivoTurma } from "shared/validate"
import { useEffect, useState } from "react"
import { materiasDoCurso } from "../lib/horario"

export { isTurmaIdValid } from "shared/turmaId"

export class DataError extends Error {
  constructor(
    readonly path: string,
    cause: unknown,
  ) {
    super(`Falha ao carregar ${path}`, { cause })
    this.name = "DataError"
  }
}

// Cache módulo-level: dados são imutáveis na sessão (JSON estático); trocar de aba
// não refaz fetch nem re-valida. Atualização de dados passa por reload da página
// (AvisoAtualizacaoDados), que zera o cache naturalmente. Falha não fica cacheada.
const cache = new Map<string, Promise<unknown>>()

/** Só para testes: limpa o cache entre casos. */
export const limparCacheDados = (): void => cache.clear()

const fetchJson = async <A>(path: string, validate: (v: unknown) => v is A): Promise<A> => {
  const res = await fetch(path)
  if (!res.ok) throw new DataError(path, new Error(`HTTP ${res.status}`))
  const json: unknown = await res.json()
  if (!validate(json)) throw new DataError(path, new Error("dados fora do schema"))
  return json
}

const loadJson = <A>(path: string, validate: (v: unknown) => v is A): Promise<A> => {
  const cached = cache.get(path)
  if (cached) return cached as Promise<A>
  const p = fetchJson(path, validate)
  cache.set(path, p)
  p.catch(() => cache.delete(path))
  return p
}

export const loadCursos = (): Promise<ArquivoCursos> => loadJson("/data/cursos.json", isArquivoCursos)

export const loadTurma = (turmaId: string): Promise<ArquivoTurma> =>
  isTurmaIdValid(turmaId)
    ? loadJson(`/data/turmas/${turmaId}.json`, isArquivoTurma)
    : Promise.reject(new DataError(turmaId, new Error("turmaId inválido")))

/** Carrega várias turmas; as que falham são ignoradas (curso parcial > erro total). */
export const loadTurmas = async (ids: ReadonlyArray<string>): Promise<ArquivoTurma[]> => {
  const results = await Promise.allSettled(ids.map((id) => loadTurma(id)))
  return results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
}

export interface MateriasDoCurso {
  curso: Curso
  materias: Materia[]
  turmaAtual: Turma
  turmas: Turma[]
  generatedAt: string
}

// Matérias do curso inteiro: cursos.json → turmas do curso → união das matérias (F3).
export const loadMateriasDoCurso = async (turmaId: string): Promise<MateriasDoCurso> => {
  const [arquivo, { cursos }] = await Promise.all([loadTurma(turmaId), loadCursos()])
  const { turma } = arquivo
  const curso = cursos.find((c) => c.id === turma.cursoId)
  if (!curso)
    return {
      curso: { id: turma.cursoId, nome: turma.cursoId, turmaIds: [turmaId] },
      materias: [...turma.materias],
      turmaAtual: turma,
      turmas: [turma],
      generatedAt: arquivo.generatedAt,
    }
  const carregadas = (await loadTurmas(curso.turmaIds)).map((t) => t.turma)
  const turmas = carregadas.some((t) => t.id === turma.id) ? carregadas : [turma, ...carregadas]
  return { curso, materias: materiasDoCurso(turmas), turmaAtual: turma, turmas, generatedAt: arquivo.generatedAt }
}

/** Config só precisa de nome do curso + generatedAt: evita carregar todas as turmas. */
export const loadCursoResumo = async (turmaId: string): Promise<{ curso: Curso; generatedAt: string }> => {
  const [arquivo, { cursos }] = await Promise.all([loadTurma(turmaId), loadCursos()])
  const curso = cursos.find((c) => c.id === arquivo.turma.cursoId) ?? {
    id: arquivo.turma.cursoId,
    nome: arquivo.turma.cursoId,
    turmaIds: [turmaId],
  }
  return { curso, generatedAt: arquivo.generatedAt }
}

export type Query<A> = { status: "loading" } | { status: "error"; error: DataError } | { status: "ok"; value: A }

// Estado de servidor não existe (JSON estático): um hook simples cobre tudo (PRD §6.3).
// Invariante: `key` é a identidade da query — deve mudar sempre que o significado do
// load mudar. `load` fica fora das deps de propósito: chamadores criam uma arrow
// nova por render e depender dela causaria refetch infinito.
export function useQuery<A>(load: () => Promise<A>, key: string): Query<A> {
  const [state, setState] = useState<Query<A>>({ status: "loading" })
  useEffect(() => {
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset deliberado ao trocar `key`
    setState({ status: "loading" })
    load().then(
      (value) => {
        if (alive) setState({ status: "ok", value })
      },
      (error: unknown) => {
        if (alive) setState({ status: "error", error: error instanceof DataError ? error : new DataError(key, error) })
      },
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identidade da query é `key`
  }, [key])
  return state
}
