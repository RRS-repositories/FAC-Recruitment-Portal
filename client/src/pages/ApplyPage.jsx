import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ApplicationFlow } from '@/features/application/ApplicationFlow';
import { getRole } from '@/data/roles';
import usePageMeta from '@/hooks/usePageMeta';

export function ApplyPage() {
  const { roleKey } = useParams();
  const navigate = useNavigate();
  const role = getRole(roleKey);

  usePageMeta({
    title: role ? `Apply — ${role.title}` : 'Apply',
    description: 'Apply for a paralegal role with Fast Action Claims.',
    // An application form has nothing to offer a search engine, and indexing it
    // would put a half-finished form ahead of the role page it belongs to.
    robots: 'noindex, nofollow',
  });

  if (!role) return <Navigate to="/" replace />;

  return (
    <AppShell>
      <div className="px-5 py-10 sm:px-8">
        <ApplicationFlow role={role} onExit={() => navigate(`/${role.key}`)} />
      </div>
    </AppShell>
  );
}

export default ApplyPage;
