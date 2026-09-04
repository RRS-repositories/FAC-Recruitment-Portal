import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { ROLES } from '@/data/roles';
import usePageMeta from '@/hooks/usePageMeta';

export function NotFoundPage() {
  usePageMeta({ title: 'Page not found — Fast Action Claims Careers' });

  return (
    <AppShell>
      <div className="mx-auto max-w-xl px-5 py-24 text-center sm:px-8">
        <p className="text-[0.78rem] font-bold uppercase tracking-[0.12em] text-violet-deep">
          Error 404
        </p>
        <h1 className="mt-3 text-display-lg font-extrabold text-ink">
          That page has moved on.
        </h1>
        <p className="mt-4 text-[0.98rem] text-muted">
          The link you followed doesn&rsquo;t lead anywhere. Our open roles are below.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {Object.values(ROLES).map((role) => (
            <Button key={role.key} to={`/${role.key}`} variant="secondary">
              {role.short}
            </Button>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

export default NotFoundPage;
