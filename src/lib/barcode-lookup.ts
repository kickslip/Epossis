/**
 * External barcode → product-info lookup for unknown codes.
 * Keyless sources, queried in parallel; returns up to a few
 * candidates so the user can pick the correct match (community
 * databases sometimes carry wrong variants).
 *
 * Sources, in preference order:
 *   - Open Food Facts      — food & drink, global incl. SA
 *   - Open Beauty Facts    — cosmetics & personal care
 *   - Open Pet Food Facts  — pet supplies
 *   - Open Products Facts  — general consumer goods
 *   - Google Books         — ISBN barcodes (978/979 prefix)
 *   - UPCitemdb trial      — broad general merchandise
 *   - BarcodeLookup        — web catalogue scrape
 *   - DuckDuckGo HTML      — web search fallback (title scrape)
 */
export type ExternalProductInfo = {
  name: string
  brand?: string
  description?: string
  imageUrl?: string
  source: string
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 Epossis-POS/1.0'

const OPEN_FACTS_SOURCES = [
  ['https://world.openfoodfacts.org', 'Open Food Facts'],
  ['https://world.openbeautyfacts.org', 'Open Beauty Facts'],
  ['https://world.openpetfoodfacts.org', 'Open Pet Food Facts'],
  ['https://world.openproductsfacts.org', 'Open Products Facts'],
] as const

async function lookupOpenFacts(base: string, source: string, code: string): Promise<ExternalProductInfo | null> {
  const res = await fetch(
    `${base}/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,image_url,generic_name,categories`,
    { headers: { 'User-Agent': UA }, next: { revalidate: 86400 } },
  )
  if (!res.ok) return null
  const json = await res.json()
  const p = json?.product
  if (json?.status !== 1 || !p?.product_name) return null
  return {
    name: p.product_name,
    brand: p.brands || undefined,
    description: p.generic_name || p.categories || undefined,
    imageUrl: p.image_url || undefined,
    source,
  }
}

async function lookupGoogleBooks(code: string): Promise<ExternalProductInfo | null> {
  if (!/^97[89]\d{10}$/.test(code)) return null
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(code)}&fields=items(volumeInfo(title,authors,description,imageLinks,publisher))&maxResults=1`,
    { headers: { 'User-Agent': UA }, next: { revalidate: 86400 } },
  )
  if (!res.ok) return null
  const json = await res.json()
  const v = json?.items?.[0]?.volumeInfo
  if (!v?.title) return null
  return {
    name: v.title,
    brand: v.authors?.[0] || v.publisher || undefined,
    description: typeof v.description === 'string' ? v.description.slice(0, 300) : undefined,
    imageUrl: v.imageLinks?.thumbnail || undefined,
    source: 'Google Books',
  }
}

async function lookupUpcItemDb(code: string): Promise<ExternalProductInfo | null> {
  const res = await fetch(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`,
    { headers: { 'User-Agent': UA }, next: { revalidate: 86400 } },
  )
  if (!res.ok) return null
  const json = await res.json()
  const item = json?.items?.[0]
  if (!item?.title) return null
  return {
    name: item.title,
    brand: item.brand || undefined,
    description: item.description || undefined,
    imageUrl: item.images?.[0] || undefined,
    source: 'UPCitemdb',
  }
}

async function lookupBarcodeLookup(code: string): Promise<ExternalProductInfo | null> {
  const res = await fetch(`https://www.barcodelookup.com/${encodeURIComponent(code)}`, {
    headers: { 'User-Agent': UA },
    next: { revalidate: 86400 },
  })
  if (!res.ok) return null
  const html = await res.text()
  const og = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1]
    ?? html.match(/<title>([^<]+)<\/title>/i)?.[1]
  if (!og || /not found|barcode lookup/i.test(og)) return null
  const name = decodeEntities(og).replace(/\s*[-|]\s*barcode lookup.*$/i, '').trim()
  if (!name || name.length < 4) return null
  const img = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i)?.[1]
  return { name, imageUrl: img || undefined, source: 'BarcodeLookup' }
}

/** Web-search fallback: scrape DuckDuckGo's HTML endpoint for the barcode. */
async function lookupDuckDuckGo(code: string): Promise<ExternalProductInfo | null> {
  const res = await fetch(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(code + ' product')}`,
    { headers: { 'User-Agent': UA }, next: { revalidate: 86400 } },
  )
  if (!res.ok) return null
  const html = await res.text()
  const titles = [...html.matchAll(/class="result__a"[^>]*>([\s\S]*?)<\/a>/g)]
    .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, '')).trim())
    .filter(Boolean)
    .slice(0, 5)
  // Pick the most "product-like" title: contains the code itself or digits,
  // and isn't a generic barcode-lookup service page
  const candidate = titles.find(
    (t) => t.includes(code) || /\d/.test(t),
  ) ?? titles[0]
  if (!candidate) return null
  const cleaned = candidate
    .replace(/\s*[-|–—:]\s*(buy|shop|price|amazon|walmart|pick n pay|pnp|checkers|clicks|dischem|takealot|spar|makro|game|boxer|barcode|ean|upc)[^|–—-]*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (!cleaned || cleaned.length < 4) return null
  return { name: cleaned, source: 'Web search' }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function normaliseKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * Query all sources for a barcode; returns deduplicated candidates,
 * best-first. Tries both EAN-13 and UPC-A digit forms.
 */
export async function lookupExternalBarcodes(code: string): Promise<ExternalProductInfo[]> {
  const clean = code.trim()
  if (!/^\d{8,14}$/.test(clean)) return []

  const variants = new Set([clean])
  if (clean.length === 13 && clean.startsWith('0')) variants.add(clean.slice(1))
  if (clean.length === 12) variants.add('0' + clean)

  const tasks: Promise<ExternalProductInfo | null>[] = [
    ...OPEN_FACTS_SOURCES.map(([base, src]) => lookupOpenFacts(base, src, clean)),
    lookupGoogleBooks(clean),
    ...[...variants].map((v) => lookupUpcItemDb(v)),
    lookupBarcodeLookup(clean),
    lookupDuckDuckGo(clean),
  ]
  const results = await Promise.allSettled(tasks)

  const seen = new Set<string>()
  const out: ExternalProductInfo[] = []
  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value) continue
    const key = normaliseKey(r.value.name)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r.value)
    if (out.length >= 4) break
  }
  return out
}

/** Single best candidate (used by the product form's 🔎 button). */
export async function lookupExternalBarcode(code: string): Promise<ExternalProductInfo | null> {
  const all = await lookupExternalBarcodes(code)
  return all[0] ?? null
}
