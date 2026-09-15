
'use server';
/**
 * @fileOverview تدفق ذكاء اصطناعي لمساعدة الطلاب في صياغة طلباتهم.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const RefineInputSchema = z.object({
  text: z.string().describe('النص الذي كتبه الطالب لوصف مشكلته.'),
});

const RefineOutputSchema = z.object({
  refinedTitle: z.string().describe('عنوان مقترح محسن للطلب.'),
  refinedDescription: z.string().describe('وصف محسن وأكثر تفصيلاً للطلب.'),
});

export async function refineRequest(input: z.infer<typeof RefineInputSchema>) {
  return refineFlow(input);
}

const refineFlow = ai.defineFlow(
  {
    name: 'refineFlow',
    inputSchema: RefineInputSchema,
    outputSchema: RefineOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      prompt: `أنت مساعد تعليمي في منصة "فهمت". الطالب يريد مساعدة في: "${input.text}".
      قم بصياغة عنوان جذاب واحترافي، ووصف دقيق يشجع المدرسين المتميزين على قبول الطلب.
      اجعل الرد بصيغة JSON تحتوي على refinedTitle و refinedDescription باللغة العربية.`,
      output: { schema: RefineOutputSchema }
    });

    return output!;
  }
);
