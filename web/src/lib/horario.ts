import type { Aula, Materia, Turma } from "shared/schema"

export const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const
export const DIAS_CURTO = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const

export const timeToMin = (t: string): number => {
  const [h = 0, m = 0] = t.split(":").map(Number)
  const min = h * 60 + m
  return Number.isFinite(min) ? min : 0
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

/**
 * Aulas que o aluno cursa de fato, para Hoje: matérias marcadas como "cursando"
 * (cruzando turmas do curso). Sem nada marcado, retorna vazio.
 */
export const aulasVigentes = (
  turmaAtual: Turma,
  turmas: ReadonlyArray<Turma>,
  cursando: ReadonlySet<string>,
  concluidas: ReadonlySet<string>,
): Aula[] => {
  if (cursando.size === 0) return []
  const ofertas = ofertasPorMateria(turmaAtual, turmas)
  const blocos: Aula[] = []
  for (const materiaId of cursando) {
    if (concluidas.has(materiaId)) continue
    const oferta = ofertas.get(materiaId)
    if (oferta) blocos.push(...oferta.blocos)
  }
  return blocos
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
 * Ignora matérias já concluídas (não vão ser cursadas) e mescla blocos consecutivos antes de comparar.
 */
export const detectarChoques = (
  turmaAtual: Turma,
  turmasDoCurso: ReadonlyArray<Turma>,
  concluidas: ReadonlySet<string>,
): Map<string, ChoqueInfo[]> => {
  const naGrade = new Set(turmaAtual.materias.map((m) => m.id))
  const nomeContra = new Map(turmaAtual.materias.map((m) => [m.id, m.nome]))
  // grade real do aluno: sem concluídas (não vai assistir), blocos consecutivos mesclados
  const gradeAtual = mesclarAulas(turmaAtual.aulas.filter((a) => !concluidas.has(a.materiaId)))
  const mapa = new Map<string, ChoqueInfo[]>()
  for (const t of turmasDoCurso) {
    if (t.id === turmaAtual.id) continue
    const materiaIds = new Set(
      t.aulas.map((a) => a.materiaId).filter((id) => !naGrade.has(id) && !concluidas.has(id)),
    )
    for (const materiaId of materiaIds) {
      const conflitos = mesclarAulas(t.aulas.filter((a) => a.materiaId === materiaId)).flatMap((aula) =>
        gradeAtual
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

/** Menor dia de aula (0=seg..5=sáb) por matéria, cruzando turmas. Sem aula → ausente. */
export const diaInicialPorMateria = (turmas: ReadonlyArray<Turma>): Map<string, number> => {
  const m = new Map<string, number>()
  for (const t of turmas)
    for (const a of t.aulas) {
      const cur = m.get(a.materiaId)
      if (cur === undefined || a.diaSemana < cur) m.set(a.materiaId, a.diaSemana)
    }
  return m
}

/** Rótulo compacto do horário de uma matéria (ex. "Seg 18:50–22:25 · Qua 13:00–14:40"); null se sem aula. */
export const fmtHorarioMateria = (blocos: ReadonlyArray<Aula>): string | null => {
  const merged = mesclarAulas(blocos)
  if (merged.length === 0) return null
  return merged.map((b) => `${DIAS_CURTO[b.diaSemana]} ${b.horaInicio}–${b.horaFim}`).join(" · ")
}

export interface Oferta {
  turmaNome: string
  blocos: Aula[] // já mesclados
}

/**
 * Para cada matéria oferecida no curso, sua oferta (turma + blocos mesclados).
 * Matérias na grade de turmaAtual usam só horários dessa turma; dependências vêm das outras.
 */
export const ofertasPorMateria = (
  turmaAtual: Turma,
  turmas: ReadonlyArray<Turma>,
): Map<string, Oferta> => {
  const naGrade = new Set(turmaAtual.materias.map((m) => m.id))
  const aulasPorMateria = new Map<string, { turmaNome: string; aulas: Aula[] }>()

  const add = (turmaNome: string, aula: Aula) => {
    const e = aulasPorMateria.get(aula.materiaId) ?? { turmaNome, aulas: [] }
    e.aulas.push(aula)
    aulasPorMateria.set(aula.materiaId, e)
  }

  for (const a of turmaAtual.aulas) add(turmaAtual.nome, a)

  for (const t of turmas) {
    if (t.id === turmaAtual.id) continue
    for (const a of t.aulas) {
      if (naGrade.has(a.materiaId)) continue
      add(t.nome, a)
    }
  }

  const mapa = new Map<string, Oferta>()
  for (const [materiaId, { turmaNome, aulas }] of aulasPorMateria)
    mapa.set(materiaId, { turmaNome, blocos: mesclarAulas(aulas) })
  return mapa
}

/** Chave estável de um bloco de aula (dia+horário) para marcar choques na grade. */
export const chaveBloco = (a: Aula): string => `${a.diaSemana}-${a.horaInicio}-${a.horaFim}`

export interface ItemPlano {
  materiaId: string
  blocos: Aula[] // já mesclados (de ofertasPorMateria)
}

export interface ChoquesPlano {
  pares: Array<{ a: ItemPlano; b: ItemPlano; blocoA: Aula; blocoB: Aula }>
  blocosEmChoque: Set<string> // chaveBloco dos blocos que colidem com algum outro
  materiasEmChoque: Set<string> // materiaId em algum choque
}

/** Choques entre as matérias marcadas no plano (comparação par a par dos blocos). */
export const detectarChoquesPlano = (itens: ReadonlyArray<ItemPlano>): ChoquesPlano => {
  const pares: ChoquesPlano["pares"] = []
  const blocosEmChoque = new Set<string>()
  const materiasEmChoque = new Set<string>()
  for (let i = 0; i < itens.length; i++)
    for (let j = i + 1; j < itens.length; j++) {
      const a = itens[i]!
      const b = itens[j]!
      for (const blocoA of a.blocos)
        for (const blocoB of b.blocos)
          if (aulasSobrepoem(blocoA, blocoB)) {
            pares.push({ a, b, blocoA, blocoB })
            blocosEmChoque.add(chaveBloco(blocoA))
            blocosEmChoque.add(chaveBloco(blocoB))
            materiasEmChoque.add(a.materiaId)
            materiasEmChoque.add(b.materiaId)
          }
    }
  return { pares, blocosEmChoque, materiasEmChoque }
}

export interface TabelaPlano {
  faixas: string[] // horaInicio distintos, ordenados
  dias: number[] // dias com alguma aula, ordenados
  celulas: Map<string, string[]> // `${dia}-${horaInicio}` -> materiaId[]
}

/** Chave de célula da tabela (dia + horário de início). */
export const chaveCelula = (dia: number, horaInicio: string): string => `${dia}-${horaInicio}`

/**
 * Monta a tabela do planner: matérias do pool posicionadas na célula do seu dia+horário.
 * Uma matéria com blocos em vários dias aparece em várias células. Duas na mesma célula
 * (mesmo dia e horário de início) se sobrepõem — o render trata como choque potencial.
 * Invariante: `ofertas` vem de `mesclarAulas`, que funde blocos da mesma matéria no mesmo
 * dia+início; então uma matéria entra no máximo uma vez por célula (chaves de render únicas).
 */
export const montarTabelaPlano = (
  pool: ReadonlyArray<Materia>,
  ofertas: ReadonlyMap<string, Oferta>,
): TabelaPlano => {
  const celulas = new Map<string, string[]>()
  const faixasSet = new Set<string>()
  const diasSet = new Set<number>()
  for (const m of pool) {
    const oferta = ofertas.get(m.id)
    if (!oferta) continue
    for (const b of oferta.blocos) {
      faixasSet.add(b.horaInicio)
      diasSet.add(b.diaSemana)
      const chave = chaveCelula(b.diaSemana, b.horaInicio)
      const lista = celulas.get(chave) ?? []
      lista.push(m.id)
      celulas.set(chave, lista)
    }
  }
  return {
    faixas: [...faixasSet].sort((a, b) => timeToMin(a) - timeToMin(b)),
    dias: [...diasSet].sort((a, b) => a - b),
    celulas,
  }
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
