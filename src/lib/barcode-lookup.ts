/**
 * External barcode → product-info lookup for unknown codes.
 * Keyless public databases, queried in parallel and picked in
 * priority order:
 *   - Open Food Facts      — food & drink, global incl. SA
 *   - Open Beauty Facts    — cosmetics & personal care
 *   - Open Pet Food Facts  — pet supplies
 *   - Open Products Facts  — general consumer goods
 *   - Google Books         — ISBN barcodes (978/979 prefix)
 *   - UPCitemdb trial      — broad general merchandise fallback
 * Fully optional: no keys, no account — a miss just returns null.
 */
export type ExternalProductInfo = {
  name: string
  brand?: string
  description?: string
  imageUrl?: string
  source: string
}

const UA = 'Epossis-POS/1.0 (inventory app)'

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
  // Only ISBN-style codes resolve here
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

export async function lookupExternalBarcode(code: string): Promise<ExternalProductInfo | null> {
  const clean = code.trim()
  if (!/^\d{8,14}$/.test(clean)) return null

  // Try the code in both EAN-13 and UPC-A forms
  const variants = new Set([clean])
  if (clean.length === 13 && clean.startsWith('0')) variants.add(clean.slice(1))
  if (clean.length === 12) variants.add('0' + clean)

  const tasks = [
    ...OPEN_FACTS_SOURCES.map(([base, src]) => lookupOpenFacts(base, src, clean)),
    lookupGoogleBooks(clean),
    ...[...variants].map((v) => lookupUpcItemDb(v)),
  ]
  const results = await Promise.allSettled(tasks)
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) return r.value
  }
  return null
}
