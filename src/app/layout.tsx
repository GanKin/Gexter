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
    <html lang="zh-Hans" className={`${inter.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
