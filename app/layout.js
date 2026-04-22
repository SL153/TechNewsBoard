import './globals.css';

export const metadata = {
  title: 'Tech News Dashboard',
  description: 'Your personal tech news feed',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning color-scheme="dark light">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
