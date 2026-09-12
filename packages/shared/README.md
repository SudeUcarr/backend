# Yerel ortak paket

Bu v1.0.0 snapshot, bu reponun `file:./packages/shared` bağımlılığıdır. Tipler, API sözleşmeleri, saf kurallar ve örnek veriyi içerir. Repo tek başına kurulabilir; dış repo path'i veya registry gerektirmez.

API/kural değişikliğinde frontend reposunun aynı snapshot'unu ve sürümünü de güncelle; iki kilit dosyasını yenile. İki checkout aynı çalışma klasöründeyse üst `npm run contracts:check` kaynak/sürüm eşleşmesini doğrular.
