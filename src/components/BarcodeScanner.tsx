'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'

const HINTS = new Map()
HINTS.set(DecodeHintType.POSSIBLE_FORMATS, [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.QR_CODE,
])

/**
 * Live camera barcode scanner. Fully client-side — ZXing decodes in
 * browser, no external API. Calls onDetected(code) once per scan, with a
 * short cooldown so the same barcode doesn't fire repeatedly.
 */
export function BarcodeScanner({
  onDetected,
  active = true,
  cooldownMs = 1500,
}: {
  onDetected: (code: string) => void
  active?: boolean
  cooldownMs?: number
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const [error, setError] = useState('')
  const [torchOn, setTorchOn] = useState(false)
  const [torchCapable, setTorchCapable] = useState(false)

  const handle = useCallback(
    (code: string) => {
      const now = Date.now()
      if (code === lastRef.current.code && now - lastRef.current.at < cooldownMs) return
      lastRef.current = { code, at: now }
      onDetected(code)
    },
    [onDetected, cooldownMs],
  )

  useEffect(() => {
    if (!active) return
    const reader = new BrowserMultiFormatReader(HINTS, { delayBetweenScanAttempts: 150 })
    let cancelled = false

    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result, _err, controls) => {
        controlsRef.current = controls
        if (result && !cancelled) handle(result.getText())
      })
      .then(() => {
        // Torch capability check (Android Chrome exposes it via track constraints)
        const track = videoRef.current?.srcObject instanceof MediaStream
          ? videoRef.current.srcObject.getVideoTracks()[0]
          : null
        const caps = (track?.getCapabilities?.() as any)?.torch
        setTorchCapable(!!caps)
      })
      .catch((e) => {
        if (!cancelled) setError('Camera unavailable — grant permission and use HTTPS/localhost.')
        console.error('[scanner]', e)
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
    }
  }, [active, handle])

  async function toggleTorch() {
    const stream = videoRef.current?.srcObject
    if (!(stream instanceof MediaStream)) return
    const track = stream.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as any] })
      setTorchOn(!torchOn)
    } catch {}
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video ref={videoRef} className="h-64 w-full object-cover" muted playsInline />
      {/* Viewfinder */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-24 w-3/4 rounded-lg border-2 border-primary-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 p-4 text-center text-sm text-white">
          {error}
        </div>
      )}
      {torchCapable && (
        <button
          type="button"
          onClick={toggleTorch}
          className={`absolute right-2 top-2 rounded-full px-3 py-1 text-xs font-medium ${
            torchOn ? 'bg-yellow-400 text-black' : 'bg-white/20 text-white'
          }`}
        >
          Torch
        </button>
      )}
    </div>
  )
}

/**
 * Hardware barcode scanners act as a fast keyboard ending in Enter.
 * Call once on pages where scanning should work without the camera.
 */
export function useKeyboardScanner(onScan: (code: string) => void, enabled = true) {
  const bufferRef = useRef('')
  const lastKeyRef = useRef(0)

  useEffect(() => {
    if (!enabled) return
    function onKeyDown(e: KeyboardEvent) {
      const now = Date.now()
      if (now - lastKeyRef.current > 100) bufferRef.current = '' // human typing, reset
      lastKeyRef.current = now

      const target = e.target as HTMLElement
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      if (e.key === 'Enter') {
        if (bufferRef.current.length >= 6 && !typing) {
          onScan(bufferRef.current)
          bufferRef.current = ''
          e.preventDefault()
        }
        return
      }
      if (e.key.length === 1 && !typing) bufferRef.current += e.key
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onScan, enabled])
}
