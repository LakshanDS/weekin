const dtShort = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const dtFull = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function formatWeekRange(start: string, end: string): string {
  return `${dtShort.format(new Date(`${start}T00:00:00Z`))} – ${dtShort.format(new Date(`${end}T00:00:00Z`))}`
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return dtFull.format(d)
}
