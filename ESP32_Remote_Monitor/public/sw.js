// Service Worker pour Green House Controller
const CACHE_NAME = 'thegreenhouse-iot-v1';
const FILES_TO_CACHE = [
  './',
  './app-pro.html',
  './controller.html',
  './manifest.json',
  './ultra-simple.html',
  './html-pur.html'
];

// Installation
self.addEventListener('install', function(event) {
  console.log('Service Worker: Installation');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Service Worker: Mise en cache des fichiers');
        return cache.addAll(FILES_TO_CACHE);
      })
      .then(function() {
        console.log('Service Worker: Installation terminée');
        return self.skipWaiting();
      })
      .catch(function(error) {
        console.error('Service Worker: Erreur installation', error);
      })
  );
});

// Activation
self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activation');
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (cacheName !== CACHE_NAME) {
              console.log('Service Worker: Suppression ancien cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(function() {
        console.log('Service Worker: Activation terminée');
        return self.clients.claim();
      })
  );
});

// Interception des requêtes
self.addEventListener('fetch', function(event) {
  // Ignorer les requêtes externes (MQTT, etc.)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Si la requête réussit, mettre en cache une copie
        if (response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(event.request, responseClone);
            });
        }
        return response;
      })
      .catch(function(error) {
        console.log('Service Worker: Échec réseau, recherche en cache');
        return caches.match(event.request)
          .then(function(response) {
            if (response) {
              return response;
            }
            // Si pas de cache, retourner une réponse par défaut
            if (event.request.destination === 'document') {
              return caches.match('./app-pro.html');
            }
          });
      })
  );
});