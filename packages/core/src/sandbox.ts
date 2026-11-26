import { spawnSync } from "node:child_process"
import path from "node:path"

export type SandboxMode = "off" | "auto" | "on"

export type SandboxConfig = {
  mode: SandboxMode
  writable: string[]
  denyRead: string[]
}

export type SandboxedCommand = {
  command: string
  args: string[]
  env: Record<string, string | undefined>
}

const has = (cmd: string) => {
  const check = process.platform === "win32" ? "where" : "which"
  const result = spawnSync(check, [cmd], { stdio: "ignore" })
  return result.status === 0
}

const linux = () => has("bwrap")
const darwin = () => has("sandbox-exec")

export function supported() {
  if (process.platform === "linux") return linux()
  if (process.platform === "darwin") return darwin()
  return false
}

export function wrap(
  shell: string,
  args: string[],
  cwd: string,
  env: Record<string, string | undefined>,
  config: SandboxConfig,
): SandboxedCommand {
  if (config.mode === "off") return { command: shell, args, env }
  if (process.platform === "linux" && linux()) return bwrap(shell, args, cwd, env, config)
  if (process.platform === "darwin" && darwin()) return seatbelt(shell, args, cwd, env, config)
  if (config.mode === "on") throw new Error("Sandbox requested but no supported OS sandbox backend is available")
  return { command: shell, args, env }
}

function bwrap(
  shell: string,
  args: string[],
  cwd: string,
  env: Record<string, string | undefined>,
  config: SandboxConfig,
): SandboxedCommand {
  const writable = Array.from(new Set([cwd, ...config.writable].map((p) => path.resolve(p))))
  const denyRead = Array.from(new Set(config.denyRead.map((p) => path.resolve(p))))
  const cmd = [
    "--die-with-parent",
    "--new-session",
    "--ro-bind",
    "/",
    "/",
    "--dev",
    "/dev",
    "--proc",
    "/proc",
    "--tmpfs",
    "/tmp",
    ...writable.flatMap((p) => ["--bind", p, p]),
    ...denyRead.flatMap((p) => ["--tmpfs", p]),
    "--chdir",
    cwd,
    shell,
    ...args,
  ]
  return { command: "bwrap", args: cmd, env }
}

function seatbelt(
  shell: string,
  args: string[],
  cwd: string,
  env: Record<string, string | undefined>,
  config: SandboxConfig,
): SandboxedCommand {
  const writable = Array.from(new Set([cwd, ...config.writable].map((p) => path.resolve(p))))
  const denyRead = Array.from(new Set(config.denyRead.map((p) => path.resolve(p))))
  const allowWrite = writable.map((p) => `(allow file-write* (subpath ${quote(p)}))`).join("\n")
  const deny = denyRead.map((p) => `(deny file-read* (subpath ${quote(p)}))`).join("\n")
  const policy = [
    "(version 1)",
    "(deny default)",
    "(allow process*)",
    "(allow sysctl-read)",
    "(allow mach-lookup)",
    "(allow ipc-posix-shm*)",
    "(allow file-read*)",
    "(allow file-write* (subpath \"/tmp\"))",
    "(allow file-write* (subpath \"/private/tmp\"))",
    "(allow file-write* (subpath \"/var/folders\"))",
    allowWrite,
    deny,
    "(allow network*)",
  ].join("\n")
  return { command: "sandbox-exec", args: ["-p", policy, shell, ...args], env }
}

function quote(value: string) {
  return JSON.stringify(value)
}
