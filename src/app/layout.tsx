import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ClientWrapper } from '@/components/layout/client-wrapper';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#29B6F6',
};

export const metadata: Metadata = {
  title: 'فهمت - منصة التعلم الذكي والشرح الفوري',
  description: 'فهمت هي أول منصة عربية لخدمات الشرح الفوري والربط المباشر بين المفهمين والمستفهمين لتبادل المعرفة بأمان وجودة عالية.',
  keywords: 'تعلم, شرح فوري, دروس خصوصية, تعليم اونلاين, فهمت, منصة فهمت, خبير تعليمي',
  manifest: '/manifest.json', 
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'فهمت',
  },
  openGraph: {
    title: 'فهمت - منصة التعلم الذكي',
    description: 'انضم لمنصة فهمت، أول منصة عربية لخدمات الشرح الفوري والربط المباشر بين المفهمين والمستفهمين.',
    type: 'website',
    locale: 'ar_EG',
    siteName: 'فهمت',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'فهمت - منصة التعلم الذكي',
    description: 'فهمت تربطك بأفضل الخبراء لشرح أي معلومة تحتاجها في جلسات مباشرة.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="font-body antialiased">
        <ClientWrapper>
          {children}
        </ClientWrapper>
      </body>
    </html>
  );
}
