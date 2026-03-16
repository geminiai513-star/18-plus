const CACHE_NAME = 'my-projek-v12';
const RUNTIME_CACHE = 'my-projek-runtime-cache';

const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './icon/icon.png',
    './icon/icon-512.png',
    './icon/icon-192.png',
    './icon/pdf-file-icon.svg',
    './icon/docx-file-icon.svg',
    './icon/excel-file-icon.svg',
    './icon/ppt-file-icon.svg',
    './icon/txt-file-icon.svg',
    './icon/image-file-icon.svg',
    './icon/default-file-icon.svg',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js',
    'https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    'https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.allSettled(
                ASSETS_TO_CACHE.map((url) => {
                    return fetch(url).then((res) => {
                        if (res.ok || res.type === 'opaque') {
                            return cache.put(url, res);
                        }
                    }).catch((err) => {
                        console.error('Failed to cache during install:', url, err);
                    });
                })
            );
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. STRATEGI NETWORK-FIRST UNTUK API SUPABASE (TERMASUK AUTH)
    if (url.href.includes('supabase.co')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Hanya cache response yang sukses
                    if (response && response.status === 200 && event.request.method === 'GET') {
                        const responseClone = response.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request).then(cachedResponse => {
                        if (cachedResponse) return cachedResponse;
                        // Lempar error jika tidak ada cache, sehingga aplikasi bisa menangkapnya sebagai offline
                        throw new Error('No cache available');
                    });
                })
        );
        return;
    }

    // 2. STRATEGI STALE-WHILE-REVALIDATE / CACHE-FIRST UNTUK STATIC ASSETS
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Dinamis caching: simpan respons baru ke cache jika valid (mencakup font woff2, script dll)
                if (networkResponse && (networkResponse.ok || networkResponse.type === 'opaque')) {
                    const responseClone = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        // Jangan cache request POST atau skema non-http
                        if (event.request.method === 'GET' && event.request.url.startsWith('http')) {
                            cache.put(event.request, responseClone);
                        }
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Abaikan error fetch jika sedang offline
            });

            return cachedResponse || fetchPromise.then(res => {
                if (!res && event.request.mode === 'navigate') {
                    return caches.match('./index.html', { ignoreSearch: true });
                }
                return res;
            }).catch(() => {
                // Saat benar-benar offline dan fetchPromise gagal
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html', { ignoreSearch: true });
                }
                return caches.match(event.request, { ignoreSearch: true });
            });
        })
    );
});
