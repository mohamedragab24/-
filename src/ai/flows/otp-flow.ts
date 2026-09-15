
'use server';
/**
 * @fileOverview تدفق Genkit المطور لإدارة رموز التحقق (OTP) لمنصة فهمت.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const OTPInputSchema = z.object({
  recipient: z.string().describe('البريد الإلكتروني أو رقم الهاتف المستهدف.'),
  method: z.enum(['email', 'whatsapp']).describe('وسيلة الإرسال.'),
});

const OTPOutputSchema = z.object({
  success: z.boolean().describe('هل تم إرسال الرمز بنجاح.'),
  code: z.string().describe('الرمز الذي تم إنشاؤه.'),
  message: z.string().describe('رسالة توضح حالة العملية.'),
  debugInfo: z.any().optional().describe('بيانات تقنية للتشخيص.'),
});

export async function generateAndSendOTP(input: z.infer<typeof OTPInputSchema>) {
  return otpFlow(input);
}

const otpFlow = ai.defineFlow(
  {
    name: 'otpFlow',
    inputSchema: OTPInputSchema,
    outputSchema: OTPOutputSchema,
  },
  async (input) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const apiKey = 'App d1d0cecac245ff6225debf8f02de3c36-4d903627-05b8-4656-bdc1-d3ab395a9e47';
    const baseUrl = 'pdp4k3.api.infobip.com';

    if (input.method === 'email') {
      try {
        const formData = new FormData();
        formData.append('from', 'resraa355@selfserve.worlds-connected.co');
        formData.append('to', input.recipient.trim().toLowerCase());
        formData.append('subject', 'رمز التحقق - منصة فهمت');
        formData.append('text', `مرحباً بك في منصة فهمت، رمز التحقق الخاص بك هو: ${code}`);

        const response = await fetch(`https://${baseUrl}/email/3/send`, {
          method: 'POST',
          headers: {
            'Authorization': apiKey,
            'Accept': 'application/json',
          },
          body: formData
        });

        const data = await response.json();
        if (response.ok) {
          return { success: true, code, message: 'تم إرسال كود التحقق لبريد منصة فهمت.' };
        } else {
          return { success: false, code: '', message: 'سيرفر البريد رفض الطلب.', debugInfo: data };
        }
      } catch (err: any) {
        return { success: false, code: '', message: 'خطأ في الاتصال بسيرفر البريد.', debugInfo: err.message };
      }
    } else {
      try {
        const formattedPhone = input.recipient.trim().replace(/\D/g, ''); 
        const response = await fetch(`https://${baseUrl}/whatsapp/1/message/text`, {
          method: 'POST',
          headers: {
            'Authorization': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            "from": "447860099299",
            "to": formattedPhone,
            "content": { "text": `رمز التحقق الخاص بك لمنصة فهمت هو: ${code}` }
          })
        });

        const data = await response.json();
        const isRejected = data.messages?.[0]?.status?.groupName === 'REJECTED';

        if (response.ok && !isRejected) {
          return { success: true, code, message: 'تم إرسال كود التحقق للواتساب بنجاح.' };
        } else {
          return { 
            success: false, 
            code: '', 
            message: data.messages?.[0]?.status?.description || 'فشل إرسال رسالة الواتساب.', 
            debugInfo: data 
          };
        }
      } catch (err: any) {
        return { success: false, code, message: 'خطأ في شبكة الواتساب.', debugInfo: err.message };
      }
    }
  }
);
