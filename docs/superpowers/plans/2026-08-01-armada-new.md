# armada new Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `armada new [name]` — best-practice repo generator with experience-aware category picker, curated starter templates, and automatic armada init handoff.

**Architecture:** Follows existing armada pattern: pure data module (`recommendations.js`) + questionnaire/flow (`new-command.js`) + I/O (template walking + rendering in `new-command.js`) + CLI dispatch (`cli.js`). Template files live under `starter/<category>/<stack>/` with `{placeholder}` syntax.

**Tech Stack:** Node.js >= 20 (ESM, `node:test`, `node:fs`, `node:path`, `node:readline`, `node:child_process`). Zero new dependencies.

## Global Constraints

- ESM everywhere; imports use explicit `.js` extensions
- `node:test` for testing; run with `node --test 'tests/*.test.js'`
- No new runtime dependencies; stay zero-dep beyond `yaml`
- Pure data + I/O split: generator functions are pure, I/O stays in command modules
- `{placeholder}` syntax in templates (same as prompt templates)
- Tests must stay green before any commit
- CLI e2e uses `tests/helpers.js` `runCli` + `makeTempRepo`
- Model IDs use `provider/model` format — never bare names

---

### Task 1: `src/recommendations.js` — Category catalog (pure data)

**Files:**
- Create: `src/recommendations.js`
- Create: `tests/recommendations.test.js`

**Interfaces:**
- Produces: `export const CATEGORIES` — object keyed by category name, each with `{ label, stacks: [{ name, label, recommended, lang, deps, devDeps, scripts }], layers }`

- [ ] **Step 1: Write failing tests**

```js
// tests/recommendations.test.js
import { test } from "node:test"
import assert from "node:assert"
import { CATEGORIES } from "../src/recommendations.js"

test("CATEGORIES is an object with entries", () => {
  assert.ok(typeof CATEGORIES === "object")
  assert.ok(Object.keys(CATEGORIES).length >= 3)
})

test("every category has label, stacks, and layers", () => {
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    assert.ok(typeof cat.label === "string", `${key}: missing label`)
    assert.ok(Array.isArray(cat.stacks), `${key}: stacks not an array`)
    assert.ok(cat.stacks.length > 0, `${key}: stacks empty`)
    assert.ok(typeof cat.layers === "object", `${key}: missing layers`)
  }
})

test("first stack in every category is recommended", () => {
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    assert.strictEqual(cat.stacks[0].recommended, true,
      `${key}: first stack not recommended`)
  }
})

test("every stack has required fields", () => {
  const required = ["name", "label", "lang"]
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    for (const stack of cat.stacks) {
      for (const field of required) {
        assert.ok(stack[field] !== undefined,
          `${key}/${stack.name}: missing ${field}`)
      }
    }
  }
})

test("every category has at least 2 stacks (beginner needs choices)", () => {
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    assert.ok(cat.stacks.length >= 2,
      `${key}: only ${cat.stacks.length} stack(s), need >= 2`)
  }
})

test("only one stack per category has recommended: true", () => {
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    const count = cat.stacks.filter((s) => s.recommended).length
    assert.strictEqual(count, 1, `${key}: ${count} recommended stacks`)
  }
})

test("stack names are unique within a category", () => {
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    const names = cat.stacks.map((s) => s.name)
    assert.strictEqual(new Set(names).size, names.length,
      `${key}: duplicate stack names`)
  }
})

test("web-app layers cover frontend, backend, database, testing, ci, deploy", () => {
  const layers = CATEGORIES["web-app"].layers
  assert.ok(Array.isArray(layers.frontend), "frontend not array")
  assert.ok(Array.isArray(layers.backend), "backend not array")
  assert.ok(Array.isArray(layers.database), "database not array")
  assert.ok(Array.isArray(layers.testing), "testing not array")
  assert.ok(Array.isArray(layers.ci), "ci not array")
  assert.ok(Array.isArray(layers.deploy), "deploy not array")
  assert.ok(layers.frontend.length > 0, "frontend empty")
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/recommendations.test.js`
Expected: FAIL — "Cannot find module '../src/recommendations.js'"

- [ ] **Step 3: Write `src/recommendations.js`**

```js
// Category catalog + curated stack recommendations. Pure data — no I/O.
// Each category has a curated list of stacks (first = recommended) and
// per-layer options for the experienced drill-down path.

export const CATEGORIES = {
  "web-app": {
    label: "Web application",
    stacks: [
      {
        name: "nextjs",
        label: "Next.js + Tailwind + TypeScript",
        recommended: true,
        lang: "typescript",
        deps: { next: "^15", react: "^19", "react-dom": "^19", tailwindcss: "^4", "@tailwindcss/postcss": "^4" },
        devDeps: { typescript: "^5", "@types/node": "^22", "@types/react": "^19", "@types/react-dom": "^19", vitest: "^3", "@vitejs/plugin-react": "^4" },
        scripts: { dev: "next dev", build: "next build", start: "next start", test: "vitest run" },
      },
      {
        name: "remix",
        label: "Remix + Tailwind + TypeScript",
        lang: "typescript",
        deps: { "@remix-run/react": "^2", "@remix-run/node": "^2", "@remix-run/serve": "^2", react: "^19", "react-dom": "^19", tailwindcss: "^4" },
        devDeps: { typescript: "^5", "@types/react": "^19", vitest: "^3" },
        scripts: { dev: "remix dev", build: "remix build", start: "remix-serve build/server/index.js", test: "vitest run" },
      },
      {
        name: "vue",
        label: "Vue + Vite + TypeScript",
        lang: "typescript",
        deps: { vue: "^3", "vue-router": "^4", tailwindcss: "^4" },
        devDeps: { typescript: "^5", vite: "^6", "@vitejs/plugin-vue": "^5", vitest: "^3", "jsdom": "^25" },
        scripts: { dev: "vite", build: "vite build", preview: "vite preview", test: "vitest run" },
      },
    ],
    layers: {
      frontend: [
        { name: "nextjs", label: "Next.js (Recommended)", lang: "typescript" },
        { name: "remix", label: "Remix", lang: "typescript" },
        { name: "vue", label: "Vue + Vite", lang: "typescript" },
        { name: "none", label: "None (API-only)" },
      ],
      backend: [
        { name: "express", label: "Express.js (Recommended)", lang: "typescript" },
        { name: "fastify", label: "Fastify", lang: "typescript" },
        { name: "fastapi", label: "FastAPI", lang: "python" },
        { name: "none", label: "None (SPA only)" },
      ],
      database: [
        { name: "postgres", label: "PostgreSQL (Recommended)" },
        { name: "sqlite", label: "SQLite" },
        { name: "mysql", label: "MySQL" },
        { name: "none", label: "None" },
      ],
      testing: [
        { name: "playwright", label: "Playwright (Recommended)" },
        { name: "vitest", label: "Vitest" },
        { name: "cypress", label: "Cypress" },
      ],
      ci: [
        { name: "github-actions", label: "GitHub Actions (Recommended)" },
        { name: "none", label: "None" },
      ],
      deploy: [
        { name: "vercel", label: "Vercel (Recommended)" },
        { name: "docker", label: "Docker" },
        { name: "none", label: "None (manual)" },
      ],
    },
  },
  "ml-training": {
    label: "ML model training",
    stacks: [
      {
        name: "pytorch",
        label: "Python + PyTorch + uv",
        recommended: true,
        lang: "python",
        deps: { torch: "^2.6", numpy: "^2", matplotlib: "^3", scikit: "^0.0", "scikit-learn": "^1.6" },
        devDeps: { pytest: "^8", black: "^24", ruff: "^0.9" },
        scripts: { train: "python src/train.py", test: "pytest", lint: "ruff check src/", format: "black src/" },
      },
      {
        name: "tensorflow",
        label: "Python + TensorFlow + uv",
        lang: "python",
        deps: { tensorflow: "^2.18", numpy: "^2", matplotlib: "^3" },
        devDeps: { pytest: "^8", black: "^24", ruff: "^0.9" },
        scripts: { train: "python src/train.py", test: "pytest", lint: "ruff check src/" },
      },
    ],
    layers: {
      framework: [
        { name: "pytorch", label: "PyTorch (Recommended)" },
        { name: "tensorflow", label: "TensorFlow" },
        { name: "jax", label: "JAX" },
      ],
      tracking: [
        { name: "none", label: "None (Recommended)" },
        { name: "wandb", label: "Weights & Biases" },
        { name: "mlflow", label: "MLflow" },
      ],
      deploy: [
        { name: "none", label: "None — local only (Recommended)" },
        { name: "docker", label: "Docker" },
      ],
    },
  },
  "research-paper": {
    label: "Research paper writing",
    stacks: [
      {
        name: "latex",
        label: "LaTeX + Makefile + Zotero",
        recommended: true,
        lang: "latex",
        deps: {},
        devDeps: {},
        scripts: { build: "make", clean: "make clean", watch: "make watch" },
      },
      {
        name: "typst",
        label: "Typst + Makefile",
        lang: "typst",
        deps: {},
        devDeps: {},
        scripts: { build: "typst compile main.typ", watch: "typst watch main.typ" },
      },
    ],
    layers: {
      engine: [
        { name: "latex", label: "LaTeX (Recommended)" },
        { name: "typst", label: "Typst" },
      ],
      bibManager: [
        { name: "zotero", label: "Zotero (Recommended)" },
        { name: "none", label: "Manual .bib" },
      ],
      template: [
        { name: "article", label: "Article (Recommended)" },
        { name: "ieee", label: "IEEE" },
        { name: "acm", label: "ACM" },
      ],
    },
  },
}

export const EXPERIENCE_LEVELS = ["beginner", "experienced"]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/recommendations.test.js`
Expected: all 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/recommendations.js tests/recommendations.test.js
git commit -m "feat: add recommendations catalog with 3 categories and curated stacks"
```

---

### Task 2: Starter templates (starter/)

**Files:**
- Create: `starter/web-app/nextjs/` — file tree (9 files)
- Create: `starter/ml-training/pytorch/` — file tree (6 files)
- Create: `starter/research-paper/latex/` — file tree (5 files)

**Interfaces:**
- Each template dir contains a `starter.yaml` manifest and source files with `{placeholders}`
- Placeholders consumed: `{project_name}`, `{project_description}`

- [ ] **Step 1: `starter/web-app/nextjs/starter.yaml`**

```yaml
# starter manifest — describes what armada new scaffolds for this template.
category: web-app
stack: nextjs
description: "Next.js + Tailwind CSS + TypeScript — full-stack React with file-based routing."
postInstall: "npm install"
```

- [ ] **Step 2: `starter/web-app/nextjs/package.json`**

```json
{
  "name": "{project_name_slug}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "tailwindcss": "^4",
    "typescript": "^5",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "vitest": "^3",
    "@vitejs/plugin-react": "^4"
  }
}
```

- [ ] **Step 3: `starter/web-app/nextjs/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: `starter/web-app/nextjs/postcss.config.mjs`**

```js
/** @type {import('postcss-load-config').Config} */
const config = { plugins: { "@tailwindcss/postcss": {} } }
export default config
```

- [ ] **Step 5: `starter/web-app/nextjs/src/app/layout.tsx`**

```tsx
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "{project_name}",
  description: "{project_description}",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 6: `starter/web-app/nextjs/src/app/page.tsx`**

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold">{project_name}</h1>
    </main>
  )
}
```

- [ ] **Step 7: `starter/web-app/nextjs/src/app/globals.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 8: `starter/web-app/nextjs/.gitignore`**

```
# dependencies
node_modules/
.pnp
.pnp.js

# next.js
.next/
out/

# testing
coverage/

# misc
.DS_Store
*.pem

# env
.env*.local

# typescript
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 9: `starter/web-app/nextjs/README.md`**

```md
# {project_name}

{project_description}

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm run dev` — start development server
- `npm run build` — production build
- `npm start` — start production server
- `npm test` — run tests

Generated by opencode-armada.
```

- [ ] **Step 10: `starter/ml-training/pytorch/starter.yaml`**

```yaml
category: ml-training
stack: pytorch
description: "Python + PyTorch — model training pipeline with uv."
postInstall: "uv sync"
```

- [ ] **Step 11: `starter/ml-training/pytorch/pyproject.toml`**

```toml
[project]
name = "{project_name_slug}"
version = "0.1.0"
description = "{project_description}"
requires-python = ">=3.10"
dependencies = [
    "torch>=2.6",
    "numpy>=2",
    "matplotlib>=3",
    "scikit-learn>=1.6",
]

[project.scripts]
train = "src.train:main"

[build-system]
requires = ["setuptools>=75"]
build-backend = "setuptools.build_meta"
```

- [ ] **Step 12: `starter/ml-training/pytorch/src/train.py`**

```python
"""Train a model on {project_name} data."""
import torch
import torch.nn as nn
import torch.optim as optim


def main():
    print("Training {project_name}...")
    model = nn.Linear(10, 1)
    optimizer = optim.SGD(model.parameters(), lr=0.01)
    loss_fn = nn.MSELoss()

    x = torch.randn(100, 10)
    y = torch.randn(100, 1)

    for epoch in range(10):
        optimizer.zero_grad()
        loss = loss_fn(model(x), y)
        loss.backward()
        optimizer.step()
        print(f"Epoch {epoch + 1}, Loss: {loss.item():.4f}")

    print("Done.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 13: `starter/ml-training/pytorch/src/model.py`**

```python
"""Model definition for {project_name}."""
import torch.nn as nn


class SimpleModel(nn.Module):
    def __init__(self, input_dim: int = 10, output_dim: int = 1):
        super().__init__()
        self.fc = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.ReLU(),
            nn.Linear(64, output_dim),
        )

    def forward(self, x):
        return self.fc(x)
```

- [ ] **Step 14: `starter/ml-training/pytorch/.gitignore`**

```
__pycache__/
*.py[cod]
*.egg-info/
dist/
build/
.venv/
venv/
*.pt
*.pth
.DS_Store
```

- [ ] **Step 15: `starter/ml-training/pytorch/README.md`**

```md
# {project_name}

{project_description}

## Setup

```bash
uv sync
uv run train
```

## Structure

- `src/train.py` — training entry point
- `src/model.py` — model definitions

## Scripts

- `uv run train` — run training
- `uv run pytest` — run tests

Generated by opencode-armada.
```

- [ ] **Step 16: `starter/research-paper/latex/starter.yaml`**

```yaml
category: research-paper
stack: latex
description: "LaTeX research paper — compile with make."
postInstall: null
```

- [ ] **Step 17: `starter/research-paper/latex/main.tex`**

```latex
\documentclass{article}

\title{{project_name}}
\author{{Generated by opencode-armada}}
\date{{\today}}

\begin{{document}}

\maketitle

\begin{{abstract}}
{project_description}
\end{{abstract}}

\section{{Introduction}}

Write your introduction here.

\section{{Methods}}

Describe your methods.

\section{{Results}}

Present your results.

\section{{Discussion}}

Discuss your findings.

\bibliographystyle{{plain}}
\bibliography{{references}}

\end{{document}}
```

- [ ] **Step 18: `starter/research-paper/latex/references.bib`**

```bib
% {project_name} references
```

- [ ] **Step 19: `starter/research-paper/latex/Makefile`**

```makefile
.PHONY: all clean watch

all: main.pdf

main.pdf: main.tex references.bib
	pdflatex main.tex
	bibtex main
	pdflatex main.tex
	pdflatex main.tex

clean:
	rm -f *.aux *.bbl *.blg *.log *.out *.pdf

watch:
	@while true; do inotifywait -e modify *.tex *.bib; make; done
```

- [ ] **Step 20: `starter/research-paper/latex/.gitignore`**

```
*.aux
*.bbl
*.blg
*.log
*.out
*.pdf
.DS_Store
```

- [ ] **Step 21: `starter/research-paper/latex/README.md`**

```md
# {project_name}

{project_description}

## Build

```bash
make
```

## Clean

```bash
make clean
```

## Structure

- `main.tex` — main document
- `references.bib` — bibliography

Generated by opencode-armada.
```

- [ ] **Step 22: Commit**

```bash
git add starter/
git commit -m "feat: add starter templates for web-app, ml-training, research-paper"
```

---

### Task 3: `src/new-command.js` — Core logic

**Files:**
- Create: `src/new-command.js`
- Create: `tests/new-command.test.js`

**Interfaces:**
- Produces: `export function detectExperience()` → `"beginner" | "experienced"`
- Produces: `export function renderTemplate(srcDir, destDir, subs)` → `void` (writes files)
- Produces: `export async function runNew(opts)` → `void` (full flow orchestration)
- Consumes: `import { CATEGORIES } from "./recommendations.js"`
- Consumes: `import { scaffold } from "./scaffold.js"`
- Consumes: `import { detectStack } from "./stack-detect.js"`
- Consumes: `import { defaultManifest } from "./cli.js"` (will export in Task 4)
- Consumes: `import { ask, confirm } from "./questionnaire.js"`

- [ ] **Step 1: Write failing tests for `detectExperience`**

```js
// tests/new-command.test.js (first section)
import { test } from "node:test"
import assert from "node:assert"
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { detectExperience, renderTemplate, experienceDetectForDir } from "../src/new-command.js"
import { CATEGORIES } from "../src/recommendations.js"

test("detectExperience returns beginner or experienced", () => {
  const level = detectExperience()
  assert.ok(level === "beginner" || level === "experienced")
})

test("experienceDetectForDir detects experienced when .gitconfig exists", () => {
  const dir = join(tmpdir(), "armada-new-test-exp-" + Date.now())
  mkdirSync(dir, { recursive: true })
  mkdirSync(join(dir, "fake-home"), { recursive: true })
  writeFileSync(join(dir, "fake-home", ".gitconfig"), "[user]\nname = test\n")
  const level = experienceDetectForDir(join(dir, "fake-home"))
  assert.strictEqual(level, "experienced")
  rmSync(dir, { recursive: true, force: true })
})

test("experienceDetectForDir returns beginner when no signals", () => {
  const dir = join(tmpdir(), "armada-new-test-beg-" + Date.now())
  mkdirSync(dir, { recursive: true })
  const level = experienceDetectForDir(dir)
  assert.strictEqual(level, "beginner")
  rmSync(dir, { recursive: true, force: true })
})

test("renderTemplate copies and substitutes placeholders", () => {
  const src = join(tmpdir(), "armada-new-src-" + Date.now())
  const dest = join(tmpdir(), "armada-new-dest-" + Date.now())
  mkdirSync(src, { recursive: true })
  mkdirSync(join(src, "sub"), { recursive: true })
  writeFileSync(join(src, "test.txt"), "Hello {name}!")
  writeFileSync(join(src, "sub", "nested.txt"), "{greeting}, {name}")
  writeFileSync(join(src, "starter.yaml"), "name: {name}")

  renderTemplate(src, dest, { name: "World", greeting: "Hi" })
  assert.strictEqual(readFileSync(join(dest, "test.txt"), "utf8"), "Hello World!")
  assert.strictEqual(readFileSync(join(dest, "sub", "nested.txt"), "utf8"), "Hi, World")
  // starter.yaml is NOT rendered (it's metadata, not a scaffold file)
  assert.ok(!existsSync(join(dest, "starter.yaml")))
  rmSync(src, { recursive: true, force: true })
  rmSync(dest, { recursive: true, force: true })
})

test("renderTemplate leaves unknown placeholders intact", () => {
  const src = join(tmpdir(), "armada-new-unk-" + Date.now())
  const dest = join(tmpdir(), "armada-new-unk-dest-" + Date.now())
  mkdirSync(src, { recursive: true })
  writeFileSync(join(src, "test.txt"), "Hello {unknown}!")

  renderTemplate(src, dest, { name: "World" })
  assert.strictEqual(readFileSync(join(dest, "test.txt"), "utf8"), "Hello {unknown}!")
  rmSync(src, { recursive: true, force: true })
  rmSync(dest, { recursive: true, force: true })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/new-command.test.js`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement `src/new-command.js`**

```js
// armada new — best-practice repo generator with experience-aware flow.
// Orchestrates: experience gate → category picker → stack selection →
// template render → armada init handoff.

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"
import { join, basename, extname } from "node:path"
import { homedir } from "node:os"
import { execSync } from "node:child_process"
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"

import { CATEGORIES } from "./recommendations.js"
import { scaffold } from "./scaffold.js"
import { detectStack } from "./stack-detect.js"
import { ask, confirm } from "./questionnaire.js"
import { modelFor } from "./model-catalog.js"
import { ROLES } from "./model-catalog.js"

// Detect experience level from $HOME signals. Returns "beginner" or "experienced".
export function detectExperience() {
  return experienceDetectForDir(homedir())
}

// Detect experience from a given directory (testable).
export function experienceDetectForDir(dir) {
  let score = 0
  try { if (existsSync(join(dir, ".gitconfig"))) score++ } catch {}
  try { if (existsSync(join(dir, ".ssh", "id_rsa")) || existsSync(join(dir, ".ssh", "id_ed25519"))) score++ } catch {}
  try { execSync("node --version", { stdio: "ignore" }); score++ } catch {}
  try { execSync("python3 --version", { stdio: "ignore" }); score++ } catch {}
  try { execSync("git --version", { stdio: "ignore" }); score++ } catch {}
  return score >= 2 ? "experienced" : "beginner"
}

// Walk srcDir recursively, substitute {placeholders} in file contents,
// and write to destDir. Skips `starter.yaml` (template metadata, not a
// scaffold file).
export function renderTemplate(srcDir, destDir, subs) {
  mkdirSync(destDir, { recursive: true })
  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry)
    const destPath = join(destDir, entry)
    if (entry === "starter.yaml") continue
    if (statSync(srcPath).isDirectory()) {
      renderTemplate(srcPath, destPath, subs)
    } else {
      let content = readFileSync(srcPath, "utf8")
      content = content.replace(/\{(\w+)\}/g, (m, key) => subs[key] !== undefined ? subs[key] : m)
      writeFileSync(destPath, content, "utf8")
    }
  }
}

// Pick a category interactively. Returns the category key.
async function pickCategory() {
  const keys = Object.keys(CATEGORIES)
  console.log("\nProject category:")
  keys.forEach((k, i) => console.log(`  ${i + 1}. ${CATEGORIES[k].label}`))
  const rl = createInterface({ input: stdin, output: stdout })
  const raw = await rl.question(`Pick 1-${keys.length} [1] `)
  rl.close()
  const idx = parseInt(raw, 10)
  return keys[(Number.isInteger(idx) && idx >= 1 && idx <= keys.length ? idx : 1) - 1]
}

// Pick a stack for a category (beginner path — shows curated options with Recommended).
async function pickStack(category) {
  const stacks = CATEGORIES[category].stacks
  console.log(`\nPick a stack for ${CATEGORIES[category].label}:`)
  stacks.forEach((s, i) => {
    const tag = s.recommended ? " (Recommended)" : ""
    console.log(`  ${i + 1}. ${s.label}${tag}`)
  })
  const rl = createInterface({ input: stdin, output: stdout })
  const def = stacks.findIndex((s) => s.recommended) + 1
  const raw = await rl.question(`Pick 1-${stacks.length} [${def}] `)
  rl.close()
  const idx = parseInt(raw, 10)
  return stacks[(Number.isInteger(idx) && idx >= 1 && idx <= stacks.length ? idx : def) - 1]
}

// Experienced drill-down: per-layer questions. Returns a merged config.
async function drillDown(category) {
  const layers = CATEGORIES[category].layers || {}
  const picks = {}
  console.log("\nDrill-down configuration:")
  for (const [layer, options] of Object.entries(layers)) {
    console.log(`\n${layer}:`)
    options.forEach((o, i) => {
      const tag = i === 0 ? " (Recommended)" : ""
      console.log(`  ${i + 1}. ${o.label}${tag}`)
    })
    const rl = createInterface({ input: stdin, output: stdout })
    const raw = await rl.question(`Pick 1-${options.length} [1] `)
    rl.close()
    const idx = parseInt(raw, 10)
    picks[layer] = options[(Number.isInteger(idx) && idx >= 1 && idx <= options.length ? idx : 1) - 1]
  }
  return picks
}

// Convert a project name to a slug suitable for npm/python package names.
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

// Resolve the template directory for a category + stack. Looks for
// named dir first, falls back to the recommended stack dir.
function resolveTemplateDir(category, stackName) {
  const root = join(import.meta.dirname || join(import.meta.url, ".."), "..", "starter")
  const named = join(root, category, stackName)
  if (existsSync(named)) return named

  // Fallback: use the recommended stack's template
  const rec = CATEGORIES[category]?.stacks?.[0]
  if (rec) return join(root, category, rec.name)
  return null
}

// Build a default manifest for a newly scaffolded project (like
// defaultManifest in cli.js, but with the project name).
function defaultManifestFor(name) {
  return {
    project: {
      name,
      budget: "balanced",
      browserTesting: false,
      devcontainer: false,
      useAgentBrowser: false,
      headless: false,
      requirementsFile: "REQUIREMENTS.md",
      stack: {},
    },
    team: ROLES.map((role) => ({
      role,
      model: modelFor(role, "balanced"),
      fallback: null,
      enabled: true,
    })),
    targetDir: ".",
  }
}

// Main entry: run the `armada new` flow.
// opts: { name, type, beginner, experienced, yes, cwd }
export async function runNew(opts = {}) {
  const cwd = opts.cwd || process.cwd()
  const name = opts.name

  if (!name) {
    console.error("Usage: armada new <project-name> [--type <category>] [--beginner|--experienced] [--yes]")
    process.exitCode = 1
    return
  }

  // 1. Pick category
  let category = opts.type
  if (!category) {
    if (opts.yes || !process.stdin.isTTY) {
      category = Object.keys(CATEGORIES)[0]
    } else {
      category = await pickCategory()
    }
  }
  if (!CATEGORIES[category]) {
    console.error(`Unknown category: ${category}. Available: ${Object.keys(CATEGORIES).join(", ")}`)
    process.exitCode = 1
    return
  }

  // 2. Experience gate
  let level
  if (opts.beginner) level = "beginner"
  else if (opts.experienced) level = "experienced"
  else level = detectExperience()

  if (!opts.yes && !opts.beginner && !opts.experienced && process.stdin.isTTY) {
    const ok = await confirm(`Detected experience: ${level}. Use this?`, true)
    if (ok === null) return // user cancelled
  }

  // 3. Pick stack
  let stackName
  if (opts.beginner || level === "beginner") {
    if (opts.yes || !process.stdin.isTTY) {
      stackName = CATEGORIES[category].stacks[0].name
    } else {
      const chosen = await pickStack(category)
      stackName = chosen.name
    }
  } else {
    if (opts.yes || !process.stdin.isTTY) {
      stackName = CATEGORIES[category].stacks[0].name
    } else {
      await drillDown(category)
      stackName = CATEGORIES[category].stacks[0].name
    }
  }

  // 4. Scaffold project
  const targetDir = join(cwd, name)
  if (existsSync(targetDir)) {
    console.error(`Directory already exists: ${targetDir}`)
    process.exitCode = 1
    return
  }

  const templateDir = resolveTemplateDir(category, stackName)
  if (!templateDir || !existsSync(templateDir)) {
    console.error(`Template not found for ${category}/${stackName}`)
    process.exitCode = 1
    return
  }

  const projectNameSlug = slugify(name)
  const description = `A ${CATEGORIES[category].label.toLowerCase()} project.`
  renderTemplate(templateDir, targetDir, {
    project_name: name,
    project_name_slug: projectNameSlug,
    project_description: description,
  })

  // 5. Read starter.yaml for metadata
  let postInstall = null
  try {
    const starterYaml = readFileSync(join(templateDir, "starter.yaml"), "utf8")
    const lines = starterYaml.split("\n")
    for (const line of lines) {
      if (line.startsWith("postInstall:")) {
        const val = line.split(":")[1]?.trim()
        if (val && val !== "null") postInstall = val
      }
    }
  } catch {
    /* starter.yaml is optional */
  }

  // 6. Run armada init inside the new project directory
  const manifest = defaultManifestFor(name)
  const stack = detectStack(targetDir)
  manifest.targetDir = targetDir
  const files = scaffold(manifest, stack)

  console.log(`\nCreated ${name}/`)
  console.log(`Template: ${CATEGORIES[category].label} / ${stackName}`)
  for (const f of files) console.log(`  + ${f}`)
  console.log("\nNext:")
  console.log(`  cd ${name}`)
  if (postInstall) console.log(`  ${postInstall}`)
  console.log("  opencode")
  console.log("  /armada")
}
```

- [ ] **Step 4: Run unit tests**

Run: `node --test tests/new-command.test.js`
Expected: all 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/new-command.js tests/new-command.test.js
git commit -m "feat: add new-command with experience detection and template rendering"
```

---

### Task 4: `src/cli.js` — Wire "new" subcommand + CLI e2e tests

**Files:**
- Modify: `src/cli.js` — add "new" case to main(), add defaultManifest export

**Interfaces:**
- Modifies: `main()` switch — adds `case "new": return runNew({ name: rest[0], ...flags })`
- Produces: exports `defaultManifest` (rename existing local function, export it)
- Consumes: `import { runNew } from "./new-command.js"`

- [ ] **Step 1: Add failing CLI e2e test**

```js
// Add at end of tests/new-command.test.js
import { runCli, makeTempRepo } from "./helpers.js"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

test("new CLI creates project dir with armada config (non-interactive)", async () => {
  const parent = makeTempRepo({})
  const r = await runCli(["new", "my-test-app", "--type", "web-app", "--beginner", "--yes"], { cwd: parent })
  assert.strictEqual(r.code, 0)
  const projDir = join(parent, "my-test-app")
  assert.ok(existsSync(projDir), "project dir missing")
  assert.ok(existsSync(join(projDir, "package.json")), "package.json missing")
  assert.ok(existsSync(join(projDir, "armada.yaml")), "armada.yaml missing")
  assert.ok(existsSync(join(projDir, ".opencode/oh-my-opencode-slim.jsonc")), "slim jsonc missing")
  assert.ok(existsSync(join(projDir, "src/app/layout.tsx")), "layout.tsx missing")
})

test("new CLI with unknown category errors", async () => {
  const parent = makeTempRepo({})
  const r = await runCli(["new", "bad", "--type", "nope", "--yes"], { cwd: parent })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /Unknown category/)
})

test("new CLI without name shows usage", async () => {
  const r = await runCli(["new"], { cwd: process.cwd() })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /Usage/)
})

test("new CLI rejects existing directory", async () => {
  const parent = makeTempRepo({ "exists": "dir" })
  const r = await runCli(["new", "exists", "--type", "web-app", "--beginner", "--yes"], { cwd: parent })
  assert.strictEqual(r.code, 1)
  assert.match(r.stderr, /already exists/)
})

test("new CLI --type research-paper scaffolds LaTeX project", async () => {
  const parent = makeTempRepo({})
  const r = await runCli(["new", "my-paper", "--type", "research-paper", "--beginner", "--yes"], { cwd: parent })
  assert.strictEqual(r.code, 0)
  const projDir = join(parent, "my-paper")
  assert.ok(existsSync(join(projDir, "main.tex")), "main.tex missing")
  assert.ok(existsSync(join(projDir, "Makefile")), "Makefile missing")
  assert.ok(existsSync(join(projDir, "armada.yaml")), "armada.yaml missing")
})

test("new CLI --type ml-training scaffolds Python project", async () => {
  const parent = makeTempRepo({})
  const r = await runCli(["new", "my-ml", "--type", "ml-training", "--beginner", "--yes"], { cwd: parent })
  assert.strictEqual(r.code, 0)
  const projDir = join(parent, "my-ml")
  assert.ok(existsSync(join(projDir, "pyproject.toml")), "pyproject.toml missing")
  assert.ok(existsSync(join(projDir, "src/train.py")), "train.py missing")
  assert.ok(existsSync(join(projDir, "armada.yaml")), "armada.yaml missing")
})

test("new CLI placeholder substitution in scaffolded files", async () => {
  const parent = makeTempRepo({})
  const r = await runCli(["new", "CoolProject", "--type", "web-app", "--beginner", "--yes"], { cwd: parent })
  assert.strictEqual(r.code, 0)
  const projDir = join(parent, "CoolProject")
  const pkg = JSON.parse(readFileSync(join(projDir, "package.json"), "utf8"))
  assert.strictEqual(pkg.name, "coolproject")
  const layout = readFileSync(join(projDir, "src/app/layout.tsx"), "utf8")
  assert.match(layout, /CoolProject/)
  const readme = readFileSync(join(projDir, "README.md"), "utf8")
  assert.match(readme, /CoolProject/)
  // No dangling placeholders
  assert.doesNotMatch(layout, /\{\w+\}/)
  assert.doesNotMatch(readme, /\{\w+\}/)
})
```

- [ ] **Step 2: Run tests — must fail before implementation**

Run: `node --test tests/new-command.test.js`
Expected: 6 new tests FAIL (CLI "new" not yet wired in main())

- [ ] **Step 3: Modify `src/cli.js`**

1. Add import at top:
```js
import { runNew } from "./new-command.js"
```

2. Add to `main()` switch in the existing `case "help":` block, before it:
```js
case "new": {
  const name = rest[0]
  const typeIdx = rest.indexOf("--type")
  const type = typeIdx !== -1 ? rest[typeIdx + 1] : undefined
  return runNew({
    name,
    type,
    beginner: rest.includes("--beginner"),
    experienced: rest.includes("--experienced"),
    yes: rest.includes("--yes"),
  })
}
```

3. Export `defaultManifest` (rename the existing local function in cli.js, add `export`):

Find:
```js
function defaultManifest() {
```
Replace with:
```js
export function defaultManifest() {
```

4. Update the help text in `HELP` to include `new`:

Add after the `Usage:` section header:
```
  armada new <name> [--type <c>] [--beginner|--experienced] [--yes]
                          create new project from curated starter template
```

- [ ] **Step 4: Run all tests**

Run: `node --test 'tests/*.test.js'`
Expected: all tests PASS

- [ ] **Step 5: Manual smoke test**

Run:
```bash
node src/cli.js help
```
Expected: help shows `new` command

- [ ] **Step 6: Commit**

```bash
git add src/cli.js tests/new-command.test.js
git commit -m "feat: wire armada new subcommand in CLI with e2e tests"
```

---

### Task 5: Integration — run full test suite and verify

**Files:**
- None new; verify all existing

- [ ] **Step 1: Run full test suite**

Run: `node --test 'tests/*.test.js'`
Expected: ALL tests PASS (existing + new)

- [ ] **Step 2: Manual integration test**

```bash
# Create temp dir and run armada new
cd /tmp
mkdir armada-new-e2e && cd armada-new-e2e
node /path/to/opencode-armada/src/cli.js new my-app --type web-app --beginner --yes
ls my-app/
# Should see: package.json tsconfig.json src/ .opencode/ armada.yaml opencode.json AGENTS.md
cat my-app/armada.yaml
# Should show valid yaml with stack detected from the scaffolded files
```

- [ ] **Step 3: Commit if any fixes needed**

```bash
git add -A && git commit -m "chore: integration fixes for armada new"
```

---
