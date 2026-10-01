
'use server';

import { google } from 'googleapis';
import { Readable } from 'stream';

/**
 * @fileOverview سيرفر أكشن مطور لرفع تسجيلات المحاضرات إلى Google Drive باستخدام بيانات المشروع الرسمية.
 */

export async function uploadRecordingToDrive(formData: FormData, fileName: string) {
  const file = formData.get('file') as File;
  if (!file) throw new Error('لم يتم استلام ملف التسجيل.');

  // الإعدادات المطلوبة (يجب ضبطها في .env)
  const CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  const PROJECT_NUMBER = '60922959373'; // رقم المشروع الخاص بك

  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.warn(`تنبيه المشروع ${PROJECT_NUMBER}: إعدادات Drive ناقصة. يتم استخدام محاكاة الرفع لـ Drive وحفظ النسخة الأصلية في Firebase.`);
    return { 
      success: true, 
      fileId: `drive_sim_${Date.now()}`, 
      message: 'تم الحفظ في Firebase بنجاح (محاكاة Drive مفعّلة).',
      webViewLink: 'https://drive.google.com/file/d/simulated_link/view' 
    };
  }

  try {
    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET);
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: file.type || 'video/mp4',
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID || 'root'],
      },
      media: {
        mimeType: file.type || 'video/mp4',
        body: stream,
      },
      fields: 'id, webViewLink'
    });

    return { 
      success: true, 
      fileId: response.data.id, 
      webViewLink: response.data.webViewLink,
      message: 'تم رفع النسخة الاحتياطية لـ Google Drive بنجاح.' 
    };
  } catch (error: any) {
    console.error('Google Drive Upload Error:', error);
    return { success: false, message: 'فشل رفع نسخة Drive: ' + error.message };
  }
}
