/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Configuration du répertoire racine pour Turbopack
  turbopack: {
    root: __dirname,
  },
  
  // Rewrites supprimés car nous utilisons MQTT maintenant
  // async rewrites() {
  //   return [
  //     {
  //       source: '/api/esp32/:path*',
  //       destination: process.env.ESP32_URL + '/:path*', // Proxy vers l'ESP32
  //     },
  //   ]
  // },
  
  // Configuration TypeScript stricte
  typescript: {
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig