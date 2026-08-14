const CACHE_NAME = 'taxi-alpgo-v1.0.2';

// 1. الملفات الأساسية المسبقة التخزين
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://res.cloudinary.com/dsxrjmcxs/image/upload/c_limit,w_400,q_auto,f_auto/v1786716325/ecuwdts2f0797fnddg4z.png',
  'https://res.cloudinary.com/dsxrjmcxs/image/upload/c_limit,w_400,q_auto,f_auto/v1786716414/bl2wzjvwiuocspelj562.png',
  'https://res.cloudinary.com/dsxrjmcxs/image/upload/c_limit,w_400,q_auto,f_auto/v1786716372/yuprjfnexjrfqwszemfo.png',
  'https://res.cloudinary.com/dsxrjmcxs/image/upload/c_limit,w_1000,q_auto,f_auto/v1786738438/lpvcfoqx38rsydftoeht.jpg'
];

// ======================================================
// INSTALL: تثبيت الملفات وتخطي الانتظار
// ======================================================
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map((asset) => cache.add(asset).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ======================================================
// ACTIVATE: تنظيف أي كاش قديم لتجنب تعليق البيانات القديمة
// ======================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Taxi AlpGo] Deleting outdated cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ======================================================
// FETCH: توجيه ذكي وسريع بدون أي بطء
// ======================================================
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // التعامل فقط مع طلبات GET والروابط المدعومة
  if (request.method !== 'GET' || !request.url.startsWith('http')) {
    return;
  }

  const url = new URL(request.url);

  // 1. استثناء Firebase و Firestore و APIs تماماً (لتجنب تعليق البيانات القديمة)
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.pathname.startsWith('/api/') ||
    url.pathname.includes('/api')
  ) {
    return;
  }

  // 2. الصور (Cloudinary / Unsplash / Pexels): كاش سريع جداً (Cache-First + Background Refresh)
  const isImage = 
    request.destination === 'image' || 
    url.hostname.includes('cloudinary.com') || 
    url.hostname.includes('unsplash.com') ||
    url.hostname.includes('pexels.com');

  if (isImage) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // جلب النسخة المحدثة في الخلفية بدون تعطيل المستخدم
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          }).catch(() => {});
          return cachedResponse; // إرجاع الصورة فوراً في 0 ثانية
        }

        // إذا لم تكن في الكاش يتم جلبها وحفظها
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. صفحات الـ HTML: (Network-First لضمان رؤية أحدث التعديلات فوراً مع دعم الأوفلاين)
  if (request.mode === 'navigate' || request.destination === 'document' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedPage) => {
            return cachedPage || caches.match('/index.html');
          });
        })
    );
    return;
  }

  // 4. باقي الملفات الثابتة (CSS, JS, Fonts)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      return cachedResponse || fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      });
    })
  );
});

// استقبال رسالة التحديث الفوري
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});