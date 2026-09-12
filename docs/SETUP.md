# Kurulum ve Supabase

## Yerel geliştirme

Node.js 24 önerilir (en az 22.17). Bu bağımsız backend reposunun kökünde `npm ci` çalıştır; `.env.example` dosyasını `.env.local` olarak kopyala. Supabase ve Google Places sunucu anahtarları burada tutulur. Frontend kendi reposunda ayrı kurulur ve başlatılır.

`npm run dev` yalnızca API'yi http://127.0.0.1:3001 adresinde açar. Varsayılan `APP_ORIGIN=http://127.0.0.1:5173` frontend adresidir. Frontend Vite proxy'si /api isteklerini bu API'ye aktarır. Üretimde frontend origin'indeki /api yolu reverse proxy ile backend'e yönlendirilmelidir.

```dotenv
PORT=3001
HOST=127.0.0.1
APP_ORIGIN=http://127.0.0.1:5173
NODE_ENV=development
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SECRET
GOOGLE_PLACES_API_KEY=YOUR_SERVER_PLACES_KEY
```

`SUPABASE_ANON_KEY` publishable anahtara alternatif olarak desteklenir. Normal kullanıcı istekleri kullanıcı JWT'siyle RLS kurallarını korur; service-role yalnızca import/yönetim içindir. `npm test`, `npm run lint` ve `npm run build` bu repo içinde çalışır.

APP_ORIGIN tam origin olmalı; sonunda / bulunmamalı. localhost ve 127.0.0.1 farklıdır. Port/adres değişirse APP_ORIGIN, frontend proxy hedefi ve Supabase callback izinlerini birlikte güncelle. Ortam değiştiğinde backend'i yeniden başlat.

## Veritabanı

Yeni Supabase projesinde sırasıyla uygula:

1. supabase/migrations/202609120001_core.sql
2. supabase/migrations/202609120002_discovery.sql
3. supabase/migrations/202609120003_campus_discovery.sql
4. supabase/seed-catalog.sql

npm run db:prepare tüm migrationları ve katalog seed'ini .artifacts/install-supabase.sql içinde birleştirir. Bu dosya boş proje içindir; kurulu projede çekirdek migrationları tekrar çalıştırma. Katalog seed'i tekrar çalıştırılabilir. Schema/RLS değiştirilmedi; frontend/backend ayrımı yeni bir migration gerektirmez.

GET /api/health configured ve databaseReady durumunu döndürür; ikinci değer public.app_status RPC'sinden gelir. SMTP veya Google hazırlığını kanıtlamaz.

## Auth dönüş adresleri

Supabase Authentication → URL Configuration: Site URL uygulamanın kök adresi, Redirect URLs ise backend callback'i olmalı. SDK akış kimliği query parametresi eklediği için sadece callback yoluna ait query desenini izin listesine ekle:

```text
http://127.0.0.1:5173/api/auth/callback**
https://YOUR_SITE/api/auth/callback**
```

Callback kodu backend'de HttpOnly PKCE verifier çerezleriyle tek sefer tüketilir. Kayıt doğrulaması /#/app, kurtarma /#/sifre-yenile yoluna döner. Bağlantıyı işlemi başlattığın tarayıcıda aç. Başka bir tarayıcı PKCE verifier'ına sahip değildir. Eski doğrudan Supabase tarayıcı oturumları taşınmaz; geçişten sonra yeniden giriş yapılır.

## E-posta ve SMTP

Normal kayıtlar için e-posta doğrulamasını açık bırak. Supabase varsayılan e-posta hizmeti geniş kullanıcı dağıtımı için uygun değildir; kotaları ve alıcı kısıtları vardır. Authentication içindeki SMTP ayarlarına doğrulanmış gönderici sağlayıcını bağla. Resend kullanılacaksa önce alan adının DNS kayıtlarını doğrula, ardından sağlayıcının güncel SMTP bilgilerini gir.

Mevcut sürümde gerçek e-posta hatırlatma işçisi yoktur. `reminder_jobs` ve ilişkili SQL fonksiyonları yalnızca altyapı hazırlığıdır. `VITE_EMAIL_REMINDERS_ENABLED=true` değerini gönderim işçisi, zamanlanmış görev ve gerçek teslim testi tamamlanmadan kullanma. SMTP, hesap doğrulaması ve parola sıfırlama içindir; kişisel tarih hatırlatma işçisi ayrıca gerekir.

## Dosyalar

`notes` ve `listing-images` bucket’ları özeldir. PDF limiti 10 MB, JPEG/PNG/WebP limiti 5 MB’dır. Yol biçimi kullanıcı kimliği ile başlar. İstemci doğrulaması hızlı geri bildirim verir; backend boyut/MIME/dosya imzasını yeniden denetler; RLS politikaları ve bucket limitleri ayrıca uygulanır.

Not dosyası, ilişkili yayınlanmış paylaşımı okuyabilen oturuma açılır. Paylaşıma bağlanmamış dosya başka hesaplara açık değildir. Özel dosyalar için kalıcı herkese açık URL yerine oturumla indirme kullanılır. Kullanıcı iletişim e-postası kendi yazdığı ilan alanından alınır; hesap e-postası otomatik eklenmez.

## Örnek içerik

`npm run seed:examples`, ortak örnek kayıtları sabit kimliklerle upsert eder. Kullanıcıların gerçek kayıtlarını silmez. Örnek tarihleri prova gününe göre yenileyebilir. Google sonuçlarını veritabanına kopyalamaz, gerçek yoğunluk tablosuna yapay rapor göndermez, normal hesaplara bütçe/takvim doldurmaz.

`npm run demo:create`, ayrı bir gerçek demo hesabı ve ona özel bütçe/takvim kayıtları oluşturur. `.artifacts/demo-account.json` mevcutsa aynı hesabı kullanır. Dosyayı silmek uzak hesabı silmez. Script sonuçları normal kullanıcı oturumu açarak kontrol eder. Demo şifresi Git dışında tutulur.

## Üretim ve yayın

`npm run build` TypeScript kontrolü yapar ve bağımsız Worker API için `dist/index.js` üretir. Node API için Node.js 24, `npm ci`, runtime ortam değişkenleri ve `npm start` yeterlidir. Node adaptörü yalnızca API sunar; frontend dosyalarını okumaz.

`NODE_ENV=production`, `APP_ORIGIN=https://YOUR_FRONTEND` ve uygun HOST/PORT değerlerini ayarla. HTTPS reverse proxy, frontend origin'indeki /api yolunu backend'e aktarmalıdır. Supabase Auth callback yolu da aynı proxy üzerinden çalışır. HttpOnly/Secure/SameSite=Lax çerezleri ve Origin doğrulaması korunur.

Worker, ASSETS binding'i olmadan bağımsız API olarak çalışır; diğer yollar 404 döner. İsteğe bağlı ASSETS binding'i verilirse platformun statik dosya sunumuna delege eder. Sites birleştirme ve kayıtlı proje manifesti üst çalışma klasöründeki araçlarla yönetilir; bu repo onları import etmez.

Frontend'in derleme değerleri ile backend'in runtime sırları ayrı tutulur. Farklı siteler arasında SameSite=Lax çerezleri gönderilmez; önerilen üretim bağlantısı frontend origin'indeki /api reverse proxy'sidir.

## Sorun giderme

| Sorun | Kontrol |
|---|---|
| Giriş kurulum bekliyor | Backend çalışıyor mu, /api/health, Supabase URL/key, app_status |
| 403 Origin/CSRF | APP_ORIGIN ile tarayıcı origin'i birebir eşleşmeli |
| Doğrulama/kurtarma bağlantısı | Callback izin deseni, PKCE başlatan tarayıcı, APP_ORIGIN |
| Dosya açılamıyor | Geçerli oturum, görünür paylaşım ve Storage RLS |
| Maps çizilmiyor | Frontend browser key, referrer ve Maps JavaScript API |
| Mekan araması yapılandırılmadı | Backend GOOGLE_PLACES_API_KEY ve Places API (New) |
| Staj yenilenmiyor | Service-role, ingestion_runs ve bir saatlik claim kilidi |

Kaynaklar: [Supabase redirect izinleri](https://supabase.com/docs/guides/auth/redirect-urls), [Server Auth](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
