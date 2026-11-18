import { autocomplete, cancel, intro, isCancel, log, outro } from "@clack/prompts"
import { OpenCode } from "@opencode/client"
import { Service } from "@opencode/client/effect/service"
import { Effect, Option } from "effect"
import { EOL } from "node:os"
import path from "node:path"
import { writeFileSync } from "node:fs"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { errorMessage } from "../../util/error"
import { OPENCODE_VERSION } from "../../version"
import type { SessionTransferData } from "@opencode/client/promise"

/** CRC-32 (IEEE) table, built once on first use. */
const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c >>> 0
  }
  return table
})()

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const dosDateTime = (date: Date) => {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const day = (((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()) & 0xffff
  return { time: time & 0xffff, day }
}

type ZipEntry = { readonly name: string; readonly data: Buffer }

/**
 * Write an uncompressed (stored) ZIP. Deflate is intentionally not used: the payload is text
 * that the user may want to inspect in any tool, and stored entries keep this dependency-free.
 */
const buildZip = (entries: ReadonlyArray<ZipEntry>, now = new Date()): Buffer => {
  const { time, day } = dosDateTime(now)
  const chunks: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8")
    const crc = crc32(entry.data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // version needed
    local.writeUInt16LE(0, 6) // flags
    local.writeUInt16LE(0, 8) // method: stored
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(day, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(entry.data.length, 18)
    local.writeUInt32LE(entry.data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28) // extra length
    chunks.push(local, name, entry.data)

    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(20, 4) // version made by
    header.writeUInt16LE(20, 6) // version needed
    header.writeUInt16LE(0, 8) // flags
    header.writeUInt16LE(0, 10) // method: stored
    header.writeUInt16LE(time, 12)
    header.writeUInt16LE(day, 14)
    header.writeUInt32LE(crc, 16)
    header.writeUInt32LE(entry.data.length, 20)
    header.writeUInt32LE(entry.data.length, 24)
    header.writeUInt16LE(name.length, 28)
    header.writeUInt16LE(0, 30) // extra length
    header.writeUInt16LE(0, 32) // comment length
    header.writeUInt16LE(0, 34) // disk number
    header.writeUInt16LE(0, 36) // internal attrs
    header.writeUInt32LE(0, 38) // external attrs
    header.writeUInt32LE(offset, 42)
    central.push(Buffer.concat([header, name]))

    offset += local.length + name.length + entry.data.length
  }

  const centralDirectory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(0, 4) // disk number
  end.writeUInt16LE(0, 6) // disk with central directory
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralDirectory.length, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20) // comment length
  return Buffer.concat([...chunks, centralDirectory, end])
}

const transcriptMarkdown = (data: SessionTransferData, sessionID: string) => {
  const lines: string[] = [`# ${data.info.title ?? sessionID}`, ""]
  for (const message of data.messages) {
    if (message.type === "user") {
      lines.push("## User", "", message.text.trim(), "")
      continue
    }
    if (message.type === "assistant") {
      const text = message.content
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("\n")
        .trim()
      if (text) lines.push("## Assistant", "", text, "")
    }
  }
  return lines.join("\n")
}

const diagnosticsMarkdown = (input: {
  readonly version: string
  readonly platform: string
  readonly arch: string
  readonly exportedAt: string
  readonly sessionID: string
  readonly title: string | undefined
  readonly messageCount: number
  readonly sanitize: boolean
  readonly source?: string | undefined
}) =>
  [
    "# Loophole session export diagnostics",
    "",
    `- loophole: ${input.version}`,
    `- platform: ${input.platform} (${input.arch})`,
    `- exported at: ${input.exportedAt}`,
    `- session id: ${input.sessionID}`,
    `- title: ${input.title ?? "(untitled)"}`,
    `- messages: ${String(input.messageCount)}`,
    `- sanitized: ${input.sanitize ? "yes" : "no"}`,
    input.source ? `- source: ${input.source}` : undefined,
    "",
    "Contents: `transcript.md` (human-readable), `session.json` (machine-readable export), this file.",
    "",
  ].filter((line) => line !== undefined).join("\n")

export default Runtime.handler(
  Commands.commands["export-zip"],
  Effect.fn("cli.export-zip")((input) =>
    Effect.gen(function* () {
      const requested = Option.getOrUndefined(input.session)
      if (!requested && !process.stdin.isTTY) {
        yield* Effect.fail(new Error("Pass --session <id> when running without an interactive terminal"))
      }
      const server = yield* ServerConnection.resolve()
      const client = OpenCode.make({
        baseUrl: server.endpoint.url,
        headers: Service.headers(server.endpoint),
      })
      const sessionID = requested
        ? requested
        : yield* Effect.gen(function* () {
            intro("Export session", { output: process.stderr })
            const location = yield* Effect.tryPromise({
              try: () => client.location.get({ location: { directory: process.cwd() } }),
              catch: (cause) => cause,
            })
            const page = yield* Effect.tryPromise({
              try: () =>
                client.session.list({
                  directory: location.directory,
                  parentID: null,
                  order: "desc",
                  limit: 50,
                }),
              catch: (cause) => cause,
            })
            if (page.data.length === 0) {
              log.error("No sessions found", { output: process.stderr })
              outro("Done", { output: process.stderr })
              return undefined
            }
            const selected = yield* Effect.tryPromise({
              try: () =>
                autocomplete({
                  message: "Select session to export",
                  maxItems: 10,
                  options: page.data.map((session) => ({
                    label: session.title,
                    value: session.id,
                    hint: `${new Date(session.time.updated).toLocaleString()} - ${session.id.slice(-8)}`,
                  })),
                  output: process.stderr,
                }),
              catch: (cause) => cause,
            })
            if (isCancel(selected)) {
              cancel("Cancelled", { output: process.stderr })
              process.exitCode = 130
              return undefined
            }
            outro("Exporting session...", { output: process.stderr })
            return selected
          })
      if (!sessionID) return

      const exportedAt = new Date().toISOString()
      const data = yield* Effect.tryPromise({
        try: () => client.experimental.session.export({ sessionID, sanitize: input.sanitize }),
        catch: (cause) => new Error(`Could not export session ${sessionID}: ${errorMessage(cause)}`),
      })

      const zip = buildZip([
        { name: "transcript.md", data: Buffer.from(transcriptMarkdown(data, sessionID), "utf8") },
        { name: "session.json", data: Buffer.from(JSON.stringify(data, null, 2) + EOL, "utf8") },
        {
          name: "diagnostics.md",
          data: Buffer.from(
            diagnosticsMarkdown({
              version: OPENCODE_VERSION,
              platform: process.platform,
              arch: process.arch,
              exportedAt,
              sessionID,
              title: data.info.title,
              messageCount: data.messages.length,
              sanitize: input.sanitize,
              source: server.endpoint.url,
            }),
            "utf8",
          ),
        },
      ])

      const output = Option.getOrElse(input.output, () => path.join(process.cwd(), `loophole-${sessionID}.zip`))
      try {
        writeFileSync(output, zip)
      } catch (error) {
        yield* Effect.fail(new Error(`Could not write ${output}: ${errorMessage(error)}`))
      }
      process.stdout.write(`Exported session to ${output}${EOL}`)
    }).pipe(
      Effect.catch((error) =>
        Effect.sync(() => {
          process.stderr.write(errorMessage(error) + EOL)
          process.exitCode = 1
        }),
      ),
    ),
  ),
)
