import { LayerNode } from "@opencode/util/effect/layer-node"
import { Global } from "@opencode/util/global"
import { run } from "@opencode/tui"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Config } from "../../config"
import { Context, Effect, FileSystem, Option, Queue, Schedule, Semaphore } from "effect"
import { ServerConnection } from "../../services/server-connection"
import { Updater } from "../../services/updater"
import { UpdatePreflight } from "../../services/update-preflight"
import { Npm } from "@opencode/util/npm"
import { OPENCODE_ARTIFACT, OPENCODE_CHANNEL, OPENCODE_HIGHLIGHTS, OPENCODE_VERSION } from "../../version"
import { Env } from "../../env"
import { uiMode } from "../../run/ui-mode"
import { Service } from "@opencode/client/effect/service"
import { OpenCode } from "@opencode/client/promise"
import { findSession } from "../../session-target"
import { errorMessage } from "../../util/error"
import { resolve } from "@opencode/tui/config"

export default Runtime.handler(Commands, (input) =>
  Effect.gen(function* () {
    const requestedDirectory = Option.getOrUndefined(input.directory)
    const requestedServer = Option.getOrUndefined(input.server)
    if (requestedDirectory !== undefined) process.chdir(requestedDirectory)
    if (input.sandbox) process.env.OPENCODE_SANDBOX = "1"
    const preflight = UpdatePreflight.make()
    yield* Effect.addFinalizer(() => Effect.promise(() => preflight.close()))
    const serviceStarts = yield* Queue.unbounded<{
      readonly reason: "missing" | "version-mismatch"
      readonly previousVersion?: string
    }>()
    yield* Queue.take(serviceStarts).pipe(
      Effect.flatMap((event) => Effect.logInfo("background service starting", event)),
      Effect.forever,
      Effect.forkScoped,
    )
    const server = yield* ServerConnection.resolve({
      server: requestedServer,
      standalone: input.standalone,
      mismatch: "replace",
      onStart: (reason, previousVersion) => {
        Queue.offerUnsafe(serviceStarts, { reason, previousVersion })
        if (reason === "version-mismatch" && preflight.begin(previousVersion)) return
        process.stderr.write(
          reason === "version-mismatch"
            ? "Preparing server (version mismatch)...\n"
            : "Preparing server...\n",
        )
      },
    }).pipe(
      Effect.tapError(() =>
        Effect.promise(() => preflight.fail("Loophole update could not start the new background service")),
      ),
    )
    const drive = process.env.OPENCODE_DRIVE !== undefined
    // The Loophole screen is the default whenever a real terminal is attached. Piped stdin/stdout and
    // LOOPHOLE_TUI=mini keep the old plain interface, which also handles stdin-fed prompts and replay.
    // LOOPHOLE_TUI=basic opens the basic pi-tui chat instead (see run/ui-mode.ts).
    const usePi =
      !drive &&
      process.stdin.isTTY === true &&
      process.stdout.isTTY === true &&
      uiMode() !== "mini"
    if (input.print) {
      const { mergeInput, runNonInteractive } = yield* Effect.promise(() => import("../../run/run"))
      const { readStdin, readStdinIfReady } = yield* Effect.promise(() => import("../../util/io"))
      const argument = Option.getOrUndefined(input.prompt)
      const piped = yield* Effect.promise(() =>
        process.stdin.isTTY ? Promise.resolve(undefined) : argument ? readStdinIfReady(1000) : readStdin(),
      )
      const message = mergeInput(argument, piped)
      if (!message?.trim()) {
        process.stderr.write("\x1b[91m\x1b[1mError: \x1b[0mYou must provide a message (--prompt or stdin)\n")
        process.exit(1)
      }
      yield* Effect.callback<void>((resume) => {
        const controller = new AbortController()
        const done = runNonInteractive(
          {
            server,
            message: [message],
            continue: input.continue,
            session: Option.getOrUndefined(input.session),
            fork: input.fork,
            model: Option.getOrUndefined(input.model),
            agent: Option.getOrUndefined(input.agent),
            format: "default",
            file: [],
            thinking: false,
            auto: input.auto || input.yolo || input.dangerouslySkipPermissions,
            print: true,
            permissionMode: Option.getOrUndefined(input.permissionMode) as any,
          },
          controller.signal,
        ).then(() => resume(Effect.void))
        return Effect.promise(() => {
          controller.abort()
          return done
        })
      })
      return
    }

    // The plain interface cannot auto-accept permissions yet; the pi-tui screen and the full TUI
    // (Drive mode) still honor the flags.
    if (!drive && !usePi && (input.auto || input.yolo || input.dangerouslySkipPermissions)) {
      process.stderr.write("\x1b[91m\x1b[1mError: \x1b[0m--auto is not supported by this interface yet\n")
      process.exit(1)
    }
    if (drive) {
      // Drive mode speaks through the full TUI. Keeping this branch reachable
      // also keeps the simulation bridge in the CLI artifact, which the build
      // graph check (packages/cli/script/verify-artifact.ts) requires.
      const session = Option.getOrUndefined(input.session)
      // A missing --session ID becomes the ID of the session the first prompt creates.
      const sessionExists =
        session !== undefined &&
        (yield* Effect.tryPromise({
          try: () =>
            findSession(
              OpenCode.make({ baseUrl: server.endpoint.url, headers: Service.headers(server.endpoint) }),
              session,
            ),
          catch: (cause) => new Error(errorMessage(cause)),
        })) !== undefined
      const updater = yield* Updater.Service
      let installing: string | undefined
      let latest: Updater.RunResult | undefined
      const installListeners = new Set<(version: string) => void>()
      const resultListeners = new Set<(result: Updater.RunResult) => void>()
      // Background checks, `/update` lookups, and manual installs take turns so two installs never overlap.
      const checking = yield* Semaphore.make(1)
      yield* updater
        .run((version) => {
          installing = version
          installListeners.forEach((notify) => notify(version))
        })
        .pipe(
          Effect.ensuring(Effect.sync(() => (installing = undefined))),
          Effect.tap((result) =>
            Effect.sync(() => {
              if (!result || (result.type === latest?.type && result.version === latest.version)) return
              latest = result
              resultListeners.forEach((notify) => notify(result))
            }),
          ),
          checking.withPermits(1),
          Effect.repeat(Schedule.spaced("10 minutes")),
          Effect.forkScoped({ startImmediately: true }),
        )
      preflight.loading()
      const config = yield* Config.Service
      const npm = yield* Npm.Service
      const fileSystem = yield* FileSystem.FileSystem
      const runServicePromise = Effect.runPromiseWith(Context.make(FileSystem.FileSystem, fileSystem))
      const context = yield* Effect.context<FileSystem.FileSystem>()
      const runFork = Effect.runForkWith(context)
      const runPromise = Effect.runPromiseWith(context)
      const service = server.service
      yield* run({
        app: {
          name: process.env.OPENCODE_CLIENT ?? OPENCODE_ARTIFACT,
          version: OPENCODE_VERSION,
          channel: process.env.OPENCODE_TUI_CHANNEL ?? OPENCODE_CHANNEL,
          highlights: OPENCODE_HIGHLIGHTS,
        },
        server: {
          endpoint: server.endpoint,
          // Managed and standalone servers run here; an explicit --server may be on another machine.
          local: requestedServer === undefined,
          service: service
            ? {
                reconnect: (signal) => runServicePromise(service.reconnect(), { signal }),
                restart: () => runServicePromise(service.restart()),
              }
            : undefined,
        },
        args: {
          continue: input.continue,
          sessionID: sessionExists ? session : undefined,
          newSessionID: sessionExists ? undefined : session,
          prompt: Option.getOrUndefined(input.prompt),
          auto: input.auto || input.yolo || input.dangerouslySkipPermissions,
        },
        config: {
          path: config.path,
          get: () => runPromise(config.get()),
          update: (update) => runPromise(config.update(update)),
        },
        updater: {
          remote: requestedServer !== undefined,
          subscribe: (notify) => {
            if (latest) notify(latest)
            resultListeners.add(notify)
            return () => resultListeners.delete(notify)
          },
          check: (signal, notify) => {
            if (installing) notify(installing)
            installListeners.add(notify)
            return runPromise(checking.withPermits(1)(updater.check()), { signal }).finally(() =>
              installListeners.delete(notify),
            )
          },
          apply: (version) => runPromise(checking.withPermits(1)(updater.apply(version))),
        },
        packages: {
          prepare: (spec, install = true) => runPromise(install ? npm.add(spec) : npm.resolve(spec)),
        },
        environment: requestedServer === undefined ? Env.session() : undefined,
        terminalHandoff: () => preflight.finish(),
        log: (level, message, tags) => {
          const effect =
            level === "debug"
              ? Effect.logDebug(message, tags)
              : level === "warn"
                ? Effect.logWarning(message, tags)
                : level === "error"
                  ? Effect.logError(message, tags)
                  : Effect.logInfo(message, tags)
          runFork(effect)
        },
      }).pipe(Effect.provide(LayerNode.compile(Global.node)))
      return
    }
    if (usePi) {
      // Loaded lazily so the pi-tui engine is only evaluated when it is actually used.
      const { runInteractive } = yield* Effect.promise(() => import("../../run/interactive"))
      // The pi-tui screen owns the terminal from here, so settle the update footer first.
      yield* Effect.promise(() => preflight.finish())
      yield* Effect.promise(() =>
        runInteractive({
          server,
          message: [Option.getOrUndefined(input.prompt)].filter((text): text is string => text !== undefined),
          continue: input.continue,
          session: Option.getOrUndefined(input.session),
          fork: input.fork,
          model: Option.getOrUndefined(input.model),
          agent: Option.getOrUndefined(input.agent),
          format: "default",
          file: [],
          auto: input.auto || input.yolo || input.dangerouslySkipPermissions,
          permissionMode: Option.getOrUndefined(input.permissionMode) as any,
        }),
      )
      return
    }
    const { runMini, validateMiniTerminal } = yield* Effect.promise(() => import("../../mini"))
    yield* Effect.promise(async () => validateMiniTerminal())
    preflight.loading()
    const config = yield* Config.Service
    const global = yield* Global.Service
    const resolved = resolve(yield* config.get(), { terminalSuspend: process.platform !== "win32" })
    const fileSystem = yield* FileSystem.FileSystem
    const runServicePromise = Effect.runPromiseWith(Context.make(FileSystem.FileSystem, fileSystem))
    const service = server.service
    // The plain interface cannot take the terminal over mid-update, so the
    // preflight footer is settled and cleared before it starts.
    yield* Effect.promise(() => preflight.finish())
    yield* Effect.promise(() =>
      runMini({
        server: {
          endpoint: server.endpoint,
          reconnect: service ? (signal) => runServicePromise(service.reconnect(), { signal }) : undefined,
        },
        continue: input.continue,
        session: Option.getOrUndefined(input.session),
        fork: input.fork,
        model: Option.getOrUndefined(input.model),
        agent: Option.getOrUndefined(input.agent),
        prompt: Option.getOrUndefined(input.prompt),
        replay: Option.getOrUndefined(input.replay) ?? resolved.mini?.replay ?? true,
        replayLimit: Option.getOrUndefined(input.replayLimit) ?? resolved.mini?.replay_limit,
        tuiConfig: resolved,
        config: {
          update: (update) => runServicePromise(config.update(update)),
        },
        paths: { home: global.home, state: global.state, log: global.log },
      }),
    )
  }),
)
