import { Logo } from "@opencode/ui/logo"
import "./wordmark.css"

export function NewSessionWordmark() {
  return (
    <div
      data-component="new-session-wordmark"
      aria-hidden="true"
      class="pointer-events-none mx-auto w-full max-w-[720px] text-v2-background-bg-inverse"
    >
      <div data-slot="wordmark-reveal" class="relative mx-auto w-5/12">
        <Logo class="block aspect-[2170/725] w-full opacity-[0.16]" />
        <Logo class="wordmark-shimmer absolute inset-0 aspect-[2170/725] w-full" />
      </div>
    </div>
  )
}
