#!/usr/bin/env node
// Verifies the connection the editor makes to the shared background service.
//
// It runs the same @opencode/client `ensure()` call as loopholeCliChannel.ts against the real CLI
// service, in a throwaway state directory, and sends the same requests the editor sends
// (basic auth + x-opencode-directory). Exits non-zero if any check fails.
//
//   bun run --cwd packages/client build     # once: builds @opencode/client
//   node ide/scripts/loophole-verify-service.mjs
//
// Environment:
//   LOOPHOLE_CLIENT_DIR      built @opencode/client (default: packages/client/dist)
//   LOOPHOLE_VERIFY_CLI      CLI command to run, split on spaces
//                            (default: "bun run --cwd packages/cli src/index.ts", i.e. from source)
//   LOOPHOLE_SERVICE_CHANNEL channel of that CLI (default: local, which is what source builds use)

import assert from "node:assert/strict"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, "..", "..")
const channelFile = join(repo, "ide/src/vs/workbench/contrib/void/electron-main/loopholeCliChannel.ts")
const chatFile = join(repo, "ide/src/vs/workbench/contrib/void/electron-main/llmMessage/loopholeCliChat.ts")

// ---- isolated environment: nothing here may touch the real service, database or config ----
const sandbox = mkdtempSync(join(tmpdir(), "loophole-verify-"))
const dirs = { HOME: "home", XDG_STATE_HOME: "state", XDG_DATA_HOME: "data", XDG_CONFIG_HOME: "config", XDG_CACHE_HOME: "cache" }
for (const [name, sub] of Object.entries(dirs)) process.env[name] = join(sandbox, sub)
const projA = join(sandbox, "projA")
const projB = join(sandbox, "projB")
const missing = join(sandbox, "does-not-exist")
for (const dir of Object.values(dirs).map((sub) => join(sandbox, sub)).concat([projA, projB])) {
  await import("node:fs").then((fs) => fs.mkdirSync(dir, { recursive: true }))
}
// Same step the editor takes before ensure(): the client must watch the file the CLI writes.
process.env.OPENCODE_CHANNEL = process.env.LOOPHOLE_SERVICE_CHANNEL ?? "local"
const registration = join(
  process.env.XDG_STATE_HOME,
  "loophole",
  process.env.OPENCODE_CHANNEL === "dev" || process.env.OPENCODE_CHANNEL === "latest" ? "service.json" : `service-${process.env.OPENCODE_CHANNEL}.json`,
)

const clientDir = process.env.LOOPHOLE_CLIENT_DIR ?? join(repo, "packages/client/dist")
const clientFile = join(clientDir, "promise", "service.js")
const command = (process.env.LOOPHOLE_VERIFY_CLI ?? `${process.env.BUN ?? "bun"} run --cwd ${join(repo, "packages/cli")} src/index.ts`)
  .split(" ")
  .filter(Boolean)
  .concat(["serve", "--service"])

// ---- tiny runner ----
const results = []
async function check(name, fn) {
  const started = Date.now()
  try {
    await fn()
    results.push({ name, ok: true })
    console.log(`  PASS  ${name} (${Date.now() - started}ms)`)
  } catch (error) {
    results.push({ name, ok: false })
    console.log(`  FAIL  ${name}\n        ${String(error?.message ?? error).split("\n").join("\n        ")}`)
  }
}

function registeredPid() {
  try {
    return JSON.parse(readFileSync(registration, "utf8")).pid
  } catch {
    return undefined
  }
}

function killRegistered() {
  const pid = registeredPid()
  if (pid === undefined) return
  try {
    process.kill(pid)
  } catch {
    /* already gone */
  }
}

let svc
let endpoint
let port
let auth
const headers = (directory) => ({ Authorization: auth, ...(directory ? { "x-opencode-directory": encodeURIComponent(directory) } : {}) })
const url = (p) => `http://127.0.0.1:${port}${p}`

console.log(`sandbox: ${sandbox}`)
console.log(`channel: ${process.env.OPENCODE_CHANNEL}   cli: ${command.join(" ")}\n`)

try {
  console.log("static checks on the editor source")
  await check("loopholeCliChannel.ts connects with ensure() and sends the folder header", () => {
    const source = readFileSync(channelFile, "utf8")
    for (const wanted of ["service.ensure(", "'serve', '--service'", "x-opencode-directory", "OPENCODE_CHANNEL", "LOOPHOLE_SERVICE_CHANNEL"]) {
      assert.ok(source.includes(wanted), `missing ${wanted}`)
    }
  })
  await check("loopholeCliChannel.ts no longer spawns its own server, picks a port or polls", () => {
    const source = readFileSync(channelFile, "utf8")
    for (const gone of ["freePort", "_waitReady", "_waitForPlugins", "'--port'", "randomBytes", "OPENCODE_SERVER_PASSWORD", "spawn("]) {
      assert.ok(!source.includes(gone), `still contains ${gone}`)
    }
  })
  await check("loopholeCliChat.ts event stream uses the service username and folder header", () => {
    const source = readFileSync(chatFile, "utf8")
    assert.ok(source.includes("connection.username") && source.includes("x-opencode-directory"))
    assert.ok(!source.includes("`loophole:${"), "still hardcodes the loophole: username")
  })

  console.log("\nthe built @opencode/client module")
  await check("is built and only imports Node built-ins", async () => {
    assert.ok(existsSync(clientFile), `not built: ${clientFile} (run: bun run --cwd packages/client build)`)
    const seen = new Set()
    const bare = new Set()
    const walk = (file) => {
      if (seen.has(file)) return
      seen.add(file)
      const text = readFileSync(file, "utf8")
      for (const match of text.matchAll(/^\s*(?:import|export)\b[^"';]*?\bfrom\s*["']([^"']+)["']/gms)) {
        const spec = match[1]
        if (spec.startsWith(".")) walk(resolve(dirname(file), spec))
        else if (!spec.startsWith("node:")) bare.add(spec)
      }
    }
    walk(clientFile)
    assert.deepEqual([...bare], [], `non-Node imports: ${[...bare].join(", ")}`)
    svc = await import(pathToFileURL(clientFile).href)
    assert.equal(typeof svc.ensure, "function")
    assert.equal(typeof svc.stop, "function")
  })

  if (!svc) throw new Error("client module unavailable; cannot run the live checks")

  console.log("\nlive checks against the real CLI service")
  let started
  await check("ensure() starts the service and returns an endpoint with basic auth", async () => {
    endpoint = await svc.ensure({ command, onStart: (reason) => (started = reason) })
    assert.equal(started, "missing")
    assert.equal(endpoint.auth?.type, "basic")
    assert.ok(endpoint.auth.username && endpoint.auth.password.length >= 16, "credentials missing or weak")
    port = Number(new URL(endpoint.url).port)
    assert.ok(port > 0, `no port in ${endpoint.url}`)
    auth = "Basic " + Buffer.from(`${endpoint.auth.username}:${endpoint.auth.password}`).toString("base64")
  })
  if (!endpoint) throw new Error("service did not start; cannot continue")

  await check("a request with the right credentials is accepted, a wrong password is refused (401)", async () => {
    const ok = await fetch(url("/api/session/active"), { headers: headers() })
    assert.equal(ok.status, 200)
    const bad = await fetch(url("/api/session/active"), { headers: { Authorization: "Basic " + Buffer.from("x:y").toString("base64") } })
    assert.equal(bad.status, 401)
    const none = await fetch(url("/api/session/active"))
    assert.equal(none.status, 401)
  })

  await check("one service answers for different folders, chosen per request by x-opencode-directory", async () => {
    for (const dir of [projA, projB]) {
      const response = await fetch(url("/api/provider"), { headers: headers(dir) })
      assert.equal(response.status, 200, `${dir} -> ${response.status}`)
      const body = await response.json()
      assert.equal(body.location?.directory, dir)
    }
  })

  await check("a folder that does not exist is refused (404 LocationNotFoundError)", async () => {
    const response = await fetch(url("/api/provider"), { headers: headers(missing) })
    assert.equal(response.status, 404)
    assert.equal((await response.json())._tag, "LocationNotFoundError")
  })

  await check("a POST with a JSON body and the folder header creates a session", async () => {
    const response = await fetch(url("/api/session"), {
      method: "POST",
      headers: { ...headers(projA), "Content-Type": "application/json" },
      body: JSON.stringify({ title: "verify" }),
    })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.match(body.data?.id ?? "", /^ses_/)
  })

  await check("the /api/event stream opens with the folder header and sends server.connected first", async () => {
    const controller = new AbortController()
    try {
      const response = await fetch(url("/api/event"), { headers: headers(projA), signal: controller.signal })
      assert.equal(response.status, 200)
      assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/)
      const first = new TextDecoder().decode((await response.body.getReader().read()).value)
      assert.ok(first.includes("server.connected"), `first frame: ${first.slice(0, 100)}`)
    } finally {
      controller.abort()
    }
  })

  await check("a second ensure() reuses the running service instead of starting another", async () => {
    const pid = registeredPid()
    let startedAgain = false
    const again = await svc.ensure({ command, onStart: () => (startedAgain = true) })
    assert.equal(startedAgain, false)
    assert.equal(again.url, endpoint.url)
    assert.equal(registeredPid(), pid)
  })

  await check("a version predicate that accepts the running service reuses it", async () => {
    let startedAgain = false
    const again = await svc.ensure({ command, version: () => true, onStart: () => (startedAgain = true) })
    assert.equal(startedAgain, false)
    assert.equal(again.url, endpoint.url)
  })

  await check("a version predicate that rejects the running service replaces it (version-mismatch)", async () => {
    const before = registeredPid()
    let reason
    let replaced = false
    // The client warns (and drops persistent terminals) when the old service refuses the handoff.
    const warnings = []
    const warn = console.warn
    console.warn = (...args) => warnings.push(args.map(String).join(" "))
    let next
    try {
      next = await svc.ensure({
        command,
        version: () => replaced,
        onStart: (why) => {
          reason = why
          replaced = true
        },
      })
    } finally {
      console.warn = warn
    }
    assert.equal(reason, "version-mismatch")
    const handoff = warnings.find((line) => line.includes("cannot hand off persistent terminals"))
    assert.equal(handoff, undefined, `terminal handoff to the old service was refused: ${handoff?.slice(0, 200)}`)
    assert.notEqual(registeredPid(), before, "same process still registered")
    endpoint = next
    port = Number(new URL(next.url).port)
    auth = "Basic " + Buffer.from(`${next.auth.username}:${next.auth.password}`).toString("base64")
    const response = await fetch(url("/api/session/active"), { headers: headers() })
    assert.equal(response.status, 200)
  })

  await check("stop() shuts the service down", async () => {
    await svc.stop()
    const deadline = Date.now() + 8000
    let down = false
    while (Date.now() < deadline && !down) {
      down = await fetch(url("/api/session/active"), { headers: headers() }).then(
        () => false,
        () => true,
      )
      if (!down) await new Promise((r) => setTimeout(r, 250))
    }
    assert.ok(down, "service still answering 8s after stop()")
  })
} finally {
  killRegistered()
  rmSync(sandbox, { recursive: true, force: true })
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
