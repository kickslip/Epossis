'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import type { TenantTheme } from '@/lib/tenant'
import { InstallPWA } from '@/components/InstallPWA'

/**
 * Marketing landing page — dark glassmorphism + bento grid, adapted from
 * the reference design with e-Pos content and the brand accent vars.
 */
export function LandingView({ theme }: { theme: TenantTheme }) {
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 100
      const y = (e.clientY / window.innerHeight) * 100
      document.documentElement.style.setProperty('--mouse-x', `${x}%`)
      document.documentElement.style.setProperty('--mouse-y', `${y}%`)
      document.querySelectorAll('.bento-card, .btn-mercury').forEach((card) => {
        const rect = card.getBoundingClientRect()
        const cardX = ((e.clientX - rect.left) / rect.width) * 100
        const cardY = ((e.clientY - rect.top) / rect.height) * 100
        ;(card as HTMLElement).style.setProperty('--mouse-x', `${cardX}%`)
        ;(card as HTMLElement).style.setProperty('--mouse-y', `${cardY}%`)
      })
    }
    document.addEventListener('mousemove', handleMouseMove)

    const revealObserver = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (en.isIntersecting) {
            const el = en.target as HTMLElement
            el.style.opacity = '1'
            el.style.transform = 'none'
          }
        }),
      { threshold: 0.1 },
    )
    document.querySelectorAll('.scroll-reveal').forEach((el) => revealObserver.observe(el))

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      revealObserver.disconnect()
    }
  }, [])

  return (
    <>
      <style>{`
        :root { --mouse-x: 50%; --mouse-y: 50%; }
        .landing-body { background: #0a0f1e; color: white; overflow-x: hidden; font-family: Inter, system-ui, sans-serif; }
        .kinetic-title {
          letter-spacing: -0.05em; line-height: 0.88;
          background: linear-gradient(to right, #fff 20%, rgb(var(--accent-rgb, 125 211 252)) 40%, rgb(var(--accent-rgb, 125 211 252)) 60%, #fff 80%);
          background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent;
          animation: textShimmer 8s linear infinite;
        }
        @keyframes textShimmer { to { background-position: 200% center; } }
        .video-portal {
          mask-image: radial-gradient(circle at var(--mouse-x) var(--mouse-y), black 30%, transparent 75%);
          -webkit-mask-image: radial-gradient(circle at var(--mouse-x) var(--mouse-y), black 30%, transparent 75%);
          filter: saturate(1.2) contrast(1.1);
        }
        .glass-1 { backdrop-filter: blur(10px); background: rgb(255 255 255 / 0.04); }
        .glass-2 { backdrop-filter: blur(40px) saturate(180%); background: rgb(255 255 255 / 0.05); }
        .btn-mercury { position: relative; overflow: hidden; transition: all .5s cubic-bezier(.16,1,.3,1); }
        .btn-mercury::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(circle at var(--mouse-x) var(--mouse-y), rgb(var(--accent-rgb, 125 211 252) / .4), transparent 70%);
          opacity: 0; transition: opacity .4s;
        }
        .btn-mercury:hover::before { opacity: 1; }
        .btn-mercury:hover { transform: translateY(-2px); }
        .bento-card {
          background: linear-gradient(135deg, rgb(255 255 255 / .05), rgb(255 255 255 / .02));
          border: 1px solid rgb(255 255 255 / .08); position: relative;
        }
        .bento-card::after {
          content: ''; position: absolute; inset: -1px; border-radius: inherit; pointer-events: none;
          background: radial-gradient(500px circle at var(--mouse-x) var(--mouse-y), rgb(var(--accent-rgb, 125 211 252) / .22), transparent 40%);
          opacity: 0; transition: opacity .5s;
        }
        .bento-card:hover::after { opacity: 1; }
        .scroll-reveal { opacity: 0; transform: translateY(40px); transition: opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1); }
        .scroll-reveal.revealed, .scroll-reveal[style*='opacity: 1'] { opacity: 1; transform: none; }
        @media (prefers-reduced-motion: reduce) { .scroll-reveal { opacity: 1; transform: none; } .kinetic-title { animation: none; } }
      `}</style>

      <div className="landing-body min-h-screen">
        {/* Nav */}
        <nav className="fixed top-0 z-50 flex w-full items-center justify-between px-5 py-5 md:px-10">
          <div className="flex items-center gap-3">
            <div className="glass-1 flex h-10 w-10 items-center justify-center rounded-full border border-white/10">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary-300" />
            </div>
            <span className="text-sm font-bold uppercase tracking-[0.2em]">{theme.name}</span>
          </div>
          <div className="glass-2 hidden items-center gap-8 rounded-full border border-white/10 px-6 py-2 text-[11px] font-bold uppercase tracking-widest md:flex">
            <a href="#features" className="transition-colors hover:text-primary-300">Features</a>
            <a href="#how" className="transition-colors hover:text-primary-300">How it works</a>
            <a href="#more" className="transition-colors hover:text-primary-300">More</a>
          </div>
          <Link
            href="/auth/signin"
            className="btn-mercury rounded-full border border-white/10 bg-white/5 px-6 py-2 text-[11px] font-bold uppercase tracking-widest"
          >
            Sign in
          </Link>
        </nav>

        {/* Hero */}
        <section className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-5">
          <div className="video-portal absolute inset-0 z-0 scale-110 opacity-40">
            <video autoPlay muted loop playsInline className="h-full w-full object-cover">
              <source src="/hero.mp4" type="video/mp4" />
            </video>
          </div>

          <div className="container relative z-10 max-w-5xl pt-16 text-center">
            <span className="mb-6 block font-mono text-xs uppercase tracking-[0.5em] text-primary-300 md:text-sm">
              Inventory · POS · Offline-first
            </span>
            <h1 className="kinetic-title text-[clamp(3.2rem,14vw,10rem)] font-black">
              SCAN.
              <br />
              SELL.
              <br />
              SYNC.
            </h1>
            <div className="glass-2 scroll-reveal mx-auto mt-10 flex max-w-3xl flex-col items-center gap-8 rounded-[2.5rem] border border-white/10 p-8 md:flex-row md:p-10">
              <p className="max-w-sm text-left text-sm leading-relaxed text-white/50">
                Your phone is the scanner, the till and the stock room.{' '}
                <span className="text-white">Point at a barcode</span> to list products, receive
                stock and ring up sales — even with no signal.
              </p>
              <div className="hidden h-px w-20 bg-white/10 md:block" />
              <div className="flex flex-col items-center gap-3">
                <Link
                  href="/auth/signin"
                  className="btn-mercury flex items-center gap-3 rounded-full border border-primary-300/40 bg-primary-600/20 px-8 py-3.5 text-xs font-bold uppercase tracking-widest text-primary-200"
                >
                  Start selling
                  <span aria-hidden>→</span>
                </Link>
                <InstallPWA dark />
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#0a0f1e] to-transparent" />
        </section>

        {/* Bento features */}
        <section id="features" className="container mx-auto max-w-7xl px-5 py-24 md:py-32">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
            <div className="bento-card scroll-reveal relative flex flex-col justify-end overflow-hidden rounded-[2rem] p-8 md:col-span-8 md:rounded-[2.5rem] md:p-12">
              <span className="absolute right-6 top-6 text-5xl opacity-20">📷</span>
              <h3 className="mb-3 text-3xl font-bold tracking-tighter md:text-4xl">Scan everything</h3>
              <p className="max-w-md text-sm leading-relaxed text-white/50">
                Phone camera reads EAN-13, UPC, Code 128 and QR — no barcode gun needed. Unknown code?
                One tap turns it into a new listing with photo, price and supplier.
              </p>
            </div>

            <div className="bento-card scroll-reveal flex flex-col items-center justify-center rounded-[2rem] p-8 text-center md:col-span-4 md:rounded-[2.5rem] md:p-12">
              <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary-300/60 text-3xl">
                📴
              </div>
              <h3 className="text-xl font-bold tracking-tighter md:text-2xl">Sells offline</h3>
              <p className="mt-2 text-sm text-white/50">
                No signal, no problem — sales queue on the device and sync themselves.
              </p>
            </div>

            <div className="bento-card scroll-reveal rounded-[2rem] p-8 md:col-span-4 md:rounded-[2.5rem] md:p-12">
              <span className="mb-5 block text-3xl">🔔</span>
              <h3 className="mb-2 text-xl font-bold tracking-tighter">Stock that warns you</h3>
              <p className="text-sm text-white/50">
                Low-stock thresholds per product, dead-stock radar, and reorder suggestions based on
                how fast things actually sell.
              </p>
            </div>

            <div className="bento-card scroll-reveal flex flex-col items-end gap-6 overflow-hidden rounded-[2rem] p-8 md:col-span-8 md:flex-row md:rounded-[2.5rem] md:p-12">
              <div className="flex-1">
                <h3 className="mb-3 text-3xl font-bold tracking-tighter md:text-4xl">
                  Know your numbers
                </h3>
                <p className="text-sm text-white/50">
                  Best sellers, slow movers, profit per sale, stock value — live on the dashboard,
                  exportable to Excel and PDF.
                </p>
              </div>
              <div className="glass-2 flex h-28 w-full items-end justify-around rounded-2xl border border-white/10 px-6 pb-4 md:w-56">
                {[40, 70, 55, 90, 65].map((h, i) => (
                  <div
                    key={i}
                    className="w-4 rounded-t bg-primary-400/70"
                    style={{ height: `${h}%`, opacity: 0.4 + h / 160 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How it works — layered steps */}
        <section id="how" className="relative overflow-hidden py-24 md:py-40">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[40vh] w-[120vw] -translate-x-1/2 -translate-y-1/2 -rotate-6 bg-primary-400/5 blur-[120px]" />
          <div className="container mx-auto max-w-5xl px-5 text-center">
            <h2 className="scroll-reveal mb-16 text-4xl font-bold tracking-tighter md:mb-24 md:text-6xl">
              Pocket-sized <span className="text-primary-300/60">stock room.</span>
            </h2>
            <div className="relative mx-auto flex max-w-2xl flex-col gap-4">
              {[
                { n: '01', t: 'Scan it in', d: 'Barcode → product. Receive stock with the supplier invoice photo attached.' },
                { n: '02', t: 'Sell it', d: 'Scan to cart, take cash or card ref, print the receipt. Stock deducts itself.' },
                { n: '03', t: 'Watch it move', d: 'Alerts before you run out, reports on what sells — per shop or across all of them.' },
              ].map((s, i) => (
                <div
                  key={s.n}
                  className={`glass-${i + 1 > 2 ? 2 : i + 1} scroll-reveal flex items-center gap-5 rounded-[2rem] border border-white/10 p-6 text-left md:p-8`}
                  style={{ marginLeft: `${i * 1.5}rem`, marginRight: `${(2 - i) * 1.5}rem` }}
                >
                  <span className="font-mono text-2xl font-bold text-primary-300/70 md:text-3xl">{s.n}</span>
                  <div>
                    <h3 className="text-lg font-bold tracking-tight md:text-xl">{s.t}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-white/50 md:text-sm">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Full feature list */}
        <section id="more" className="container mx-auto max-w-5xl px-5 pb-24">
          <div className="bento-card scroll-reveal rounded-[2rem] p-8 md:rounded-[2.5rem] md:p-12">
            <h3 className="mb-8 text-2xl font-bold tracking-tighter md:text-3xl">And everything else</h3>
            <div className="grid grid-cols-1 gap-x-10 gap-y-4 text-sm text-white/60 sm:grid-cols-2">
              {[
                ['🏬', 'Multi-location stock with transfers and stock takes'],
                ['🧾', 'Printable receipts + supplier invoice photo capture'],
                ['🏷️', 'Generate and print barcode labels for unlabelled stock'],
                ['📊', 'CSV, Excel and PDF exports for every report'],
                ['🎨', 'White-label: your logo, colours and branded links'],
                ['👥', 'Staff roles — cashiers sell, managers control'],
                ['🔁', 'Full movement history: where did my stock go?'],
                ['📦', 'CSV import to bring your existing catalog in minutes'],
              ].map(([icon, text]) => (
                <p key={text} className="flex items-start gap-3">
                  <span>{icon}</span>
                  <span>{text}</span>
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 px-5 pb-12 pt-16 md:px-10">
          <div className="container mx-auto max-w-7xl">
            <div className="mb-16 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div>
                <h4 className="mb-4 text-3xl font-bold tracking-tighter">Ready to sell?</h4>
                <p className="max-w-xs text-sm text-white/40">
                  Point your phone at a barcode and you&rsquo;re running a shop.
                </p>
              </div>
              <Link
                href="/auth/signin"
                className="btn-mercury inline-flex w-fit items-center gap-3 rounded-full border border-primary-300/40 bg-primary-600/20 px-8 py-3.5 text-xs font-bold uppercase tracking-widest text-primary-200"
              >
                Open {theme.name} <span aria-hidden>→</span>
              </Link>
            </div>
            <div className="flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 text-[10px] font-bold uppercase tracking-[0.2em] text-white/20 md:flex-row">
              <p>© {new Date().getFullYear()} {theme.name}. All rights reserved.</p>
              <div className="flex gap-8">
                <Link href="/auth/signin">Sign in</Link>
                <a href="#features">Features</a>
                <a href="#how">How it works</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
