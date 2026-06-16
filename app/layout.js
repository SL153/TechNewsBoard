import './globals.css';
import { Geist, Geist_Mono } from 'next/font/google';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata = {
  title: 'Innovation Dashboard',
  description: 'Your personal innovation news feed',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning color-scheme="dark light">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans bg-background text-foreground antialiased`}>
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
