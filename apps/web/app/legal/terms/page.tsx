import Link from 'next/link';

export const metadata = {
  title: 'Kullanım Koşulları | FormatEdit',
  description: 'FormatEdit hizmet şartları ve kullanım sözleşmesi.',
};

export default function TermsOfServicePage() {
  return (
    <article className="glass-panel" style={{ padding: '3rem', borderRadius: '24px', lineHeight: 1.6 }}>
      <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <p className="eyebrow" style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.1em', marginBottom: '0.5rem' }}>LEGAL</p>
        <h1 className="text-gradient" style={{ fontSize: '2.5rem', margin: 0, lineHeight: 1.2 }}>Kullanım Koşulları</h1>
        <p style={{ color: 'var(--muted)', marginTop: '1rem' }}>Son Güncelleme: {new Date().toLocaleDateString('tr-TR')}</p>
      </header>

      <div className="prose" style={{ color: 'var(--text)', fontSize: '1.05rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>1. Sözleşmenin Kabulü</h2>
          <p>
            Bu Kullanım Koşulları ("Sözleşme"), <strong>FormatEdit</strong> platformuna ve sunduğumuz tüm hizmetlere erişiminizi ve kullanımınızı yönetmektedir. 
            Platforma üye olarak veya hizmetlerimizi kullanarak bu sözleşmenin şartlarını kabul etmiş sayılırsınız.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>2. FormatEdit'in Kapsamı</h2>
          <p>
            FormatEdit, akademik metinlerinizi üniversitelerin veya tez / makale yazım kurallarının gerektirdiği standart biçimlere sokmayı sağlayan bir 
            SaaS (Hizmet Olarak Yazılım) çözümüdür. Formatlanmış çıktılarınızın akademik geçerliliği konusunda son kontrol kullanıcının kendisine aittir.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>3. Hizmet Kısıtlamaları</h2>
          <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>Platforma kasıtlı olarak zararlı yazılım (virüs, trojan vb.) yüklemek kesinlikle yasaktır.</li>
            <li>Sistem altyapısını veya formatlama motorunu manipüle ederek sistemi çökertmeye (DDoS vb.) yönelik hareketler suç kapsamındadır.</li>
            <li>Başkasına ait olan ve kullanım/paylaşım izniniz bulunmayan (Telif hakkı ihlali) materyalleri kendi dosyanızmış gibi işlemek sizin sorumluluğunuzdadır.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>4. Ödeme ve İade Politikası</h2>
          <p>
            Platform üzerinden yapılan "Uzman Analizi" (Ticket) alımları ve abonelikler faturalandırılır. Dijital içerik ve yazılım hizmeti kapsamında olması sebebiyle, 
            Formatlanan veya PDF/DOCX formatında size sunulan bitmiş projeler için Cayma Hakkı geçerli değildir (Mesafeli Sözleşmeler Yönetmeliği Kapsamında).
            Ancak teknik bir çökme veya hatalı formatlama durumlarında uzman desteğine başvurabilir veya iade talebi oluşturabilirsiniz.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>5. Affiliate (Ortaklık) Programı</h2>
          <p>
            FormatEdit Ortaklık platformuna dahil olan kullanıcılar, kendilerine verilen özgün bağlantı (Link) üzerinden gelen satın alımlardan hak ettikleri oranda 
            komisyon alırlar. Kötü niyetli referans trafikleri veya kendi kendine yönlendirmeler tespit edildiğinde FormatEdit, bakiyeyi iptal etme hakkını saklı tutar.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>6. Destek ve Talep Formları</h2>
          <p>
            Sistem kullanımıyla ilgili her türlü teknik soru veya talepleriniz için platform içindeki <Link href="/support" style={{ color: 'var(--accent)' }}>Destek Panosu</Link>'nu kullanabilirsiniz.
          </p>
        </section>
      </div>
    </article>
  );
}
