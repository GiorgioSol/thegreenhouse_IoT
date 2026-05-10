import './globals.css'
import type { Metadata, Viewport } from 'next'
import { PWAProvider } from './components/PWAProvider'

export const metadata: Metadata = {
  title: 'Green House Control',
  description: 'Contrôle à distance du système de culture ESP32',
  robots: 'noindex',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Green House',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        
        {/* PWA Meta Tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#10b981" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Green House" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        
        {/* PWA Icons */}
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
      </head>
      <body className="min-h-screen bg-gray-50">
        <PWAProvider>
          <div className="flex flex-col min-h-screen">
            <header className="bg-white shadow-sm border-b border-gray-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">🌱</span>
                    </div>
                    <h1 className="text-xl font-semibold text-gray-900">
                      Green House Control
                    </h1>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="hidden sm:flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-gray-600">En ligne</span>
                    </div>
                  </div>
                </div>
              </div>
            </header>
            
            <main className="flex-1 overflow-auto">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
              </div>
            </main>
            
            <footer className="bg-white border-t border-gray-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="flex justify-between items-center text-sm text-gray-600">
                  <div>
                    ESP32 Remote Monitor PWA v1.0.0
                  </div>
                  <div>
                    Dernière mise à jour: {new Date().toLocaleString('fr-FR')}
                  </div>
                </div>
              </div>
            </footer>
          </div>
        </PWAProvider>
      </body>
    </html>
  )
}