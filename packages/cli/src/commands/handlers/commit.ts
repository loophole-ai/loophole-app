import { confirm, intro } from "@clack/prompts"
import { OpenCode } from "@opencode/client"
import { Service } from "@opencode/client/effect/service"
import { Model } from "@opencode/schema/model"
import { Effect, Option } from "effect"
import { EOL } from "node:os"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { waitForPlugins } from "../../services/plugin-startup"
import { handlePromptErrors, prompt, requireInteractive } from "../../ui/prompt"
import { errorMessage } from "../../util/error"

/** Model output can exceed what fits in a single screen; keep the staged diff prompt bounded. */
const DIFF_LIMIT = 16_000

const MESSAGE_PROMPT = (input: { stat: string; diff: string; full: boolean }) =>
  [
    "Write a git commit message for the staged changes below.",
    "Use the conventional commits format: `type(scope): subject` on the first line,",
    "an optional blank line, then an optional body explaining the why, not the what.",
    "Output only the commit message, with no code fences, no quotes, and no commentary.",
    "",
    "### git diff --cached --stat",
    input.stat.trim() || "(empty)",
    "",
    input.full ? "### git diff --cached" : "### git diff --cached (truncated; too large to include fully)",
    input.diff.trim(),
  ].join("\n")

/** Strip code fences and a leading "Commit message:" label the model may add despite instructions. */
const cleanMessage = (text: string) =>
  text
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/i, "")
    .replace(/^(commit message|message|subject)\s*:\s*/i, "")
    .trim()

const git = (args: string[], cwd: string) => {
  try {
    const result = Bun.spawnSync(["git", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
    return {
      code: result.exitCode,
      stdout: result.stdout.toString(),
      stderr: result.stderr.toString(),
    }
  } catch {
    return { code: -1, stdout: "", stderr: "git is not available on this system" }
  }
}

export default Runtime.handler(
  Commands.commands.commit,
  Effect.fn("cli.commit")((input) =>
    Effect.gen(function* () {
      const cwd = process.cwd()
      const inside = git(["rev-parse", "--is-inside-work-tree"], cwd)
      if (inside.code !== 0 || inside.stdout.trim() !== "true") {
        yield* Effect.fail(new Error("Not a git repository. Run this from a repository root."))
      }

      const staged = git(["diff", "--cached", "--name-only"], cwd)
      if (staged.code !== 0) {
        yield* Effect.fail(new Error(`Failed to read staged changes: ${staged.stderr.trim()}`))
      }
      const files = staged.stdout.split(/\r?\n/).filter(Boolean)
      if (files.length === 0) {
        yield* Effect.fail(new Error("Nothing staged. Stage changes with `git add` first."))
      }
      // --model wins over the server default; parsing failures should name the flag, not a schema dump.
      const modelArg = Option.getOrUndefined(input.model)
      const model = yield* Effect.try({
        try: () => (modelArg === undefined ? undefined : Model.Ref.parse(modelArg)),
        catch: () => new Error("--model must use the format provider/model, e.g. anthropic/claude-sonnet-4-5"),
      })

      const stat = git(["diff", "--cached", "--stat"], cwd).stdout
      const diffRaw = git(["diff", "--cached"], cwd).stdout
      const truncated = diffRaw.length > DIFF_LIMIT
      const diff = truncated ? diffRaw.slice(0, DIFF_LIMIT) : diffRaw
      const message = Option.getOrUndefined(input.message)

      const generated =
        message !== undefined
          ? message
          : yield* Effect.gen(function* () {
              const server = yield* ServerConnection.resolve()
              const client = OpenCode.make({
                baseUrl: server.endpoint.url,
                headers: Service.headers(server.endpoint),
              })
              // A cold Location activates plugins lazily; a one-shot generation races that activation otherwise.
              yield* waitForPlugins(client, cwd)
              const result = yield* Effect.tryPromise({
                try: () =>
                  client.experimental.generate.text({
                    prompt: MESSAGE_PROMPT({ stat, diff, full: !truncated }),
                    ...(model !== undefined ? { model } : {}),
                  }),
                catch: (cause) =>
                  new Error(
                    `Could not generate a commit message: ${errorMessage(cause)}. Pass --message to commit with your own.`,
                  ),
              })
              return cleanMessage(result.text)
            })

      if (!generated.trim()) {
        yield* Effect.fail(new Error("The generated commit message was empty. Pass --message to commit with your own."))
      }

      process.stdout.write(`Staged ${String(files.length)} file(s):\n${files.map((file) => `  ${file}`).join("\n")}${EOL}${EOL}`)

      if (input.dryRun) {
        process.stdout.write(`${generated}${EOL}`)
        return
      }

      if (!input.yes) {
        yield* requireInteractive("Pass --yes to commit without an interactive terminal.")
        intro("Commit", { output: process.stderr })
        const accepted = yield* prompt(() =>
          confirm({ message: `Commit with this message?\n\n${generated}\n`, initialValue: true, output: process.stderr }),
        )
        if (!accepted) {
          return
        }
      }

      const committed = git(["commit", "-m", generated], cwd)
      if (committed.stdout) process.stdout.write(committed.stdout)
      if (committed.stderr) process.stderr.write(committed.stderr)
      if (committed.code !== 0) {
        yield* Effect.fail(new Error("git commit failed."))
      }
    }).pipe(handlePromptErrors),
  ),
)
