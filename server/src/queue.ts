/**
 * In-memory design request queue.
 * Singleton — shared across the server process.
 */

import { EventEmitter } from 'node:events'
import { randomUUID } from 'node:crypto'

export interface ElementContext {
  tag: string
  id: string
  classList: string[]
  textContent: string
  computedStyles: Record<string, string>
  sourceFile?: string
  sourceLine?: number
  pageUrl?: string
  projectPath?: string
  model?: string
}

export type RequestStatus = 'pending' | 'claimed' | 'completed' | 'failed'

export interface DesignRequest {
  id: string
  element: ElementContext
  userMessage: string
  action: 'suggest' | 'develop'
  status: RequestStatus
  createdAt: number
  claimedAt?: number
  claimedBy?: string
  completedAt?: number
  changedFiles?: string[]
  summary?: string
  content?: string
  error?: string
  progress?: string
}

export interface CompletePayload {
  status: 'completed' | 'failed'
  summary?: string
  changedFiles?: string[]
  content?: string
  error?: string
}

const STALE_MS = 120_000            // 2 minutes — 给 Claude Code 足够的处理时间
const CLEANUP_INTERVAL_MS = 5_000  // 5 seconds

class DesignQueue extends EventEmitter {
  private pending: string[] = []
  private requestsById = new Map<string, DesignRequest>()
  private inFlight = new Map<string, { claimedAt: number; lastSeen: number; workerId?: string }>()
  private cleanupTimer: ReturnType<typeof setInterval>

  constructor() {
    super()
    this.cleanupTimer = setInterval(() => this.cleanupStale(), CLEANUP_INTERVAL_MS)
    // Don't keep the Node process alive just for cleanup
    if (this.cleanupTimer.unref) this.cleanupTimer.unref()
  }

  enqueue(element: ElementContext, userMessage: string, action: 'suggest' | 'develop' = 'develop'): DesignRequest {
    const id = randomUUID()
    const request: DesignRequest = {
      id,
      element,
      userMessage,
      action,
      status: 'pending',
      createdAt: Date.now(),
    }
    this.requestsById.set(id, request)
    this.pending.push(id)
    this.emit('enqueue', request)
    return request
  }

  async dequeue(timeoutMs = 30_000, workerId?: string): Promise<DesignRequest | null> {
    if (this.pending.length > 0) {
      return this.claim(this.pending.shift()!, workerId)
    }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.removeListener('enqueue', onEnqueue)
        resolve(null)
      }, timeoutMs)

      const onEnqueue = () => {
        clearTimeout(timer)
        if (this.pending.length > 0) {
          resolve(this.claim(this.pending.shift()!, workerId))
        } else {
          resolve(null)
        }
      }

      this.once('enqueue', onEnqueue)
    })
  }

  private claim(id: string, workerId?: string): DesignRequest {
    const request = this.requestsById.get(id)!
    request.status = 'claimed'
    request.claimedAt = Date.now()
    request.claimedBy = workerId
    const now = Date.now()
    this.inFlight.set(id, { claimedAt: now, lastSeen: now, workerId })
    return request
  }

  complete(id: string, payload: CompletePayload): boolean {
    const request = this.requestsById.get(id)
    if (!request) return false

    // Override rules (per spec)
    if (request.status === 'completed') return false
    if (request.status === 'failed' && payload.status === 'failed') return false

    request.status = payload.status
    request.completedAt = Date.now()
    if (payload.status === 'completed') {
      request.summary = payload.summary
      request.changedFiles = payload.changedFiles
      request.content = payload.content
    } else {
      request.error = payload.error
    }
    this.inFlight.delete(id)
    return true
  }

  getById(id: string): DesignRequest | undefined {
    return this.requestsById.get(id)
  }

  heartbeat(id: string, workerId?: string): boolean {
    const flight = this.inFlight.get(id)
    if (!flight) return false
    if (workerId && flight.workerId && flight.workerId !== workerId) return false
    flight.lastSeen = Date.now()
    return true
  }

  updateProgress(id: string, message: string): DesignRequest | undefined {
    const request = this.requestsById.get(id)
    if (!request || request.status !== 'claimed') return undefined
    request.progress = message
    // Also refresh lastSeen so active processing isn't marked stale
    const flight = this.inFlight.get(id)
    if (flight) flight.lastSeen = Date.now()
    return request
  }

  getAll(): DesignRequest[] {
    return Array.from(this.requestsById.values())
  }

  private cleanupStale(): void {
    const cutoff = Date.now() - STALE_MS
    for (const [id, { lastSeen }] of this.inFlight) {
      if (lastSeen < cutoff) {
        const request = this.requestsById.get(id)
        if (request) {
          // Re-enqueue instead of failing — another worker can pick it up
          request.status = 'pending'
          request.error = undefined
          request.claimedAt = undefined
          request.claimedBy = undefined
          this.pending.push(id)
        }
        this.inFlight.delete(id)
        this.emit('stale', id)
      }
    }
  }

  /** For test use only — resets all internal state */
  _resetForTest(): void {
    this.pending = []
    this.requestsById.clear()
    this.inFlight.clear()
    this.removeAllListeners('enqueue')
  }

  /** For test use only — inserts an id into inFlight directly */
  _addToInFlight(id: string, claimedAt: number): void {
    this.inFlight.set(id, { claimedAt, lastSeen: claimedAt })
  }

  /** For test use only — runs stale cleanup synchronously */
  _runCleanupForTest(): void {
    this.cleanupStale()
  }
}

export const queue = new DesignQueue()
