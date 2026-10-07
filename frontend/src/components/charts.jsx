import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { Card, CardHeader } from './ui'

/**
 * Chart palette: validated categorical slots (dataviz reference palette).
 * Slot 1 = morning / single series, slot 2 = evening. Text never uses series colors.
 */
export const SERIES = { s1: '#2a78d6', s2: '#eb6834' }
const AXIS = { fontSize: 11, fill: '#64748b' }
const GRID = '#eef1f5'

function TooltipBox({ active, payload, label, format, labelFormat }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-(--shadow-pop)">
      <p className="mb-1 font-semibold text-slate-900">{labelFormat ? labelFormat(label) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-slate-600">
          <span className="size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden />
          <span>{p.name}</span>
          <span className="tabular ml-auto pl-3 font-semibold text-slate-900">{format ? format(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  )
}

export function ChartCard({ title, subtitle, children, height = 240, action }) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} action={action} />
      <div className="px-2 pt-3 pb-2" style={{ height }}>{children}</div>
    </Card>
  )
}

/** Stacked bars (e.g. morning + evening litres per day). 2px surface gap between segments. */
export function StackedBars({ data, xKey, series, format, xFormat, labelFormat }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={xFormat} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => Intl.NumberFormat('en-IN', { notation: 'compact' }).format(v)} />
        <Tooltip cursor={{ fill: 'rgb(15 23 42 / 0.04)' }} content={<TooltipBox format={format} labelFormat={labelFormat || xFormat} />} />
        <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, color: '#475569' }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId="a"
            fill={s.color}
            stroke="#fff"
            strokeWidth={2}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
            maxBarSize={28}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Single-series trend (area with 2px line). */
export function TrendArea({ data, xKey, yKey, name, format, xFormat, labelFormat, color = SERIES.s1 }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id={`fill-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={xFormat} interval="preserveStartEnd" minTickGap={8} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => Intl.NumberFormat('en-IN', { notation: 'compact' }).format(v)} />
        <Tooltip cursor={{ stroke: '#94a3b8', strokeDasharray: '3 3' }} content={<TooltipBox format={format} labelFormat={labelFormat || xFormat} />} />
        <Area type="monotone" dataKey={yKey} name={name} stroke={color} strokeWidth={2} fill={`url(#fill-${yKey})`} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Single-series bars (monthly performance). */
export function SimpleBars({ data, xKey, yKey, name, format, xFormat, color = SERIES.s1 }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={xFormat} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => Intl.NumberFormat('en-IN', { notation: 'compact' }).format(v)} />
        <Tooltip cursor={{ fill: 'rgb(15 23 42 / 0.04)' }} content={<TooltipBox format={format} labelFormat={xFormat} />} />
        <Bar dataKey={yKey} name={name} fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}
