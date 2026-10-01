'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: 'sans-serif', display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 24, textAlign: 'center' }}>
        <h2>حدث خطأ غير متوقع</h2>
        <p style={{ color: '#666', maxWidth: 420, wordBreak: 'break-word' }}>{error?.message || 'حاول مرة أخرى.'}</p>
        <button onClick={() => reset()} style={{ background: '#29B6F6', color: '#fff', border: 0, borderRadius: 12, padding: '12px 24px', fontWeight: 800 }}>إعادة المحاولة</button>
      </body>
    </html>
  );
}
