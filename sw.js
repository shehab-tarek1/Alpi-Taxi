const CACHE_NAME = 'taxi-alpgo-v1.0.0';

// الملفات الأساسية التي نريد توفرها Offline
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/manifest.json'
];

// ======================================================
// INSTALL
// ======================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        // لا نجعل فشل ملف واحد يمنع تثبيت Service Worker بالكامل
        await Promise.allSettled(
          PRECACHE_ASSETS.map(async (asset) => {
            try {
              await cache.add(asset);
            } catch (error) {
              console.warn(
                `[Taxi AlpGo] Failed to cache: ${asset}`,
                error
              );
            }
          })
        );
      })
      .then(() => self.skipWaiting())
  );
});


// ======================================================
// ACTIVATE
// ======================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log(
                `[Taxi AlpGo] Deleting old cache: ${cacheName}`
              );

              return caches.delete(cacheName);
            }

            return null;
          })
        );
      })
      .then(() => self.clients.claim())
  );
});


// ======================================================
// FETCH
// ======================================================
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // --------------------------------------------------
  // نتعامل فقط مع GET
  // --------------------------------------------------
  if (request.method !== 'GET') {
    return;
  }


  // --------------------------------------------------
  // Firebase / Firestore / Authentication
  // لا نقوم بعمل Cache لهذه الطلبات
  // --------------------------------------------------
  const isFirebaseRequest =
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('firebaseapp.com');

  if (isFirebaseRequest) {
    return;
  }


  // --------------------------------------------------
  // API Requests
  // لا نخزن الـ API responses بشكل عام
  // --------------------------------------------------
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/api')
  ) {
    return;
  }


  // --------------------------------------------------
  // Cloudinary Images
  // Network First
  // إذا الإنترنت موجود → آخر صورة
  // إذا Offline → Cache
  // --------------------------------------------------
  const isCloudinary =
    url.hostname === 'res.cloudinary.com';

  if (isCloudinary) {
    event.respondWith(
      fetch(request)
        .then((response) => {

          if (response && response.ok) {
            const responseClone = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseClone);
              })
              .catch(() => {});
          }

          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );

    return;
  }


  // --------------------------------------------------
  // HTML Pages
  // Network First
  // --------------------------------------------------
  if (
    request.destination === 'document' ||
    request.headers.get('accept')?.includes('text/html')
  ) {

    event.respondWith(
      fetch(request)
        .then((response) => {

          if (response && response.ok) {
            const responseClone = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseClone);
              })
              .catch(() => {});
          }

          return response;
        })
        .catch(async () => {

          // حاول إرجاع نفس الصفحة من الكاش
          const cachedPage = await caches.match(request);

          if (cachedPage) {
            return cachedPage;
          }

          // إذا لم توجد الصفحة، ارجع index.html
          const offlinePage = await caches.match('/index.html');

          if (offlinePage) {
            return offlinePage;
          }

          return new Response(
            `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport"
                content="width=device-width, initial-scale=1.0">
              <title>Taxi AlpGo</title>
              <style>
                body {
                  font-family: Arial, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                  margin: 0;
                  text-align: center;
                  padding: 20px;
                }

                .box {
                  max-width: 400px;
                }

                h1 {
                  margin-bottom: 10px;
                }

                p {
                  color: #666;
                  line-height: 1.6;
                }
              </style>
            </head>

            <body>
              <div class="box">
                <h1>Taxi AlpGo</h1>
                <p>
                  You are currently offline.
                  Please check your internet connection
                  and try again.
                </p>
              </div>
            </body>
            </html>
            `,
            {
              headers: {
                'Content-Type': 'text/html; charset=utf-8'
              }
            }
          );
        })
    );

    return;
  }


  // --------------------------------------------------
  // Static Files
  // JS / CSS / Fonts / Images
  // Network First + Cache Fallback
  // --------------------------------------------------
  event.respondWith(
    fetch(request)
      .then((response) => {

        if (
          response &&
          response.ok &&
          response.status === 200
        ) {

          const responseClone = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(request, responseClone);
            })
            .catch(() => {});
        }

        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});


// ======================================================
// MESSAGE
// يسمح بتحديث Service Worker يدويًا من الموقع
// ======================================================
self.addEventListener('message', (event) => {

  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }

});