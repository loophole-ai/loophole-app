import { OpenCode } from "@opencode/client"
import { Service } from "@opencode/client/effect/service"
import { Session } from "@opencode/schema/session"
import { Effect, Option, Schema } from "effect"
import path from "node:path"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { EOL } from "node:os"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { errorMessage } from "../../util/error"

/** Directories with exports are walked recursively, but never into these. */
const SKIP_DIRECTORIES = new Set(["node_modules", ".git", ".hg", ".svn"])
const MAX_FILES = 500

const SessionExport = Schema.Record(Schema.String, Schema.Json)

type Candidate = { readonly label: string; readonly read: () => Promise<string> }

const walkJsonFiles = (directory: string, found: string[] = []): string[] => {
  if (found.length >= MAX_FILES) return found
  let entries: string[]
  try {
    entries = readdirSync(directory)
  } catch {
    return found
  }
  for (const entry of entries) {
    if (found.length >= MAX_FILES) break
    if (SKIP_DIRECTORIES.has(entry)) continue
    const full = path.join(directory, entry)
    try {
      const stat = statSync(full)
      if (stat.isDirectory()) {
        walkJsonFiles(full, found)
        continue
      }
      if (stat.isFile() && entry.toLowerCase().endsWith(".json")) found.push(full)
    } catch {
      // Unreadable entries are reported as failed imports only when they parse as exports.
    }
  }
  return found
}

/** Windows tools write UTF-8 BOMs and UTF-16 files; exports shared this way would otherwise never parse. */
const readTextFile = (file: string): string => {
  const buffer = readFileSync(file)
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString("utf16le")
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    const payload = buffer.subarray(2)
    const swapped = Buffer.allocUnsafe(payload.length)
    for (let index = 0; index + 1 < payload.length; index += 2) {
      swapped[index] = payload[index + 1]!
      swapped[index + 1] = payload[index]!
    }
    return swapped.toString("utf16le")
  }
  const text = buffer.toString("utf8")
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

const candidatesFor = (source: string): Candidate[] => {
  if (/^https?:\/\//.test(source)) {
    return [
      { label: source, read: () => fetch(source).then((response) => {
          if (!response.ok) throw new Error(`HTTP ${String(response.status)} ${response.statusText}`)
          return response.text()
        }) },
    ]
  }
  const absolute = path.resolve(source)
  let stat
  try {
    stat = statSync(absolute)
  } catch {
    return [{ label: source, read: () => Promise.reject(new Error("path does not exist")) }]
  }
  if (stat.isDirectory()) {
    return walkJsonFiles(absolute).map((file) => ({
      label: file,
      read: () => Promise.resolve(readTextFile(file)),
    }))
  }
  return [{ label: absolute, read: () => Promise.resolve(readTextFile(absolute)) }]
}

export default Runtime.handler(
  Commands.commands["import-sessions"],
  Effect.fn("cli.import-sessions")(function* (input) {
    const sources = input.sources
    const candidates = sources.flatMap(candidatesFor)
    if (candidates.length === 0) {
      yield* Effect.fail(new Error("No JSON files found under the given source(s)."))
    }

    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
    })
    const location = yield* Effect.promise(() =>
      client.location.get({
        location: { directory: path.resolve(Option.getOrElse(input.directory, () => process.cwd())) },
      }),
    )

    let imported = 0
    let skipped = 0
    const failures: string[] = []

    for (const candidate of candidates) {
      const text = yield* Effect.tryPromise({
        try: candidate.read,
        catch: (cause) => cause,
      }).pipe(Effect.catch((cause) => Effect.sync(() => {
        failures.push(`${candidate.label}: ${errorMessage(cause)}`)
        return undefined
      })))
      if (text === undefined) continue

      // The server validates the transcript itself; this only checks the envelope is an export object.
      const decoded = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(SessionExport))(text).pipe(
        Effect.catch(() => Effect.sync(() => undefined)),
      )
      if (
        decoded === undefined ||
        typeof decoded !== "object" ||
        decoded === null ||
        !("info" in decoded) ||
        !("messages" in decoded) ||
        !Array.isArray(decoded.messages)
      ) {
        skipped += 1
        continue
      }
      const info = decoded.info as { id?: unknown }
      if (typeof info?.id !== "string" || !info.id.startsWith("ses_")) {
        skipped += 1
        continue
      }

      const response = yield* Effect.tryPromise({
        try: () =>
          fetch(new URL("/api/experimental/session/import", server.endpoint.url), {
            method: "POST",
            headers: { ...Service.headers(server.endpoint), "content-type": "application/json" },
            body: JSON.stringify({ ...decoded, location: { directory: location.directory } }),
          }),
        catch: (cause) => new Error(`${candidate.label}: ${errorMessage(cause)}`),
      }).pipe(Effect.catch((error) => Effect.sync(() => {
        failures.push(error.message)
        return undefined
      })))
      if (response === undefined) continue
      if (response.status === 409) {
        // Already imported; idempotent re-runs should not fail.
        skipped += 1
        continue
      }
      if (!response.ok) {
        failures.push(`${candidate.label}: HTTP ${String(response.status)} ${response.statusText}`)
        continue
      }
      const json = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Struct({ data: Session.Info })))(
        yield* Effect.promise(() => response.text()),
      ).pipe(Effect.catch(() => Effect.sync(() => undefined)))
      imported += 1
      process.stdout.write(`Imported ${json?.data.title ? `"${json.data.title}" ` : ""}(${json?.data.id ?? "unknown id"})${EOL}`)
    }

    process.stdout.write(
      `${EOL}${String(imported)} imported · ${String(skipped)} skipped · ${String(failures.length)} failed${EOL}`,
    )
    for (const failure of failures) process.stderr.write(`  ${failure}${EOL}`)
    if (failures.length > 0) process.exitCode = 1
  }),
)
