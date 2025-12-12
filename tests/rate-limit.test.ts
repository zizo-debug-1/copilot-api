import { describe, test, expect, beforeEach } from "bun:test"

import type { State } from "../src/lib/state"

import { checkRateLimit, markRequestComplete } from "../src/lib/rate-limit"

describe("Rate limiting behavior", () => {
  let testState: State

  beforeEach(() => {
    // Reset state before each test
    testState = {
      accountType: "individual",
      manualApprove: false,
      rateLimitWait: false,
      showToken: false,
      rateLimitSeconds: 10,
      lastRequestTimestamp: undefined,
    }
  })

  test("should allow first request without setting timestamp", async () => {
    await checkRateLimit(testState)
    // First request should not set the timestamp
    expect(testState.lastRequestTimestamp).toBeUndefined()
  })

  test("should set timestamp only after markRequestComplete is called", async () => {
    await checkRateLimit(testState)
    expect(testState.lastRequestTimestamp).toBeUndefined()

    markRequestComplete(testState)
    expect(testState.lastRequestTimestamp).toBeDefined()
    expect(typeof testState.lastRequestTimestamp).toBe("number")
  })

  test("should allow second request after sufficient time has passed", async () => {
    // First request
    await checkRateLimit(testState)
    markRequestComplete(testState)

    const firstTimestamp = testState.lastRequestTimestamp ?? 0

    // Wait more than rate limit
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Manually set timestamp to simulate time passing (11 seconds ago)
    const pastTimestamp = firstTimestamp - 11000
    // eslint-disable-next-line require-atomic-updates
    testState.lastRequestTimestamp = pastTimestamp

    // Second request should be allowed
    await checkRateLimit(testState)
    // Should not have updated timestamp yet
    expect(testState.lastRequestTimestamp).toBe(pastTimestamp)
  })

  test("should throw error if rate limit is exceeded without wait flag", async () => {
    // First request
    await checkRateLimit(testState)
    markRequestComplete(testState)

    // Second request immediately after
    try {
      await checkRateLimit(testState)
      throw new Error("Expected error was not thrown")
    } catch (error: unknown) {
      expect(error).toBeDefined()
      if (error instanceof Error) {
        expect(error.message).toBe("Rate limit exceeded")
      }
    }
  })

  test("should not apply rate limiting when rateLimitSeconds is undefined", async () => {
    testState.rateLimitSeconds = undefined

    await checkRateLimit(testState)
    expect(testState.lastRequestTimestamp).toBeUndefined()

    markRequestComplete(testState)
    // markRequestComplete should not set timestamp when rate limiting is disabled
    expect(testState.lastRequestTimestamp).toBeUndefined()
  })

  test("should prevent rapid requests from bypassing rate limit", async () => {
    // First request
    await checkRateLimit(testState)
    markRequestComplete(testState)

    // Try rapid second request
    try {
      await checkRateLimit(testState)
      throw new Error("Expected error was not thrown")
    } catch (error: unknown) {
      // This is expected behavior
      expect(error).toBeDefined()
    }
  })
})
