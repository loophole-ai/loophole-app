/**
 * Simplified footer component for Loophole TUI
 * Based on PI's footer but adapted for loophole backend
 */

import { type Component, truncateToWidth } from "@loophole/tui-pi"

interface FooterData {
  cwd: string
  model?: string
  tokensIn?: number
  tokensOut?: number
  busy?: boolean
}

/**
 * Footer component that shows pwd and basic stats
 */
export class FooterComponent implements Component {
  private data: FooterData

  constructor(data: FooterData) {
    this.data = data
  }

  update(data: Partial<FooterData>): void {
    this.data = { ...this.data, ...data }
  }

  invalidate(): void {
    // Stateless: render() always reads the latest data.
  }

  render(width: number): string[] {
    const lines: string[] = []

    // PWD line
    const pwd = this.data.cwd
    const pwdLine = truncateToWidth(pwd, width, "...")
    lines.push(pwdLine)

    // Stats line
    const statsParts = []
    if (this.data.tokensIn) statsParts.push(`↑${this.formatTokens(this.data.tokensIn)}`)
    if (this.data.tokensOut) statsParts.push(`↓${this.formatTokens(this.data.tokensOut)}`)
    if (this.data.model) statsParts.push(this.data.model)
    if (this.data.busy) statsParts.push("working... (esc to interrupt)")

    const statsLine = statsParts.join(" ")
    const truncatedStats = truncateToWidth(statsLine, width, "...")
    lines.push(truncatedStats)

    return lines
  }

  private formatTokens(count: number): string {
    if (count < 1000) return count.toString()
    if (count < 10000) return `${(count / 1000).toFixed(1)}k`
    if (count < 1000000) return `${Math.round(count / 1000)}k`
    return `${Math.round(count / 1000000)}M`
  }
}
