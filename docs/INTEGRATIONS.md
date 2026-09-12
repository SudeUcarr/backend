# Staj kaynakları ve Google Maps

## Neden iki farklı bağlantı?

Stajlar şirketlerin kamuya açık iş ilanı API’lerinden alınır ve kaynak bağlantısıyla Supabase’e yazılır. Google mekan verileri ise backend üzerinden Google Places API (New) REST servisiyle anlık aranır; harita tarayıcı SDK’sıyla çizilir. Google Maps sayfasının HTML’ini kazıyan veya korumaları aşan bir scraper bulunmaz. Kaynakların farklı kullanım ve saklama ihtiyaçları uygulamada ayrı tutulur.

## Staj kaynakları

| Adaptör | Pano | Şirket |
|---|---|---|
| Lever | insiderone | Insider One |
| Lever | lalamove | Lalamove |
| Lever | peakgames | Peak |
| Lever | dreamgames | Dream Games |
| Greenhouse | constructortech | Constructor |
| Greenhouse | udemybedi | Udemy |

Kaynak tanımları `src/integrations/internship-sources.ts` içindedir. Lever için kamuya açık postings uç noktası, Greenhouse için Job Board API kullanılır. Bir panoda staj bulunmaması hata değildir; sıfır sonuç da başarılı kontrol olarak kaydedilir. İlk kontrolde 10 ilan bulunmuştur; sonradan aynı sayının korunması beklenmez.

### Normalleştirme

Başlıkta intern, internship, stajyer, staj veya trainee eşleşmesi aranır. “Internal” gibi farklı sözcüklerin yanlış eşleşmemesi için kelime sınırları kullanılır. Kaynakta bulunmayan son tarih ve çalışma biçimi uydurulmaz. Şirket, konum, pozisyon ve kaynak bağlantısıyla kısa bir olgusal özet üretilir; ilan açıklamalarının tamamı kopyalanmaz.

Her ilanın sağlayıcı/pano ve kaynak kimliği benzersizdir. Aynı iş tekrar çekildiğinde upsert yapılır, ikinci ilan oluşmaz. Başvuru URL’leri beklenen Lever/Greenhouse alan adlarıyla sınırlandırılır. Keyfi URL verip sunucunun herhangi bir iç/dış adrese istek atması mümkün değildir.

Lever sayfaları limit/skip ile dolaşılır. İstek zaman aşımı, azami sayfa sayısı, bozuk JSON ve yanlış kaynak şekli kontrol edilir. Kaynak başarısız olduğunda mevcut ilanlar korunur. Kaynak eksiksiz okunduktan sonra önceki kontrolden kalıp artık görünmeyen ilanlar `closed` olur.

### Çalıştırma

```bash
npm run collect:internships
```

Bu komut veri tabanına yazmadan toplar; sonuç ve hata bilgisi `.artifacts/internship-import.json` içindedir.

```bash
npm run collect:persist
```

Bu komut `.env.local` anahtarını kullanarak upsert yapar. Kaynak başına atomik bir saatlik bekleme kilidi vardır. Aynı anda iki istemci veya script çalışsa da aynı kaynağı gereksiz tekrar toplamaz. Kilit süreli olduğundan yarıda kalan bir işlem sonsuza kadar kaynağı engellemez.

### Backend API ve isteğe bağlı Edge uyumluluğu

Arayüz yenileme düğmesi artık POST /api/internships/sync çağırır. Auth backend’de doğrulanır; modules/internships/service.ts aynı sabit adaptörlerle importu yapar. Edge Function yayını normal uygulama için gerekli değildir. Aşağıdaki eski Edge akışı bağımsız cron uyumluluğu için korunur; dashboard tek dosya hazırlığı backend kaynağını gömer.

`sync-internships` aynı adaptörleri sunucuda çalıştırır. Giriş yapan kullanıcı “Kaynakları yenile” düğmesiyle çağırabilir. Fonksiyon oturum tokenını Supabase Auth `getUser` ile doğrular. Servis çağrısı için kendi ortamındaki servis anahtarını da kabul eder. `verify_jwt=false` ayarı tek başına anonim yetki vermez; doğrulama fonksiyon kodundadır.

CLI ile yayın:

```bash
supabase functions deploy sync-internships --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

Dashboard editörü için `npm run edge:prepare` tek dosyalık `.artifacts/sync-internships.ts` oluşturur. Bu dosya sır içermez; `index.ts` olarak yapıştırılıp `sync-internships` adıyla yayınlanabilir. Kaynak veya adaptör değişirse yeniden hazırlanmalıdır.

### Düzenli toplama

Uygulama düğmesi ve CLI ile toplama çalışır. Kendiliğinden periyodik toplama için ayrıca bir sunucu zamanlayıcısı gerekir; bu depoyu klonlamak bir cron görevi kurmaz. Supabase Cron + pg_net veya güvenilir bir sunucu görevi fonksiyonu örneğin altı saatte bir çağırabilir. Servis anahtarını frontend’e veya SQL kaynak dosyasına gömmek yerine Vault/secret değişkeninden oku. Kurulumda anahtarın fonksiyonun kabul ettiği sunucu kimlik bilgisiyle uyumlu olduğunu kontrol et.

Kaynak durumları `ingestion_runs` içindedir: başlangıç/bitiş, success/failed/running, alınan adet ve kısa hata. Bir kaynağın hata vermesi diğer başarılı kaynakları iptal etmez. Çok sayıda kaynak eklerken zaman sınırını ve sağlayıcı kullanım koşullarını tekrar değerlendir.

## Google Cloud kurulumu

1. Kendi Google Cloud projen içinde Maps JavaScript API ve Places API (New) hizmetlerini etkinleştir.
2. Maps Platform’un proje/faturalandırma gereksinimlerini karşıla. Kota ve bütçe bildirimlerini ayarla; bir bütçe bildiriminin harcamayı otomatik durdurduğunu varsayma.
3. Bir tarayıcı API anahtarı oluştur. Application restrictions altında Websites / HTTP referrers seç.
4. Canlı sitenin `https://YOUR_SITE/*` origin desenini ekle. Gerekiyorsa `http://localhost:5173/*` ve `http://127.0.0.1:5173/*` geliştirme adreslerini ayrı ekle.
5. API restrictions altında yalnızca Maps JavaScript API ve Places API (New) seç.
6. Anahtarı `.env.local` içindeki `VITE_GOOGLE_MAPS_API_KEY` alanına koy ve yeniden derle.

Tarayıcı anahtarı görünürdür; `.env` dosyasını gizlemek tek başına Google kotasını korumaz. Bu projedeki kod anahtarın Cloud Console kısıtlarını değiştiremez. `RefererNotAllowedMapError` doğru origin iznini, `ApiNotActivatedMapError` API etkinliğini, kota hatası ise proje kotasını kontrol etmeyi gerektirir.

## Kampüs konumları

Konumlar üniversitelerin yayımladığı sayfalardan alınmış referans noktalarıdır; kesin kampüs merkezi, giriş kapısı veya yürüyüş başlangıcı garantisi değildir.

| Kampüs | Enlem, boylam | Kaynak |
|---|---|---|
| İTÜ Ayazağa | 41.101422, 29.021206 | [İTÜ iletişim](https://sustecs.itu.edu.tr/bize-ulasin/) |
| YTÜ Davutpaşa | 41.025694, 28.888035 | [YTÜ kampüsler](https://erasmus.yildiz.edu.tr/page/Erasmus--Europe/Campuses/852) |
| Marmara Göztepe | 40.986114, 29.05335 | [Marmara iletişim](https://sks.marmara.edu.tr/contact) |

Yeni kampüs eklenirken üniversite ilişkisi, koordinatlar ve kaynak URL’si birlikte yazılmalıdır. Konumu eksik kampüste canlı arama kapalıdır; öğrenci önerileri yine gezilebilir. Cihaz GPS izni istenmez.

## Arama ve sıralama

`POST /api/places/nearby → Places REST searchNearby` en yakın 20 sonuca kadar getirir. Tür cafe, restaurant veya library; yarıçap 1, 2, 3 veya 5 km seçilir. İstenen alanlar kimlik, ad, adres, konum, fiyat seviyesi, puan, puan sayısı, Maps URL’si ve kaynak atıflarıdır. Gereksiz fotoğraf/yorum içeriği istenmez.

Haversine hesabı iki nokta arasındaki kuş uçuşu mesafeyi metre olarak verir. Fiyat seviyesi 0–4 aralığına dönüştürülür; ücretsiz 0 geçerli bir değerdir, eksik bilgi `null` olarak ayrı tutulur.

```text
düzeltilmiş_puan = (Google_puanı × yorum_sayısı + 3.5 × 20) / (yorum_sayısı + 20)
uygunluk = 100 × [
  0.40 × (1 − fiyat_seviyesi / 4)
  + 0.35 × max(0, 1 − mesafe / arama_yarıçapı)
  + 0.25 × düzeltilmiş_puan / 5
]
```

Skor yuvarlanarak gösterilir. Eksik fiyat veya puanda skor verilmez; bu mekanlar sonuçların sonuna alınır. İstenirse fiyatı bilinmeyenler tamamen gizlenir. Skor aynı aramadaki karşılaştırma içindir; yarıçap değiştiğinde mesafe bileşeni de değişir. TL menü fiyatı, indirim, açık olma durumu veya yürüme süresi bu formülden çıkarılamaz.

## Maps gösterimi ve veri sınırı

Google haritası sonuçların yanında ve ayrıntıda gösterilir; Google’ın telif/atıf arayüzü gizlenmez. Ek sağlayıcı atıfları varsa gösterilir. Sonuçlar sayfa belleğindedir; veritabanı, localStorage veya kalıcı işletme envanteri olarak saklanmaz. Öğrenci öneri formu kendi deneyimini yazdırır; Google alanlarını otomatik kopyalamaz.

Gizlilik ve kullanım sayfaları herkese açıktır. Google gizlilik ve ek Maps koşullarına bağlantı içerir. Fiyat bulunmadığında ucuz kabul etmek yerine “Fiyat bilgisi yok” denir. Canlı fiyat/puan, örnek mekan değerlendirmesi ve öğrenci yorumu ayrı kaynaklardır.

## Resmi kaynaklar

- [Lever Postings API](https://github.com/lever/postings-api)
- [Greenhouse Job Board API](https://developers.greenhouse.io/job-board.html)
- [Google Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search)
- [Google Places politikaları](https://developers.google.com/maps/documentation/places/web-service/policies)
- [Supabase zamanlanmış fonksiyonlar](https://supabase.com/docs/guides/functions/schedule-functions)
