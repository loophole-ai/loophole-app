import { RGBA, TextAttributes } from "@opentui/core"
import { For, type JSX } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTheme } from "../context/theme"
import { go, logo } from "../logo"

export function Logo() {
  const theme = useTheme()
  const dimensions = useTerminalDimensions()

  const renderLine = (line: string, fg: RGBA, bold: boolean): JSX.Element[] => {
    const attrs = bold ? TextAttributes.BOLD : undefined
    return Array.from(line).map((char) => (
      <text fg={fg} attributes={attrs} selectable={false}>
        {char}
      </text>
    ))
  }

  const renderArt = (art: string[], fg: RGBA, bold: boolean) => (
    <For each={art}>
      {(line) => <box flexDirection="row">{renderLine(line, fg, bold)}</box>}
    </For>
  )

  return (
    <box>
      {dimensions().height < 12 ? null : dimensions().width < 22 ? (
        <For each={go.right.slice(1)}>
          {(line) => <box flexDirection="row">{renderLine(line, theme.text.base, true)}</box>}
        </For>
      ) : dimensions().width < 44 || dimensions().height < 16 ? (
        renderArt(logo.narrow, theme.text.muted, false)
      ) : (
        renderArt(logo.wide, theme.text.muted, false)
      )}
    </box>
  )
}
