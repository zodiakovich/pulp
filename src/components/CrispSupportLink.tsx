'use client';

export function CrispSupportLink({
  label = 'Support',
  className,
  style,
}: {
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      className={className}
      style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', ...style }}
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

