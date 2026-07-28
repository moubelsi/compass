import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fetchAllRows } from './fetchAll'

export interface SetupStats {
  count: number
  wins: number
  winRate: number
  pnl: number
}

const EMPTY: SetupStats = { count: 0, wins: 0, winRate: 0, pnl: 0 }

/** Performance per Playbook setup, matched to trades by strategy name (case-insensitive). */
export function useSetupStats(): { statsByName: Record<string, SetupStats>; loaded: boolean } {
  const [statsByName, setStatsByName] = useState<Record<string, SetupStats>>({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetchAllRows((from, to) => supabase.from('trades').select('strategy, pnl').not('strategy', 'is', null).range(from, to))
      .then(rows => {
        const map: Record<string, SetupStats> = {}
        for (const t of rows) {
          const key = String(t.strategy).trim().toLowerCase()
          if (!key) continue
          const s = (map[key] ??= { ...EMPTY })
          s.count++
          const pnl = Number(t.pnl || 0)
          s.pnl += pnl
          if (pnl > 0) s.wins++
        }
        for (const s of Object.values(map)) s.winRate = s.count > 0 ? (s.wins / s.count) * 100 : 0
        setStatsByName(map)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  return { statsByName, loaded }
}

export function statsFor(statsByName: Record<string, SetupStats>, name: string): SetupStats {
  return statsByName[name.trim().toLowerCase()] ?? EMPTY
}
