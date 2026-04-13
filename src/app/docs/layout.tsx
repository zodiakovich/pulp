import { Navbar } from '@/components/Navbar';
import { DocsNav } from '@/components/docs/DocsNav';

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Navbar active="create" />
      <div className="mx-auto flex max-w-[1120px] flex-col md:flex-row md:items-start md:gap-0 md:px-8">
        <DocsNav />
        <main className="min-w-0 flex-1 px-4 pb-20 pt-6 md:border-l md:px-10 md:py-12" style={{ borderColor: 'var(--border)' }}>
          <div className="mx-auto w-full" style={{ maxWidth: 720 }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
