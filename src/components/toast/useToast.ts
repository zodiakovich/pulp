'use client';

import { useContext } from 'react';
import { ToastContext, type ToastAPI } from './ToastProvider';

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within <ToastProvider />');
  }
  return ctx;
}

