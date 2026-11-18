import { OpenCode } from "@opencode/client"
import { Service, type Endpoint } from "@opencode/client/effect/service"
import { Global } from "@opencode/util/global"
import { Effect, Option, Redacted } from "effect"
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, rmSync } from "node:fs"
import path from "node:path"
import { EOL } from "node:os"
import { Commands, Standalone as StandaloneFlag, Server as ServerFlag } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServiceConfig } from "../../services/service-config"
import { Env } from "../../env"
import { databasePath } from "../../database-path"
import { OPENCODE_CHANNEL, OPENCODE_VERSION } from "../../version"

type Status = "pass" | "warn" | "fail"
type Check = { readonly name: string; readonly status: Status; readonly detail: string }

const MARK = { pass: "PASS", warn: "WARN", fail: "FAIL" } as const

const writable = (dir: string) => {
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    const probe = path.join(dir, `.loophole-doctor-${process.pid}-${Date.now()}`)
    writeFileSync(probe, "")
    rmSync(probe, { force: true })
    return true
  } catch {
    return false
  }
}

const gitText = (args: string[]) => {
  try {
    const result = Bun.spawnSync(["git", ...args], { stdout: "pipe", stderr: "pipe" })
    return { code: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() }
  } catch {
    return { code: -1, stdout: "", stderr: "git is not available on this system" }
  }
}

export default Runtime.handler(
  Commands.commands.doctor,
  Effect.fn("cli.doctor")(function* (input) {
    const checks: Check[] = []
    const add = (name: string, status: Status, detail: string) => checks.push({ name, status, detail })

    // --- CLI and runtime ---------------------------------------------------
    add(
      "cli",
      "pass",
      `loophole ${OPENCODE_VERSION} (${OPENCODE_CHANNEL}) on ${process.platform} ${process.arch}`,
    )
    add(
      "runtime",
      "pass",
      process.versions.bun ? `bun ${process.versions.bun}` : `node ${process.version}`,
    )

    // --- git ---------------------------------------------------------------
    const version = gitText(["--version"])
    if (version.code !== 0) {
      add("git", "warn", "not found — loophole commit needs git")
    } else {
      const inside = gitText(["rev-parse", "--is-inside-work-tree"])
      add(
        "git",
        inside.code === 0 && inside.stdout.trim() === "true" ? "pass" : "warn",
        `${version.stdout.trim()}${inside.code === 0 && inside.stdout.trim() === "true" ? " · inside a work tree" : " · not in a git repository"}`,
      )
    }

    // --- global paths -------------------------------------------------------
    const global = yield* Global.Service
    const paths = [
      ["home", global.home],
      ["data", global.data],
      ["config", global.config],
      ["cache", global.cache],
      ["state", global.state],
      ["tmp", global.tmp],
    ] as const
    for (const [name, dir] of paths) {
      if (writable(dir)) {
        add(`paths.${name}`, "pass", `${dir} (writable)`)
        continue
      }
      add(`paths.${name}`, "fail", `${dir} is not writable`)
    }

    // --- database ------------------------------------------------------------
    const db = databasePath(global.data)
    try {
      const info = statSync(db)
      add("database", "pass", `${db} (${String(Math.round(info.size / 1024))} kB)`)
    } catch {
      add("database", "warn", `${db} does not exist yet — it is created on first run`)
    }

    // --- configuration --------------------------------------------------------
    try {
      const entries = readdirSync(global.config)
      const configs = entries.filter((entry) => /^(loophole|opencode)\.jsonc?$/.test(entry) || entry === "agents" || entry === "plugins")
      add("config", "pass", configs.length > 0 ? `${configs.length} configurable entr${configs.length === 1 ? "y" : "ies"} in ${global.config}` : `${global.config} (no configuration files, defaults are used)`)
    } catch {
      add("config", "warn", `${global.config} could not be read`)
    }

    // --- server --------------------------------------------------------------
    const serverFlag = yield* Effect.serviceOption(ServerFlag).pipe(Effect.map(Option.flatten))
    const standalone = Option.getOrElse(yield* Effect.serviceOption(StandaloneFlag), () => false)
    const server = Option.getOrUndefined(serverFlag)
    if (server !== undefined) {
      const password = yield* Env.password
      const endpoint = {
        url: server,
        auth: password ? { type: "basic" as const, username: "loophole", password: Redacted.value(password) } : undefined,
      } satisfies Endpoint
      const client = OpenCode.make({ baseUrl: endpoint.url, headers: Service.headers(endpoint) })
      const health = yield* Effect.tryPromise({
        try: () => client.server.info({ signal: AbortSignal.timeout(5_000) }),
        catch: () => null,
      })
      if (health === null) {
        add("server", "fail", `--server ${server} is not reachable`)
      } else {
        add("server", "pass", `${server} is up (server ${health.version})`)
      }
    } else if (standalone) {
      add("server", "warn", "skipped — commands will start their own private server (--standalone)")
    } else {
      const options = yield* ServiceConfig.options()
      const found = yield* Service.discover({ ...options, version: undefined })
      if (found) {
        add("server", "pass", `background service reachable at ${found.url}`)
      } else {
        add("server", "warn", "not running — start it by running `loophole` once, or use --standalone")
      }
    }

    // --- summary --------------------------------------------------------------
    const failures = checks.filter((check) => check.status === "fail").length
    const warnings = checks.filter((check) => check.status === "warn").length

    if (input.json) {
      process.stdout.write(JSON.stringify({ checks, summary: { failures, warnings } }, null, 2) + EOL)
    } else {
      process.stdout.write(EOL)
      for (const check of checks) {
        process.stdout.write(`  ${MARK[check.status].padEnd(5)} ${check.name.padEnd(10)} ${check.detail}${EOL}`)
      }
      process.stdout.write(EOL)
      process.stdout.write(`${String(checks.length)} checks · ${String(failures)} failed · ${String(warnings)} warning${warnings === 1 ? "" : "s"}${EOL}`)
      if (failures > 0) process.stdout.write("Fix the FAIL entries above and re-run `loophole doctor`." + EOL)
    }

    if (failures > 0) process.exitCode = 1
  }),
)
