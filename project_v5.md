# Akademik Belge Formatlama ve Veri Analizi Platformu - Proje Şartnamesi v5.0

---

## 1. Proje Özeti

Bu proje, kullanıcıların akademik belgelerini **tam kapsamlı otomatik formatlama motoru** ile biçimlendirebildiği ve ham verilerini yükleyerek profesyonel istatistiksel analiz hizmeti alabildiği web tabanlı bir SaaS (Software as a Service) platformudur.

Platform iki temel hizmet sunar:

- **Formatlama Hizmeti:** Tamamen otomatik. Kullanıcı belgesini yükler, şablon seçer, wizard sorularını yanıtlar ve motor tezin/makalenin tamamını — kapak sayfalarından ekler bölümüne kadar — otomatik formatlar. Uzman müdahalesi yoktur.
- **Analiz Hizmeti:** İnsan destekli. Kullanıcı veri ve talep gönderir, ticket açılır, platform ekibindeki uzman analizi yapar ve sonuçları teslim eder.

Sistem, kapalı bir biletleme (ticket) sistemi, çoklu ödeme altyapısı, çok dilli arayüz ve kapsamlı admin yönetim paneli içerir.

---

## 2. Kullanıcı Rolleri ve Yetkilendirme

- **Super Admin:** Tüm platformu yönetir — fiyatlandırma, şablon ekleme/düzenleme, uzman atamaları, güvenlik yapılandırmaları, bildirim kanalları, yasal metinler, analitik dashboard ve sistem ayarları.
- **Uzman (Analist/Editör):** Platform ekibinin bir üyesi. Sadece kendisine atanan analiz ticketlarını ve bu ticketlara ait verileri görebilir. Uzmanlık alanı tag'leri ile tanımlanır (SPSS, R, formatlama kontrol, meta-analiz vb.). Kendi dashboard'unda aktif/bekleyen/tamamlanan işleri, deadline sayaçlarını ve mesaj bildirimlerini görür.
- **Kullanıcı (Müşteri):** Belge yükleyen, formatlama/analiz talep eden, ödeme yapan ve sonuç raporlarını indiren standart profil. Kayıt aşamasında akademik unvan bilgisi alınır.

> **Not:** Platform dışarıdan serbest uzman kabul etmez. Uzman hesapları yalnızca platform ekibi için oluşturulur.

---

## 3. Temel Özellikler ve Modüller

### 3.1. Ana Sayfa ve Kullanıcı Arayüzü (UI)

- **Duyuru Bandı (Announcement Bar):** Admin panelinden yönetilen dinamik alan.
- **Hizmet Detayları:** Formatlama ve Analiz süreçlerini anlatan bilgilendirme kartları.
- **Hızlı Eylem Butonları:** "Hemen Formatla" ve "Analiz İste".
- **Navigasyon:** Marka logosu, Editör, Analiz, Fiyatlandırma, "Giriş Yap / Kayıt Ol".
- **Dil Değiştirici:** Tarayıcı diline göre otomatik, kullanıcı tercihi profilde saklanır.

### 3.2. Öğrenci Doğrulaması ve İndirimler

- Unvana dayalı otomatik indirim uygulanmayacaktır.
- İndirimler **Kupon Kodları** üzerinden yönetilecektir.
- Öğrencilere özel fiyatlandırma için **SheerID** (veya kurumsal e-posta doğrulama) entegrasyonu.


---

## 4. Formatlama Motoru (Tam Kapsamlı, Etkileşimli, Otomatik)

Motor, belgenin tamamını — kapak sayfalarından özgeçmişe kadar — otomatik formatlar. Ancak tek yönlü bir işlem değildir: **hibrit algılama, canlı önizleme ve her aşamada düzeltme** imkanı sunar. Kullanıcı istediği anda geri dönüp değişiklik yapabilir ve sonucu anında görebilir.

### 4.1. Genel Akış (6 Faz)

```
[FAZ 1] Giriş ve Yükleme
    ↓
[FAZ 2] Şablon Seçimi / Özel Format Oluşturma
    ↓
[FAZ 3] Belge Analizi (Otomatik)
    ↓
[FAZ 4] Etkileşimli Yapı Düzenleme (Canlı Önizleme)
    ↓
[FAZ 5] Wizard — Ek Bilgi Girişi (Canlı Önizleme)
    ↓
[FAZ 6] Son Kontrol, Ödeme ve İndirme
```

> **Kritik İlke:** Kullanıcı FAZ 4, 5 ve 6 arasında serbestçe geri dönebilir. Her değişiklik canlı önizlemede anında yansır. Sistem hiçbir zaman "geri dönülemez" bir adım uygulamaz.

---

### 4.2. FAZ 1 — Giriş ve Yükleme

- Kullanıcı belgesini yükler (Word .docx) **veya** platforma metin yapıştırır (online editör).
- Çalışma türü seçer. Çalışma türleri admin panelinden yönetilen **esnek bir listedir**:
  - Varsayılan türler: Yüksek Lisans Tezi, Doktora Tezi, Makale, Proje, Bitirme Projesi, Rapor, Seminer, Ödev, Diğer
  - Admin istediği türü ekleyebilir/çıkarabilir/düzenleyebilir.
  - Her çalışma türü farklı bölüm yapısı ve zorunlu/opsiyonel bölümler içerebilir (ör: Ödev'de onay sayfası yok, Tez'de zorunlu).

---

### 4.3. FAZ 2 — Şablon Seçimi veya Özel Format Oluşturma

Kullanıcının üç seçeneği vardır:

#### Seçenek A: Mevcut Şablon Seçimi
- Admin tarafından oluşturulmuş resmi şablonlar listesinden seçim.
- Filtreler: Üniversite, çalışma türü, ülke, dergi adı vb.

#### Seçenek B: Mevcut Şablonu Klonla ve Düzenle
- Kullanıcı bir resmi şablonu temel alır.
- Parametre düzenleme ekranı açılır (bkz. Madde 4.9 — Şablon Tanımlama Formu).
- Değiştirilen parametreler vurgulanır (fark gösterimi).
- Kullanıcı bu özelleştirilmiş şablonu **kişisel şablon** olarak profiline kaydedebilir.

#### Seçenek C: Sıfırdan Özel Format Oluşturma
- Kullanıcı "Kendi formatımı oluşturmak istiyorum" seçeneğini tıklar.
- Sistem adım adım soru-cevap wizard'ı başlatır:
  - **Adım 1:** Sayfa düzeni (kağıt boyutu, kenar boşlukları, metin hizalama)
  - **Adım 2:** Yazı tipi ve punto ayarları
  - **Adım 3:** Satır aralığı ve paragraf boşlukları
  - **Adım 4:** Başlık hiyerarşisi (kaç seviye? her seviye nasıl görünsün?)
  - **Adım 5:** Sayfa numaralandırma (konum, başlangıç, Romen/Arap ayrımı)
  - **Adım 6:** Kapak sayfası (gerekli mi? kaç kapak? hangi bilgiler?)
  - **Adım 7:** Sabit sayfalar (onay, beyanname, özet — hangileri gerekli?)
  - **Adım 8:** Bölüm sıralaması (sürükle-bırak)
  - **Adım 9:** Tablo/şekil/denklem formatı
  - **Adım 10:** Kaynakça stili
  - **Adım 11:** Kısıtlamalar (kelime limitleri, özet limiti)
- Her adımda canlı önizleme güncellenir.
- Tamamlanan format kişisel şablon olarak kaydedilir.

> Her üç seçenekte de kullanıcı, formatlama sürecinin herhangi bir aşamasında şablon parametrelerine geri dönüp değişiklik yapabilir.

---

### 4.4. FAZ 3 — Belge Analizi (Hibrit Algılama)

Kullanıcı dosyayı yükledikten sonra motor belgeyi otomatik analiz eder:

#### 4.4.1. Otomatik Algılama

Motor aşağıdaki unsurları otomatik tespit etmeye çalışır:

| Algılanan Unsur | Algılama Yöntemi |
|---|---|
| Başlıklar ve düzeyleri | Font boyutu, kalınlık, numaralandırma deseni, satır uzunluğu |
| Başlık numaralandırma | Ondalık desen (1, 1.1, 1.2.1 vb.) veya sıralı |
| Mevcut içindekiler | "İçindekiler" başlığı altındaki yapı |
| Tablolar | Tablo yapısı + "Tablo X.X" deseni |
| Şekiller | "Şekil X.X" deseni + görsel öğeler |
| Denklemler | Denklem editörü öğeleri |
| Kaynakça bölümü | "Kaynaklar/Kaynakça/References" başlığı |
| Özet bölümü | "Özet/Abstract" başlığı |
| Kelime sayısı | Toplam + bölüm bazlı |
| Mevcut sayfa numaralandırma | Romen/Arap, konum |

#### 4.4.2. Güven Skoru

Her algılanan öğeye bir güven skoru atanır:

- 🟢 **Yüksek güven (>%80):** Otomatik kabul edilir, kullanıcı onaylar veya değiştirir.
- 🟡 **Orta güven (%50-80):** Kullanıcıya "Bu bir Başlık 2 mi?" gibi onay sorusu sorulur.
- 🔴 **Düşük güven (<50%) veya algılanamayan:** Kullanıcıdan manuel giriş istenir.

#### 4.4.3. Algılama Sonuç Ekranı

Analiz tamamlandığında kullanıcıya **etkileşimli yapı haritası** gösterilir:

- Belgenin tespit edilen yapısı ağaç (tree) görünümünde.
- Her öğe renk kodlu (yeşil/sarı/kırmızı).
- Kullanıcı bu ekranda:
  - Başlık düzeyini değiştirebilir (dropdown veya sürükle)
  - Bir metni başlık olarak işaretleyebilir veya başlık işaretini kaldırabilir
  - Numaralandırma ekleyebilir veya değiştirebilir
  - Bölüm sırasını sürükle-bırak ile düzenleyebilir
  - Algılanmayan öğeleri manuel ekleyebilir

---

### 4.5. FAZ 4 — Etkileşimli Yapı Düzenleme (Canlı Düzenleyici)

Bu faz, motorun en kritik UX bileşenidir. Tüm öğeler birbiriyle bağlantılıdır — bir değişiklik zincirleme güncellemeler tetikler. Kullanıcı her öğeyi kontrol edebilir ve her değişikliğin etkisini anında görür.

#### 4.5.1. Arayüz Modları

Kullanıcı iki arayüz modundan birini seçebilir (istediği zaman değiştirebilir):

**Mod A — Split View (Bölünmüş Görünüm):**
- Sol panel: Düzenleme kontrolleri (yapı ağacı, parametre ayarları, bölüm yönetimi)
- Sağ panel: Canlı PDF önizleme (her değişiklikte otomatik güncellenir)

**Mod B — WYSIWYG (Doğrudan Düzenleme):**
- Tek panel: Formatlanmış belge üzerinde doğrudan tıkla-düzenle
- Her öğeye tıklandığında bağlam menüsü açılır

#### 4.5.2. Başlık Sistemi (Merkezi Öğe — Her Şey Buraya Bağlı)

Başlıklar motorun merkezindedir. Başlık değişiklikleri içindekiler, tablo/şekil/denklem numaralandırması ve sayfa yapısını doğrudan etkiler.

**A) Başlık Algılama ve Düzeltme**

Motor otomatik algılama yapar, kullanıcı her algılamayı düzeltebilir:

| Durum | Motor Ne Yapar | Kullanıcı Ne Yapabilir |
|---|---|---|
| Metin doğru şekilde başlık olarak algılandı | 🟢 Yeşil ile gösterir | Onaylar veya düzey değiştirir |
| Metin başlık olarak algılandı ama değil (yanlış pozitif) | 🟡 Sarı ile gösterir | "Bu başlık değil, normal metin" seçer |
| Başlık algılanamadı (kaçırma) | Göstermez | Kullanıcı metni seçer → "Bu bir başlık" işaretler |
| Başlık algılandı ama düzeyi yanlış | 🟡 Sarı | Dropdown ile doğru düzeyi seçer (H1→H5) |
| Başlığa ait olmayan metin başlığa dahil edilmiş | 🟡 Sarı | Başlık sınırını sürükleyerek metin kısmını ayırır (split) |
| Başlığın bir kısmı algılanmış, devamı kaçırılmış | 🟡 Sarı | Başlık sınırını genişleterek birleştirir (merge) |
| Başlık birden fazla satıra bölünmüş | Tek başlık olarak birleştirir | Onaylar veya "bunlar ayrı başlıklar" der |
| Gövde metni kalın/büyük yazılmış ama başlık değil | Başlık olarak algılayabilir | "Bu başlık değil" seçer |

**B) Başlık Numaralandırma**

Numaralandırma sorunları tespit edilir ve kullanıcıya üç seçenek sunulur:

| Sorun | Örnek | Seçenek 1 | Seçenek 2 | Seçenek 3 |
|---|---|---|---|---|
| Atlanan numara | 1.1, 1.2, 1.4 (1.3 yok) | "Otomatik düzelt (1.1, 1.2, 1.3)" | "Benim numaramı koru" | "Tek tek soracağım" |
| Yanlış hiyerarşi | 1, 1.1, 1.1.1, 1.3 (2. düzey atlandı) | "Hiyerarşiyi düzelt" | "Koru" | "Sor" |
| Numarasız başlık | "Giriş" (numara yok) | "Numara ekle (1.)" | "Numarasız bırak" | — |
| Farklı numaralama stili | 1., 2., A., B. (karışık) | "Hepsini ondalık yap" | "Mevcut stili koru" | "Stil seç" |
| Çift numara | 1.2 başlığı iki kez var | "Otomatik yeniden numara" | "Manuel düzelt" | — |

> **Kritik:** Kullanıcı "tek tek sor" seçtiğinde, motor her sorunlu başlık için sırayla sorar ve cevaba göre devam eder. Toplu düzeltme de mümkündür.

**C) Başlık-İçindekiler Bağlantısı**

| Ayar | Açıklama | Varsayılan |
|---|---|---|
| İçindekiler derinliği | Hangi düzeylere kadar gösterilsin? | Düzey 1-3 (şablona göre) |
| Düzey bazlı görünürlük | "Düzey 5 başlıklar var ama İçindekiler'de görünmesin" | Admin şablonda tanımlar, kullanıcı değiştirebilir |
| İçindekiler otomatik güncelleme | Her başlık değişikliğinde İçindekiler anında güncellenir | Evet (devre dışı bırakılamaz) |
| İçindekiler sayfa numaraları | İçindekiler'deki sayfa numaraları doğru mu? | Motor otomatik hesaplar |
| İçindekiler formatı | Başlık düzeylerine göre girinti, font, punto | Şablondan gelir, kullanıcı geçersiz kılabilir |

> Kullanıcı bir başlığı "Düzey 5" yapıp "İçindekiler'de görünmesin" diyebilir. Ya da "Bu bir başlık ama numarasız ve İçindekiler'de yok" (ör: Teşekkür, Özet gibi bölüm başlıkları).

#### 4.5.3. Sayfa Numaralandırma Kontrol Sistemi

Sayfa numaralandırma birden fazla "bölge" (zone) içerir. Kullanıcı bölge sınırlarını ve her bölgenin ayarlarını düzenleyebilir.

**A) Bölge Tanımlama**

Motor, şablona göre varsayılan bölgeler oluşturur. Kullanıcı bunları düzenleyebilir:

```
[Bölge 1: Numarasız]     → Dış kapak, iç kapak(lar), onay sayfası
[Bölge 2: Romen]          → Teşekkür'den İçindekiler'e kadar (i, ii, iii...)
[Bölge 3: Arap]           → Giriş'ten sona kadar (1, 2, 3...)
```

**B) Bölge Düzenleme İşlemleri**

| İşlem | Nasıl Yapılır |
|---|---|
| Bölge sınırını taşıma | Önizlemede sayfalar arası çizgiyi sürükle: "Romen rakamı bu sayfaya kadar devam etsin" |
| Belirli sayfayı numarasız yapma | Sayfaya tıkla → "Bu sayfada numara gösterme" |
| Numara tipini değiştirme | Bölgeye tıkla → "Romen / Arap / Numarasız" |
| Başlangıç değerini değiştirme | Bölgeye tıkla → "Bu bölge [X]'ten başlasın" |
| Numara konumunu değiştirme | Bölgeye tıkla → "Alt orta / Üst orta / Sağ üst / Sol üst" |
| Yeni bölge ekleme | İki sayfa arasına tıkla → "Burada yeni numara bölgesi başlat" |
| Bölge silme | Bölge sınırını kaldır → önceki bölge ile birleştir |

**C) Doğrulama**

Motor, sayfa numaralandırmayı şablonla karşılaştırır:
- "Şablon, Onay sayfasının numarasız olmasını gerektiriyor ama siz numara eklemisiniz" → Uyarı
- "Romen rakamı Giriş bölümünde devam ediyor, şablona göre burada Arap'a geçilmeli" → Uyarı
- Kullanıcı uyarıyı kabul edip düzeltebilir veya göz ardı edebilir.

#### 4.5.4. Tablo, Şekil ve Denklem Sistemi

**A) Algılama ve Düzeltme**

| Durum | Kullanıcı Eylemi |
|---|---|
| Tablo algılandı ama başlığı yanlış tespit edildi | Başlık metninin sınırını düzenler (nerenin başlık, nerenin gövde metin olduğunu belirler) |
| Tablo başlığı tablonun altında ama şablon üstte istiyor | Motor otomatik taşır, kullanıcı onaylar |
| Şekil başlığı şeklin üstünde ama şablon altında istiyor | Motor otomatik taşır |
| Numara eksik veya yanlış | Kullanıcı numarayı düzenler veya "otomatik numara" seçer |
| Kaynak/dipnot algılanamadı | Kullanıcı metni seçip "Bu tablonun kaynağıdır" işaretler |
| Devam tablosu algılanamadı | Kullanıcı "Bu tablo önceki sayfadan devam ediyor" işaretler |
| Gövde metni tablo/şekil başlığı olarak algılandı | "Bu başlık değil, normal metin" seçer |

**B) Numaralandırma ve Çapraz Referans Bağlantısı**

Tablo/şekil/denklem numaralandırma değiştiğinde, metin içindeki tüm referanslar otomatik güncellenir:

```
Başlık değişikliği: "Tablo 2.1" → "Tablo 3.1" (bölüm değiştiği için)
    ↓ Kaskad güncelleme
Metin içi referans: "bkz. Tablo 2.1" → "bkz. Tablo 3.1"
Tablo listesi: "Tablo 2.1 ... s.45" → "Tablo 3.1 ... s.47"
```

Kullanıcıya bildirim: "3 çapraz referans otomatik güncellendi. [Değişiklikleri gör]"

Motor, güncelleyemediği referansları işaretler:
- "Metin içinde 'Tablo 5'e atıf var ama belgede Tablo 5 bulunamadı" → ⛔ Hata

#### 4.5.5. Bölüm Yapısı ve Sıralama

**A) Bölüm Algılama**

Motor, belgedeki bölümleri başlıklara ve anahtar kelimelere göre tespit eder:
- "ÖZET", "ABSTRACT", "İÇİNDEKİLER", "GİRİŞ", "KAYNAKÇA", "EKLER" → otomatik bölüm eşleştirme
- Benzer başlıklar: "SONUÇLAR" vs "SONUÇ VE ÖNERİLER" → eşleştirme önerir, kullanıcı onaylar
- Eşleştirilemeyen bölümler → kullanıcıya "Bu bölüm ne?" sorusu sorulur (dropdown ile seçim)

**B) Sıralama**

- Şablonun beklediği sıra ile belgenin mevcut sırası yan yana gösterilir
- Farklılıklar vurgulanır: "Şablona göre Beyanname, Teşekkür'den önce gelmeli"
- Kullanıcı sürükle-bırak ile sırayı değiştirebilir
- "Şablon sırasını uygula" tek tıkla tüm bölümleri doğru sıraya dizer

**C) Eksik / Fazla Bölüm**

- Şablonun zorunlu kıldığı ama belgede olmayan bölümler → ⛔ "Beyanname bölümü eksik. Eklemek ister misiniz?"
- Belgede var ama şablonda tanımlı olmayan bölümler → ℹ️ "Bu bölüm şablonda tanımlı değil. Özel bölüm olarak korunsun mu?"

#### 4.5.6. Metin İçi Tutarlılık Kontrolleri

Başlık ve yapı düzenleme dışında, motor metin içi tutarlılık kontrolü de yapar:

| Kontrol | Açıklama | Eylem |
|---|---|---|
| Kısaltma tutarlılığı | İlk kullanımda açık hali verilmiş mi? (ör: "Avrupa Birliği (AB)") | Uyarı: "AB kısaltması ilk kez sayfa 12'de açıklanmadan kullanılmış" |
| Çapraz referans geçerliliği | "bkz. Şekil 3.2" → Şekil 3.2 var mı? | ⛔ Hata: "Şekil 3.2 bulunamadı" |
| Tablo/şekil yakınlık kontrolü | Tablo metinde atıf edildikten sonraki en yakın yere mi yerleştirilmiş? | ℹ️ Bilgi: "Tablo 2.1'e ilk atıf sayfa 15'te ama tablo sayfa 22'de" |
| Dipnot numaralandırma | Dipnotlar ardışık mı? | Otomatik düzeltme öner |
| Boş sayfa kontrolü | Bölüm sonlarında gereksiz boş sayfa var mı? | Uyarı + otomatik temizleme önerisi |

#### 4.5.7. Öğeler Arası Bağımlılık Haritası (Kaskad Güncellemeler)

Bir öğe değiştiğinde zincirleme olarak etkilenen diğer öğeler:

```
Başlık değişikliği (düzey, numara, ekleme/silme)
  → İçindekiler güncellenir
  → Tablo/şekil numaraları güncellenir (bölüm bazlı ise)
  → Denklem numaraları güncellenir (bölüm bazlı ise)
  → Metin içi çapraz referanslar güncellenir
  → Sayfa numaraları kayabilir (sayfa sayısı değişirse)

Bölüm sırası değişikliği
  → Sayfa numaralandırma bölgeleri güncellenir
  → İçindekiler güncellenir
  → Tablo/şekil/denklem numaraları güncellenir

Sayfa numaralandırma bölgesi değişikliği
  → İçindekiler'deki sayfa numaraları güncellenir
  → Tablo listesi sayfa numaraları güncellenir
  → Şekil listesi sayfa numaraları güncellenir

Tablo/şekil numarası değişikliği
  → Metin içi çapraz referanslar güncellenir
  → Tablo/şekil listesi güncellenir

Kaynakça stili değişikliği
  → Tüm metin içi atıflar güncellenir
  → Tüm kaynakça listesi güncellenir
  → Kaynakça sıralaması güncellenir (alfabetik ↔ atıf sırasına göre)
```

**Kaskad bildirim:** Her zincirleme güncellemede kullanıcıya bildirim gösterilir:
"Bu değişiklik 14 öğeyi etkiledi: 1 içindekiler, 5 tablo numarası, 8 çapraz referans. [Değişiklikleri gör] [Geri al]"

#### 4.5.8. Geri Alma (Undo/Redo)

- Her düzenleme adımı (kaskad güncellemeler dahil) tek birim olarak kayıt altına alınır.
- Geri alma bir kaskad değişikliği toplu geri alır (atomik undo).
- Sınırsız geri alma / ileri alma desteği.
- Düzenleme geçmişi oturum boyunca saklanır.
- Geçmiş panelinde tüm işlemler listesi görüntülenebilir.

---

### 4.6. FAZ 5 — Wizard: Ek Bilgi Girişi

Yapı düzenleme tamamlandıktan sonra (veya paralel olarak), sistem şablonun gerektirdiği ek bilgileri toplar:

- **Kapak bilgileri:** Üniversite adı, enstitü, bölüm, tez başlığı, öğrenci adı, danışman adı, yardımcı danışman, şehir, tarih
- **Onay sayfası:** Jüri üyeleri (ad, unvan), savunma tarihi, oybirliği/çokluğu
- **Beyanname/Etik beyan:** Standart metin + öğrenci imza alanı
- **Teşekkür/Önsöz:** Serbest metin girişi
- **Özet + Anahtar kelimeler:** Türkçe + İngilizce (veya tez diline göre)
- **Kısaltmalar:** Kısaltma + açılım çiftleri (alfabetik sıralama otomatik)
- **Özgeçmiş:** Serbest metin veya yapılandırılmış form

Her adım canlı önizlemede anında güncellenir. Kullanıcı herhangi bir adıma geri dönebilir.

> **Not:** Çalışma türüne göre bazı adımlar atlanır. Örneğin "Ödev" türünde onay sayfası, beyanname ve jüri bilgileri istenmez. Hangi adımların hangi çalışma türlerinde gösterileceği admin panelinden çalışma türü bazında ayarlanır.

---

### 4.7. FAZ 6 — Son Kontrol, Ödeme ve İndirme

#### 4.7.1. Otomatik Doğrulama Kontrolleri

Motor, formatlama tamamlandıktan sonra aşağıdaki kontrolleri otomatik yapar:

- Özet kelime sayısı kontrolü (şablon limiti varsa)
- Ana metin kelime sayısı kontrolü (alan ve derece bazlı)
- Başlık numaralandırma tutarlılığı (atlanan numara var mı?)
- Tablo/şekil numaralandırma sırası
- Bölüm sırası kontrolü (zorunlu bölümler mevcut mu?)
- Sayfa numaralandırma doğruluğu (Romen/Arap geçişi doğru yerde mi?)
- Kaynakça formatı tutarlılığı (temel seviye)
- Eksik zorunlu bölüm uyarısı
- Anahtar kelime sayısı kontrolü

#### 4.7.2. Uyarı Gösterimi

- ⛔ **Hata (Error):** Zorunlu bölüm eksik, numara tutarsızlığı — düzeltilmeden devam edilemez.
- ⚠️ **Uyarı (Warning):** Kelime sayısı aşımı, önerilen format dışı — kullanıcı göz ardı edebilir.
- ℹ️ **Bilgi (Info):** İntihal eşiği hatırlatması, baskı önerileri.

Kullanıcı uyarılara tıklayarak ilgili bölüme gidip düzeltme yapabilir.

#### 4.7.3. Korumalı Önizleme

- Watermark'lı düşük çözünürlüklü PDF render.
- Sağ tık / kopyalama devre dışı.
- İndirme butonu ödeme öncesinde gizli.

#### 4.7.4. Ödeme ve İndirme

- Ödeme sonrası kullanıcı çıktıyı indirir.
- Çıktı formatı: Word (.docx), PDF veya ikisi — kullanıcı seçer.

---

### 4.8. Kullanıcı Özel Format Yönetimi

#### 4.8.1. Kişisel Şablonlar

- Kullanıcı oluşturduğu veya mevcut şablonu düzenleyerek oluşturduğu formatları **kişisel şablon** olarak profiline kaydedebilir.
- Kişisel şablonlar sadece o kullanıcıya özeldir.
- Kullanıcı kişisel şablonlarını düzenleyebilir, silebilir veya yeni belgelerine uygulayabilir.
- Kullanıcı, kişisel şablonuna isim verebilir (ör: "Benim YL Tez Formatım", "Prof. X'in istediği ödev formatı").

#### 4.8.2. Admin Tarafında Kullanıcı Formatları

- Admin panelinde **"Kullanıcı Şablonları"** bölümü bulunur.
- Admin tüm kullanıcıların oluşturduğu kişisel şablonları listeleyebilir.
- Admin, bir kullanıcı şablonunu inceleyebilir:
  - Parametre detaylarını görebilir
  - Hangi kullanıcı oluşturmuş, kaç kez kullanılmış
- Admin, beğendiği bir kullanıcı şablonunu **resmi şablon olarak terfi ettirebilir** (promote):
  - Şablona resmi isim verir (ör: "X Üniversitesi Ödev Formatı")
  - Kategoriye atar
  - Tüm kullanıcılara açar
- Admin, uygunsuz veya hatalı kullanıcı şablonlarını silebilir veya düzenleyebilir.

#### 4.8.3. Şablon İstatistikleri

Admin panelinde şablon kullanım istatistikleri:
- En çok kullanılan resmi şablonlar
- En çok oluşturulan kişisel şablon türleri (hangi parametreler en çok değiştiriliyor?)
- Terfi edilen kullanıcı şablonlarının kullanım oranları

---

### 4.9. Şablon Tanımlama Sistemi (Admin Paneli — Form Tabanlı)

Admin panelinden her şablon için aşağıdaki parametreler form alanları olarak tanımlanır. Gerçek üniversite kılavuzlarından (UKÜ, YDÜ vb.) çıkarılan kapsamlı parametre listesi:

#### 4.9.1. Genel Sayfa Düzeni

| Parametre | Açıklama | Örnek Değerler |
|---|---|---|
| Kağıt boyutu | Sayfa boyutu | A4 (21x29.7cm) |
| Üst kenar boşluğu | cm cinsinden | 4cm (UKÜ), 2.5cm (YDÜ 2021) |
| Alt kenar boşluğu | cm cinsinden | 2.5cm |
| Sol kenar boşluğu | cm cinsinden (cilt payı dahil) | 3.5cm (UKÜ), 4cm (YDÜ) |
| Sağ kenar boşluğu | cm cinsinden | 3cm (UKÜ), 2.5cm (YDÜ) |
| Metin hizalama | Gövde metin hizası | İki yana yaslı (UKÜ) / Sola hizalı (YDÜ 2021) |
| Satır aralığı (gövde) | Ana metin satır aralığı | 1.5 |
| Satır aralığı (dipnot) | Dipnot satır aralığı | 1.0 |
| Satır aralığı (özet) | Özet bölümü satır aralığı | 1.0 (UKÜ), 1.5 (YDÜ 2021) |
| Satır aralığı (kaynakça) | Kaynakça satır aralığı | 1.0 |
| Satır aralığı (tablo/şekil listesi) | Liste satır aralığı | 1.0 |
| Paragraf arası boşluk (önce) | Punto | 6pt (YDÜ), 0pt (YDÜ 2021) |
| Paragraf arası boşluk (sonra) | Punto | 6pt (YDÜ), 0pt (YDÜ 2021) |
| Paragraf girintisi | İlk satır girintisi | 0 (UKÜ), 1 tab/1.27cm (YDÜ 2021) |
| Sayfa yönü | Dikey/Yatay | Dikey (varsayılan) |

#### 4.9.2. Yazı Tipi ve Punto Ayarları

| Parametre | Açıklama | Örnek Değerler |
|---|---|---|
| Font ailesi | Ana yazı tipi | Times New Roman / Arial |
| Gövde metin puntosu | Ana metin boyutu | 12pt |
| Ana bölüm başlığı puntosu | Bölüm başlıkları | 14pt (UKÜ), 12pt büyük harf (YDÜ) |
| Alt başlık puntosu | Alt bölüm başlıkları | 12pt |
| Tez başlığı puntosu (kapak) | Kapak sayfasındaki başlık | 16pt (UKÜ), 18pt (YDÜ) |
| Kapak genel punto | Kapak sayfası diğer bilgiler | 14pt |
| Dipnot puntosu | Sayfa altı dipnotlar | 8pt (UKÜ), 10pt (YDÜ) |
| Tablo içi punto | Tablo içeriği | 10-12pt |
| Tablo/şekil minimum punto | Küçültülebilir alt sınır | 8pt |
| Sayfa numarası puntosu | Sayfa numarası boyutu | 11pt (UKÜ), 12pt (YDÜ) |
| Şekil başlığı puntosu | Şekil açıklaması | 10pt (YDÜ), 12pt (UKÜ) |

#### 4.9.3. Başlık Hiyerarşisi (5 Seviye)

Her seviye için ayrı ayrı tanımlanır:

| Parametre | Seviye 1 | Seviye 2 | Seviye 3 | Seviye 4 | Seviye 5 |
|---|---|---|---|---|---|
| Hizalama | Ortalı / Sola | Sola | Sola | Girintili (tab) | Girintili (tab) |
| Kalınlık | Bold | Bold | Bold | Bold | Bold |
| Eğiklik | Normal | Normal | İtalik | Normal | İtalik |
| Büyük/Küçük harf | TÜMÜ BÜYÜK / İlk harf büyük | İlk harf büyük | İlk harf büyük | İlk harf büyük | İlk harf büyük |
| Satır içi mi? | Hayır (ayrı satır) | Hayır | Hayır | Evet (metin devam eder) | Evet |
| Numaralandırma | Ondalık (1, 2, 3) | (1.1, 1.2) | (1.1.1) | (1.1.1.1) | Yok |
| Öncesi boşluk | 72pt (YDÜ) | 18pt | 12pt | 6pt | 6pt |
| Sonrası boşluk | 18pt | 12pt | 6pt | 0pt (satır içi) | 0pt |
| Yeni sayfa başlat? | Evet | Hayır | Hayır | Hayır | Hayır |

#### 4.9.4. Sayfa Numaralandırma

| Parametre | Açıklama | Örnek Değerler |
|---|---|---|
| Numarasız sayfalar | Hangi sayfalar numarasız | Dış kapak, iç kapak(lar), onay sayfası |
| Ön kısım numara tipi | İçindekiler öncesi bölümler | Romen rakamı küçük harf (i, ii, iii) |
| Ön kısım başlangıç değeri | İlk görünen Romen numarası | iii (değişken) |
| Ana metin numara tipi | Giriş'ten itibaren | Arap rakamı (1, 2, 3) |
| Numara konumu | Sayfadaki pozisyon | Alt orta (UKÜ) / Üst orta (YDÜ) / Sağ üst (YDÜ 2021) |
| Numaradan kenara mesafe | Kenardan uzaklık | 1.5cm (UKÜ) |
| Numara fontu | Sayfa numarası yazı tipi | Times New Roman |
| Numara puntosu | Sayfa numarası boyutu | 11pt (UKÜ), 12pt |
| Numara dekorasyon | Nokta/parantez/çizgi | Yok (YDÜ), değişken |

#### 4.9.5. Kapak Sayfaları

Şablon birden fazla kapak sayfası tanımlayabilir. Her kapak için:

| Parametre | Açıklama |
|---|---|
| Kapak sayısı | Kaç adet kapak sayfası (dış cilt, 1. iç, 2. iç) |
| Kapak tipi | Ciltli dış kapak / Normal kağıt iç kapak |
| Cilt rengi (derece bazlı) | YL: açık mavi, Doktora: bordo, Proje: siyah vb. |
| Yazı rengi (dış kapak) | Altın mürekkep, siyah vb. |
| Logo gösterilsin mi? | Sadece dış kapakta / Hiçbirinde / Hepsinde |
| İçerik sırası | Üniversite → Enstitü → Bölüm → Başlık → Tür → Ad → Danışman → Şehir/Tarih |
| Hangi kapakta danışman bilgisi? | Sadece 2. iç kapak (UKÜ) |
| Cilt sırt yazısı | Ad soyadı + Tez başlığı + Yıl |
| Kapak boyutu | Standart A4 / Özel (22.5x31cm dış cilt) |
| Element arası boşluklar | Her öğe arası punto cinsinden mesafe |
| Hizalama | Ortalı (tüm bilgiler) |

#### 4.9.6. Sabit Sayfa Şablonları

Motor aşağıdaki sabit sayfaları otomatik oluşturur. Admin her biri için metin taslağı ve format tanımlar:

| Sabit Sayfa | Açıklama | Çalışma türüne göre zorunlu/opsiyonel |
|---|---|---|
| Tez/Proje Onay Belgesi | Jüri üyeleri, imza alanları, savunma tarihi | Tez: zorunlu, Ödev: yok |
| Beyanname / Etik Beyan | Standart beyan metni + imza alanı | Tez: zorunlu, Ödev: opsiyonel |
| Teşekkür / Önsöz | Serbest metin + ad soyad + tarih + yer | Tez: opsiyonel, Ödev: yok |
| Özet (Türkçe) | Başlık + yazar + tarih + özet + anahtar kelimeler | Tez: zorunlu, Makale: zorunlu |
| Abstract (İngilizce) | Aynı yapı İngilizce | Tez: zorunlu, Makale: zorunlu |
| İçindekiler | Otomatik oluşturulur | Tez: zorunlu, Ödev: opsiyonel |
| Tablo Listesi | Otomatik (tablo varsa) | Otomatik |
| Şekil Listesi | Otomatik (şekil varsa) | Otomatik |
| Kısaltmalar Listesi | Kullanıcı girişi, alfabetik | Opsiyonel |
| Özgeçmiş | YÖK formatı veya serbest | Tez: zorunlu, Ödev: yok |

> Admin, her çalışma türü için hangi sabit sayfaların zorunlu/opsiyonel/gizli olduğunu ayarlayabilir.

#### 4.9.7. Bölüm Sıralaması (Section Order)

Admin, şablondaki bölüm sırasını sürükle-bırak ile ayarlayabilir. Kullanıcı da formatlama sırasında sırayı değiştirebilir (şablonun izin verdiği ölçüde).

#### 4.9.8. Tablo ve Şekil Formatı

| Parametre | Açıklama | Örnek |
|---|---|---|
| Tablo başlığı konumu | Tablonun üstü/altı | Üst (evrensel) |
| Şekil başlığı konumu | Şeklin üstü/altı | Alt (UKÜ/YDÜ), Üst (APA 7) |
| Numaralandırma sistemi | Bölüm bazlı / Sıralı | Tablo 2.1 veya Tablo 1 |
| Numara/başlık formatı | Bold mu, ayraç ne | **Tablo 2.1:** veya Tablo 1. |
| Kaynak gösterim konumu | Tablonun/şeklin altı | Alt |
| Devam formatı | Sayfa aşan tablolar | "Tablo X (devam):" |
| Devam sütun başlıkları | Tekrar yazılsın mı | Evet (UKÜ) |
| Tablo/şekil hizalama | Sayfada konum | Ortalı |
| Tablo çerçeve stili | Çizgi kuralları | Tam çerçeve / Sadece üst-alt (APA 7) |

#### 4.9.9. Denklem Formatı

| Parametre | Açıklama | Örnek |
|---|---|---|
| Denklem hizalama | Sayfada konum | Ortalı |
| Numara konumu | Numara yeri | Satırın en sağı |
| Numaralandırma sistemi | Bölüm bazlı | (1.1), (1.2), (2.1) |
| Alt denklem numaralandırma | Alt ifadeler | (1.1a), (1.1b) |
| Öncesi/sonrası boşluk | Denklem etrafı | 6pt + satır aralığı |
| Satır aralığı | Denklem içi | 1.5 |

#### 4.9.10. Kaynakça ve Atıf Sistemi

| Parametre | Açıklama | Örnek |
|---|---|---|
| Zorunlu atıf stili | Şablonun gerektirdiği stil | APA 7 (zorunlu) / Seçimli |
| Atıf yöntemi | Metin içi atıf türü | Parantezli referans / Dipnot / İkisi |
| Kaynakça satır aralığı | Kaynak listesi aralığı | 1.0 |
| Kaynakça girinti | İkinci satır girintisi | 4 harf / 1 tab (asılı girinti) |
| Kaynaklar arası boşluk | İki kaynak arası | 12pt |
| Kaynakça sıralaması | Sıralama kriteri | Soyada göre alfabetik |

#### 4.9.11. Kısıtlamalar ve Uyarılar

| Parametre | Açıklama | Örnek |
|---|---|---|
| Özet kelime limiti (min/max) | Min-max kelime sayısı | 200-400 |
| Ana metin kelime limiti | Alan ve derece bazlı | 10.000-25.000 (Sosyal, YL) |
| İntihal eşiği (toplam) | Max toplam alıntı oranı | %20 |
| İntihal eşiği (tek kaynak) | Tek kaynaktan max | %2 |
| Anahtar kelime sayısı | Min/max | 3-7 |

---

### 4.10. Kaynakça Zekası — Doğrulama, Uyarı ve Otomatik Dönüştürme

Bu modül, motorun en değerli farklılaştırıcı özelliğidir. Kullanıcının mevcut kaynakçasını analiz eder, seçilen formata uygunluğunu kontrol eder ve gerektiğinde otomatik stil dönüştürme yapar.

#### 4.10.1. Kaynakça Stil Algılama

Motor, yüklenen belgedeki mevcut kaynakçayı analiz ederek hangi stilde yazıldığını tespit eder:

- Parantezli yazar-tarih → APA
- Numaralı referans [1], [2,3] → Vancouver / IEEE / MDPI
- Dipnot bazlı → Chicago / Turabian
- Üst simge numarası → Vancouver (bazı varyantlar)

Güven skoru ile tespit sonucu kullanıcıya bildirilir: "Kaynakçanız APA 6 formatında görünüyor."

#### 4.10.2. Kaynakça Format Doğrulama

Motor, her bir kaynakça girişini ve metin içi atıfı seçilen hedef formata karşı kontrol eder:

**Metin içi atıf kontrolleri:**
- Yazar-tarih formatı doğru mu? (APA: (Smith, 2020) vs Vancouver: [1])
- Çoklu yazar kuralı doğru mu? (APA: 3+ yazar "ve diğ." / "et al.")
- Parantez/köşeli parantez kullanımı doğru mu?
- Sayfa numarası gösterimi doğru mu? (APA: (Smith, 2020, s. 45) vs MDPI: [1] (p. 45))
- Metin içi atıf ile kaynakça listesi eşleşiyor mu? (eksik/fazla kaynak var mı?)

**Kaynakça listesi kontrolleri:**
- Yazar adı formatı doğru mu? (APA: Smith, J. vs Vancouver: Smith J vs MDPI: Smith, J.)
- Sıralama doğru mu? (APA: alfabetik vs Vancouver: metin içi geçiş sırasına göre)
- İtalik/düz metin kuralları doğru mu? (dergi adı italik mi? kitap adı italik mi?)
- Tarih konumu doğru mu? (APA: parantez içinde yıldan sonra vs Vancouver: satır sonunda)
- DOI/URL formatı doğru mu?
- Cilt, sayı, sayfa gösterimi doğru mu? (APA: 12(3), 45-67 vs Vancouver: 12(3):45-67)
- Noktalama tutarlı mı? (nokta, virgül, noktalı virgül kullanımı)

#### 4.10.3. Uyumsuzluk Raporlama

Doğrulama sonuçları canlı düzenleme arayüzünde gösterilir:

- Her uyumsuz kaynakça girişi **sarı ile vurgulanır**
- Kullanıcı vurgulanan öğeye tıkladığında detaylı açıklama görür:
  - "Bu atıf APA formatında yazılmış ama seçilen format Vancouver. Dönüştürmek ister misiniz?"
  - "Yazar sıralaması yanlış: APA 'Smith, J.' gerektiriyor, mevcut format 'J. Smith'"
  - "Bu metin içi atıfın kaynakça listesinde karşılığı bulunamadı"
  - "Kaynakça listesindeki bu kaynak metin içinde hiç atıf edilmemiş"
- Toplu istatistik: "Kaynakçanızda 47 giriş var. 12'si seçilen formata uymuyor. 3 kaynak metin içinde atıf edilmemiş."

#### 4.10.4. Otomatik Stil Dönüştürme

Kullanıcı tek tıkla kaynakça stilini dönüştürebilir:

**Desteklenen dönüşümler (örnekler):**
- APA 7 → Vancouver
- APA 7 → IEEE
- APA 7 → MDPI (numaralı)
- Vancouver → APA 7
- Chicago → APA 7
- Herhangi bir stil → Herhangi bir stil

**Dönüştürme kapsamı:**
- Metin içi atıflar otomatik güncellenir (yazar-tarih ↔ numara)
- Kaynakça listesi formatı güncellenir (yazar adı sırası, italik, noktalama, tarih konumu)
- Kaynakça sıralaması güncellenir (alfabetik ↔ atıf sırasına göre)
- Numaralandırma sistemi güncellenir (parantezli ↔ köşeli parantez ↔ üst simge)

**Dönüştürme akışı:**
1. Kullanıcı mevcut stili onaylar (veya sistem algılar)
2. Kullanıcı hedef stili seçer (dropdown)
3. Sistem önizleme gösterir: "3 örnek kaynağınız dönüştürme sonrası böyle görünecek"
4. Kullanıcı onaylar
5. Motor tüm kaynakçayı ve metin içi atıfları toplu dönüştürür
6. Dönüştürülemeyen veya belirsiz girişler sarı ile işaretlenir — kullanıcı manuel düzeltir

#### 4.10.5. Desteklenen Kaynakça Stilleri

Admin panelinden yeni stil eklenebilir. Varsayılan olarak desteklenen stiller:

| Stil | Metin İçi Format | Kaynakça Sıralaması |
|---|---|---|
| APA 7 | (Smith, 2020) | Alfabetik |
| APA 6 | (Smith, 2020) | Alfabetik |
| Vancouver | [1] | Atıf sırasına göre |
| IEEE | [1] | Atıf sırasına göre |
| MDPI / Nutrients | [1] veya [1,3] | Atıf sırasına göre |
| Chicago (Author-Date) | (Smith 2020) | Alfabetik |
| Chicago (Notes-Bib) | Dipnot | Alfabetik |
| Harvard | (Smith 2020) | Alfabetik |
| MLA | (Smith 45) | Alfabetik |
| Turabian | Dipnot veya Author-Date | Değişken |
| AMA | Üst simge numara | Atıf sırasına göre |
| NLM | (1) | Atıf sırasına göre |

Her stil için kaynak türüne göre (dergi makalesi, kitap, kitap bölümü, tez, web sitesi, konferans bildirisi, yasa, arşiv belgesi vb.) ayrı format kuralları tanımlıdır.

---

### 4.11. Dergi Şablonu Ek Parametreleri

Dergi formatları, tez formatlarından farklı gereksinimler içerir. MDPI, Elsevier, Springer gibi yayınevlerinin kılavuzlarından çıkarılan ek parametreler:

#### 4.11.1. Makale Yapısı

| Parametre | Açıklama |
|---|---|
| Zorunlu bölümler | Introduction, Materials and Methods, Results, Discussion, Conclusions |
| Back matter bölümleri | Author Contributions (CRediT), Funding, Data Availability, Ethics Statement, Conflicts of Interest |
| Makale türleri | Article, Review, Communication, Brief Report, Letter, Comment (admin tanımlar) |
| Makale türüne göre kelime limiti | Article: 5000-10000, Review: 8000-15000, Comment: max 450 kelime vb. |
| Makale türüne göre bölüm yapısı | Her makale türü farklı zorunlu bölümler içerebilir |

#### 4.11.2. Özet Formatı (Yapılandırılmış Özet)

Bazı dergiler düz özet yerine yapılandırılmış özet ister:

| Parametre | Açıklama |
|---|---|
| Özet tipi | Düz metin / Yapılandırılmış (başlıklı) |
| Yapılandırılmış özet başlıkları | Background/Objectives, Methods, Results, Conclusions (MDPI) |
| Özet kelime limiti | ~250 kelime (MDPI), dergiye göre değişken |
| Anahtar kelime sayısı | 3-10 (MDPI), dergiye göre değişken |

#### 4.11.3. Grafik Özet (Graphical Abstract)

| Parametre | Açıklama |
|---|---|
| Grafik özet zorunlu mu? | Evet/Hayır/Opsiyonel |
| Minimum boyut | 560×1100 piksel (MDPI) |
| Kabul edilen formatlar | PNG, JPEG, TIFF |
| Yerleşim | Metin özetinin altında |

#### 4.11.4. Referans Numaralandırma (Dergi Spesifik)

| Parametre | Açıklama |
|---|---|
| Metin içi referans formatı | Köşeli parantez [1], parantez (1), üst simge¹ |
| Referans-noktalama sırası | Noktalamadan önce [1]. veya sonra .[1] |
| Çoklu referans formatı | [1,3] veya [1-3] veya [1; 3] |
| Gömülü atıf formatı | [5] (p. 10) veya [6] (pp. 101-105) |

#### 4.11.5. Yazar ve Kurum Bilgileri

| Parametre | Açıklama |
|---|---|
| ORCID zorunlu mu? | Evet/Hayır |
| CRediT rolleri zorunlu mu? | Evet/Hayır |
| Corresponding author gösterimi | Yıldız (*), üst simge |
| Eşit katkı gösterimi | (†) simgesi + açıklama metni |
| Kurum adresi formatı | Tam adres / Şehir+Ülke |

---

### 4.12. Şablon Kategorileri

Admin panelinde şablonlar kategorize edilir:

- Türk Üniversiteleri Tez Kılavuzları
- YÖK Tez Formatı
- Dergipark Dergi Şablonları
- Uluslararası Dergi Formatları
- Ödev / Rapor Formatları
- Kaynakça Yazım Stilleri (APA 7, IEEE, Vancouver, Chicago, Harvard, MLA vb.)
- Kullanıcı Tarafından Oluşturulan (admin tarafından terfi ettirilmiş)

### 4.13. Tekrar Formatlama

- Kullanıcı aynı belge için parametreleri değiştirip tekrar deneme yapabilir.
- Limit ve ücret admin panelinden yönetilir.

### 4.14. Dosya Versiyonlama

- Tüm formatlama versiyonları saklanır (v1, v2, v3...).
- Kullanıcı geçmiş versiyonlarını görebilir.

---

## 5. Analiz Hizmeti (İnsan Destekli)

### 5.1. Talep Oluşturma

1. Kullanıcı analiz kategorisi seçer (admin panelinden yönetilen sabit kategori listesi).
2. Kullanıcı ayrı yükleme alanlarından dosyalarını yükler:
   - **Ham veri dosyası** (Excel, CSV, SPSS .sav vb.)
   - **Açıklama/Brief formu** (değişken tanımları, hipotezler, araştırma soruları)
   - **Örnek çıktı/makale** (isteğe bağlı)
3. Kullanıcı ek hizmetler (add-on) seçer:
   - Tablo yorumu, belirli yazılım çıktısı, PDF rapor vb.
   - Her add-on ayrı fiyatlandırılır (admin panelinden yönetilir)

### 5.2. Ticket ve Uzman Atama

- Talep oluşturulduğunda otomatik ticket açılır.
- Otomatik atama: Uzmanlık alanı tag'leri + iş yükü dengeleme.
- Uzman izole erişim — yalnızca kendi ticketlarını görür.

### 5.3. Fiyatlandırma ve Ödeme Akışı

- Baz fiyat: Analiz kategorisine göre admin belirler.
- Uzman ayarlaması: Uzman fiyat teklifi verebilir.
- Add-on ücretleri otomatik eklenir.
- Müşteri onayı zorunlu — onay olmadan ödeme alınmaz.

### 5.4. Teslim Süresi (SLA)

- Uzman ticket bazında teslim süresi belirler.
- Express/acil teslimat: Admin panelinden açılıp kapatılabilir.
- Süre aşımı: Otomatik bildirim, uzman karar verir.

### 5.5. Revizyon Politikası

- Admin panelinden ayarlanabilir revizyon sayısı.
- Aşımda ek ücretli revizyon (admin belirler).
- Her revizyon ayrı versiyon olarak saklanır.

### 5.6. Sonuç Teslimi ve Versiyonlama

- Uzman sonuçları ticket üzerinden yükler.
- Tüm versiyonlar saklanır.

### 5.7. Müşteri Memnuniyeti

- Ticket kapanınca yıldız puanlama (1-5) + yorum alanı.

---

## 6. Dahili Mesajlaşma

- Ticket bazlı threaded messaging.
- Müşteri ↔ Uzman ↔ Admin arası iletişim.
- Gerçek zamanlı (WebSocket).
- Dosya paylaşımı destekli.

---

## 7. Bildirim Sistemi

### 7.1. Bildirim Kanalları

- **E-posta** (zorunlu fallback)
- **In-app** (gerçek zamanlı, WebSocket)
- **WhatsApp** (Business API)
- **Telegram** (Bot API)

Her kanal admin panelinden açılıp kapatılabilir.

### 7.2. Bildirim Olayları

Ticket açıldı/atandı/güncellendi, yeni mesaj, önizleme hazır, ödeme alındı/başarısız, dosya teslim edildi, revizyon istendi, deadline yaklaşıyor/aşıldı, uzman fiyat teklifi verdi.

### 7.3. Kullanıcı Tercihleri

- Olay bazında kanal seçimi (profil ayarlarından).

### 7.4. Fallback

- Çevrimdışı kullanıcılara e-posta fallback.

---

## 8. Fiyatlandırma ve Ödeme Altyapısı

### 8.1. Fiyatlandırma Modeli

- **Formatlama:** Admin panelinden esnek — sabit/dinamik/hibrit. Admin strateji seçer ve değiştirebilir.
- **Analiz:** Kategori baz fiyat + uzman teklif ayarlaması + add-on ücretleri. Müşteri onayı zorunlu.

### 8.2. Ödeme Modelleri

- Tek seferlik ödeme + Abonelik (birlikte desteklenir).

### 8.3. Ödeme Altyapıları

- Stripe Payments (tek seferlik) + Stripe Billing (abonelik) + PayPal.

### 8.4. Para Birimi

- Çoklu para birimi, GeoIP bazlı otomatik + manuel değiştirme.

### 8.5. Kupon ve İndirimler

- Kupon kodu doğrulama checkout'ta.
- SheerID ile öğrenci doğrulaması.

---

## 9. Sistem Sınırları ve Güvenlik

### 9.1. Dinamik Dosya Kısıtlamaları

- Admin panelinden dosya boyutu (MB) ve sayfa sayısı limitleri.
- Hizmet türüne göre farklı limitler.

### 9.2. Hibrit Güvenlik Taraması

- ClamAV ve/veya VirusTotal API.
- Admin panelinden açma/kapatma ve sağlayıcı seçimi.

### 9.3. Önizleme Güvenliği

- Bkz. Madde 4.5.

---

## 10. Lokalizasyon ve Çoklu Dil Desteği

### 10.1. Arayüz Dilleri

- Türkçe + İngilizce varsayılan. Admin panelinden yeni dil eklenebilir (i18n).

### 10.2. Dil Seçim Mekanizması

- Tarayıcı dili otomatik → kullanıcı değiştirirse profilde saklanır.

### 10.3. Akademik Şablon Dili

- Şablonlar dil bağımsız. Etiketler çok dilli tanımlanabilir.

---

## 11. Admin Paneli — Analitik ve Raporlama

### 11.1. Gerçek Zamanlı Dashboard

- Gelir metrikleri, operasyonel metrikler, uzman performansı, kullanıcı metrikleri, formatlama metrikleri (en çok kullanılan şablonlar, hata oranları).

### 11.2. Raporlar

- Haftalık/aylık otomatik e-posta raporu.
- Excel + PDF export.
- Özel rapor oluşturma (tarih aralığı, filtreler).

### 11.3. Müşteri Memnuniyeti

- Puan trendleri, yorum analizleri, uzman bazında kırılım.

---

## 12. Yasal Uyum ve Veri Koruma

### 12.1. Regülasyon

- KVKK + GDPR. Politikalar admin panelinden yönetilebilir.

### 12.2. Unutulma Hakkı

- Hesap + kişisel veri silinir, anonim analitik kalır.

### 12.3. Yasal Metinler

- Kullanım Sözleşmesi, Gizlilik Politikası, Çerez Politikası, KVKK Aydınlatma Metni.
- Platform hazır şablon üretir, admin düzenleyebilir.

### 12.4. Çerez Yönetimi

- İlk ziyarette onay banner'ı. Kullanıcı tercihleri yönetebilir.

### 12.5. Veri Saklama Süreleri

- Aktif hesap: aktif olduğu sürece.
- Silinen hesap: kişisel veri hemen silinir, anonim analitik kalır.
- Dosya saklama süresi: admin panelinden ayarlanır.

---

## 13. Teknik Altyapı Notları

### 13.1. Dosya Depolama

- S3 veya eşdeğeri güvenli depolama.
- Tüm versiyonlar ayrı saklanır.
- Saklama süreleri admin panelinden yönetilir.

### 13.2. Gerçek Zamanlı Altyapı

- WebSocket: in-app bildirimler + mesajlaşma.
- Fallback: e-posta.

### 13.3. Entegrasyonlar

| Entegrasyon | Amaç |
|---|---|
| Stripe Payments | Tek seferlik ödemeler |
| Stripe Billing | Abonelik yönetimi |
| PayPal | Alternatif ödeme |
| SheerID | Öğrenci doğrulama |
| ClamAV | Sunucu tabanlı virüs tarama |
| VirusTotal API | Harici virüs tarama |
| WhatsApp Business API | Bildirim kanalı |
| Telegram Bot API | Bildirim kanalı |
| GeoIP | Lokasyon bazlı para birimi ve dil |

### 13.4. Admin Paneli Yönetim Alanları Özeti

- Formatlama şablonları (kapsamlı form tabanlı tanımlama — bkz. Madde 4.2)
- Kaynakça stilleri
- Analiz kategorileri ve baz fiyatları
- Add-on hizmetler ve ücretleri
- Fiyatlandırma stratejisi
- Express teslimat ayarları
- Revizyon sayısı limiti ve ek revizyon ücreti
- Tekrar formatlama limiti ve ücreti
- Dosya boyutu ve sayfa sayısı limitleri
- Güvenlik tarama ayarları
- Bildirim kanalları
- Dil ekleme (i18n)
- Duyuru bandı içeriği
- Yasal metinler
- Kupon kodları
- Abonelik planları
- Dosya saklama süreleri
- Uzman yönetimi
- Analitik dashboard ve raporlama

---

## 14. Kullanıcı Akış Şemaları

### 14.1. Formatlama Akışı (6 Faz)

```
[FAZ 1] Giriş ve Yükleme
  → Dosya Yükleme (.docx) / Metin Yapıştırma (online editör)
  → Çalışma türü seçimi (admin yönetimli esnek liste)

[FAZ 2] Şablon Seçimi / Özel Format
  → Seçenek A: Mevcut resmi şablondan seç
  → Seçenek B: Mevcut şablonu klonla + düzenle → kişisel şablon olarak kaydet
  → Seçenek C: Sıfırdan özel format oluştur (soru-cevap wizard)

[FAZ 3] Belge Analizi (Otomatik)
  → Başlık algılama (font, bold, numara deseni)
  → Tablo/şekil/denklem tespiti
  → Yapı haritası çıkarma (güven skorlu: 🟢🟡🔴)
  → Kelime sayısı hesaplama

[FAZ 4] Etkileşimli Yapı Düzenleme (Canlı Önizleme)
  → Algılama sonuçlarını onayla / düzelt
  → Başlık düzeylerini değiştir (dropdown / sürükle)
  → Sayfa numaralandırma geçiş noktasını ayarla
  → Bölüm sırasını sürükle-bırak ile düzenle
  → Tablo/şekil/denklem numaralandırmayı düzelt
  → Split View veya WYSIWYG modu (kullanıcı seçer)
  → Her değişiklik anında önizlemede yansır

[FAZ 5] Wizard — Ek Bilgi Girişi
  → Kapak bilgileri (üniversite, başlık, ad, danışman, tarih)
  → Onay sayfası (jüri, savunma tarihi)
  → Beyanname / Etik beyan
  → Teşekkür / Önsöz
  → Özet + anahtar kelimeler (TR + EN)
  → Kısaltmalar listesi
  → Özgeçmiş
  → (Çalışma türüne göre bazı adımlar atlanır)

[FAZ 6] Son Kontrol, Ödeme ve İndirme
  → Otomatik doğrulama (kelime sayısı, numara tutarlılığı, eksik bölüm)
  → Uyarı gösterimi (⛔ Hata / ⚠️ Uyarı / ℹ️ Bilgi)
  → Korumalı önizleme (watermark, indirilemez)
  → Ödeme
  → İndirme (Word / PDF / İkisi)

↩️ Kullanıcı FAZ 4-5-6 arasında serbestçe geri dönebilir
```

### 14.2. Analiz Akışı

```
Kullanıcı Girişi
  → Kategori Seçimi
    → Dosya Yükleme (Ayrı Alanlar: veri + açıklama + örnek)
      → Add-on Seçimi
        → Ticket Açılır
          → Otomatik Uzman Ataması
            → Uzman Fiyat Teklifi
              → Müşteri Onayı → Ödeme
                → Uzman Çalışır → Sonuç Teslimi
                  → Müşteri İndirme
                    → Puanlama/Yorum → Ticket Kapanır
```

---

## 15. Versiyon Değişiklik Özeti

### v3 → v4 (Etkileşimli Motor ve Özel Format Desteği)

| Alan | v3 | v4 |
|---|---|---|
| Motor akışı | Tek yönlü wizard | 6 fazlı etkileşimli akış, her aşamada geri dönüş |
| Başlık algılama | Belirtilmemiş | Hibrit: otomatik algılama + güven skoru + kullanıcı düzeltme |
| Canlı önizleme | Yok | Split View + WYSIWYG, her değişiklik anında yansır |
| Hata düzeltme | Wizard sırasında | Her aşamada + undo/redo desteği |
| Özel format | Sadece admin oluşturur | Kullanıcı da oluşturabilir (sıfırdan veya klon) |
| Kişisel şablonlar | Yok | Kullanıcı profilinde saklanır, admin terfi ettirebilir |
| Çalışma türleri | Sabit liste | Admin panelinden esnek liste (ekle/çıkar/düzenle) |
| Sayfa numaralandırma düzeltme | Otomatik, düzeltilemez | Kullanıcı geçiş noktasını ve konumu düzenleyebilir |
| Doğrulama sistemi | Temel uyarılar | 3 seviyeli (Hata/Uyarı/Bilgi) + tıkla-düzelt |
| Kaynakça zekası | Yok | Tam modül: algılama, doğrulama, uyarı, otomatik stil dönüştürme |
| Dergi şablonu desteği | Temel | Yapılandırılmış özet, grafik özet, CRediT, back matter, makale türleri |
| Sabit sayfa yönetimi | Tüm çalışma türleri aynı | Çalışma türü bazında zorunlu/opsiyonel/gizli |

### v2 → v3 (Şablon Detaylandırma)

| Alan | v2 | v3 |
|---|---|---|
| Motor kapsamı | Metin formatı | Tam belge (kapak→özgeçmiş) |
| Şablon parametreleri | ~15 genel alan | 80+ detaylı alan (11 kategori) |
| Kapak desteği | Tek kapak | Çoklu kapak + cilt rengi + sırt yazısı |
| Başlık seviyeleri | Belirtilmemiş | 5 seviye, her biri ayrı format |
| Denklem desteği | Yok | Tam destek |
| Kısıtlamalar | Yok | Kelime limitleri, özet limiti, intihal eşiği |

---


---

## 16. Kimlik Doğrulama ve Güvenlik Genişletmeleri (v5)

### 16.1. Giriş Yöntemleri
- Email + şifre (varsayılan)
- Google OAuth (kurumsal e-posta için ideal)
- SheerID ile öğrenci doğrulama (ayrı akış)

### 16.2. İki Faktörlü Doğrulama (2FA)
- Opsiyonel — kullanıcı ve admin profilinden açılıp kapatılabilir
- Desteklenen yöntemler:
  - **WhatsApp kodu** (WhatsApp Business API üzerinden)
  - **Telegram kodu** (Telegram Bot API üzerinden)
  - **Authenticator app** (Google Authenticator, Authy, 1Password — TOTP standardı)
- SMS desteklenmez (maliyet ve güvenlik nedeniyle)
- Kullanıcı birden fazla yöntem kayıt edebilir (yedek olarak)

### 16.3. Admin Impersonation (Kullanıcı Adına Giriş)
- Admin, destek amacıyla herhangi bir kullanıcının hesabına geçici olarak giriş yapabilir
- Her impersonation oturumu audit log'a kaydedilir (hangi admin, hangi kullanıcı, ne zaman, ne süreyle, hangi işlemler)
- Kullanıcı profilinde "Son impersonation aktiviteleri" görünür
- Admin impersonation sırasında banner gösterilir: "Admin olarak X kullanıcısı adına giriş yaptınız"
- Impersonation sırasında ödeme yapılamaz (güvenlik kısıtı)

### 16.4. Rate Limiting (Plan Bazlı Dinamik)
- Rate limit, kullanıcının abonelik planına göre değişir
- Ücretsiz plan: düşük limit, Premium plan: yüksek limit
- Endpoint bazında ayrıca sınırlar (upload/download/API çağrısı farklı)
- Admin panelinden plan bazında limit ayarlanabilir
- Rate limit aşıldığında kullanıcıya net uyarı mesajı + upgrade önerisi

### 16.5. Audit Log (Kapsamlı Denetim Kaydı)
Tüm kullanıcı ve sistem olayları loglanır:
- Giriş/çıkış, başarısız giriş denemeleri
- Dosya yükleme, indirme, silme
- Formatlama işlemleri (başlangıç, tamamlanma, hata)
- Şablon oluşturma, düzenleme, silme
- Ödeme olayları
- Admin işlemleri (kullanıcı düzenleme, şablon onaylama, ayar değiştirme)
- Impersonation oturumları
- Ticket olayları (oluşturma, atama, mesajlaşma, kapatma)

Audit log arayüzü:
- Admin panelinden filtrelenebilir (kullanıcı, tarih, olay türü)
- Export (Excel/CSV)
- Saklama süresi admin panelinden ayarlanabilir

---

## 17. Versiyonlama Sistemi (v5)

### 17.1. Versiyon Tipleri (7 Tip)

| Tip | Açıklama | Oluşma Zamanı |
|---|---|---|
| **raw** | Kullanıcının yüklediği orijinal belge | Upload sırasında |
| **working** | Aktif düzenleme durumu (autosave ile güncellenir) | Düzenleme sırasında sürekli |
| **formatted** | Motor tarafından formatlanmış çıktı | FAZ 6 sonrası |
| **revision** | Kullanıcının manuel snapshot aldığı ara versiyon | Kullanıcı "Snapshot al" butonuna bastığında |
| **preview** | Ödeme öncesi watermark'lı önizleme | Önizleme oluşturulduğunda |
| **final** | Ödeme sonrası teslim edilen son versiyon | Ödeme tamamlandığında |
| **archive** | Kullanıcı veya sistem tarafından arşivlenen eski versiyonlar | Manuel veya otomatik |

### 17.2. Immutable Versioning
- Versiyonlar **değiştirilemez** (immutable)
- Bir versiyonu geri yüklemek yeni bir versiyon oluşturur (eski versiyon korunur)
- Otomatik kaydetme (autosave) yeni versiyon oluşturmaz — sadece `working` versiyonunu günceller
- Manuel snapshot (kullanıcı butonla) yeni `revision` tipinde versiyon oluşturur

### 17.3. Versiyon Yönetimi Arayüzü
- Kullanıcı tüm versiyonları listeleyebilir (zaman damgası + tip + etiket)
- Versiyonlar arası fark (diff) görüntüleme
- Herhangi bir versiyona geri dönme (yeni versiyon olarak)
- Eski versiyonları arşivleme
- Versiyon etiketleme (ör: "Danışmana gönderilen v1")

---

## 18. İzleme, Log ve DevOps (v5)

### 18.1. Error Tracking
- **Sentry** entegrasyonu zorunlu (hem frontend hem backend)
- Custom logging katmanı (yapılandırılmış JSON log)
- Log seviyeleri: DEBUG, INFO, WARN, ERROR, CRITICAL
- Kritik hatalar admin'e anlık bildirim gönderir

### 18.2. Metrics & Monitoring
- **Prometheus** — metrik toplama
- **Grafana** — görselleştirme ve dashboard
- İzlenen metrikler:
  - API response time (p50, p95, p99)
  - Queue işlem süreleri (BullMQ)
  - Veritabanı sorgu süreleri
  - Aktif kullanıcı sayısı (gerçek zamanlı)
  - Hata oranları
  - Formatlama işlem başarı oranı
  - Ödeme başarı/başarısızlık oranı

### 18.3. Deployment (Docker Compose)
- Başlangıçta Docker Compose ile tek sunucu deployment
- Servisler: backend, frontend, postgres, redis, minio (S3), nginx
- Environment variables ile yapılandırma (.env)
- Gelecekte Kubernetes'e geçiş için hazır yapı

### 18.4. CI/CD (GitHub Actions)
- Pull request'lerde otomatik:
  - Linting (ESLint, Prettier)
  - Type check (TypeScript)
  - Unit testler (Jest)
  - E2E testler (Playwright)
  - Test coverage raporu
  - Security scan (npm audit, Snyk)
- Main branch'e merge sonrası:
  - Otomatik Docker image build
  - Staging ortamına deploy
  - Production'a manuel onay ile deploy

### 18.5. Veritabanı Backup
- Admin panelinden backup sıklığı ayarlanabilir:
  - Günlük / Haftalık / Aylık
  - Tam backup / Incremental backup
- Backup dosyaları ayrı S3 bucket'a yüklenir
- Otomatik restore testi (haftalık)
- Saklama süresi admin panelinden ayarlanabilir

### 18.6. Test Stratejisi
- **Jest** — unit testler (servis, yardımcı fonksiyonlar)
- **Playwright** — E2E testler (kritik kullanıcı akışları)
- **Supertest** — API entegrasyon testleri
- Test coverage minimum %80 hedef
- Coverage raporu CI/CD'de otomatik oluşturulur

### 18.7. API Dokümantasyonu
- **Swagger / OpenAPI** — otomatik oluşturulan API dokümantasyonu
- **Postman Collection** — manuel test için
- Her ikisi de admin panelinden aktif/pasif yapılabilir (production'da kapatılabilir)

### 18.8. Frontend Component Library
- **Storybook** — component kütüphanesi
- Her reusable component için story yazılır
- Design system belgelendirilir
- Dark/Light mode preview desteği

---

## 19. UX ve Erişilebilirlik (v5)

### 19.1. Tema Desteği
- **Light Mode** (varsayılan)
- **Dark Mode**
- **System** (OS ayarına göre otomatik değişir)
- Kullanıcı tercihi profilinde saklanır
- Tema değişimi anlık (sayfa yenileme gerektirmez)

### 19.2. Erişilebilirlik (WCAG 2.1 AA)
- Screen reader uyumluluğu (ARIA etiketleri)
- Klavye navigasyonu (tüm işlemler klavye ile yapılabilmeli)
- Renk kontrastı en az 4.5:1
- Alt text tüm görsellerde
- Focus göstergeleri net
- Form hata mesajları açıklayıcı
- Otomatik erişilebilirlik testi CI/CD'de (axe-core)

### 19.3. Responsive Web
- Mobil, tablet, desktop desteği
- Breakpoint'ler: 320px, 768px, 1024px, 1440px
- PWA değil (ilerde eklenebilir)
- Native mobile app planı yok

---

## 20. Ek İş Özellikleri (v5)

### 20.1. Müşteri Destek Sistemi
- **WhatsApp canlı destek** (WhatsApp Business API üzerinden)
- **Telegram canlı destek** (Telegram Bot üzerinden)
- Platform içinde destek butonu → kullanıcı tercih ettiği kanala yönlendirilir
- Admin panelinden destek kanalları açılıp kapatılabilir
- Çalışma saatleri tanımlanabilir (mesai dışında otomatik mesaj)
- Destek geçmişi kullanıcı profilinde saklanır (ticket entegrasyonu değil, sadece log)

### 20.2. Affiliate / Referans Programı
- Her kullanıcıya benzersiz referans kodu atanır
- Kullanıcı referans linkini paylaşır
- Yeni kullanıcı referans ile kayıt olursa:
  - Yeni kullanıcıya indirim kuponu (admin tanımlar)
  - Referans veren kullanıcıya kredi/indirim (admin tanımlar)
- Referans istatistikleri kullanıcı profilinde:
  - Toplam referans sayısı
  - Dönüşen referans sayısı
  - Kazanılan kredi/indirim
- Admin panelinden:
  - Affiliate oran ayarları
  - Ödeme/kredi eşikleri
  - Hile tespit (aynı IP'den çoklu kayıt vb.)

---

## 21. Modül Listesi (v5)

Platform aşağıdaki modüller halinde organize edilir:

| Modül | Açıklama |
|---|---|
| `auth` | Kimlik doğrulama, JWT, 2FA, OAuth, impersonation |
| `users` | Kullanıcı profili, tercihler, akademik unvan |
| `documents` | Belge yönetimi, metadata |
| `document_versions` | Immutable versiyon sistemi (7 tip) |
| `document_sections` | AST yapısı, bölüm modeli |
| `formatting` | Formatlama motoru, kaskad güncellemeler |
| `templates` | Şablon sistemi, kişisel şablonlar |
| `citations` | Kaynakça zekası, stil dönüştürme |
| `analysis` | Analiz ticket sistemi |
| `expert_profiles` | Uzman profilleri, uzmanlık tagları |
| `messaging` | Ticket bazlı mesajlaşma, WebSocket |
| `payments` | Stripe + PayPal + kupon sistemi |
| `subscriptions` | Abonelik yönetimi (Stripe Billing) |
| `notifications` | 4 kanallı bildirim (email, in-app, WhatsApp, Telegram) |
| `admin` | Admin paneli, sistem ayarları |
| `analytics` | Dashboard, raporlar, metrikler |
| `audit` | Audit log sistemi |
| `integrations` | 3. parti entegrasyonlar (SheerID, virüs tarama vb.) |
| `support` | Müşteri destek (WhatsApp/Telegram) |
| `affiliate` | Referans programı |
| `ai` | AI modülü (opsiyonel, placeholder) |
| `localization` | i18n, çoklu dil, para birimi |
| `legal` | KVKK/GDPR, yasal metinler, unutulma hakkı |

---

## 22. Çözüm Yaklaşımları (Rule-Based + Opsiyonel AI)

### 22.1. Başlık Algılama Yaklaşımı
**Varsayılan (Rule-Based):**
- Font boyutu analizi (gövde metinden büyük olanlar)
- Font kalınlığı (bold)
- Numaralandırma deseni (regex: `^\d+\.`, `^\d+\.\d+\.`, vb.)
- Satır uzunluğu (başlıklar genelde kısa)
- Sonraki satırda boşluk var mı?
- Word stili (Heading 1, Heading 2)

**Opsiyonel AI Modülü:**
- Admin panelinden açılabilir
- Daha karmaşık durumlarda (başlık stili yok, font aynı) AI yardımı
- OpenAI API veya local LLM (Ollama)
- AI açıksa: güven skoru düşük olan durumlarda AI'ya danışılır

### 22.2. Kaynakça Stil Algılama
**Varsayılan (Rule-Based):**
- Regex pattern matching (parantez, köşeli parantez, yıl deseni)
- Format kuralları (yazar adı sırası, italik, noktalama)
- Stil veritabanı karşılaştırması

**Opsiyonel AI Modülü:**
- Belirsiz durumlarda AI'ya danışılır
- Admin panelinden açılabilir

### 22.3. AI Modülü Kuralı
- AI **hiçbir zaman zorunlu dependency değildir**
- AI kapalıyken sistem tam çalışmalıdır
- AI açıkken sadece kaliteyi artırır
- AI çağrıları queue üzerinden yapılır (senkron değil)

---

*v5 Ek Modülleri burada sona erer. Madde 1-15 v4'ten miras alınmıştır.*

*Bu şartname, gerçek üniversite tez yazım kılavuzlarından (UKÜ, YDÜ, YDÜ 2021/APA7) çıkarılan gereksinimler ve etkileşimli UX tasarım kararlarıyla zenginleştirilmiştir. v5 MASTER_PROJECT.md entegrasyonu ile genişletilmiştir. Teknik detaylar için MASTER_IMPLEMENTATION.md dosyasına bakınız.*
