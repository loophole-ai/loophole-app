/**
 * Loophole logo for TUI
 * Small, compact version for terminal display
 */

export const logo = {
  small: [
    "▄▄  ▄▄▄▄  ▄▄▄▄▄▄▄  ▄▄▄   ▄▄",
    "█  █▀▀▀  █▀▀▀  █  █▀▀█  █",
    "█  █    █    █▄▄█  █    █",
    "█▄ █▄▄▄ █▄▄▄ █    █▄▄█▄",
    "████████████    ████████  ",
  ],
  tiny: [
    "▄▄  ▄▄▄▄  ▄▄▄▄",
    "█  █▀▀▀  █▀▀",
    "█  █    █   ",
    "█▄ █▄▄▄ █▄▄",
    "████████████",
  ],
}

export function getLogoLines(size: "small" | "tiny" = "small"): string[] {
  return logo[size]
}

export function getLogoText(): string {
  return "Loophole"
}
