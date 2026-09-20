import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
export const num = (n: number | null | undefined, digits = 2) =>
  n == null ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: digits })
export const money = (n: number | null | undefined, currency = 'USD') =>
  n == null
    ? '—'
    : n.toLocaleString('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 })
export const date = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('fr-FR') : '—'
export const changeClass = (v: number | null) =>
  v == null ? 'muted' : v >= 0 ? 'positive' : 'negative'
