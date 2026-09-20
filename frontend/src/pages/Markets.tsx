import { useState } from 'react'
import { Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMarkets } from '../hooks/data'
import { AssetTable } from '../components/AssetTable'
import { WatchlistPicker } from '../components/WatchlistPicker'
import { PageTitle, ErrorBox, Loading, Empty } from '../components/Feedback'
import { Button } from '../components/ui/button'
export default function Markets() {
  const [q, setQ] = useState(''),
    [search, setSearch] = useState(''),
    [kind, setKind] = useState('all'),
    [sort, setSort] = useState('symbol'),
    [direction, setDirection] = useState('asc'),
    [page, setPage] = useState(1),
    [symbol, setSymbol] = useState('')
  const query = useMarkets(
    '?' + new URLSearchParams({ q: search, kind, sort, direction, page: String(page) }),
  )
  return (
    <>
      <PageTitle
        eyebrow="MARKET INTELLIGENCE"
        title="Explorez les marchés."
        description="Actions et ETF · Dernières séances disponibles, cours ajustés."
        action={
          <Button onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw size={15} />
            Actualiser
          </Button>
        }
      />
      <section className="panel">
        <div className="market-toolbar">
          <form
            className="search-field"
            onSubmit={(e) => {
              e.preventDefault()
              setSearch(q)
              setPage(1)
            }}
          >
            <Search size={17} />
            <input
              aria-label="Rechercher un actif"
              placeholder="Ticker ou nom d’entreprise…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button type="submit" size="sm">
              Rechercher
            </Button>
          </form>
          <select
            aria-label="Type d’actif"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value)
              setPage(1)
            }}
          >
            <option value="all">Tous les actifs</option>
            <option value="stock">Actions</option>
            <option value="etf">ETF</option>
          </select>
          <select
            aria-label="Trier par"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value)
              setPage(1)
            }}
          >
            <option value="symbol">Ticker</option>
            <option value="name">Nom</option>
          </select>
          <Button
            onClick={() => {
              setDirection(direction === 'asc' ? 'desc' : 'asc')
              setPage(1)
            }}
          >
            {direction === 'asc' ? 'A → Z' : 'Z → A'}
          </Button>
        </div>
        <ErrorBox error={query.error} retry={() => void query.refetch()} />
        {query.isPending ? (
          <Loading label="Récupération des cours réels…" />
        ) : query.data?.items.length ? (
          <AssetTable items={query.data.items} onStar={(a) => setSymbol(a.symbol)} />
        ) : (
          <Empty title="Aucun actif trouvé">
            <p>Le catalogue initial couvre 18 actions et ETF. Essayez Apple, AAPL, SPY ou LVMH.</p>
          </Empty>
        )}
        <div className="pagination">
          <span>{query.data?.total ?? 0} actifs · Catalogue MVP</span>
          <div>
            <Button
              size="sm"
              disabled={page === 1 || query.isFetching}
              onClick={() => setPage(page - 1)}
              aria-label="Page précédente"
            >
              <ChevronLeft size={16} />
            </Button>
            <span>Page {page}</span>
            <Button
              size="sm"
              disabled={
                !query.data || page * query.data.page_size >= query.data.total || query.isFetching
              }
              onClick={() => setPage(page + 1)}
              aria-label="Page suivante"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </section>
      <p className="source-note">
        Source : Yahoo Finance via yfinance. Cours historiques ou différés, pas un flux temps réel.
        Volatilité sur 30 rendements quotidiens (252 séances/an). Les signaux seront ajoutés en
        phase 3.
      </p>
      {symbol && <WatchlistPicker symbol={symbol} onClose={() => setSymbol('')} />}
    </>
  )
}
