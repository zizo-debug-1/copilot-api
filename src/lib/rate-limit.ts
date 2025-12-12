import consola from "consola"

import type { State } from "./state"

import { HTTPError } from "./error"
import { sleep } from "./utils"

export async function checkRateLimit(state: State) {
  if (state.rateLimitSeconds === undefined) return

  const now = Date.now()

  if (!state.lastRequestTimestamp) {
    // First request - no need to check, just return
    return
  }

  const elapsedSeconds = (now - state.lastRequestTimestamp) / 1000

  if (elapsedSeconds > state.rateLimitSeconds) {
    // Enough time has passed since last request
    return
  }

  const waitTimeSeconds = Math.ceil(state.rateLimitSeconds - elapsedSeconds)

  if (!state.rateLimitWait) {
    consola.warn(
      `Rate limit exceeded. Need to wait ${waitTimeSeconds} more seconds.`,
    )
    throw new HTTPError(
      "Rate limit exceeded",
      Response.json({ message: "Rate limit exceeded" }, { status: 429 }),
    )
  }

  const waitTimeMs = waitTimeSeconds * 1000
  consola.warn(
    `Rate limit reached. Waiting ${waitTimeSeconds} seconds before proceeding...`,
  )
  await sleep(waitTimeMs)
  consola.info("Rate limit wait completed, proceeding with request")
  return
}

/**
 * Mark a request as complete by updating the last request timestamp.
 * This should be called AFTER the request to Copilot has been successfully initiated.
 */
export function markRequestComplete(state: State) {
  if (state.rateLimitSeconds === undefined) return
  state.lastRequestTimestamp = Date.now()
}
