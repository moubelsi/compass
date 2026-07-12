import type { BrokerId, BrokerProvider } from './types'
import { ctraderProvider } from './ctrader/provider'
import { mexcProvider } from './mexc/provider'

/**
 * Broker registry. Adding a broker (MT5, DXtrade, TradeLocker, Tradovate,
 * IBKR) means implementing BrokerProvider and registering it here — no
 * changes to routes, sync engine or UI wiring.
 */
const providers: Record<BrokerId, BrokerProvider> = {
  ctrader: ctraderProvider,
  mexc: mexcProvider,
}

export function getProvider(id: BrokerId): BrokerProvider {
  return providers[id]
}
