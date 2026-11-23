
'use server';
/**
 * @fileOverview مساعد "فهمت" الذكي للإجابة على استفسارات المنصة.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const AssistantInputSchema = z.object({
  query: z.string().describe('سؤال المستخدم حول المنصة.'),
});

const AssistantOutputSchema = z.object({
  answer: z.string().describe('إجابة المساعد الذكي.'),
  suggestedAction: z.string().optional().describe('إجراء مقترح (مثل: فتح تذكرة دعم).'),
});

export async function askPlatformAssistant(input: z.infer<typeof AssistantInputSchema>) {
  return assistantFlow(input);
}

const assistantFlow = ai.defineFlow(
  {
    name: 'assistantFlow',
    inputSchema: AssistantInputSchema,
    outputSchema: AssistantOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      system: `أنت مساعد ذكي لمنصة "فهمت" التعليمية (التي كانت تسمى سابقاً فهمني). 
      معلومات المنصة المحدثة: 
      - اسم المنصة الحالي هو "فهمت".
      - هي منصة تربط الطلاب (المستفهمين) بالخبراء (المفهمين) في بث مباشر.
      - العمولة هي 20% تخصم من المدرس.
      - يمكن شحن المحفظة عبر فودافون كاش أو المحافظ الإلكترونية في مصر.
      - سحب الأرباح يتم خلال 24 ساعة عمل من طلب السحب في فهمت.
      - يوجد نظام تقييم إلزامي بعد كل محاضرة لضمان حق الطالب والمدرس.
      - توثيق الهوية شرط أساسي للمفهمين لسحب أرباحهم.
      أجب دائماً باسم "منصة فهمت" وبأسلوب ودي واحترافي باللغة العربية. إذا كان السؤال خارج نطاق المنصة، اعتذر بلباقة.`,
      prompt: input.query,
      output: { schema: AssistantOutputSchema }
    });

    return output!;
  }
);
