# Backend API

API kökü `/api`. Frontend `credentials: include` kullanır. Access/refresh tokenları HttpOnly çerezlerdir; yanıt gövdelerinde veya tarayıcı depolamasında bulunmaz. Tüm yazma istekleri `APP_ORIGIN` ile eşleşen `Origin` başlığı gerektirir. JSON uçlarında `Content-Type: application/json` kullanılır.

| Yöntem | Yol | Erişim ve davranış |
|---|---|---|
| GET | /health | Supabase yapılandırması ve şema hazırlığı |
| GET | /auth/session | Minimal kullanıcı oturumu veya null; gerektiğinde çerez yeniler |
| POST | /auth/login | `{email,password}`; oturum çerezlerini oluşturur |
| POST | /auth/signup | `{email,password}`; doğrulama e-postası ve PKCE |
| POST | /auth/reset | `{email}`; PKCE kurtarma bağlantısı |
| POST | /auth/password | Oturum gerektirir; `{password}` |
| POST | /auth/logout | Mevcut oturumu sonlandırır, çerezleri siler |
| GET | /auth/callback | Supabase `code`, isteğe bağlı `flow` ve `sb_flow_id`; sabit uygulama adresine döner |
| POST | /auth/exchange | Eski kök callback biçimi için `{code,flowId?}` uyumluluğu |
| GET | /public/internships | Yalnızca kamuya açık şirket kaynaklı stajlar; demo için |
| GET | /data | Oturum gerektirir; `{data,profile}`, RLS ile görünür veriler |
| PUT | /profile | Oturum gerektirir; `{display_name,university_id,department}` |
| POST | /records/:table | Oturum gerektirir; izinli alanlarla yeni kayıt; sahibi backend belirler |
| PATCH | /records/:table/:id | Oturum ve sahiplik gerektirir; izinli alanları günceller |
| DELETE | /records/:table/:id | Oturum ve sahiplik gerektirir |
| POST | /files/:bucket | Oturum gerektirir; ham dosya gövdesi ve gerçek MIME başlığı; `{path}` döner |
| GET | /files/:bucket?path=... | Oturum gerektirir; Storage RLS ile görünür dosyanın binary içeriği |
| POST | /internships/sync | Oturum gerektirir; sabit kaynaklardan import; `{sources}` |
| POST | /places/nearby | Demo dahil herkese açık; `{lat,lng,radius,category}`, sunucu Places anahtarı |
| GET | /occupancy/demo | Demo dahil herkese açık; test örnekleri, raporlar ve kaynaklı kapasiteler; model ağırlıkları içermez |
| POST | /occupancy/predict | Demo dahil herkese açık; `{timestamp,extraEntries?}`; backend'de mevcut an ve +60 dk çıkarımı |

CRUD izin listesi `src/modules/data/validation.ts` içindedir. Katalog, profiles ve reminder_jobs genel CRUD üzerinden değiştirilemez. Bildirimler yalnızca PATCH/read_at destekler. Mekan silme desteklenmez. `id`, `user_id`, `created_at`, `revision`, örnek etiketi ve ithal kaynak alanları API gövdesinden kabul edilmez. RLS ve sütun yetkileri ayrıca uygulanır.

Dosya depoları `notes` (PDF, en fazla 10 MB) ve `listing-images` (JPEG/PNG/WebP, en fazla 5 MB). Backend hem dosya boyutunu hem MIME/imzayı denetler. Dosya yolları kullanıcı UUID'si altında backend'in ürettiği UUID dosya adlarıdır. JSON gövdeleri en fazla 64 KB'dır.

Mekan araması yalnızca cafe/restaurant/library, geçerli koordinatlar ve 500–5000 metre yarıçap kabul eder. En fazla 20 sonuç gelir; bilinmeyen fiyat/puan null kalır. Google sonuçları kalıcı saklanmaz. Üretimde bu herkese açık uç için ağ geçidinde hız/kota sınırı yapılandır.

Yoğunluk tahmini yalnızca demo yanıtındaki kayıt saatlerini (`YYYY-MM-DDTHH:mm:ss`) ve 0–10.000 arasında tam sayı `extraEntries` kabul eder. Varsayılan ek giriş 0'dır. Yanıt `{timestamp,extraEntries,features,nowEstimate,futureEstimate,forecastTime}` biçimindedir. Gelecek saat için test verisi yoksa son iki alan `null` olur. Ham giriş dizileri, kişi sayımları ve başka alanlar girdi olarak kabul edilmez. Supabase veya Python kurulumu gerektirmez. Bu tarihsel ofis veri demosudur; canlı kampüs tahmini değildir. Ayrıntılar [ML rehberinde](ML.md).

Hata biçimi:

```json
{"error":{"code":"UNAUTHENTICATED","message":"İşlemi yapmak için hesabına giriş yap."}}
```

Başlıca HTTP durumları: 400 geçersiz girdi, 401 oturum yok, 403 origin/yetki/izin listesi, 404 görünür kayıt yok, 409 tekrar kayıt, 413 boyut sınırı, 415 dosya veya gövde türü, 429 hesap deneme limiti, 502 sağlayıcı hatası, 503 eksik ortam ayarı. API yanıtları `Cache-Control: no-store` taşır.
