const dtShort = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const dtFull = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export function formatWeekRange(start: string, end: string): string {
  return `${dtShort.format(new Date(`${start}T00:00:00Z`))} – ${dtShort.format(new Date(`${end}T00:00:00Z`))}`
}

export function formatDateTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return dtFull.format(d)
}

export function initials(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

// Markdown → HTML for AI chat replies. Escapes HTML first so only our own
// tags can appear; covers the subset the model emits (headings, bold,
// italics, code, lists, tables, paragraphs).
export function renderMarkdown(text: string): string {
  const inline = (s: string) =>
    s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>')

  // GFM delimiter row like |---|---| (colons for alignment are ignored)
  const isDelimiter = (s: string) => /^[\s|:-]+$/.test(s) && s.includes('-') && s.includes('|')
  const cells = (s: string) =>
    s
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim())

  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  let inCode = false
  let paragraph: string[] = []

  const closeList = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${paragraph.join('<br>')}</p>`)
    paragraph = []
  }

  const lines = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    if (raw.trim().startsWith('```')) {
      flushParagraph()
      closeList()
      out.push(inCode ? '</code></pre>' : '<pre><code>')
      inCode = !inCode
      continue
    }
    if (inCode) {
      out.push(`${raw}\n`)
      continue
    }
    if (raw.includes('|') && lines[i + 1] !== undefined && isDelimiter(lines[i + 1])) {
      flushParagraph()
      closeList()
      out.push(`<table><thead><tr>${cells(raw).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>`)
      i += 2
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) {
        out.push(`<tr>${cells(lines[i]).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`)
        i++
      }
      out.push('</tbody></table>')
      i-- // the loop's i++ must re-examine the first non-row line
      continue
    }
    const bullet = raw.match(/^\s*[-•]\s+(.*)/)
    const numbered = raw.match(/^\s*\d+[.)]\s+(.*)/)
    const heading = raw.match(/^(#{1,6})\s+(.*)/)
    if (bullet || numbered) {
      flushParagraph()
      const want = bullet ? 'ul' : 'ol'
      if (list !== want) {
        closeList()
        out.push(`<${want}>`)
        list = want
      }
      out.push(`<li>${inline((bullet ?? numbered)![1])}</li>`)
    } else if (heading) {
      flushParagraph()
      closeList()
      const level = Math.min(heading[1].length + 2, 5)
      out.push(`<p class="md-heading md-h${level}">${inline(heading[2])}</p>`)
    } else if (raw.trim()) {
      closeList()
      paragraph.push(inline(raw))
    } else {
      flushParagraph()
      closeList()
    }
  }
  flushParagraph()
  closeList()
  if (inCode) out.push('</code></pre>')
  return out.join('')
}
