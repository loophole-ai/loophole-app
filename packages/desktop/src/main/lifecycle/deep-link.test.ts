import { describe, expect, test } from "bun:test"
import { consoleReturnWindow } from "./deep-link"

describe("Console return deep links", () => {
  test("reads the originating Desktop window", () => {
    expect(consoleReturnWindow("loophole://console/authorized?window=window-a")).toBe("window-a")
    expect(consoleReturnWindow("loophole://console/authorized?window=window%20b")).toBe("window b")
  })

  test("rejects unrelated and malformed links", () => {
    expect(consoleReturnWindow("loophole://console/other?window=window-a")).toBeUndefined()
    expect(consoleReturnWindow("loophole://other/authorized?window=window-a")).toBeUndefined()
    expect(consoleReturnWindow("https://console/authorized?window=window-a")).toBeUndefined()
    expect(consoleReturnWindow("not a url")).toBeUndefined()
    expect(consoleReturnWindow("loophole://console/authorized")).toBeUndefined()
  })
})
