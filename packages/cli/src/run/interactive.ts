/**
 * Interactive mode using the Loophole screen (or the basic pi-tui chat with LOOPHOLE_TUI=basic).
 *
 * Used by `loophole-cli` and by `loophole-cli run` when stdout is a terminal. Connects exactly like
 * runNonInteractive (endpoint from input.server, same client headers) and honors
 * --continue/--session/--fork/--model/--agent through resolveSessionTarget.
 */

import { Service } from "@opencode/client/effect/service"
import { OpenCode } from "@opencode/client/promise"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { Env } from "../env"
import { resolveSessionTarget } from "../session-target"
import { createTuiAdapter } from "../tui-adapter"
import { uiMode } from "./ui-mode"
import { parseRunModel, reportRunError, type RunCommandInput } from "./run"

export async function runInteractive(input: RunCommandInput) {
  const endpoint = input.server.endpoint
  const client = OpenCode.make({
    baseUrl: endpoint.url,
    headers: Service.headers(endpoint),
    // Bun's default five-minute deadline terminates the long-lived event stream.
    fetch: noTimeoutFetch,
  })
  const explicit = parseRunModel(input.model)
  const directory = process.env.PWD ?? process.cwd()

  const target = await resolveSessionTarget({
    client,
    location: { directory },
    continue: input.continue,
    session: input.session,
    fork: input.fork,
    model: explicit ? { providerID: explicit.model.providerID, id: explicit.model.modelID, variant: explicit.variant } : undefined,
    agent: input.agent,
    environment: input.server.service ? Env.session() : undefined,
    prepare: async (next) => ({ model: next.model, agent: next.agent }),
  }).catch((error) => {
    reportRunError(input, error instanceof Error ? error.message : String(error))
    return undefined
  })
  if (!target) return

  // Resumed sessions keep their own model/agent unless the flags override them (same as runNonInteractive).
  if (input.agent) await client.session.switchAgent({ sessionID: target.session.id, agent: input.agent })
  if (explicit && target.model) await client.session.switchModel({ sessionID: target.session.id, model: target.model })

  const message = input.message.join(" ").trim()
  // The Loophole screen is the default; LOOPHOLE_TUI=basic opens the basic pi chat instead.
  if (uiMode() !== "basic") {
    const { ScreenController } = await import("../screen/controller")
    const controller = new ScreenController({
      client,
      endpoint,
      directory: target.location.directory,
      sessionID: target.session.id,
      auto: input.auto ?? false,
      permissionMode: input.permissionMode,
      initialMessage: message || undefined,
      // Only an explicit `--model` overrides the model remembered from last launch.
      model: explicit ? target.model : undefined,
    })
    await controller.start()
    // The controller owns the terminal; keep the process alive until it calls process.exit().
    await new Promise<void>(() => {})
    return
  }
  const adapter = await createTuiAdapter({
    client,
    endpoint,
    directory: target.location.directory,
    sessionID: target.session.id,
    auto: input.auto ?? false,
    initialMessage: message || undefined,
  })
  await adapter.start()

  // The adapter owns the terminal; keep the process alive until it calls process.exit().
  await new Promise<void>(() => {})
}
