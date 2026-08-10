import type { ExecutionAdapter, ExecutionAdapterId } from './types'
import { paperExecutionAdapter } from './paper'

/**
 * Execution-adapter registry — only 'paper' lives here, since it's a
 * stateless singleton with no per-account state. 'ctrader' and 'okx' (M2)
 * need a specific account's decrypted credentials per call, so pipeline.ts
 * constructs those directly via createCTraderAdapter()/createOkxAdapter()
 * instead of looking them up here.
 */
const adapters: Partial<Record<ExecutionAdapterId, ExecutionAdapter>> = {
  paper: paperExecutionAdapter,
}

export function getExecutionAdapter(id: ExecutionAdapterId): ExecutionAdapter {
  const adapter = adapters[id]
  if (!adapter) throw new Error(`No execution adapter registered for "${id}" yet.`)
  return adapter
}
