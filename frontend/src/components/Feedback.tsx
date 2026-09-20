import type { ReactNode } from 'react'
import { Button } from './ui/button'
export function ErrorBox({ error, retry }: { error: Error | null; retry?: () => void }) {
  return error ? (
    <div className="error" role="alert">
      {error.message}
      {retry && (
        <Button size="sm" onClick={retry}>
          Réessayer
        </Button>
      )}
    </div>
  ) : null
}
export function Loading({ label = 'Chargement des données…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {label}
    </div>
  )
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-symbol">⌁</span>
      <h2>{title}</h2>
      {children}
    </div>
  )
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="page-title">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  )
}
