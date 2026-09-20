import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <EmptyState
      icon={<Compass size={20} />}
      title="Page not found"
      message="That route does not exist in this platform. Use the sidebar to get back to the investigation."
      action={
        <Link to="/" className="btn-primary">
          Back to dashboard
        </Link>
      }
    />
  );
}
