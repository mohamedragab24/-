/**
 * نظام تشخيص الأخطاء الموحّد (السيرفر).
 * يحوّل أي خطأ تقني إلى: { code, message, cause, fix, technical, link? }
 *   message  = ماذا حدث (جملة قصيرة للمستخدم)
 *   cause    = السبب الأرجح
 *   fix      = المطلوب لحلّه بالضبط
 *   technical= النص الأصلي للخطأ (للنسخ وإرساله للمطوّر)
 * يُستخدم في: /api/fn/*  و webhook JaaS و /api/payments/* و /api/health.
 * لا يطبع أي قيمة سرية أبدًا، فقط أسماء المتغيرات.
 */

const R2_VARS = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];

const missing = (names) => names.filter((n) => !String(process.env[n] || '').trim());

const rawText = (e) => {
  if (!e) return '';
  const parts = [e.message, e.details, e.code, e.reason, e.errorInfo?.message, e.errorInfo?.code].filter(Boolean).map(String);
  return parts.join(' | ').slice(0, 900);
};

/** هل الخطأ مكتوب أصلًا بصيغة {cause, fix} (من الدوال نفسها)؟ */
const hasStructured = (e) => e && e.details && typeof e.details === 'object' && (e.details.cause || e.details.fix);

function diagnose(e, ctx = {}) {
  const technical = rawText(e);
  const t = technical.toLowerCase();
  const grpc = typeof e?.code === 'number' ? e.code : null;
  const mk = (code, message, cause, fix, extra = {}) => ({ code, message, cause, fix, technical, ...extra });

  // 1) أخطاء كتبناها نحن بسبب/حل جاهزين
  if (hasStructured(e)) {
    return mk(String(e.code || 'internal'), String(e.message || 'حدث خطأ'), String(e.details.cause || ''), String(e.details.fix || ''));
  }

  // 2) FIREBASE_SERVICE_ACCOUNT
  if (t.includes('firebase_service_account env var is missing') || (ctx.stage === 'init' && t.includes('firebase_service_account'))) {
    return mk('config/firebase-service-account-missing', 'إعداد السيرفر ناقص: FIREBASE_SERVICE_ACCOUNT',
      'المتغير FIREBASE_SERVICE_ACCOUNT غير موجود في Vercel، أو أضفته ولم تعمل Redeploy بعدها.',
      'Vercel ← Settings ← Environment Variables ← أضف FIREBASE_SERVICE_ACCOUNT (محتوى ملف JSON كاملًا من Firebase Console ← Project settings ← Service accounts ← Generate new private key) ثم Deployments ← Redeploy.');
  }
  if (ctx.stage === 'init' && (e instanceof SyntaxError || t.includes('unexpected token') || t.includes('in json'))) {
    return mk('config/firebase-service-account-invalid', 'قيمة FIREBASE_SERVICE_ACCOUNT ليست JSON صالحًا',
      'المتغير موجود لكن محتواه مقصوص أو منسوخ ناقصًا أو فيه علامات اقتباس زائدة.',
      'افتح ملف الـ service account الأصلي، انسخ المحتوى كله من أول { إلى آخر } والصقه في المتغير بدون أي إضافات، ثم Redeploy.');
  }
  if (t.includes('failed to parse private key') || t.includes('invalid pem') || t.includes('private_key') && t.includes('pem')) {
    return mk('config/firebase-private-key-broken', 'المفتاح الخاص داخل FIREBASE_SERVICE_ACCOUNT تالف',
      'أسطر المفتاح (\\n) اتغيرت أثناء اللصق في Vercel.',
      'ألصق ملف JSON الأصلي كما هو بدون تعديل (لا تفتحه وتعيد كتابته)، ثم Redeploy. لو تكرر: ولّد مفتاحًا جديدًا من Firebase وألصقه.');
  }

  // 3) JaaS
  if (t.includes('jaas_private_key')) {
    return mk('config/jaas-private-key-missing', 'إعدادات الاجتماع (JaaS) ناقصة',
      'المتغير JAAS_PRIVATE_KEY غير موجود في Vercel أو لم تعمل Redeploy.',
      'JaaS Console ← API Keys ← أنشئ مفتاحًا واحفظ ملف .pk، ثم ألصق محتواه كاملًا (بسطري BEGIN/END) في JAAS_PRIVATE_KEY مع JAAS_KEY_ID الصحيح، ثم Redeploy.');
  }
  if (t.includes('secretorprivatekey') || t.includes('pem_read_bio') || t.includes('decoder routines') || t.includes('error:1e08010c') || (t.includes('rs256') && t.includes('key'))) {
    return mk('config/jaas-private-key-invalid', 'تعذّر إنشاء توكن الاجتماع: المفتاح الخاص غير صالح',
      'JAAS_PRIVATE_KEY منسوخ ناقصًا (بدون سطري BEGIN/END) أو أسطره اتكسرت، أو أنه المفتاح العام بدل الخاص.',
      'الصق المفتاح الخاص (.pk) كاملًا. لو Vercel كسر الأسطر اكتبه في سطر واحد وافصل الأسطر بالرمز \\n حرفيًا. تأكد أن JAAS_KEY_ID هو معرّف نفس المفتاح، ثم Redeploy.');
  }

  // 4) R2
  if (t.includes('r2 secrets are not configured')) {
    const m = missing(R2_VARS.slice(0, 3));
    return mk('config/r2-missing', 'إعدادات التخزين (Cloudflare R2) ناقصة',
      m.length ? `المتغيرات الناقصة: ${m.join(', ')}.` : 'متغيرات R2 غير ظاهرة للسيرفر (غالبًا لم تعمل Redeploy بعد إضافتها).',
      'Vercel ← Environment Variables ← أضف R2_ACCOUNT_ID و R2_ACCESS_KEY_ID و R2_SECRET_ACCESS_KEY و R2_BUCKET (من Cloudflare ← R2 ← Manage R2 API Tokens)، واختر Production، ثم Redeploy.');
  }
  if (t.includes('signaturedoesnotmatch')) {
    return mk('storage/r2-signature', 'رفض R2 الطلب: التوقيع غير مطابق',
      'R2_SECRET_ACCESS_KEY (أو R2_ACCESS_KEY_ID) خطأ، أو فيه مسافة/سطر زائد في آخره.',
      'أعد نسخ Access Key ID و Secret Access Key من نفس الـ API token بدون مسافات، حدّث المتغيرين في Vercel، ثم Redeploy.');
  }
  if (t.includes('invalidaccesskeyid')) {
    return mk('storage/r2-key-id', 'رفض R2 الطلب: Access Key ID غير معروف',
      'R2_ACCESS_KEY_ID خطأ أو الـ token اتحذف من Cloudflare.',
      'أنشئ API token جديدًا في Cloudflare ← R2 وحدّث R2_ACCESS_KEY_ID و R2_SECRET_ACCESS_KEY ثم Redeploy.');
  }
  if (t.includes('nosuchbucket')) {
    return mk('storage/r2-bucket', 'الـ bucket غير موجود في R2',
      'قيمة R2_BUCKET لا تطابق اسم الـ bucket الفعلي (الاسم حساس لحالة الأحرف) أو الـ Account ID مختلف.',
      'انسخ اسم الـ bucket بالضبط من Cloudflare ← R2 وضعه في R2_BUCKET، وتأكد أن R2_ACCOUNT_ID هو نفس حساب الـ bucket، ثم Redeploy.');
  }
  if (t.includes('r2') && (t.includes('accessdenied') || t.includes(' 403'))) {
    return mk('storage/r2-denied', 'R2 رفض العملية: لا توجد صلاحية',
      'صلاحية الـ API token Read-only، أو مقيّد على bucket آخر.',
      'Cloudflare ← R2 ← Manage API Tokens ← أنشئ token بصلاحية Object Read & Write على الـ bucket المطلوب وحدّث المتغيرات ثم Redeploy.');
  }

  // 5) تحميل تسجيل JaaS
  if (t.includes('download failed') || t.includes('download retry failed')) {
    return mk('recording/download', 'تعذّر تنزيل التسجيل من JaaS',
      'رابط التسجيل المؤقت انتهت صلاحيته أو JaaS لم يُنهِ تجهيز الملف بعد.',
      'أعد إرسال حدث RECORDING_UPLOADED من JaaS Console (أو أعد التسجيل). لو تكرر افحص أن المفتاح في JaaS مفعّل لخاصية Recording.');
  }

  // 6) Firestore (gRPC)
  if (grpc === 7 || t.includes('missing or insufficient permissions') || t.includes('permission_denied')) {
    if (t.includes('has not been used') || t.includes('api has not been enabled') || t.includes('is disabled')) {
      return mk('firestore/api-disabled', 'واجهة Firestore غير مفعّلة على المشروع',
        'Cloud Firestore API مغلقة في Google Cloud لهذا المشروع.',
        'افتح الرابط الظاهر في التفاصيل التقنية أو Google Cloud Console ← APIs ← فعّل Cloud Firestore API ثم انتظر دقيقة وأعد المحاولة.');
    }
    return mk('firestore/permission-denied', 'Firestore رفض العملية (permission-denied)',
      'قواعد Firestore المنشورة لا تسمح بهذه العملية، أو الـ service account لا يملك صلاحية على المشروع.',
      'انشر ملف firestore.rules الجديد (Firebase Console ← Firestore ← Rules ← Publish). لو الخطأ من السيرفر نفسه تأكد أن FIREBASE_SERVICE_ACCOUNT تابع لنفس المشروع وله دور Editor.');
  }
  if (grpc === 9 || t.includes('requires an index') || t.includes('failed_precondition') && t.includes('index')) {
    const link = (technical.match(/https:\/\/console\.firebase\.google\.com\S+/) || [])[0];
    return mk('firestore/index-required', 'الاستعلام يحتاج فهرس (Index) في Firestore',
      'Firestore يطلب فهرسًا مركبًا لهذا الاستعلام ولم يُنشأ بعد.',
      link ? 'افتح الرابط المرفق واضغط Create Index، وانتظر حتى يصبح Enabled (دقيقة أو اثنتين) ثم أعد المحاولة.' : 'افتح Firebase Console ← Firestore ← Indexes وأنشئ الفهرس المطلوب (يظهر الرابط في Vercel Logs).', link ? { link } : {});
  }
  if (grpc === 5 && (t.includes('database') || t.includes('does not exist'))) {
    return mk('firestore/db-missing', 'قاعدة Firestore غير موجودة',
      'لم يتم إنشاء Firestore Database في هذا المشروع، أو أن FIREBASE_SERVICE_ACCOUNT لمشروع آخر.',
      'Firebase Console ← Firestore Database ← Create database، وتأكد أن project_id داخل الـ service account هو مشروعك.');
  }
  if (grpc === 16 || t.includes('invalid_grant') || t.includes('invalid jwt signature') || t.includes('unauthenticated') && ctx.stage !== 'user') {
    return mk('firebase/credential-rejected', 'Google رفض بيانات اعتماد السيرفر',
      'مفتاح الـ service account اتحذف/أُلغي، أو ساعة السيرفر غير مضبوطة، أو المفتاح تالف.',
      'Firebase Console ← Project settings ← Service accounts ← Generate new private key، والصق JSON الجديد في FIREBASE_SERVICE_ACCOUNT ثم Redeploy.');
  }
  if (grpc === 8 || t.includes('resource_exhausted') || t.includes('quota')) {
    return mk('firestore/quota', 'تم تجاوز حصة Firestore',
      'الخطة المجانية (Spark) استُنفدت حصتها اليومية.',
      'انتظر تجديد الحصة (منتصف الليل بتوقيت المحيط الهادئ) أو رقّ المشروع إلى Blaze.');
  }
  if (grpc === 14 || t.includes('unavailable') && t.includes('firestore')) {
    return mk('firestore/unavailable', 'تعذّر الاتصال بـ Firestore حاليًا', 'انقطاع مؤقت في الشبكة أو الخدمة.', 'أعد المحاولة بعد لحظات.');
  }

  // 7) شبكة
  if (t.includes('enotfound') || t.includes('econnrefused') || t.includes('etimedout') || t.includes('fetch failed') || t.includes('econnreset')) {
    return mk('network/unreachable', 'تعذّر الاتصال بخدمة خارجية',
      'الخدمة المطلوبة لا ترد (انقطاع، أو عنوان خاطئ، أو انتهت المهلة).',
      'تأكد من اتصال الإنترنت ومن صحة العناوين في المتغيرات (مثل PAYMENT_STATUS_ENDPOINTS و R2_ACCOUNT_ID) ثم أعد المحاولة.');
  }
  if (t.includes('id token has expired') || t.includes('auth/id-token-expired')) {
    return mk('unauthenticated', 'انتهت جلسة الدخول', 'التوكن انتهت صلاحيته.', 'سجّل الخروج ثم سجّل الدخول من جديد.');
  }
  if (t.includes('timeout') || t.includes('deadline')) {
    return mk('deadline-exceeded', 'انتهت مهلة العملية',
      'العملية أخذت وقتًا أطول من الحد المسموح (في خطة Vercel المجانية الحد 60 ثانية).',
      'أعد المحاولة، ولو كانت عملية رفع فيديو كبير فارفعه بحجم أصغر أو رقّ خطة Vercel.');
  }

  // 8) أخطاء مكتوبة بالعربية من الدوال (HttpsError) أو غير معروفة
  if (typeof e?.code === 'string' && e.code !== 'internal' && /^[a-z-]+$/.test(e.code)) {
    return mk(e.code, String(e.message || 'تعذّر تنفيذ الطلب'), '', '');
  }
  return mk('internal', 'حدث خطأ غير متوقع في السيرفر',
    'خطأ غير معروف في الكود أو في خدمة خارجية.',
    'انسخ «التفاصيل التقنية» وأرسلها للمطوّر، أو افتح Vercel ← Logs وابحث عن هذا الوقت. ' + (ctx.fn ? `الدالة: ${ctx.fn}.` : ''));
}

/** يفحص أن المتغيرات المطلوبة موجودة (بدون كشف قيمها) */
function envReport() {
  const need = [
    ['FIREBASE_SERVICE_ACCOUNT', 'الاتصال بـ Firebase (إلزامي)'],
    ['JAAS_PRIVATE_KEY', 'توكن الاجتماعات'],
    ['JAAS_KEY_ID', 'معرّف مفتاح JaaS'],
    ['JAAS_APP_ID', 'معرّف تطبيق JaaS'],
    ['JAAS_WEBHOOK_SECRET', 'حماية Webhook التسجيلات'],
    ['R2_ACCOUNT_ID', 'تخزين R2'],
    ['R2_ACCESS_KEY_ID', 'تخزين R2'],
    ['R2_SECRET_ACCESS_KEY', 'تخزين R2'],
    ['R2_BUCKET', 'تخزين R2'],
    ['PAYMENT_INGEST_SECRET', 'استقبال رسائل بوابة الدفع'],
  ];
  const optionalDefault = { JAAS_KEY_ID: 'الافتراضي في الكود', JAAS_APP_ID: 'الافتراضي في الكود', R2_BUCKET: 'الافتراضي fahmny-videos' };
  return need.map(([name, purpose]) => {
    const present = !!String(process.env[name] || '').trim();
    return { name, purpose, present, usesDefault: !present && !!optionalDefault[name], defaultNote: optionalDefault[name] || '' };
  });
}

module.exports = { diagnose, envReport, missing, R2_VARS };
