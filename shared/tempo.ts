/** "HH:MM" → minutos desde 00:00; entrada malformada → 0 (nunca NaN). */
export const timeToMin = (t: string): number => {
  const [h = 0, m = 0] = t.split(":").map(Number)
  const min = h * 60 + m
  return Number.isFinite(min) ? min : 0
}
