'use client';

import { useEffect } from 'react';

export function usePWA() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production'
    ) {
      const registerSW = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('[PWA] Service Worker enregistré:', registration);
          
          // Écouter les mises à jour
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] Nouvelle version disponible');
                  // Optionnel: notifier l'utilisateur d'une mise à jour
                }
              });
            }
          });
          
        } catch (error) {
          console.error('[PWA] Erreur enregistrement Service Worker:', error);
        }
      };
      
      registerSW();
    }
  }, []);
}

export function PWAInstallPrompt() {
  useEffect(() => {
    let deferredPrompt: any;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      console.log('[PWA] Prompt d\'installation disponible');
    };

    const handleAppInstalled = () => {
      console.log('[PWA] Application installée');
      deferredPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  return null;
}