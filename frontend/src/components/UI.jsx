import React from 'react'

const kpiColorClasses = {
  navy:  'border-t-[#1B2A4A] dark:border-t-navy-400 text-[#1B2A4A] dark:text-navy-300',
  green: 'border-t-[#1A7A4A] text-[#1A7A4A] dark:text-green-400',
  red:   'border-t-[#C0392B] text-[#C0392B] dark:text-red-400',
  gold:  'border-t-[#C29C53] text-[#C29C53] dark:text-brand-400',
  amber: 'border-t-[#D68910] text-[#D68910] dark:text-amber-400',
  blue:  'border-t-[#2980B9] text-[#2980B9] dark:text-blue-450',
  gray:  'border-t-[#888B8D] text-[#888B8D] dark:text-gray-400',
}

const statusBadgeClasses = {
  success: 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400',
  danger:  'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400',
  warning: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400',
  info:    'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400',
  neutral: 'bg-gray-50 dark:bg-navy-800 text-gray-600 dark:text-gray-300',
}

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-white dark:bg-navy-900 border border-gray-100 dark:border-navy-800 rounded-card shadow-card p-4 transition-colors duration-200 ${className}`}>
      {children}
    </div>
  )
}

export function KpiCard({ label, value, sub, color = 'navy' }) {
  const borderAndTextColor = kpiColorClasses[color] || 'border-t-brand-400 text-brand-400'
  return (
    <div className={`bg-white dark:bg-navy-900 border border-gray-100 dark:border-navy-800 rounded-lg border-t-4 ${borderAndTextColor} p-3.5 shadow-card transition-colors duration-200`}>
      <div className="text-gray-400 dark:text-navy-300 text-[10px] uppercase font-bold tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-bold tracking-tight leading-none">{value}</div>
      {sub && <div className="text-gray-400 dark:text-gray-500 text-[10px] mt-1.5 leading-none">{sub}</div>}
    </div>
  )
}

export function CardTitle({ children, icon: Icon }) {
  return (
    <div className="flex items-center gap-2 mb-4 border-b border-gray-50 dark:border-navy-800 pb-2">
      {Icon && <Icon size={16} className="text-brand-400 flex-shrink-0" />}
      <span className="text-xs font-semibold text-[#1B2A4A] dark:text-gray-200 uppercase tracking-wider">{children}</span>
    </div>
  )
}

export function StatusBadge({ children, status = 'neutral' }) {
  const colorClass = statusBadgeClasses[status] || statusBadgeClasses.neutral
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colorClass}`}>
      {children}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, sub, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
      {Icon && <Icon size={32} className="text-gray-300 dark:text-navy-600 mb-2" />}
      <div className="text-sm font-semibold text-[#1B2A4A] dark:text-gray-250 mb-1">{title}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-gray-500 mb-3">{sub}</div>}
      {action}
    </div>
  )
}

export function MarginBar({ label, pct, costo }) {
  const color = pct >= 57 ? 'bg-green-600 dark:bg-green-500' : pct >= 40 ? 'bg-amber-500 dark:bg-amber-400' : 'bg-red-600 dark:bg-red-500'
  const textColor = pct >= 57 ? 'text-green-600 dark:text-green-400' : pct >= 40 ? 'text-amber-500 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
  
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[#1B2A4A] dark:text-gray-300 text-xs font-semibold w-24 truncate">{label}</span>
      {costo && <span className="text-gray-400 dark:text-gray-500 text-[10px] w-16">C$ {costo}</span>}
      <div className="flex-1 h-2 bg-gray-100 dark:bg-navy-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-xs font-bold w-10 text-right ${textColor}`}>{pct}%</span>
    </div>
  )
}

export function Grid({ cols = 2, gap = 4, children }) {
  const colClass = cols === 3 ? 'sm:grid-cols-3' : cols === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-2'
  return (
    <div className={`grid grid-cols-1 ${colClass} gap-${gap}`}>
      {children}
    </div>
  )
}

export function KpiGrid({ children, cols = 4 }) {
  const colClass = cols === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'
  return (
    <div className={`grid ${colClass} gap-3 mb-4`}>
      {children}
    </div>
  )
}
