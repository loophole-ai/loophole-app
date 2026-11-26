import { Effect, Option } from "effect"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { uiMode } from "../../run/ui-mode"

export default Runtime.handler(Commands.commands.run, (input) =>
  Effect.gen(function* () {
    const { reportRunError, runNonInteractive } = yield* Effect.promise(() => import("../../run/run"))
    if (input.sandbox) process.env.OPENCODE_SANDBOX = "1"
    // A one-off run uses the background service when it is already up, but never leaves a new one running.
    const server = yield* ServerConnection.resolve({ autostart: false }).pipe(
      Effect.tapError((error) => Effect.logError("run could not resolve its server", { cause: error })),
      Effect.catch((error) => Effect.sync(() => reportRunError(input, error.message))),
    )
    if (!server) return

    // Use the Loophole screen for plain terminal runs. Attached files still go through the
    // non-interactive path, because the interactive UI cannot attach them yet, and so does
    // LOOPHOLE_TUI=mini (see run/ui-mode.ts). --print/-p forces headless output.
    const useInteractive =
      !input.print &&
      input.format === "default" &&
      process.stdin.isTTY === true &&
      process.stdout.isTTY === true &&
      input.file.length === 0 &&
      input.worktree === undefined &&
      input.archived === undefined &&
      uiMode() !== "mini"

    if (useInteractive) {
      // Loaded lazily so non-interactive runs never evaluate the pi-tui engine.
      const { runInteractive } = yield* Effect.promise(() => import("../../run/interactive"))
      yield* Effect.promise(() =>
        runInteractive({
          server,
          message: [...input.message],
          continue: input.continue,
          session: Option.getOrUndefined(input.session),
          fork: input.fork,
          model: Option.getOrUndefined(input.model),
          agent: Option.getOrUndefined(input.agent),
          format: input.format,
          file: [],
          title: Option.getOrUndefined(input.title),
          thinking: input.thinking,
          auto: input.auto || input.yolo || input.dangerouslySkipPermissions,
          permissionMode: Option.getOrUndefined(input.permissionMode) as any,
          sandbox: input.sandbox,
        }),
      )
      return
    }

    // SIGINT and SIGTERM interrupt this fiber. Interruption waits for the run to cancel its Session and
    // jobs, so the private server and the process shut down only after that.
    yield* Effect.callback<void>((resume) => {
      const controller = new AbortController()
      const done = runNonInteractive(
        {
          server,
          message: [...input.message],
          continue: input.continue,
          session: Option.getOrUndefined(input.session),
          fork: input.fork,
          worktree: Option.getOrUndefined(input.worktree),
          model: Option.getOrUndefined(input.model),
          agent: Option.getOrUndefined(input.agent),
          format: input.format,
          file: [...input.file],
          title: Option.getOrUndefined(input.title),
          archived: input.archived,
          thinking: input.thinking,
          auto: input.auto || input.yolo || input.dangerouslySkipPermissions,
          print: input.print,
          permissionMode: Option.getOrUndefined(input.permissionMode) as any,
          sandbox: input.sandbox,
        },
        controller.signal,
      ).then(() => resume(Effect.void))
      return Effect.promise(() => {
        controller.abort()
        return done
      })
    })
  }),
)
