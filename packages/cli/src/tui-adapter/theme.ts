/**
 * Minimal editor/select-list/markdown theming for the pi-style interactive TUI.
 * Intentionally a single flat palette; a real theme system can be layered on
 * top later without changing call sites.
 */

import {
	getTerminalColorMode,
	parseColor,
	styleText,
	type MarkdownTheme,
	type SelectListTheme,
	type TextStyle,
} from "@loophole/tui-pi"

export const adapterColors = {
	accent: parseColor("#a78bfa"),
	text: parseColor("#c8c8d0"),
	dim: parseColor("#7a7a86"),
	accentDim: parseColor("#6d5f9e"),
	error: parseColor("#f87171"),
}

// Resolved per call so a terminal without truecolor support gets 256-color output.
function themed(text: string, style: TextStyle): string {
	return styleText(text, style, getTerminalColorMode())
}

export function dim(text: string): string {
	return themed(text, { fg: adapterColors.dim })
}

export function accent(text: string): string {
	return themed(text, { fg: adapterColors.accent })
}

export function danger(text: string): string {
	return themed(text, { fg: adapterColors.error })
}

function selectable(text: string, selected: boolean): string {
	return selected ? themed(text, { bold: true, fg: adapterColors.accent }) : themed(text, { fg: adapterColors.dim })
}

const selectListTheme = {
	selectedPrefix: (text: string) => selectable(text, true),
	selectedText: (text: string) => selectable(text, true),
	description: dim,
	scrollInfo: dim,
	noMatch: dim,
} satisfies SelectListTheme

export const editorTheme = {
	borderColor: dim,
	selectList: selectListTheme,
}

export const markdownTheme: MarkdownTheme = {
	heading: (text) => themed(text, { bold: true, fg: adapterColors.accent }),
	link: (text) => themed(text, { underline: true, fg: adapterColors.accent }),
	linkUrl: dim,
	code: (text) => themed(text, { fg: adapterColors.accentDim }),
	codeBlock: (text) => themed(text, { fg: adapterColors.text }),
	codeBlockBorder: dim,
	quote: (text) => themed(text, { italic: true, fg: adapterColors.dim }),
	quoteBorder: dim,
	hr: dim,
	listBullet: accent,
	bold: (text) => themed(text, { bold: true }),
	italic: (text) => themed(text, { italic: true }),
	strikethrough: (text) => themed(text, { strikethrough: true }),
	underline: (text) => themed(text, { underline: true }),
}
