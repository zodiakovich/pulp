'use client';
import { useState, useRef, useEffect, type CSSProperties, type MouseEvent } from 'react';

export interface SelectOption { label: string; value: string }

export interface CustomSelectProps {
  value: string | number;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  style?: CSSProperties;
  onClick?: (e: MouseEvent) => void;
}

export function CustomSelect({ value, onChange, options, className, style, onClick }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const strValue = String(value);
  const selected = options.find(o => String(o.value) === strValue);

  useEffect(() => {
    if (!open) return;
    function onDown(e: globalThis.MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={className}
      style={{ position: 'relative', display: 'block', ...style }}
    >
      <button
        type="button"
        onClick={e => { onClick?.(e); setOpen(o => !o); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          width: '100%',
          background: '#111118',
          border: open ? '1px solid rgba(255,109,63,0.5)' : '1px solid #1A1A2E',
          borderRadius: 8,
          padding: '7px 10px',
          color: '#ffffff',
          fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
          fontSize: 'inherit',
          cursor: 'pointer',
          outline: 'none',
          textAlign: 'left',
          transition: 'border-color 180ms',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
          {selected?.label ?? strValue}
        </span>
        <svg
          width="10" height="6" viewBox="0 0 10 6" fill="none"
          style={{ flexShrink: 0, transition: 'transform 180ms', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path d="M1 1l4 4 4-4" stroke="#8A8A9A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            minWidth: '100%',
            background: '#111118',
            border: '1px solid #1A1A2E',
            borderRadius: 8,
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            zIndex: 9999,
            listStyle: 'none',
            margin: 0,
            padding: '4px 0',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {options.map(o => {
            const isActive = String(o.value) === strValue;
            return (
              <li
                key={o.value}
                onMouseDown={e => { e.preventDefault(); onChange(o.value); setOpen(false); }}
                style={{
                  padding: '7px 12px',
                  cursor: 'pointer',
                  fontFamily: 'DM Sans, system-ui, Segoe UI, sans-serif',
                  fontSize: 'inherit',
                  color: isActive ? '#FF6D3F' : '#ffffff',
                  background: 'transparent',
                  transition: 'background 120ms',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLLIElement).style.background = '#1A1A2E'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLLIElement).style.background = 'transparent'; }}
              >
                {o.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
