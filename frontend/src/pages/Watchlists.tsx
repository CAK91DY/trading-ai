import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Pencil, Check } from 'lucide-react'
import { useWatchlists } from '../hooks/data'
import { api } from '../services/api'
import type { Asset, Watchlist } from '../types'
import { useNotify } from '../hooks/session'
import { PageTitle, ErrorBox, Loading, Empty } from '../components/Feedback'
import { AssetTable } from '../components/AssetTable'
import { Button } from '../components/ui/button'
export default function Watchlists() {
  const lists = useWatchlists(),
    client = useQueryClient(),
    notify = useNotify()
  const [selected, setSelected] = useState(''),
    [name, setName] = useState(''),
    [renaming, setRenaming] = useState(false),
    [rename, setRename] = useState(''),
    [symbol, setSymbol] = useState(''),
    [confirm, setConfirm] = useState(false)
  const active = lists.data?.find((l) => l.id === selected) ?? lists.data?.[0]
  const quotes = useQuery({
    queryKey: ['watchlist-quotes', active?.id, active?.symbols.join(',')],
    queryFn: () => api<Asset[]>(`/watchlists/${active!.id}/quotes`),
    enabled: !!active,
    staleTime: 600000,
  })
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => api<Asset[]>('/assets') })
  const mutation = useMutation({
    mutationFn: async ({ path, method, body }: { path: string; method: string; body?: unknown }) =>
      api<Watchlist | undefined>(path, { method, body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['watchlists'] })
      void client.invalidateQueries({ queryKey: ['watchlist-quotes'] })
      notify('Watchlist mise à jour.')
    },
  })
  const change = (path: string, method: string, body?: unknown) =>
    mutation.mutate({ path, method, body })
  return (
    <>
      <PageTitle
        eyebrow="VOTRE RADAR PERSONNEL"
        title="Watchlists"
        description="Organisez les actifs que vous souhaitez suivre, à votre rythme."
      />
      <ErrorBox error={lists.error || quotes.error || mutation.error || catalog.error} />
      <section className="panel">
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate(
              { path: '/watchlists', method: 'POST', body: { name } },
              {
                onSuccess: (r) => {
                  if (r) setSelected(r.id)
                  setName('')
                },
              },
            )
          }}
        >
          <input
            aria-label="Nom de la nouvelle watchlist"
            placeholder="Nouvelle liste : Tech, ETF…"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Button variant="default" type="submit" disabled={mutation.isPending || !name.trim()}>
            <Plus size={15} />
            Créer une liste
          </Button>
        </form>
        {lists.isPending ? (
          <Loading />
        ) : !active ? (
          <Empty title="Votre premier radar commence ici.">
            <p>Créez une liste puis ajoutez les actions et ETF qui vous intéressent.</p>
          </Empty>
        ) : (
          <>
            <div className="watch-tabs">
              {lists.data?.map((l) => (
                <Button
                  key={l.id}
                  className={l.id === active.id ? 'selected' : ''}
                  onClick={() => {
                    setSelected(l.id)
                    setRenaming(false)
                    setConfirm(false)
                  }}
                >
                  {l.name}
                  <span>{l.symbols.length}</span>
                </Button>
              ))}
            </div>
            <div className="panel-heading">
              <h2>{active.name}</h2>
              <div className="inline-actions">
                <Button
                  size="sm"
                  aria-label="Renommer la liste"
                  onClick={() => {
                    setRename(active.name)
                    setRenaming(!renaming)
                  }}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  size="sm"
                  aria-label="Supprimer la liste"
                  onClick={() => setConfirm(!confirm)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
            {renaming && (
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  mutation.mutate(
                    { path: `/watchlists/${active.id}`, method: 'PATCH', body: { name: rename } },
                    { onSuccess: () => setRenaming(false) },
                  )
                }}
              >
                <input
                  aria-label="Nouveau nom de la watchlist"
                  value={rename}
                  maxLength={80}
                  onChange={(e) => setRename(e.target.value)}
                  required
                />
                <Button type="submit" disabled={!rename.trim() || mutation.isPending}>
                  <Check size={15} />
                  Enregistrer
                </Button>
              </form>
            )}
            {confirm && (
              <div className="warning">
                Supprimer « {active.name} » et ses associations ?
                <Button
                  variant="destructive"
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate(
                      { path: `/watchlists/${active.id}`, method: 'DELETE' },
                      { onSuccess: () => setConfirm(false) },
                    )
                  }
                >
                  Confirmer la suppression
                </Button>
                <Button onClick={() => setConfirm(false)}>Annuler</Button>
              </div>
            )}
            <form
              className="inline-form add-asset"
              onSubmit={(e) => {
                e.preventDefault()
                change(`/watchlists/${active.id}/assets`, 'POST', { symbol })
              }}
            >
              <select
                aria-label="Actif à ajouter"
                required
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
              >
                <option value="">Choisir un actif…</option>
                {catalog.data?.map((a) => (
                  <option key={a.symbol} value={a.symbol}>
                    {a.symbol} — {a.name}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={!symbol || mutation.isPending}>
                <Plus size={15} />
                Ajouter
              </Button>
            </form>
            {quotes.isPending ? (
              <Loading />
            ) : quotes.data?.length ? (
              <AssetTable
                items={quotes.data}
                starred={active.symbols}
                onStar={(a) => change(`/watchlists/${active.id}/assets/${a.symbol}`, 'DELETE')}
              />
            ) : (
              <Empty title="Cette liste est encore vide.">
                <p>Ajoutez votre premier actif ci-dessus.</p>
              </Empty>
            )}
          </>
        )}
      </section>
    </>
  )
}
