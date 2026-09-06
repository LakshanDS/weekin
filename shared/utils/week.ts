// Week helpers — a report week is always Monday..Friday, ISO 'YYYY-MM-DD'.

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return toIsoDate(d)
}

export function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const day = (d.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - day)
  return toIsoDate(d)
}

// Mon..Fri range containing today
export function currentWeekRange(): { weekStart: string; weekEnd: string } {
  const monday = mondayOf(toIsoDate(new Date()))
  return { weekStart: monday, weekEnd: addDaysIso(monday, 4) }
}

// ISO week number for a Monday-start week
export function isoWeekOf(mondayIso: string): number {
  const d = new Date(`${mondayIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 3) // Thursday of that week
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3)
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 864e5))
}
