// AboutWater Route Optimizer Service Worker
// Version 4.0.0

const CACHE_NAME = 'aboutwater-route-optimizer-v4.0.0'
const STATIC_CACHE_NAME = 'aboutwater-static-v4.0.0'
const DYNAMIC_CACHE_NAME = 'aboutwater-dynamic-v4.0.0'

// Files to cache immediately
const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/Background.jpg',
  // Add other static assets as needed
]

// API endpoints that can be cached
const CACHEABLE_APIS = [
  '/api/geocoding',
  '/api/addresses',
  // Add other cacheable API patterns
]

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  
  event.waitUntil(
    Promise.all([
      // Cache static files
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('[SW] Caching static files')
        return cache.addAll(STATIC_FILES)
      }),
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(cacheName => 
              cacheName.startsWith('aboutwater-') && 
              cacheName !== STATIC_CACHE_NAME && 
              cacheName !== DYNAMIC_CACHE_NAME
            )
            .map(cacheName => {
              console.log('[SW] Deleting old cache:', cacheName)
              return caches.delete(cacheName)
            })
        )
      }),
      // Take control immediately
      self.clients.claim()
    ])
  )
})

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) {
    return
  }

  // Handle different request types with appropriate strategies
  if (request.method === 'GET') {
    if (isStaticFile(url)) {
      // Static files: Cache First strategy
      event.respondWith(cacheFirst(request, STATIC_CACHE_NAME))
    } else if (isCacheableAPI(url)) {
      // API requests: Network First with cache fallback
      event.respondWith(networkFirst(request, DYNAMIC_CACHE_NAME))
    } else if (isNavigationRequest(request)) {
      // Navigation: Network First with offline fallback
      event.respondWith(handleNavigation(request))
    } else {
      // Other requests: Network First
      event.respondWith(networkFirst(request, DYNAMIC_CACHE_NAME))
    }
  }
})

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag)
  
  if (event.tag === 'background-sync-addresses') {
    event.waitUntil(syncAddresses())
  } else if (event.tag === 'background-sync-tours') {
    event.waitUntil(syncTours())
  }
})

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received')
  
  const options = {
    body: event.data ? event.data.text() : 'AboutWater Route Optimizer notification',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: 'aboutwater-notification',
    data: {
      url: '/'
    }
  }
  
  event.waitUntil(
    self.registration.showNotification('AboutWater Route Optimizer', options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked')
  
  event.notification.close()
  
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  )
})

// Helper functions

function isStaticFile(url) {
  const staticExtensions = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.eot']
  return staticExtensions.some(ext => url.pathname.endsWith(ext)) || url.pathname === '/'
}

function isCacheableAPI(url) {
  return CACHEABLE_APIS.some(pattern => url.pathname.startsWith(pattern))
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept').includes('text/html'))
}

// Cache First strategy - good for static assets
async function cacheFirst(request, cacheName) {
  try {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.log('[SW] Cache first failed:', error)
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
  }
}

// Network First strategy - good for dynamic content
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.log('[SW] Network first falling back to cache:', error)
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
  }
}

// Handle navigation requests with offline fallback
async function handleNavigation(request) {
  try {
    const networkResponse = await fetch(request)
    return networkResponse
  } catch (error) {
    console.log('[SW] Navigation offline, serving cached index')
    const cachedResponse = await caches.match('/index.html')
    return cachedResponse || new Response('App offline', { 
      status: 503, 
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/html' }
    })
  }
}

// Background sync functions
async function syncAddresses() {
  try {
    console.log('[SW] Syncing addresses in background')
    // Implementation would sync pending address changes
    // This is a placeholder for actual sync logic
    return Promise.resolve()
  } catch (error) {
    console.error('[SW] Address sync failed:', error)
    throw error
  }
}

async function syncTours() {
  try {
    console.log('[SW] Syncing tours in background')
    // Implementation would sync pending tour changes
    // This is a placeholder for actual sync logic
    return Promise.resolve()
  } catch (error) {
    console.error('[SW] Tour sync failed:', error)
    throw error
  }
}

// Periodic background sync (if supported)
if ('periodicSync' in self.registration) {
  self.addEventListener('periodicsync', (event) => {
    console.log('[SW] Periodic sync triggered:', event.tag)
    
    if (event.tag === 'content-sync') {
      event.waitUntil(performPeriodicSync())
    }
  })
}

async function performPeriodicSync() {
  try {
    console.log('[SW] Performing periodic sync')
    // Update cached data periodically
    await Promise.all([
      syncAddresses(),
      syncTours()
    ])
  } catch (error) {
    console.error('[SW] Periodic sync failed:', error)
  }
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data)
  
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
        self.skipWaiting()
        break
      case 'CACHE_URLS':
        event.waitUntil(cacheUrls(event.data.urls))
        break
      case 'CLEAR_CACHE':
        event.waitUntil(clearCaches())
        break
      default:
        console.log('[SW] Unknown message type:', event.data.type)
    }
  }
})

async function cacheUrls(urls) {
  const cache = await caches.open(DYNAMIC_CACHE_NAME)
  return cache.addAll(urls)
}

async function clearCaches() {
  const cacheNames = await caches.keys()
  return Promise.all(
    cacheNames
      .filter(name => name.startsWith('aboutwater-'))
      .map(name => caches.delete(name))
  )
}

console.log('[SW] Service Worker loaded successfully')