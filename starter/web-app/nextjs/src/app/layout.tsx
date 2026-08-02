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
