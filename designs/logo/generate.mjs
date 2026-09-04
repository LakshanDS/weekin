// Generates the WeekIn logo SVGs by converting the Fredoka wordmark to vector paths.
// Uses fontkit (opentype.js emits NaN commands on this variable-derived font).
// Run: bun designs/logo/generate.mjs
import * as fontkit from 'fontkit'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const font = fontkit.openSync(join(here, 'Fredoka-Bold.ttf'))

const INK = '#242424'
const CORAL = '#FF5757'
const WHITE = '#FFFFFF'
const SIZE = 200 // font size for path generation
const PAD = 24
const SCALE = SIZE / font.unitsPerEm
const BASELINE = SIZE

// Lay out a word: glyph paths scaled (x, flipped y), kerned advances applied.
function wordParts(text, startX = 0) {
  const run = font.layout(text)
  const parts = []
  let x = startX
  for (let i = 0; i < run.glyphs.length; i++) {
    const glyph = run.glyphs[i]
    const position = run.positions[i]
    const path = glyph.path.transform(SCALE, 0, 0, -SCALE, x + position.xOffset * SCALE, BASELINE)
    parts.push(path)
    x += position.xAdvance * SCALE
  }
  return { parts, endX: x }
}

function pathBBox(path) {
  // fontkit command shape: { command: 'moveTo', args: [x, y, ...] }
  const b = { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity }
  for (const cmd of path.commands) {
    const args = cmd.args ?? []
    for (let i = 0; i + 1 < args.length; i += 2) {
      const x = args[i], y = args[i + 1]
      if (x < b.x1) b.x1 = x
      if (x > b.x2) b.x2 = x
      if (y < b.y1) b.y1 = y
      if (y > b.y2) b.y2 = y
    }
  }
  return b
}

function toSvg(weekFill, inFill) {
  const week = wordParts('Week')
  const inWord = wordParts('In', week.endX)
  const all = [...week.parts, ...inWord.parts]

  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity
  for (const path of all) {
    const b = pathBBox(path)
    x1 = Math.min(x1, b.x1); y1 = Math.min(y1, b.y1)
    x2 = Math.max(x2, b.x2); y2 = Math.max(y2, b.y2)
  }
  const viewBox = `${(x1 - PAD).toFixed(1)} ${(y1 - PAD).toFixed(1)} ${(x2 - x1 + PAD * 2).toFixed(1)} ${(y2 - y1 + PAD * 2).toFixed(1)}`

  const pathTags = (parts, fill) =>
    parts.map((p) => `<path fill="${fill}" d="${p.toSVG()}"/>`).join('\n  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${Math.round(x2 - x1 + PAD * 2)}" height="${Math.round(y2 - y1 + PAD * 2)}" role="img" aria-label="WeekIn">
  <title>WeekIn</title>
  ${pathTags(week.parts, weekFill)}
  ${pathTags(inWord.parts, inFill)}
</svg>
`
}

writeFileSync(join(here, 'logo.svg'), toSvg(INK, CORAL))
writeFileSync(join(here, 'logo-white.svg'), toSvg(WHITE, CORAL))
writeFileSync(join(here, 'logo-ink.svg'), toSvg(INK, INK))
writeFileSync(join(here, 'logo-white-mono.svg'), toSvg(WHITE, WHITE))

// Mark: coral rounded square with a white Fredoka "W"
const glyph = font.glyphsForString('W')[0]
const gb = pathBBox(glyph.path) // font units, y-up
const w = gb.x2 - gb.x1, h = gb.y2 - gb.y1
const mark = 512, inner = 0.56 * mark
const s = Math.min(inner / w, inner / h)
const tx = (mark - w * s) / 2 - gb.x1 * s
const ty = mark / 2 + (s * (gb.y1 + gb.y2)) / 2 // accounts for the y flip
writeFileSync(
  join(here, 'mark.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${mark} ${mark}" width="${mark}" height="${mark}" role="img" aria-label="WeekIn mark">
  <title>WeekIn mark</title>
  <rect width="${mark}" height="${mark}" rx="${(mark * 0.22).toFixed(0)}" fill="${CORAL}"/>
  <g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${s.toFixed(4)} ${(-s).toFixed(4)})"><path fill="${WHITE}" d="${glyph.path.toSVG()}"/></g>
</svg>
`,
)

console.log('generated: logo.svg, logo-white.svg, logo-ink.svg, logo-white-mono.svg, mark.svg')
