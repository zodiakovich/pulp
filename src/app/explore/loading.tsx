import Link from 'next/link';
import { Skeleton, SkeletonButton, SkeletonCard } from '@/components/Skeleton';

export default function ExploreLoading() {
  return (
    <div className="min-h-screen" style={{ background: '#0A0A0F' }}>
      <nav
        className="fixed top-0 left-0 right-0 z-50"
        style={{ borderBottom: '1px solid #1A1A2E', background: 'rgba(10,10,15,0.85)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-[1280px] mx-auto px-8 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="text-gradient font-extrabold text-xl"
            style={{ fontFamily: 'Syne, sans-serif', textDecoration: 'none' }}
          >
            pulp
          </Link>
          <div className="flex items-center gap-8 text-sm" style={{ color: '#8A8A9A' }}>
            <Link href="/" className="transition-colors hover:text-white" style={{ textDecoration: 'none' }}>
              Create
            </Link>
            <span style={{ color: '#F0F0FF' }}>Explore</span>
            <Link href="/build" className="transition-colors hover:text-white" style={{ textDecoration: 'none' }}>
              Build
            </Link>
            <Link href="/pricing" className="transition-colors hover:text-white" style={{ textDecoration: 'none' }}>
              Pricing
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-[1280px] mx-auto px-8">
        <div
          className="mt-20 mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
          style={{ borderBottom: '1px solid #1A1A2E', paddingBottom: 16 }}
        >
          <div>
            <Skeleton style={{ height: 44, width: 200, marginBottom: 8, borderRadius: 8 }} />
            <Skeleton style={{ height: 14, width: 300, borderRadius: 4 }} />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton style={{ height: 12, width: 48, borderRadius: 4 }} />
            <SkeletonButton style={{ width: 140, height: 40, borderRadius: 12 }} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-16">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
