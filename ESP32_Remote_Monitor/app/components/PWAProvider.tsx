'use client';

import { usePWA, PWAInstallPrompt } from '../hooks/usePWA';

export function PWAProvider({ children }: { children: React.ReactNode }) {
  usePWA();
  
  return (
    <>
      {children}
      <PWAInstallPrompt />
    </>
  );
}