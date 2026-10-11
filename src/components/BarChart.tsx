import { format } from 'date-fns'

/** Hand-rolled SVG bar chart for daily revenue series. Server-safe. */
export function RevenueBarChart({
  data,
  height = 140,
}: {
  data: { day: string; cents: number }[]
  height?: number
}) {
  const max = Math.max(...data.map((d) => d.cents), 1)
  const barW = 100 / data.length

  return (
    <div>
      <svg viewBox={`0 0 100 ${height / 3}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        {data.map((d, i) => {
          const h = Math.max((d.cents / max) * (height / 3 - 6), d.cents > 0 ? 2 : 0)
          return (
            <rect
              key={d.day}
              x={i * barW + barW * 0.15}
              y={height / 3 - h}
              width={barW * 0.7}
              height={h}
              rx={1}
              className="fill-primary-500"
            >
              <title>{`${d.day}: R${(d.cents / 100).toFixed(2)}`}</title>
            </rect>
          )
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{format(new Date(data[0].day), 'dd MMM')}</span>
        <span>{format(new Date(data[data.length - 1].day), 'dd MMM')}</span>
      </div>
    </div>
  )
}
