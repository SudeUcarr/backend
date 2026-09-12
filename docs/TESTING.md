> Bu bağımsız repoda npm test 35 backend testini çalıştırır. Frontend'in 5 testi kendi reposunda çalışır; aşağıdaki ortak kabul ve canlı test kayıtları proje geçmişini açıklar.

# Testler ve jüri demosu

## Otomatik testler

`npm test` Node test runner ile frontend ve backend test dosyalarını çalıştırır. Ağ veya gerçek hesap gerektirmez. Veritabanı testleri PGlite içinde Supabase’in Auth/Storage yardımcılarını asgari biçimde taklit eder, gerçek migration SQL’ini yükler ve ayrı rollerle sorgular. Bu, gerçek Supabase testi yerine geçmez; RLS regresyonlarını hızlı yakalamak içindir.

| Dosya | Doğrulanan davranış |
|---|---|
| tests/api.test.mjs | Backend oturum/PKCE, HttpOnly/Secure, CSRF/CORS, refresh, RLS kimliği, korumalı alanlar ve dosya sınırları |
| tests/database.test.mjs | Üç hesapta bütçe izolasyonu, ortak içerik, sahiplik, özel dosyalar, takvim revizyonu, claim kilidi, kaynak alanı koruması |
| tests/internships.test.mjs | Staj sözcük sınıflaması, bilinmeyen alanlar, güvenli kaynak URL’leri, sayfalama, tekrarlar ve hatalı besleme |
| frontend/place-ranking.test.mjs | Haversine metre hesabı, eksik fiyat, ücretsiz seviye, fiyat/mesafe etkisi ve az yorum düzeltmesi |
| tests/occupancy.test.mjs | 2.103 mevcut ve 1.955 gelecek Python tahmini, giriş pencereleri, zaman sızıntısı, kapsam boşlukları, simülasyon ve public ML API |
| frontend/occupancy.test.mjs | Kapasite eşikleri, kapasite üstü oranlar ve yalnızca kütüphaneye uygulanan sınav senaryosu |

ML entegrasyonu sonrası `npm test` ile 40 test geçti. `python -m unittest discover -s ml -p test_forecast.py` ile tam +60 dakika hedef eşleştirmesine ait 2 test ayrıca geçti. Önceden eğitilmiş modellerin web çalışma zamanı Python gerektirmez. Yerel HTTP/API proxy, lisans dosyası, derlenmiş Worker tahmini ve model ağırlıklarının frontend paketinde bulunmaması da kontrol edildi. Tarayıcı görsel/etkileşim testi ve yeniden eğitim yapılmadı. [ML rehberi](ML.md).

Yeni backend API testleri sağlayıcı isteklerini fixture ile taklit eder; gerçek Supabase/Google erişimi veya e-posta teslimi kanıtı değildir. Node üst test grubunu da test sayısına dahil eder. `npm run build` ayrıca TypeScript kontrolünü ve üretim derlemesini yapar. `npm run lint` proje lint aracını çalıştırır.

## Gerçek Supabase testi

Aşağıdaki canlı test ve Google/Edge sonuçları ayrım öncesi sürümün tarihsel kayıtlarıdır. Yeni API ile canlı hesap ve e-posta akışı, kendi yetkili ortamında ayrıca test edilmelidir. Bu çalışma sırasında yerel gerçek anahtar bulunmadığından canlı entegrasyon testi yeniden çalıştırılmamıştır.

```bash
npm run test:integration
```

Bu komut `.env.local` içindeki publishable ve sunucu anahtarlarını kullanır. Üç geçici hesap yaratır, parola ile giriş yapar, iki üniversiteye profil ekler, bütçe kaydı yazar, çıkış/girişten sonra aynı kaydı okur ve başka hesabın okuyup değiştiremediğini doğrular.

Ardından özel bir PDF nesnesi yükler. Paylaşıma bağlanmadan başka hesap indirmemelidir. Yayınlanmış notla ilişkilendirildiğinde aynı dosyayı ilgili ortak içeriği okuyabilen hesap indirebilmelidir. Başka hesabın kişisel takvime erişemediği ve istemcinin izin verilen hatırlatma durum alanlarını okuyabildiği de kontrol edilir.

Test bittiğinde dosyalar, ortak test kayıtları ve hesaplar temizlenir. Geçici servis hatalarında temizlik sınırlı yeniden denenir. Test e-posta göndermez; normal kullanıcı doğrulamasını kapatmaz. Gerçek para, gerçek başvuru veya gerçek kişilerle mesajlaşma işlemi yapmaz.

Bu entegrasyon testi 12 Eylül 2026 tarihinde canlı proje üzerinde başarılı çalıştırılmış ve temizlik tamamlanmıştır. E-posta teslimini test etmez. Ani bağlantı kesilmesinde kalan geçici hesabı silmeden önce `kampuskit-test-...@example.com` biçimi ve hesap kimliğini kontrol et; `cleanup-test-users.mjs` yalnızca açıkça belirtilen test kimlikleriyle kullanılmalıdır.

## Gerçek kaynak kontrolü

Altı şirket panosunun tamamı başarılı okunmuştur; toplam 10 staj bulunmuştur. Sıfır staj dönen pano başarısız sayılmamıştır. `sync-internships` uzak Supabase üzerinde yayınlanmış, gerçek demo oturumuyla çağrılmış ve bir saatlik kilit yanıtı doğrulanmıştır. Kimlik doğrulamasız çağrı yetki almaz.

Google Places API (New) anahtarı gerçek aramayla kontrol edilmiştir. Uygulamanın Ayazağa mekan ekranında Google haritası yüklenmiş ve 20 gerçek kafe sonucu gösterilmiştir. Fiyatı olmayan mekanlar “Fiyat bilgisi yok” olarak ayrılmıştır. Anahtarın Cloud Console kısıtları bu işlev testinden bağımsız ayarlanmalıdır.

## Jüri demosu: yeni öğrencinin ilk günü

1. Tanıtım sitesini aç; beş araç grubunun bir öğrencinin günündeki rolünü göster.
2. Sağlanan gerçek demo hesabıyla giriş yap. Hesapsız `/demo` yolunun değişiklik kaydetmediğini, bu hesabın ise gerçek Supabase verisi kullandığını anlat.
3. Ana panelde kalan bütçeyi ve yaklaşan tarihleri göster. Üniversiteyi YTÜ veya Marmara yapıp ortak içerik filtresinin değiştiğini göster; kişisel bütçenin aynı kaldığını belirt.
4. İTÜ’ye dön. Oda arkadaşı ilanlarında bölge ve bütçe filtrelerini kullan. Örnek ilan etiketini göster; gerçek teklif olduğu izlenimini verme.
5. Bir kulüp etkinliğini takvime ekle. Aynı etkinliğin yeniden eklenemediğini göster. Takibin resmi üyelik olmadığını açıkla.
6. Notlarda “Git”, “türev” veya “SQL” ara. Özgün örnek notu aç, soru ve yanıt ilişkisini göster.
7. Bütçeye küçük bir örnek harcama ekle; toplamın değiştiğini ve yenilemede kaydın korunduğunu göster. Prova harcamasını sonra silebilirsin.
8. Stajlarda şirket kaynağı etiketini, kontrol tarihini ve başvuru bağlantısını göster. Gerçek başvuruyu sunum sırasında göndermek gerekmez.
9. Mekanlarda Ayazağa, kafe ve 3 km seçip ara. Uygunluk ölçütlerini, eksik fiyat davranışını ve ayrıntı haritasını göster.
10. Öğrenci önerileri sekmesini aç; deneyim ve fiyat tarihi alanlarını göster. Örnek bir kayıt kaydedilecekse bunun demo amaçlı olduğunu başlık/açıklamada yaz.
11. Yoğunluk ekranında güncel veri yoksa boş durumu göster. Gerçek kampüste değilsen gerçek yoğunluk raporu gönderme; simülasyonu hesapsız örnek modda anlat.

## İçerikli hesabın başlangıç durumu

Hesap `Deniz · Demo` adıyla İTÜ Bilgisayar Mühendisliği profiline sahiptir. 10 bütçe hareketi, 6 tarih, bir kulüp takibi, üç kaydedilmiş gerçek staj ve bir örnek soru bulunur. Ortak içerik paketi tüm modüllerde görünür. Demo hesabının e-postası teslim alınabilen bir posta kutusu değildir; parola kurtarma için kullanılmaz.

## Kabul kontrol listesi

- İki üniversite ve üç hesapla özel veri sınırları: otomatik canlı test geçti.
- Yazılan kayıtların oturum sonrası kalması: canlı test geçti.
- Ders paylaşımı ve özel dosya görünürlüğü: canlı test geçti.
- Staj toplama, kaynak ayrımı ve sahiplik: adaptör/RLS testleri geçti; uzak fonksiyon çağrısı doğrulandı.
- Maps araması ve harita: yerel gerçek API akışı doğrulandı.
- Fiyat/mesafe skoru: eksik veri ve küçük örneklem testleri geçti.
- Gerçek e-posta teslimi ve tekrarsız dış gönderim: henüz tamamlanmadı.
- Tüm telefon boyutları ve tarayıcılar: kapsamlı cihaz matrisi henüz uygulanmadı.

## Yayın öncesi kontrol

Üretim build’i başarılı olmalı. Git’e eklenecek dosyalarda `.env`, sunucu anahtarı, Google anahtarının kaynak kopyası ve demo şifresi bulunmamalı. Kaynak depo ile yayın aynı uygulama sürümünü taşımalı. Sitenin ana adresi, giriş bağlantısı ve hash içeren modül bağlantıları paylaşılmadan önce doğru origin’e yönlenmelidir.

E-posta servisi tamamlanmadığı sürece teslim testini geçmiş gibi raporlama. Google fiyat seviyesini TL fiyatı gibi sunma. Örnek kulüp/ilan/kişi kayıtlarını doğrulanmış gerçek içerik olarak adlandırma. Yoğunlukta boş veri, yanlış güncel veri göstermekten daha doğru bir ürün davranışıdır.

Lint çalıştırması hata vermeden tamamlandı; mevcut kodda React hook, tarih hesaplama ve Fast Refresh uyarıları bulunuyor. Supabase SDK frontend paketinden çıkarılmıştır; frontend derlemesi ve Worker derlemesi ayrı doğrulanır.
