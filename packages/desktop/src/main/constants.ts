import { app } from "electron"

type Channel = "local" | "dev" | "beta" | "prod"

const raw = import.meta.env.OPENCODE_CHANNEL

export const CHANNEL: Channel = raw === "local" || raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

export const VERSION = app.isPackaged ? app.getVersion() : (process.env.OPENCODE_VERSION ?? app.getVersion())

const appNames: Record<string, string> = {
  dev: "Loophole Desktop Dev",
  beta: "Loophole Desktop Beta",
  prod: "Loophole Desktop",
}

const appIDs: Record<string, string> = {
  dev: "ai.loophole.desktop.dev",
  beta: "ai.loophole.desktop.beta",
  prod: "ai.loophole.desktop",
}

// Local renderer/server mode keeps the dev application identity.
export const APP_NAME = app.isPackaged ? appNames[CHANNEL] : "Loophole Desktop Dev"

export const APP_ID = app.isPackaged ? appIDs[CHANNEL] : "ai.loophole.desktop.dev"
