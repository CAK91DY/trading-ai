import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWatchlists, useAddAsset } from '../hooks/data'
import { useNotify } from '../hooks/session'
import { Button } from './ui/button'
import { ErrorBox, Loading } from './Feedback'
export function WatchlistPicker({ symbol, onClose }: { symbol: string; onClose: () => void }) {
  const lists = useWatchlists()
  const add = useAddAsset()
  const [id, setId] = useState('')
  const notify = useNotify()
  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby="watch-title">
        <div className="panel-heading">
          <h2 id="watch-title">Suivre {symbol}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Fermer">
            ×
          </Button>
        </div>
        {lists.isPending ? (
          <Loading />
        ) : lists.data?.length ? (
          <>
            <label>
              Choisir une liste
              <select value={id || lists.data[0].id} onChange={(e) => setId(e.target.value)}>
                {lists.data.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <ErrorBox error={add.error || lists.error} />
            <Button
              variant="default"
              disabled={add.isPending}
              onClick={() =>
                add.mutate(
                  { id: id || lists.data![0].id, symbol },
                  {
                    onSuccess: () => {
                      notify(symbol + ' ajouté à votre watchlist.')
                      onClose()
                    },
                  },
                )
              }
            >
              Ajouter à la liste
            </Button>
          </>
        ) : (
          <p>
            Créez d’abord une liste dans{' '}
            <Link to="/watchlists" onClick={onClose}>
              Watchlists
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  )
}
