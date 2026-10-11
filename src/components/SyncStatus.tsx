'use client'

import { useEffect, useState, useCallback } from 'react'
import { pendingCount, isOnline, loadCatalog } from '@/lib/offline/db'
import { syncOutbox, refreshCatalog } from '@/lib/offline/sync'

const CATALOG_MAX_AGE_MS = 5 * 60 * 1000

/**
 * Registers the service worker, keeps the offline catalog fresh, drains
 * the outbox on reconnect, and shows a small status pill when offline or
 * when ops are pending sync.
 */
export function SyncStatus() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(async () => {
    setPending(await pendingCount())
    setOnline(isOnline())
  }, [])

  const doSync = useCallback(async () => {
    if (!isOnline() || syncing) return
    setSyncing(true)
    try {
      await syncOutbox()
      await refreshCatalog().catch(() => {}) // stock changed during sync
      await refresh()
    } finally {
      setSyncing(false)
    }
  }, [syncing, refresh])

  useEffect(() => {
    // Register SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    refresh()
    refreshCatalog().catch(() => {})

    const onOnline = () => {
      setOnline(true)
      doSync()
      refreshCatalog().catch(() => {})
    }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    const t = setInterval(async () => {
      refresh()
      // Keep the offline catalog fresh (≤5min old) while the app is open
      const cat = await loadCatalog()
      if (isOnline() && (!cat || Date.now() - cat.at > CATALOG_MAX_AGE_MS)) {
        refreshCatalog().catch(() => {})
      }
    }, 10000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(t)
    }
  }, [refresh, doSync])

  if (online && pending === 0) return null

  return (
    <button
      onClick={doSync}
      className={`fixed bottom-20 right-3 z-50 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg md:bottom-4 ${
        !online ? 'bg-slate-800 text-white' : pending > 0 ? 'bg-amber-500 text-white' : 'bg-green-600 text-white'
      }`}
      title={!online ? 'Offline — ops will sync when you reconnect' : 'Tap to sync now'}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${!online ? 'bg-red-400' : 'bg-white'}`} />
      {!online ? `Offline · ${pending} queued` : syncing ? 'Syncing…' : `${pending} to sync`}
    </button>
  )
}
