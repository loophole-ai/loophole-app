/**
 * Which terminal interface `loophole-cli` and `loophole-cli run` open, chosen with the LOOPHOLE_TUI environment variable:
 *
 *   (unset) / screen   the Loophole screen (default)
 *   basic              the basic pi-tui chat from patch 0008
 *   mini               the plain interface that upstream ships; `loophole-cli run` then prints and exits
 *
 * Piped input/output always uses the plain paths regardless of this setting.
 */
export type UiMode = "screen" | "basic" | "mini"

export function uiMode(env: Record<string, string | undefined> = process.env): UiMode {
  const value = env.LOOPHOLE_TUI?.trim().toLowerCase()
  return value === "basic" || value === "mini" ? value : "screen"
}
