import type { BrokerAccount, BrokerProvider } from '../types'
import { getAuthUrl, exchangeCode, refreshAccessToken } from './oauth'
import { CTraderSession, type CTraderHost } from './client'
import { importClosedTrades } from './import'

/**
 * Account details (balance/currency) are best-effort: an account whose
 * detail lookups fail is still listed so the user can select it.
 */
async function listAccounts(accessToken: string): Promise<BrokerAccount[]> {
  const live = await CTraderSession.connect('live')
  try {
    const raw = await live.getAccountsByToken(accessToken)
    if (raw.length === 0) return []

    const byHost: Record<CTraderHost, Array<Record<string, any>>> = { live: [], demo: [] }
    raw.forEach(a => byHost[a.isLive ? 'live' : 'demo'].push(a))

    const accounts: BrokerAccount[] = []
    for (const host of ['live', 'demo'] as CTraderHost[]) {
      if (byHost[host].length === 0) continue
      const session = host === 'live' ? live : await CTraderSession.connect('demo')
      try {
        for (const a of byHost[host]) {
          const id = Number(a.ctidTraderAccountId)
          const account: BrokerAccount = {
            id: String(id),
            brokerName: a.brokerTitleShort || 'cTrader',
            accountNumber: String(a.traderLogin ?? id),
            isLive: !!a.isLive,
            currency: '',
            balance: 0,
          }
          try {
            await session.authAccount(id, accessToken)
            const trader = await session.getTrader(id)
            const assets = await session.getAssets(id)
            const moneyDigits = Number(trader.moneyDigits ?? 2)
            account.balance = Number(trader.balance ?? 0) / 10 ** moneyDigits
            account.brokerName = trader.brokerName || account.brokerName
            account.currency = assets.find(x => Number(x.assetId) === Number(trader.depositAssetId))?.name || ''
          } catch { /* keep the basic entry */ }
          accounts.push(account)
        }
      } finally {
        if (session !== live) session.close()
      }
    }
    return accounts
  } finally {
    live.close()
  }
}

export const ctraderProvider: BrokerProvider = {
  id: 'ctrader',
  authType: 'oauth',
  getAuthUrl,
  exchangeCode,
  refreshToken: refreshAccessToken,
  listAccounts,
  importTrades: importClosedTrades,
}
