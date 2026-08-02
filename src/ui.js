// Arrow-key picker primitives for the `armada init` questionnaire.
//
// Zero-dependency: hand-rolled on raw-mode readline + ANSI escapes. When the
// input stream is not a TTY (CI, piped stdin) every primitive falls back to a
// plain line-based prompt so non-interactive runs never hang on raw mode.
//
// Redraw loop writes `\r` + cursor-up + erase-line so the frame never scrolls.

import { createInterface } from "node:readline/promises"
import { emitKeypressEvents } from "node:readline"
import { stdin, stdout } from "node:process"

const MARKER = "▸"
const CHECK = "☑"
const BOX = "☐"

// ANSI SGR color helpers, enabled only when the output is a TTY and NO_COLOR
// is unset. Plain strings otherwise, so piped/CI output stays clean.
function colorize(out) {
  const enabled = !!(out && out.isTTY) && !process.env.NO_COLOR
  const wrap = (code) => (s) => (enabled ? `\u001b[${code}m${s}\u001b[0m` : String(s))
  return {
    title: wrap("1;36"), // bold cyan
    marker: wrap("32"), // green
    selected: wrap("1"), // bold
    dim: wrap("2"),
  }
}

function setRaw(input, on) {
  if (input && typeof input.setRawMode === "function") input.setRawMode(on)
}

// Track a rendered frame so we can move the cursor back up and erase each line
// on the next redraw (no scrolling flicker).
function createFrame(out) {
  let drawn = 0
  return {
    draw(lines) {
      if (drawn > 0) out.write(`\u001b[${drawn}A`)
      for (const line of lines) out.write(`\r\u001b[2K${line}\n`)
      drawn = lines.length
    },
    clear() {
      if (drawn === 0) return
      out.write(`\u001b[${drawn}A`)
      for (let i = 0; i < drawn; i++) out.write(`\r\u001b[2K\n`)
      drawn = 0
    },
  }
}

// Arrow-key single choice. Options: `{ label, value, hint? }`. Returns value.
export function select(title, options, { defaultIndex = 0, input, output } = {}) {
  const inp = input ?? stdin
  const out = output ?? stdout
  if (!inp.isTTY) return lineSelect(title, options, { defaultIndex, input: inp, output: out })

  const c = colorize(out)
  const frame = createFrame(out)
  const cursor = { value: clampIndex(defaultIndex, options.length) }

  const render = () => [
    c.title(title),
    ...options.map((o, i) => {
      const marker = i === cursor.value ? `${c.marker(MARKER)} ` : "  "
      const hint = o.hint ? ` ${c.dim(`— ${o.hint}`)}` : ""
      const label = i === cursor.value ? c.selected(o.label) : o.label
      return `  ${marker}${label}${hint}`
    }),
  ]

  return new Promise((resolve) => {
    const handler = (str, key) => {
      if (key && key.ctrl && key.name === "c") {
        cleanup()
        out.write("\n")
        process.exit(130)
      }
      const name = key && key.name
      if (name === "up") cursor.value = Math.max(0, cursor.value - 1)
      else if (name === "down") cursor.value = Math.min(options.length - 1, cursor.value + 1)
      else if (name === "return" || name === "enter") {
        const choice = options[cursor.value]
        cleanup()
        frame.clear()
        out.write(`${c.dim(title)}: ${c.selected(choice.label)}\n`)
        resolve(choice.value)
        return
      } else {
        return
      }
      frame.draw(render())
    }
    function cleanup() {
      setRaw(inp, false)
      inp.removeListener("keypress", handler)
    }
    emitKeypressEvents(inp)
    setRaw(inp, true)
    if (typeof inp.resume === "function") inp.resume()
    inp.on("keypress", handler)
    frame.draw(render())
  })
}

// Arrow-key multi-choice. Space toggles, `a` = all, `n` = none, Enter finishes.
// Returns the array of selected values.
export function multiSelect(title, options, { defaults = [], input, output } = {}) {
  const inp = input ?? stdin
  const out = output ?? stdout
  if (!inp.isTTY) return lineMultiSelect(title, options, { defaults, input: inp, output: out })

  const c = colorize(out)
  const frame = createFrame(out)
  const cursor = { value: 0 }
  const selected = new Set(options.map((o) => o.value).filter((v) => defaults.includes(v)))
  const hint = "↑/↓ move · space=select · a=all · n=none · enter=done"

  const render = () => [
    c.title(title),
    c.dim(hint),
    ...options.map((o, i) => {
      const on = selected.has(o.value)
      const marker = i === cursor.value ? `${c.marker(MARKER)} ` : "  "
      const glyph = on ? `${c.marker(CHECK)} ` : `${BOX} `
      const label = on ? c.selected(o.label) : o.label
      return `  ${marker}${glyph}${label}`
    }),
  ]

  const toggle = (i) => {
    const o = options[i]
    if (selected.has(o.value)) selected.delete(o.value)
    else selected.add(o.value)
  }

  return new Promise((resolve) => {
    const handler = (str, key) => {
      if (key && key.ctrl && key.name === "c") {
        cleanup()
        out.write("\n")
        process.exit(130)
      }
      const name = key && key.name
      if (name === "up") cursor.value = Math.max(0, cursor.value - 1)
      else if (name === "down") cursor.value = Math.min(options.length - 1, cursor.value + 1)
      else if (name === "space") toggle(cursor.value)
      else if (name === "a") {
        for (const o of options) selected.add(o.value)
      } else if (name === "n") {
        selected.clear()
      } else if (name === "return" || name === "enter") {
        const values = options.filter((o) => selected.has(o.value)).map((o) => o.value)
        cleanup()
        frame.clear()
        const summary = values.length ? values.join(", ") : c.dim("none")
        out.write(`${c.dim(title)}: ${c.selected(summary)} (${values.length})\n`)
        resolve(values)
        return
      } else {
        return
      }
      frame.draw(render())
    }
    function cleanup() {
      setRaw(inp, false)
      inp.removeListener("keypress", handler)
    }
    emitKeypressEvents(inp)
    setRaw(inp, true)
    if (typeof inp.resume === "function") inp.resume()
    inp.on("keypress", handler)
    frame.draw(render())
  })
}

// Yes/No picker built on select. Returns a boolean.
export function confirm(title, dflt = true, { input, output } = {}) {
  const inp = input ?? stdin
  const out = output ?? stdout
  if (!inp.isTTY) return lineConfirm(title, dflt, { input: inp, output: out })
  return select(
    title,
    [
      { label: "Yes", value: true },
      { label: "No", value: false },
    ],
    { defaultIndex: dflt ? 0 : 1, input: inp, output: out },
  )
}

function clampIndex(idx, len) {
  if (!Number.isInteger(idx)) return 0
  return Math.max(0, Math.min(idx, len - 1))
}

// ---- Line-based fallbacks (non-TTY input) -------------------------------

async function lineSelect(title, options, { defaultIndex = 0, input, output }) {
  const dflt = options[clampIndex(defaultIndex, options.length)]
  const rl = createInterface({ input, output })
  const suffix = dflt ? ` [${dflt.label}]` : ""
  try {
    while (true) {
      const raw = (await rl.question(`${title}${suffix} `)).trim()
      if (!raw) return dflt.value
      const hit = matchOption(options, raw)
      if (hit) return hit.value
      output.write("  Invalid choice, try again.\n")
    }
  } finally {
    rl.close()
  }
}

async function lineMultiSelect(title, options, { defaults = [], input, output }) {
  const rl = createInterface({ input, output })
  try {
    while (true) {
      const raw = (await rl.question(`${title} [a=all, n=none, or comma-separated] `)).trim().toLowerCase()
      if (!raw) return defaults
      if (raw === "a" || raw === "all") return options.map((o) => o.value)
      if (raw === "n" || raw === "none") return []
      const picked = []
      for (const part of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
        const hit = matchOption(options, part)
        if (hit && !picked.includes(hit.value)) picked.push(hit.value)
      }
      if (picked.length) return picked
      output.write("  Invalid choices, try again.\n")
    }
  } finally {
    rl.close()
  }
}

function matchOption(options, raw) {
  const lower = raw.toLowerCase()
  return (
    options.find((o) => o.label.toLowerCase() === lower) ??
    options.find((o) => String(o.value).toLowerCase() === lower)
  )
}

async function lineConfirm(title, dflt = true, { input, output }) {
  const rl = createInterface({ input, output })
  const suffix = dflt ? " [Y/n]" : " [y/N]"
  try {
    while (true) {
      const answer = (await rl.question(`${title}${suffix} `)).trim().toLowerCase()
      if (!answer) return dflt
      if (answer === "y" || answer === "yes") return true
      if (answer === "n" || answer === "no") return false
      output.write("  Please answer y or n.\n")
    }
  } finally {
    rl.close()
  }
}
