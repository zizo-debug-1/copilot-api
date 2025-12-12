import { describe, test, expect, beforeEach } from "bun:test"

import { checkRateLimit, markRequestComplete } from "../src/lib/rate-limit"
import type { State } from "../src/lib/state"

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

    const firstTimestamp = testState.lastRequestTimestamp!

    // Wait more than rate limit
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Manually set timestamp to simulate time passing
    testState.lastRequestTimestamp = firstTimestamp - 11000 // 11 seconds ago

    // Second request should be allowed
    await checkRateLimit(testState)
    // Should not have updated timestamp yet
    expect(testState.lastRequestTimestamp).toBe(firstTimestamp - 11000)
  })

  test("should throw error if rate limit is exceeded without wait flag", async () => {
    // First request
    await checkRateLimit(testState)
    markRequestComplete(testState)

    // Second request immediately after
    try {
      await checkRateLimit(testState)
      expect(true).toBe(false) // Should not reach here
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
      // If we get here without error, the test should fail
      expect(true).toBe(false)
    } catch (error: unknown) {
      // This is expected behavior
      expect(error).toBeDefined()
    }
  })
})
