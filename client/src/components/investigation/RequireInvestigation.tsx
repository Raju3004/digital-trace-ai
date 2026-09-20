import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FolderSearch } from 'lucide-react';
import { EmptyState } from '../ui';
import { useApp } from '../../context/AppContext';
import type { Investigation } from '../../types';

/**
 * Guards the analysis views. Rather than rendering a broken page when no
 * investigation is loaded, it explains the state and offers the next step.
 */
export function RequireInvestigation({
  children,
}: {
  children: (inv: Investigation) => ReactNode;
}) {
  const { investigation } = useApp();

  if (!investigation) {
    return (
      <EmptyState
        icon={<FolderSearch size={20} />}
        title="No active investigation"
        message="Start a new investigation from an authorized photograph and known context, or open a completed one from the Investigations list."
        action={
          <div className="flex gap-2">
            <Link to="/new" className="btn-primary">
              Start new investigation
            </Link>
            <Link to="/investigations" className="btn-ghost">
              Open existing
            </Link>
          </div>
        }
      />
    );
  }

  if (investigation.status === 'created') {
    return (
      <EmptyState
        icon={<FolderSearch size={20} />}
        title="Analysis not run yet"
        message="This investigation has been created but not analyzed. Run the analysis to populate candidates, evidence and the relationship graph."
        action={
          <Link to={`/processing/${investigation.id}`} className="btn-primary">
            Run analysis
          </Link>
        }
      />
    );
  }

  return <>{children(investigation)}</>;
}
