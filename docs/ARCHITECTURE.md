# Backend mimarisi ve veri modeli

Bu bağımsız repo Node/Worker API, Supabase entegrasyonu, ML modelleri ve yönetim araçlarını içerir. Frontend kendi reposunda geliştirilir ve yalnızca /api üzerinden iletişim kurar.

## İstek akışı

Frontend HTTP istemcisi → src/app.ts → modules/*/routes.ts → Supabase / harici sağlayıcı / yerel Random Forest. Oturum doğrulaması ve kullanıcı kimliği backend'de belirlenir. Normal CRUD ve dosyalar kullanıcı JWT'siyle PostgreSQL/Storage RLS kurallarını korur; service-role yalnızca yönetim/import için kullanılır.

## Repo düzeni

```text
src/server.ts         Yalnızca API sunan Node HTTP adaptörü
src/worker.ts         Bağımsız Worker; isteğe bağlı ASSETS binding'i
src/config/           Runtime ortam doğrulama
src/http/             Gövde sınırı, çerez, hata ve JSON
src/integrations/     Supabase client fabrikaları ve ilan adaptörleri
src/modules/          Auth, data, storage, internships, places, occupancy
packages/shared/src/  Bu repoda sürümlenmiş yerel tip/kural paketi
supabase/             Migrationlar ve katalog
ml/                   İsteğe bağlı Python eğitim araçları
scripts/              Yönetim araçları
tests/                API, RLS, kaynak, adaptör ve model testleri
docs/                 Kurulum ve sözleşmeler
dist/index.js         Üretilmiş Worker API
```

## Oturum ve güven sınırları

Access ve refresh tokenları Path=/api, HttpOnly, SameSite=Lax çerezleridir; HTTPS'te Secure eklenir. API yalnızca minimal user.id/email bilgisini döndürür. Tokenlar React state veya localStorage'a yazılmaz. Parola ve tokenlar loglanmaz. Her kullanıcı isteğinde getUser doğrulaması yapılır; geçersiz/süresi dolmuş JWT refresh token ile backend'de yenilenir. Geçici Auth servis hatasında oturum çerezleri silinmez.

PKCE verifier'ları ve akış indeksi ayrı HttpOnly çerezlerde tutulur. Akış kimliği callback'in sb_flow_id parametresiyle eşlenir; birden fazla bekleyen e-posta bağlantısı birbirini ezmez. Supabase SDK'nin tam oturum JSON'u yalnızca istek belleğinde tutulur. Callback yönlendirmesi sabit APP_ORIGIN kullanır. Sekmeler BroadcastChannel ile yalnızca oturum değişikliği sinyali paylaşır.

Yazma istekleri APP_ORIGIN ile tam eşleşen Origin başlığı gerektirir. CORS yalnızca aynı izinli origin'e credentials izni verir. API yanıtları no-store'dur. Tablo ve alan izin listeleri id, user_id, revision, kaynak alanları ve is_example gibi sunucu alanlarının istemci tarafından seçilmesini engeller. RLS ve veritabanı sütun yetkileri ikinci bağımsız denetim katmanıdır.

Dosyalar notes/listing-images özel depolarındadır. Backend PDF için 10 MB, görseller için 5 MB sınırı uygular; MIME türüne ek olarak dosya imzasını kontrol eder. Dosya yolu backend'de kullanıcı kimliği ve rastgele UUID ile üretilir. İndirme kullanıcının JWT'siyle yapılır; dosya görünürlüğünü Storage RLS belirler. Kalıcı herkese açık dosya URL'si üretilmez.

Staj toplama yalnızca doğrulanmış kullanıcı tarafından tetiklenir. Service-role yalnızca toplama/yönetim katmanında kullanılır. Sabit sağlayıcı listesi ve veritabanındaki atomik bir saatlik claim kilidi korunmuştur. Başarısız kaynak kontrolü mevcut ilanları kapatmaz.

Google haritasını çizmek için Maps JavaScript SDK tarayıcıda kalır. Mekan araması /api/places/nearby üzerinden backend'deki Places API (New) REST çağrısına gider. Tarayıcı Maps anahtarı ile backend Places anahtarı ayrı yapılandırılır. Sonuçlar kalıcı depolanmaz; sadece sayfa belleğinde gösterilir. İstek kategori/konum/yarıçapı sınırlıdır ve 15 saniye zaman aşımı vardır. Demo araması için bu uç herkese açıktır.

## Veri tablosu haritası

| Tablo | Görev ve temel ilişki |
|---|---|
| universities | Üniversite adı, kısa adı ve şehir |
| campuses | Üniversiteye bağlı kampüs ve kaynaklı referans koordinatı |
| courses | Üniversiteye bağlı ders etiketleri; demo kodlar resmi katalog değildir |
| profiles | Auth kullanıcısının özel profil kaydı |
| members | Paylaşımlarda gösterilen minimal ad; örnek yazarların oturumu yoktur |
| internships | Öğrenci, örnek veya harici kaynak ilanı; global/üniversite kapsamı |
| saved_internships | Kullanıcının kaydettiği ilanlar |
| posts / replies | Ders paylaşımı ve ona bağlı yanıtlar |
| listings | market, housing, roommate türlerini paylaşan ortak ilan modeli |
| budget_entries | Kullanıcıya özel gelir/gider; kuruş ve tarih |
| places / reviews | Öğrenci mekan önerisi ve kişi başına tek değerlendirme |
| clubs / club_events | Kulüp kataloğu ve etkinlikleri |
| club_follows | Kullanıcı takibi; resmi üyelik değildir |
| calendar_items | Özel sınav, teslim ve etkinlik tarihleri |
| notifications | Sahibine açık uygulama içi bildirim kayıtları |
| reminder_jobs | Revizyonlu e-posta görev kuyruğu hazırlığı |
| crowd_locations / crowd_reports | Kampüs alanı ve öğrencinin son durum bildirimi |
| ingestion_runs | Kaynak kontrol kilidi, sonuç, adet ve hata |

## Sayısal ve zamansal kurallar

Para tam sayı kuruş, saatli tarihler UTC'dir; arayüz Europe/Istanbul kullanır. Ortak saf kurallar packages/shared/src/domain.ts içindedir. Kritik girdiler API'de ve veritabanı kısıtlarıyla yeniden doğrulanır. Yoğunluk hesabı bir saatten eski ve gelecekteki kayıtları dışlar; her kişinin yalnızca son raporunu sayar.

## Hatalar ve yarış durumları

API hata biçimi {error:{code,message}} ve uygun HTTP durumudur. Servis sırları veya ham sağlayıcı hataları döndürülmez. Form başarısızken açık kalır. Store, epoch ve istek sırası ile önceki kullanıcının veya eski yenilemenin sonucunu dışlar. Oturum geçersizse özel veriler temizlenir. Harita aramaları da istek sırasını kontrol eder.

## Hatırlatmalar ve ölçek

Takvim revizyonu, önceki işi iptal etme, claim/lease ve idempotent payload SQL altyapısı korunmuştur. Gerçek e-posta gönderim işçisi henüz yoktur; e-posta tercihi varsayılan kapalıdır.

Veriler mevcut hackathon kapsamını korumak için toplu yenilenir. Büyüyen içerikte sayfalama ve modül bazlı yenileme eklenmelidir. Çoklu Node süreçleri/Worker isolate'ları arasında refresh eşgüdümü paylaşımlı değildir; Supabase token yeniden kullanım davranışı geçerlidir. Üretimde özellikle herkese açık Places ve hesap uçlarına reverse proxy/Cloudflare düzeyinde hız ve kota sınırları uygulanmalıdır. Periyodik staj toplama ayrıca zamanlayıcı gerektirir.

Kaynaklar: [Supabase server auth](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [Google Places REST](https://developers.google.com/maps/documentation/places/web-service/nearby-search).
Takvim değişikliği bir revizyon üretir. Önceki bekleyen iş iptal edilir; tamamlanan veya silinen tarih gönderime uygun değildir. Claim işlemi lease ve kilit kullanır. Gönderim payload’ı ilk hazırlamada sabitlenir; yeniden denemede farklı içerikle aynı idempotency anahtarının kullanılması önlenir.

Bu SQL altyapısı test edilmiştir ancak dış e-posta işçisi ve gerçek teslim testi bu sürümde yoktur. `sent` durumu yalnızca sağlayıcının doğrulanmış başarılı yanıtı sonrasında yazılmalıdır. Servis kurulmadan e-posta özelliği açık gösterilmemelidir.

## Ölçek sınırları

Hackathon ölçeğinde ortak tablolar toplu yenilenir. Çok sayıda kullanıcı için sunucu tarafı sayfalama, üniversiteye göre sorgu daraltma ve seçili tablo yenilemesi eklenmelidir. Şu an polling kullanılır; gerçek zamanlı abonelik zorunlu değildir. Google araması en fazla 20 sonuç döndürür ve kapsamlı bir şehir işletme envanteri sayılmaz.

Giriş ekranının servis kontrolü geçici hatalarda üç kez denenir; yine erişilemiyorsa kullanıcı form girdisini kaybetmeden yeniden deneyebilir. Bağlantı hatası veritabanı kesinlikle kurulmamış gibi yorumlanmaz.
