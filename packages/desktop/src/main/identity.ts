import path from "node:path"

export type Channel = "local" | "dev" | "beta" | "prod"

const appNames: Record<Channel, string> = {
  local: "Loophole Desktop Dev",
  dev: "Loophole Desktop Dev",
  beta: "Loophole Desktop Beta",
  prod: "Loophole Desktop",
}

const appIDs: Record<Channel, string> = {
  local: "ai.loophole.desktop.dev",
  dev: "ai.loophole.desktop.dev",
  beta: "ai.loophole.desktop.beta",
  prod: "ai.loophole.desktop",
}

// Unpackaged dev runs keep the dev profile directory (`appID`), but use a separate Windows
// AppUserModelID: Electron writes a Start Menu `Electron.lnk` with the active AUMID on the first
// toast, which would otherwise shadow the installed Loophole Desktop Dev shortcut and route its toast
// clicks to bare `electron.exe`.
const LOCAL_APP_USER_MODEL_ID = "ai.loophole.desktop.local"

export function resolveIdentity(channel: Channel, packaged: boolean) {
  return {
    appName: packaged ? appNames[channel] : "Loophole Desktop Dev",
    appID: packaged ? appIDs[channel] : "ai.loophole.desktop.dev",
    appUserModelID: packaged ? appIDs[channel] : LOCAL_APP_USER_MODEL_ID,
  }
}

export function isCollidingDevShortcut(
  shortcut: { readonly appUserModelId?: string; readonly target: string },
  appUserModelID: string,
  execPath: string,
) {
  if (!shortcut.appUserModelId) return false

  if (shortcut.appUserModelId.toLowerCase() !== appUserModelID.toLowerCase()) return false

  return path.win32.normalize(shortcut.target).toLowerCase() !== path.win32.normalize(execPath).toLowerCase()
}
