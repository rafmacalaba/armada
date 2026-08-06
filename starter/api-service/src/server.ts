// {{ cookiecutter.project_name }}
// {{ cookiecutter.description }}

import express from "express"
import healthRouter from "./routes/health.js"

const app = express()
const PORT = process.env.PORT || 3000

app.use("/health", healthRouter)

app.listen(PORT, () => {
  console.log(`{{ cookiecutter.project_name }} listening on port ${PORT}`)
})

export default app
