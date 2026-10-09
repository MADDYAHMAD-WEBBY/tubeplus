import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TubePulse PRO | Free HD YouTube Downloader (Zero VPS / Edge Powered)',
  description: 'Download 4K, 1080p, 60fps YouTube Videos and MP3 Audio with zero server cost, powered by Cloudflare Workers and in-browser FFmpeg WebAssembly.',
  keywords: 'youtube downloader, 4k youtube downloader, next.js youtube downloader, free video downloader, cloudflare worker youtube downloader',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body 
        className="min-h-screen flex flex-col bg-dark-bg text-slate-100 antialiased selection:bg-brand-500 selection:text-white"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
