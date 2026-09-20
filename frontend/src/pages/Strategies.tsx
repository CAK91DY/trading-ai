import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { Strategy, Definition, Rule } from '../types'
import { PageTitle, ErrorBox, Loading, Empty } from '../components/Feedback'
import { Button } from '../components/ui/button'
import { StrategySummary, indicatorLabels } from '../components/StrategySummary'
const initial: Omit<Strategy, 'id'> = {
  name: 'EMA + RSI Momentum',
  active: true,
  definition: {
    fast: 20,
    slow: 50,
    entry_mode: 'all',
    exit_mode: 'any',
    entry: [
      { indicator: 'ema_fast', operator: '>', value: 'ema_slow' },
      { indicator: 'rsi', operator: '>', value: 50 },
      { indicator: 'rsi', operator: '<', value: 70 },
    ],
    exit: [{ indicator: 'ema_fast', operator: '<=', value: 'ema_slow' }],
  },
}
export default function Strategies() {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['strategies'],
    queryFn: () => api<Strategy[]>('/strategies'),
  })
  const [id, setId] = useState<string | null>(null)
  const [draft, setDraft] = useState(initial)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [message, setMessage] = useState('')
  const mutation = useMutation({
    mutationFn: ({
      method,
      target,
      body,
    }: {
      method: string
      target?: string
      body?: Omit<Strategy, 'id'>
    }) =>
      api<Strategy | undefined>('/strategies' + (target ? '/' + target : ''), {
        method,
        body: body ? JSON.stringify(body) : undefined,
      }),
    onSuccess: (saved) => {
      void client.invalidateQueries({ queryKey: ['strategies'] })
      setConfirmDelete(false)
      if (saved) {
        setId(saved.id)
        setDraft({ name: saved.name, active: saved.active, definition: saved.definition })
        setMessage('Stratégie enregistrée.')
      } else {
        setId(null)
        setDraft(initial)
        setMessage('Stratégie supprimée. Les anciens backtests sont conservés.')
      }
    },
  })
  function changeDefinition(patch: Partial<Definition>) {
    setDraft((d) => ({ ...d, definition: { ...d.definition, ...patch } }))
    setMessage('')
  }
  function changeRule(side: 'entry' | 'exit', index: number, patch: Partial<Rule>) {
    changeDefinition({
      [side]: draft.definition[side].map((r, i) => (i === index ? { ...r, ...patch } : r)),
    })
  }
  return (
    <>
      <PageTitle
        eyebrow="CONSTRUCTEUR DE STRATÉGIES"
        title="Stratégies"
        description="Combinez des conditions EMA et RSI, puis testez-les sur les historiques réels."
      />
      <ErrorBox error={query.error || mutation.error} />
      {message && <p role="status">{message}</p>}
      <section className="panel">
        <div className="panel-heading">
          <h2>Mes stratégies</h2>
          <Button
            disabled={mutation.isPending}
            onClick={() => {
              setId(null)
              setDraft(initial)
              setConfirmDelete(false)
              setMessage('')
              mutation.reset()
            }}
          >
            Nouvelle stratégie
          </Button>
        </div>
        {query.isPending ? (
          <Loading />
        ) : !query.data?.length ? (
          <Empty title="Aucune stratégie sauvegardée">
            <p>Personnalisez le modèle ci-dessous pour commencer.</p>
          </Empty>
        ) : (
          query.data.map((s) => (
            <Button
              key={s.id}
              className="history-row"
              disabled={mutation.isPending}
              onClick={() => {
                setId(s.id)
                setDraft({ name: s.name, active: s.active, definition: s.definition })
                setConfirmDelete(false)
                setMessage('')
                mutation.reset()
              }}
            >
              <span>{s.name}</span>
              <b>{s.active ? 'Active' : 'Inactive'}</b>
            </Button>
          ))
        )}
      </section>
      <section className="panel">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            mutation.mutate({ method: id ? 'PATCH' : 'POST', target: id ?? undefined, body: draft })
          }}
        >
          <h2>{id ? 'Modifier la stratégie' : 'Créer une stratégie'}</h2>
          <fieldset disabled={mutation.isPending} style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="form-grid">
              <label>
                Nom de la stratégie
                <input
                  required
                  maxLength={80}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </label>
              <label>
                EMA rapide
                <input
                  type="number"
                  required
                  min={2}
                  max={500}
                  value={draft.definition.fast}
                  onChange={(e) => changeDefinition({ fast: Number(e.target.value) })}
                />
              </label>
              <label>
                EMA lente
                <input
                  type="number"
                  required
                  min={draft.definition.fast + 1}
                  max={1000}
                  value={draft.definition.slow}
                  onChange={(e) => changeDefinition({ slow: Number(e.target.value) })}
                />
              </label>
              <label>
                Disponibilité
                <select
                  value={draft.active ? 'active' : 'inactive'}
                  onChange={(e) => setDraft({ ...draft, active: e.target.value === 'active' })}
                >
                  <option value="active">Active pour les backtests</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
            {(['entry', 'exit'] as const).map((side) => (
              <section key={side} className="panel">
                <h3>{side === 'entry' ? 'Conditions d’entrée' : 'Conditions de sortie'}</h3>
                <label>
                  Combinaison {side === 'entry' ? 'd’entrée' : 'de sortie'}
                  <select
                    value={draft.definition[`${side}_mode`]}
                    onChange={(e) => changeDefinition({ [`${side}_mode`]: e.target.value })}
                  >
                    <option value="all">Toutes les conditions (ET)</option>
                    <option value="any">Au moins une condition (OU)</option>
                  </select>
                </label>
                {draft.definition[side].map((r, i) => (
                  <div className="form-grid" key={i}>
                    <label>
                      Indicateur {side} {i + 1}
                      <select
                        value={r.indicator}
                        onChange={(e) => {
                          const v = e.target.value as Rule['indicator']
                          changeRule(side, i, {
                            indicator: v,
                            value: v === 'rsi' ? 50 : v === 'ema_fast' ? 'ema_slow' : 'ema_fast',
                          })
                        }}
                      >
                        {Object.entries(indicatorLabels).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Comparaison {side} {i + 1}
                      <select
                        value={r.operator}
                        onChange={(e) =>
                          changeRule(side, i, { operator: e.target.value as Rule['operator'] })
                        }
                      >
                        {['>', '>=', '<', '<='].map((op) => (
                          <option key={op}>{op}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Valeur {side} {i + 1}
                      {r.indicator === 'rsi' ? (
                        <input
                          type="number"
                          required
                          min={0}
                          max={100}
                          step="any"
                          value={r.value}
                          onChange={(e) => changeRule(side, i, { value: Number(e.target.value) })}
                        />
                      ) : (
                        <input
                          readOnly
                          value={indicatorLabels[r.value as 'ema_fast' | 'ema_slow']}
                        />
                      )}
                    </label>
                    <Button
                      type="button"
                      disabled={draft.definition[side].length <= 1}
                      onClick={() =>
                        changeDefinition({
                          [side]: draft.definition[side].filter((_, j) => j !== i),
                        })
                      }
                    >
                      Retirer la condition {i + 1}
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  disabled={draft.definition[side].length >= 8}
                  onClick={() =>
                    changeDefinition({
                      [side]: [
                        ...draft.definition[side],
                        { indicator: 'rsi', operator: '>', value: 50 },
                      ],
                    })
                  }
                >
                  Ajouter une condition {side === 'entry' ? 'd’entrée' : 'de sortie'}
                </Button>
              </section>
            ))}
            <StrategySummary definition={draft.definition} />
            <p className="subtitle">
              Conditions évaluées à la clôture, exécution à l’ouverture suivante. La sortie est
              prioritaire si les deux groupes sont vrais. Une position reste ouverte tant que la
              sortie n’est pas vraie. Aucun ordre réel.
            </p>
            <Button type="submit">
              {mutation.isPending ? 'Enregistrement…' : 'Enregistrer la stratégie'}
            </Button>
          </fieldset>
        </form>
        {id && (
          <div className="panel-heading" style={{ marginTop: 20 }}>
            <Button
              disabled={mutation.isPending}
              onClick={() =>
                mutation.mutate({
                  method: 'POST',
                  body: { ...draft, name: draft.name.slice(0, 70) + ' (copie)' },
                })
              }
            >
              Dupliquer
            </Button>
            <Link to={`/backtesting?strategy=${encodeURIComponent(id)}`}>
              Tester la version enregistrée →
            </Link>
            <Button disabled={mutation.isPending} onClick={() => setConfirmDelete(true)}>
              Supprimer
            </Button>
          </div>
        )}
        {confirmDelete && id && (
          <div role="alert">
            <p>Supprimer cette stratégie ? Les résultats déjà enregistrés resteront disponibles.</p>
            <Button
              disabled={mutation.isPending}
              onClick={() => mutation.mutate({ method: 'DELETE', target: id })}
            >
              Confirmer la suppression
            </Button>
            <Button onClick={() => setConfirmDelete(false)}>Annuler</Button>
          </div>
        )}
      </section>
    </>
  )
}
