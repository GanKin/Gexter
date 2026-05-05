import type { Metadata } from 'next';
import { Inter, Roboto_Mono } from 'next/font/google';
import type { ReactNode } from 'react';

import './globals.css';

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
});

const robotoMono = Roboto_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Dexter WebUI',
  description: 'Dexter WebUI for local financial research workflows.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-Hans" className={`${inter.variable} ${robotoMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                try {
                  const raw = localStorage.getItem('dexter-preferences');
                  const prefs = raw ? JSON.parse(raw) : {};
                  const theme = prefs && typeof prefs === 'object' && typeof prefs.theme === 'string' ? prefs.theme : 'light';
                  const resolved = theme === 'dark'
                    ? 'dark'
                    : theme === 'system'
                      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                      : 'light';
                  document.documentElement.classList.toggle('dark', resolved === 'dark');
                  document.documentElement.style.colorScheme = resolved;
                } catch {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
