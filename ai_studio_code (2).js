const CACHE_NAME = 'alpi-taxi-v1.0.1';

// الملفات الأساسية التي يتم تخزينها فوراً
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/admin.html',
  '/manifest.json',
  'https://res.cloudinary.com/dsxrjmcxs/image/upload/c_limit,w_400,q_auto,f_auto/v1786716325/ecuwdts2f0797fnddg4z.png',
  'https://res.cloudinary.com/dsxrjmcxs/image/upload/c_limit,w_400,q_auto,f_auto/v1786716414/bl2wzjvwiuocspelj562.png',
  'https://res.cloudinary.com/dsxrjmcxs/image/upload/c_limit,w_400,q_auto,f_auto/v1786716372/yuprjfnexjrfqwszemfo.png',
  'https://res.cloudinary.com/dsxrjmcxs/image/upload/c_limit,w_400,q_auto,f_auto/v1786716753/hj9i0elyweeojw1jlahn.png'
];

// مرحلة التثبيت وتخزين الملفات
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// مرحلة التفعيل وحذف النسخ القديمة من الكاش
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// استراتيجية التعامل مع الطلبات (Network First مع الرجوع للكاش في حال انقطاع الشبكة)
self.addEventListener('fetch', (event) => {
  // لا تقم بعمل كاش لطلبات Firestore أو Firebase Auth الداخلية
  if (event.request.url.includes('firestore.googleapis.com') || 
      event.request.url.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // إذا كان الرد سليم نقوم بنسخه في الكاش
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // في حال عدم توفر إنترنت يتم إرجاع النسخة المخزنة
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // إذا كان الطلب لصفحة HTML نرجع الصفحة الرئيسية
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('/index.html');
          }
        });
      })
  );
});