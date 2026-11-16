import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { api } from '../api/client'
import type { BadgeCounts } from '../api/types'

const POLL_INTERVAL_MS = 60_000

/**
 * Badge counts by polling.
 *
 * Push is optional in this deployment — the server may have no outbound
 * internet at all — so polling is the guaranteed path, not a fallback.
 *
 * It only runs while the app is in the foreground. A timer left running in
 * the background would wake the radio every minute all day for a screen
 * nobody is looking at, and Android will kill it anyway. Coming back to the
 * foreground fetches immediately rather than waiting out the interval.
 */
export function useBadge() {
  const [counts, setCounts] = useState<BadgeCounts | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const alive = useRef(true)

  const fetchOnce = useCallback(async () => {
    try {
      const res = await api.badge()
      if (alive.current) setCounts(res)
    } catch {
      // A failed poll is not worth surfacing: the next one is 60s away and
      // every screen has its own error handling for the data that matters.
    }
  }, [])

  const start = useCallback(() => {
    if (timer.current) return
    fetchOnce()
    timer.current = setInterval(fetchOnce, POLL_INTERVAL_MS)
  }, [fetchOnce])

  const stop = useCallback(() => {
    if (!timer.current) return
    clearInterval(timer.current)
    timer.current = null
  }, [])

  useEffect(() => {
    alive.current = true
    start()

    const onChange = (state: AppStateStatus) => {
      if (state === 'active') start()
      else stop()
    }
    const sub = AppState.addEventListener('change', onChange)

    return () => {
      alive.current = false
      stop()
      sub.remove()
    }
  }, [start, stop])

  return { counts, refresh: fetchOnce }
}
