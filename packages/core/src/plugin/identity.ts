export * as IdentityPlugin from "./identity.js"

import { SystemPart } from "@opencode/ai/effect"
import { define } from "@opencode/plugin/effect/plugin"
import type { SessionHooks } from "@opencode/plugin/effect/session"
import { Model } from "@opencode/schema/model"
import { Effect } from "effect"
import { OptimizePlugin } from "./optimize.js"

export function identity(model: { readonly name: string; readonly ref: Model.Ref }) {
  return [
    "# Your Identity",
    "You are Loophole, an AI agent built by Loophole AI.",
    "When the user asks who you are or which model you are, answer that you are Loophole, an AI agent built by Loophole AI. Never identify yourself as the underlying model or provider; the runtime details below are for your own reference only.",
    "",
    "# Runtime",
    `- Model: ${model.name}`,
    `- Provider ID: ${model.ref.providerID}`,
    `- Model ID: ${model.ref.id}`,
  ].join("\n")
}

export const Plugin = define({
  id: "opencode.prompt.identity",
  effect: Effect.fn("IdentityPlugin")(function* (ctx) {
    const hook = (event: SessionHooks["context"]) =>
      Effect.gen(function* () {
        const model = yield* OptimizePlugin.resolveModel(ctx, event)
        event.system.splice(1, 0, SystemPart.make(identity({ name: model.name, ref: event.model })))
      }).pipe(Effect.catch(() => Effect.void))
    yield* ctx.session.hook("context", hook)
    yield* ctx.session.hook("compaction", hook)
    yield* ctx.session.hook("generate", hook)
  }),
})
