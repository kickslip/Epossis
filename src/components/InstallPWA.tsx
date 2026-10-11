'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

/**
 * "Add to home screen" button. Chrome/Android fires `beforeinstallprompt`;
 * iOS Safari gets a manual hint instead (no programmatic install API).
 */
export function InstallPWA({ dark = false }: { dark?: boolean }) {
  const [prompt, setPrompt] = useState<any>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSHint, setShowIOSHint] = useState(false)

  useEffect(() => {
    setIsIOS(/iP(hone|ad|od)/.test(navigator.userAgent))
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt && !isIOS) return null

  return (
    <div className="relative">
      <button
        onClick={async () => {
          if (prompt) {
            prompt.prompt()
            setPrompt(null)
          } else {
            setShowIOSHint((v) => !v)
          }
        }}
        className={
          dark
            ? 'btn-mercury flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-white/80'
            : 'flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-slate-600 hover:border-primary-400'
        }
      >
        <Download className="h-4 w-4" />
        Install app
      </button>
      {showIOSHint && (
        <p className={`absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border p-3 text-xs leading-relaxed shadow-lg ${dark ? 'border-white/10 bg-slate-900 text-white/70' : 'bg-white text-slate-600'}`}>
          On iPhone/iPad: open in Safari → tap <strong>Share</strong> →{' '}
          <strong>Add to Home Screen</strong>.
        </p>
      )}
    </div>
  )
}
