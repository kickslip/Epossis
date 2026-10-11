/**
 * Colour helpers for the white-label theme system.
 * Pure functions — safe in both server and client components.
 */

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  if (Number.isNaN(n) || full.length !== 6) return [59, 130, 246] // fallback blue-500
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const mix = (a: number, b: number, t: number) => Math.round(a + (b - a) * t)

function mixHex(hex: string, target: [number, number, number], t: number): [number, number, number] {
  const [r, g, b] = hexToRgb(hex)
  return [mix(r, target[0], t), mix(g, target[1], t), mix(b, target[2], t)]
}

const WHITE: [number, number, number] = [255, 255, 255]
const BLACK: [number, number, number] = [10, 10, 16]

const SHADE_MIX: Record<number, { to: [number, number, number]; t: number }> = {
  50: { to: WHITE, t: 0.93 },
  100: { to: WHITE, t: 0.84 },
  200: { to: WHITE, t: 0.68 },
  300: { to: WHITE, t: 0.5 },
  400: { to: WHITE, t: 0.28 },
  500: { to: WHITE, t: 0 },
  600: { to: BLACK, t: 0.12 },
  700: { to: BLACK, t: 0.26 },
  800: { to: BLACK, t: 0.4 },
  900: { to: BLACK, t: 0.52 },
}

/**
 * Generates a Tailwind-style 50–900 scale from a single brand hex.
 * Values are `R G B` triplets for `rgb(var(--primary-N) / <alpha-value>)`.
 */
export function primaryScaleVars(hex: string): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [shade, { to, t }] of Object.entries(SHADE_MIX)) {
    const [r, g, b] = t === 0 ? hexToRgb(hex) : mixHex(hex, to, t)
    vars[`--primary-${shade}`] = `${r} ${g} ${b}`
  }
  return vars
}
