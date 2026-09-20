import { useLocation, Link } from 'react-router-dom'
import { PageTitle, Empty } from '../components/Feedback'
import { Button } from '../components/ui/button'
const content: Record<string, [string, string, string]> = {
  '/signals': [
    'Signaux',
    'Phase 3',
    'Détection BUY / SELL / WAIT, conditions validées et statut de chaque signal.',
  ],
  '/strategies': [
    'Stratégies',
    'Phase 3',
    'Création de règles, paramètres, comparaison et validation hors échantillon.',
  ],
  '/paper-trading': [
    'Paper Trading',
    'Phase 4',
    'Compte fictif et ordres Market, Limit et Stop, soumis au Risk Engine.',
  ],
  '/portfolio': [
    'Portefeuille',
    'Phase 4',
    'Positions, cash, allocation et P&L réalisés et non réalisés.',
  ],
  '/risk': [
    'Gestion du risque',
    'Phase 4',
    'Limites déterministes, motifs de rejet et arrêt global des nouveaux ordres.',
  ],
  '/ai': [
    'AI Analyst',
    'Phase 5',
    'Explication des données et résultats par un fournisseur IA appelé exclusivement depuis le backend.',
  ],
  '/journal': [
    'Trading Journal',
    'Phase 4',
    'Traçabilité des transactions, règles de risque et décisions.',
  ],
}
export default function Future() {
  const path = useLocation().pathname
  const [title, phase, detail] = content[path] ?? [
    'Page introuvable',
    'Navigation',
    'Cette page n’existe pas.',
  ]
  return (
    <>
      <PageTitle eyebrow="FEUILLE DE ROUTE" title={title} description={phase} />
      <section className="panel">
        <Empty title="Une prochaine étape, clairement identifiée.">
          <p>{detail}</p>
          <p>
            Le périmètre actuel couvre Foundation et Market Data. Cette fonctionnalité n’est pas
            active.
          </p>
          <Button asChild variant="default">
            <Link to="/markets">Explorer les marchés →</Link>
          </Button>
        </Empty>
      </section>
    </>
  )
}
