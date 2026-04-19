export const metadata = {
  title: 'Gizlilik Politikası | FormatEdit',
  description: 'FormatEdit KVKK ve GDPR uyumlu gizlilik politikası.',
};

export default function PrivacyPolicyPage() {
  return (
    <article className="glass-panel" style={{ padding: '3rem', borderRadius: '24px', lineHeight: 1.6 }}>
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>LEGAL</p>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', margin: 0, lineHeight: 1.2 }}>Gizlilik Politikası</h1>
        <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>Son Güncelleme: {new Date().toLocaleDateString('tr-TR')}</p>
      </header>

      <div className="prose" style={{ color: 'var(--text)', fontSize: '1.05rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>1. Veri Sorumlusu</h2>
          <p>
            Bu aydınlatma metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca, FormatEdit ("Şirket") tarafından kişisel verilerinizin toplanması, işlenmesi,
            aktarılması ve bu kapsamdaki haklarınıza ilişkin olarak hazırlanmıştır.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>2. İşlenen Kişisel Veriler</h2>
          <p>FormatEdit sistemine üye olurken ve akademik belgelerinizi yüklerken aşağıdaki veriler işlenmektedir:</p>
          <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li><strong>Kimlik Bilgileri:</strong> Ad, soyad.</li>
            <li><strong>İletişim Bilgileri:</strong> E-posta adresi.</li>
            <li><strong>Müşteri İşlem Bilgileri:</strong> Sisteme yüklenen tez, makale ve akademik dosyalarınızın içerikleri.</li>
            <li><strong>Finans Bilgileri:</strong> Abonelik işlemlerinde kullanılan fatura adresleri (Kredi kartı bilgileri sistemimizde tutulmaz, ödeme altyapısı Stripe tarafından saklanır).</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>3. Unutulma Hakkı (Right to be Forgotten)</h2>
          <p>
            Avrupa Birliği GDPR ve KVKK standartları gereğince, sistemimiz "Unutulma Hakkınızı" %100 destekler. Hesabınızı sildiğiniz anda, sunucularımızdaki
            tüm akademik dokümanlarınız (DOCX, PDF formatlarındaki ham ve formatlanmış halleri), fatura geçmişi dışında kalan tüm şahsi verileriniz **geri döndürülemez** şekilde kalıcı olarak anonimleştirilir veya silinir.
          </p>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
            <strong>Önemli Not:</strong> Yüklediğiniz akademik metinler hiçbir yapay zeka modelinin "eğitim setinde (training data)" kullanılmaz ve üçüncü taraf kurumlarla ticari amaçla paylaşılmaz.
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>4. Çerezler (Cookies)</h2>
          <p>
            Platformumuzun temel fonksiyonlarını yerine getirebilmesi için (Örn: oturum yönetimi) zorunlu çerezler kullanılmaktadır. Sitenin kullanım trendlerini analiz
            etmek için ise anonimleştirilmiş analitik çerezleri (Plausible/Google Analytics) tercih edebilirsiniz. Çerez tercihlerinizi sistem ayarlarınızdan dilediğiniz zaman değiştirebilirsiniz.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>5. İletişim & Haklarınız</h2>
          <p>
            KVKK madde 11 uyarınca sahip olduğunuz hakları kullanmak için <a href="mailto:privacy@formatedit.com" style={{ color: 'var(--accent)', textDecoration: 'none' }}>privacy@formatedit.com</a> adresine
            e-posta gönderebilirsiniz.
          </p>
        </section>
      </div>
    </article>
  );
}
