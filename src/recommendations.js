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
        deps: { torch: "^2.6", numpy: "^2", matplotlib: "^3", "scikit-learn": "^1.6" },
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
