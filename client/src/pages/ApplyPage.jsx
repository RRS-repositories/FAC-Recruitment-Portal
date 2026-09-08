import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { ApplicationFlow } from '@/features/application/ApplicationFlow';
import { getRole } from '@/data/roles';
import usePageMeta from '@/hooks/usePageMeta';
import NotFoundPage from '@/pages/NotFoundPage';

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

  // A slug that is not a role is a wrong address, not a reason to show the
  // home page.
  if (!role) return <NotFoundPage />;

  return (
    <AppShell>
      <div className="px-5 py-10 sm:px-8">
        <ApplicationFlow role={role} onExit={() => navigate(`/recruitment/${role.key}`)} />
      </div>
    </AppShell>
  );
}

export default ApplyPage;
