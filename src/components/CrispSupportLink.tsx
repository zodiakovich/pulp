'use client';

export function CrispSupportLink({
  label = 'Support',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
      onClick={() => {
        try {
          window.$crisp?.push(['do', 'chat:show']);
          window.$crisp?.push(['do', 'chat:open']);
        } catch {
          // ignore
        }
      }}
    >
      {label}
    </button>
  );
}

