import Link from 'next/link';
import { Skeleton } from '@/components/Skeleton';
import { Navbar } from '@/components/Navbar';

export default function ExploreLoading() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Navbar active="explore" />

      <div className="max-w-[1280px] mx-auto px-8">
        <div
          className="mt-20 mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16 }}
        >
          <div>
            <Skeleton style={{ height: 44, width: 200, marginBottom: 8, borderRadius: 8 }} />
            <Skeleton style={{ height: 14, width: 300, borderRadius: 4 }} />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton style={{ height: 12, width: 48, borderRadius: 8 }} />
            <Skeleton style={{ width: 140, height: 40, borderRadius: 12 }} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-16">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton
              key={i}
              style={{
                height: 140,
                borderRadius: 16,
                border: '1px solid var(--border)',
                background: 'transparent',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
