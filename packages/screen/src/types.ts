/** Minimal tool-call data shapes the transcript components render. */

export interface ToolCallBlockData {
  readonly id: string;
  readonly name: string;
  readonly args: Record<string, unknown>;
}

export interface ToolResultBlockData {
  readonly output: string;
  readonly is_error?: boolean;
}
