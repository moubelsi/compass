'use client'
import { useEffect, useState } from 'react'

export const CURRENCY_OPTIONS = [
  { symbol: '$',  label: 'USD — $'  },
  { symbol: '€',  label: 'EUR — €'  },
  { symbol: '£',  label: 'GBP — £'  },
  { symbol: '¥',  label: 'JPY — ¥'  },
  { symbol: 'A$', label: 'AUD — A$' },
  { symbol: 'C$', label: 'CAD — C$' },
  { symbol: 'Fr', label: 'CHF — Fr' },
]

const KEY = 'compass_currency'
const EV  = 'compass_currency_change'

export function useCurrency() {
  const [symbol, setSymbol] = useState('$')

  useEffect(() => {
    setSymbol(localStorage.getItem(KEY) ?? '$')
    const handler = () => setSymbol(localStorage.getItem(KEY) ?? '$')
    window.addEventListener(EV, handler)
    return () => window.removeEventListener(EV, handler)
  }, [])

  function setCurrency(s: string) {
    localStorage.setItem(KEY, s)
    setSymbol(s)
    window.dispatchEvent(new Event(EV))
  }

  return { symbol, setCurrency }
}
