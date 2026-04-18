# MASTER IMPLEMENTATION — Teknik Mimari ve Geliştirme Yol Haritası

> **Amaç:** Bu dosya, `project_v5.md`'de tanımlanan ürün gereksinimlerinin nasıl inşa edileceğini belirler. Her task, v5'teki ilgili maddeye referans verir.
>
> **Kullanım:** AI destekli geliştirme (vibe coding) için task'lar batch halinde uygulanır. Her batch sonrası durup değerlendirme yapılır.

---

## 1. SİSTEM AMACI

Akademik belge formatlama ve istatistiksel analiz SaaS platformu. Detaylar için bkz. `project_v5.md` Madde 1.

**Kritik Notlar:**
- Bu bir marketplace DEĞİLDİR. Uzmanlar ve adminler şirket çalışanıdır.
- Formatlama tamamen otomatiktir (insan müdahalesi yoktur).
- Analiz insan destekli ticket sistemidir.

---

## 2. HARD RULES (KESİN KURALLAR)

- ❌ Her şeyi tek dosyada yazma — modüler mimari zorunlu
- ❌ AI zorunlu dependency olarak kullanma (bkz. v5 Madde 22)
- ❌ Ağır işleri HTTP request içinde yapma
- ✅ Ağır işler için queue kullan (BullMQ)
- ✅ Dosyalar S3-uyumlu depolamada (bkz. v5 Madde 18.3)
- ✅ Veritabanı PostgreSQL
- ✅ Redis: queue + cache + realtime state
- ✅ Versiyonlama immutable (bkz. v5 Madde 17.2)
- ✅ Şablonlar JSON config-driven
- ✅ Audit log kapsamlı (bkz. v5 Madde 16.5)

---

## 3. TECH STACK

### Frontend
- **Next.js 14+** (App Router)
- **Tiptap** (zengin metin editörü + canlı düzenleme)
- **Zustand** (state management)
- **Tailwind CSS** (styling)
- **shadcn/ui** (component library)
- **Storybook** (component docs)
- **next-i18next** (çoklu dil)
- **react-hook-form + zod** (form validation)

### Backend
- **NestJS** (modüler monolith)
- **TypeORM** veya **Prisma** (ORM)
- **Passport.js** (auth stratejileri)
- **BullMQ** (queue)
- **Socket.io** (WebSocket)
- **class-validator** (DTO validation)

### Infra
- **PostgreSQL 15+**
- **Redis 7+**
- **MinIO** (dev) / **AWS S3** (prod) — admin seçebilir
- **Docker + Docker Compose**
- **Nginx** (reverse proxy)

### Monitoring
- **Sentry** (error tracking)
- **Prometheus + Grafana** (metrics)
- **Winston** (structured logging)

### Payments
- **Stripe** (tek seferlik + abonelik)
- **PayPal** (alternatif)

### External APIs
- **SheerID** (öğrenci doğrulama)
- **ClamAV** (virüs tarama)
- **VirusTotal API** (bulut virüs tarama)
- **WhatsApp Business API** (bildirim + destek + 2FA)
- **Telegram Bot API** (bildirim + destek + 2FA)
- **Google OAuth** (giriş)

### AI (Opsiyonel)
- **OpenAI API** veya **Ollama** (local LLM)
- Sadece admin açarsa aktif

---

## 4. CORE MODÜLLER

v5 Madde 21'de tanımlanan 23 modül bu projede core olarak kullanılır:

```
src/
├── modules/
│   ├── auth/                    # v5 Madde 16
│   ├── users/                   # v5 Madde 2, 16
│   ├── documents/               # v5 Madde 4.2
│   ├── document_versions/       # v5 Madde 17
│   ├── document_sections/       # v5 Madde 4.4 (AST)
│   ├── formatting/              # v5 Madde 4 (tam motor)
│   ├── templates/               # v5 Madde 4.9, 4.12
│   ├── citations/               # v5 Madde 4.10 (kaynakça zekası)
│   ├── analysis/                # v5 Madde 5
│   ├── expert_profiles/         # v5 Madde 2, 5.2
│   ├── messaging/               # v5 Madde 6
│   ├── payments/                # v5 Madde 8
│   ├── subscriptions/           # v5 Madde 8.2
│   ├── notifications/           # v5 Madde 7
│   ├── admin/                   # v5 Madde 11, 13.4
│   ├── analytics/               # v5 Madde 11
│   ├── audit/                   # v5 Madde 16.5
│   ├── integrations/            # v5 Madde 13.3
│   ├── support/                 # v5 Madde 20.1
│   ├── affiliate/               # v5 Madde 20.2
│   ├── ai/                      # v5 Madde 22 (opsiyonel)
│   ├── localization/            # v5 Madde 10
│   └── legal/                   # v5 Madde 12
```

---

## 5. VERİTABANI YAPISI (HIGH LEVEL)

Temel tablolar (detaylı schema her task'ta oluşturulacak):

- `users`, `refresh_tokens`, `two_factor_methods`, `oauth_accounts`
- `documents`, `document_versions`, `document_sections`, `version_snapshots`
- `templates`, `user_templates`, `template_parameters` (JSON)
- `citations`, `citation_styles`, `citation_validations`
- `analysis_tickets`, `ticket_files`, `ticket_messages`, `nda_agreements`
- `expert_profiles`, `expertise_tags`, `expert_assignments`
- `payments`, `subscriptions`, `coupons`, `coupon_usages`
- `notifications`, `notification_preferences`, `notification_channels`
- `audit_logs`, `impersonation_sessions`
- `system_settings`, `feature_flags`
- `affiliates`, `referrals`, `affiliate_rewards`
- `support_conversations`, `support_channels`

---

## 6. DOSYA AKIŞI

```
1. Kullanıcı dosya yükler (frontend)
2. Backend dosyayı alır, temp'e kaydeder
3. Virüs taraması kuyruğa alınır (bkz. v5 Madde 9.2)
4. Tarama geçerse S3'e yüklenir (raw versiyonu)
5. Metadata DB'ye kaydedilir (documents tablosu)
6. Parse job kuyruğa alınır (BullMQ)
7. Worker DOCX parse eder → AST çıkarır
8. Bölümler tespit edilir → document_sections
9. Başlık algılama (rule-based, bkz. v5 Madde 22.1)
10. Güven skoru hesaplanır
11. Sonuç frontend'e WebSocket ile push edilir
12. Kullanıcı canlı editörde düzenler (Tiptap)
13. Autosave working versiyonunu günceller
14. Format apply kuyruğa alınır
15. Motor formatlar → formatted versiyonu oluşur
16. Preview versiyonu (watermark'lı) oluşturulur
17. Ödeme sonrası final versiyon kilitlenir
```

---

## 7. TASK LİSTESİ (230 TASK)

> **Uygulama kuralı:** Her batch bağımsız çalıştırılır. Batch sonunda değişen dosyalar listelenir, kararlar açıklanır.

### BATCH 1 — Proje Kurulumu (Tasks 1-20)
**Referans:** v5 Madde 18

1. Monorepo yapısını oluştur (backend + frontend + shared)
2. NestJS backend kurulumu
3. Next.js frontend kurulumu (App Router)
4. PostgreSQL schema ve migration altyapısı
5. Redis bağlantısı
6. Docker Compose dosyası (backend, frontend, postgres, redis, minio, nginx)
7. Environment config (.env.example, config module)
8. ESLint + Prettier + Husky kurulumu
9. TypeScript strict mode
10. Shared types paketi (DTO + entity types)
11. Winston structured logging
12. Sentry entegrasyonu (v5 Madde 18.1)
13. BullMQ queue kurulumu (v5 Madde 18)
14. S3 storage abstraction (MinIO dev, AWS S3 prod, admin seçebilir)
15. Health check endpoint (/health)
16. Global validation pipe (class-validator)
17. Global exception filter (hata formatı)
18. Request ID tracking middleware
19. Module loader yapısı
20. README ve geliştirici dokümantasyonu

### BATCH 2 — Auth + Users (Tasks 21-45)
**Referans:** v5 Madde 2, 16

21. `users` tablosu ve migration
22. `refresh_tokens` tablosu
23. `oauth_accounts` tablosu (Google OAuth)
24. `two_factor_methods` tablosu (WhatsApp/Telegram/Authenticator)
25. Register endpoint (email + şifre + akademik unvan)
26. Login endpoint (email + şifre)
27. Google OAuth entegrasyonu (Passport Google strategy)
28. JWT token üretimi (access + refresh)
29. Refresh token rotation
30. Logout + token revocation
31. Auth guard (JWT validation)
32. Role guard (admin/expert/user/super_admin)
33. Password hashing (bcrypt)
34. 2FA — WhatsApp kod gönderme (v5 Madde 16.2)
35. 2FA — Telegram kod gönderme
36. 2FA — Authenticator (TOTP) kurulumu
37. 2FA — doğrulama akışı
38. Admin impersonation sistemi (v5 Madde 16.3)
39. Impersonation audit logging
40. User profile CRUD
41. Profile update (unvan, dil, tema tercihi)
42. `notification_preferences` tablosu ve API
43. User seed (test kullanıcıları)
44. Admin seed
45. Auth flow E2E testleri

### BATCH 3 — Audit Log Sistemi (Tasks 46-55)
**Referans:** v5 Madde 16.5

46. `audit_logs` tablosu
47. Audit interceptor (NestJS interceptor)
48. Event-driven audit logging
49. İzlenecek olay listesi tanımlama
50. Audit log filtreleme API (admin panel için)
51. Audit log export (Excel/CSV)
52. Saklama süresi ayarı
53. Audit log UI (admin panel)
54. Audit log retention job (eski logları temizle)
55. Audit log testleri

### BATCH 4 — Belge Yükleme ve Depolama (Tasks 56-80)
**Referans:** v5 Madde 4.2, 9.1, 9.2

56. `documents` tablosu
57. `document_versions` tablosu (7 tip — v5 Madde 17)
58. `document_sections` tablosu (AST için)
59. Upload endpoint (multipart)
60. File type validation
61. File size validation (dynamic limit — admin panelinden)
62. Virüs tarama queue job (v5 Madde 9.2)
63. ClamAV entegrasyonu
64. VirusTotal API entegrasyonu
65. Admin panelinden virüs tarama aç/kapa toggle
66. S3 upload (raw versiyonu)
67. Document metadata kaydetme
68. Document list API (kullanıcı dosyaları)
69. Document detail API
70. Document delete (soft delete + audit log)
71. Presigned URL üretimi (güvenli indirme)
72. İçerik tipine göre rate limit (v5 Madde 16.4)
73. Upload progress tracking
74. Resume upload desteği (büyük dosyalar)
75. Multi-file upload
76. Preview generation queue (watermark'lı)
77. Preview versiyonu oluşturma (v5 Madde 4.7)
78. Download endpoint (final versiyonu)
79. Version history API (v5 Madde 17.3)
80. Upload flow E2E testleri

### BATCH 5 — DOCX Parser ve Başlık Algılama (Tasks 81-110)
**Referans:** v5 Madde 4.4, 22.1

81. DOCX parser kütüphanesi seçimi (mammoth.js veya docx)
82. DOCX → AST dönüşümü
83. Paragraph/run yapısı ayrıştırma
84. Tablo/şekil/denklem tespiti
85. Word stili tabanlı başlık algılama (Heading 1-5)
86. Font boyutu analizi (rule-based)
87. Bold/kalınlık analizi
88. Numaralandırma pattern matching (regex)
89. Satır uzunluğu heuristikleri
90. Güven skoru hesaplama algoritması
91. Başlık algılama sonucu kaydetme (document_sections)
92. Opsiyonel AI modülü — başlık algılama (v5 Madde 22)
93. AI modülü açık/kapalı feature flag
94. PDF → DOCX dönüşüm queue
95. PDF dönüşüm worker (LibreOffice headless)
96. PDF dönüşüm sonucu low confidence olarak işaretle
97. Bölüm tespiti (özet, giriş, kaynakça vb.)
98. Bölüm eşleştirme (şablona göre)
99. Tablo/şekil numaralandırma tespiti
100. Denklem algılama
101. Dipnot tespiti
102. Metin içi atıf tespiti
103. Parse error handling
104. Parse logging ve metrikler
105. Parse result API
106. Outline API (başlık ağacı)
107. Confidence score API
108. Parse worker performans optimizasyonu
109. Parse retry logic
110. Parser testleri (fixture belgeler)

### BATCH 6 — Canlı Editör (Tiptap + Zustand) (Tasks 111-140)
**Referans:** v5 Madde 4.5

111. Tiptap editör kurulumu
112. Zustand store yapısı
113. Editor state (sections, headings, tables, figures)
114. Split View mod (sol panel + sağ PDF önizleme)
115. WYSIWYG mod (tıkla-düzenle)
116. Mod değiştirme
117. Başlık düzey değiştirme UI (H1-H5 dropdown)
118. Başlık birleştirme (merge) UI
119. Başlık bölme (split) UI
120. "Bu başlık değil, normal metin" işareti
121. Başlık numaralandırma düzeltme UI (4 seçenek)
122. Bölüm sırası sürükle-bırak
123. Sayfa numaralandırma bölge editörü (v5 Madde 4.5.3)
124. Romen ↔ Arap geçiş noktası düzenleme
125. Belirli sayfayı numarasız yapma
126. Tablo/şekil/denklem numaralandırma düzenleme
127. Kaskad güncelleme sistemi (v5 Madde 4.5.7)
128. Kaskad bildirim UI
129. Undo/Redo (atomik, kaskad dahil)
130. Autosave — debounced (working versiyonu güncelleme)
131. Manuel snapshot butonu (revision versiyonu)
132. Save indicator UI
133. Outline panel (başlık ağacı, soldan)
134. Canlı PDF preview render (HTML → PDF worker)
135. WebSocket ile preview update
136. Diff view (versiyonlar arası fark)
137. Version restore (yeni versiyon olarak)
138. Editor loading states
139. Editor error handling
140. Editor E2E testleri

### BATCH 7 — Şablon Sistemi (Tasks 141-170)
**Referans:** v5 Madde 4.9, 4.12

141. `templates` tablosu (JSON config-driven)
142. `user_templates` tablosu
143. `template_parameters` JSONB field
144. Şablon parametre schema (11 kategori — v5 Madde 4.9)
145. Admin şablon CRUD API
146. Şablon form tabanlı oluşturma UI
147. Admin şablon form UI — sayfa düzeni sekmesi
148. Admin şablon form UI — yazı tipi sekmesi
149. Admin şablon form UI — başlık hiyerarşisi sekmesi (5 seviye)
150. Admin şablon form UI — sayfa numaralandırma sekmesi
151. Admin şablon form UI — kapak sayfaları sekmesi
152. Admin şablon form UI — sabit sayfalar sekmesi
153. Admin şablon form UI — bölüm sıralaması (sürükle-bırak)
154. Admin şablon form UI — tablo/şekil formatı sekmesi
155. Admin şablon form UI — denklem formatı sekmesi
156. Admin şablon form UI — kaynakça sekmesi
157. Admin şablon form UI — kısıtlamalar sekmesi
158. Kullanıcı şablon klonlama
159. Kullanıcı sıfırdan özel format wizard (11 adım)
160. Kişisel şablon profile kaydetme
161. Kullanıcı şablon düzenleme
162. Admin → kullanıcı şablonlarını listeleme
163. Admin → kullanıcı şablonunu resmi yapma (promote)
164. Şablon istatistikleri (en çok kullanılan, terfi edilenler)
165. Şablon versiyonlama
166. Şablon import/export (JSON)
167. Çalışma türü bazlı şablon filtreleme
168. Çalışma türü yönetimi (admin, esnek liste)
169. Çalışma türü → zorunlu/opsiyonel sabit sayfalar
170. Şablon E2E testleri

### BATCH 8 — Formatlama Motoru (Tasks 171-200)
**Referans:** v5 Madde 4.6, 4.7, 4.8

171. Formatlama engine mimarisi
172. Şablon uygulama servisi
173. Sayfa düzeni uygulayıcı
174. Font/punto uygulayıcı
175. Başlık stili uygulayıcı (5 seviye)
176. Sayfa numaralandırma uygulayıcı (bölge bazlı)
177. Kapak sayfası generator
178. Onay sayfası generator
179. Beyanname generator
180. Özet sayfası generator (Türkçe + İngilizce)
181. İçindekiler generator (otomatik)
182. Tablo listesi generator
183. Şekil listesi generator
184. Kısaltmalar listesi generator
185. Özgeçmiş generator
186. Bölüm sırası uygulayıcı
187. Tablo/şekil numaralandırma
188. Denklem numaralandırma
189. Çapraz referans güncelleme
190. Doğrulama kontrolleri (v5 Madde 4.7.1)
191. Kelime sayısı kontrolü
192. Numara tutarlılığı kontrolü
193. Eksik bölüm kontrolü
194. Uyarı sistemi (Hata/Uyarı/Bilgi)
195. DOCX output generation (docx library)
196. PDF output generation (puppeteer veya LibreOffice)
197. Format queue job
198. Format worker
199. Formatted versiyonu kaydetme
200. Formatlama E2E testleri

### BATCH 9 — Kaynakça Zekası (Tasks 201-215)
**Referans:** v5 Madde 4.10

201. `citation_styles` tablosu
202. `citations` tablosu (parsed references)
203. `citation_validations` tablosu
204. Kaynakça parser (APA, Vancouver, IEEE, MDPI, Chicago, Harvard, MLA)
205. Stil algılama algoritması (rule-based + regex)
206. Opsiyonel AI ile stil algılama
207. Metin içi atıf tespiti ve eşleştirme
208. Format doğrulama kuralları (her stil için)
209. Uyumsuzluk raporlama
210. Kaynakça doğrulama UI (canlı editörde sarı vurgu)
211. Stil dönüştürme engine (any-to-any)
212. Dönüştürme önizleme
213. Toplu metin içi atıf güncelleme
214. Kaynakça sıralama güncelleme (alfabetik ↔ atıf sırası)
215. Kaynakça modülü E2E testleri

### BATCH 10 — Analiz Sistemi (Tasks 216-240)
**Referans:** v5 Madde 5, 6

216. `analysis_tickets` tablosu
217. `ticket_files` tablosu (3 tip: veri, açıklama, örnek)
218. `ticket_messages` tablosu
219. `nda_agreements` tablosu (opsiyonel, admin açar)
220. `expert_profiles` tablosu
221. `expertise_tags` tablosu
222. Analiz kategori yönetimi (admin)
223. Add-on hizmet yönetimi
224. Ticket oluşturma endpoint
225. Ayrı dosya yükleme alanları
226. Otomatik uzman ataması (yük dengeleme)
227. NDA akışı (opsiyonel)
228. Ticket list / detail API
229. Uzman fiyat teklifi
230. Müşteri onay akışı
231. Revizyon sistemi (admin limiti)
232. WebSocket mesajlaşma
233. Ticket status flow
234. Express teslimat seçeneği
235. Süre aşımı bildirimleri
236. Uzman dashboard
237. Sonuç yükleme
238. Müşteri puanlama + yorum
239. Ticket kapatma
240. Analiz E2E testleri

### BATCH 11 — Ödemeler + Bildirimler (Tasks 241-270)
**Referans:** v5 Madde 7, 8

241. `payments` tablosu
242. `subscriptions` tablosu
243. `coupons` tablosu
244. Stripe Payments entegrasyonu
245. Stripe Billing (subscription)
246. PayPal entegrasyonu
247. Webhook handler (Stripe + PayPal)
248. Kupon kodu doğrulama
249. SheerID öğrenci doğrulama
250. Multi-currency (GeoIP bazlı)
251. Checkout flow
252. Billing UI
253. Invoice generation
254. `notifications` tablosu
255. Notification engine (event-driven)
256. Email provider (SendGrid veya Resend)
257. WhatsApp Business API
258. Telegram Bot API
259. In-app notification (WebSocket)
260. User preferences (olay bazlı kanal seçimi)
261. Notification queue
262. Retry logic
263. Template engine (email + WhatsApp + Telegram)
264. Admin panelinden kanal aç/kapa
265. Notification history
266. Notification UI (zil ikonu, panel)
267. Ödeme testleri
268. Webhook güvenlik (imza doğrulama)
269. Fraud detection (basic)
270. Payment + notification E2E testleri

### BATCH 12 — Admin Panel + Analitik (Tasks 271-300)
**Referans:** v5 Madde 11, 13.4

271. `system_settings` tablosu
272. Feature flags sistemi
273. Admin dashboard layout
274. Sistem ayarları UI
275. Kullanıcı yönetimi UI
276. Ticket yönetimi UI
277. Şablon yönetimi UI
278. Analitik dashboard (gerçek zamanlı)
279. Gelir metrikleri
280. Operasyonel metrikler
281. Uzman performans metrikleri
282. Kullanıcı metrikleri
283. Rapor export (Excel + PDF)
284. Haftalık/aylık otomatik rapor job
285. Email ile rapor gönderme
286. Prometheus metrics endpoint
287. Grafana dashboard JSON
288. Duyuru bandı yönetimi
289. Yasal metin editörü (KVKK, gizlilik, çerez)
290. Kupon kodu yönetimi
291. Çalışma türü yönetimi
292. Backup ayarları UI
293. Virüs tarama ayarları UI
294. Bildirim kanalı ayarları UI
295. Dil yönetimi UI (i18n)
296. Storybook component library
297. Dark mode implementation
298. WCAG 2.1 AA uyumluluk
299. Admin panel E2E testleri
300. Platform smoke test

### BATCH 13 — Yasal + Destek + Affiliate (Tasks 301-330)
**Referans:** v5 Madde 12, 20

301. KVKK modülü
302. GDPR modülü
303. Kullanım sözleşmesi sayfası
304. Gizlilik politikası sayfası
305. Çerez politikası + banner
306. Unutulma hakkı (hesap silme + anonimleştirme)
307. Data export (kullanıcı kendi verisini indirebilir)
308. Yasal metin admin editörü
309. Müşteri destek sistemi
310. WhatsApp destek entegrasyonu
311. Telegram destek entegrasyonu
312. Destek kanalı seçim UI
313. Çalışma saatleri ayarı
314. Mesai dışı otomatik yanıt
315. Destek geçmişi
316. `affiliates` tablosu
317. `referrals` tablosu
318. `affiliate_rewards` tablosu
319. Referans kodu üretimi
320. Referans link tracking
321. Yeni kullanıcı → indirim kuponu
322. Referans veren → kredi/indirim
323. Affiliate dashboard (kullanıcı profili)
324. Admin affiliate ayarları
325. Hile tespit (aynı IP vb.)
326. Affiliate ödeme raporları
327. Affiliate E2E testleri
328. Final QA testleri
329. Production hazırlık
330. Launch checklist

---

## 8. GELİŞTİRME PRENSİPLERİ

### Her Task İçin
1. İlgili v5 maddesini oku
2. Test yaz (mümkünse önce)
3. Kod yaz
4. Değişen dosyaları listele
5. Kararları açıkla
6. Varsayımları belirt
7. Bir sonraki task'a geçmeden onay bekle

### Code Quality
- TypeScript strict mode
- ESLint + Prettier
- Conventional commits
- PR template
- Code review zorunlu (main branch korumalı)

### Testing
- Unit test coverage minimum %80
- Critical path E2E testleri
- Fixture dosyalar (gerçek tez örnekleri)

---

## 9. RİSK ALANLARI

1. **Formatlama motoru karmaşıklığı** — Kaskad güncellemeler, edge case'ler
2. **Başlık algılama doğruluğu** — Rule-based sınırları, AI'sız doğruluk
3. **Kaynakça stil dönüştürme** — Her stilin varyasyonları
4. **PDF render performansı** — Canlı önizleme için queue yönetimi
5. **WebSocket scaling** — Eş zamanlı kullanıcı sayısı
6. **S3 maliyeti** — Versiyon sayısı patlaması
7. **Ödeme webhook güvenliği** — İmza doğrulama kritik

---

## 10. LAUNCH ÖNCESİ KONTROL LİSTESİ

- [ ] Tüm 330 task tamamlandı
- [ ] Test coverage %80+
- [ ] Sentry + Grafana dashboard'lar aktif
- [ ] Backup ve restore testi başarılı
- [ ] KVKK/GDPR uyum kontrolü
- [ ] Load testing (100 eş zamanlı kullanıcı)
- [ ] Security audit (OWASP Top 10)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Production secrets güvende
- [ ] Disaster recovery planı
- [ ] Admin kullanıcı eğitimi
- [ ] Kullanıcı dokümantasyonu

---

*Bu dosya `project_v5.md` ile birlikte kullanılmak üzere tasarlanmıştır. Bir task'a başlamadan önce ilgili v5 maddesini okumak zorunludur.*
