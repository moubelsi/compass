import type { ExecutionAdapter, ExecutionAdapterId } from './types'
import { paperExecutionAdapter } from './paper'

/**
 * Execution-adapter registry. M1 only registers 'paper'. Adding cTrader/OKX
 * later (M2/M4) means implementing ExecutionAdapter and registering it here —
 * no changes to the webhook route, risk engine or pipeline.
 */
const adapters: Partial<Record<ExecutionAdapterId, ExecutionAdapter>> = {
  paper: paperExecutionAdapter,
}

export function getExecutionAdapter(id: ExecutionAdapterId): ExecutionAdapter {
  const adapter = adapters[id]
  if (!adapter) throw new Error(`No execution adapter registered for "${id}" yet.`)
  return adapter
}
