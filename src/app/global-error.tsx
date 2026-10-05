"use client";

/** شاشة تشخيص: تعرض نص الخطأ الحقيقي بدل "Application error" الغامضة. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ fontFamily: "sans-serif", padding: 16 }}>
        <h2>حدث خطأ في الصفحة</h2>
        <p style={{ color: "#b91c1c", fontWeight: 700, wordBreak: "break-word" }}>{String(error?.message || error)}</p>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, direction: "ltr" }}>
          {String(error?.stack || "").slice(0, 1500)}
        </pre>
        <button onClick={() => reset()} style={{ padding: "8px 16px", marginTop: 12 }}>إعادة المحاولة</button>
      </body>
    </html>
  );
}
