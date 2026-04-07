import { Skeleton, SkeletonButton, SkeletonText } from '@/components/Skeleton';

export default function GenerationLoading() {
  return (
    <div className="min-h-screen px-8 pt-24 pb-16">
      <div className="max-w-[860px] mx-auto">
        <div className="flex items-start justify-between gap-6 flex-wrap">
          <div className="min-w-0 flex-1">
            <Skeleton style={{ height: 12, width: 120, marginBottom: 12, borderRadius: 4 }} />
            <Skeleton style={{ height: 40, width: 'min(100%, 520px)', marginBottom: 16, borderRadius: 8 }} />
            <div className="flex flex-wrap gap-2">
              <Skeleton style={{ height: 28, width: 96, borderRadius: 6 }} />
              <Skeleton style={{ height: 28, width: 80, borderRadius: 6 }} />
              <Skeleton style={{ height: 28, width: 140, borderRadius: 6 }} />
            </div>
          </div>
          <SkeletonButton style={{ width: 96, height: 44, borderRadius: 12 }} />
        </div>

        <div className="mt-8 rounded-2xl p-6" style={{ background: '#111118', border: '1px solid #1A1A2E' }}>
          <Skeleton style={{ height: 12, width: 200, marginBottom: 12, borderRadius: 4 }} />
          <div className="flex gap-2 flex-wrap">
            <Skeleton style={{ height: 20, width: 40, borderRadius: 4 }} />
            <Skeleton style={{ height: 20, width: 32, borderRadius: 4 }} />
            <Skeleton style={{ height: 20, width: 36, borderRadius: 4 }} />
            <Skeleton style={{ height: 20, width: 44, borderRadius: 4 }} />
          </div>
        </div>

        <div className="mt-4 rounded-2xl p-6" style={{ background: '#0D0D12', border: '1px solid #1A1A2E' }}>
          <SkeletonText lines={2} lastLineWidth="70%" />
        </div>
      </div>
    </div>
  );
}
