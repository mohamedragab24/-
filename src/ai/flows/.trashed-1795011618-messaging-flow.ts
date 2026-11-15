
'use server';
/**
 * @fileOverview تدفق إرسال الإشعارات لمنصة فهمت.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MessagingInputSchema = z.object({
  recipient: z.string().describe('البريد أو رقم الهاتف.'),
  method: z.enum(['email', 'whatsapp']),
  subject: z.string().optional(),
  body: z.string().describe('نص الرسالة.'),
});

export async function sendNotification(input: z.infer<typeof MessagingInputSchema>) {
  return messagingFlow(input);
}

const messagingFlow = ai.defineFlow(
  {
    name: 'messagingFlow',
    inputSchema: MessagingInputSchema,
    outputSchema: z.object({ success: z.boolean(), message: z.string(), rawError: z.any().optional() }),
  },
  async (input) => {
    const apiKey = 'App d1d0cecac245ff6225debf8f02de3c36-4d903627-05b8-4656-bdc1-d3ab395a9e47';
    const baseUrl = 'pdp4k3.api.infobip.com';

    if (input.method === 'email') {
      try {
        const formData = new FormData();
        formData.append('from', 'resraa355@selfserve.worlds-connected.co');
        formData.append('to', input.recipient.trim().toLowerCase());
        formData.append('subject', input.subject || "تنبيه من منصة فهمت");
        formData.append('text', input.body);

        const res = await fetch(`https://${baseUrl}/email/3/send`, {
          method: 'POST',
          headers: { 
            'Authorization': apiKey,
            'Accept': 'application/json'
          },
          body: formData
        });
        
        let data;
        try { data = await res.json(); } catch { data = { error: 'Invalid JSON response' }; }

        if (res.ok) {
          return { success: true, message: 'تم إرسال بريد فهمت بنجاح.' };
        } else {
          return { 
            success: false, 
            message: data.requestError?.serviceException?.text || 'رفض سيرفر البريد الطلب.',
            rawError: data 
          };
        }
      } catch (err: any) { 
        return { success: false, message: 'فشل الاتصال بسيرفر بريد فهمت.', rawError: err.message }; 
      }
    } else {
      try {
        const cleanPhone = input.recipient.replace(/\D/g, '');
        const res = await fetch(`https://${baseUrl}/whatsapp/1/message/text`, {
          method: 'POST',
          headers: { 
            'Authorization': apiKey, 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            "from": "447860099299",
            "to": cleanPhone,
            "content": { "text": input.body }
          })
        });

        let data;
        try { data = await res.json(); } catch { data = { error: 'Invalid JSON response' }; }

        const isRejected = data.messages?.[0]?.status?.groupName === 'REJECTED';
        
        if (res.ok && !isRejected) {
          return { success: true, message: 'تم إرسال رسالة واتساب فهمت بنجاح.' };
        } else {
          return { 
            success: false, 
            message: data.messages?.[0]?.status?.description || data.requestError?.serviceException?.text || 'فشل إرسال واتساب فهمت.',
            rawError: data
          };
        }
      } catch (err: any) { 
        return { success: false, message: 'فشل الاتصال بسيرفر واتساب فهمت.', rawError: err.message }; 
      }
    }
  }
);
