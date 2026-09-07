import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../app/utils/format'

describe('renderMarkdown', () => {
  it('renders bold, italics and inline code', () => {
    expect(renderMarkdown('**Hansika** logged *42 hours* on `api-client`'))
      .toBe('<p><strong>Hansika</strong> logged <em>42 hours</em> on <code>api-client</code></p>')
  })

  it('escapes HTML before formatting', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  })

  it('groups bullet items into a list, including • markers', () => {
    expect(renderMarkdown('- alpha\n• beta')).toBe('<ul><li>alpha</li><li>beta</li></ul>')
  })

  it('groups numbered items into an ordered list', () => {
    expect(renderMarkdown('1. alpha\n2) beta')).toBe('<ol><li>alpha</li><li>beta</li></ol>')
  })

  it('renders headings and keeps following text out of them', () => {
    expect(renderMarkdown('## Summary\nAll done.')).toBe(
      '<p class="md-heading md-h4">Summary</p><p>All done.</p>',
    )
  })

  it('merges consecutive plain lines into one paragraph with breaks', () => {
    expect(renderMarkdown('line one\nline two\n\nline three')).toBe(
      '<p>line one<br>line two</p><p>line three</p>',
    )
  })

  it('renders fenced code blocks verbatim', () => {
    expect(renderMarkdown('```\n**not bold** <tag>\n```')).toBe(
      '<pre><code>**not bold** &lt;tag&gt;\n</code></pre>',
    )
  })

  it('applies inline formatting inside list items', () => {
    expect(renderMarkdown('- **key** blocker')).toBe('<ul><li><strong>key</strong> blocker</li></ul>')
  })

  it('leaves plain text as a single paragraph', () => {
    expect(renderMarkdown('hello')).toBe('<p>hello</p>')
  })

  it('renders pipe tables, stopping at the first non-row line', () => {
    expect(renderMarkdown('| Member | Tasks done |\n|---|---|\n| Alice | 1/5 |\n\nAfter.')).toBe(
      '<table><thead><tr><th>Member</th><th>Tasks done</th></tr></thead><tbody><tr><td>Alice</td><td>1/5</td></tr></tbody></table><p>After.</p>',
    )
  })

  it('formats inline markdown inside table cells and ignores alignment colons', () => {
    expect(renderMarkdown('| A | B |\n| --- | :---: |\n| **x** | `y` |')).toBe(
      '<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td><strong>x</strong></td><td><code>y</code></td></tr></tbody></table>',
    )
  })

  it('does not treat a lone pipe line as a table', () => {
    expect(renderMarkdown('a | b')).toBe('<p>a | b</p>')
  })
})
