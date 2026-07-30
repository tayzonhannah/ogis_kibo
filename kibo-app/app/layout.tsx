import type { Metadata, Viewport } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import ServiceWorker from '@/components/ServiceWorker';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'KIBO',
  description: 'A shared aquarium for two. Presence without pressure.',
  // iOS ignores the manifest's icon list for the home screen and reads
  // apple-touch-icon instead, so an installed PWA there falls back to a
  // screenshot of the page without this.
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'KIBO',
    // 'black-translucent' lets the tank run under the status bar, matching
    // viewportFit: 'cover' below.
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: '#081a26',
  // The canvas fills the viewport; let it sit under the notch on mobile.
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ServiceWorker />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
