/** Whitelist de IDs de turma (mesmo padrão dos arquivos em public/data/turmas/). */
export const TURMA_ID = /^t[A-Za-z0-9_-]+$/

export const isTurmaIdValid = (turmaId: string): boolean => TURMA_ID.test(turmaId)
