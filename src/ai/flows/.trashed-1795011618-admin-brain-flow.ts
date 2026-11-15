
'use server';
/**
 * @fileOverview محرك الذكاء الاصطناعي للتحكم في إعدادات المنصة.
 * يقوم بتحليل طلبات المسؤول وتحويلها إلى تحديثات في قاعدة البيانات.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AdminBrainInputSchema = z.object({
  instruction: z.string().describe('تعليمات المسؤول لتعديل الموقع.'),
});

const AdminBrainOutputSchema = z.object({
  updates: z.object({
    siteTitle: z.string().optional().describe('عنوان الموقع الجديد'),
    heroTitle: z.string().optional().describe('عنوان الهيرو الجديد في صفحة الهبوط'),
    heroSubtitle: z.string().optional().describe('الوصف الفرعي للهيرو'),
    primaryColor: z.string().optional().describe('كود اللون الأساسي Hex'),
    accentColor: z.string().optional().describe('كود لون التمييز Hex'),
    backgroundColor: z.string().optional().describe('كود لون الخلفية Hex'),
    footerText: z.string().optional().describe('نص التذييل'),
  }).describe('كائن يحتوي على الحقول المراد تحديثها in settings/general. لا تترك هذا الكائن فارغاً إذا كان هناك تعديل مطلوب.'),
  feedback: z.string().describe('رسالة توضح ما قام به الذكاء الاصطناعي.'),
});

export async function processAdminInstruction(input: z.infer<typeof AdminBrainInputSchema>) {
  return adminBrainFlow(input);
}

const adminBrainFlow = ai.defineFlow(
  {
    name: 'adminBrainFlow',
    inputSchema: AdminBrainInputSchema,
    outputSchema: AdminBrainOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      system: `أنت مدير تقني لمنصة "فهمت". مهمتك هي تحويل طلبات المسؤول النصية إلى تحديثات تقنية في مستند الإعدادات.
      يجب أن تعيد كائناً يحتوي فقط على الحقول التي طلب المسؤول تغييرها.
      تأكد من أن الكائن "updates" يحتوي على الأقل على حقل واحد إذا طلب المسؤول أي تغيير.
      مثال: إذا قال "غير لون الموقع للأخضر"، ابحث عن كود الأخضر المناسب وضعه في primaryColor.
      إذا قال "سمي الموقع فهمت بلس"، غير siteTitle.`,
      prompt: input.instruction,
      output: { schema: AdminBrainOutputSchema }
    });

    if (!output) throw new Error("فشل الذكاء الاصطناعي في إنتاج استجابة صالحة.");
    return output;
  }
);
