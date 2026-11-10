/**
 * Small preference store for the Loophole screen.
 *
 * The screen remembers the model the user last picked so a fresh CLI launch
 * does not fall back to the server default. It lives in the global state
 * directory rather than `cli.json` so a screen write can never corrupt the
 * config service's file, and so it stays independent of the project config.
 */

import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { Global } from "@opencode/util/global"

export interface ScreenModelPreference {
  readonly providerID: string
  readonly id: string
  readonly variant?: string
}

export interface ScreenPreferences {
  readonly model?: ScreenModelPreference
  readonly recentModels?: ReadonlyArray<ScreenModelPreference>
}

const MAX_RECENT = 8

function file(): string {
  return join(Global.Path.state, "screen.json")
}

function decodeModel(value: unknown): ScreenModelPreference | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const record = value as Record<string, unknown>
  if (typeof record.providerID !== "string" || record.providerID.length === 0) return undefined
  if (typeof record.id !== "string" || record.id.length === 0) return undefined
  const variant = typeof record.variant === "string" && record.variant.length > 0 ? record.variant : undefined
  return variant ? { providerID: record.providerID, id: record.id, variant } : { providerID: record.providerID, id: record.id }
}

export function readScreenPreferences(): ScreenPreferences {
  try {
    const parsed: unknown = JSON.parse(readFileSync(file(), "utf8"))
    if (typeof parsed !== "object" || parsed === null) return {}
    const record = parsed as Record<string, unknown>
    const model = decodeModel(record.model)
    const recent = Array.isArray(record.recentModels)
      ? record.recentModels.flatMap((item) => {
          const entry = decodeModel(item)
          return entry ? [entry] : []
        })
      : undefined
    return {
      ...(model ? { model } : {}),
      ...(recent && recent.length > 0 ? { recentModels: recent } : {}),
    }
  } catch {
    return {}
  }
}

function write(preferences: ScreenPreferences): void {
  const target = file()
  try {
    mkdirSync(dirname(target), { recursive: true })
    const temp = `${target}.tmp`
    writeFileSync(temp, `${JSON.stringify(preferences, null, 2)}\n`, "utf8")
    renameSync(temp, target)
  } catch {
    // Preferences are a convenience; never fail a prompt because they cannot be saved.
  }
}

export function saveScreenModel(model: ScreenModelPreference): void {
  const current = readScreenPreferences()
  const key = `${model.providerID}/${model.id}`
  const recent = [model, ...(current.recentModels ?? []).filter((item) => `${item.providerID}/${item.id}` !== key)].slice(
    0,
    MAX_RECENT,
  )
  write({ model, recentModels: recent })
}
