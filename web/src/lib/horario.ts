import type { Aula, Materia, Turma } from "shared/schema"

export const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const
export const DIAS_CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const

export const timeToMin = (t: string): number => {
  const [h = 0, m = 0] = t.split(":").map(Number)
  return h * 60 + m
}

/** Dia letivo do app (0=segunda..5=sábado) a partir de Date; domingo → -1. */
export const diaLetivo = (d: Date): number => (d.getDay() === 0 ? -1 : d.getDay() - 1)

export const aulasDoDia = (aulas: ReadonlyArray<Aula>, dia: number): Aula[] =>
  aulas.filter((a) => a.diaSemana === dia).sort((a, b) => timeToMin(a.horaInicio) - timeToMin(b.horaInicio))

export interface Hoje {
  dia: number // dia exibido (pode ser o próximo dia letivo)
  ehHoje: boolean
  aulas: Aula[]
  atualIdx: number // índice da aula em andamento, -1 se nenhuma
  proximaIdx: number // índice da próxima aula do dia exibido, -1 se nenhuma
}

/** Aulas de hoje com aula atual/próxima; fora do horário, aponta o próximo dia letivo (U2/F2). */
export const calcularHoje = (aulas: ReadonlyArray<Aula>, agora: Date): Hoje => {
  const min = agora.getHours() * 60 + agora.getMinutes()
  const hoje = diaLetivo(agora)
  if (hoje >= 0) {
    const doDia = aulasDoDia(aulas, hoje)
    const atualIdx = doDia.findIndex((a) => timeToMin(a.horaInicio) <= min && min < timeToMin(a.horaFim))
    const proximaIdx = doDia.findIndex((a) => timeToMin(a.horaInicio) > min)
    if (atualIdx >= 0 || proximaIdx >= 0) return { dia: hoje, ehHoje: true, aulas: doDia, atualIdx, proximaIdx }
  }
  // acabou o dia (ou domingo): próximo dia letivo com aula
  const base = hoje < 0 ? -1 : hoje // domingo conta como véspera de segunda
  for (let i = 1; i <= 7; i++) {
    const dia = (base + i) % 7
    if (dia > 5) continue
    const doDia = aulasDoDia(aulas, dia)
    if (doDia.length > 0) return { dia, ehHoje: false, aulas: doDia, atualIdx: -1, proximaIdx: 0 }
  }
  return { dia: hoje < 0 ? 0 : hoje, ehHoje: hoje >= 0, aulas: [], atualIdx: -1, proximaIdx: -1 }
}

export interface Progresso {
  total: number
  feitas: number
  faltam: number
  pct: number // 0..100 inteiro
}

export const agregarProgresso = (materias: ReadonlyArray<Materia>, concluidas: ReadonlySet<string>): Progresso => {
  const total = materias.length
  const feitas = materias.filter((m) => concluidas.has(m.id)).length
  return { total, feitas, faltam: total - feitas, pct: total === 0 ? 0 : Math.round((feitas / total) * 100) }
}

/** Agrupa por semestre; sem semestre → grupo null (nunca somem — PRD §11). */
export const porSemestre = (materias: ReadonlyArray<Materia>): Array<[number | null, Materia[]]> => {
  const grupos = new Map<number | null, Materia[]>()
  for (const m of materias) {
    const key = m.semestre ?? null
    const list = grupos.get(key) ?? []
    list.push(m)
    grupos.set(key, list)
  }
  return [...grupos.entries()]
    .map(([k, v]): [number | null, Materia[]] => [k, v.sort((a, b) => a.nome.localeCompare(b.nome))])
    .sort(([a], [b]) => (a ?? Infinity) - (b ?? Infinity))
}

const GAP_MAX_MIN = 25 // cobre o intervalo padrão (15–20 min) entre blocos da mesma aula

/** Mescla aulas consecutivas da mesma matéria no mesmo dia quando o gap ≤ 25 min (display-only). */
export const mesclarAulas = (aulas: ReadonlyArray<Aula>): Aula[] => {
  const ordenadas = [...aulas].sort(
    (a, b) => a.diaSemana - b.diaSemana || timeToMin(a.horaInicio) - timeToMin(b.horaInicio),
  )
  const blocos: Aula[] = []
  for (const a of ordenadas) {
    const ultimo = blocos[blocos.length - 1]
    if (
      ultimo &&
      ultimo.materiaId === a.materiaId &&
      ultimo.diaSemana === a.diaSemana &&
      timeToMin(a.horaInicio) - timeToMin(ultimo.horaFim) <= GAP_MAX_MIN
    ) {
      // max: aula sobreposta/contida não encolhe o bloco
      blocos[blocos.length - 1] = {
        ...ultimo,
        horaFim: timeToMin(a.horaFim) > timeToMin(ultimo.horaFim) ? a.horaFim : ultimo.horaFim,
      }
    } else {
      blocos.push(a)
    }
  }
  return blocos
}

/** Duas aulas colidem: mesmo dia e intervalos sobrepostos (fim==início não colide). */
export const aulasSobrepoem = (a: Aula, b: Aula): boolean =>
  a.diaSemana === b.diaSemana &&
  timeToMin(a.horaInicio) < timeToMin(b.horaFim) &&
  timeToMin(b.horaInicio) < timeToMin(a.horaFim)

export interface ChoqueInfo {
  turma: { id: string; nome: string }
  conflitos: Array<{ aula: Aula; contra: Aula; materiaContraNome: string }>
}

/**
 * Para cada matéria fora da grade da turma atual mas oferecida em outra turma do curso,
 * uma entrada por turma ofertante com seus conflitos contra a grade atual (lista vazia = sem choque).
 */
export const detectarChoques = (turmaAtual: Turma, turmasDoCurso: ReadonlyArray<Turma>): Map<string, ChoqueInfo[]> => {
  const naGrade = new Set(turmaAtual.materias.map((m) => m.id))
  const nomeContra = new Map(turmaAtual.materias.map((m) => [m.id, m.nome]))
  const mapa = new Map<string, ChoqueInfo[]>()
  for (const t of turmasDoCurso) {
    if (t.id === turmaAtual.id) continue
    const materiaIds = new Set(t.aulas.map((a) => a.materiaId).filter((id) => !naGrade.has(id)))
    for (const materiaId of materiaIds) {
      const conflitos = t.aulas
        .filter((a) => a.materiaId === materiaId)
        .flatMap((aula) =>
          turmaAtual.aulas
            .filter((contra) => aulasSobrepoem(aula, contra))
            .map((contra) => ({ aula, contra, materiaContraNome: nomeContra.get(contra.materiaId) ?? contra.materiaId })),
        )
      const lista = mapa.get(materiaId) ?? []
      lista.push({ turma: { id: t.id, nome: t.nome }, conflitos })
      mapa.set(materiaId, lista)
    }
  }
  return mapa
}

/** Matérias do curso inteiro: união das matérias das turmas, únicas por id. */
export const materiasDoCurso = (turmas: ReadonlyArray<{ materias: ReadonlyArray<Materia> }>): Materia[] => {
  const byId = new Map<string, Materia>()
  for (const t of turmas)
    for (const m of t.materias) {
      const existing = byId.get(m.id)
      // preferir a versão com semestre definido
      if (!existing || (existing.semestre === undefined && m.semestre !== undefined)) byId.set(m.id, m)
    }
  return [...byId.values()]
}
